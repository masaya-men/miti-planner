/**
 * req.headers.host から正規のサイト origin を算出する小さな純関数。
 *
 * Host ヘッダは偽装可能なので、許可リスト(本番 / 既知の Vercel ホスト / ローカル)と
 * プレビュー用パターンに一致しないホストは lopoly.app に倒す。
 * SSR/OGP 系ハンドラが「自ドメインの絶対 URL」を組み立てるときに使う。
 *
 * NOTE: 既存の 4 ハンドラ(_listingPageHandler / _housingerPageHandler /
 * _tourInvitePageHandler / og-cache)にはこれと同じロジックがインラインで存在するが、
 * 本 helper への統合はスコープ外(触らない)。
 */
export function resolveSiteOrigin(rawHost: string | undefined): string {
  const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
  const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
  const h = rawHost || 'lopoly.app';
  const host = allowedHosts.find((a) => h.includes(a)) || (previewPattern.test(h) ? h : null) || 'lopoly.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
