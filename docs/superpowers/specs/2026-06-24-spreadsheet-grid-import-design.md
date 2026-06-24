# 自作スプシ対応・列グリッド取込 設計書

- **日付**: 2026-06-24
- **対象**: スプレッドシート取込を「有名スプシ専用」から「どんなスプシでも取り込める汎用ツール」へ拡張する。画面いっぱいのスプシ風グリッドモーダルを新設し、(A) まるごと貼り付け＝見出しによる位置非依存の自動検出、(B) 列ごと貼り付け＝手動マッピング、の2経路で取り込む。
- **元要望**: ユーザー発案(2026-06-24 ブレスト)。「うまく取り込めなかったら列ごとに貼って」案内 → スプシ風UIで列ごとに正式名称で書けば取り込める。自作スプシ対応。
- **位置づけ**: 既存の有名スプシ取込([SpreadsheetImportModal.tsx](../../../src/components/SpreadsheetImportModal.tsx))は**温存**し、これを置き換えない。新グリッドは並立する別経路(中規模)。
- **ブランチ**: `feat/spreadsheet-grid-import`(main=本番デプロイ済から分岐)。
- **関連別タスク**: 攻撃名見切れマーキー(§9・`2026-06-22-event-or-attack-design.md` §5)は本 spec とは独立。

---

## 1. 法的・位置づけ判断(ブレスト確定)

- LoPo は有名スプシを**ホスト・再配布・同梱しない**。ユーザーが自分のコピーを自分で貼り付け、LoPo 独自モデルへ**変換**するだけ。取り込む情報の大半は事実データ(攻撃時刻・ダメージ等)。**低リスク**。
- 本機能(汎用列グリッド)は「特定スプシ専用ツール」という見え方を**改善**する(汎用インポータ化)= posture が良くなる。
- 厳守: 特定スプシの**名前を冠さない**(UI 文言に「有名スプシ」「○○の軽減表」等を出さない)。原本を同梱・ホストしない。権利表記(`sheetImport.rights_notice`)は維持・新モーダルにも表示。

---

## 2. 確定した設計判断(ブレスト 2026-06-24・ユーザー承認済)

1. **1つのグリッド面 + 2つの入れ方**:
   - **(A) まるごと貼り付け**(Ctrl+A→Ctrl+C→貼り付け): 見出し文字で**位置非依存に自動検出**。余計な列・行(計算列・メタ行)は無視。
   - **(B) 列ごとに貼り付け**: 自動で当たらない自作スプシ用。各列に1列ずつ貼る。
2. **列(左→右)**: フェーズ｜ラベル｜時間｜敵の攻撃｜ダメージ｜攻撃の対象｜ダメージ種別｜メンバー×N。
   - **フェーズ** = LoPo Phase(引き継ぎ式・**任意**。空ならフェーズ帯を作らないだけ)。
   - **ラベル** = LoPo Label(引き継ぎ式)。有名スプシの「Phase」列に相当。
   - **時間** = M:SS(負値=戦闘前)。必須。
   - **敵の攻撃** = イベント名。
   - **ダメージ** = ダメージ量(任意)。
   - **攻撃の対象** = MT/ST/全体(AoE)(任意・**新規**)。`TimelineEvent.target` へ。§③テンプレ対象引き継ぎと補完関係。
   - **ダメージ種別** = 物理/魔法(+即死/時間切れ=enrage番兵)。
   - **メンバー列** = 見出しに**ジョブ名**(日英中韓いずれか)、セルに**スキル正式名称**(日英中韓いずれか)。枠(MT/ST/H1/H2/D1–D4)は**グリッド上で割当**(見出しの枠セレクタ)。役割はジョブから自動。タンク1人なら自動 MT 等(現行 `autoFillSingles` 思想)。
