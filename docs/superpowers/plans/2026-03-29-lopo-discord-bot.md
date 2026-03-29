# LoPo Discord Bot 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LoPo鯖のユーザー投稿をメイン個人鯖にリアルタイムEmbed転送し、メイン鯖からの返信をLoPo鯖に代理投稿するDiscord Bot

**Architecture:** discord.js v14のGateway接続でLoPo鯖の指定チャンネルを監視。新着メッセージはWebhookClientでメイン鯖にEmbed転送。メイン鯖の返信チャンネルで転送メッセージへの返信を検知し、元チャンネルにBotとして代理投稿。メッセージIDマッピングはインメモリMap（直近1000件、再起動で消失OK）。

**Tech Stack:** Node.js, discord.js v14, dotenv

**リポジトリ:** `C:\Users\masay\Desktop\lopo-bot`（FF14Simとは完全に別）

**ホスティング:** Wispbyte（無料・24時間常駐）

---

## ファイル構成

```
lopo-bot/
├── src/
│   ├── index.ts          # エントリポイント（Client初期化・イベント登録・ログイン）
│   ├── config.ts         # チャンネルID→Webhook URLのマッピング定義
│   ├── forward.ts        # LoPo鯖→メイン鯖のEmbed転送ロジック
│   ├── reply.ts          # メイン鯖→LoPo鯖の返信代理投稿ロジック
│   └── messageStore.ts   # 転送メッセージIDマッピング（インメモリMap）
├── .env                  # 環境変数（トークン・チャンネルID・Webhook URL）
├── .env.example          # .envのテンプレート（値は空）
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Task 1: プロジェクト初期化

**Files:**
- Create: `C:\Users\masay\Desktop\lopo-bot\package.json`
- Create: `C:\Users\masay\Desktop\lopo-bot\tsconfig.json`
- Create: `C:\Users\masay\Desktop\lopo-bot\.gitignore`
- Create: `C:\Users\masay\Desktop\lopo-bot\.env.example`
- Create: `C:\Users\masay\Desktop\lopo-bot\.env`

- [ ] **Step 1: ディレクトリ作成とgit init**

```bash
mkdir -p C:/Users/masay/Desktop/lopo-bot
cd C:/Users/masay/Desktop/lopo-bot
git init
```

- [ ] **Step 2: package.json作成**

```json
{
  "name": "lopo-bot",
  "version": "1.0.0",
  "description": "LoPo Discord message forwarding bot",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "private": true
}
```

- [ ] **Step 3: 依存パッケージをインストール**

```bash
cd C:/Users/masay/Desktop/lopo-bot
npm install discord.js dotenv
npm install -D typescript tsx @types/node
```

- [ ] **Step 4: tsconfig.json作成**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: .gitignore作成**

```
node_modules/
dist/
.env
```

- [ ] **Step 6: .env.example作成**

```env
# Discord Bot
DISCORD_BOT_TOKEN=

# LoPo鯖チャンネルID（監視対象）
LOPO_MITI_BUG_CHANNEL_ID=
LOPO_MITI_IDEA_CHANNEL_ID=
LOPO_TOUR_BUG_CHANNEL_ID=
LOPO_TOUR_IDEA_CHANNEL_ID=
LOPO_BETA_INFO_CHANNEL_ID=
LOPO_BETA_FEEDBACK_CHANNEL_ID=
LOPO_BETA_BUG_CHANNEL_ID=

# メイン鯖Webhook URL（転送先）
WEBHOOK_MITI=
WEBHOOK_TOUR=
WEBHOOK_BETA=

# メイン鯖 返信チャンネルID（Botが返信を監視）
MAIN_REPLY_CHANNEL_ID=
```

- [ ] **Step 7: .envファイル作成（実際の値を入力）**

FF14Simの`.env.local`からBotトークンをコピーし、チャンネルIDはDiscord開発者モードで取得する。
Webhook URLは設計書（`docs/superpowers/specs/2026-03-29-lopo-discord-bot-design.md`）から転記。

```env
DISCORD_BOT_TOKEN=（.env.localのDISCORD_BOT_TOKENの値）

