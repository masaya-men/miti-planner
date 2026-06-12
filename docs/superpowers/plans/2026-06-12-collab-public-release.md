# 共同編集 一般公開 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既に本番デプロイ済の共同編集エンジンを、admin gate を外して一般公開できる状態に仕上げる（UI/UX 修正・バグ修正・検証・ゲート撤去）。

**Architecture:** 機能本体は変更しない。公開前の UI 仕上げ（カーソルトグル・ジョイナーヘッダー・バナー位置・共有モーダル）、バグ修正（人数 +/- の遅延）、ゲート撤去（admin → login）、実機検証のみ。ゲート撤去は全項目が緑になってから**最後**に行う（封印を外した瞬間に一般露出するため）。

**Tech Stack:** React 18 + TypeScript + Zustand + i18next + Tailwind v4 + Vitest（happy-dom）。設計書 = [docs/superpowers/specs/2026-06-12-collab-public-release-design.md](../specs/2026-06-12-collab-public-release-design.md)。

**前提（git 実測 2026-06-12）:** ブランチ `feat/collab-public-release`（`main` = `7d733b3` から分岐）。collab 全段は main merged + 本番デプロイ済。⑤プライバシーポリシーは既に4言語実装済（確認のみ）。

**コミット規約:** RTK 使用（`rtk git ...`）。コミットメッセージ末尾に `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

**共通の検証コマンド:**
- テスト（単一ファイル）: `rtk npx vitest run <path> --no-color`（⚠ [[reference_vitest_vmthreads_hang]] パイプ禁止・単一ファイル指定）
- ビルド: `rtk npm run build`（Vercel は tsc -b 厳密 = 未使用変数/型不足が罠 [[feedback_vercel_tsc_strict]]）

---

## Task 1: ⑦ ShareChoiceModal の2択ボタンに押下フィードバック追加

**Files:**
- Modify: `src/components/collab/ShareChoiceModal.tsx:30,34`

理由: 「コピーを配る」「一緒に編集する」ボタンに `active:scale` が無い（✕ボタン[:27]にはある）。全幅ボタンなので `active:scale-[0.98]`（95 だと大きすぎる）。

- [ ] **Step 1: onCopy ボタンに押下フィードバック追加**

[src/components/collab/ShareChoiceModal.tsx:30](../../../src/components/collab/ShareChoiceModal.tsx#L30) の `className` 末尾（`disabled:cursor-not-allowed` の直後、文字列内）に ` active:scale-[0.98]` を追加。変更後の className は次を含むこと:

```
... transition-colors text-left active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
```

- [ ] **Step 2: onCollab ボタンに押下フィードバック追加**

[src/components/collab/ShareChoiceModal.tsx:34](../../../src/components/collab/ShareChoiceModal.tsx#L34) の `className` にも同様に ` active:scale-[0.98]` を追加。変更後:

```
... transition-colors text-left active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait
```

- [ ] **Step 3: ビルドで型/構文を確認**

Run: `rtk npm run build`
Expected: EXIT=0

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/collab/ShareChoiceModal.tsx
rtk git commit -m "fix(collab): 共有2択ボタンに押下フィードバック(active:scale)を追加"
```

---

## Task 2: ⑧ 人数 +/- の遅延根治（楽観的更新＋デバウンス）

**Files:**
- Modify: `src/store/useCollabSessionStore.ts`（`setMax` の実装と interface の型）
- Test: `src/store/__tests__/useCollabSessionStore.setMax.test.ts`（新規）

