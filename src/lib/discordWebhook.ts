// api/webhook/discord/index.ts
/**
 * Discord Webhook送信ヘルパー
 * 管理者のDiscordチャンネルにEmbed形式でメッセージを送る
 */

const DISCORD_WEBHOOK_URL = process.env.DISCORD_ADMIN_WEBHOOK_URL;

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number; // 10進数カラーコード
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

export async function sendDiscordNotification(embed: DiscordEmbed): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('[Discord] DISCORD_ADMIN_WEBHOOK_URL が未設定。通知をスキップ');
    return;
  }

  try {
    const resp = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: embed.timestamp || new Date().toISOString() }],
      }),
    });
    if (!resp.ok) {
      console.error(`[Discord] Webhook送信失敗: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('[Discord] Webhook送信エラー:', err);
  }
}
