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

友人テスターから大量のフィードバックを受領。ユーザーと認識合わせ済み。

### 1. サイドバー・ヘッダーの展開ハンドル
- マウス近づき/ホバーで広がる挙動がチュートリアル中もメイン画面でもストレス → 動き自体を削除

### 2. チュートリアル刷新（方針確定）
**方針**: 短い個別チュートリアルに分割。戻るボタン廃止。
- **アピール方法統一**: パルスではなく、押させたい要素のそばに指アイコンを直接出してアニメーション。視認性UP＋実装しやすい
- 「見てね」のタイミングはそもそも不要かも。「押してね」だけにする
- 入力ステップ: コピーアイコンでワンクリック or クリックのみで進行
- 戻り不能バグ → 刷新で戻りボタン自体を廃止
- 構成: 攻撃追加は不要or最後に移動（ユーザーストーリーから再設計）

### 3. メイン画面UI改善
- **軽減自動組み立て案内強化**: 8人以外で不正確な旨、実験段階の旨、AI不使用で独自アルゴリズムのテスト段階である旨を明示
- **コンパクト表示**: 名称自体を変更（ONで展開されるため）＋デフォルト化
- コントロールバーのアイコン配置見直し
- **リキャスト被り表現改善**: 日英両方。「何秒後に既に配置。取り除くかずらすか対応が必要」のように具体的に
- **ジョブアイコン行の右端角丸**: 見た目が良くない → 除去or統一
- **ヘビー級まとめ共有**: シリーズクリックで中のプラン全選択。共有限度でチェック外し。デザイン要検討
- 最小フォントサイズ12px以上
- **コピースタンプ中**: 何の攻撃をコピー中か明示

### 4. 継続検討（方針未確定）
- FFLogsアイコン案、チートシートMTST分けの是非
- フェーズなしコンテンツのスペース（畳む機能の要否も含めて検討）
- テンプレートの日本語攻撃名（logs精度問題、管理者登録で徐々に改善）
- 「みんなの軽減表」配置（フィードバックの意図が不明確、保留）
- 軽減選択モーダルの画面サイズ対応（テスター環境で再現せず、条件確認してから）

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
