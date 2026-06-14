# デバフ軽減不可 ワンタッチ設定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムラインの種別アイコンを PC で右クリックすると `ignoresDebuffMitigation`（デバフ軽減不可）を即トグルでき、管理画面テンプレ編集でもチェック列で設定・保存できるようにする。

**Architecture:** 既存の左クリック循環（`PcTypeToggle` → `updateEvent`）と完全に同一経路で右クリックトグルを追加（collab/Undo/再計算/赤枠が自動で正しく動く）。管理画面は `updateCell` の switch に case を 1 つ足し、テーブルにチェック列を追加。UI 文言は i18n 4 言語。

**Tech Stack:** React + TypeScript, Zustand (`useMitigationStore`), react-i18next, vitest + @testing-library/react (happy-dom), Tailwind。

設計書: [docs/superpowers/specs/2026-06-15-debuff-immune-quick-toggle-design.md](../specs/2026-06-15-debuff-immune-quick-toggle-design.md)

---

## File Structure

- **Modify** `src/locales/{ja,en,ko,zh}.json` — i18n キー 3 種追加（timeline 2 + admin 1）
- **Modify** `src/components/DamageTypeIcon.tsx` — `withTooltip?: boolean` prop 追加（内部ツールチップ抑止）
- **Modify** `src/components/__tests__/DamageTypeIcon.test.tsx` — withTooltip テスト追加
- **Modify** `src/components/TimelineRow.tsx` — `PcTypeToggle` を export + `onContextMenu` トグル + 2 行ツールチップ + `withTooltip={false}`
- **Create** `src/components/__tests__/PcTypeToggle.test.tsx` — 右クリック/左クリックの挙動テスト
- **Modify** `src/hooks/useTemplateEditor.ts` — `updateCell` の switch に `ignoresDebuffMitigation` case
- **Modify** `src/hooks/__tests__/useTemplateEditor.test.ts` — 新 case のテスト
- **Modify** `src/components/admin/TemplateEditor.tsx` — colgroup + th + td チェックボックス列
- **Modify** `docs/TODO.md` — 完了記録

---

## Task 1: i18n キー追加（4 言語）

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`

新規キー：
- `timeline.type_action_left` … 左クリック説明
- `timeline.type_action_right` … 右クリック説明（`{{state}}` に ON/OFF を差し込む）
- `admin.tpl_editor_debuff_immune` … 管理画面の列ヘッダー

- [ ] **Step 1: timeline キーを 4 言語に追加**

各ファイルの `"debuff_immune_hint"` 行を以下に置換（既存行はそのまま残し、後ろに 2 キー追加）。

`src/locales/ja.json`（既存: `"debuff_immune_hint": "デバフ軽減無効",`）:
```json
        "debuff_immune_hint": "デバフ軽減無効",
        "type_action_left": "左クリック: 種別を変更",
        "type_action_right": "右クリック: デバフ軽減不可 を切替（現在: {{state}}）",
```

`src/locales/en.json`（既存: `"debuff_immune_hint": "Debuff mitigation has no effect",`）:
```json
        "debuff_immune_hint": "Debuff mitigation has no effect",
        "type_action_left": "Left-click: Change type",
        "type_action_right": "Right-click: Toggle \"Ignores debuff mitigation\" (now: {{state}})",
```

`src/locales/ko.json`（既存: `"debuff_immune_hint": "디버프 경감 무효",`）:
```json
        "debuff_immune_hint": "디버프 경감 무효",
        "type_action_left": "좌클릭: 타입 변경",
        "type_action_right": "우클릭: '디버프 경감 불가' 전환 (현재: {{state}})",
```

`src/locales/zh.json`（既存: `"debuff_immune_hint": "减益减伤无效",`）:
```json
        "debuff_immune_hint": "减益减伤无效",
        "type_action_left": "左键: 切换类型",
        "type_action_right": "右键: 切换\"无视减益减伤\"(当前: {{state}})",
