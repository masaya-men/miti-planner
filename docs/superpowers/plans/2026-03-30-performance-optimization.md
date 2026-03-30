# パフォーマンス最適化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React.memo + useCallback + useShallow + Layout分割で不要な再レンダリングを削減し、アプリ全体の応答速度を向上させる。既存の機能・UI・UXは一切変更しない。

**Architecture:** 主要サブコンポーネント（TimelineRow, MitigationItem, ContentTreeItem, SaveIndicator）をReact.memoでラップ。Zustandセレクタを`useShallow`で参照安定化。Layout.tsx内のMobileHeader/MobilePartySettingsを別ファイルに切り出し。

**Tech Stack:** React 19, TypeScript, Zustand 5 (useShallow), Vite 7

---

## ファイル構成

| 種別 | ファイル | 役割 |
|------|---------|------|
| 修正 | `src/components/Timeline.tsx` | MitigationItemをmemo化 + useCallback追加 + useShallow |
| 修正 | `src/components/TimelineRow.tsx` | 既存memo確認・props安定化 |
| 修正 | `src/components/Sidebar.tsx` | ContentTreeItemをmemo化 + useShallow |
| 修正 | `src/components/ConsolidatedHeader.tsx` | SaveIndicatorをmemo化 + useShallow |
| 修正 | `src/components/CheatSheetView.tsx` | useShallow追加 |
| 新規 | `src/components/MobileHeader.tsx` | Layout.tsxから切り出し |
| 新規 | `src/components/MobilePartySettings.tsx` | Layout.tsxから切り出し |
| 修正 | `src/components/Layout.tsx` | 切り出し後のimport変更 + useShallow |

---

### Task 1: MitigationItem を React.memo でラップ

**Files:**
- Modify: `src/components/Timeline.tsx:127-522`

MitigationItemは~400行のサブコンポーネントで、軽減アイコン1個を描画する。現在は親のTimelineが再レンダリングするたびに全MitigationItemが再描画される。

- [ ] **Step 1: MitigationItemをmemo化**

`src/components/Timeline.tsx` の127行目を変更:

```typescript
// 変更前
const MitigationItem: React.FC<MitigationItemProps> = (props) => {

// 変更後
const MitigationItem: React.FC<MitigationItemProps> = React.memo((props) => {
```

522行目（MitigationItemの閉じ中括弧）を変更:

```typescript
// 変更前
};

// 変更後
});
MitigationItem.displayName = 'MitigationItem';
```

- [ ] **Step 2: MitigationItem内のZustandセレクタをuseShallowで安定化**

`src/components/Timeline.tsx` の先頭importに追加:

```typescript
import { useShallow } from 'zustand/react/shallow';
```

MitigationItem内（148-150行目付近）のストア購読を1つにまとめる:

```typescript
// 変更前
const myJobHighlight = useMitigationStore(state => state.myJobHighlight);
const myMemberId = useMitigationStore(state => state.myMemberId);
const hideEmptyRows = useMitigationStore(state => state.hideEmptyRows);

// 変更後
const { myJobHighlight, myMemberId, hideEmptyRows } = useMitigationStore(
    useShallow(s => ({ myJobHighlight: s.myJobHighlight, myMemberId: s.myMemberId, hideEmptyRows: s.hideEmptyRows }))
);
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "perf: MitigationItemをReact.memoでラップ + useShallow追加"
```

---

### Task 2: Timeline本体のZustandセレクタ最適化

**Files:**
- Modify: `src/components/Timeline.tsx:524-560`

Timeline本体は22+のセレクタでuseMitigationStoreを購読している。データ用セレクタをuseShallowでまとめて1回の購読にする。アクション（関数）はZustandで参照安定なので個別取得のままでOK。

- [ ] **Step 1: データセレクタをuseShallowでまとめる**

`src/components/Timeline.tsx` の534-544行目を変更:

```typescript
// 変更前
const aaSettings = useMitigationStore(s => s.aaSettings);
const schAetherflowPatterns = useMitigationStore(s => s.schAetherflowPatterns);
const partyMembers = useMitigationStore(s => s.partyMembers);
const timelineMitigations = useMitigationStore(s => s.timelineMitigations);
const timelineEvents = useMitigationStore(s => s.timelineEvents);
const phases = useMitigationStore(s => s.phases);
const clipboardEvent = useMitigationStore(s => s.clipboardEvent);
const hideEmptyRows = useMitigationStore(s => s.hideEmptyRows);
const partySortOrder = useMitigationStore(s => s.timelineSortOrder);
const currentLevel = useMitigationStore(s => s.currentLevel);

// 変更後
const {
    aaSettings, schAetherflowPatterns, partyMembers,
    timelineMitigations, timelineEvents, phases,
    clipboardEvent, hideEmptyRows, currentLevel,
} = useMitigationStore(useShallow(s => ({
    aaSettings: s.aaSettings,
    schAetherflowPatterns: s.schAetherflowPatterns,
    partyMembers: s.partyMembers,
    timelineMitigations: s.timelineMitigations,
    timelineEvents: s.timelineEvents,
    phases: s.phases,
    clipboardEvent: s.clipboardEvent,
    hideEmptyRows: s.hideEmptyRows,
    currentLevel: s.currentLevel,
})));
const partySortOrder = useMitigationStore(s => s.timelineSortOrder);
```

