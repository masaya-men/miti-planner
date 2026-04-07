# フェーズ・ラベル startTime統一リファクタリング 設計書

> 作成日: 2026-04-07
> ステータス: 承認済み
> 実装方針: C（フェーズ先行 → ラベル後続の2段階）

---

## 1. 背景と目的

### 現状の問題

- **ラベル分裂バグ**: ラベル（mechanicGroup）がイベント単位で保持されているため、グループ化ロジックが複雑化し、3回の修正でも解消できなかった
- **データモデルの不一致**: フェーズは境界データ（Phase[]）、ラベルはイベント埋め込み（mechanicGroup）と方式が異なる
- **型の混在**: Phase.name が `string | LocalizedString` のunion型で、各所に typeof 分岐が散在
- **管理画面のバグ**: テンプレートエディタでラベルなしイベントの編集ができない

### 目的

1. フェーズとラベルを同じ `startTime` ベースの境界データモデルに統一
2. Phase.name を `LocalizedString` に統一し、型分岐を排除
3. 編集モーダルに名前変更・削除・終端時間変更を統合
4. 既存機能を破壊せず安全に移行

---

## 2. データ構造

### 新しい型定義

```typescript
interface Phase {
  id: string;
  name: LocalizedString;
  startTime: number;
  endTime?: number;  // 未指定なら次のPhaseのstartTimeまで
}

interface Label {
  id: string;
  name: LocalizedString;
  startTime: number;
  endTime?: number;  // 未指定なら次のLabelのstartTimeまたはフェーズ境界まで
}
```

### 区間の決まり方

- 区間 = 自分の `startTime` 〜 `endTime`（指定時）または次の同種境界の `startTime`
- 最後の区間 = 自分の `startTime` 〜 タイムライン終端
- 隙間がありうる（前の区間の終端 ≠ 次の区間のstartTime）
- **ラベル固有の制約**: ラベルの区間はフェーズ境界を跨がない。フェーズ境界でラベルは暗黙的に切れる
- **隙間の表示**: 隙間（どのフェーズ/ラベルにも属さない区間）は空白で表示。クリックで新規追加可能
- **最初のフェーズ**: startTime=0 のフェーズが常に1つ存在する。削除不可（名前変更は可能）
- **フェーズ変更時のラベル**: ラベルデータ自体は変更しない。描画時にフェーズ境界でクリップする。つまりラベルのデータ上のendTimeがフェーズ境界を超えていても、描画上はフェーズ境界で切れて表示される。ラベル追加時にフェーズ境界を超える指定はエラーとして拒否する

### ストアでの保持

```typescript
// useMitigationStore
{
  phases: Phase[];    // startTime順にソート
  labels: Label[];    // startTime順にソート（新規追加）
  timelineEvents: TimelineEvent[];  // mechanicGroupフィールドは廃止
}
```

---

## 3. ストア操作

### フェーズ操作

| メソッド | 説明 |
|---------|------|
| `addPhase(startTime, name)` | 新フェーズ追加。startTime順にソート |
| `updatePhase(id, name)` | フェーズ名更新（LocalizedString） |
| `removePhase(id)` | フェーズ削除。隙間になる |
| `updatePhaseEndTime(id, newEndTime)` | 終端時間変更。次のフェーズのstartTimeは変えない。次のstartTime以上ならクリップ |

### ラベル操作

| メソッド | 説明 |
|---------|------|
| `addLabel(startTime, name)` | 新ラベル追加。フェーズ境界チェックあり |
| `updateLabel(id, name)` | ラベル名更新（LocalizedString） |
| `removeLabel(id)` | ラベル削除。隙間になる |
| `updateLabelEndTime(id, newEndTime)` | 終端時間変更。フェーズ境界を超えないようクリップ |

### 削除されるメソッド

- `setLabelFromTime` → `addLabel` に置き換え
- `updateLabelSection` → `updateLabel` に置き換え
- `removeLabelSection` → `removeLabel` に置き換え

---

## 4. UI操作（プラン編集画面）

### 操作モデル（フェーズ・ラベル共通）

| 操作 | トリガー | 動作 |
|------|---------|------|
| 新規作成 | 未設定の場所をクリック | 名前入力モーダル → addPhase/addLabel |
| 名前変更 | 既存区間をクリック | 編集モーダル → updatePhase/updateLabel |
| 削除 | 編集モーダルの削除ボタン | removePhase/removeLabel → 隙間になる |
| 終端変更 | 編集モーダルの終端時間UI | updatePhaseEndTime/updateLabelEndTime |

### 編集モーダル（PhaseModal を拡張、フェーズ・ラベル共用）

```
┌─────────────────────────────────┐
│  フェーズ名を編集               │
│                                 │
│  日本語:  [散開              ]  │
│  English: [Spread            ]  │
│  中文:    [                  ]  │
│  한국어:  [                  ]  │
│                                 │
│  終端時間: [1:30  ] [TL選択]    │
│                                 │
│  [削除]              [保存]     │
└─────────────────────────────────┘
```

- 新規作成時は終端時間UIなし（まずは名前だけ設定）
- 削除ボタンは新規作成時には非表示
- LabelModal.tsx はこのモーダルに統合して削除

### 「タイムラインで選択」フロー

1. 「TL選択」ボタンクリック → モーダルが閉じる
2. ヘッダーに「終端位置を選択してください」のバナー表示
3. マウスがイベント行に乗ると → 開始位置からその行までハイライト表示（onMouseEnter/onMouseLeave）
4. クリックで確定 → モーダルが再度開き終端時間が更新された状態で表示
5. Escキーでキャンセル → 選択モードを抜けてモーダルに戻る