**根本原因（コード確定）:** [useCollabSessionStore.ts:75-77](../../../src/store/useCollabSessionStore.ts#L75) は `await setMaxParticipants()`（API 往復）の応答後に初めて表示を更新する → クリックごとにサーバ往復を待つ。修正 = クリックで即時にローカル更新（楽観的）＋ API はデバウンスで最終値のみ送信。

- [ ] **Step 1: 失敗するテストを書く**

Create `src/store/__tests__/useCollabSessionStore.setMax.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../lib/collab/collabRoomApi', () => ({
  createRoom: vi.fn(),
  setMaxParticipants: vi.fn(),
  revokeRoom: vi.fn(),
  reissueRoom: vi.fn(),
}));

import { useCollabSessionStore } from '../useCollabSessionStore';
import { setMaxParticipants } from '../../lib/collab/collabRoomApi';

describe('useCollabSessionStore.setMax (楽観的更新 + デバウンス)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(setMaxParticipants).mockReset();
    useCollabSessionStore.setState({ maxParticipants: 8 });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('楽観的更新: maxParticipants が即時に変わり、API はまだ呼ばれない', () => {
    useCollabSessionStore.getState().setMax('p1', 12);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(12);
    expect(setMaxParticipants).not.toHaveBeenCalled();
  });

  it('デバウンス: 連打しても API は最終値で1回だけ呼ばれる', async () => {
    vi.mocked(setMaxParticipants).mockResolvedValue({ roomToken: 't', maxParticipants: 15, revoked: false });
    const s = useCollabSessionStore.getState();
    s.setMax('p1', 9);
    s.setMax('p1', 10);
    s.setMax('p1', 15);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(15); // 即時反映
    expect(setMaxParticipants).not.toHaveBeenCalled();                 // まだ送らない
    await vi.advanceTimersByTimeAsync(400);
    expect(setMaxParticipants).toHaveBeenCalledTimes(1);
    expect(setMaxParticipants).toHaveBeenCalledWith('p1', 15);
  });

  it('reconcile: API の確定値で上書きする', async () => {
    vi.mocked(setMaxParticipants).mockResolvedValue({ roomToken: 't', maxParticipants: 20, revoked: false });
    useCollabSessionStore.getState().setMax('p1', 99); // クランプはサーバ側→20が返る想定
    await vi.advanceTimersByTimeAsync(400);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(20);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npx vitest run src/store/__tests__/useCollabSessionStore.setMax.test.ts --no-color`
Expected: FAIL（現状 setMax は async で即時反映せず・連打で複数回呼ぶ）

- [ ] **Step 3: setMax を楽観的更新＋デバウンスに書き換える**

[src/store/useCollabSessionStore.ts](../../../src/store/useCollabSessionStore.ts) を編集。

(a) `import type { CollabSession }` の下（create の外・モジュールスコープ）にデバウンス用の変数を追加:

```ts
// 人数変更のデバウンス: 連打しても最後の値だけサーバへ送る(往復待ちで表示が遅れるのを防ぐ)。
let maxSyncTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_SYNC_DEBOUNCE_MS = 400;
```

(b) interface の `setMax` の型を変更（[:33] `Promise<void>` → `void`）:

```ts
  /** 入れる人数を変更(楽観的更新で即時反映・API はデバウンスで最終値のみ送信)。 */
  setMax: (planId: string, n: number) => void;
```

(c) `setMax` の実装（[:75-78]）を差し替え:

```ts
  setMax: (planId, n) => {
    // 楽観的更新: クリックで即時に表示へ反映(サーバ往復を待たない)。
    set({ maxParticipants: n });
    // デバウンス: 連打中は送らず、止まってから最終値だけ送る。
    if (maxSyncTimer) clearTimeout(maxSyncTimer);
    maxSyncTimer = setTimeout(() => {
      maxSyncTimer = null;
      void setMaxParticipants(planId, n)
        .then((info) => set({ maxParticipants: info.maxParticipants })) // サーバ確定値で reconcile
        .catch(() => { /* 反映失敗時は楽観値のまま(次の操作で再送される) */ });
    }, MAX_SYNC_DEBOUNCE_MS);
  },
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `rtk npx vitest run src/store/__tests__/useCollabSessionStore.setMax.test.ts --no-color`
Expected: PASS（3件）

- [ ] **Step 5: 呼び出し側（OwnerCollabPanel）の整合を確認**

[OwnerCollabPanel.tsx:50-53](../../../src/components/collab/OwnerCollabPanel.tsx#L50) の `step()` は `void setMax(planId, next)` を呼ぶ。`setMax` が void 返却になっても `void setMax(...)` は有効。**変更不要**。`step` のクランプ（`Math.max(1, Math.min(SYSTEM_MAX_PARTICIPANTS, ...))`）は楽観値が即時更新されるので連打でも正しく積み上がる。コードを開いて確認するだけ（編集不要）。

- [ ] **Step 6: ビルド確認**

Run: `rtk npm run build`
Expected: EXIT=0（setMax の型変更で未使用 await 等が無いこと）

- [ ] **Step 7: Commit**

```bash
rtk git add src/store/useCollabSessionStore.ts src/store/__tests__/useCollabSessionStore.setMax.test.ts
rtk git commit -m "fix(collab): 人数+/-の遅延根治(楽観的更新+デバウンスで往復待ちを解消)"
```

---

## Task 3: ① カーソルトグルをボタン化＋状態テキスト常時表示

**Files:**
- Modify: `src/components/collab/PresenceControls.tsx:52-62`
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`（collab セクションに4キー追加）
- Test: `src/components/collab/__tests__/PresenceControls.test.tsx`（状態テキストのテスト1件追加）

理由: 現状は丸いスイッチで状態テキスト無し・拡大率258%で枠（`w-[190px]`）からはみ出る。ボタン＋状態テキストに置換（業界水準の状態明示）。`aria-label="cursor-toggle"` は維持し既存テストを壊さない。

- [ ] **Step 1: i18n キーを4言語に追加**

各 `src/locales/*.json` の `collab` セクション（`cursor_fallback` の直後あたり）に4キーを追加。

ja.json:
```json
        "cursor_turn_on": "オンにする",
        "cursor_turn_off": "オフにする",
        "cursor_status_on": "今はカーソル共有が ON です",
        "cursor_status_off": "今はカーソル共有が OFF です",
```
en.json:
```json
        "cursor_turn_on": "Turn on",
        "cursor_turn_off": "Turn off",
        "cursor_status_on": "Cursor sharing is ON",
        "cursor_status_off": "Cursor sharing is OFF",
```
ko.json:
```json
        "cursor_turn_on": "켜기",
        "cursor_turn_off": "끄기",
        "cursor_status_on": "지금 커서 공유가 ON 입니다",
        "cursor_status_off": "지금 커서 공유가 OFF 입니다",
```
zh.json:
```json
        "cursor_turn_on": "开启",
        "cursor_turn_off": "关闭",
        "cursor_status_on": "当前光标共享为 ON",
        "cursor_status_off": "当前光标共享为 OFF",
```

⚠ JSON の直前の行に末尾カンマを付けるのを忘れない（既存の最後のキー `cursor_fallback` の行末に `,` が無ければ付ける）。

- [ ] **Step 2: 失敗するテストを書く（状態テキスト）**

[src/components/collab/__tests__/PresenceControls.test.tsx](../../../src/components/collab/__tests__/PresenceControls.test.tsx) に追加:

```tsx
  it('状態テキストを常時表示する(OFF→ON で文言が切り替わる)', () => {
    render(<PresenceControls />);
    expect(screen.getByText('collab.cursor_status_off')).toBeInTheDocument();
    // OFF 時のボタンは「オンにする」
    expect(screen.getByLabelText('cursor-toggle')).toHaveTextContent('collab.cursor_turn_on');
  });

  it('ON のとき状態テキストとボタン文言が ON 用になる', () => {
    useCollabPresenceStore.getState().setCursorEnabled(true);
    render(<PresenceControls />);
    expect(screen.getByText('collab.cursor_status_on')).toBeInTheDocument();
    expect(screen.getByLabelText('cursor-toggle')).toHaveTextContent('collab.cursor_turn_off');
  });
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `rtk npx vitest run src/components/collab/__tests__/PresenceControls.test.tsx --no-color`
Expected: FAIL（status テキストがまだ無い）

- [ ] **Step 4: トグルスイッチをボタン＋状態テキストに置換**

[src/components/collab/PresenceControls.tsx:52-62](../../../src/components/collab/PresenceControls.tsx#L52) の「カーソル ON/OFF」ブロックを次に差し替え:

```tsx
      {/* カーソル ON/OFF: ボタン + 状態テキスト常時表示(枠 w-[190px] に収める) */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-app-sm text-app-text flex-1">{t('collab.cursor_share_label')}</span>
          <button
            aria-label="cursor-toggle"
            onClick={toggle}
            className={`shrink-0 px-2.5 h-7 rounded-lg text-app-xs font-bold cursor-pointer active:scale-95 transition-all ${cursorEnabled ? 'bg-app-surface2 border border-app-border text-app-text' : 'bg-app-text text-app-bg'}`}
          >
            {cursorEnabled ? t('collab.cursor_turn_off') : t('collab.cursor_turn_on')}
          </button>
        </div>
        <p className="text-app-xs text-app-text-muted">
          {cursorEnabled ? t('collab.cursor_status_on') : t('collab.cursor_status_off')}
        </p>
      </div>
```

- [ ] **Step 5: テストを実行して成功を確認（既存テストも維持）**

Run: `rtk npx vitest run src/components/collab/__tests__/PresenceControls.test.tsx --no-color`
Expected: PASS（既存4件 + 新規2件）。既存テストは `aria-label="cursor-toggle"` 経由なので壊れない。

- [ ] **Step 6: ビルド確認**

Run: `rtk npm run build`
Expected: EXIT=0

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/collab/PresenceControls.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/collab/__tests__/PresenceControls.test.tsx
rtk git commit -m "feat(collab): カーソルトグルをボタン+状態テキスト常時表示に改修(枠はみ出し解消)"
```

---

## Task 4: ③ ジョイナー専用の表示専用ヘッダーを作る

**Files:**
- Create: `src/components/CollabJoinerHeader.tsx`
- Test: `src/components/__tests__/CollabJoinerHeader.test.tsx`（新規）

理由: `ConsolidatedHeader` は `usePlanStore`/`useMitigationStore` に密結合（[ConsolidatedHeader.tsx:90,108](../../../src/components/ConsolidatedHeader.tsx#L90)）でジョイナーの**自分のソロデータ**を読む/書く → 流用すると混乱・漏洩。表示専用の軽量ヘッダーを別に作る（LoPo ブランド + テーマ/言語切替のみ・plan store 非依存）。

- [ ] **Step 1: 失敗するテストを書く**

Create `src/components/__tests__/CollabJoinerHeader.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollabJoinerHeader } from '../CollabJoinerHeader';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../LanguageSwitcher', () => ({ LanguageSwitcher: () => <div data-testid="lang" /> }));

describe('CollabJoinerHeader', () => {
  it('LoPo ブランドと言語切替・テーマ切替を表示する(plan store 非依存)', () => {
    render(<CollabJoinerHeader />);
    expect(screen.getByText('LoPo')).toBeInTheDocument();
    expect(screen.getByTestId('lang')).toBeInTheDocument();
    expect(screen.getByLabelText('toggle-theme')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npx vitest run src/components/__tests__/CollabJoinerHeader.test.tsx --no-color`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: CollabJoinerHeader を実装**

Create `src/components/CollabJoinerHeader.tsx`:

```tsx
// ジョイナー(招かれた参加者)専用の表示専用ヘッダー。
// ⚠ usePlanStore / 自動保存 / localStorage に一切触れない(漏洩防止の不変条件を守る)。
// 内容は LoPo ブランド + 言語切替 + テーマ切替のみ。ジョブ/ステータス編集は配線しない(表示用)。
import { useThemeStore } from '../store/useThemeStore';
import { Sun, Moon } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

export function CollabJoinerHeader() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <header className="shrink-0 h-12 px-4 flex items-center justify-between border-b border-app-border bg-app-bg">
      <span className="font-bold text-app-text">LoPo</span>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <button
          aria-label="toggle-theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded hover:bg-app-surface transition-colors active:scale-90"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
}
```

⚠ 実装前に [src/store/useThemeStore.ts](../../../src/store/useThemeStore.ts) を開き、`theme` / `setTheme` のシグネチャを確認すること（[LegalPage.tsx:312](../../../src/components/LegalPage.tsx#L312) は `const { theme, setTheme } = useThemeStore()` で使用＝存在は確認済）。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `rtk npx vitest run src/components/__tests__/CollabJoinerHeader.test.tsx --no-color`
Expected: PASS

- [ ] **Step 5: ビルド確認**

Run: `rtk npm run build`
Expected: EXIT=0

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/CollabJoinerHeader.tsx src/components/__tests__/CollabJoinerHeader.test.tsx
rtk git commit -m "feat(collab): ジョイナー表示専用ヘッダー(LoPoブランド/言語/テーマ・plan store非依存)"
```

---

## Task 5: ③④ ジョイナーページにヘッダーを差し込み、赤バナーを画面下へ

**Files:**
- Modify: `src/components/CollabJoinerPage.tsx:174-194`

理由: ③ヘッダー表示 + ④バナーを上→下へ。漏洩防止の不変条件（効果A/Bの useEffect・persist skip・cleanup 順序）は**一切触らない**（JSX の描画順のみ変更）。

- [ ] **Step 1: import に CollabJoinerHeader を追加**

[CollabJoinerPage.tsx:10](../../../src/components/CollabJoinerPage.tsx#L10) 付近（`CollabJoinerBanner` の import の下）に追加:

```tsx
import { CollabJoinerHeader } from "./CollabJoinerHeader";
```

- [ ] **Step 2: sheet 描画（return）の JSX を差し替え**

[CollabJoinerPage.tsx:174-194](../../../src/components/CollabJoinerPage.tsx#L174) の `return ( <div className="collab-joiner-shell ...> ... </div> )` を次に差し替え（ヘッダーを先頭に追加・バナーを末尾＝画面下へ移動）:

```tsx
  return (
    <div className="collab-joiner-shell w-full h-screen overflow-hidden bg-app-bg flex flex-col">
      <CollabJoinerHeader />
      <div className="flex-1 overflow-auto relative flex">
        {/* ④-b-2: ジョイナーも自分のカーソル/ジョブを共有できる(既定 OFF オプトイン)。 */}
        <div className="absolute top-2 right-2 z-30 glass-tier2 rounded-xl p-2.5 w-[190px] shadow-lg">
          <PresenceControls />
        </div>
        <ErrorBoundary>
          <Timeline />
        </ErrorBoundary>
      </div>
      {/* ④ 赤い注意バナーは画面下へ(状態別 CTA: login/consent/edit)。 */}
      <CollabJoinerBanner
        isLoggedIn={isLoggedIn}
        canEdit={canEdit}
        ownerLabel={ownerLabel}
        onLogin={() => useAuthStore.getState().signInWith("discord")}
        onOpenConsent={() => setConsentOpen(true)}
      />
      <CollabEditConsentModal isOpen={consentOpen} onAccept={acceptConsent} onCancel={() => setConsentOpen(false)} />
    </div>
  );
```

（変更点は2つだけ: 先頭に `<CollabJoinerHeader />` を追加 / `<CollabJoinerBanner .../>` を content `div` の**前→後**へ移動。useEffect・状態・cleanup は触らない。）

- [ ] **Step 3: 既存のジョイナーページテストが緑のままか確認**

Run: `rtk npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx --no-color`
Expected: PASS（純関数 `joinerView`/`computeCanEdit`/`rehydrateThenClearReadonly` のテストが中心＝JSX 並べ替えの影響なし。落ちたら原因調査）

- [ ] **Step 4: ビルド確認**

Run: `rtk npm run build`
Expected: EXIT=0

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/CollabJoinerPage.tsx
rtk git commit -m "feat(collab): ジョイナー画面にヘッダー追加+赤バナーを画面下へ"
```

---

## Task 6: ⑤ プライバシーポリシーのカーソル/IP 記載を4言語で確認

**Files:**
- Verify only: `src/locales/{ja,en,ko,zh}.json`（`legal.privacy_collab_*`）・`src/components/LegalPage.tsx:170-175`

理由: 設計時は「1行追記」想定だったが、実コード確認で**既に4言語で実装済**（[ja.json:824-827](../../../src/locales/ja.json#L824) に IP 露出を明記）。新規作業ではなく**抜けが無いかの確認**に縮小。

- [ ] **Step 1: 4言語に `privacy_collab_items` が存在し IP 露出に触れているか確認**

Run: `rtk grep "privacy_collab_items" src/locales`
Expected: ja/en/ko/zh の4ファイル全てにキーが存在し、各言語で「IP / P2P」相当の記述があること。1つでも欠けていたら ja を基に補う（その場合のみ編集）。

- [ ] **Step 2: LegalPage が当該セクションを描画しているか確認**

[LegalPage.tsx:170-175](../../../src/components/LegalPage.tsx#L170) に `privacy_collab_title/body/items/note` の描画があることを目視確認（編集不要）。

- [ ] **Step 3: 欠けが無ければコミット不要。補った場合のみ commit**

```bash
# (Step1で補完した場合のみ)
rtk git add src/locales/ko.json src/locales/zh.json
rtk git commit -m "docs(collab): プライバシーポリシーのカーソル/IP記載の欠け補完"
```

---

## Task 7: ② admin gate を撤去（`!isAdmin` → 未ログイン）【公開直前・最後に実施】

> ⚠ **このタスクは Task 1〜6 が全て緑 + ⑤-3d 実機検証(Task 8)が OK になってから最後に行う。** 封印を外した瞬間に一般ユーザーへ露出する。

**Files:**
- Modify: `src/components/ShareButtons.tsx:34,46`
- Modify: `src/components/collab/__tests__/ShareButtons.collab.test.tsx`

理由: 確定モデル「編集ログイン必須/閲覧誰でも」。部屋作成 API はログイン必須（⑤-2a）なので、未ログインには共同編集 UI を出さずコピー共有へ直行させる。

- [ ] **Step 1: 既存テストをログインゲート仕様へ更新（失敗させる）**

[ShareButtons.collab.test.tsx](../../../src/components/collab/__tests__/ShareButtons.collab.test.tsx) を編集:
- [:22] の前提を「ログイン済（isAdmin 不問）」に: `useAuthStore.setState({ user: { uid: 'uid1' }, isAdmin: false } as any);`（isAdmin=false でも2択が見えること＝ログインで十分を表す）
- [:55-58] の「isAdmin=false で非表示」テストを「**未ログイン**で非表示」に置換:

```tsx
  it('未ログインは共同編集を出さない(コピー共有へ直行)', () => {
    useAuthStore.setState({ user: null, isAdmin: false } as any);
    render(<ShareButtons {...baseProps} />); // baseProps は既存テストの描画引数に合わせる
    fireEvent.click(screen.getByLabelText(/share/i)); // 既存の共有トリガに合わせる
    expect(screen.queryByText('collab.choice_title')).not.toBeInTheDocument();
  });
```

⚠ 既存テストの render 引数・共有トリガの取得方法（`getByLabelText` 等）は[現行テスト](../../../src/components/collab/__tests__/ShareButtons.collab.test.tsx)の書き方をそのまま踏襲すること（この計画の擬似コードに合わせて実テストの形を壊さない）。[:21] のコメント「共同編集 UI は管理者ゲートの内側」も「ログインゲートの内側」に更新。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npx vitest run src/components/collab/__tests__/ShareButtons.collab.test.tsx --no-color`
Expected: FAIL（現状は `!isAdmin` ゲートなので isAdmin=false ログイン済でも2択が出ない）

- [ ] **Step 3: ShareButtons のゲートをログイン判定へ変更**

[src/components/ShareButtons.tsx:34](../../../src/components/ShareButtons.tsx#L34) の destructure から `isAdmin` を外す（未使用変数は Vercel tsc で落ちる [[feedback_vercel_tsc_strict]]）:

```tsx
    const { user } = useAuthStore();
```

[src/components/ShareButtons.tsx:46](../../../src/components/ShareButtons.tsx#L46) のゲートをログイン判定に:

```tsx
        if (!user) { setView('copy'); return; }   // 未ログインはコピー共有へ直行(部屋作成はログイン必須)
```

⚠ `isAdmin` が [ShareButtons.tsx] の他行で使われていないことを確認（grep 済 = [:34],[:46] のみ）。使われていれば残す。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `rtk npx vitest run src/components/collab/__tests__/ShareButtons.collab.test.tsx --no-color`
Expected: PASS

- [ ] **Step 5: ビルド確認**

Run: `rtk npm run build`
Expected: EXIT=0（`isAdmin` 未使用エラーが無いこと）

- [ ] **Step 6: Commit（push はまだしない）**

```bash
rtk git add src/components/ShareButtons.tsx src/components/collab/__tests__/ShareButtons.collab.test.tsx
rtk git commit -m "feat(collab): admin gateを撤去しログインゲートへ(一般公開・編集ログイン必須/閲覧誰でも)"
```

---

## Task 8: ⑤-3d 2ブラウザ実機 E2E 検証（ユーザーと一緒に・要デプロイ）

**Files:** なし（手順実行・検証）。Worker 変更が無いので `wrangler deploy` 不要、Vercel への push で検証用にデプロイ。

> ⚠ Task 7（ゲート撤去）の**前**にこの検証を行う場合は、admin アカウントで検証する（gate 内）。Task 7 の後なら一般ログインで検証。**推奨順序 = Task1-6 → Task8（gate内でadmin検証）→ 問題なければ Task7 → 再 push → 一般で最終確認**。

- [ ] **Step 1: 検証用にデプロイ**

Task1-6 をコミット済の状態で、ユーザー承認のうえ `rtk git push origin feat/collab-public-release` ではなく、**検証はプレビュー or main 反映の方針をユーザーと決める**（[[feedback_vercel_builds]] ビルド枠節約・push はまとめる）。本番反映する場合は `rtk git push origin HEAD:main`。

- [ ] **Step 2: 2ブラウザで E2E（設計書 §4 の8項目）**

ユーザーと一緒に確認（1件ずつ・[[feedback_one_fix_one_verify]]）:
1. オーナー(A・ログイン)がリンク発行 → ②人数 +/- が即時反映・連打で遅延無し。
2. ジョイナー(B)が `/collab/:token` で参加 → ③ヘッダー表示・④赤バナー下・閲覧表示。
3. B がログイン+同意 → 編集解禁 → A にライブ反映。
4. 双方向ライブ反映（軽減配置・partyMembers）。
5. リロード後保持（onSave→再接続残存）。
6. A が失効 → B 弾かれる / 再発行 → 旧リンク無効。
7. ①カーソル ON/OFF（ボタン+状態テキスト・枠はみ出し無し・IP 同意モーダル・双方向）。
8. 列増殖が再発しないこと（プラン切替・ON→ON・リロード反復）。

- [ ] **Step 3: 問題があれば1件ずつ修正 → 再検証**

各修正は対応する Task のパターンで TDD → commit → 再デプロイ → 再確認。

- [ ] **Step 4: 全項目 OK を記録**

`docs/TODO.md` の「現在の状態」を更新（検証完了・残はゲート撤去のみ等）。

---

## Task 9: 公開（ゲート撤去を含めて本番反映）

- [ ] **Step 1: 最終ビルド + 関連テスト緑を確認**

Run: `rtk npm run build`（EXIT=0）/ 主要 collab テストを単一ファイルで緑確認。

- [ ] **Step 2: main へ反映**

ユーザー GO のうえ:
```bash
rtk git push origin HEAD:main
```
Worker 変更は無い（本リリースは client/i18n/store のみ）ため `wrangler deploy` 不要。Vercel 自動デプロイ [[reference_vercel_git_autodeploy]]。

- [ ] **Step 3: 本番スモーク**

トップ表示 / ログインユーザーで共有2択が出る / 未ログインはコピー共有のみ / `/collab/<token>` で閲覧できる、を実機確認。

- [ ] **Step 4: 公開後の計測（数日）**

Vercel Edge Requests / Cloudflare 使用量を数日計測。問題なければ後回し TODO（監視 cron 等）へ。問題が出たら `vercel promote` で即ロールバック可能な状態を保つ。

- [ ] **Step 5: TODO/memory 更新 + 完了タスクを TODO_COMPLETED.md へ**

---

## 自己レビュー結果

**スペック網羅性チェック（spec §の各項目 → タスク対応）:**
- §1.1 コスト=A（実装不要・方針）→ タスク不要（設計書に記録済）✅
- §1.2 荒らし=A（実装不要・方針）→ タスク不要 ✅
- §1.3 ゲート撤去 → Task 7 ✅
- §2.1 カーソルトグル → Task 3 ✅
- §2.2 ジョイナーヘッダー → Task 4 + Task 5 ✅
- §2.3 バナー下 → Task 5 ✅
- §2.4 プライバシーポリシー → Task 6（確認のみ＝既存実装）✅
- §2.5 共有モーダル押下フィードバック → Task 1 ✅
- §2.6 人数 +/- 遅延 → Task 2 ✅
- §4 ⑤-3d 検証 → Task 8 ✅
- §5 公開手順（ゲート最後）→ Task 7 の警告 + Task 8/9 の順序 ✅

**型整合チェック:** `setMax` の型を `Promise<void>`→`void` に変更（interface[:33] と実装[:75] の両方・呼び出し OwnerCollabPanel は `void setMax` で互換）。新規キー `cursor_turn_on/off`・`cursor_status_on/off` は Task3 で4言語に定義し PresenceControls で参照（一致）。`CollabJoinerHeader` は Task4 で定義し Task5 で import（一致）。

**プレースホルダ:** 無し（全タスクに実コード・実コマンド・期待値）。Task6/8 は意図的に「確認/手順」タスク（新規コードを伴わない正当な検証）。