```

- [ ] **Step 2: admin 列ヘッダーキーを 4 言語に追加**

各ファイルの `"tpl_editor_damage_type"` 行の直後に追加。

`src/locales/ja.json`（既存: `"tpl_editor_damage_type": "種別",`）:
```json
        "tpl_editor_damage_type": "種別",
        "tpl_editor_debuff_immune": "デバフ軽減不可",
```

`src/locales/en.json`（既存: `"tpl_editor_damage_type": "Type",`）:
```json
        "tpl_editor_damage_type": "Type",
        "tpl_editor_debuff_immune": "Ignores debuff mit.",
```

`src/locales/ko.json`（既存: `"tpl_editor_damage_type": "유형",`）:
```json
        "tpl_editor_damage_type": "유형",
        "tpl_editor_debuff_immune": "디버프 경감 불가",
```

`src/locales/zh.json`（既存: `"tpl_editor_damage_type": "类型",`）:
```json
        "tpl_editor_damage_type": "类型",
        "tpl_editor_debuff_immune": "无视减益减伤",
```

- [ ] **Step 3: JSON 妥当性を確認**

Run: `npx tsc --noEmit -p tsconfig.json`（JSON import の型崩れがないこと。代わりに `node -e "require('./src/locales/ja.json')"` 等で各ファイルがパースできることを確認してもよい）
Expected: エラーなし（カンマ漏れ・括弧ずれがない）

- [ ] **Step 4: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(i18n): デバフ軽減不可トグルの操作説明と管理画面列ヘッダーを4言語追加"
```

---

## Task 2: DamageTypeIcon に withTooltip prop を追加

**Files:**
- Modify: `src/components/DamageTypeIcon.tsx`
- Test: `src/components/__tests__/DamageTypeIcon.test.tsx`

目的: PC の `PcTypeToggle` 内で内部ツールチップ（`timeline.debuff_immune_hint`）を抑止し、ボタン側の 2 行ツールチップ 1 つに統一する。モバイル/カンペは既定 `true` で従来どおり。

- [ ] **Step 1: 失敗するテストを追加**

`src/components/__tests__/DamageTypeIcon.test.tsx` の `describe` 内末尾に追加：

```tsx
  it('フラグON + withTooltip=false のとき Tooltip ラッパ(.relative)を出さない', () => {
    const { container } = render(
      <DamageTypeIcon damageType="physical" ignoresDebuffMitigation withTooltip={false} />
    );
    // 赤リングの印は出る
    expect(container.querySelector('.ring-red-500\\/40')).toBeTruthy();
    // Tooltip コンポーネントのラッパ div(.relative)は無い
    expect(container.querySelector('.relative')).toBeNull();
  });

  it('フラグON + 既定(withTooltip省略)では Tooltip ラッパ(.relative)を出す', () => {
    const { container } = render(
      <DamageTypeIcon damageType="physical" ignoresDebuffMitigation />
    );
    expect(container.querySelector('.relative')).toBeTruthy();
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/DamageTypeIcon.test.tsx`
Expected: 新規 2 件のうち「withTooltip=false」が FAIL（現状は常に Tooltip を出すため `.relative` が存在する）

- [ ] **Step 3: withTooltip prop を実装**

`src/components/DamageTypeIcon.tsx` を以下に変更（props 型に `withTooltip?` を追加し、分岐を追加）：

