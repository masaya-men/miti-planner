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

/**
 * ハウジング新着通知 (masaya 専用チャンネル) — プレーンテキストを送る。
 * embed ではなく content を使う理由: リプ用テキストをコードブロックで送り、
 * タップ長押しでコピーできるようにするため (設計書 §4)。
 */
export async function sendHousingNewListingNotification(content: string): Promise<void> {
  const url = process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL;
  if (!url) {
    console.warn('[Discord:HOUSING_NEW] DISCORD_HOUSING_NEW_WEBHOOK_URL が未設定。新着通知をスキップ');
    return;
  }
  // content は登録者の入力 (物件タイトル・ハウジンガー表示名) を埋め込むため、
  // allowed_mentions で @everyone/@here 等のメンションを一切無効化する (悪用防止)。
  // また 呼び出し元 (_registerListingHandler) は登録 transaction コミット後・res.status(200) 前に
  // これを await するため、Discord エンドポイントが無応答だと Vercel 関数タイムアウト → 504 →
  // ユーザーが登録失敗と誤認して再登録 (重複) を招く。5 秒で abort する
  // (abort は reject として下の catch が握り潰す = ベストエフォートのまま)。
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: ac.signal,
    });
    if (!resp.ok) {
      console.error(`[Discord:HOUSING_NEW] Webhook送信失敗: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('[Discord:HOUSING_NEW] Webhook送信エラー:', err);
  } finally {
    clearTimeout(timer);
  }
}
