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

/**
 * 写真を CORS を返さない外部サイトから読む時の中継 URL(色の計算用・2026-11-12)。
 * 中継の許可一覧(workers/media-proxy の ALLOWED_HOSTS)と同じホストだけ。
 */
export const CORS_RELAY_IMAGE_HOSTS: ReadonlySet<string> = new Set(['assets.housingsnap.com', 'studio-xiv.com']);

export function buildImageRelayUrl(imageUrl: string): string {
  return `${proxyBase()}?url=${encodeURIComponent(imageUrl)}`;
}
