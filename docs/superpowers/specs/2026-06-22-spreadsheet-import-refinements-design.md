# スプレッドシート取り込み 改修2件 設計書

- **日付**: 2026-06-22
- **対象**: 既存「スプレッドシート軽減表 取り込み」機能（`feat/spreadsheet-import` ブランチに温存・本番は一旦取り下げ済）への 2 件の設計改修
- **前提 spec**: `docs/superpowers/specs/2026-06-21-spreadsheet-import-design.md`（本体設計）
- **元要望**: ユーザーがローカルで実データを触って判明した 2 点
  1. スプシの **Phase 列（神々の像 等）は LoPo の「ラベル」相当**であって「フェーズ」ではない。本来のフェーズはスプシの**タブ名**（P1_ケフカ 等）で、貼り付けデータには含まれない。
  2. パーティ枠の自動割り当てが**ズレても気づけない**。ユーザーが MT〜D4 を**明示的に全部割り当て**たい。
- **位置づけ**: 取り込み機能の忠実性・安全性の仕上げ。これが済んだら版違い修正込みで本番再投入（`git revert b3ed41be` → push）。

---

## 1. 背景・現状（実コード）

### 1.1 現状のデータフロー

```
SpreadsheetImportModal（貼り付け × N タブ）
  → parseMitigationSheet(draft) : ParsedSheet            （タブ1枚 = ParsedSheet 1個）
  → buildPlanFromSheets(sheets[], deps, {includeMitigations})
        : SheetImportResult { timelineEvents, timelineMitigations, phases, party, skipped }
  → onImport(result, 'new')  →  Timeline.handleSheetImport
        → planData = { ...timelineEvents, timelineMitigations, phases,
                        partyMembers: buildImportedPartyMembers(result.party), ... }
        → miti.loadSnapshot(planData) → commitNewPlan(newPlan)
```

関連ファイル:
- パース: `src/lib/sheetImport/parseMitigationSheet.ts` → `ParsedSheet { columns, rows }`（`src/lib/sheetImport/types.ts`）
- 構築: `src/lib/sheetImport/buildPlanFromSheets.ts`（`SheetImportResult` を定義）
- 自動パーティ: `src/lib/sheetImport/resolveImportParty.ts`（検出順にロール枠へ割当）
- 8枠化: `src/lib/sheetImport/buildImportedPartyMembers.ts`
- モーダル: `src/components/SpreadsheetImportModal.tsx`
- 取り込みハンドラ: `src/components/Timeline.tsx:1280`（`handleSheetImport`）

### 1.2 現状で「Phase」がどう作られているか

`buildPlanFromSheets.ts:40-66`: スプシの **Phase 列の値**（`SheetRow.phaseLabel`、例「神々の像」）を、シート内で連続する同名でまとめて `Phase[]` 化し `SheetImportResult.phases` に入れている。これが `planData.phases` になる。

→ **問題**: ユーザーから見た「フェーズ」はスプシのタブ（P1_ケフカ 等）。Phase 列の「神々の像」はフェーズ内の**小見出し（＝ラベル）**。現状は小見出しをフェーズとして取り込んでいる。

### 1.3 現状で「パーティ」がどう作られているか

`buildPlanFromSheets.ts:72-82`: データ行で TRUE が1つでもある列のジョブを検出（`usedJobJa` → `usedJobIds`）→ `resolveImportParty(usedJobIds, jobs)` がロール内を**検出順**で MT/ST、H1/H2、D1-D4 に割当 → `slotByJobId` を作り、各軽減列の `ownerId` を「その列のジョブが座った枠」にする（`:100-101`）。

→ **問題**: 検出順に依存するため、ユーザーの意図（どのタンクが MT か等）とズレても確認・修正の手段が無い。スプシはジョブ（ナイト 等）しか持たず、**MT/ST の別は持っていない**ので、ロール内の並びは本質的に曖昧。

### 1.4 実データで確認した事実（grounding）

