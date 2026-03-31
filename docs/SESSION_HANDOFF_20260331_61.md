# セッション引き継ぎ書（2026-03-31 第61セッション）

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

## 今回のセッション（第61セッション）で完了したこと

### 管理画面ウィザードファースト刷新（全11タスク完了＋本番デプロイ）

「記憶ゼロ・知識ゼロでも確実に操作できる」ウィザードファーストUIへの全面刷新。

**新規作成（10ファイル）:**
- `src/components/admin/wizard/useWizard.ts` — ウィザード状態管理フック
- `src/components/admin/wizard/AdminWizard.tsx` — 共通ウィザードUIコンポーネント
- `src/components/admin/wizard/ContentWizard.tsx` — コンテンツ追加ウィザード（8ステップ）
- `src/components/admin/wizard/TemplateWizard.tsx` — テンプレート登録ウィザード（3分岐: FFLogs/プラン/JSON）
- `src/components/admin/wizard/SkillWizard.tsx` — スキル追加ウィザード（14ステップ+特殊動作チェック）
- `src/components/admin/wizard/SkillEditWizard.tsx` — スキル編集ウィザード（一括フォーム）
- `src/components/admin/wizard/JobWizard.tsx` — ジョブ追加ウィザード（5ステップ）
- `src/components/admin/wizard/StatsWizard.tsx` — ステータス更新ウィザード（3分岐）
- `src/components/admin/AdminBackups.tsx` — バックアップ復元画面
- `src/components/admin/AdminLogs.tsx` — 監査ログ閲覧画面

**変更（5ファイル）:**
- `src/components/admin/AdminDashboard.tsx` — アクションカード6枚＋最近の変更＋復元リンク
- `src/components/admin/AdminLayout.tsx` — ナビにbackups/logsリンク追加
- `src/App.tsx` — 8ルート追加（content-wizard, template-wizard, skill-wizard, skill-edit, job-wizard, stats-wizard, backups, logs）
- `api/admin/_templatesHandler.ts` — backups一覧/restore/logs閲覧API追加
- `src/locales/ja.json` + `en.json` — 149 i18nキー追加

---

## βテストフィードバック（第61セッション受領、TODO.mdに詳細記載済み）

友人テスターから大量のフィードバックを受領。以下の3カテゴリに整理済み:

### 1. チュートリアル刷新（方針確定）
**方針**: 現25ステップを短い個別チュートリアルに分割。戻るボタンは廃止。
- STEP2/3: マウス移動やボタン押下で画面がピクピク動く
- STEP11: 「見てね」と「押してね」の見た目が同じで迷う → 区別を明確に
- STEP17/18: 数字入力が面倒 → コピーアイコンorクリックのみ進行
- STEP21→20戻り不能バグ → 戻りボタン自体を廃止して解決
- チュートリアル構成: 攻撃追加ステップは不要or最後に移動（テンプレート使用ユーザーが多い）

### 2. メイン画面UI改善（優先度高）
- サイドバー格納時のマウス追従アニメーションがうっとおしい
- 軽減自動組み立て: PT未編成時に案内メッセージが必要
- コンパクト表示をデフォルトに変更
- コントロールバーのアイコン配置見直し（何のアイコンか分からない）
- 軽減選択モーダルが小画面で押せない位置に出る
- 軽減配置時の日本語表現が分かりにくい
- リキャスト被り表示の改善
- 最小フォントサイズ見直し（基本12px以上）
- コピースタンプ中のHoverメッセージ改善
- ヘビー級1-4層まとめ共有機能

### 3. 継続検討（方針未確定）
- FFLogsボタンにFFLogsアイコン採用案
- チートシートの存廃・MTST分けの是非
- フェーズ無しコンテンツのスペース最適化
- テンプレートの日本語攻撃名（logs精度問題あり）

---

## 次セッションの優先タスク

### 1. βテストフィードバック対応（最優先）
- TODO.mdの「βテストフィードバック」セクション参照
- 即修正できるもの（モーダル位置、フォントサイズ、Hoverメッセージ等）から着手推奨
- チュートリアル刷新は設計から入る必要あり

### 2. feature/pretext-lpブランチの整理
- 不採用が確定しているのでブランチ削除を検討

---

## 重要な技術的注意（前セッションから引き続き）

- **Vercel関数**: 現在7/12。新規APIは既存ルーターに統合する方式
- **API URLパターン**: `/api/admin?resource=xxx`, `/api/auth?provider=xxx`, `/api/template?action=xxx`, `/api/share?type=page`
- **管理者curlコマンド**: `curl -X POST "https://lopoly.app/api/admin?resource=role" ...`
- **ENFORCE_APP_CHECK=true が本番で有効** — 全APIでverifyAppCheckを維持
- **OAuthコールバックURL**: Discord=`/api/auth?provider=discord`, Twitter=`/api/auth?provider=twitter`
- **Cookieパス**: 統合後は `/api/auth`
- **LoPo管理マニュアル**: `C:\Users\masay\Desktop\LoPo管理マニュアル\` — 全シークレット含む（git外）

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Upstash Redis: `lopo-rate-limit` (us-east-1, 無料プラン)
