# 設計書: スプシ取込で攻撃に「対象(MT/ST)」をテンプレから引き継ぐ (取込v2 ブラッシュアップ③)

- 日付: 2026-06-23
- 親タスク: 取込フロー v2 本番前ブラッシュアップ ③ (詳細メモ `docs/.private/2026-06-23-import-flow-v2-brushup.md` ③)
- 関連: ①誘導型ウィザード(本番済・取込先 `contentId` が選べる) / 既存のスキル名解決 `resolveSheetSkill`(前例パターン)
- ブランチ方針: 新規 `feat/...` を main から切る(①は本番マージ済)。仕上げ後 merge+push。

## 1. 背景・目的

スプシ取込で作る攻撃イベントは **対象(target) を持たない** ([buildPlanFromSheets.ts:32-38](src/lib/sheetImport/buildPlanFromSheets.ts#L32) は id/time/name/damageType/damageAmount のみ設定)。一方、管理画面で作る **テンプレ(`TemplateData`)** の攻撃は target を持てる ([types/index.ts:115](src/types/index.ts#L115) `target?: 'AoE' | 'MT' | 'ST'` / [TemplateEditor.tsx:381](src/components/admin/TemplateEditor.tsx#L381) に対象列)。FFLogs 取込はログ実データの被弾者から target を入れる ([fflogsMapper.ts](src/utils/fflogsMapper.ts)) が、スプシ取込には機構が無い。

目的: 取込先コンテンツに**管理者が作ったテンプレが在るとき**、攻撃名でマッチさせ、テンプレの **target だけ**をスプシ取込イベントへ引き継ぐ。**誤マッチは有害**(タンバスの MT/ST を別の技に誤付け=誤誘導)なので**精度優先**。

## 2. 確定した設計判断 (brainstorming 2026-06-23)

| # | 判断 |
|---|---|
| 土台 | **(A) テンプレ既存 `name.ja` と正規化照合 + スプシ別名**。(B) 全手入力単独は不採用(運用が重い) |
| マッチ精度 | **正規化(括弧除去/全半角 NFKC/空白吸収)後の完全一致 + 別名一致のみ**。**編集距離の曖昧一致はやらない**(誤マッチ有害)。「近い名前」は ①正規化の自動吸収 ②管理画面で登録するスプシ別名 の2段で安全に拾う |
| 引き継ぐ範囲 | **target のみ**(AoE/MT/ST)。name/damage/altName/time 等は引き継がない(スプシ側不変・空欄 target を埋めるだけ) |
| 条件 | 取込先 `contentId` のテンプレが在るときだけ。無ければ/未マッチは **target 空のまま**(既存挙動を壊さない) |
| 衝突 | 同名で target 食い違いの稀ケース → 時刻近傍の候補。決まらねば空(推測で付けない) |
| 管理確認 | TemplateEditor に **「スプシ表記」列(任意・複数可)** + **「対象マッチ確認」**(標準スプシ貼付→ヒット/未マッチ一覧)。照合は**取込時と同一関数**(DRY=管理画面で見た結果と本番取込結果が一致) |
| 上書き | スプシ取込イベントは target を持たない → 補完は「**target が空のときだけ**」(将来 target を持つ経路への保険) |

## 3. データモデル

- `TimelineEvent` に**任意フィールド追加**: `sheetAliases?: string[]`(スプシでの表記ゆれ。実際にはテンプレ攻撃のみ使用・ユーザープランでは未使用)。[types/index.ts](src/types/index.ts) に `altName?` を足したのと**同じ後方互換パターン**。
  - 検討した代替: `TemplateData` 側の side-map(`Record<eventId, string[]>`)。却下理由 = TemplateEditor は `timelineEvents` を map して各行の field を直接編集・保存する構造のため、**event 上に field を置く方が編集も永続化も素直**。optional なのでユーザープラン側は無害。
- `target` 自体は既存 `TimelineEvent.target`(`'AoE'|'MT'|'ST'`) を流用(型追加なし)。

## 4. マッチ・引き継ぎ (純粋関数・新規)

新規 `src/lib/sheetImport/carryOverTargets.ts`(純粋・UIから分離してユニットテスト。`importBlockReason.ts`/`importWizard.ts` と同じ流儀):

- `normalizeAttackName(s: string): string` — ①括弧(全角/半角)以降を除去([resolveSheetSkill.ts:5](src/lib/sheetImport/resolveSheetSkill.ts#L5) `stripParenthetical` を共有化 or 流用) ②`String.prototype.normalize('NFKC')`(全半角統一) ③空白除去 ④trim。
- `matchTemplateTarget(actionName: string, time: number, templateEvents: TimelineEvent[]): 'AoE'|'MT'|'ST'|undefined`
  - 候補 = `templateEvents` のうち `normalizeAttackName(name.ja) === normalizeAttackName(actionName)` **または** `normalizeAttackName(actionName)` が `sheetAliases` の正規化集合に含まれるもの。
  - 候補の **target が undefined のものは無視**。
  - 残った候補の target が **1種なら確定**。**複数種**なら `time` が最も近い候補の target。なお決まらねば(全候補等距離で食い違い等) `undefined`。
- `applyTargetsFromTemplate(events: TimelineEvent[], templateEvents: TimelineEvent[]): TimelineEvent[]`
  - 各 event について、`event.target` が**空のときだけ** `matchTemplateTarget(event.name.ja, event.time, templateEvents)` を呼び、返れば `{ ...event, target }` に補完。一致しなければ event はそのまま。
  - 入力 events は非破壊(新配列)。

## 5. 取込フローへの配線

- ①ウィザードの `handleConfirm`([SpreadsheetImportModal.tsx](src/components/SpreadsheetImportModal.tsx)・既に `async`・`selectedContentId` を持つ)で、`buildPlanFromSheets` で `result` を作った**後**:
  1. `selectedContentId` が非 null なら `fetchTemplate(selectedContentId)`([useMasterData.ts:177](src/hooks/useMasterData.ts#L177)・async/キャッシュ有) を await。
  2. template が在れば `result.timelineEvents = applyTargetsFromTemplate(result.timelineEvents, template.timelineEvents)`。
  3. `onImport(result, { contentId })`。
- `contentId` null / template null / fetch 失敗 → **スキップ**(result そのまま=既存挙動)。fetch 失敗は握って続行(取込自体は止めない)。
- 既存 parse/build ロジックは**不変**。target 付与は**後段の独立関数**で足すだけ。
- 配線の正確な位置(handleConfirm 内 vs onImport 実体 `handleSheetImport`)は実装計画で最終確定。`handleConfirm` が contentId と async を既に持つため第一候補。

## 6. 管理画面 (TemplateEditor)

- **新規列「スプシ表記」(`sheetAliases`)**: 各技行に、スプシでどう書かれるかを登録(複数可・**カンマ/改行区切りの text 入力** → `string[]` に正規化。空可)。`name.ja`(公式名・ユーザー表示用)は不変に保つ。永続化は既存テンプレ保存経路(`templates/{contentId}`)に乗る(field 追加のみ)。
- **新規「対象マッチ確認」パネル**: ツールバーのボタンで開閉。textarea に標準スプシを貼付 → `parseMitigationSheet`([parseMitigationSheet.ts](src/lib/sheetImport/parseMitigationSheet.ts)) → 各 unique action を `matchTemplateTarget` で照合 → 一覧表示:
  - スプシ action → 「**✓ {テンプレ技名} / 対象 {MT}**」 or 「**✗ 未マッチ**」。
  - (任意) テンプレ側で target を持つのにスプシ未ヒットの技 = カバレッジ欠落として別枠表示。
  - ズレてたら**対象列を直す or スプシ表記を足して再確認**(同一画面で反復)。
- 照合は §4 と**同一関数**。i18n は admin.* キーで 4 言語。

## 7. テスト

- `carryOverTargets` ユニット(`__tests__/carryOverTargets.test.ts`):
  - 正規化一致(括弧/全半角/空白) / 別名一致 / 同名で target 1種→確定 / 同名で target 食い違い→時刻近傍 / 未マッチ→undefined / target undefined 候補は無視 / 既に target 持つ event は上書きしない。
- 配線: contentId 有+テンプレ有 → 該当 event の target が補完される / contentId null → スキップ(events 不変)。
- 管理プレビュー: 代表ケースのレンダー(ヒット行/未マッチ行の表示・別名追加で再照合)。
- push 前ゲート: `npm run build`(tsc -b 厳密) + `vitest run`([[feedback_vercel_tsc_strict]])。

## 8. スコープ外 (繰り越し)

- **編集距離の曖昧一致**(やらない=精度優先。近い名前は正規化+別名で吸収)。
- target 以外の引き継ぎ(name/damage/altName/time)。
- スプシ "A or B" 自動分割→altName(別タスク・event-or-attack spec §4)。
- ユーザー側でのマッチ結果プレビュー(ユーザーは EventForm で個別修正可=既存)。
- 攻撃名見切れマーキー(別タスク・event-or-attack spec §5)。

## 9. 完了条件

- テンプレが在る取込で、標準スプシのタンバスに **MT/ST が入る**。**誤マッチ無し**(自信が無ければ空)。
- 管理画面で**マッチ確認・別名修正**ができ、**確認結果 = 本番取込結果**(同一関数)。
- 既存取込挙動・既存テンプレ機能は不変。tsc0 / build 成功 / テスト緑。
- エンドユーザー視点で実機 1 回([[feedback_endpoint_user_verification]]): テンプレ有コンテンツでスプシ取込→対象が入る／テンプレ無で従来通り。OK で merge+push。
