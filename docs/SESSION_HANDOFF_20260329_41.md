# セッション引き継ぎ書（2026-03-29 第41セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### ⚠️ 過去の失敗パターン（繰り返さないこと）
- **設計書を読まずにバグ修正に飛びつく**
- **Skillを使わずに実装を始める**
- **`replace_all` で意図しない箇所まで置換してしまう**
- **Zustandストア内でハードコーディングした日本語メッセージ**

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第41セッション）で完了したこと

### 1. Discord Bot実装・デプロイ

**別リポジトリ:** `C:\Users\masay\Desktop\lopo-bot`（GitHub: masaya-men/lopo-bot, private）

| ファイル | 役割 |
|---------|------|
| `src/config.ts` | チャンネルID→Webhook URLマッピング、環境変数チェック |
| `src/messageStore.ts` | 転送メッセージID→元メッセージIDのインメモリMap（直近1000件） |
| `src/forward.ts` | LoPo鯖→MainDiscordへのEmbed転送（429リトライ機能付き） |
| `src/reply.ts` | MainDiscordで転送Embedに返信→LoPo鯖に代理投稿 |
| `src/index.ts` | エントリポイント（Client初期化・イベント登録・ログイン） |

**機能:**
- LoPo鯖の7チャンネル（軽減プランナー2 + ツアープランナー2 + 頑張って開発中3）を監視
- 新着メッセージをMainDiscordの対応チャンネルにEmbed転送（ユーザー名・アイコン・本文・画像・元メッセージリンク）
- MainDiscordで転送Embedに返信すると、LoPo鯖に「LoPo Bot」名義で代理投稿
- 429レート制限時は最大3回・自動リトライ

**ホスティング:** Wispbyte（無料・24時間稼働・自動削除なし）
- サーバー名: lopo-bot
- Startup: `npm install && npm run build && node dist/index.js`
- Docker Image: nodejs_22
- Wispbyteアカウント: lopoly.contact@gmail.com

**ローカル動作確認済み。Wispbyteデプロイ済み。転送・返信の両方動作確認済み。**

### 2. 既存Webhook整理

| 変更 | 内容 |
|------|------|
| `DISCORD_ADMIN_WEBHOOK_URL` | MainDiscordの「LoPo管理者用通知」チャンネルに変更（Vercel Production + Development） |
| `DISCORD_UPDATE_WEBHOOK_URL` | 削除（未使用だったため） |
| `DISCORD_WEBHOOK_URL`（GitHub Secrets） | コミット通知廃止。ワークフロー削除済み。GitHub Secretsは残存（害なし） |
| `discord-notify.yml` | 削除（feat/fixコミット通知のGitHub Actions） |
| `discordWebhook.ts` | `sendUpdateNotification`廃止、`sendDiscordNotification`のみに統一 |
| `api/admin/contents/index.ts` | `sendUpdateNotification` → `sendDiscordNotification` に変更 |
| `api/admin/templates/index.ts` | 同上 |

### 3. 確定した方針（第41セッション）

- **コミット通知は廃止** — 手動で#アップデートに書く運用
- **管理者通知はMainDiscordに直接送信** — Botの転送を経由しない
- **MainDiscordの#返信チャンネルは不要** — 転送Embedがあるどのチャンネルでも返信検知可能
- **ユーザー向けアプデ通知（DISCORD_UPDATE_WEBHOOK_URL）は不要** — 手動運用

---

## 変更したファイル一覧

### FF14Simリポジトリ
| ファイル | 変更内容 |
|---------|---------|
| `.github/workflows/discord-notify.yml` | 削除（コミット通知廃止） |
| `src/lib/discordWebhook.ts` | sendUpdateNotification廃止、sendDiscordNotificationのみに統一 |
| `api/admin/contents/index.ts` | sendUpdateNotification → sendDiscordNotification |
| `api/admin/templates/index.ts` | 同上 |
| `docs/superpowers/plans/2026-03-29-lopo-discord-bot.md` | Bot実装計画書 |
| `docs/TODO.md` | 第41セッション完了分反映 |

### lopo-botリポジトリ（別リポジトリ）
| ファイル | 変更内容 |
|---------|---------|
| `src/config.ts` | チャンネルマッピング設定 |
| `src/messageStore.ts` | メッセージIDストア |
| `src/forward.ts` | Embed転送ロジック（429リトライ付き） |
| `src/reply.ts` | 返信代理投稿ロジック |
| `src/index.ts` | エントリポイント |
| `package.json` | discord.js + dotenv |
| `tsconfig.json` | TypeScript設定 |
| `.env` | 環境変数（Wispbyteにもアップロード済み） |

---

## 最優先タスク（第42セッション）

1. **デザイン改善 + アクセントカラー** — モーダル・画面の見直し
2. **パフォーマンス最適化** — 視覚変更が全て終わった後
3. **public/icons/ 削除** — バンドル2.1MB削減

---

## 公開までの進捗

```
全体: ███████████████████████░ 約94%完了
```

---

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook（管理者向け → MainDiscord）: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Discord Bot Token: lopo-botリポジトリの.env + Wispbyteの.env
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Firebase プラン: Blaze（従量課金、予算アラート500円）
- Wispbyteアカウント: lopoly.contact@gmail.com

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — THREE.Timerに移行が必要（動作には影響なし）

## Vercel関数制限
- Hobby プラン: **12関数が上限**（現在12/12）
- 新規APIファイル追加不可。既存エンドポイントに統合する方式
