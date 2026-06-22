# スプレッドシート軽減表 取り込み 設計書

- **日付**: 2026-06-21
- **対象**: ユーザー側の軽減表に「人気スプレッドシート軽減表」を貼り付けで丸ごと取り込む新機能
- **スコープ**: ① 人気フォーマットのスプシ（タイムライン＋軽減割り当て＋パーティ）を貼り付け→自動マッピング→確認→新しい軽減表に反映 ② 軽減を取り込まず「タイムラインだけ」取り込むトグルも提供
- **関連既存 spec**: `2026-06-20-admin-fflogs-import-design.md`（取得シーケンス・モーダル作法の前例）、`2026-06-20-fflogs-import-modes-design.md`（ユーザー側取り込みモード）
- **元要望**: ユーザー要望（2026-06-21）「有名スプシ軽減表を LoPo で使いたい。スプシ風 UI に貼り付けて取り込めないか」
- **位置づけ**: 機能アイデア⑥（有名スプシ取込）の本体。法務は「LoPo は再配布せず、ユーザーが自分の手元データを変換する道具」という立場で進める（§12）。

---

## 1. 背景・課題

### 現状（実コード）

ユーザーが自分の軽減表（`PlanData`）にデータを入れる手段は 3 つ。いずれも**タイムライン（ボス技の並び）だけ**を入れ、**軽減の割り当ては入れない**:

- **FFLogs 取り込み**（`src/components/FFLogsImportModal.tsx`、`Timeline.tsx:3910` で mount・`'timeline:import'` イベントで起動）→ `TimelineEvent[]` のみ。
- **CSV/TSV 貼り付け**（ユーザー側 `src/components/CsvImportModal.tsx`）→ `TimelineEvent[]` のみ。
- **共有プランのコピー**（`MitigationSheet.copyPlan`）→ これだけが `timelineMitigations` も含むが、他人の公開プランを丸ごと複製する経路。

→ **「スプレッドシートの軽減表（誰がいつどの軽減を撃つか込み）を自分の表に取り込む」手段が無い。**

### 軽減割り当てのデータモデル（取り込み先）

- `AppliedMitigation`（`src/types/index.ts:97-106`）: `{ id; mitigationId; time; duration; ownerId; targetId?; linkedMitigationId?; autoHidden? }`。`ownerId`/`targetId` は**パーティ枠の文字列**（`MT/ST/H1/H2/D1/D2/D3/D4`、`useMitigationStore.ts:241-249` の `INITIAL_PARTY`）。`mitigationId` はスキルの文字列 id（例 `heart_of_corundum`）。`time` は開始からの秒。
- `PlanData`（`src/types/index.ts:269-287`）: `timelineEvents: TimelineEvent[]` / `timelineMitigations: AppliedMitigation[]` / `phases: Phase[]` / `labels?: Label[]` / `partyMembers: PartyMember[]` を兄弟配列で持つ。軽減はイベントに従属せず**時刻で対応**する（FK は無い）。
- `TimelineEvent`（`src/types/index.ts:108-121`）: `{ id; time; name: LocalizedString; damageType: 'magical'|'physical'|'unavoidable'|'enrage'; damageAmount?; target?; ... }`。
- `Phase`（`:123-128`）: `{ id; name: LocalizedString; startTime; endTime }`。
- `PartyMember`（`:166-178`）: `{ id(枠); jobId: string|null; role; stats; computedValues; mode? }`。
- `Mitigation`（スキル定義、`:32-95`）: `{ id; jobId; name: LocalizedString; recast; duration; type; value; isShield?; scope?; ... }`。本体は Firestore 配信（`useMasterDataStore` 経由・`src/hooks/useSkillsData.ts` の `getMitigationsFromStore()`）、初期データは `src/data/mockData.ts` の `MITIGATIONS`。

### 取り込み先＝ユーザー側に確定する理由