LOPO_MITI_BUG_CHANNEL_ID=（Discordで右クリック→IDコピー）
LOPO_MITI_IDEA_CHANNEL_ID=（同上）
LOPO_TOUR_BUG_CHANNEL_ID=（同上）
LOPO_TOUR_IDEA_CHANNEL_ID=（同上）
LOPO_BETA_INFO_CHANNEL_ID=（同上）
LOPO_BETA_FEEDBACK_CHANNEL_ID=（同上）
LOPO_BETA_BUG_CHANNEL_ID=（同上）

WEBHOOK_MITI=（Discord Webhook URL）
WEBHOOK_TOUR=（Discord Webhook URL）
WEBHOOK_BETA=（Discord Webhook URL）

MAIN_REPLY_CHANNEL_ID=（メイン鯖の#返信チャンネルのID）
```

- [ ] **Step 8: コミット**

```bash
cd C:/Users/masay/Desktop/lopo-bot
git add package.json tsconfig.json .gitignore .env.example
git commit -m "chore: プロジェクト初期化（discord.js + TypeScript）"
```

---

## Task 2: 設定モジュール（config.ts）

**Files:**
- Create: `C:\Users\masay\Desktop\lopo-bot\src\config.ts`

- [ ] **Step 1: config.ts作成**

チャンネルID→Webhook URLのマッピングと、チャンネルごとのメタ情報（カテゴリ名・チャンネル名・Embed色）を定義。

```typescript
import 'dotenv/config';

// 環境変数の必須チェック
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`環境変数 ${key} が未設定です`);
    process.exit(1);
  }
  return val;
}

export const BOT_TOKEN = requireEnv('DISCORD_BOT_TOKEN');

// Embed色（10進数）
const COLOR_MITI = 0x808080;   // グレー（軽減プランナー）
const COLOR_TOUR = 0xa0a0a0;   // ライトグレー（ツアープランナー）
const COLOR_BETA = 0x606060;   // ダークグレー（開発中）

export interface ChannelMeta {
  category: string;
  channelName: string;
  webhookUrl: string;
  color: number;
}

// LoPo鯖チャンネルID → 転送先情報のマッピング
export function buildChannelMap(): Map<string, ChannelMeta> {
  const map = new Map<string, ChannelMeta>();

  const webhookMiti = requireEnv('WEBHOOK_MITI');
  const webhookTour = requireEnv('WEBHOOK_TOUR');
  const webhookBeta = requireEnv('WEBHOOK_BETA');

  const entries: [string, ChannelMeta][] = [
    [requireEnv('LOPO_MITI_BUG_CHANNEL_ID'), {
      category: '軽減プランナー', channelName: '#バグ報告',
      webhookUrl: webhookMiti, color: COLOR_MITI,
    }],
    [requireEnv('LOPO_MITI_IDEA_CHANNEL_ID'), {
      category: '軽減プランナー', channelName: '#要望・アイデア',
      webhookUrl: webhookMiti, color: COLOR_MITI,
    }],
    [requireEnv('LOPO_TOUR_BUG_CHANNEL_ID'), {
      category: 'ツアープランナー', channelName: '#バグ報告',
      webhookUrl: webhookTour, color: COLOR_TOUR,
    }],
    [requireEnv('LOPO_TOUR_IDEA_CHANNEL_ID'), {
      category: 'ツアープランナー', channelName: '#要望・アイデア',
      webhookUrl: webhookTour, color: COLOR_TOUR,
    }],
    [requireEnv('LOPO_BETA_INFO_CHANNEL_ID'), {
      category: '頑張って開発中', channelName: '#おしらせ',
      webhookUrl: webhookBeta, color: COLOR_BETA,
    }],
    [requireEnv('LOPO_BETA_FEEDBACK_CHANNEL_ID'), {
      category: '頑張って開発中', channelName: '#フィードバック',
      webhookUrl: webhookBeta, color: COLOR_BETA,
    }],
    [requireEnv('LOPO_BETA_BUG_CHANNEL_ID'), {
      category: '頑張って開発中', channelName: '#バグ報告',
      webhookUrl: webhookBeta, color: COLOR_BETA,
    }],
  ];

  for (const [id, meta] of entries) {
    map.set(id, meta);
  }

  return map;
}

