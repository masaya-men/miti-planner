# セッション引き継ぎ書（2026-03-31 第60セッション）

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

## 今回のセッション（第60セッション）で完了したこと

### 1. Vercel関数圧縮 12→7（メインタスク）
4統合を実施し、Hobby プラン12関数上限から5枠の空きを確保。

| 統合 | 旧ファイル | 新ファイル | ルーティング |
|------|-----------|-----------|-------------|
| admin | contents + set-role + templates | `api/admin/index.ts` | `?resource=contents\|role\|templates` |
| auth | discord + twitter | `api/auth/index.ts` | `?provider=discord\|twitter` |
| template | auto-register + promote | `api/template/index.ts` | `?action=auto-register\|promote` |
| share | share + share-page | `api/share/index.ts` | `?type=page` でshare-page |

**方式**: `_` プレフィックスのハンドラーファイル + ルーターindex.ts。Vercelは `_` 付きファイルを関数として認識しない。

**外部サービス設定変更済み**:
- Discord Developer Portal: リダイレクトURL → `https://lopoly.app/api/auth?provider=discord`
- Twitter Developer Portal: リダイレクトURL → `https://lopoly.app/api/auth?provider=twitter`
- 古いプレビューURL（lopo-eta等）も整理済み

### 2. OGP画像追加（Discordプレビュー対応）
- `public/ogp.png` が存在せず、Discordにリンクを貼ってもプレビューが表示されなかった
- ユーザーが用意した画像を `public/ogp.png` に配置して解決
- Discordのキャッシュ更新待ち（24時間以内に自然解消）

### 3. LoPo管理マニュアル作成
- `C:\Users\masay\Desktop\LoPo管理マニュアル\管理者マニュアル.md` — 全キー・URL・手順の完全マニュアル
- `C:\Users\masay\Desktop\LoPo管理マニュアル\env-local-backup.txt` — .env.local のバックアップ
- **gitリポジトリ外**に保存（シークレットを含むため）

### 4. Discord Bot権限修正
- LoPo公式サーバーのLoPo Botロールに管理者権限を付与
- 「頑張って開発中」カテゴリのチャンネルがBotから見えなかったのが原因

---

## 第60セッションで変更したファイル一覧

### mainブランチ（デプロイ済み）

**新規作成:**
- `api/admin/index.ts` — 管理APIルーター
- `api/admin/_contentsHandler.ts` — コンテンツ管理ハンドラー
- `api/admin/_roleHandler.ts` — ロール管理ハンドラー
- `api/admin/_templatesHandler.ts` — テンプレート管理ハンドラー
- `api/auth/index.ts` — OAuth認証ルーター
- `api/auth/_discordHandler.ts` — Discord OAuthハンドラー
- `api/auth/_twitterHandler.ts` — Twitter OAuthハンドラー
- `api/share/_sharePageHandler.ts` — 共有ページHTMLハンドラー
- `api/template/index.ts` — テンプレート操作ルーター
- `api/template/_autoRegisterHandler.ts` — テンプレート自動登録ハンドラー
- `api/template/_promoteHandler.ts` — テンプレート昇格ハンドラー
- `public/ogp.png` — OGPプレビュー画像

**削除:**
- `api/admin/contents/index.ts`
- `api/admin/set-role.ts`
- `api/admin/templates/index.ts`
- `api/auth/discord/index.ts`
- `api/auth/twitter/index.ts`
- `api/share-page/index.ts`
- `api/template/auto-register/index.ts`
- `api/template/promote/index.ts`

**変更:**
- `api/share/index.ts` — share-page統合（`?type=page` ルーティング追加）
- `vercel.json` — share-pageのrewrite更新
- `src/store/useAuthStore.ts` — auth URL変更
- `src/components/FFLogsImportModal.tsx` — template URL変更
- `src/components/admin/AdminConfig.tsx` — admin URL変更
- `src/components/admin/AdminContents.tsx` — admin URL変更
- `src/components/admin/AdminDashboard.tsx` — admin URL変更
- `src/components/admin/AdminServers.tsx` — admin URL変更
- `src/components/admin/AdminSkills.tsx` — admin URL変更
- `src/components/admin/AdminStats.tsx` — admin URL変更
- `src/components/admin/AdminTemplates.tsx` — admin/template URL変更
- `docs/TODO.md` — 完了タスク記録、curl URL更新

---

## 次セッションの優先タスク

### 1. Pretext LP演出の動作確認と採用判断（前セッションからの持ち越し）
- `git checkout feature/pretext-lp && git stash pop`
- `npm run dev`で確認 → ユーザーが採用セクションを決定
- mainにマージ or 不採用分を除去

### 2. その他
- βテスト残タスク確認（TODO.md参照）
- LP: THREE.Clock非推奨警告の修正

---

## 重要な技術的注意（前セッションから引き続き）

- **Vercel関数**: 現在7/12。新規APIは既存ルーターに統合する方式
- **API URLパターン**: `/api/admin?resource=xxx`, `/api/auth?provider=xxx`, `/api/template?action=xxx`, `/api/share?type=page`
- **管理者curlコマンド**: `curl -X POST "https://lopoly.app/api/admin?resource=role" ...`
- **ENFORCE_APP_CHECK=true が本番で有効** — 全APIでverifyAppCheckを維持
- **OAuthコールバックURL**: Discord=`/api/auth?provider=discord`, Twitter=`/api/auth?provider=twitter`
- **Cookieパス**: 統合後は `/api/auth`（旧 `/api/auth/discord` と `/api/auth/twitter`）
- **LoPo管理マニュアル**: `C:\Users\masay\Desktop\LoPo管理マニュアル\` — 全シークレット含む（git外）

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Upstash Redis: `lopo-rate-limit` (us-east-1, 無料プラン)