軽減割り当てを保持できるのは `PlanData`（ユーザー側）だけ。管理画面テンプレ（`TemplateData`）はボス技＋フェーズ＋ラベルのみで軽減を持てない。よって本機能は**ユーザー側専用**。管理画面向けの「タイムラインだけ貼り付け」は別 spec（§11 D1）。

---

## 2. ゴール

ユーザーが**人気スプレッドシート軽減表をコピー＆ペーストするだけ**で、ボス技タイムライン・ダメージ・フェーズ・軽減割り当て・パーティ編成を**自動で**自分の軽減表に取り込めるようにする。手動の列マッピングは不要（全自動・未対応技はスキップ）。「タイムラインだけ取り込む」トグルも提供。

---

## 3. 対象スプレッドシートのフォーマット（1 種に最適化）

ユーザー確認済み: **対応するのは実質この人気フォーマット 1 種**。他フォーマットは対象外（自動マッピングが効かない）。

### 3.1 構造（ユーザー提供の実データで確認）

1 つのスプシ（コンテンツ）が**フェーズごとのタブ（シート）**に分かれる（例: `P1_ケフカ` / `P2_ゴッドケフカ` / `P3_エクスデス&カオス` / `P4_おちょくりソウル` / `P5_混沌ケフカ`）。各タブは 2 ブロックから成る:

- **(a) メタ情報ブロック（上部）**: 各列の正体を**テキスト**で持つ。重要な行:
  - **ジョブ行**: 各軽減列のジョブ名（`ナイト/戦士/暗黒騎士/ガンブレイカー/白魔道士/占星術師/学者/賢者/モンク/…/タンク`）。
  - **Skill 行**: 各軽減列のスキル名（日本語。例 `リプライザル / ランパート / ディヴァインヴェール / ハート・オブ・コランダム / 鼓舞激励の策 …`）。
  - 補助: `Assign`（対象種別 SELF/SINGLE_PARTY/RANGE_PARTY/RANGE_ENEMY…）、`Time`（効果時間秒）、`Recast`（リキャスト秒）、`Charge`、`Abillity`(oGCD フラグ) など。
- **(b) データ表（下部）**: ヘッダー `Phase / (Total Time) / Time / Action / Type / Damage(Hit/DoT/tick) / Mitigation列…`。各行 = 1 タイムラインイベント。
  - **Total Time 列** = 戦闘開始からの**通し時間**（mm:ss）。**全フェーズ共通の連続軸**。
  - **Time 列** = そのフェーズの **0 からの経過時間**（mm:ss）。
  - **Phase 列** = フェーズの細分ラベル（例 `開幕 / 真偽記憶フェーズ`）。
  - **Action 列** = 技名（日本語の愛称。例 `グランドクロス / なぞなぞマジック / もりもりサンダガ`）。
  - **Type 列** = 物理/魔法（`Physical` / `Magic` / `hide`）。
  - **Damage**: `Hit` / `DoT`（実数）/ `tick`（%）。
  - **Mitigation 各列のセル**: `TRUE` = その時刻にその軽減を使う / `FALSE`・空・`-` = 使わない。一部の列は数値（`2`/`3` = チャージ表示）や記号（`◇◇◇`/`●●●` = 特殊スキルの段階表示）。

### 3.2 貼り付け時の挙動（検証済み）

- **チェックボックスは貼り付けると `TRUE`/`FALSE` のテキストになる**（ユーザー実機で確認）。
- スプシ全選択コピーは**タブ区切り（TSV）＋改行**で届き、メタ情報ブロックとデータ表が**同一列位置**で含まれる（ユーザー実機で確認）。`<textarea>` はタブ・改行を保持する（既存 `parseTsv`＝`src/utils/templateConversions.ts:85` も `\t` 分割で同方式）。
- → **アプリは見た目でなくタブ位置（列番号）で読む**。結合セル・グループ化・フリーズは flatten されても問題ない。

### 3.3 セル種別の扱い（パーサの規約）