export const MAIN_REPLY_CHANNEL_ID = requireEnv('MAIN_REPLY_CHANNEL_ID');
```

- [ ] **Step 2: コミット**

```bash
cd C:/Users/masay/Desktop/lopo-bot
git add src/config.ts
git commit -m "feat: チャンネルマッピング設定モジュール"
```

---

## Task 3: メッセージIDストア（messageStore.ts）

**Files:**
- Create: `C:\Users\masay\Desktop\lopo-bot\src\messageStore.ts`

- [ ] **Step 1: messageStore.ts作成**

転送メッセージID → 元メッセージ情報のマッピング。直近1000件をインメモリで保持。

```typescript
export interface OriginalMessageInfo {
  channelId: string;   // LoPo鯖の元チャンネルID
  messageId: string;   // LoPo鯖の元メッセージID
}

const MAX_ENTRIES = 1000;
const store = new Map<string, OriginalMessageInfo>();
const insertionOrder: string[] = [];

/** 転送メッセージIDと元メッセージ情報を紐付けて保存 */
export function saveMapping(forwardedMessageId: string, original: OriginalMessageInfo): void {
  store.set(forwardedMessageId, original);
  insertionOrder.push(forwardedMessageId);

  // 古いエントリを削除（FIFO）
  while (insertionOrder.length > MAX_ENTRIES) {
    const oldest = insertionOrder.shift()!;
    store.delete(oldest);
  }
}

/** 転送メッセージIDから元メッセージ情報を取得 */
export function getOriginal(forwardedMessageId: string): OriginalMessageInfo | undefined {
  return store.get(forwardedMessageId);
}
```

- [ ] **Step 2: コミット**

```bash
cd C:/Users/masay/Desktop/lopo-bot
git add src/messageStore.ts
git commit -m "feat: 転送メッセージIDマッピングストア"
```

---

## Task 4: メッセージ転送ロジック（forward.ts）

**Files:**
- Create: `C:\Users\masay\Desktop\lopo-bot\src\forward.ts`

- [ ] **Step 1: forward.ts作成**

LoPo鯖の監視対象チャンネルに投稿があったとき、メイン鯖の対応WebhookにEmbedを送信する。

```typescript
import { Message, EmbedBuilder } from 'discord.js';
import type { ChannelMeta } from './config.js';
import { saveMapping } from './messageStore.js';

/** LoPo鯖のメッセージをメイン鯖にEmbed転送 */
export async function forwardMessage(message: Message, meta: ChannelMeta): Promise<void> {
  const author = message.author;
  const embed = new EmbedBuilder()
    .setAuthor({
      name: author.displayName ?? author.username,
      iconURL: author.displayAvatarURL({ size: 64 }),
    })
    .setDescription(message.content || '（本文なし）')
    .setColor(meta.color)
    .setFooter({ text: `${meta.category} > ${meta.channelName}` })
    .setTimestamp(message.createdAt);

  // 画像があれば最初の1枚をEmbedに添付
  const imageAttachment = message.attachments.find(a =>
    a.contentType?.startsWith('image/') ?? false
  );
  if (imageAttachment) {
    embed.setImage(imageAttachment.url);
  }

  // 元メッセージへのリンク
  embed.addFields({
    name: '\u200b',
    value: `[元のメッセージ](${message.url})`,
  });

  // Webhook送信
  const resp = await fetch(meta.webhookUrl + '?wait=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed.toJSON()] }),
  });

  if (!resp.ok) {
    console.error(`[転送失敗] ${resp.status} ${resp.statusText} — ${meta.category} ${meta.channelName}`);
    return;
  }

  // 転送先メッセージIDを保存（返信機能で使用）
  const forwarded = await resp.json() as { id: string };
  saveMapping(forwarded.id, {
    channelId: message.channelId,
    messageId: message.id,
  });

  console.log(`[転送] ${meta.category} ${meta.channelName} — ${author.username}: ${message.content.slice(0, 50)}`);
}
```

- [ ] **Step 2: コミット**

```bash
cd C:/Users/masay/Desktop/lopo-bot
git add src/forward.ts
git commit -m "feat: LoPo鯖→メイン鯖のEmbed転送ロジック"
```

---

## Task 5: 返信代理投稿ロジック（reply.ts）

**Files:**
- Create: `C:\Users\masay\Desktop\lopo-bot\src\reply.ts`

- [ ] **Step 1: reply.ts作成**

メイン鯖の返信チャンネルで、転送メッセージへの返信を検知し、LoPo鯖に代理投稿する。

```typescript
import { Client, Message } from 'discord.js';
import { getOriginal } from './messageStore.js';
import { MAIN_REPLY_CHANNEL_ID } from './config.js';

