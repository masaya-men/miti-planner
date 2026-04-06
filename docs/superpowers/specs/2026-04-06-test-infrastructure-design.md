# テスト基盤設計書

## 目的

公開済みアプリのコア機能を壊さないための安全網を構築する。
「壊れたらユーザーが困る」計算・変換ロジックを優先的にカバーする。

## 既存環境

- Vitest 4.1.2 インストール済み
- vitest.config.ts 設定済み（`src/**/__tests__/**/*.test.ts`）
- 既存テスト: `src/lib/__tests__/ogpHelpers.test.ts` のみ

## テスト対象（5ファイル）

### 1. damageRounding.ts — ダメージ丸め計算

**関数:** `roundDamageCeil(value: number): number`

**テストケース:**
- 999以下: そのまま返す（312 → 312）
- 0以下/負: そのまま返す
- 4桁: 3有効桁で切り上げ（8523 → 8530）
- 5桁: 3有効桁で切り上げ（42876 → 42900）
- 6桁: 3有効桁で切り上げ（156234 → 157000）
- ちょうど割り切れる値: 切り上げ不要（150000 → 150000）

### 2. templateConversions.ts — テンプレート変換

**関数群:**
- `parseTimeString(input)` — "M:SS" / "M:SS.x" / 秒数文字列 → 秒数
- `formatTime(seconds)` — 秒数 → "M:SS"
- `parseTsv(text)` — TSV → ParsedRow[]
- `guessColumnType(header)` — ヘッダー → カラム種別
- `parseDamageType(value)` — 文字列 → damageType
- `parseTarget(value)` — 文字列 → target
- `convertCsvToEvents(rows, mappings)` — CSV行 → TimelineEvent[] + phases
- `convertPlanToTemplate(planData, contentId)` — プラン → テンプレート

**重点テスト（今回のバグ再発防止）:**
- convertPlanToTemplate: フェーズ名の `\n` ストリップ
- convertPlanToTemplate: LocalizedString のフェーズ名処理
- convertCsvToEvents: フェーズ境界の検出
- convertCsvToEvents: ギミックグループの継承

### 3. calculator.ts — 軽減計算

**関数群:**
- `calculatePotencyValue(input, potency, role, modifiers)` — ポテンシー → 実数値
- `calculateCriticalValue(baseValue)` — クリティカル値
- `calculateHpValue(hp, percent)` — HP割合計算
- `getColumnWidth(role)` — 列幅（簡易）

**テスト方針:**
- LevelModifier をテストデータとして直接渡す（ストア依存を回避）
- Lv100の既知モディファイア値でスナップショットテスト
- calculateMemberValues はストア依存のためスキップ（将来リファクタ候補）

### 4. fflogsMapper.ts — FFLogsインポート

**メイン関数:** `mapFFLogsToTimeline(rawEn, rawJp, fight, deaths, castEn, castJp, players)`

**テスト対象の内部ロジック:**
- dedupe: packetIDベースの重複排除
- 正規化: タイムスタンプ→秒変換、AA判定、JP/EN名マッピング
- MT/ST判定: AA被弾数ベース
- 800msグループ化 + 2秒マージ
- TB判定: ダメージ比率ベース（1.5倍）
- AoE/TB/複合の分岐
- AA処理: 500ms近接グループ化
- 同名技ダメージ統一: 中央値±20%
- 同秒競合解消: 最大2イベント/秒
- フェーズ自動生成

**テスト方針:**
- mapFFLogsToTimeline に最小限のテストデータを渡して全体フローを検証
- 個別シナリオ: AoEのみ、TBのみ、複合TB、AA混在、フェーズ付き
- 内部関数（computeAoEDamage等）は export されていないため、統合テストで間接的にカバー

### 5. useTemplateEditor.ts — テンプレートエディタフック

**テスト対象のロジック:**
- setPhaseAtTime: フェーズ境界の追加/更新/削除
- フェーズ削除: 任意行から削除可能（境界判定）
- ラベル更新: mechanicGroup の一括更新
- modified トラッキング

**テスト方針:**
- @testing-library/react-hooks を追加インストール
- renderHook でフックを初期化し、act でアクションを実行
- 状態変化を assertion で検証

## ファイル配置

```
src/
├── utils/
│   ├── __tests__/
│   │   ├── damageRounding.test.ts
│   │   ├── templateConversions.test.ts
│   │   ├── calculator.test.ts
│   │   └── fflogsMapper.test.ts
│   └── ...
├── hooks/
│   ├── __tests__/
│   │   └── useTemplateEditor.test.ts
│   └── ...
└── lib/
    ├── __tests__/
    │   └── ogpHelpers.test.ts  (既存)
    └── ...
```

## 追加パッケージ

- `@testing-library/react` — フックテスト用
- `@testing-library/react-hooks` は不要（React 18+では @testing-library/react に統合済み）

## 成功基準

- 全テスト pass
- 今回のフェーズ名バグが再発しないことをテストで保証
- `npm test` で全テストが実行される