- 軽減列のセルが `TRUE` → その行の **Total Time** にその列の軽減を 1 個配置。
- `FALSE` / 空 / `-` → 配置しない。
- 数値（`2`/`3` 等のチャージ表示列）・記号（`◇◇◇`/`●●●`）→ **v1 では軽減使用と見なさない**（メタ情報の補助列。`TRUE` のみを「使用」とする）。実装時に列をメタ情報（Skill 行が空/特殊）で判別してスキップ。

---

## 4. スコープ（取り込む / 取り込まない）

### 4.1 取り込む

- **タイムライン**: Total Time（通し時間）→ `TimelineEvent.time`（秒）、Action → `name`、Type → `damageType`、Hit → `damageAmount`。
- **フェーズ**: Phase 列のラベル変化 → `Phase[]`（連続する同ラベル行が 1 フェーズ。`startTime` = そのフェーズ先頭行の Total Time）。
- **軽減割り当て**: `TRUE` セル → `AppliedMitigation`（`mitigationId` = 列のスキル解決結果、`ownerId` = そのジョブの枠、`time` = 行の Total Time）。
- **パーティ編成**: 全フェーズで `TRUE` が 1 つでもあるジョブ列 = 使用ジョブ → 枠割り当て（§7）。

### 4.2 取り込まない（スキップ＋一覧表示・手動代替なし）

LoPo がモデル化していない技は**取り込まず、「入らなかった技」として一覧表示**するのみ（ユーザー確認済み: 手動マッピングは無し）。

監査済みの未対応 8 技（`src/data/mockData.ts` の `MITIGATIONS` に不在、coverage 監査 2026-06-21）:
1. エクリブリウム（戦士）2. ベネディクション（白）3. ディグニティ＝クラウンロード（占・LoPo は `lady_of_crowns` のみ）4. アスペクト・ベネフィク（占）5. マニフェステーション（学）6. ペプシス（賢）7. リゾーマタ（賢）8. テンペラコート（ピクト）。

**カバレッジ: 人気シートの (ジョブ,スキル) 119 件中 約 111 件（約 93%）が LoPo で表現可能**（coverage 監査）。

### 4.3 スコープ外（別機能・§11）

- **D1**: 管理画面でも同じ貼り付け取り込み（軽減なし・タイムラインのみ）。パーサ（部品①）を共用する前提で、本機能の直後に別 spec。
- **D2**: スプシの愛称攻撃名 ↔ 後からの FFLogs 取り込みの公式名を紐づけ。**別ブレスト**（愛称↔公式名は文字類似で当たらず、時刻突合等の別設計が要る。⑧攻撃ID保持・FFLogs 再アンカーと絡む大物）。

---

## 5. アーキテクチャ（純粋関数 + ウィザード UI）

`src/lib/sheetImport/`（新規）に純粋ロジックを集約。UI と分離し独立テスト可能にする。

| 部品 | 区分 | 責務 |
|---|---|---|
| ① `parseMitigationSheet(tsv)` | 純粋 | TSV 1 枚（1 タブ分）→ 構造化。メタ情報ブロック（ジョブ行/Skill 行/Time 行）とデータ表を見つけ、`{ columns: {index, job, skillNameRaw, durationSec?}[]; rows: {phaseLabel, totalTimeSec, action, damageAmount?, damageType?, trueColumnIndexes:number[]}[] }` を返す。データ表/メタ行が見つからなければ `null`（→ UI が「全選択でコピーし直して」を出す）。 |
| ② `resolveSheetSkill(job, skillNameRaw)` | 純粋（+登録参照） | (ジョブ, スキル名) → LoPo `mitigationId` または `null`（未対応）。正規化ルール（§6）。役割共有スキルをジョブ別 id に解決。 |
| ③ `resolveImportParty(usedJobs)` | 純粋 | 使用ジョブ集合 → 枠割り当て案（`PartyMember[]` の jobId 提案）。タンク/ヒーラー/DPS をロール順で枠に割当（§7）。 |
| ④ `buildPlanFromSheets(sessions, party, options)` | 純粋 | 複数フェーズ分の解析結果＋パーティ＋スキル解決 → `{ timelineEvents; timelineMitigations; phases; partyMembers; skipped: {job, skillName}[] }`。`options.includeMitigations` で軽減/パーティを含めるか切替。 |
| ⑤ `SpreadsheetImportModal`（UI） | 改変なし新規 | マルチ貼り付けセッション→パーティ確認→プレビュー→確定。 |
| ⑥ 反映（store 適用） | 配線 | 新規プラン作成（or 5/5 時のチューザー）。`PlanData` を組み立て保存。 |