```tsx
export const DamageTypeIcon: React.FC<{
  damageType: TimelineEvent['damageType'] | undefined; // event 任意の呼び出し元(モバイル)も許容。undefined は null 描画
  ignoresDebuffMitigation?: boolean;
  size?: string;       // 例 "w-3 h-3"(PC) / "w-4 h-4"(モバイル)
  className?: string;
  withTooltip?: boolean; // false のとき内部ツールチップを出さない(呼び出し側が独自ツールチップを持つ場合)
}> = ({ damageType, ignoresDebuffMitigation, size = 'w-3 h-3', className, withTooltip = true }) => {
  const { t } = useTranslation();
  const def = damageType ? ICON_BY_TYPE[damageType] : undefined;
  if (!def) return null;

  const img = <img src={def.src} className={clsx(size, 'object-contain opacity-90')} alt={t(def.altKey)} />;

  if (!ignoresDebuffMitigation) {
    return <span className={clsx('flex-shrink-0 inline-flex', className)}>{img}</span>;
  }

  // 赤枠は「レイアウト横幅を増やさない」= 攻撃名を右に押さない。
  // ・className(md:hidden 等)は最外殻に当てる(inner span に付けると PC で空ラッパが gap を生む)。
  // ・ring は box-shadow なのでレイアウト幅0 / p-px は -mx-px で相殺。
  const box = (
    <span className="inline-flex items-center justify-center rounded-sm p-px -mx-px bg-red-500/10 ring-1 ring-red-500/40">
      {img}
    </span>
  );

  if (!withTooltip) {
    return <span className={clsx('flex-shrink-0 inline-flex', className)}>{box}</span>;
  }

  return (
    <Tooltip content={t('timeline.debuff_immune_hint')} wrapperClassName={clsx('flex-shrink-0', className)}>
      {box}
    </Tooltip>
  );
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/DamageTypeIcon.test.tsx`
Expected: PASS（既存 3 件 + 新規 2 件 = 5 件）

- [ ] **Step 5: Commit**

```bash
git add src/components/DamageTypeIcon.tsx src/components/__tests__/DamageTypeIcon.test.tsx
git commit -m "feat(timeline): DamageTypeIconにwithTooltip prop追加(内部ツールチップ抑止)"
```

---

## Task 3: PcTypeToggle 右クリックトグル + 2 行ツールチップ

