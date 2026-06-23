# 設計書: スプシ取込モーダルを「誘導型ウィザード」化 (取込フロー v2 ブラッシュアップ①)

- 日付: 2026-06-23
- 対象: `src/components/SpreadsheetImportModal.tsx`
- 親タスク: 取込フロー v2 本番前ブラッシュアップ (詳細メモ `docs/.private/2026-06-23-import-flow-v2-brushup.md` ①)
- ブランチ: `feat/import-flow-v2-phase1` に積む (仕上げ後 merge+push = 本番自動デプロイ)

## 1. 背景・目的

現状の `SpreadsheetImportModal` は 1 本の縦スクロールに [取り込み先コンテンツ / モード / フェーズ名+貼り付け+追加 / 追加済みリスト / パーティ割当 / プレビュー / 作成] を全部並べている。スプレッドシートに不慣れなユーザーが多く、**次に何をすればいいか迷う**のが課題。

目的: **段階を「次へ」で進めるウィザード化**し、各ステップで「今やる事」だけを見せ、貼り付け方法を手順化し、貼った後の次アクションを明示して、迷いを最小化する。

YAGNI: 機能ロジック (parse / build / party 割当 / ブロック判定) は一切変えない。**presentation の作り直し + ステップ遷移制御 + i18n 追加**に限定する。

## 2. 確定した設計判断 (brainstorming 2026-06-23)

| # | 判断 |
|---|---|
| 型 | **A: フルウィザード** (1 画面 1 ステップ・「次へ／戻る」)。B 誘導付きスクロール / C 2 ステップは不採用 |
| ステップ数 | **4 ステップ** = ③パーティが出るのは「軽減も かつ ジョブ検出時」のみ。「タイムラインだけ」または「ジョブ未検出」は ③ を飛ばして **3 ステップ** (正確なルールは §3/§5 の `hasPartyStep`) |
| 貼り方ガイド | **常時表示** (開閉式にしない) |
| フェーズ名 | **任意** (空なら自動で `Phase N`)。今の「名前必須」をやめる |
| 入力の並び | **フェーズ名 → 貼り付け** (現状どおり) |
| ④確認 | **文字サマリ + 取り込めなかった技** のみ (実テーブルプレビューは足さない) |

## 3. ステップ仕様

ウィザードは内部状態 `step: 1 | 2 | 3 | 4` を持つ。各ステップの本体だけをレンダリングし、共通フッターで遷移する。**既存の state (selLevel/selCategory/selBoss/selTitle/includeMitigations/draft/phaseName/entries/assignment/parseError) はそのまま維持**し、表示の出し分けだけ行う。

### Step 1: 設定
- 内容: 取り込み先コンテンツ (Lv → 種別 → ボス or 自由入力タイトル) + モード (軽減も / タイムラインだけ)。**現状の Step 0 + Step 1 をそのまま 1 画面に**。
- 初期選択: 現状どおり「開いた瞬間のみ」`resolveInitialSelection(defaultSelectionRef.current)` で復元 (dep=[isOpen]+ref。再選択巻き戻りバグの根治を維持)。
- 遷移ゲート: **常に「次へ」可能** (コンテンツ未選択でも contentId=null で取込可・モードは既定 `軽減も`=true)。
- フッター: 左 `キャンセル` (= handleClose) / 右 `次へ →（貼り付け）`。**①には「戻る」を置かない**。

