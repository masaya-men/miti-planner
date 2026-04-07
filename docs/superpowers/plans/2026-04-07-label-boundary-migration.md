# Label境界データ移行 実装計画（段階2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ラベル（ギミックグループ）をイベント埋め込み（mechanicGroup）から独立した Label[] 境界データに変更する。段階1（フェーズstartTime化）で確立したパターンを踏襲。

**Architecture:** Label型を `{ id, name: LocalizedString, startTime, endTime? }` として新規追加。既存データは読み込み時に自動変換。BoundaryEditModalをラベル編集にも共用。ラベル列クリックでフェーズと同じコンテキストメニュー（編集/追加/削除）を表示。

**Tech Stack:** React, Zustand, TypeScript, Vite, Vitest, framer-motion, i18next

**設計書:** `docs/superpowers/specs/2026-04-07-phase-label-starttime-design.md`

**段階1で確立したパターン:**
- BoundaryEditModal: `mode: 'phase' | 'label'` で切り替え、現在言語の1入力欄のみ
- コンテキストメニュー: フェーズ列クリックでポップオーバー（編集/追加/削除）
- TL選択モード: 下部フローティングバー + フェーズ列枠ハイライト
- データ変換: 純粋関数 + vitest テスト

**UXルール（段階1フィードバックから）:**
- モーダルは現在言語の1入力欄のみ（管理画面のテンプレートエディタだけ多言語入力）
- 開発者用語を使わない（「終端時間」→「ラベルの終了時間」等）
- コンテキストメニューはイベント列と同じパターン
- TL選択のハイライトはラベル列の枠のみ（行全体は重い）

---

## ファイル構造

| ファイル | 操作 | 責務 |
|---------|------|------|
| `src/types/index.ts` | 修正 | Label型追加、TimelineEventからmechanicGroup型変更 |
| `src/utils/labelMigration.ts` | 新規 | 旧mechanicGroup→Label[]変換の純粋関数 |
| `src/utils/__tests__/labelMigration.test.ts` | 新規 | 変換関数のテスト |
| `src/store/useMitigationStore.ts` | 修正 | labels配列+操作メソッド追加、旧ラベル操作削除 |
| `src/components/Timeline.tsx` | 修正 | ラベルオーバーレイをlabels[]から描画、コンテキストメニュー追加 |
| `src/components/TimelineRow.tsx` | 修正 | ラベル列クリックハンドラ更新 |
| `src/components/HeaderGimmickDropdown.tsx` | 修正 | labels[]直接参照に変更 |
| `src/components/HeaderMechanicSearch.tsx` | 修正 | labels[]参照に変更 |
| `src/components/LabelModal.tsx` | 削除 | BoundaryEditModalに統合済み |
| `src/utils/templateConversions.ts` | 修正 | convertPlanToTemplateのlabel変換 |
| `src/utils/fflogsMapper.ts` | 修正 | mechanicGroup→labels変換追加 |
| `src/data/templateLoader.ts` | 修正 | TemplateData型にlabels追加 |
| `src/components/Sidebar.tsx` | 修正 | テンプレート→プラン変換のlabel処理 |
| `src/store/usePlanStore.ts` | 修正 | 同上 |
| `src/hooks/useTemplateEditor.ts` | 修正 | labels[]対応 |
| `src/components/admin/TemplateEditor.tsx` | 修正 | labels[]対応 |
| `src/components/admin/CsvImportModal.tsx` | 修正 | labels[]構築 |
| `src/locales/*.json` | 修正 | ラベル用i18nキー追加 |

---

## Task 1: Label型の追加 + TimelineEvent.mechanicGroupの段階的廃止準備

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Label型を追加**

```typescript
export interface Label {
    id: string;
    name: LocalizedString;
    startTime: number;
    endTime?: number;  // 未指定なら次のLabelのstartTimeまたはフェーズ境界まで
}
```

- [ ] **Step 2: PlanData型にlabelsを追加**

```typescript
export interface PlanData {
    // ...既存フィールド
    labels?: Label[];  // optional for backwards compatibility
}
```

- [ ] **Step 3: コミット**

---

## Task 2: ラベル変換関数（純粋関数 + テスト）

