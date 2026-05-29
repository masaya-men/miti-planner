/**
 * Cloudflare Worker — Twitter 動画 CDN プロキシ (2026-05-29 新設)。
 * LoPo の Vercel Edge Function `api/tweet-video.ts` を CF に移設したもの。
 *
 * 目的: 動画バイトを Vercel ではなく Cloudflare 経由で配り、Vercel の
 * Fast Origin Transfer (従量課金) を消費しないようにする (CF egress は無料)。
 *
 * - allowlist: video.twimg.com のみ (open proxy 化防止)
 * - UA 偽装: 独自 UA だと video.twimg.com が Range を無視し ~18KB しか返さない
 * - Range 透過 + 206/Content-Range 中継 (HTML5 video の seek 用)
 * - CORS: ACAO:* を全レスポンスで常時返す (frame 抽出 video.crossOrigin='anonymous'
 *   への対応 + 「CORS ヘッダ無しで HTTP cache に乗った応答が後続 CORS 要求を弾く」
 *   gotcha の回避)
 * - Cache-Control: s-maxage=86400 (CF エッジキャッシュ。egress 無料なので主目的は
 *   Twitter への取得回数削減と低レイテンシ)
 */
const ALLOWED_HOSTS = new Set<string>(['video.twimg.com']);
const TIMEOUT_MS = 30_000;

const CORS_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Max-Age': '86400',
} as const;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_PREFLIGHT_HEADERS });
    }

    const url = new URL(req.url).searchParams.get('url');
    if (!url) return jsonError('url query param is required', 400);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return jsonError('invalid url', 400);
    }
    if (parsed.protocol !== 'https:') {
      return jsonError('only https upstream allowed', 400);
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return jsonError('upstream host not allowed', 403);
    }

    const upstreamHeaders = new Headers();
    upstreamHeaders.set('User-Agent', 'Mozilla/5.0 (compatible; LoPo/1.0)');
    const range = req.headers.get('range');
    if (range) upstreamHeaders.set('Range', range);

    let upstream: Response;
    try {
      upstream = await fetch(parsed.toString(), {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'TimeoutError') return jsonError('Upstream timeout', 504);
      return jsonError('Internal error', 500);
    }

    if (!upstream.ok && upstream.status !== 206) {
      return jsonError(`upstream ${upstream.status}`, upstream.status === 404 ? 404 : 502);
    }

    const headers = new Headers();
    for (const h of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');

    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