- スプシは**全ジョブ分の列を持つテンプレート**（ヘッダーにナイト/戦士/暗黒騎士/ガンブレイカー… と全タンクが並ぶ）。**実パーティ = データ行で TRUE が付いた列のジョブだけ**（通常 8 人）。
- よって「ロール自体」はジョブから自動確定でき、**曖昧なのはロール内の並びだけ**（検出タンク2人のどちらが MT/ST か、ヒーラー2人の H1/H2、DPS4人の D1〜D4 順）。
- `labels` は LoPo の実フィールド（`useMitigationStore` の `labels: Label[]`・タイムラインでラベル列として描画・`Timeline.tsx:3174`）。`loadSnapshot` は `snapshot.labels` を読む（`useMitigationStore.ts:668-678`、`ensureLabelEndTimes`/`repairLastLabelEndTime` 経由）。→ `planData.labels` 投入は機能する（描画側の新規実装は不要）。
- `Label` 型 = `Phase` 型と同形 `{ id; name: LocalizedString; startTime; endTime }`（`src/types/index.ts:123-135`）。
- `Job` 型 = `{ id; name: LocalizedString; role: 'tank'|'healer'|'dps'; icon }`（`:25-30`）。ドロップダウン表示はアイコン＋ローカライズ名で出せる。

---

## 2. ゴール

1. **A**: スプシの Phase 列（神々の像 等）を **ラベル**として取り込み、**フェーズ名は貼り付けごとにユーザーが入力**する（1 タブ = 1 フェーズ）。
2. **B**: パーティ枠を**全空スタート**にし、ユーザーが**検出ジョブ全員を MT〜D4 に明示割り当て**するまで「作成」をブロック。割り当てに応じて軽減の持ち主（owner）を再計算。
3. 見た目・操作手順は **LoPo トンマナ（黒キャンバス×白光・トークン経由・glass-tier3・白黒＋機能色のみ）を守りプロ水準**で整える（左寄り・操作手順の破綻が無いこと）。

非ゴール（触らない）: 既存ユーザー取り込み（`importTimelineEvents`）/ FFLogs / `importModes.ts` / 版違いバグ修正コード（feat に温存済）/ 5件上限の破壊チューザー（安全停止のまま v1 据え置き）。

---

## 3. 機能A：Phase 列→ラベル化 ＋ フェーズ名は貼り付けごとに入力

### 3.1 入力モデルの変更

モーダルの「追加済みシート」は、今 `ParsedSheet[]` で持っているのを、**ユーザー入力のフェーズ名を併せ持つ**形に変える。

```ts
// 新規（buildPlanFromSheets.ts もしくは types.ts）
export interface ImportSheet {
  parsed: ParsedSheet;
  phaseName: string;   // ユーザーがそのタブに付けた名前（必須・空不可）
}
```

モーダル state: `sheets: ParsedSheet[]` → `entries: ImportSheet[]`。

### 3.2 `buildPlanFromSheets` の変更

シグネチャ:

```ts
export function buildPlanFromSheets(
  sheets: ImportSheet[],                                   // ← ParsedSheet[] から変更
  deps: { mitigations: Mitigation[]; jobs: Job[] },
  options: {
    includeMitigations: boolean;
    partyOverride?: { slot: string; jobId: string }[];    // ← 追加（機能B）
  },
): SheetImportResult
```

`SheetImportResult` に `labels: Label[]` を追加:

```ts
export interface SheetImportResult {
  timelineEvents: TimelineEvent[];
  timelineMitigations: AppliedMitigation[];
  phases: Phase[];     // ← ユーザー入力名（1 シート = 1 フェーズ）
  labels: Label[];     // ← 追加（スプシ Phase 列の値）
  party: { slot: string; jobId: string }[];
  skipped: SkippedSkill[];
}
```

**phases（ユーザー入力名）の作り方**:
- 各 `ImportSheet` から 1 個の `Phase` を作る。`name = { ja: phaseName, en: phaseName }`、`startTime = そのシートの最小 totalTimeSec`、`endTime = 次シートの startTime（最後は maxTime + 1）`。
- シートは startTime 昇順に並べてから endTime を確定（現行 phases と同じ確定方法）。

**labels（スプシ Phase 列）の作り方**:
- 現行 `:40-66` の「Phase 列を連続同名でまとめる」ロジックを**そのまま labels 生成へ付け替え**る（出力配列を `phases` → `labels` に変えるだけ。チャンク化・隣接同名統合・endTime 確定のロジックは現行どおり）。
- ラベルは各シート（フェーズ）の時間範囲内に収まる（現行ロジックがシート単位でチャンク化しているため自然に満たされる）。最後のラベルの endTime は現行どおり「次ラベル開始 or maxTime+1」。
- 空の `phaseLabel`（Phase 列が空のデータ行）はラベルを作らない（現行と同様に無視）。