**Files:**
- Create: `src/utils/labelMigration.ts`
- Create: `src/utils/__tests__/labelMigration.test.ts`

- [ ] **Step 1: テストファイルを作成**

テストケース:
- mechanicGroupからLabel[]への変換（基本）
- 連続する同名ラベルは1つのLabelにまとめる
- ラベルなしイベントは隙間として扱う
- 空配列は空配列を返す
- 新形式（labels[]あり）はそのまま返す

- [ ] **Step 2: 変換関数を実装**

```typescript
export function isLegacyLabelFormat(data: { labels?: any[]; timelineEvents: any[] }): boolean
export function migrateLabels(timelineEvents: any[], phases: Phase[]): Label[]
```

- mechanicGroup.jaの値が変わる地点をstartTimeとしてLabel作成
- フェーズ境界でラベルは区切る
- mechanicGroupがないイベントは隙間

- [ ] **Step 3: テスト通過確認 + コミット**

---

## Task 3: useMitigationStoreにlabels配列+操作メソッド追加

**Files:**
- Modify: `src/store/useMitigationStore.ts`

- [ ] **Step 1: state/actionsにlabels関連を追加**

```typescript
// State
labels: Label[];

// Actions
addLabel: (startTime: number, name: LocalizedString) => void;
updateLabel: (id: string, name: LocalizedString) => void;
removeLabel: (id: string) => void;
updateLabelEndTime: (id: string, newEndTime: number) => void;
```

- [ ] **Step 2: loadSnapshotにlabels変換を追加**

labels配列がなくtimelineEventsにmechanicGroupがある場合、migateLabelsで変換。

- [ ] **Step 3: 旧ラベル操作（setLabelFromTime, updateLabelSection, removeLabelSection）を削除**

- [ ] **Step 4: importTimelineEventsにlabels引数を追加**

- [ ] **Step 5: getSnapshot/PlanDataにlabelsを含める**

- [ ] **Step 6: コミット**

---

## Task 4: Timeline.tsxのラベルオーバーレイをlabels[]から描画

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: ギミック区間オーバーレイをlabels[]ベースに書き換え**

現在のmechanicGroupからの動的グループ化ロジックをすべて削除し、labels[]から直接描画。フェーズと同じpointer-events-noneパターン。

- [ ] **Step 2: ラベル用コンテキストメニュー（labelPopover）を追加**

フェーズのphasePopoverと同じパターン:
- ラベルを編集
- ここにラベルを追加
- ラベルを削除

- [ ] **Step 3: ラベル用TL選択モード対応**

フェーズと同じフローティングバー+ラベル列枠ハイライト。

- [ ] **Step 4: BoundaryEditModalのラベルモード呼び出し**

mode='label'で呼び出し。

- [ ] **Step 5: コミット**

---

## Task 5: TimelineRow.tsxのラベル列更新

**Files:**
- Modify: `src/components/TimelineRow.tsx`

- [ ] **Step 1: ラベル列クリック時のハンドラ更新**

フェーズ列と同じパターン: クリック→Timeline.tsxのhandleLabelClickを呼ぶ→コンテキストメニュー表示。

- [ ] **Step 2: TL選択モード時のラベル列ハイライト**

- [ ] **Step 3: コミット**

---

## Task 6: HeaderGimmickDropdown + HeaderMechanicSearchをlabels[]参照に

**Files:**
- Modify: `src/components/HeaderGimmickDropdown.tsx`
- Modify: `src/components/HeaderMechanicSearch.tsx`

- [ ] **Step 1: HeaderGimmickDropdownをlabels[]から直接参照に変更**

現在はtimelineEventsのmechanicGroupをスキャンしてグループ化している。labels[]から直接取得に変更。

- [ ] **Step 2: HeaderMechanicSearchをlabels[]参照に変更**

- [ ] **Step 3: コミット**

---

## Task 7: FFLogsMapper + テンプレート変換のlabel対応

**Files:**
- Modify: `src/utils/fflogsMapper.ts`
- Modify: `src/data/templateLoader.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/store/usePlanStore.ts`
- Modify: `src/utils/templateConversions.ts`