**Files:**
- Modify: `src/components/TimelineRow.tsx`（`PcTypeToggle`。現状 [TimelineRow.tsx:127](../../../src/components/TimelineRow.tsx#L127)）
- Test: `src/components/__tests__/PcTypeToggle.test.tsx`（新規）

- [ ] **Step 1: 失敗するテストを新規作成**

`src/components/__tests__/PcTypeToggle.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

const updateEvent = vi.fn();
vi.mock('../../store/useMitigationStore', () => ({
  useMitigationStore: (sel: any) => sel({ updateEvent }),
}));

import { PcTypeToggle } from '../TimelineRow';
import type { TimelineEvent } from '../../types';

const baseEvent = {
  id: 'e1',
  name: { ja: 'x', en: 'x' },
  time: 0,
  damageType: 'physical',
  ignoresDebuffMitigation: false,
} as TimelineEvent;

describe('PcTypeToggle', () => {
  beforeEach(() => updateEvent.mockClear());

  it('右クリックで ignoresDebuffMitigation を false→true にトグルする', () => {
    const { container } = render(<PcTypeToggle event={baseEvent} />);
    fireEvent.contextMenu(container.querySelector('button')!);
    expect(updateEvent).toHaveBeenCalledWith('e1', { ignoresDebuffMitigation: true });
  });

  it('右クリックで ON→OFF にトグルする', () => {
    const { container } = render(
      <PcTypeToggle event={{ ...baseEvent, ignoresDebuffMitigation: true }} />
    );
    fireEvent.contextMenu(container.querySelector('button')!);
    expect(updateEvent).toHaveBeenCalledWith('e1', { ignoresDebuffMitigation: false });
  });

  it('左クリックは従来どおり種別を循環する(physical→magical)', () => {
    const { container } = render(<PcTypeToggle event={baseEvent} />);
    fireEvent.click(container.querySelector('button')!);
    expect(updateEvent).toHaveBeenCalledWith('e1', { damageType: 'magical' });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/PcTypeToggle.test.tsx`
Expected: FAIL（`PcTypeToggle` が未 export のためインポートで失敗、または contextMenu ハンドラ未実装で右クリックテストが落ちる）

- [ ] **Step 3: PcTypeToggle を export + 右クリック + 2 行ツールチップに変更**

`src/components/TimelineRow.tsx` の `PcTypeToggle`（127 行目付近）を以下に置換：

```tsx
// PC用: 種別アイコン — 左クリックで physical→magical→unavoidable を循環 / 右クリックでデバフ軽減不可をトグル。
// いずれも updateEvent 経由なので collab 同期・Undo・ダメージ再計算・赤枠反映はモーダル変更と完全に同一経路。
// 純粋な閲覧者は store 側ガードで no-op。md: のみ表示(モバイルは別途 DamageTypeIcon を表示)。
export const PcTypeToggle: React.FC<{ event: TimelineEvent }> = ({ event }) => {
    const { t } = useTranslation();
    const updateEvent = useMitigationStore(state => state.updateEvent);
    // enrage(時間切れ)はアイコンを持たない種別なので、空のクリック領域を作らないよう非表示。
    if (!event.damageType || event.damageType === 'enrage') return null;
    const stateLabel = event.ignoresDebuffMitigation ? 'ON' : 'OFF';
    return (
        <Tooltip
            content={
                <div className="leading-snug">
                    <div>{t('timeline.type_action_left')}</div>
                    <div>{t('timeline.type_action_right', { state: stateLabel })}</div>
                </div>
            }
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止して即トグル
                    updateEvent(event.id, { damageType: nextDamageType(event.damageType) });
                }}
                onContextMenu={(e) => {
                    e.preventDefault();  // ブラウザ標準の右クリックメニューを抑止
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止
                    updateEvent(event.id, { ignoresDebuffMitigation: !event.ignoresDebuffMitigation });
                }}
                className="hidden md:inline-flex items-center cursor-pointer rounded-sm hover:bg-app-surface2 active:scale-95 transition-all"
            >
                <DamageTypeIcon damageType={event.damageType} ignoresDebuffMitigation={event.ignoresDebuffMitigation} size="w-3 h-3" withTooltip={false} />
            </button>
        </Tooltip>
    );
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/PcTypeToggle.test.tsx`
Expected: PASS（3 件）

- [ ] **Step 5: Commit**

```bash
git add src/components/TimelineRow.tsx src/components/__tests__/PcTypeToggle.test.tsx
git commit -m "feat(timeline): 種別アイコン右クリックでデバフ軽減不可をトグル+2行ツールチップ"
```

---

## Task 4: useTemplateEditor の updateCell に ignoresDebuffMitigation case を追加

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts`（`updateCell` switch。[useTemplateEditor.ts:154-161](../../../src/hooks/useTemplateEditor.ts#L154)）
- Test: `src/hooks/__tests__/useTemplateEditor.test.ts`

`switch(field)` は `default: return prev`（未知フィールド無視）なので、case を足さないと管理画面のチェックが保存されない。

- [ ] **Step 1: 失敗するテストを追加**

`src/hooks/__tests__/useTemplateEditor.test.ts` の既存 `updateCell` テスト（`it('updateCell でセル値を更新し modified を記録する', ...)`）の直後に追加：

```ts
  it('updateCell で ignoresDebuffMitigation を更新し modified を記録する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev1', 'ignoresDebuffMitigation', true));
    expect(result.current.state.current.find(e => e.id === 'ev1')?.ignoresDebuffMitigation).toBe(true);
    expect(result.current.hasChanges).toBe(true);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: FAIL（`default: return prev` で無視され、`ignoresDebuffMitigation` が `true` にならない）

- [ ] **Step 3: switch に case を追加**

`src/hooks/useTemplateEditor.ts` の `case 'target':` ブロックの直後（`default:` の直前）に追加：

```ts
          case 'target':
            ev.target = value as TimelineEvent['target'];
            break;
          case 'ignoresDebuffMitigation':
            ev.ignoresDebuffMitigation = value as boolean;
            break;
          default:
            return prev;
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: PASS（既存 + 新規 1 件）

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTemplateEditor.ts src/hooks/__tests__/useTemplateEditor.test.ts
git commit -m "feat(admin): テンプレ編集のupdateCellにignoresDebuffMitigation caseを追加"
```

---