注: `loadSnapshot` 側に `ensureLabelEndTimes`/`repairLastLabelEndTime` があり endTime を補修するため、多少の端数は安全側に倒れる。

### 3.3 モーダル UI 変更（機能A 分）

- 貼り付け欄の**直上**に「**フェーズ名**」テキスト入力を追加（`sheetImport.phase_name_label` / `..._placeholder`）。
- 「次のフェーズを追加」ボタンの活性条件を **`draft.trim() && phaseName.trim()`** に変更（名前未入力では追加不可＝「名前を入れて次を取り込む」導線）。
- 追加後は `draft` と `phaseName` を両方クリア（次タブ入力へ）。
- 追加済みリストの表示名は**ユーザー入力名**を主に（現行は Phase 列由来の名前を出している `:209-211` → entry.phaseName に変更）。チップには「ラベル N 個」も併記できると親切（任意）。

### 3.4 取り込みハンドラ変更（機能A 分）

`Timeline.tsx:handleSheetImport`（`:1296-1304`）の `planData` に `labels` を追加:

```ts
const planData: PlanData = {
  timelineEvents: result.timelineEvents,
  timelineMitigations: result.timelineMitigations,
  phases: result.phases,
  labels: result.labels,          // ← 追加
  partyMembers: buildImportedPartyMembers(result.party),
  aaSettings: { ... },
  schAetherflowPatterns: {},
};
```

（`loadSnapshot(planData)` が labels を取り込む。`:1315`）

### 3.5 フェーズ名のリネーム

取り込み後のフェーズ名編集はモーダルに作らない。タイムライン側で既存機能により編集可能（YAGNI）。

---

## 4. 機能B：パーティ枠ピッカー（全空スタート・全員割当までブロック）

### 4.1 検出ジョブの抽出（共有ヘルパに切り出し）

現行 `buildPlanFromSheets.ts:72-80` のジョブ検出を純粋関数に切り出す:

```ts
// src/lib/sheetImport/detectUsedJobIds.ts
/** データ行で TRUE が1つでもある列のジョブ id を、時刻順の初出で重複排除して返す */
export function detectUsedJobIds(parsedSheets: ParsedSheet[]): string[]
```

`buildPlanFromSheets` は内部でこれを使い、`party = options.partyOverride ?? resolveImportParty(usedJobIds, jobs)` とする。モーダルは同じヘルパで**枠ピッカーに出す検出ジョブ**を得る（DRY）。

### 4.2 ピッカーの状態とロール確定

- ロールは `jobs` ストア（`getJobsFromStore()`）から `jobId → role` で確定。検出ジョブをロール別に分類:
  - tank → MT/ST、healer → H1/H2、dps → D1/D2/D3/D4。
- モーダル state: `partyAssignment: Record<Slot, string | null>`（8 枠、初期は全 `null`）。
- 各枠のドロップダウン候補 = **そのロールで検出されたジョブのみ**（要望(a)）＋「未選択」。ゲーム全ジョブは出さない。
- **1 ジョブ 1 枠**: 別枠で既割当のジョブを選んだら、元の枠から外して入れ替え（`resolveImportParty` 相当の一意性をモーダル state で担保）。
- **おまけ（クリック削減）**: あるロールで「未割当ジョブが1人 かつ 空き枠が1つ」になったら、その枠に自動で割り当てる。

### 4.3 ブロック条件（作成ガード）

- 「作成」ボタンは **検出ジョブ全員がいずれかの枠に座るまで disabled**。
- 視覚: **割当が必要なのに空の枠を赤強調**。ルール = 「その枠のロールに未割当の検出ジョブが残っているなら、その空き枠は赤」。全員座れば赤は消える。
- ボタン下に理由テキスト（`sheetImport.party_incomplete` 例:「全員の枠を割り当てると作成できます」）。
- **エッジ（ロール枠超過）**: あるロールの検出ジョブ数 > 枠数（例: タンク3人。通常編成では起きない）の場合、超過分は**座らせられないため skipped に計上**し、ブロック条件からは除外（座らせられないものを必須にすると詰むため）。skipped リストに「枠超過で座らせられなかったジョブ」を明示。

