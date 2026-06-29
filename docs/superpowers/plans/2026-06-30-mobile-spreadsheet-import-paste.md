# スマホ スプレッドシート取込（貼り付け方式・編集なし）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ(iPhone/Safari)でスプレッドシート取込ができるよう、貼り付け方式を `readText()` API から `<textarea>` 直接貼付に変え、スマホでは編集グリッドを出さず「貼付→確認→（パーティ割当）→取込」で完結させる。

**Architecture:** 既存の取込モーダル `SpreadsheetGridImportModal` のフッターのステップ分岐・パーサ・取込ロジックには一切手を入れず、**Step2 の本体（編集グリッド）だけ**を、スマホ時に「貼付 textarea + 確認サマリー」へ差し替える。スマホ判定は新規 `useIsMobile` フック。入口の「近日公開」蓋を外して PC と同じ着地点（モーダルを開く）にする。

**Tech Stack:** React + TypeScript, react-i18next, Tailwind(既存トークン/クラス), Vitest + @testing-library/react (happy-dom)。

## Global Constraints

- 会話・コメント・ドキュメントは日本語（[CLAUDE.md]）。
- UIテキストは必ず i18n キー経由・ハードコーディング禁止（[.claude/rules/i18n.md]）。例外: LP の英語説明など既存パターンに合わせる箇所のみ。
- ロケール JSON は **4言語 parity**（ja/en/ko/zh）を維持し、**該当ブロックだけ textual 編集**（全体 parse→stringify 禁止・[[feedback_locale_json_textual_edit]]）。
- 色は白黒＋機能色（青=進む/OK・赤=危険・黄=警告）のみ。既存クラス/トークンを踏襲（[.claude/rules/ui-design.md] / [.claude/rules/DESIGN.md]）。
- **PC のグリッド体験は不変**。スコープ外の変更をしない（[[feedback_scope_discipline]]）。
- push 前は `npm run build`（Vercel は tsc 厳密）+ `npx vitest run` 必須。新規 failure ゼロ（既知5件=TopBar4 + HousingWorkspace1 は除外）（[[feedback_vercel_tsc_strict]]）。
- vitest は vmThreads・**出力をパイプしない**（[[reference_vitest_vmthreads_hang]]）。
- Vercel Hobby はビルド回数に上限。push はまとめる（[[feedback_vercel_builds]]）。

---

### Task 1: `useIsMobile` フック（スマホ幅判定）

**Files:**
- Create: `src/hooks/useIsMobile.ts`
- Test: `src/hooks/__tests__/useIsMobile.test.ts`

**Interfaces:**
- Produces:
  - `MOBILE_MEDIA_QUERY: string`（= `'(max-width: 767px)'`、Tailwind の md=768px 境界）
  - `matchesMobile(win: Pick<Window, 'matchMedia'> | undefined): boolean`（純関数・テスト用）
  - `useIsMobile(): boolean`（React フック・`change` 購読）

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/__tests__/useIsMobile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchesMobile, MOBILE_MEDIA_QUERY } from '../useIsMobile';

/** matchMedia(query).matches を固定値で返す擬似 window。 */
function fakeWin(matches: boolean): Pick<Window, 'matchMedia'> {
  return {
    matchMedia: ((q: string) => ({
      matches: q === MOBILE_MEDIA_QUERY ? matches : false,
    })) as Window['matchMedia'],
  };
}