3. **列ステータスチップ(青/黄/灰)**: 青=この列は全部読めた / 黄=一部読めないセルあり(その分だけ捨てる・警告) / 灰=空 or 任意未入力。**緑は使わない**(LoPo デザインルール=白黒+機能色 青=OK。`.claude/rules/ui-design.md`)。
4. **自動検出 = 見出し文字依存・位置非依存**。多言語+別名の見出し辞書を持つ。**限界**: 見出し無し列・独自すぎる名前・中身だけで判別不能な数値列(HP/バリア/リキャストとダメージ)は自動不可 → 「この列は？」で1回指定 or 「無視」。
5. **メンバーセルのスキル名は日英中韓の正式名称で解決**(現行はジョブ名・スキル名とも日本語のみ)。
6. **4人コンテンツ対応**(枠割当・検出メンバー数駆動。8人固定要求なし)。
7. 取込結果は既存 `SheetImportResult` 型に合流 → 既存コミット経路([commitImportedPlan.ts](../../../src/lib/sheetImport/commitImportedPlan.ts))を再利用 → §③ テンプレ対象引き継ぎ([applyTemplateTargets.ts](../../../src/lib/sheetImport/applyTemplateTargets.ts))も自動適用。
8. まるごとボタンに軽いユーモア文言(「まるごと貼り付け（Ctrl+A → Ctrl+C → 貼り付け）」+「余計な列ごと貼ってOK。たぶん自動で読み取ります」)。LoPo 本体 UI ルール準拠(AIグラデ/過剰glow禁止・白黒+機能色)。
9. モーダルは**画面いっぱい近い**サイズ・スプシ風・横スクロール・ヘッダー/行番号列 sticky。

---

## 3. 現状コード(grounding 済)

