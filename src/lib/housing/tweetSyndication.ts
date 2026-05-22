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
 * - 'gone'  : 404、 または 200 だが削除/閲覧不可 (syndication CDN は削除済みツイートに
 *             404 ではなく 200 + `{__typename:'TweetTombstone'}` を返す。 非公開/凍結は
 *             `TweetUnavailable`。 正常ツイートは必ず `user` を持つので欠落も gone 扱い)。
 * - 'alive' : 200 で `user` を持つ正常な Tweet。
 * - 'error' : それ以外/例外。「消さない・lastTweetCheckAt も更新しない」 側に倒す fail-safe。
 */
export async function checkTweetStatus(id: string): Promise<TweetStatus> {
  try {
    const res = await fetch(syndicationUrl(id), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'LoPo Housing Tour' },
    });
    if (res.status === 404) return 'gone';
    if (!res.ok) return 'error';
    const body = (await res.json().catch(() => null)) as
      | { __typename?: string; user?: unknown }
      | null;
    if (!body) return 'error';
    if (body.__typename === 'TweetTombstone' || body.__typename === 'TweetUnavailable') {
      return 'gone';
    }
    if (!body.user) return 'gone';
    return 'alive';
  } catch {
    return 'error';
  }
}
