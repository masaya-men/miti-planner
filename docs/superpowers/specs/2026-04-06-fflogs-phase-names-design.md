# FFLogsフェーズ名自動取得 設計書

## 概要

FFLogsインポート時にフェーズ名（ボス名）をAPIから自動取得する。
現在は `P1`, `P2` と機械的に生成しているが、`report.phases` APIフィールドを使って
`Fatebreaker`, `King Thordan` 等の正式名を取得する。

## 方針

- **方針B**: ボス名だけ保存（`"Fatebreaker"`）、表示時に `Phase 1` を付与
- APIコスト追加なし（既存クエリに `phases` フィールドを追加するだけ）
- 英語のみ（FFLogs APIは英語名のみ返す）
- `"P1: Fatebreaker"` → `"P1:"` プレフィックスを除去して `"Fatebreaker"` を保存

## 変更ファイルと内容

### 1. `src/api/fflogs.ts` — GraphQLクエリ拡張

**変更内容:**
- `FIGHTS_QUERY` に `encounterID` と `report.phases` を追加
- `FFLogsFight` 型に `encounterID` を追加
- 新しい型 `FFLogsPhaseInfo` を追加
- `fetchFights()` の戻り値にフェーズ名マップを含める

```graphql
query GetFights($reportCode: String!) {
  reportData {
    report(code: $reportCode) {
      fights(killType: Kills) {
        id, startTime, endTime, name, difficulty, kill, encounterID
        phaseTransitions { id, startTime }
      }
      phases {
        encounterID
        phases { id, name }
      }
    }
  }
}
```

**型変更:**
```typescript
export interface FFLogsFight {
    // ... 既存フィールド
    encounterID?: number;   // 追加
    phaseNames?: { id: number; name: string }[];  // 追加: report.phasesから紐付け
}
```

**戻り値は変更しない（後方互換維持）:**
```typescript
// 変更なし — FFLogsFight[] のまま
export async function fetchFights(reportCode: string): Promise<FFLogsFight[]>
```

`fetchFights` 内部で `report.phases` を取得し、`encounterID` で突合して
各 `FFLogsFight` オブジェクトに `phaseNames` を付与する。
これにより `resolveFight()` や `FflogsTranslationModal` など
既存の呼び出し元は**変更不要**。

### 2. `src/utils/fflogsMapper.ts` — buildPhasesでフェーズ名を使用

**変更内容:**
- `buildPhases()` が `fight.phaseNames` を参照してボス名を取得
- `"P1: Fatebreaker"` 形式の名前から `"P1: "` プレフィックスを除去
- `mapFFLogsToTimeline()` のシグネチャは変更不要（fight経由で渡る）

```typescript
// 名前クリーニング例
"P1: Fatebreaker" → "Fatebreaker"
"Phase One"       → "Phase One"  // プレフィックスなしはそのまま
```

**フォールバック:**
- phaseInfosにマッチなし → 従来通り `P1`, `P2`
- phaseTransitionsなし → `P1`（変更なし）

### 3. `src/components/FFLogsImportModal.tsx` — 変更不要

`resolveFight()` → `FFLogsFight` の型は同じ（`phaseNames` がオプショナルで追加されるだけ）。
`mapFFLogsToTimeline()` のシグネチャも変更なし。
**既存コードの変更は不要。**

### 4. `src/components/Timeline.tsx` — Phase表示の2行化復活

**変更内容:**
- フェーズ名がある場合: `Phase 1` + `Fatebreaker` の2行表示
- フェーズ名がない / `Phase X` のみの場合: 1行表示
- Phase番号はデータに含めず、表示インデックスから自動生成
- i18nキー `timeline.phase_prefix` で `Phase` / `フェーズ` 切替可能に

### 5. `src/store/usePlanStore.ts` — テンプレートからのプラン作成（修正済み）

前セッションで修正済み。`Phase X\n` プレフィックスは付けない。

### 6. テスト更新

- `fflogsMapper.test.ts`: phaseInfosパラメータ追加、期待値を更新
- 既存の `templateConversions.test.ts`: 後方互換テストはそのまま

## 影響範囲の安全性

### 変更不要（安全）
- `getPhaseName()` — string/LocalizedString両対応、フォーマット非依存
- `PhaseModal` — 任意の文字列を受け入れ
- `useMitigationStore` — フォーマット非依存
- `convertPlanToTemplate()` — 後方互換strip処理が残存
- API handlers（auto-register, admin） — 名前を検証しない
- `translationDataLoaders` — フォーマット非依存
- `useTemplateEditor` — LocalizedString対応済み

### 後方互換性
- 既存プランのlocalStorage/Firestoreデータに `Phase 1\nP1` 形式が残っている可能性
- `convertPlanToTemplate()` の strip処理で安全に変換される
- 既存テンプレートの `phases[].name` は影響なし（Firestore側データは変更しない）

## データフロー

```
FFLogs GraphQL API
  ├── fights[].phaseTransitions → { id, startTime }
  ├── fights[].encounterID → 紐付け用
  └── report.phases[] → { encounterID, phases: [{ id, name: "P1: Fatebreaker" }] }
        ↓
fetchFights() 内部で encounterID で突合
        ↓
FFLogsFight.phaseNames = [{ id: 1, name: "P1: Fatebreaker" }]
        ↓
buildPhases() でクリーニング: "P1: Fatebreaker" → "Fatebreaker"
        ↓
MapperResult.phases = [{ id: 1, startTimeSec: 0, name: "Fatebreaker" }]
        ↓
  ┌─ usePlanStore.createPlanFromTemplate()
  │    → Phase { name: "Fatebreaker", endTime }
  │
  └─ auto-register API
       → Firestore template { phases[].name: "Fatebreaker" }
        ↓
Timeline表示（2行）
  Phase 1        ← インデックスから自動生成（i18n対応可能）
  Fatebreaker    ← データから取得

既存の呼び出し元（resolveFight, FFLogsImportModal, FflogsTranslationModal）は
FFLogsFight 型のオプショナルフィールド追加のため変更不要。
```
