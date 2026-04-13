# フェーズ/ラベル開始時間の編集機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フェーズとラベルの開始時間を、終了時間と同じUIで編集可能にする

**Architecture:** BoundaryEditModalに開始時間フィールドを追加し、タイムライン選択モードに`field`属性を追加して開始/終了の区別を行う。ストアに`updatePhaseStartTime`/`updateLabelStartTime`関数を追加する。

**Tech Stack:** React, Zustand, TypeScript

---

## 前提: 現在の動作と変更方針

### 現在の動作
- フェーズ/ラベルの**終了時間のみ**編集可能
- `updatePhaseEndTime`は次のフェーズの開始時刻を超えないようクリップする
- タイムライン選択モードは終了時間の選択のみ対応

### 変更方針
- **開始時間も編集可能にする**（終了時間と同じUI）
- 終了時間のクリップは**現状維持**（次フェーズを超えない）
- 開始時間の選択時は**終了時間をアンカーにして上に伸びるプレビュー**
- ラベルも同一の仕組み

### バリデーションルール
- `startTime >= 0`（負の値は不可）
- `startTime < endTime`（endTimeが設定済みの場合、開始は終了より前）
- `endTime > startTime`（既存ルール維持）
- 隣接フェーズとの重複チェックは**しない**（ユーザーの自由度を優先）

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/store/useMitigationStore.ts` | `updatePhaseStartTime` + `updateLabelStartTime` 追加 |
| `src/components/BoundaryEditModal.tsx` | 開始時間フィールド + 2つ目のタイムライン選択ボタン |
| `src/components/Timeline.tsx` | 選択モードに`field`追加、保存ハンドラー拡張、props接続 |
| `src/components/TimelineRow.tsx` | ハイライト判定を双方向対応 |
| `src/components/MobileTimelineRow.tsx` | 同上 |

### 変更しないファイル
| ファイル | 理由 |
|---------|------|
| `src/types/index.ts` | Phase/Labelは既に`startTime: number`を持つ |
| `src/hooks/useTemplateEditor.ts` | 管理画面専用、表画面と無関係 |
| `src/components/admin/*` | 管理画面、タイムライン選択機能なし |

---

## Task 1: ストアにstartTime更新関数を追加

**Files:**
- Modify: `src/store/useMitigationStore.ts:77-84`（型定義）
- Modify: `src/store/useMitigationStore.ts:474-525`（関数追加位置）

### 型定義の現在のコード（L77-84）:
```typescript
addPhase: (startTime: number, name: LocalizedString) => void;
updatePhase: (id: string, name: LocalizedString) => void;
removePhase: (id: string) => void;
updatePhaseEndTime: (id: string, newEndTime: number) => void;
addLabel: (startTime: number, name: LocalizedString) => void;
updateLabel: (id: string, name: LocalizedString) => void;
removeLabel: (id: string) => void;
updateLabelEndTime: (id: string, newEndTime: number) => void;
```

- [ ] **Step 1: 型定義に2関数を追加**

`src/store/useMitigationStore.ts`のインターフェース（L77-84付近）に追加:

```typescript
updatePhaseStartTime: (id: string, newStartTime: number) => void;
```
を`updatePhaseEndTime`の直後に追加。

```typescript
updateLabelStartTime: (id: string, newStartTime: number) => void;
```
を`updateLabelEndTime`の直後に追加。

- [ ] **Step 2: updatePhaseStartTime実装を追加**

`updatePhaseEndTime`の閉じ括弧（L487 `},`）の直後に追加:

```typescript
updatePhaseStartTime: (id, newStartTime) => {
    pushHistory();
    set((state) => {
        const phase = state.phases.find(p => p.id === id);
        if (!phase) return {};
        let final = Math.max(newStartTime, 0);
        if (phase.endTime !== undefined) {
            final = Math.min(final, phase.endTime - 1);
        }
        return {
            phases: state.phases.map(p => p.id === id ? { ...p, startTime: final } : p)
        };
    });
},
```

- [ ] **Step 3: updateLabelStartTime実装を追加**

`updateLabelEndTime`の閉じ括弧（L525 `},`）の直後に追加:

```typescript
updateLabelStartTime: (id, newStartTime) => {
    pushHistory();
    set((state) => {
        const label = state.labels.find(l => l.id === id);
        if (!label) return {};
        let final = Math.max(newStartTime, 0);
        if (label.endTime !== undefined) {
            final = Math.min(final, label.endTime - 1);
        }
        return {
            labels: state.labels.map(l => l.id === id ? { ...l, startTime: final } : l)
        };
    });
},
```

- [ ] **Step 4: tscで型チェック**

```bash
npx tsc --noEmit
```
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/store/useMitigationStore.ts
git commit -m "feat(store): updatePhaseStartTime/updateLabelStartTime追加"
```

---

## Task 2: BoundaryEditModalに開始時間フィールドを追加

**Files:**
- Modify: `src/components/BoundaryEditModal.tsx`

### 現在のProps（L10-20）:
```typescript
interface BoundaryEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: LocalizedString, endTime?: number) => void;
    onDelete?: () => void;
    onStartTimelineSelect?: () => void;
    initial?: { name: LocalizedString; endTime?: number };
    isEdit?: boolean;
    mode: 'phase' | 'label';
    position?: { x: number; y: number };
}
```

- [ ] **Step 1: Props型を変更**

```typescript
interface BoundaryEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: LocalizedString, startTime?: number, endTime?: number) => void;
    onDelete?: () => void;
    onTimelineSelectStart?: () => void;
    onTimelineSelectEnd?: () => void;
    initial?: { name: LocalizedString; startTime?: number; endTime?: number };
    isEdit?: boolean;
    mode: 'phase' | 'label';
    position?: { x: number; y: number };
}
```

変更点:
- `onSave`: 第2引数に`startTime`追加、`endTime`が第3引数に移動
- `onStartTimelineSelect` → 2つに分割: `onTimelineSelectStart` + `onTimelineSelectEnd`
- `initial`: `startTime`追加

- [ ] **Step 2: コンポーネントのprops分割代入を更新**

L37-39を変更:

```typescript
export const BoundaryEditModal: React.FC<BoundaryEditModalProps> = ({
    isOpen, onClose, onSave, onDelete, onTimelineSelectStart, onTimelineSelectEnd,
    initial, isEdit = false, mode, position
}) => {
```

- [ ] **Step 3: startTimeInput stateを追加**

L47の`endTimeInput`の直後に追加:

```typescript
const [startTimeInput, setStartTimeInput] = useState('');
```

- [ ] **Step 4: useEffectでstartTimeInputを初期化**

L60-71のuseEffect内、`setEndTimeInput`の直前に追加:

```typescript
setStartTimeInput(initial.startTime !== undefined ? formatTime(initial.startTime) : '');
```

elseブランチ（L67-69）にも追加:
```typescript
setStartTimeInput('');
```

- [ ] **Step 5: handleSubmitとhandleBackdropClickを更新**

handleSubmit（L85-90）を変更:
```typescript
const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startTime = startTimeInput ? parseTimeInput(startTimeInput) ?? undefined : undefined;
    const endTime = endTimeInput ? parseTimeInput(endTimeInput) ?? undefined : undefined;
    onSave(buildName(), startTime, endTime);
    onClose();
};
```

handleBackdropClick（L92-98）を変更:
```typescript
const handleBackdropClick = () => {
    if (nameInput.trim()) {
        const startTime = startTimeInput ? parseTimeInput(startTimeInput) ?? undefined : undefined;
        const endTime = endTimeInput ? parseTimeInput(endTimeInput) ?? undefined : undefined;
        onSave(buildName(), startTime, endTime);
    }
    onClose();
};
```

- [ ] **Step 6: 開始時間のUI要素を追加**

L144-160の終了時間セクションの**直前に**、開始時間セクションを追加:

```tsx
{isEdit && (
    <div>
        <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.start_time')}</label>
        <div className="flex gap-2">
            <input type="text" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)}
                className="flex-1 bg-app-surface2 border border-app-border rounded-lg p-2 text-[16px] md:text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                placeholder="M:SS" />
            {onTimelineSelectStart && (
                <button type="button" onClick={() => { onTimelineSelectStart(); }}
                    className="px-3 py-2 text-app-text rounded-lg border border-app-border hover:bg-app-surface2 transition-colors flex items-center gap-1.5 text-app-sm cursor-pointer">
                    <Crosshair size={14} />
                    <span>{t('boundary_modal.select_on_timeline')}</span>
                </button>
            )}
        </div>
    </div>
)}
```

既存の終了時間セクション（L144-160）で`onStartTimelineSelect`を`onTimelineSelectEnd`に変更:

```tsx
{onTimelineSelectEnd && (
    <button type="button" onClick={() => { onTimelineSelectEnd(); }}
```

- [ ] **Step 7: i18nキー追加**

`src/locales/ja.json`と`src/locales/en.json`に追加:

ja:
```json
"boundary_modal.start_time": "開始時間"
```

en:
```json
"boundary_modal.start_time": "Start Time"
```

- [ ] **Step 8: tscで型チェック**

```bash
npx tsc --noEmit
```
Expected: Timeline.tsxでProps不一致エラー（Task 3で修正）

- [ ] **Step 9: コミット**

```bash
git add src/components/BoundaryEditModal.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat(modal): BoundaryEditModalに開始時間フィールド追加"
```

---

## Task 3: Timeline.tsxの接続（選択モード + 保存ハンドラー）

**Files:**
- Modify: `src/components/Timeline.tsx`

### 変更点一覧

1. `selectedPhase`/`selectedLabel`の型に`startTime`追加
2. `timelineSelectMode`/`labelSelectMode`の型に`field`追加
3. `handlePhaseSave`/`handleLabelSave`に`startTime`パラメータ追加
4. タイムライン選択時の保存処理を`field`で分岐
5. BoundaryEditModalへのprops接続更新
6. ストアからの新関数インポート

- [ ] **Step 1: selectedPhaseの型にstartTimeを追加**

L598を変更:
```typescript
const [selectedPhase, setSelectedPhase] = useState<{ id: string; name: LocalizedString; startTime: number; endTime?: number } | null>(null);
```

L606を変更:
```typescript
const [selectedLabel, setSelectedLabel] = useState<{ id: string; name: LocalizedString; startTime: number; endTime?: number } | null>(null);
```

- [ ] **Step 2: timelineSelectMode/labelSelectModeの型にfieldを追加**

L601を変更:
```typescript
const [timelineSelectMode, setTimelineSelectMode] = useState<{ phaseId: string; startTime: number; field: 'startTime' | 'endTime' } | null>(null);
```

L610を変更:
```typescript
const [labelSelectMode, setLabelSelectMode] = useState<{ labelId: string; startTime: number; field: 'startTime' | 'endTime' } | null>(null);
```

- [ ] **Step 3: ストアから新関数をインポート**

ファイル冒頭のuseMitigationStoreからの分割代入に追加:

```typescript
updatePhaseStartTime,
updateLabelStartTime,
```

※ 正確な位置はファイル内のstore destructuringを検索して確認

- [ ] **Step 4: handlePhaseEditにstartTimeを追加**

L1012を変更:
```typescript
setSelectedPhase({ id: phase.id, name: phase.name, startTime: phase.startTime, endTime: effectiveEndTime });
```

L1058を変更（handleLabelEdit）:
```typescript
setSelectedLabel({ id: label.id, name: label.name, startTime: label.startTime, endTime: effectiveEndTime });
```

- [ ] **Step 5: handlePhaseSaveを更新**

L1016-1027を変更:
```typescript
const handlePhaseSave = (name: LocalizedString, startTime?: number, endTime?: number) => {
    if (selectedPhase) {
        updatePhase(selectedPhase.id, name);
        if (startTime !== undefined) {
            updatePhaseStartTime(selectedPhase.id, startTime);
        }
        if (endTime !== undefined) {
            updatePhaseEndTime(selectedPhase.id, endTime);
        }
    } else {
        if (selectedPhaseTime !== undefined) {
            addPhase(selectedPhaseTime, name);
        }
    }
};
```

L1062-1073を変更（handleLabelSave）:
```typescript
const handleLabelSave = (name: LocalizedString, startTime?: number, endTime?: number) => {
    if (selectedLabel) {
        updateLabel(selectedLabel.id, name);
        if (startTime !== undefined) {
            updateLabelStartTime(selectedLabel.id, startTime);
        }
        if (endTime !== undefined) {
            updateLabelEndTime(selectedLabel.id, endTime);
        }
    } else {
        if (selectedLabelTime !== undefined) {
            addLabel(selectedLabelTime, name);
        }
    }
};
```

- [ ] **Step 6: タイムライン選択時の保存処理をfield分岐に変更**

モバイル選択ハンドラー（L2143-2157付近）を変更:

```typescript
const mobileSelectHandler = (time: number) => {
    if (labelSelectMode) {
        if (labelSelectMode.field === 'startTime') {
            updateLabelStartTime(labelSelectMode.labelId, time);
        } else {
            updateLabelEndTime(labelSelectMode.labelId, time);
        }
        setLabelSelectMode(null);
        setPreviewEndTime(null);
        return;
    }
    if (timelineSelectMode) {
        if (timelineSelectMode.field === 'startTime') {
            updatePhaseStartTime(timelineSelectMode.phaseId, time);
        } else {
            updatePhaseEndTime(timelineSelectMode.phaseId, time);
        }
        setTimelineSelectMode(null);
        setPreviewEndTime(null);
    }
};
```

デスクトップの同等ハンドラー（L2252-2264付近のonTimelineSelect）も同じ分岐に変更。

- [ ] **Step 7: BoundaryEditModal（フェーズ）のpropsを更新**

L2674-2687付近を変更:

```tsx
<BoundaryEditModal
    isOpen={isPhaseModalOpen}
    isEdit={!!selectedPhase}
    initial={selectedPhase ? { name: selectedPhase.name, startTime: selectedPhase.startTime, endTime: selectedPhase.endTime } : undefined}
    onClose={() => setIsPhaseModalOpen(false)}
    onSave={handlePhaseSave}
    onDelete={selectedPhase ? handlePhaseDelete : undefined}
    onTimelineSelectStart={selectedPhase ? () => {
        const anchorTime = selectedPhase.endTime ?? selectedPhase.startTime;
        setTimelineSelectMode({ phaseId: selectedPhase.id, startTime: anchorTime, field: 'startTime' });
        setIsPhaseModalOpen(false);
    } : undefined}
    onTimelineSelectEnd={selectedPhase ? () => {
        const phase = phases.find(p => p.id === selectedPhase.id);
        setTimelineSelectMode({ phaseId: selectedPhase.id, startTime: phase?.startTime ?? 0, field: 'endTime' });
        setIsPhaseModalOpen(false);
    } : undefined}
    mode="phase"
    position={phaseModalPosition}
/>
```

- [ ] **Step 8: BoundaryEditModal（ラベル）のpropsを更新**

L2688-2701付近を変更:

```tsx
<BoundaryEditModal
    isOpen={isLabelModalOpen}
    isEdit={!!selectedLabel}
    initial={selectedLabel ? { name: selectedLabel.name, startTime: selectedLabel.startTime, endTime: selectedLabel.endTime } : undefined}
    onClose={() => setIsLabelModalOpen(false)}
    onSave={handleLabelSave}
    onDelete={selectedLabel ? handleLabelDelete : undefined}
    onTimelineSelectStart={selectedLabel ? () => {
        const anchorTime = selectedLabel.endTime ?? selectedLabel.startTime;
        setLabelSelectMode({ labelId: selectedLabel.id, startTime: anchorTime, field: 'startTime' });
        setIsLabelModalOpen(false);
    } : undefined}
    onTimelineSelectEnd={selectedLabel ? () => {
        const label = labels.find(l => l.id === selectedLabel.id);
        setLabelSelectMode({ labelId: selectedLabel.id, startTime: label?.startTime ?? 0, field: 'endTime' });
        setIsLabelModalOpen(false);
    } : undefined}
    mode="label"
    position={labelModalPosition}
/>
```

- [ ] **Step 9: tscで型チェック**

```bash
npx tsc --noEmit
```
Expected: TimelineRow/MobileTimelineRowでfield不足の警告（Task 4で修正）、または既にオプショナルなら成功

- [ ] **Step 10: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat(timeline): 開始時間編集の接続（選択モード+保存ハンドラー）"
```

---

## Task 4: 行ハイライトの双方向対応

**Files:**
- Modify: `src/components/TimelineRow.tsx:165-173`
- Modify: `src/components/MobileTimelineRow.tsx:156-164`

### 現在のコード（双方向非対応）:
```typescript
const isHighlighted = timelineSelectMode
    && previewEndTime !== null
    && time >= timelineSelectMode.startTime
    && time <= (previewEndTime ?? 0);
```
問題: `startTime > previewEndTime`の場合（開始時間選択で上に動かす時）、ハイライトされない

- [ ] **Step 1: TimelineRow.tsxのハイライトを修正**

L165-173を変更:

```typescript
const isHighlighted = (() => {
    if (!timelineSelectMode || previewEndTime === null) return false;
    const a = timelineSelectMode.startTime;
    const b = previewEndTime;
    return time >= Math.min(a, b) && time <= Math.max(a, b);
})();

const isLabelHighlighted = (() => {
    if (!labelSelectMode || previewEndTime === null) return false;
    const a = labelSelectMode.startTime;
    const b = previewEndTime;
    return time >= Math.min(a, b) && time <= Math.max(a, b);
})();
```

- [ ] **Step 2: MobileTimelineRow.tsxのハイライトを修正**

L156-164を変更:

```typescript
const isHighlighted = (() => {
    if (!timelineSelectMode || previewEndTime === null) return false;
    const a = timelineSelectMode.startTime;
    const b = previewEndTime;
    return time >= Math.min(a, b) && time <= Math.max(a, b);
})();

const isLabelHighlighted = (() => {
    if (!labelSelectMode || previewEndTime === null) return false;
    const a = labelSelectMode.startTime;
    const b = previewEndTime;
    return time >= Math.min(a, b) && time <= Math.max(a, b);
})();
```

- [ ] **Step 3: tscで型チェック**

```bash
npx tsc --noEmit
```
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/TimelineRow.tsx src/components/MobileTimelineRow.tsx
git commit -m "fix(timeline): ハイライト判定を双方向対応（開始時間選択で上方向にも光る）"
```

---

## Task 5: ビルド・テスト・最終確認

- [ ] **Step 1: 全テスト実行**

```bash
npx vitest run
```
Expected: 全テストパス

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```
Expected: ビルド成功（chunkサイズ警告のみ）

- [ ] **Step 3: 動作確認チェックリスト**

以下をデプロイ後に手動確認:

**フェーズ編集:**
- [ ] フェーズクリック → 編集 → モーダルに「開始時間」「終了時間」両方表示される
- [ ] 開始時間を直接入力（M:SS）→ 保存 → フェーズ開始位置が変わる
- [ ] 開始時間「タイムラインで選ぶ」→ プレビューが終了時間から上に伸びる
- [ ] 終了時間「タイムラインで選ぶ」→ プレビューが開始時間から下に伸びる
- [ ] ESCでキャンセルできる
- [ ] 新規フェーズ追加時は開始/終了時間欄が非表示

**ラベル編集:**
- [ ] 上記と同じ確認をラベルで実施

**エッジケース:**
- [ ] 開始時間を終了時間より後に設定 → 終了時間-1にクリップされる
- [ ] 開始時間を負の値に設定 → 0にクリップされる
- [ ] フェーズが1つだけの場合 → 正常動作

- [ ] **Step 4: コミット（TODO更新）**

```bash
git add docs/TODO.md
git commit -m "docs: フェーズ/ラベル開始時間編集機能の完了をTODOに反映"
```

---

## 依存関係マップ

```
Task 1 (ストア) ─── 独立、他に依存なし
    ↓
Task 2 (モーダル) ─── Task 1完了後でなくても実装可能（型だけ合わせればOK）
    ↓
Task 3 (Timeline接続) ─── Task 1 + Task 2 完了後
    ↓
Task 4 (ハイライト) ─── Task 3 完了後（型が決まってから）
    ↓
Task 5 (確認) ─── 全Task完了後
```

Task 1とTask 2は並行実装可能。Task 3以降は順序依存。

---

## リスク評価

| リスク | 影響 | 対策 |
|--------|------|------|
| onSaveの引数順変更 | Timeline.tsxの呼び出し側が壊れる | Task 3で確実に更新 |
| timelineSelectModeのfield追加 | 既存の終了時間選択が壊れる | 全箇所にfield: 'endTime'を明示 |
| ハイライトのMath.min/max | パフォーマンス影響 | 軽量計算、影響なし |
| 管理画面への影響 | なし | 管理画面はBoundaryEditModalを使わない |
| プレビューオーバーレイ | 既にMath.min/maxで双方向対応済み | 変更不要 |