- [ ] **Step 1: TemplateData型にlabelsフィールドを追加**

```typescript
export interface TemplateData {
  // ...既存
  labels?: { id: number; startTimeSec: number; name: LocalizedString; endTimeSec?: number }[];
}
```

- [ ] **Step 2: fflogsMapperのmechanicGroup生成をlabels生成に変更**

MapperResultにlabelsフィールドを追加。

- [ ] **Step 3: Sidebar/usePlanStoreのテンプレート→プラン変換にlabels追加**

- [ ] **Step 4: convertPlanToTemplateのlabel変換を追加**

- [ ] **Step 5: templateLoader旧テンプレート互換（labelsなし→mechanicGroupから変換）**

- [ ] **Step 6: コミット**

---

## Task 8: テンプレートエディタ（管理画面）のlabels[]対応

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts`
- Modify: `src/components/admin/TemplateEditor.tsx`
- Modify: `src/components/admin/CsvImportModal.tsx`

- [ ] **Step 1: useTemplateEditorのラベル操作をlabels[]ベースに変更**

- [ ] **Step 2: TemplateEditor.tsxのラベル列をlabels[]から描画に変更**

管理画面では多言語入力を許可（BoundaryEditModalではなく独自UIまたはBoundaryEditModalの管理者モード）。

- [ ] **Step 3: CsvImportModalのラベル構築をlabels[]に変更**

- [ ] **Step 4: コミット**

---

## Task 9: TimelineEventからmechanicGroup参照を全削除

**Files:**
- Modify: `src/types/index.ts`
- Modify: 全ファイルでmechanicGroup参照を削除

- [ ] **Step 1: TimelineEvent.mechanicGroupフィールドをoptionalのまま残す（旧データ互換）**

型定義からは削除せず、`@deprecated`コメントを追加。変換関数で読み込み時に使用し、保存時には含めない。

- [ ] **Step 2: 全ファイルのmechanicGroup直接参照を削除**

grep で確認して残りを全削除。

- [ ] **Step 3: コミット**

---

## Task 10: LabelModal.tsx削除 + i18nキー追加

**Files:**
- Delete: `src/components/LabelModal.tsx`
- Modify: `src/locales/*.json`

- [ ] **Step 1: LabelModal.tsxへの参照がないことを確認して削除**

- [ ] **Step 2: ラベル用i18nキー追加**

timeline.label_edit, timeline.label_add_here, timeline.label_delete 等。

- [ ] **Step 3: コミット**

---

## Task 11: 既存テスト更新 + 全テスト通過確認

**Files:**
- Modify: `src/utils/__tests__/templateConversions.test.ts`
- Modify: `src/hooks/__tests__/useTemplateEditor.test.ts`

- [ ] **Step 1: mechanicGroup関連テストをlabels[]に更新**

- [ ] **Step 2: 全テスト実行**

- [ ] **Step 3: ビルド確認（npm run build）**

- [ ] **Step 4: コミット**

---

## Task 12: クリーンアップ + ビルド最終確認

**Files:**
- Modify: `src/store/useMitigationStore.ts`（normalizeEvents内のmechanicGroup正規化を削除）

- [ ] **Step 1: 不要になった関数・import・型定義を削除**

- [ ] **Step 2: 最終ビルド + テスト**

- [ ] **Step 3: コミット**

---

## 完了確認チェックリスト

- [ ] Label型が `{ id, name: LocalizedString, startTime, endTime? }` になっている
- [ ] useMitigationStoreにlabels配列+CRUD操作がある
- [ ] 旧mechanicGroup→Label[]の自動変換が動く
- [ ] ラベルオーバーレイがlabels[]から描画される
- [ ] ラベル列クリックでコンテキストメニュー（編集/追加/削除）が出る
- [ ] BoundaryEditModalがmode='label'で動作する
- [ ] HeaderGimmickDropdownがlabels[]から直接参照する
- [ ] FFLogsインポートでlabelsが生成される
- [ ] テンプレートエディタがlabels[]対応
- [ ] TimelineEventのmechanicGroup直接参照が全削除されている
- [ ] LabelModal.tsxが削除されている
- [ ] `npm run build` が成功する
- [ ] 全テストが通過する