注意: `partySortOrder`は`timelineSortOrder`のエイリアスなので個別取得のまま。`useShallow`は浅い比較（===）で各プロパティを比較するので、実際にデータが変わった時のみ再レンダリングが発火する。

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "perf: TimelineのZustandセレクタをuseShallowで最適化"
```

---

### Task 3: Timeline内の主要useCallbackを追加

**Files:**
- Modify: `src/components/Timeline.tsx`

TimelineRowやMitigationItemに渡すコールバック関数が毎レンダリングで新しい参照になっている。useCallbackでラップして参照を安定化する。

- [ ] **Step 1: TimelineRowに渡すコールバックをuseCallbackでラップ**

Timeline.tsx内のTimelineコンポーネント（524行目以降）で、TimelineRowに渡される`onAddEventClick`、`onEventClick`、`onCellClick`、`onPhaseAdd`、`onDamageClick`のハンドラ関数を特定する。

これらは既にTimeline内でconst宣言されているため、`useCallback`でラップする。具体的には:

TimelineRow呼び出し箇所（`<TimelineRow ... />`のprops）で使われているイベントハンドラの定義箇所を`useCallback`に変更する。例:

```typescript
// handlePhaseAddの定義箇所を探し、useCallbackでラップ
// 変更前
const handlePhaseAdd = (time: number, e: React.MouseEvent) => {
    // ...
};

// 変更後
const handlePhaseAdd = useCallback((time: number, e: React.MouseEvent) => {
    // ...
}, [/* 依存配列 */]);
```

Timeline.tsx内で`TimelineRow`に渡されるすべてのonXxxハンドラについて同様にuseCallbackを追加する。依存配列にはハンドラ内で参照する変数を含める。

注意: すでにuseCallbackされている`handleAutoPlan`（598行目）はそのまま。

- [ ] **Step 2: MitigationItemに渡すonRemove・onUpdateTimeをuseCallbackでラップ**

TimelineコンポーネントのMitigationItem呼び出し箇所で渡されている`onRemove`と`onUpdateTime`がインライン関数の場合、useCallbackで安定化する。

```typescript
// 例: removeMitigationとupdateMitigationTimeはZustandアクションで参照安定なので、
// そのまま渡せばOK（追加のuseCallback不要）。
// ただしラッパー関数の場合はuseCallbackが必要。
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "perf: TimelineのイベントハンドラにuseCallback追加"
```

---

### Task 4: ContentTreeItemをReact.memoでラップ + Sidebarセレクタ最適化

**Files:**
- Modify: `src/components/Sidebar.tsx:76-722, 728-799`

ContentTreeItemはSidebar内の各コンテンツ項目を描画するサブコンポーネント。プラン変更のたびに全項目が再描画されている。

- [ ] **Step 1: useShallowをimport**

`src/components/Sidebar.tsx` の先頭importに追加:

```typescript
import { useShallow } from 'zustand/react/shallow';
```

- [ ] **Step 2: ContentTreeItemをReact.memoでラップ**

`src/components/Sidebar.tsx` の76行目を変更:

```typescript
// 変更前
const ContentTreeItem: React.FC<ContentTreeItemProps> = ({
    content, isActive, multiSelect, onToggleSelect, onSelect, highlightFirst, lang
}) => {

// 変更後
const ContentTreeItem: React.FC<ContentTreeItemProps> = React.memo(({
    content, isActive, multiSelect, onToggleSelect, onSelect, highlightFirst, lang
}) => {
```

722行目（ContentTreeItemの閉じ）を変更:

```typescript
// 変更前
};

// 変更後
});
ContentTreeItem.displayName = 'ContentTreeItem';
```

- [ ] **Step 3: ContentTreeItem内のusePlanStore呼び出しをuseShallowに変更**

ContentTreeItem内の80行目:

```typescript
// 変更前
const { plans, currentPlanId, updatePlan } = usePlanStore();