describe('matchesMobile', () => {
  it('max-width:767px にマッチすれば true', () => {
    expect(matchesMobile(fakeWin(true))).toBe(true);
  });
  it('マッチしなければ false', () => {
    expect(matchesMobile(fakeWin(false))).toBe(false);
  });
  it('window が undefined なら false (SSR)', () => {
    expect(matchesMobile(undefined)).toBe(false);
  });
  it('matchMedia 非対応なら false', () => {
    expect(matchesMobile({} as Pick<Window, 'matchMedia'>)).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/hooks/__tests__/useIsMobile.test.ts`
Expected: FAIL（`useIsMobile` モジュールが存在しない）

- [ ] **Step 3: 実装する**

`src/hooks/useIsMobile.ts`:

```ts
import { useEffect, useState } from 'react';

/** スマホ幅の境界。Tailwind の md(768px) 未満をスマホ扱い。 */
export const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

/** 純関数: 与えた window がスマホ幅か。SSR/matchMedia 非対応では false。 */
export function matchesMobile(win: Pick<Window, 'matchMedia'> | undefined): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  return win.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/** スマホ幅(<768px)かを返すフック。リサイズ/回転に追従。 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    matchesMobile(typeof window === 'undefined' ? undefined : window),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/hooks/__tests__/useIsMobile.test.ts`
Expected: PASS（4件）

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useIsMobile.ts src/hooks/__tests__/useIsMobile.test.ts
git commit -m "feat(hooks): スマホ幅判定 useIsMobile を追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Step2 のスマホ版（貼付 textarea ＋ 確認サマリー）＋ i18n

PC の Step2（GridView）は不変。スマホ時のみ、グリッド本体を textarea ベースに差し替える。フッターの「割当へ / 作成」ボタンは既存のままで、これが未貼付ガード（検出ゼロで disabled）として機能する。

**Files:**
- Modify: `src/components/SpreadsheetGridImportModal.tsx`
  - state 追加: `pasteBuffer`（[L215 付近](../../../src/components/SpreadsheetGridImportModal.tsx#L215)）
  - `resetAll` に `setPasteBuffer('')` 追加（[L226-236](../../../src/components/SpreadsheetGridImportModal.tsx#L226-L236)）
  - `useIsMobile()` 呼び出し・`handleMobilePasteChange` 追加
  - by-column バーをスマホで隠す（[L615-624](../../../src/components/SpreadsheetGridImportModal.tsx#L615-L624)）
  - グリッド貼付サーフェスをスマホ分岐に（[L636-674](../../../src/components/SpreadsheetGridImportModal.tsx#L636-L674)）
  - lucide import に `ChevronRight` を追加（未 import の場合）
- Modify: `src/locales/ja.json` `src/locales/en.json` `src/locales/ko.json` `src/locales/zh.json`（`gridImport` ブロックにキー追加）
- Test: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`（JA マップにキー追加＋スマホ分岐テスト）

**Interfaces:**
- Consumes: `useIsMobile`（Task 1）、既存 `ingestText(text: string): void`、`displayedPreviewEvents: TimelineEvent[]`、`source: 'none'|'matrix'|'grid'`。
- 追加 i18n キー（`gridImport.` 配下）:
  - `mobile_copy_hint_toggle`, `mobile_copy_hint`, `mobile_paste_label`, `mobile_paste_placeholder`, `mobile_read_ok`（`{{events}}` 補間）, `mobile_paste_empty`

- [ ] **Step 1: i18n キーを4言語に追加（textual 編集）**

各ロケールの `"gridImport": { ... }` ブロック内（既存キーの近く・末尾でよい）に追加。**ブロック全体を書き換えず、該当箇所のみ挿入**。

`src/locales/ja.json`（gridImport 内）:
```json
"mobile_copy_hint_toggle": "コピーのやり方",
"mobile_copy_hint": "Googleスプレッドシートで取り込みたい範囲を選んでコピー → 下のボックスを長押しして「ペースト」してください。",
"mobile_paste_label": "スプレッドシートを貼り付け",
"mobile_paste_placeholder": "ここを長押し →「ペースト」",
"mobile_read_ok": "読み取りました — {{events}}件のイベントを検出",
"mobile_paste_empty": "まだ貼り付けられていません。上のボックスに貼り付けてください。",
```

`src/locales/en.json`（gridImport 内）:
```json
"mobile_copy_hint_toggle": "How to copy",
"mobile_copy_hint": "In Google Sheets, select the range you want and copy it, then long-press the box below and tap Paste.",
"mobile_paste_label": "Paste spreadsheet",
"mobile_paste_placeholder": "Long-press here → Paste",
"mobile_read_ok": "Loaded — {{events}} events detected",
"mobile_paste_empty": "Nothing pasted yet. Paste into the box above.",
```

`src/locales/ko.json`（gridImport 内）:
```json
"mobile_copy_hint_toggle": "복사하는 방법",
"mobile_copy_hint": "Google 스프레드시트에서 가져올 범위를 선택해 복사한 뒤, 아래 칸을 길게 눌러 '붙여넣기'하세요.",
"mobile_paste_label": "스프레드시트 붙여넣기",
"mobile_paste_placeholder": "여기를 길게 눌러 → 붙여넣기",
"mobile_read_ok": "불러왔습니다 — 이벤트 {{events}}개 감지",
"mobile_paste_empty": "아직 붙여넣지 않았습니다. 위 칸에 붙여넣으세요.",
```

`src/locales/zh.json`（gridImport 内）:
```json
"mobile_copy_hint_toggle": "如何复制",
"mobile_copy_hint": "在 Google 表格中选择要导入的范围并复制，然后长按下方的框并点按“粘贴”。",
"mobile_paste_label": "粘贴表格",
"mobile_paste_placeholder": "长按这里 →“粘贴”",
"mobile_read_ok": "已读取 — 检测到 {{events}} 个事件",
"mobile_paste_empty": "尚未粘贴。请粘贴到上方的框中。",
```

- [ ] **Step 2: テストの JA マップにキーを追加し、失敗するスマホ分岐テストを書く**

`src/components/__tests__/SpreadsheetGridImportModal.test.tsx` の `JA` マップ（[L23 付近](../../../src/components/__tests__/SpreadsheetGridImportModal.test.tsx#L23)）に追加:
```ts
'gridImport.mobile_copy_hint_toggle': 'コピーのやり方',
'gridImport.mobile_copy_hint': 'Googleスプレッドシートで範囲を選んでコピー → 下を長押しして貼り付け',
'gridImport.mobile_paste_label': 'スプレッドシートを貼り付け',
'gridImport.mobile_paste_placeholder': 'ここを長押し →「ペースト」',
'gridImport.mobile_read_ok': '読み取りました — {{events}}件のイベントを検出',
'gridImport.mobile_paste_empty': 'まだ貼り付けられていません。',
```

ファイル末尾の `describe` 内に新規テストを追加（`useIsMobile` をモックして mobile 経路を再現）。**`vi.mock` はファイル冒頭の他の `vi.mock` 群と同じ位置（巻き上げ対象）に置く**:
```ts
// 冒頭の他の vi.mock と一緒に追加
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));
```

```ts
describe('SpreadsheetGridImportModal（スマホ分岐）', () => {
  it('スマホでは Step2 に貼付 textarea を出し、編集グリッドを出さない', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 貼付 textarea がある
    expect(screen.getByLabelText('スプレッドシートを貼り付け')).toBeInTheDocument();
    // PC グリッドの貼付サーフェス(Ctrl+V プロンプト)は出ない
    expect(screen.queryByLabelText('ここにスプレッドシートを貼り付け (Ctrl+V)')).toBeNull();
    // 列ごと貼り付けトグルも出ない
    expect(screen.queryByText('列ごとに貼り付け')).toBeNull();
  });

  it('未貼付では「パーティ割当へ」は無効、貼付後に有効化＋確認サマリー表示', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 未貼付ガード: matrix 判定前は source==='none' で「割当へ」disabled
    const nextBtn = screen.getByText('パーティ割当へ').closest('button')!;
    expect(nextBtn).toBeDisabled();
    // textarea へ matrix TSV を流し込む(onChange 経由)
    fireEvent.change(screen.getByLabelText('スプレッドシートを貼り付け'), { target: { value: matrixTSV() } });
    // 確認サマリーが出る(イベント1件検出)
    expect(screen.getByText('読み取りました — 1件のイベントを検出')).toBeInTheDocument();
    // ガード解除
    expect(nextBtn).not.toBeDisabled();
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: 新規2件が FAIL（textarea 未実装・`useIsMobile` 未 import）

- [ ] **Step 4: モーダルに `useIsMobile` と pasteBuffer・ハンドラを実装**

`SpreadsheetGridImportModal.tsx` の import 群に追加（既存 lucide import に `ChevronRight` が無ければ足す）:
```ts
import { useIsMobile } from '../hooks/useIsMobile';
```

state（[L215 の phaseName の下あたり](../../../src/components/SpreadsheetGridImportModal.tsx#L215)）に追加:
```ts
// スマホ貼付ボックスの内容(PC は GridView 直接貼付なので未使用)
const [pasteBuffer, setPasteBuffer] = useState('');
// スマホ: コピー手順の折りたたみ開閉
const [mobileCopyHintOpen, setMobileCopyHintOpen] = useState(false);
```

`resetAll` の中（[L235 setTargetOverrides の前後](../../../src/components/SpreadsheetGridImportModal.tsx#L235)）に追加:
```ts
setPasteBuffer('');
```

フック本体側（他の useCallback の近く・`ingestText` 定義より後ろ）に判定とハンドラを追加:
```ts
const isMobile = useIsMobile();
// スマホ貼付: textarea の onChange で全文を受け、そのまま ingestText に渡す。
// (iOS は readText() がブロックされ、contentEditable の onPaste も不安定なため、
//  本物の textarea + onChange を採用。長押し「ペースト」で確実に値が入る。)
const handleMobilePasteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const text = e.target.value;
  setPasteBuffer(text);
  ingestText(text);
}, [ingestText]);
```

確認サマリー用の件数（`displayedPreviewEvents` 定義より後ろ・[L426 以降](../../../src/components/SpreadsheetGridImportModal.tsx#L426)）:
```ts
// スマホ確認サマリーの「検出イベント数」。grid=表示テーブル, matrix=現在の貼付ドラフトの events。
const mobileEventCount = source === 'none' ? 0 : displayedPreviewEvents.length;
```

- [ ] **Step 5: by-column バーをスマホで隠す**

[L615-624](../../../src/components/SpreadsheetGridImportModal.tsx#L615-L624) の by-column バー（`<div ...>{flow_hint}+{paste_by_column}</div>`）を `{!isMobile && ( ... )}` で囲む。

- [ ] **Step 6: グリッド貼付サーフェスをスマホ分岐にする**

[L636-674](../../../src/components/SpreadsheetGridImportModal.tsx#L636-L674) の `<div ref={pasteSurfaceRef} ...> ... </div>`（GridView + 空状態）を、次のように `isMobile` で分岐する（PC 側は**現状のまま**移すだけ）:

```tsx
{isMobile ? (
  <div className="flex-1 overflow-auto px-5 py-5 flex flex-col gap-4">
    {/* コピー手順(折りたたみ・短文のみ) */}
    <div>
      <button
        type="button"
        onClick={() => setMobileCopyHintOpen((o) => !o)}
        className="flex items-center gap-1.5 text-app-lg text-app-text-muted"
      >
        <ChevronRight size={14} className={clsx('transition-transform duration-200', mobileCopyHintOpen && 'rotate-90')} />
        {t('gridImport.mobile_copy_hint_toggle')}
      </button>
      {mobileCopyHintOpen && (
        <p className="mt-2 text-app-lg text-app-text-muted leading-relaxed">{t('gridImport.mobile_copy_hint')}</p>
      )}
    </div>

    {/* 貼付 textarea(長押し→ペースト) */}
    <textarea
      value={pasteBuffer}
      onChange={handleMobilePasteChange}
      placeholder={t('gridImport.mobile_paste_placeholder')}
      aria-label={t('gridImport.mobile_paste_label')}
      rows={4}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className="w-full rounded-xl border border-app-border bg-app-surface2 px-4 py-3 text-app-2xl text-app-text focus:outline-none focus:border-app-text placeholder:text-app-text-muted"
    />

    {/* 確認サマリー or 未貼付メッセージ */}
    {source !== 'none' ? (
      <div className="flex items-center gap-2 text-app-2xl text-app-text">
        <CheckCircle2 size={16} className="text-app-text-muted shrink-0" />
        {t('gridImport.mobile_read_ok', { events: mobileEventCount })}
      </div>
    ) : (
      <p className="text-app-lg text-app-text-muted">{t('gridImport.mobile_paste_empty')}</p>
    )}
  </div>
) : (
  <div
    ref={pasteSurfaceRef}
    tabIndex={0}
    onPaste={handleGridPaste}
    className="flex-1 overflow-auto focus:outline-none focus:ring-2 focus:ring-app-blue/40"
    aria-label={t('gridImport.paste_prompt')}
  >
    {/* …既存の GridView + 空状態(readText ボタン含む)をそのまま移植… */}
  </div>
)}
```

注意: PC 側 `<div>` の中身（`<GridView .../>` と `{isGridEmpty && (...)}` ブロック）は**現状の内容をそのまま**移すこと（[[feedback_keep_liked_prototype_visuals]] 同様、既存挙動を1:1で保持）。

- [ ] **Step 7: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: 全 PASS（既存＋新規2件）

- [ ] **Step 8: ビルド確認**

Run: `npm run build`
Expected: tsc 厳密通過・成功。

- [ ] **Step 9: コミット**

```bash
git add src/components/SpreadsheetGridImportModal.tsx src/components/__tests__/SpreadsheetGridImportModal.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(import): スマホは編集グリッドを出さず textarea 貼付+確認に

iOS で readText がブロックされるため、Step2 をスマホ時のみ
textarea(onChange)+確認サマリーへ。PC のグリッドは不変。
未貼付ガードは既存フッターの disabled をそのまま利用。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 入口の「近日公開」蓋を外す（Timeline）

**Files:**
- Modify: `src/components/Timeline.tsx`
  - スプシボタン onClick（[L4028-4032](../../../src/components/Timeline.tsx#L4028-L4032)）
  - `gridSoonOpen` state 削除（[L1478](../../../src/components/Timeline.tsx#L1478)）
  - 「近日公開」中央モーダル削除（[L4056-4078](../../../src/components/Timeline.tsx#L4056-L4078)）
- Modify: `src/locales/{ja,en,ko,zh}.json`（`mobile.import_spreadsheet_soon_title` / `mobile.import_spreadsheet_soon_toast` を削除）

**Interfaces:**
- Consumes: 既存 `setShowGridImport`（[L1477](../../../src/components/Timeline.tsx#L1477)）。

- [ ] **Step 1: スプシボタンを実際にモーダルを開くよう変更**

[L4028-4032](../../../src/components/Timeline.tsx#L4028-L4032) の `onClick`:
```tsx
onClick={() => {
    setMobileToolsSheetOpen(false);
    setShowGridImport(true);
}}
```
（`setGridSoonOpen(true)` → `setShowGridImport(true)` に変更）

- [ ] **Step 2: `gridSoonOpen` state と「近日公開」モーダルを削除**

- [L1478](../../../src/components/Timeline.tsx#L1478) の `const [gridSoonOpen, setGridSoonOpen] = useState(false);` を削除。
- [L4056-4078](../../../src/components/Timeline.tsx#L4056-L4078) の `{gridSoonOpen && createPortal(... )}` ブロックを削除。

- [ ] **Step 3: 他に `gridSoonOpen` 参照が残っていないか確認**

Run: `git grep -n "gridSoonOpen" src/`
Expected: 出力ゼロ。

- [ ] **Step 4: 不要 i18n キーを削除（4言語・textual 編集）**

各ロケールの `mobile` ブロックから `import_spreadsheet_soon_title` と `import_spreadsheet_soon_toast` の行を削除。`mobile.import_spreadsheet_desc` は**残す**。

Run（確認）: `git grep -n "import_spreadsheet_soon" src/locales/`
Expected: 出力ゼロ。

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: 成功（未使用 import・未使用変数が無いこと。`createPortal` 等が他で使われていなければ TS エラーになるので、その場合のみ未使用 import を整理）。

- [ ] **Step 6: コミット**

```bash
git add src/components/Timeline.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(import): スマホのスプシ取込「近日公開」蓋を外しモーダルを開く

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 統合検証（ビルド・全テスト・実機）＋ 診断ページ撤去

**Files:**
- Delete（実機確認後）: `src/components/ClipboardInspectorPage.tsx`
- Modify（実機確認後）: `src/App.tsx`（`ClipboardInspectorPage` の lazy import と `/clip` ルートを削除）
- Modify: `docs/TODO.md`（本タスクの完了反映）

- [ ] **Step 1: 全体ビルド**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 2: 全テスト（パイプしない）**

Run: `npx vitest run`
Expected: 新規 failure ゼロ。既知5件（`TopBar.test.tsx` 4 + `HousingWorkspace.test.tsx` 1）のみ。

- [ ] **Step 3: push してデプロイ（まとめて1回）**

```bash
git push
```
（Task1-3 のコミットをまとめて push。Vercel 自動デプロイ）

- [ ] **Step 4: iPhone/Safari 実機で1回通す（ユーザーと）**

確認手順: インポート → 「スプレッドシートから取り込み」→ コンテンツ選択 → Step2 で textarea に長押しペースト → 「✓ 読み取りました — N件…」表示 → 「パーティ割当へ」→ 割当 → 「作成」→ タイムラインに取り込まれる。
- 1件ずつ確認（[[feedback_one_fix_one_verify]]）。問題があればここで停止して修正。

- [ ] **Step 5: 実機 OK 後、診断ページ `/clip` を撤去**

- `src/App.tsx` から `ClipboardInspectorPage` の lazy import 行と `<Route path="/clip" ... />` 行を削除。
- `src/components/ClipboardInspectorPage.tsx` を削除。

Run: `git grep -n "ClipboardInspectorPage\|/clip" src/`
Expected: 出力ゼロ。

- [ ] **Step 6: ビルド＆コミット＆push**

```bash
npm run build
git add -A
git commit -m "chore(diag): 役目を終えた /clip 採取ページを撤去

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

- [ ] **Step 7: TODO 更新**

`docs/TODO.md` の「スプシ取込のスマホ本格対応」項を完了に更新し、完了分は `TODO_COMPLETED.md` へ移動。「現在の状態」を更新。

---

## Self-Review

**1. Spec coverage（spec の各節 → タスク対応）**
- 入口の蓋外し → Task 3 ✓
- モバイル判定フック → Task 1 ✓
- Step2 スマホ版（コピー案内/textarea/確認サマリー/フェーズ名/未貼付ガード）→ Task 2 ✓（ガードは既存フッター disabled を利用＝Task2 テストで検証）
- Step1/Step3/取込 不変 → 触らない（Task 2 は Step2 本体のみ差し替え）✓
- i18n 4言語追加・soon キー撤去 → Task 2 / Task 3 ✓
- スコープ/非対象（PC不変・セル編集なし・図解なし）→ 設計どおり ✓
- 後始末（/clip 撤去）→ Task 4 ✓
- テスト（useIsMobile 単体・モーダル分岐・回帰・実機）→ Task 1/2/4 ✓

**2. Placeholder スキャン:** 各コード手順に実コードを記載済み。"TBD"/"後で"なし。PC 側 `<div>` 中身は「現状をそのまま移植」と明記（Task2 Step6）。

**3. 型/名称整合:** `useIsMobile`/`matchesMobile`/`MOBILE_MEDIA_QUERY`（Task1）= Task2 で import 名一致。`pasteBuffer`/`handleMobilePasteChange`/`mobileEventCount`/`mobileCopyHintOpen` は Task2 内で定義・使用一致。i18n キー名は Task2 追加分と Task2 テスト/JSX 参照が一致（`gridImport.mobile_*`）。`gridSoonOpen` は Task3 で定義削除＋参照削除（grep ゼロで担保）。