**触らない**: `useMitigationStore` の既存取り込み（`importTimelineEvents`）、`importModes.ts`、FFLogs 系。新規経路として独立追加する。

---

## 6. スキル解決と正規化（部品②）

`resolveSheetSkill(job, skillNameRaw)`: ジョブ文脈で `MITIGATIONS` の `name.ja` と突合。`null` なら未対応（スキップ）。

**正規化ルール（監査で確定）**:
1. **末尾の括弧除去**: `(最小)` / `(ダメージトリガー)` / `(星の支配者)` / `(踊りの激情0)` / `(エウクラシア・ディアグノシス)` を `(` 以降丸ごと除去してから突合。
2. **役割共有スキルのジョブ別解決**: `リプライザル`（タンク4ジョブ）・`ランパート`（タンク4）・`牽制`（近接DPS6）・`アドル`（キャスター4）は (ジョブ,名前) → ジョブ別 id（例 `reprisal_pld`/`reprisal_war`/…、`feint_mnk`/…、`addle_blm`/…）。
3. **表記ゆれエイリアス**:
   - `インプロビゼーションフィニッシュ` → `インプロビゼーション`
   - `コンジャクション・ヘリオス` → `コンジャンクション・ヘリオス`（「ン」の有無）
   - `意気軒昂の策` → `意気軒高の策`（昂/高）
   - `深謀遠慮の策` → `深謀遠慮`（「の策」付与）
4. **空欄/特殊列**: Skill 行が空・記号列はスキップ。
5. **マッチ不能**: §4.2 の 8 技を含め `null` → skipped に積む。

> エイリアス表は実装時に少数の固定マップとして持つ（`src/lib/sheetImport/skillAliases.ts`）。将来パッチで技が増減したら追記する想定。

---

## 7. パーティ / 枠の解決（部品③）

- 全フェーズで `TRUE` が 1 つ以上あるジョブ = 使用ジョブ（このフォーマットは 1 ジョブ 1 列グループ＝同ジョブ 2 枚編成は表現外。その場合は片方のみ・注記）。
- 使用ジョブをロール別に LoPo の枠へ割当: タンク → `MT`,`ST` / ヒーラー → `H1`,`H2` / DPS → `D1`〜`D4`（検出順）。
- **MT/ST など同ロール内の枠順は曖昧** → ウィザードのパーティ確認ステップで提案を見せ、ユーザーが入れ替え可能。
- `PartyMember` 反映は `jobId` を設定（`role` は job から導出）、`stats`/`computedValues` は既定値（`INITIAL_PARTY` 相当）。詳細ステータスは取り込み対象外（ユーザーが後で設定）。

---

## 8. ウィザード UX（部品⑤）

軽減表の取り込み入口（FFLogs ボタン近く、将来は「取り込み元チューザー」に統合可）から起動。