### 4.4 owner 再計算のデータフロー

- モーダルは `partyAssignment`（埋まっている分）を `{ slot, jobId }[]` の `partyOverride` に変換し、**作成時に** `buildPlanFromSheets(entries, deps, { includeMitigations, partyOverride })` を呼ぶ。
- `buildPlanFromSheets` は `partyOverride` があればそれを `slotByJobId` の元にする → 各軽減列の owner がユーザー割当に追従。**軽減の数（rising-edge 配置数）は不変、owner だけ変わる**。
- ブロックにより作成時は全検出ジョブが座っている → 全軽減に owner が付く（取りこぼし無し）。

### 4.5 プレビューと作成の分離

- **プレビュー集計**（フェーズ数・技数・軽減数・skipped・検出ジョブ）は**パーティ割当に依存しない数**を出したい。→ プレビュー用は `partyOverride` を渡さず auto（`resolveImportParty`）で `buildPlanFromSheets` を呼び、**数の表示**にのみ使う（owner は作成時に上書きされるので表示用で問題無し）。
- **枠ピッカー描画**は `detectUsedJobIds` の結果＋ロール分類で行う（auto の割当結果は使わない＝全空スタート）。
- **作成時**のみ `partyOverride`（ユーザー割当）で再構築。
- 既存の `buildImportedPartyMembers(result.party)` は、作成時 result の `party`（= partyOverride 由来）から 8 枠 `PartyMember[]` を作る（現行ロジックのまま・空枠は jobId:null）。

---

## 5. ビジュアル / UX 品質基準（プロ水準・LoPo トンマナ）

`.claude/rules/DESIGN.md` / `ui-design.md` 準拠（ハウジング適用外ルール）。

- **色**: 白黒＋機能色のみ。選択済み枠 = 既存ラジオと同じ `border-app-text` + `bg-app-text/5`。**未割当の必須枠 = `border-app-red-border` + `bg-app-red-dim` + `text-app-red`**（警告/危険の赤は既存 parse_failed と同系統）。AI グラデ禁止・トークン経由徹底・font-size はトークン。
- **レイアウト（左寄り防止・整列）**: パーティピッカーは **CSS グリッド**で MT/ST/H1/H2/D1-D4 の枠を**列が揃う**ように配置。ロール見出し（タンク/ヒーラー/DPS）は左に固定幅ラベル、枠は均一幅。モーダル全体は現行の `p-5 space-y-5`（中央寄せ・一定パディング）を踏襲し、新セクションも同リズム。
  - 例: タンク行 = `[ロール名] [MT▼] [ST▼]`、DPS 行 = `[ロール名] [D1▼][D2▼][D3▼][D4▼]`。`md:` 未満（スマホ）は枠を 2 列グリッドで折り返し。
- **枠の中身**: ジョブ**アイコン＋ローカライズ名**（`Job.icon` / `Job.name`）。未選択は淡色プレースホルダ。
- **操作手順（上から下に自然に進む）**: ①モード選択 → ②フェーズ名＋貼り付け → ③「追加」（②③を繰り返す）→ ④パーティ割当 → ⑤プレビュー要約 → ⑥作成。フェーズ名欄と「追加」ボタンの隣接で「名前→次」のループが直感的。割当が未完なら作成は無効＋理由提示。
- **アニメ規約**: hover `transition-all duration-200`、押下 `active:scale-95`、モーダルは framer-motion（現行踏襲）。マウス追従 UI 禁止。
- **承認フロー**: 実装後、実機スクリーンショットでユーザーに見た目確認（ui-design.md (3) 承認）。

---

## 6. i18n（4言語: ja/en/ko/zh）

`sheetImport.*` に追加（`src/locales/{ja,en,ko,zh}.json`）:

| キー | ja（例） |
|---|---|
| `phase_name_label` | フェーズ名（このタブの呼び名） |
| `phase_name_placeholder` | 例: P1 神々の像 |
| `party_assign_label` | パーティの枠を割り当て |
| `party_assign_hint` | スプシのジョブを MT〜D4 に割り当ててください |
| `party_slot_unassigned` | 未選択 |
| `party_incomplete` | 全員の枠を割り当てると作成できます |
| `party_role_tank` / `_healer` / `_dps` | タンク / ヒーラー / DPS |
| `party_overflow_skipped` | 枠を超えたため座らせられないジョブがあります |