// 変更後
const { plans, currentPlanId, updatePlan } = usePlanStore(
    useShallow(s => ({ plans: s.plans, currentPlanId: s.currentPlanId, updatePlan: s.updatePlan }))
);
```

- [ ] **Step 4: Sidebar本体のusePlanStore呼び出しをuseShallowに変更**

Sidebar本体の788行目:

```typescript
// 変更前
const { plans, currentPlanId, setCurrentPlanId, updatePlan } = usePlanStore();

// 変更後
const { plans, currentPlanId, setCurrentPlanId, updatePlan } = usePlanStore(
    useShallow(s => ({ plans: s.plans, currentPlanId: s.currentPlanId, setCurrentPlanId: s.setCurrentPlanId, updatePlan: s.updatePlan }))
);
```

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "perf: ContentTreeItemをReact.memo化 + useShallowでセレクタ最適化"
```

---

### Task 5: SaveIndicatorをReact.memoでラップ + ConsolidatedHeaderセレクタ最適化

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx:48-71, 73-80`

- [ ] **Step 1: useShallowをimport**

`src/components/ConsolidatedHeader.tsx` の先頭importに追加:

```typescript
import { useShallow } from 'zustand/react/shallow';
```

- [ ] **Step 2: SaveIndicatorをReact.memoでラップ**

48行目:

```typescript
// 変更前
const SaveIndicator: React.FC = () => {

// 変更後
const SaveIndicator: React.FC = React.memo(() => {
```

71行目:

```typescript
// 変更前
};

// 変更後
});
SaveIndicator.displayName = 'SaveIndicator';
```

- [ ] **Step 3: ConsolidatedHeader本体のuseMitigationStore呼び出しをuseShallowに変更**

83行目:

```typescript
// 変更前
const { myJobHighlight, setMyJobHighlight } = useMitigationStore();

// 変更後
const { myJobHighlight, setMyJobHighlight } = useMitigationStore(
    useShallow(s => ({ myJobHighlight: s.myJobHighlight, setMyJobHighlight: s.setMyJobHighlight }))
);
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/ConsolidatedHeader.tsx
git commit -m "perf: SaveIndicatorをReact.memo化 + ConsolidatedHeaderにuseShallow追加"
```

---

### Task 6: CheatSheetViewのセレクタ最適化

**Files:**
- Modify: `src/components/CheatSheetView.tsx:13-15`

- [ ] **Step 1: useShallowをimport + セレクタ変更**

```typescript
// 先頭importに追加
import { useShallow } from 'zustand/react/shallow';
```

15行目:

```typescript
// 変更前
const { timelineEvents, timelineMitigations, partyMembers, addMitigation, schAetherflowPatterns } = useMitigationStore();

// 変更後
const { timelineEvents, timelineMitigations, partyMembers, addMitigation, schAetherflowPatterns } = useMitigationStore(
    useShallow(s => ({
        timelineEvents: s.timelineEvents,
        timelineMitigations: s.timelineMitigations,
        partyMembers: s.partyMembers,
        addMitigation: s.addMitigation,
        schAetherflowPatterns: s.schAetherflowPatterns,
    }))
);
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/CheatSheetView.tsx
git commit -m "perf: CheatSheetViewにuseShallow追加"
```

---

### Task 7: MobileHeaderをLayout.tsxから別ファイルに切り出し

**Files:**
- Create: `src/components/MobileHeader.tsx`
- Modify: `src/components/Layout.tsx`

Layout.tsx内のMobileHeader（34-174行目）を別ファイルに切り出す。propsインターフェース・ロジック・JSXは一切変更しない。

- [ ] **Step 1: MobileHeader.tsxを作成**

`src/components/MobileHeader.tsx` に、Layout.tsxの34-174行目のMobileHeaderコンポーネントをコピーし、必要なimportを追加する:

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../store/usePlanStore';
import { getContentById } from '../data/contentRegistry';
import { LoPoButton } from './LoPoButton';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Sun, Moon } from 'lucide-react';
import clsx from 'clsx';

const MobileHeader: React.FC<{
    onHome: () => void;
    theme: string;
    onToggleTheme: () => void;
}> = ({ onHome, theme, onToggleTheme }) => {
    // ... Layout.tsxから39-173行目をそのままコピー
};

export { MobileHeader };
```

- [ ] **Step 2: Layout.tsxからMobileHeaderを削除し、importに変更**

Layout.tsxの先頭importに追加:
```typescript
import { MobileHeader } from './MobileHeader';
```