- 既存パーサ [parseMitigationSheet.ts](../../../src/lib/sheetImport/parseMitigationSheet.ts): 全セル走査で `Phase`/`Total Time`/`Action`/`Type`/`Hit` の**見出し位置を探す**(:47-58)= 既に位置非依存。`Skill` 行+ジョブ行+TRUE/FALSE で軽減列を構成。**有名スプシ(skill列×TRUE/FALSE)形式専用**。
- 既存ビルダー [buildPlanFromSheets.ts](../../../src/lib/sheetImport/buildPlanFromSheets.ts): rows→timelineEvents、ユーザー入力名→Phase、Phase列→Label(:52-79)、TRUE 立ち上がり→軽減。`SheetImportResult` を返す。
- スキル解決 [resolveSheetSkill.ts](../../../src/lib/sheetImport/resolveSheetSkill.ts): `m.name.ja === normalized` の**日本語一致のみ**。ジョブは `JOB_JA_TO_ID`(日本語のみ・[skillAliases.ts](../../../src/lib/sheetImport/skillAliases.ts))。
- 枠割当 [partyAssignment.ts](../../../src/lib/sheetImport/partyAssignment.ts): `PARTY_SLOTS`=MT/ST/H1/H2/D1–D4、`SLOTS_BY_ROLE`、`autoFillSingles`、`isAssignmentComplete`(need=min(検出, 枠数)=4人OK)。
- コミット [commitImportedPlan.ts](../../../src/lib/sheetImport/commitImportedPlan.ts): 取込は必ず新規・非collabプラン。**先に collab 切断**してから `loadSnapshot`(Bug #1 根治済)。新経路も**必ずこれを通す**。
- エントリ: [Timeline.tsx](../../../src/components/Timeline.tsx) `handleSheetImport`(:1285)、window event `timeline:spreadsheet-import`(:959)、`SpreadsheetImportModal`(:3945)。起動導線=[ImportMenu.tsx](../../../src/components/ImportMenu.tsx)。
- store からジョブ名・スキル名は多言語取得可(`getJobsFromStore`/`getMitigationsFromStore`、`name: LocalizedString`)→ **辞書ハードコードせず store から構築**([feedback_no_hardcoding])。

---

## 4. 機能設計

### 4.1 列モデル(正典フィールド)
グリッドの「目的列(target field)」を固定で定義:

| field | 必須 | 取込先 | 値 |
|---|---|---|---|
| `phase` | 任意 | Phase(引き継ぎ) | 任意文字列 |
| `label` | 任意 | Label(引き継ぎ) | 任意文字列 |
| `time` | **必須** | event.time | M:SS(負=戦闘前) |
| `action` | 任意 | event.name | 任意文字列 |
| `damage` | 任意 | event.damageAmount | 数値(カンマ可) |
| `target` | 任意 | event.target | MT/ST/全体(AoE) |
| `damageType` | 任意 | event.damageType | 物理/魔法/(enrage番兵) |
| `member[n]` | 任意 | 軽減 | 見出し=ジョブ・セル=スキル名・枠は別途割当 |

`time` だけが必須(時刻が無いと配置不能)。他は欠けても取り込む(値なしで素通り)。

### 4.2 2つの入れ方と自動検出
まず貼り付け内容の**形式判定**を行う:
- **有名スプシ形式**(`Skill` 行+ジョブ行+TRUE/FALSE)を検出したら、**現行パーサ→現行ビルド**へルーティング(§4.5)。グリッドは確認プレビューのみ。新ビルダーは通さない。
- それ以外(=member列×スキル名形式)は、以下2つの入れ方で**内部表(行×field)**を作り、新ビルダー(§4.5 `buildPlanFromGrid`)へ:
  - **まるごと貼り付け**: TSV を解析 → 各列の**先頭付近のセルを見出し**とみなし、見出し辞書(§4.6)で `field` へ自動マッピング。マッチしない列は `unknown`(「この列は？▾」)。明らかな計算列等はユーザーが「無視」。メンバー列はジョブ名見出しで自動判定。
  - **列ごと貼り付け**: 各 target 列に1列ぶんの値(改行区切り)を貼る。位置=ユーザーが決める。
- 上記2つの入れ方は最終的に同じ内部表になる(同じ `buildPlanFromGrid` へ)。有名スプシ経路だけは別系統(§4.5)。

### 4.3 メンバー列・枠割当
- メンバー列の見出し = ジョブ名(4言語)→ store から jobId 解決 → 役割(tank/healer/dps)決定。
- 枠(MT/ST/H1/H2/D1–D4)は見出しの**枠セレクタ**で割当。役割内に1人なら自動割当・複数なら手動(現行 `partyAssignment` を流用)。
- 枠未割当のメンバー列に有効スキルがある場合は警告(現行 `party_required` 相当)。スキルが無い列は無視可。

### 4.4 列ステータスチップ(検証)
列ごとに検証関数を定義し、青/黄/灰を出す:
- `time`: 全行 M:SS 解釈可なら青・一部不可なら黄。
- `damageType`: 物理/魔法(別名含む)に正規化可。
- `target`: MT/ST/全体(別名・En/Zh/Ko 含む)に正規化可。
- `member`: 見出しが既知ジョブ **かつ** 非空セルのスキル名が解決可なら青・一部未解決なら黄(その分だけ skip し `skipped` へ)。
- `phase`/`label`/`action`/`damage`: 空可(灰)・値があれば青。
黄/灰でも**作成は可能**(青が並べば安心・黄は「ここは捨てる」を明示)。

### 4.5 ビルダー2系統(データ正確性ガードレール)
- **既存 `buildPlanFromSheets`(有名スプシ skill列×TRUE/FALSE形式)は変更しない**。有名スプシ形式が検出された場合は**現行パーサ→現行ビルド**をそのまま使い、グリッドは確認プレビューに留める(skill列を member列へ変換して再構築すると、立ち上がり判定/チャージ/未解決で**今までと結果がズレる**リスク → 避ける)。
- **新 `buildPlanFromGrid`(member列×スキル名形式)を新設**。内部表(行×field)→ `SheetImportResult`:
  - events: time/action/damage/target/damageType。
  - phases/labels: phase/label 列の引き継ぎ(隣接同名統合・既存ロジック流用)。
  - 軽減: 各メンバー列セルのスキル名を解決 → そのジョブ枠 owner で配置。1セル1スキル(複数同時使用は別行 or 将来カンマ分割=YAGNI)。
  - party: 枠割当から。
- どちらの経路も最終的に `commitImportedPlan` を通す(collab 安全作法・§3)。

### 4.6 多言語解決(辞書は store から)
- **スキル**: `resolveSheetSkill` を拡張し `m.name.{ja,en,ko,zh}` のいずれか一致で解決(現行 ja のみ→4言語)。`SKILL_ALIASES`(表記ゆれ)も維持。括弧除去 `stripParenthetical` は維持。
- **ジョブ**: jobs store の `name.{ja,en,ko,zh}` から「ジョブ名→jobId」マップを動的構築(現行 `JOB_JA_TO_ID` の多言語版)。
- **見出し辞書**: `field` ごとに別名集合(例 `damage`: ダメージ/Damage/伤害/데미지)。多言語+よくある表記。新規 `headerAliases.ts`。

### 4.7 攻撃の対象列(新規・任意)
- セル値を MT/ST/全体(AoE)に正規化(4言語別名)→ `event.target`。空=未指定(従来通り)。
- §③ の `applyTemplateTargets` はテンプレ→取込の補完。**取込側で明示された target は優先**(明示があれば上書きしない方針・実装時に確認)。

### 4.8 4人対応
- 枠割当・`isAssignmentComplete` は検出メンバー数駆動。メンバー列が4本でもそのまま通る(変更不要)。

---

## 5. UI/コンポーネント

- 新規 `SpreadsheetGridImportModal.tsx`(near-fullscreen・portal・glass-tier3・`--share-modal-bg`・LoPo 本体ルール準拠)。
  - ヘッダー(タイトル+✕)/ 入れ方バー(まるごと/列ごと)/ ヘルプ1行 / 凡例 / グリッド(横スクロール・sticky ヘッダー&行番号)/ フッター(サマリ+作成[青])。
  - 列ヘッダー: 名前・サブ・ステータスチップ・(unknown列は)「この列は？▾」・(メンバー列は)枠セレクタ。
- 起動導線: `ImportMenu` に項目追加 or 既存スプシ取込内の「うまく取り込めない時は…」リンクから。**両モーダルの関係**=既存=有名スプシ向け早道、新=汎用。最終的な導線統合は実装時に相談(当面は別項目で可)。
- 既存 `SpreadsheetImportModal` は当面温存(将来、新グリッドに一本化するかは別判断)。

---

## 6. 影響/新規ファイル

| 対象 | 変更 |
|---|---|
| `src/components/SpreadsheetGridImportModal.tsx` | **新規**。グリッドUI |
| `src/lib/sheetImport/parseGridPaste.ts` | **新規**。TSV→内部表 + 見出し自動マッピング |
| `src/lib/sheetImport/buildPlanFromGrid.ts` | **新規**。内部表→`SheetImportResult` |
| `src/lib/sheetImport/headerAliases.ts` | **新規**。field 別名辞書(多言語) |
| `src/lib/sheetImport/resolveSheetSkill.ts` | スキル解決を4言語化 |
| `src/lib/sheetImport/skillAliases.ts` | ジョブ名→id を多言語化(or store 由来へ) |
| `src/lib/sheetImport/targetNormalize.ts` | **新規**。MT/ST/AoE 正規化(任意・小) |
| `src/components/ImportMenu.tsx` | 起動導線追加 |
| `src/components/Timeline.tsx` | 新モーダル配線(`commitImportedPlan` 経由) |
| `src/locales/*.json` | 新 UI 文言(4言語) |

`SheetImportResult`/`commitImportedPlan`/`applyTemplateTargets`/`partyAssignment` は**再利用**(変更最小)。

---

## 7. i18n(4言語)
- 新モーダルの全文言を i18n キー化(`gridImport.*`)。英中韓で列見出し・ヘルプ・チップ・ボタン・サマリが崩れないこと。ユーモア文言も各言語自然な軽さで(直訳しない)。
- `rights_notice` を新モーダルにも表示。

---

## 8. テスト計画
- **純関数優先**(unit): `parseGridPaste`(見出し自動マッピング・位置非依存・unknown/無視・列ごと貼り)、`buildPlanFromGrid`(events/phases/labels/軽減/4言語スキル解決/未解決skip)、`resolveSheetSkill` 4言語、target 正規化、列検証関数(青/黄/灰)。
- **回帰**: 既存 `buildPlanFromSheets`/有名スプシ経路が**不変**であること(スナップショット的テスト)。
- 枠割当(4人/タンク2人手動/autoFill)。
- collab-ON でも `commitImportedPlan` 経路で前の表を引きずらない(Bug #1 回帰)。
- push 前 `npm run build`(Vercel tsc -b 厳密)+ `vitest run`([feedback_vercel_tsc_strict])。
- **実機**: 自作スプシ(member列形式)をまるごと/列ごとで取込→タイムライン反映・枠割当・対象・未解決skip をエンドユーザー視点で1回([feedback_endpoint_user_verification])。有名スプシの丸ごと取込が従来通り。

---

## 9. スコープ外/別タスク
- **攻撃名見切れマーキー**(`2026-06-22-event-or-attack-design.md` §5): 独立タスク。本 spec と無関係に実施可。
- **有名スプシ形式の新グリッドへの自動ルーティング統合/2モーダル一本化**: 将来判断(まず並立で出す)。
- **1セル複数スキル(カンマ分割)**: YAGNI。出たら追加。
- **スプシ「A or B」自動分割→altName**(event-or-attack §4): 別 follow-up。

---

## 10. 段階(実装フェーズ案)
1. 純関数(`parseGridPaste`/`buildPlanFromGrid`/4言語解決/target/検証)+ unit。
2. `SpreadsheetGridImportModal` UI(列ごと貼り付け→作成までの最小フロー)+ `commitImportedPlan` 配線 + 実機。
3. まるごと貼り付け自動検出(見出し辞書)+ unknown/無視 + チップ。
4. メンバー枠割当 UI + i18n 4言語 + 仕上げ(ユーモア文言・rights_notice)。
5. 実機総点検→ main マージ+デプロイ。