1. **モード選択**: 「軽減も取り込む（既定）」/「タイムラインだけ取り込む」トグル。後者は §7・軽減配置・パーティ確認を**スキップ**。
2. **フェーズを順に貼り付け（マルチ貼り付けセッション）**:
   - 大きな貼り付け欄に 1 タブ分を貼る → `parseMitigationSheet` で即解析 → 「✓ データ表検出／✓ スキル名 N 列認識／✓ フェーズ: 開幕,真偽記憶…／✓ 軽減 N 件」をプレビュー。失敗時は「全選択でコピーし直して」。
   - 「次のフェーズを追加」で繰り返し、全タブ（P1〜P5）を貼る。**Total Time（通し時間）で全フェーズが正しい位置に自動整列**するため貼る順序は不問。
3. **パーティ確認**（軽減取り込み時のみ）: 検出した使用ジョブ→枠割当の提案を表示、曖昧な所（MT/ST 等）を確認。
4. **プレビュー**: 「全 N フェーズ・技 N 件・軽減 N 件・パーティ M 人／入らなかった技: K 件（一覧）」。
5. **反映**（§9）。

i18n: 文言は全て i18n キー経由（`src/locales/{ja,en,ko,zh}.json`、新 prefix 例 `sheetImport.*`）。en 崩れなし。

---

## 9. 反映ロジック（部品⑥）

- **既定 = 新しい軽減表を作成**（共有プランコピーと同じ「丸ごと新規」性質）。
- そのコンテンツが **5/5（`PLAN_LIMITS.MAX_PLANS_PER_CONTENT = 5`・`src/types/firebase.ts:166`）** のとき、確定前にチューザー:
  - **(a) 今開いている表を置き換える** / **(b) 既存の表を 1 つ選んでその場で削除→新規作成** / **(c) キャンセル**。
- 全体上限 `MAX_TOTAL_PLANS = 50`（`:164`）にも配慮（超過時はメッセージ）。
- 反映後すぐ UI に出す（Optimistic、親リスト store へ伝搬・[[feedback_ui_reflects_server_state_immediately]]）。

---

## 10. データモデル・マッピング（確定）

| スプシ | → LoPo フィールド | 備考 |
|---|---|---|
| Total Time（mm:ss） | `TimelineEvent.time`（秒） | 通し時間。`mm:ss`→秒。 |
| Action（日本語） | `TimelineEvent.name` | `{ ja: action, en: action }`（愛称。後で翻訳可）。 |
| Type（Physical/Magic） | `TimelineEvent.damageType` | `physical`/`magical`。ダメージ 0 のギミック等は既定 `magical`（実装で確定）。`unavoidable`/`enrage` は本フォーマットに無いので使わない。 |
| Hit（実数） | `TimelineEvent.damageAmount` | 主被弾。DoT/tick は LoPo に対応フィールド無し→取り込まない。 |
| Phase 列 | `Phase[]`（name/startTime/endTime） | 連続同ラベル = 1 フェーズ。`startTime`=先頭 Total Time、`endTime`=次フェーズ先頭（最後は末尾+α、`ensurePhaseEndTimes` 等で補完）。 |
| TRUE セル（軽減列） | `AppliedMitigation` | `mitigationId`=列のスキル解決、`ownerId`=ジョブの枠、`time`=行 Total Time、`duration`=スキル登録の duration スナップショット。`id` 採番。 |
| 使用ジョブ | `PartyMember.jobId` | 枠割当（§7）。 |

---

## 11. スコープ外（別機能・明示）

- **D1 管理画面タイムライン取り込み**: 同じ `parseMitigationSheet`（部品①）を使い、**軽減・パーティを取り込まずタイムラインのみ**を管理画面テンプレに入れる。現状の管理画面 CSV 取り込み（`CsvImportModal`）の使いづらさ解消。本 spec のパーサを共用前提で設計し、**直後に別 spec**。
- **D2 FFLogs 攻撃名の紐づけ**: 別ブレスト（§4.3 理由）。
- **複数フォーマット対応 / Google Sheets URL 直接取得**: 対象外（ユーザーが貼る方式のみ）。

---

## 12. 法務・倫理の立場