Layout.tsxの34-174行目（`// ── モバイルヘッダー` から MobileHeaderの閉じ中括弧まで）を削除する。

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileHeader.tsx src/components/Layout.tsx
git commit -m "refactor: MobileHeaderをLayout.tsxから別ファイルに切り出し"
```

---

### Task 8: MobilePartySettingsをLayout.tsxから別ファイルに切り出し

**Files:**
- Create: `src/components/MobilePartySettings.tsx`
- Modify: `src/components/Layout.tsx`

Layout.tsx内のMobilePartySettings（177-370行目付近）とMobilePartyWithTabs（374-422行目付近）、MobileAccountMenu（426-507行目付近）を別ファイルに切り出す。

- [ ] **Step 1: MobilePartySettings.tsxを作成**

`src/components/MobilePartySettings.tsx` に、Layout.tsxからMobilePartySettings、MobilePartyWithTabs、MobileAccountMenuの3コンポーネントをコピーし、必要なimportを追加する:

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useJobs } from '../hooks/useSkillsData';
import { PARTY_MEMBER_IDS } from '../constants/party';
import { JobPicker } from './JobPicker';  // MobilePartySettingsがJobPickerを使うか確認が必要
import { JobMigrationModal } from './JobMigrationModal';
import { ConfirmDialog } from './ConfirmDialog';
import { PartyStatusPopover } from './PartyStatusPopover';
import { migrateMitigations } from '../utils/jobMigration';
import type { MigrationMode } from '../utils/jobMigration';
import type { Job } from '../types';
import { Star, LogOut } from 'lucide-react';
import clsx from 'clsx';

// MobilePartySettings, MobilePartyWithTabs, MobileAccountMenu をここに配置
// ... Layout.tsxからそのままコピー

export { MobilePartySettings, MobilePartyWithTabs, MobileAccountMenu };
```

- [ ] **Step 2: Layout.tsxから3コンポーネントを削除し、importに変更**

Layout.tsxの先頭importに追加:
```typescript
import { MobilePartyWithTabs, MobileAccountMenu } from './MobilePartySettings';
```

Layout.tsxの177-507行目（MobilePartySettings、MobilePartyWithTabs、MobileAccountMenu）を削除する。

注意: MobilePartySettingsはMobilePartyWithTabs内から呼ばれているのでLayout.tsxからは直接importする必要がない可能性がある。実際のコードを確認してexport対象を決定すること。

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/MobilePartySettings.tsx src/components/Layout.tsx
git commit -m "refactor: MobilePartySettings関連をLayout.tsxから別ファイルに切り出し"
```

---

### Task 9: Layout.tsxのZustandセレクタ最適化

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: useShallowをimport**

```typescript
import { useShallow } from 'zustand/react/shallow';
```

- [ ] **Step 2: useMitigationStore呼び出しをuseShallowに変更**

Layout.tsx内の`useMitigationStore()`呼び出し箇所:

```typescript
// 537行目付近
// 変更前
const { myJobHighlight, setMyJobHighlight } = useMitigationStore();

// 変更後
const { myJobHighlight, setMyJobHighlight } = useMitigationStore(
    useShallow(s => ({ myJobHighlight: s.myJobHighlight, setMyJobHighlight: s.setMyJobHighlight }))
);

// 556行目付近
// 変更前
const { timelineSortOrder, setTimelineSortOrder } = useMitigationStore();

// 変更後
const { timelineSortOrder, setTimelineSortOrder } = useMitigationStore(
    useShallow(s => ({ timelineSortOrder: s.timelineSortOrder, setTimelineSortOrder: s.setTimelineSortOrder }))
);
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/Layout.tsx
git commit -m "perf: Layout.tsxのZustandセレクタをuseShallow化"
```

---

### Task 10: ビルド + 動作確認 + TODO更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: 本番ビルド確認**

Run: `npm run build`
Expected: エラーなし。warningのみ許容。

- [ ] **Step 2: 開発サーバーで動作確認**

Run: `npm run dev`

確認項目:
1. タイムライン: イベント追加・編集・削除が正常動作
2. タイムライン: 軽減の配置・移動・削除が正常動作
3. タイムライン: オートプランが正常動作
4. サイドバー: コンテンツ選択・プラン切替が正常動作
5. サイドバー: プラン名編集・削除が正常動作
6. サイドバー: 複数選択モードが正常動作
7. ヘッダー: テーマ切替・言語切替が正常動作
8. ヘッダー: 保存インジケーターが正常表示
9. ヘッダー: 開閉アニメーションが正常動作
10. チートシートビュー: 正常表示・軽減操作可能
11. モバイル表示: ボトムシート・ナビが正常動作

- [ ] **Step 3: TODO.md更新**

以下を完了マークにする:
- `- [x] **アプリ動作パフォーマンスの最適化**`
- `- [x] **サイドメニュー・ヘッダーの開閉パフォーマンス最適化**`

- [ ] **Step 4: コミット**

```bash
git add docs/TODO.md
git commit -m "docs: パフォーマンス最適化完了をTODOに反映"
```