## Task 5: 管理画面テンプレ編集にチェック列を追加

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx`（colgroup 451 行付近 / thead 474 行付近 / tbody 種別セル 615-623 行付近）

注: この EventTable コンポーネントは多数の props を要し、単体レンダリングテストが重いので、列の追加はパターン踏襲（種別ドロップダウンと同型）+ Task 4 の hook テスト + build + 実機確認で担保する（新規 UI テストは追加しない）。

- [ ] **Step 1: colgroup に列を追加**

`src/components/admin/TemplateEditor.tsx` の colgroup（`{/* 種別 */}` の col 直後）に 1 本追加：

```tsx
          <col style={{ width: '70px' }} />  {/* 種別 */}
          <col style={{ width: '64px' }} />  {/* デバフ軽減不可 */}
          <col style={{ width: '60px' }} />  {/* 対象 */}
```

- [ ] **Step 2: thead に列ヘッダーを追加**

種別ヘッダー（`{t('admin.tpl_editor_damage_type')}`）の `<th>` 直後に追加：

```tsx
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_damage_type')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_debuff_immune')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_target')}</th>
```

- [ ] **Step 3: tbody に チェックボックスセルを追加**

種別セル（`{/* 種別 */}` の `</td>`）の直後、対象セル（`{/* 対象 */}`）の直前に追加：

```tsx
                {/* デバフ軽減不可 */}
                <td className="py-1 pr-2 text-center">
                  <input
                    type="checkbox"
                    data-testid="tpl-ignores-debuff-mit"
                    checked={!!event.ignoresDebuffMitigation}
                    onChange={(e) => onUpdateCell(evId, 'ignoresDebuffMitigation', e.target.checked)}
                    className="w-4 h-4 accent-red-500 cursor-pointer"
                  />
                </td>
```

- [ ] **Step 4: ビルドで型・JSX 整合を確認**

Run: `npm run build`
Expected: EXIT 0（tsc 厳密。列数の不整合や未使用なし）

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/TemplateEditor.tsx
git commit -m "feat(admin): テンプレ編集テーブルにデバフ軽減不可チェック列を追加"
```

---

## Task 6: 全体検証 + TODO 記録

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 2: フルテスト**

Run: `npx vitest run`
Expected: 既知の失敗（`src/__tests__/housing/TopBar.test.tsx` 4 件 + `HousingWorkspace.test.tsx` 1 件）以外すべて緑。本タスクで追加したテストがすべて PASS

- [ ] **Step 3: TODO.md に完了記録を追記**

`docs/TODO.md` の「現在の状態」セクション先頭付近（`🔍 残・要本番サニティ` 行の下あたり）に追記：

```markdown
- **✅ デバフ軽減不可ワンタッチ設定 実装完了 (2026-06-15・branch `feat/collab-public-release`・push/deploy 保留)**: ①タイムライン種別アイコンPC右クリックで`ignoresDebuffMitigation`即トグル(左クリック循環と同一`updateEvent`経路=collab/Undo/再計算/赤枠自動)②2行ツールチップ(左右クリック操作+現在ON/OFF)+`DamageTypeIcon`に`withTooltip`追加でPC二重ツールチップ統一③管理画面テンプレ編集に「デバフ軽減不可」チェック列(`updateCell`にcase追加=switch default無視の罠回避・`getSaveData`で公式テンプレ保存)。i18n4言語。TDD(DamageTypeIcon/PcTypeToggle/useTemplateEditor)。build EXIT=0/テスト緑(既知5失敗のみ)。設計=specs/2026-06-15-debuff-immune-quick-toggle-design.md。**残=本番デプロイ後の実機確認(右クリックトグル/管理画面チェック→保存)。**
```

- [ ] **Step 4: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): デバフ軽減不可ワンタッチ設定 実装完了を記録"
```

---

## 完了後（ユーザー対応）

- 本番デプロイ（push）はユーザーの頃合い判断。デプロイ後に実機確認：
  1. タイムラインで種別アイコン右クリック → 赤枠が即 ON/OFF、ツールチップに現在状態
  2. 右クリック ON のイベントでデバフ系軽減（リプライザル等）の % が効かない
  3. 管理画面テンプレ編集でチェック → 保存 → 反映先で赤枠が出る
- スキル正本は Firestore。テンプレ（コンテンツ）変更は管理画面で保存（[[feedback_content_firestore_sync]]）。
