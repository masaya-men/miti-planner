# LoPo Discord Bot 設計書

## 概要

LoPo鯖のユーザー投稿をメイン個人鯖にリアルタイム転送し、返信を代理投稿するBot。

## 技術構成

- **言語:** Node.js + discord.js
- **ホスティング:** Wispbyte（無料・クレカ不要・24時間常駐）
- **リポジトリ:** `C:\Users\masay\Desktop\lopo-bot`（LoPo本体とは別）

## 機能

### 1. メッセージ転送（LoPo鯖 → メイン個人鯖）

**監視対象チャンネル（LoPo鯖）:**

| カテゴリ | チャンネル | 転送先Webhook |
|---------|----------|--------------|
| 軽減プランナー | #バグ報告 | 軽減プランナー担当 |
| 軽減プランナー | #要望・アイデア | 軽減プランナー担当 |
| ツアープランナー | #バグ報告 | ツアープランナー担当 |
| ツアープランナー | #要望・アイデア | ツアープランナー担当 |
| 頑張って開発中 | #おしらせ | 頑張って開発中担当 |
| 頑張って開発中 | #フィードバック | 頑張って開発中担当 |
| 頑張って開発中 | #バグ報告 | 頑張って開発中担当 |

**転送形式:** Discord Embed
- カテゴリ名・チャンネル名を表示
- ユーザー名・アイコンを表示
- 本文・画像を転送
- 元メッセージへのリンク

### 2. 返信代理投稿（メイン個人鯖 → LoPo鯖）

**操作方法:**
1. メイン鯖の通知チャンネルに届いた転送メッセージに、Discordの返信機能（右クリック→返信）で返す
2. Botがメイン鯖の#返信チャンネルの投稿を監視
3. 返信先の転送メッセージから元チャンネル・元メッセージを特定
4. LoPo鯖の該当チャンネルに「LoPo Bot」名義で返信（元メッセージへのリプライとして）

**見え方:** LoPo鯖ではBotアイコン（LoPoロゴ）で「LoPo Bot」として表示される

### 3. 転送メッセージのEmbed形式

```
┌──────────────────────
│ 🛡️ 軽減プランナー > #バグ報告
│
│ ユーザー名（アイコン付き）
│ メッセージ本文
│
│ 画像があれば表示
│
│ 🔗 元のメッセージ
└──────────────────────
```

## 設定管理

環境変数（.env）で管理:

```
# Discord Bot
DISCORD_BOT_TOKEN=（トークン）

# LoPo鯖チャンネルID（監視対象）
LOPO_MITI_BUG_CHANNEL_ID=
LOPO_MITI_IDEA_CHANNEL_ID=
LOPO_TOUR_BUG_CHANNEL_ID=
LOPO_TOUR_IDEA_CHANNEL_ID=
LOPO_BETA_INFO_CHANNEL_ID=
LOPO_BETA_FEEDBACK_CHANNEL_ID=
LOPO_BETA_BUG_CHANNEL_ID=

# メイン鯖Webhook URL（転送先）
WEBHOOK_MITI=（Discord Webhook URL）
WEBHOOK_TOUR=（Discord Webhook URL）
WEBHOOK_BETA=（Discord Webhook URL）
WEBHOOK_REPLY=（Discord Webhook URL）

# メイン鯖返信チャンネルID（Botが監視）
MAIN_REPLY_CHANNEL_ID=
```

## Bot権限

Discord開発者ポータルで設定済み:
- Message Content Intent: ON
- 権限: チャンネルを表示 / メッセージを送る / メッセージ履歴を読む
- 公開Bot: OFF
- 参加サーバー: LoPo鯖 + メイン個人鯖

## 既存Webhookとの関係（重要）

LoPo本体プロジェクト（FF14Sim）には既に以下のWebhookが存在する。Bot開発時にこれらを壊さないこと。

| Webhook | 用途 | 現状 |
|---------|------|------|
| `DISCORD_ADMIN_WEBHOOK_URL`（.env.local） | 管理者チャンネル向け通知（テンプレート更新等） | 稼働中。LoPo鯖のチャンネル変更で無効になっている可能性あり。要確認 |
| `DISCORD_WEBHOOK_URL`（GitHub Secrets） | mainプッシュ時のfeat/fixコミット通知 | 稼働中。GitHub Actions discord-notify.yml で使用 |
| `DISCORD_UPDATE_WEBHOOK_URL`（.env.local参照） | ユーザー向けアップデート通知 | コード上は参照あるが環境変数未設定（未稼働） |

### チャンネル変更による影響

LoPo鯖のチャンネル構成を変更したため、以下の確認が必要:
1. `DISCORD_ADMIN_WEBHOOK_URL` → 送信先チャンネルが「管理ログ」に変わった場合、Webhook再作成が必要
2. `DISCORD_WEBHOOK_URL`（GitHub Secrets） → #アップデートチャンネルに送っている場合、Webhook再作成が必要
3. いずれもWebhookはチャンネルに紐づくので、チャンネルを削除・再作成した場合はWebhook URLが無効になる

## Wispbyteデプロイ手順（次セッションで実施）

1. lopo-botプロジェクトをGitHubにプッシュ
2. Wispbyteにアカウント作成
3. GitHubリポジトリを接続
4. 環境変数を設定
5. デプロイ