/** メイン鯖の返信をLoPo鯖に代理投稿 */
export async function handleReply(client: Client, message: Message): Promise<void> {
  // 返信チャンネル以外は無視
  if (message.channelId !== MAIN_REPLY_CHANNEL_ID) return;

  // Bot自身の投稿は無視
  if (message.author.bot) return;

  // Discordの返信（リプライ）でない場合は無視
  if (!message.reference?.messageId) return;

  // 返信先が転送メッセージかチェック
  const original = getOriginal(message.reference.messageId);
  if (!original) {
    console.log('[返信] 転送元が見つかりません（古いメッセージまたはBot再起動後）');
    return;
  }

  // LoPo鯖の元チャンネルを取得
  const lopoChannel = await client.channels.fetch(original.channelId);
  if (!lopoChannel || !lopoChannel.isTextBased()) {
    console.error(`[返信] チャンネル取得失敗: ${original.channelId}`);
    return;
  }

  // 元メッセージへの返信として送信
  await lopoChannel.send({
    content: message.content,
    reply: { messageReference: original.messageId },
  });

  // 送信確認のリアクション
  await message.react('✅').catch(() => {});

  console.log(`[返信] LoPo鯖に代理投稿: ${message.content.slice(0, 50)}`);
}
```

- [ ] **Step 2: コミット**

```bash
cd C:/Users/masay/Desktop/lopo-bot
git add src/reply.ts
git commit -m "feat: メイン鯖→LoPo鯖の返信代理投稿ロジック"
```

---

## Task 6: エントリポイント（index.ts）

**Files:**
- Create: `C:\Users\masay\Desktop\lopo-bot\src\index.ts`

- [ ] **Step 1: index.ts作成**

```typescript
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { BOT_TOKEN, buildChannelMap } from './config.js';
import { forwardMessage } from './forward.js';
import { handleReply } from './reply.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const channelMap = buildChannelMap();

client.once(Events.ClientReady, (c) => {
  console.log(`[起動] ${c.user.tag} でログインしました`);
  console.log(`[監視] ${channelMap.size}チャンネルを監視中`);
});

client.on(Events.MessageCreate, async (message) => {
  // Bot自身の投稿は無視
  if (message.author.bot) return;

  // LoPo鯖の監視対象チャンネル → 転送
  const meta = channelMap.get(message.channelId);
  if (meta) {
    try {
      await forwardMessage(message, meta);
    } catch (err) {
      console.error('[転送エラー]', err);
    }
    return;
  }

  // メイン鯖の返信チャンネル → 代理投稿
  try {
    await handleReply(client, message);
  } catch (err) {
    console.error('[返信エラー]', err);
  }
});

// 接続状態の監視
client.on(Events.ShardReconnecting, () => {
  console.log('[再接続中...]');
});

client.on(Events.ShardResume, () => {
  console.log('[再接続完了]');
});

