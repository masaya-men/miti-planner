/**
 * Discord Webhook送信ヘルパー
 * - sendDiscordNotification: 管理者向け通知（DISCORD_ADMIN_WEBHOOK_URL → MainDiscord）
 */

const DISCORD_ADMIN_URL = process.env.DISCORD_ADMIN_WEBHOOK_URL;

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number; // 10進数カラーコード
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

/** 管理者向け通知（テンプレート更新・昇格候補など内部向け → MainDiscord） */
export async function sendDiscordNotification(embed: DiscordEmbed): Promise<void> {
  if (!DISCORD_ADMIN_URL) {
    console.warn('[Discord] DISCORD_ADMIN_WEBHOOK_URL が未設定。通知をスキップ');
    return;
  }

  try {
    const resp = await fetch(DISCORD_ADMIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: embed.timestamp || new Date().toISOString() }],
      }),
    });
    if (!resp.ok) {
      console.error(`[Discord:ADMIN] Webhook送信失敗: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('[Discord:ADMIN] Webhook送信エラー:', err);
  }
}