### Step 2: フェーズを貼り付け (主役・ループ)
- 貼り方ガイド (常時表示・新規): タイトル + 4 手順チップ「① A1セルをクリック / ② Ctrl+A で全選択 / ③ Ctrl+C でコピー / ④ 下の枠に Ctrl+V」。
- フェーズ名 input (任意) → 貼り付け textarea → `＋ このフェーズを追加`。
- **「追加」ボタンの活性条件を変更**: 現状 `draft.trim() && phaseName.trim()` → **`draft.trim()` のみ** (名前任意化)。
- **空名の実体化 (重要)**: `handleAddPhase` で `phaseName.trim()` が空なら、entry に `Phase ${entries.length + 1}` を実値として入れる。理由: [buildPlanFromSheets.ts:46](src/lib/sheetImport/buildPlanFromSheets.ts#L46) は `name:{ja:s.phaseName, en:s.phaseName}` をそのまま使うため、空のままだと**生成プランのフェーズ名が空**になる (モーダル表示の `Phase N` フォールバックは表示専用)。
- 追加済みリスト: 各フェーズを `✓ {名前} — 技{events}/軽減{mits}` で表示 (現状の `detected_phase` を踏襲)。
- 次アクション誘導 (新規): 1 件以上追加されたら「次のフェーズがあれば同じ手順でもう1枚。無ければ次へ。」を表示。
- 遷移ゲート (黄/赤の移植):
  - 追加 0 件 → 「次へ」disabled。
  - 貼り付け欄に未追加 draft が残る (`hasPendingDraft`) → 「次へ」を止め、**黄 `pending_draft_warning`** をその場に表示。
  - 上記クリアで「次へ」可能。
- フッター: 左 `← 戻る` / 右 `次へ →（パーティ割当 or 確認）`。行き先ラベルは次ステップに応じて動的。

### Step 3: パーティ割当 (条件付き)
- **表示条件**: `includeMitigations && detectedJobIds.length > 0` のときだけ存在するステップ。条件を満たさない (タイムラインだけ / ジョブ未検出) 場合は **Step 2 → Step 4 に自動スキップ** (進捗ドットも 3 個になる)。
- 内容: 現状のパーティ割当 UI (MT〜D4 へ検出ジョブを割当・`autoFillSingles`/`isSlotRequired` の挙動を維持)。
- 遷移ゲート: `isAssignmentComplete` が false → 「次へ」disabled + **赤 `party_required_warning`**。
- フッター: 左 `← 戻る` / 右 `次へ →（確認）`。

### Step 4: 確認して作成
- 内容: 現状の Preview ブロック (文字サマリ `preview_summary` + 取り込めなかった技 `skipped_label` details) + 権利注意 `rights_notice`。
- 確定アクション: `handleConfirm` (= `buildPlanFromSheets` → `onImport(result, {contentId})` → 成功で `handleClose`)。ロジック不変。
- フッター: 左 `← 戻る` / 右 `✓ この内容で作成`（`confirm` ラベル）。`canConfirm` 相当が満たされていれば活性。

## 4. ウィザード chrome

- 進捗インジケータ: ヘッダー右に進捗ドット (現ステップを強調)。総数はモードで 4 or 3。各ステップにタイトル (`① 設定` 等)。
- 戻る/次へ/キャンセル/作成: 上記フッター規約。`useEscapeClose` は維持 (Esc で閉じる)。
- スマホ: コンテナは現状の `max-w-lg` / `max-h-[90vh]` を維持。各ステップが短くなるため縦スクロールはむしろ減る。専用のスマホ分岐は不要。
- ステップ移動時の縦位置: 各ステップ表示時にスクロール位置を先頭へ (フォーカスが「今やる事」に乗る)。

## 5. 状態遷移ロジック (擬似)

```
canNext(step):
  1 → true
  2 → entries.length>0 && !hasPendingDraft
  3 → isAssignmentComplete(assignment, detectedByRole)
goNext(step):
  from 1 → 2
  from 2 → hasPartyStep ? 3 : 4      // hasPartyStep = includeMitigations && detectedJobIds.length>0
  from 3 → 4
goBack(step):
  from 4 → hasPartyStep ? 3 : 2
  from 3 → 2
  from 2 → 1
```

- `hasPartyStep` が false に変わる操作 (モードをタイムラインだけに変更等) は Step 1 でのみ起こるので、Step 3 滞在中に消えるレースは無い。万一 entries 変更で detectedJobIds が変わり Step 3 が無効化される場合は、`goNext`/表示時に step を 4 にクランプする防御を入れる。

## 6. i18n (4 言語・新規/変更キー)

`src/locales/{ja,en,ko,zh}.json` の `sheetImport` に追加・変更。

- 変更: `paste_label` を手順前提の短文へ (例 ja「下の枠に貼り付け (Ctrl+V)」)。
- 新規 (貼り方ガイド):
  - `howto_title`: ja「貼り方（スプレッドシート）」/ en「How to paste (spreadsheet)」/ ko「붙여넣는 방법 (스프레드시트)」/ zh「粘贴方法（电子表格）」
  - `howto_step1`: ja「A1セルをクリック」/ en「Click cell A1」/ ko「A1 셀 클릭」/ zh「点击 A1 单元格」
  - `howto_step2`: ja「Ctrl+A で全選択」/ en「Ctrl+A to select all」/ ko「Ctrl+A 전체 선택」/ zh「Ctrl+A 全选」
  - `howto_step3`: ja「Ctrl+C でコピー」/ en「Ctrl+C to copy」/ ko「Ctrl+C 복사」/ zh「Ctrl+C 复制」
  - `howto_step4`: ja「下の枠に Ctrl+V」/ en「Ctrl+V into the box below」/ ko「아래 칸에 Ctrl+V」/ zh「在下方框中 Ctrl+V」
  - `howto_mac_note` (任意・小さく): ja「Mac は ⌘（Command）」/ en「On Mac use ⌘ (Command)」/ ko「Mac은 ⌘」/ zh「Mac 使用 ⌘」
- 新規 (誘導文・ナビ):
  - `wizard_next`: 「次へ」/ `wizard_back`: 「戻る」
  - `next_to_paste`/`next_to_party`/`next_to_confirm`: 行き先付き「次へ」ラベル (例 ja「次へ（貼り付け）」「次へ（パーティ割当）」「次へ（確認）」)
  - `add_more_or_next`: ja「次のフェーズがあれば同じ手順でもう1枚。無ければ次へ。」(+ en/ko/zh)
  - `step_title_setup`/`step_title_paste`/`step_title_party`/`step_title_confirm` (進捗ヘッダー用)
- `phase_name_label` は「（任意）」を含意する文言へ微調整 (例 ja「フェーズ名（任意・空なら自動）」)。

i18n ルール厳守 (`.claude/rules/i18n.md`): ハードコード禁止・英語崩れ確認。ko/zh は ja を一次として自然な訳に。

## 7. 実装方針

- **既存 `SpreadsheetImportModal.tsx` のリファクタ**として実装 (新規コンポーネント乱立を避ける)。肥大化するなら各ステップ本体を内部サブコンポーネント (`Step1Setup` 等) かファイル分割に切り出す ([[feedback_code_quality]] ファイル分割・トークン経由)。
- 既存ロジック・hook (`parseMitigationSheet` / `buildPlanFromSheets` / `partyAssignment` / `importBlockReason` / `detectUsedJobIds` / `useEscapeClose`) は**再利用**。`importBlockReason` は「次へ」ゲートの理由表示にそのまま流用可。
- デザイン: 既存 LoPo UI ルール (白黒 + 機能色のみ。青=進む/OK・黄=警告・赤=危険) に準拠 ([.claude/rules/ui-design.md])。AI 風グラデ/Inter 禁止。トークン (`--color-*`/`--font-size-*`/`glass-tier3`) 経由。モックの青系は既存 `app-toggle`/機能色で表現。
- アニメ: ステップ切替は framer-motion で軽い横スライド or フェード (100–200ms)。既存のモーダル開閉アニメは維持。

## 8. テスト

- 既存テストへの影響を確認 (`SpreadsheetImportModal` 関連テストがあれば追従)。
- 追加: ウィザード遷移のユニット/コンポーネントテスト
  - Step1→2→(3)→4 の前進・後退、`hasPartyStep` による 3 スキップ。
  - Step2 ゲート: 0 件 disabled / pending draft で黄 / クリアで活性。
  - 名前任意: 空名で追加 → entry 名が `Phase N` 実体化 → 生成プランのフェーズ名が空でない。
  - Step3 ゲート: 未割当で赤・disabled / 完了で活性。
  - タイムラインだけ: 3 ステップで完走。
- push 前ゲート: `npm run build` (tsc -b 厳密) + `vitest run` 必須 ([[feedback_vercel_tsc_strict]])。

## 9. スコープ外 (繰り越し)

- **③ 攻撃の対象 (MT/ST) をテンプレから持ち越し**: 別 spec で brainstorming (本ブラッシュアップの次項)。
- **② プレビュー画像**: 検証完了済 = 本番 OK 確定 (別件・対応不要)。
- **途中取込 (spec §7)**: 取込フロー v2 後半・別タスク。
- 取り込み導線チューザー統合 (将来)。

## 10. 完了条件

- 4/3 ステップのウィザードが実機で迷わず完走 (軽減も / タイムラインだけ 両経路)。
- 貼り方ガイド常時表示・名前任意・空名で `Phase N` 実体化・黄/赤ゲート移植。
- 4 言語で表示崩れなし。tsc 0 / build 成功 / 対象テスト緑。
- エンドユーザー視点で実機 1 回通す ([[feedback_endpoint_user_verification]]) → OK で merge+push。
