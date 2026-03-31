# セッション引き継ぎ書（2026-03-31 第63セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### 過去の失敗パターン（繰り返さないこと）
- **設計書を読まずにバグ修正に飛びつく**
- **Skillを使わずに実装を始める**
- **`replace_all` で意図しない箇所まで置換してしまう**
- **Zustandストア内でハードコーディングした日本語メッセージ**
- **backdrop-filterを直書きする（Lightning CSSに削除される）→ TECH_NOTES.md参照**
- **glass-tier3の`!important`を無視してTailwindクラスで上書きしようとする**
- **authDomainをlopoly.appに直接変更する（Firebase Hostingのハンドラーが必要）→ auth.lopoly.appを使う**
- **Vercel環境変数を`echo`でパイプしない** — `printf`か`--value`フラグを使う
- **`require()`をAPI関数内で使わない** — ESモジュールバンドルで`require is not defined`になる
- **編集のたびにFirestoreに同期しない** — イベント駆動+定期バックアップが正しい設計
- **useShallowでConsolidatedHeaderのmyJobHighlightをまとめると再レンダリングが阻害される** — 個別セレクタを使う
- **Ctrl+Shift+Zのe.keyは大文字'Z'** — toLowerCase()を使う

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand 5 + Firebase + Vercel
- **Discord**: https://discord.gg/z7uypbJSnN
- **公式X**: https://x.com/lopoly_app
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第63セッション）で完了したこと

### βテストフィードバック対応 第2弾（全て本番デプロイ済み）

**1. コントロールバーのアイコン配置見直し**
- チートシートボタンをMitiPlannerPage.tsxのフローティングUIからコントロールバーArea C（罫線エリア）に移動
- ボタンは無効化状態（disabled + opacity-40）。ツールチップ: JA「もうちょっと待ってね」/ EN「Maybe someday」
- MitiPlannerPage.tsxからviewMode state、CheatSheetView import、ビュー切り替えUI一式を削除
- CheatSheetView.tsxコンポーネント自体は将来再利用のため残置
- 変更: `MitiPlannerPage.tsx`, `Timeline.tsx`, `ja.json`, `en.json`

**2. AA設定ボタンのスタイル修正**
- 黒塗りベタ→白背景+黒ボーダーのアウトライン、ホバーで色反転に変更
- disabled状態も同様にアウトラインスタイルに
- 変更: `AASettingsPopover.tsx`

**3. コピートーストのスタイル統一+ESC対応**
- 黒背景トースト→他のトーストと同じスタイル（bg-app-bg, border-app-text/15, rounded-2xl, shadow）に統一
- テキスト色をtext-app-text / text-app-text-mutedに変更
- ×ボタンもテーマに合わせた色に
- ESCキーでクリップボードモードをキャンセルするuseEffect追加
- 変更: `Timeline.tsx`

**4. キーボードショートカット追加**
- Layout.tsxにグローバルキーボードショートカットを実装
  - `S`: サイドバー開閉（handleToggleSidebar呼び出し）
  - `H`: ヘッダー開閉（isHeaderCollapsed切り替え）
  - `P`: パーティ編成モーダル開閉（カスタムイベント`shortcut:party`経由）
  - `F`: フォーカスモード（サイドバー+ヘッダー両方非表示。再押下で元の状態に復元）
- INPUT/TEXTAREA/SELECT内、Ctrl/Meta/Alt組み合わせ時は無視
- フォーカスモードは進入前の状態をrefで記憶して復元
- PCのみ動作（isMobileチェック）
- Timeline.tsxで`shortcut:party`イベントをリッスンしてpartySettingsOpenLocalをトグル
- 変更: `Layout.tsx`, `Timeline.tsx`

**5. シリーズ一括選択（まとめて共有の強化）**
- SeriesAccordionにmultiSelectモード時のチェックボックスを追加
- チェックボックスはシリーズ名ボタンの内部に配置（行全体がクリック判定）
- クリックで各floorの1番目のプランを自動選択/解除
- 全選択→CheckSquare、一部選択→CheckSquare(opacity-50)、未選択→Square
- 共有モード時の10件制限も考慮
- Sidebar.tsxにtoggleSeriesSelect関数を追加、CategoryAccordion→SeriesAccordionへprop中継
- 変更: `Sidebar.tsx`

**6. ツールチップのテーマ配色統一**
- tooltip-invertクラスを削除し、ダークモードでダーク配色/ライトモードでライト配色に変更
- glass-tier3のデフォルトスタイルがそのまま適用される
- text-app-textでテキスト色をテーマに合わせる
- 変更: `Tooltip.tsx`

---

## βテストフィードバック 残タスク

### 未着手（設計から必要な大タスク）
1. **チュートリアル全面刷新** — 短い個別チュートリアルに分割。指アイコン方式に統一。戻るボタン廃止
2. **チュートリアル構成の見直し** — 攻撃追加ステップの要否、ユーザーストーリー再設計

### 継続検討（方針未確定）
- FFLogsアイコン案、チートシートMTST分け、フェーズなしコンテンツ、テンプレート日本語攻撃名、みんなの軽減表、軽減選択モーダル画面サイズ

---

## 次セッションの優先タスク

### 1. チュートリアル刷新（大タスク）
- 設計から入る必要あり。brainstorming → writing-plans → 実装の流れ
- βテストフィードバックの主要な残タスク

### 2. feature/pretext-lpブランチの整理
- 不採用が確定しているのでブランチ削除を検討

### 3. 継続検討タスクの方針決め

---

## 重要な技術的注意（前セッションから引き続き）

- **Vercel関数**: 現在7/12。新規APIは既存ルーターに統合する方式
- **API URLパターン**: `/api/admin?resource=xxx`, `/api/auth?provider=xxx`, `/api/template?action=xxx`, `/api/share?type=page`
- **管理者curlコマンド**: `curl -X POST "https://lopoly.app/api/admin?resource=role" ...`
- **ENFORCE_APP_CHECK=true が本番で有効** — 全APIでverifyAppCheckを維持
- **OAuthコールバックURL**: Discord=`/api/auth?provider=discord`, Twitter=`/api/auth?provider=twitter`
- **Cookieパス**: 統合後は `/api/auth`
- **LoPo管理マニュアル**: `C:\Users\masay\Desktop\LoPo管理マニュアル\` — 全シークレット含む（git外）
- **キーボードショートカット**: S(サイドバー), H(ヘッダー), P(パーティ), F(フォーカスモード) — Layout.tsxで実装

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Upstash Redis: `lopo-rate-limit` (us-east-1, 無料プラン)