- LoPo は**スプシ本体を同梱・再ホスト・URL 自動取得しない**。ユーザーが**自分の手元データを貼り付けて変換する道具**に徹する（CSV 取り込みと同型・再配布より明確にリスク低）。
- 取り込み画面に**「取り込む内容の権利・責任はユーザーにある」一文**を添える（i18n）。
- 任意の**出典メモ欄**（作者リスペクト）は将来検討。

---

## 13. 既存への影響

- 新規経路として独立追加。**`useMitigationStore.importTimelineEvents` / `importModes.ts` / FFLogs 系は非介入**。
- 反映は新規プラン作成（or 5/5 チューザー）で `PlanData` を組み立て、既存の保存経路（`usePlanStore` の新規作成 API）に載せる。既存プランの破壊リスクが無いよう、**置き換え/削除は明示選択時のみ**。

---

## 14. テスト方針

- **① `parseMitigationSheet` 単体**: ユーザー提供の実データ断片を fixture 化。メタ行/データ表の検出、Total Time→秒、Phase 列→境界、TRUE セル→列 index 抽出、欠損（メタ無し）→`null`、数値/記号列の無視を検証。
- **② `resolveSheetSkill` 単体**: §6 の正規化（括弧除去・役割共有のジョブ別解決・エイリアス4種）と未対応 8 技→`null` を表駆動で検証。**監査で確定した 111/119 マッチを回帰固定**。
- **③ `resolveImportParty` 単体**: タンク/ヒーラー/DPS の枠割当、同ロール順、同ジョブ重複時の挙動。
- **④ `buildPlanFromSheets` 単体**: 複数フェーズ結合（Total Time 整列）、`includeMitigations` ON/OFF、skipped 集計、`AppliedMitigation`/`Phase`/`PartyMember` の組み立て一致。
- **UI（⑤）**: 重い UI 駆動テストは置かない（vmThreads ハング回避・[[reference_vitest_vmthreads_hang]]）。実機確認＋①〜④の純粋関数テストで担保。
- vitest は `pool='vmThreads'` 維持。push 前 `npm run build`（tsc -b 厳密・[[feedback_vercel_tsc_strict]]）。

---

## 15. リスク・実装時に確認する点

- **フォーマット依存**: 人気シートの将来パッチで列構成・スキル名が変わるとマッチ低下。メタ情報（Skill 行）をその場で読む方式なので、列ズレには強いが新規スキル名はエイリアス追記が要る。
- **同時刻イベント**（`なぞなぞマジック/もりもりサンダガ/ひろげるブリザガ` が同 Total Time）→ 複数 `TimelineEvent` を同時刻に許容できるか実装時確認（既存の同時刻上限・[[reference_timeline_transformation_icon]] 周辺）。
- **ダメージ 0 ギミックの damageType 既定値**を実装で確定（`magical` 仮）。
- **Total Time 列の特定**: メタ行ラベル「Total Time」で識別。無い変種は `Time`+フェーズ offset にフォールバック（v1 は Total Time 前提・無ければ警告）。
- **`◇◇◇`/`●●●`・数値チャージ列**の判別ロジック（Skill 行の内容で軽減列か補助列かを切り分け）。
- **パーティ stats 既定**: 取り込みは jobId のみ設定、ステータスは既定。ユーザーが後で設定する前提で良いか実機確認。

---

## 16. Self-Review（設計者点検）

- **Placeholder scan**: TBD/TODO/「適切に」等なし。未確定点は §15 に「実装時確認」として明示。
- **整合性**: §4 取り込み項目 ↔ §10 マッピング ↔ §14 テストが一致。部品①〜⑥の入出力が §5 表と §3〜§9 で整合。
- **スコープ**: 単一機能（ユーザー側スプシ取り込み）に集中。D1/D2 は §11 で分離。実装計画（writing-plans）で部品①→②→③→④→⑤→⑥のタスク分割が自然。
- **曖昧さ**: 枠割当の同ロール順・damageType 既定・特殊列無視を明示。残りは §15 で実装時確認に降ろした。