client.on(Events.ShardError, (error) => {
  console.error('[WebSocketエラー]', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[未処理エラー]', error);
});

client.login(BOT_TOKEN);
```

- [ ] **Step 2: ビルドして構文エラーがないか確認**

```bash
cd C:/Users/masay/Desktop/lopo-bot
npm run build
```

Expected: `dist/` にJSファイルが生成される。エラーなし。

- [ ] **Step 3: コミット**

```bash
cd C:/Users/masay/Desktop/lopo-bot
git add src/index.ts
git commit -m "feat: Botエントリポイント（監視・転送・返信の統合）"
```

---

## Task 7: ローカル動作確認

- [ ] **Step 1: .envにチャンネルIDを入力**

ユーザーにDiscord開発者モードでチャンネルIDを取得してもらう必要がある。
以下のチャンネルのIDが必要:
- LoPo鯖: 軽減プランナー>#バグ報告、>#要望・アイデア、ツアープランナー>#バグ報告、>#要望・アイデア、頑張って開発中>#おしらせ、>#フィードバック、>#バグ報告
- メイン鯖: #返信チャンネル

- [ ] **Step 2: devモードで起動**

```bash
cd C:/Users/masay/Desktop/lopo-bot
npm run dev
```

Expected: `[起動] LoPo Bot#XXXX でログインしました` と `[監視] 7チャンネルを監視中` が表示される。

- [ ] **Step 3: 転送テスト**

LoPo鯖の#バグ報告チャンネルにテストメッセージを投稿し、メイン鯖の軽減プランナーWebhookチャンネルにEmbedが届くことを確認。

- [ ] **Step 4: 返信テスト**

メイン鯖に届いた転送Embedに返信し、LoPo鯖の#バグ報告に「LoPo Bot」名義で返信が投稿されることを確認。

- [ ] **Step 5: コミット（動作確認後の微調整があれば）**

```bash
cd C:/Users/masay/Desktop/lopo-bot
git add -A
git commit -m "fix: ローカル動作確認後の調整"
```

---

## Task 8: GitHubリポジトリ作成・プッシュ

- [ ] **Step 1: GitHubにリポジトリ作成**

```bash
cd C:/Users/masay/Desktop/lopo-bot
gh repo create lopo-bot --private --source=. --remote=origin
```

- [ ] **Step 2: プッシュ**

```bash
cd C:/Users/masay/Desktop/lopo-bot
git push -u origin main
```

---

## Task 9: Wispbyteデプロイ

- [ ] **Step 1: Wispbyteアカウント作成**

https://wispbyte.com/ でアカウント作成（Discord認証が使える場合あり）

- [ ] **Step 2: プロジェクト作成・GitHubリポジトリ接続**

Wispbyteダッシュボードで新規プロジェクト → GitHubの`lopo-bot`リポジトリを接続

- [ ] **Step 3: 環境変数設定**

.envの全項目をWispbyteの環境変数設定に入力

- [ ] **Step 4: ビルド・起動コマンド設定**

- Build: `npm install && npm run build`
- Start: `npm start`

- [ ] **Step 5: デプロイ・動作確認**

デプロイ後、LoPo鯖にテスト投稿して転送を確認

---

## Task 10: 既存Webhookの確認・修復（FF14Simリポジトリ側）

**注意: この作業はFF14Simリポジトリ（`C:\Users\masay\Desktop\FF14Sim`）で行う。**

- [ ] **Step 1: DISCORD_ADMIN_WEBHOOK_URLの動作確認**

```bash
# .env.localからURLを取得してテスト送信
cd C:/Users/masay/Desktop/FF14Sim
source <(grep DISCORD_ADMIN_WEBHOOK_URL .env.local)
curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" \
  -d '{"content":"Webhook動作テスト（管理者向け）"}' \
  "$DISCORD_ADMIN_WEBHOOK_URL"
```

Expected: `204`（成功）。`404`なら無効化されている → LoPo鯖の管理ログチャンネルで新Webhook作成が必要。

- [ ] **Step 2: GitHub Actions DISCORD_WEBHOOK_URLの確認**

mainにfeat/fixプレフィックスのコミットをpushして、#アップデートチャンネルに通知が届くか確認。
または、GitHub Secretsの値をcurlで直接テストする。

- [ ] **Step 3: 必要ならWebhook再作成・環境変数更新**

無効なWebhookがあれば:
1. Discord該当チャンネルの設定 → 連携サービス → Webhookを新規作成
2. Vercel環境変数 or GitHub Secretsを新URLに更新
3. Vercelの場合は再デプロイ

---

## README.md（Task 8のプッシュ前に作成）

- [ ] **README.md作成**

```markdown
# LoPo Bot

LoPo Discord鯖のメッセージ転送・返信代理投稿Bot。

## セットアップ

1. `cp .env.example .env` して値を入力
2. `npm install`
3. `npm run dev`（開発）/ `npm run build && npm start`（本番）

## 機能

- LoPo鯖の指定チャンネル → メイン鯖にEmbed転送
- メイン鯖で転送メッセージに返信 → LoPo鯖に代理投稿
```
