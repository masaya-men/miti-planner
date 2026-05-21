/**
 * X (旧 Twitter) syndication CDN の共有ユーティリティ。
 *
 * Web 標準 (fetch / AbortSignal / URL / Math) のみで書く。
 * edge (/api/tweet-meta) / node (purge ハンドラ) / cron の 3 経路から再利用するため。
 */

const TIMEOUT_MS = 10_000;

/** syndication CDN の暗黙トークン (公開リバースエンジニアリング済みの既知アルゴリズム) */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

export function syndicationUrl(id: string): string {
  return `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}`;
}

export type TweetStatus = 'alive' | 'gone' | 'error';

/**
 * ツイートの生存を確認する。
 * - 200 → 'alive'、404 → 'gone'（削除/非公開）、それ以外/例外 → 'error'。
 * - 'error' は「消さない・lastTweetCheckAt も更新しない」側に倒すための値（fail-safe）。
 */
export async function checkTweetStatus(id: string): Promise<TweetStatus> {
  try {
    const res = await fetch(syndicationUrl(id), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'LoPo Housing Tour' },
    });
    if (res.status === 404) return 'gone';
    if (!res.ok) return 'error';
    return 'alive';
  } catch {
    return 'error';
  }
}
