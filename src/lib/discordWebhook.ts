/**
 * Discord Webhook送信ヘルパー
 * - sendDiscordNotification: 管理者向け通知（DISCORD_ADMIN_WEBHOOK_URL）
 * - sendUpdateNotification: ユーザー向けアップデート通知（DISCORD_UPDATE_WEBHOOK_URL）
 */

const DISCORD_ADMIN_URL = process.env.DISCORD_ADMIN_WEBHOOK_URL;
const DISCORD_UPDATE_URL = process.env.DISCORD_UPDATE_WEBHOOK_URL;

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number; // 10進数カラーコード
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

/** 管理者向け通知（テンプレート更新・昇格候補など内部向け） */
export async function sendDiscordNotification(embed: DiscordEmbed): Promise<void> {
  await sendToWebhook(DISCORD_ADMIN_URL, 'ADMIN', embed);
}

/** ユーザー向けアップデート通知（#アップデート チャンネル） */
export async function sendUpdateNotification(embed: DiscordEmbed): Promise<void> {
  await sendToWebhook(DISCORD_UPDATE_URL, 'UPDATE', embed);
}

async function sendToWebhook(url: string | undefined, label: string, embed: DiscordEmbed): Promise<void> {
  if (!url) {
    console.warn(`[Discord] DISCORD_${label}_WEBHOOK_URL が未設定。通知をスキップ`);
    return;
  }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: embed.timestamp || new Date().toISOString() }],
      }),
    });
    if (!resp.ok) {
      console.error(`[Discord:${label}] Webhook送信失敗: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error(`[Discord:${label}] Webhook送信エラー:`, err);
  }
}