ko/zh は実翻訳（[[reference_ff14_jobguide_urls]] で訳語確認可）。既存 `party_label`（「パーティ（枠の割り当てを確認）」）は文言見直し or 流用。

---

## 7. テスト計画（TDD）

純ロジックは vitest（pool='vmThreads' 維持・focused 実行・出力ファイル・push 前 `npm run build`）。

- `detectUsedJobIds.test.ts`（新規）: 複数シート・TRUE 無し列除外・初出時刻順・重複排除。
- `buildPlanFromSheets.test.ts`（拡張）:
  - phases = ユーザー入力名・1 シート 1 個・startTime/endTime がシート範囲。
  - labels = スプシ Phase 列由来・連続同名チャンク・シート内収まり。
  - `partyOverride` ありで owner がユーザー割当に追従・軽減数不変。
  - `partyOverride` なし（auto）で現行どおり（後方互換）。
- パーティ割当ロジック（モーダル外に純関数として切り出せる範囲）: 一意性（入替）・自動補完（残り1枠1ジョブ）・ブロック判定（全員座ったか）・ロール超過 skip。
- 既存テスト（`resolveSheetSkill` / `parseMitigationSheet` / `buildImportedPartyMembers` / `resolveImportParty`）はシグネチャ変更に追従（`ParsedSheet[]` → `ImportSheet[]` のラップ）。
- 実機（Playwright・endpoint user verification）: 実データ全 5 タブをフェーズ名付きで貼付 → ラベルがタイムラインに出る／パーティ割当 UI が全空→赤→全員割当で作成可／作成後の owner が割当どおり。

---

## 8. 型・シグネチャ変更まとめ（影響範囲）

| 対象 | 変更 |
|---|---|
| `src/lib/sheetImport/types.ts` | `ImportSheet { parsed; phaseName }` 追加 |
| `buildPlanFromSheets.ts` | 引数 `ImportSheet[]`・`options.partyOverride?`・戻り `labels` 追加・phases をユーザー名で生成・Phase 列を labels へ |
| `detectUsedJobIds.ts`（新規） | ジョブ検出を切り出し |
| `SpreadsheetImportModal.tsx` | フェーズ名入力・パーティピッカー・entries 化・作成時 partyOverride |
| `Timeline.tsx:handleSheetImport` | `planData.labels` 追加 |
| `src/locales/*.json` | `sheetImport.*` 追加 |
| 各 `__tests__` | 追従 |

`buildImportedPartyMembers` / `resolveImportParty` / `parseMitigationSheet` / `resolveSheetSkill` の**ロジック本体は不変**（呼び出し側の入れ物だけ変わる）。

---

## 9. リスク・エッジケース

- **ロール枠超過**（タンク3+ 等）: §4.3 のとおり skipped 計上＋ブロック除外。通常編成では非発生。
- **検出ジョブ < 8**（誰かが追跡対象軽減を撃っていない）: その分の枠は空のままで OK（軽減ゼロで無害）。ブロックは「検出ジョブ全員」基準なので詰まらない。
- **JOB_JA_TO_ID 未登録ジョブ**: 検出されない（現行どおり）。
- **labels と phases の二重表示**: PlanData は両方を別列で持つため共存可（`labels?` は既存・描画実装済）。
- **Vercel tsc -b 厳密**: `import type` 徹底・未使用 import/var 残さない（[[feedback_vercel_tsc_strict]]）。
- **既存取り込み無回帰**: 本改修は sheetImport 配下と Timeline の 1 ハンドラ＋モーダルのみ。`importTimelineEvents`/FFLogs/`importModes.ts` に触れない。

---

## 10. 完了後の段取り

1. 実装（feat/spreadsheet-import に積む）→ `npm run build` + vitest 緑。
2. 実機確認（ユーザー）= ローカル dev 5173 で実データ全 5 タブ。見た目承認。
3. OK なら**版違い修正込みで本番再投入**: `git revert b3ed41be` → push（[[feedback_deploy]]・新機能はユーザーのローカル確認をゲートに）。