ハイライトは `previewEndTime` state + CSS クラスで実現。onMouseMove は使わない。

---

## 5. 管理画面（テンプレートエディタ）

### テンプレートデータ型

```typescript
interface TemplateData {
  contentId: string;
  generatedAt: string;
  sourceLogsCount: number;
  timelineEvents: TimelineEvent[];  // mechanicGroupフィールドは段階的に廃止
  phases: { id: number; startTimeSec: number; name?: LocalizedString }[];
  labels?: { id: number; startTimeSec: number; name: LocalizedString; endTimeSec?: number }[];
  _warning?: string;
}
```

### 変更内容

- フェーズ列・ラベル列ともにプラン編集画面と同じ操作モデル
- `useTemplateEditor` のPhase/Label操作を新データ構造に対応
- イベントごとの `mechanicGroup` への書き込みは廃止
- スプシコピペ（`convertCsvToEvents`）: `labels[]` 配列を直接構築

### テンプレートJSON（25ファイル）

- `phases.name` が `string` → 読み込み時に `LocalizedString` に変換
- `labels` フィールドなし → 空配列として扱う
- `timelineEvents` 内の `mechanicGroup` → 読み込み時に `labels[]` に変換（旧テンプレート互換）

---

## 6. データ移行

### 方式: 読み込み時自動変換

Firestoreのデータは直接変更しない。アプリが読み込む際に旧形式→新形式に変換し、次回保存時に新形式で上書き。

### 旧Phase（endTime方式）→ 新Phase（startTime方式）

```
検出条件: phases[0] に endTime があり startTime がない
変換:
  新phases[0].startTime = 0
  新phases[N].startTime = 旧phases[N-1].endTime
  名前: normalizeLocalizedString() で LocalizedString に統一
```

### 旧ラベル（イベントのmechanicGroup）→ 新Label[]

```
検出条件: labels配列が存在しない & timelineEventsにmechanicGroupがある
変換:
  イベントをtime順にソート
  mechanicGroup.jaの値が変わる地点をstartTimeとしてLabel作成
  変換後、イベントからmechanicGroupフィールドを削除
```

### Phase.name の正規化

```
typeof name === 'string' → normalizeLocalizedString(name)
"[object Object]" 混入 → クリーニング後に正規化
```

### 安全策

- 変換処理は純粋関数として実装しテストで検証
- 変換前にデータのディープコピーを取る
- 旧形式の検出が確実でない場合は変換をスキップ

---

## 7. 実装順序

### 段階1: フェーズをstartTimeベースに変更

1. Phase型を `{ id, name: LocalizedString, startTime, endTime? }` に変更
2. useMitigationStore のフェーズ操作を書き換え
3. 旧Phase（endTime方式）→ 新Phase の変換関数を実装+テスト
4. Timeline.tsx のフェーズオーバーレイ描画をstartTimeベースに
5. PhaseModal を多言語入力+終端時間変更UIに拡張
6. タイムライン選択フロー（ハイライト付き）実装
7. HeaderPhaseDropdown をstartTimeベースに
8. FFLogsMapper.buildPhases の戻り値をLocalizedString対応に
9. テンプレート→プラン変換のphase処理を更新
10. Sidebar.tsx / usePlanStore.ts のphase変換を更新
11. CheatSheetView.tsx のフェーズ表示を更新
12. 既存テスト更新 + 変換テスト追加
13. ビルド・全テスト通過確認

### 段階2: ラベルをLabel[]境界データに変更

1. Label型を新規追加
2. useMitigationStore に labels 配列 + ラベル操作メソッド追加
3. 旧mechanicGroup → Label[] の変換関数を実装+テスト
4. Timeline.tsx のギミック区間オーバーレイを labels[] から描画に変更
5. PhaseModal をラベル編集にも共用（モード切替）
6. HeaderGimmickDropdown を labels[] 直接参照に変更
7. HeaderMechanicSearch を labels[] 参照に変更
8. TimelineEvent から mechanicGroup フィールド参照を全削除
9. テンプレートエディタ（TemplateEditor.tsx / useTemplateEditor.ts）をlabels[]対応に
10. CsvImportModal / convertCsvToEvents でlabels[]を構築
11. convertPlanToTemplate のlabel変換を更新
12. templateLoader.ts の旧テンプレート互換変換
13. LabelModal.tsx を削除
14. 既存テスト更新 + 変換テスト追加
15. ビルド・全テスト通過確認

---

## 8. 影響ファイル一覧

### 型定義
- `src/types/index.ts`

### ストア
- `src/store/useMitigationStore.ts`
- `src/store/usePlanStore.ts`

### UI（プラン編集画面）
- `src/components/Timeline.tsx`
- `src/components/TimelineRow.tsx`
- `src/components/PhaseModal.tsx`
- `src/components/LabelModal.tsx` → 削除
- `src/components/HeaderGimmickDropdown.tsx`
- `src/components/HeaderPhaseDropdown.tsx`
- `src/components/HeaderMechanicSearch.tsx`

### UI（管理画面）
- `src/components/admin/TemplateEditor.tsx`
- `src/hooks/useTemplateEditor.ts`
- `src/components/admin/CsvImportModal.tsx`
- `src/components/admin/AdminTemplates.tsx`

### データ変換
- `src/utils/templateConversions.ts`
- `src/data/templateLoader.ts`
- `src/utils/fflogsMapper.ts`

### その他
- `src/components/Sidebar.tsx`
- `src/components/CheatSheetView.tsx`

### テスト
- `src/utils/__tests__/templateConversions.test.ts`
- `src/hooks/__tests__/useTemplateEditor.test.ts`
- 新規: データ変換テスト
