/**
 * Twitter 動画プロキシの URL ビルダー (2026-05-29 新設)。
 *
 * 既定は同一 origin の Vercel Edge Function (`/api/tweet-video`)。
 * env `VITE_MEDIA_PROXY_BASE_URL` をセットすると Cloudflare Worker 等の
 * 別 origin に切替わる (= egress 無料化のための前段移設)。env を外す/空にする
 * だけで即 Vercel に戻せる (ロールバック)。
 *
 * base は `?url=<encoded>` を後置して使う前置き文字列:
 *   既定 : "/api/tweet-video"
 *   Worker: "https://media.lopoly.app"
 */
const DEFAULT_PROXY_BASE = '/api/tweet-video';

function proxyBase(): string {
  const fromEnv = import.meta.env.VITE_MEDIA_PROXY_BASE_URL;
  return typeof fromEnv === 'string' && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_PROXY_BASE;
}

export function buildTweetVideoProxyUrl(videoUrl: string): string {
  return `${proxyBase()}?url=${encodeURIComponent(videoUrl)}`;
}
