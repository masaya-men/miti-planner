/**
 * YouTube URL から videoId を抽出 + サムネ URL 構築 (2026-05-26 新設)。
 *
 * 対応 URL 形式:
 * - https://www.youtube.com/watch?v={id}
 * - https://www.youtube.com/watch?v={id}&t=...
 * - https://youtu.be/{id}
 * - https://www.youtube.com/embed/{id}
 * - https://www.youtube.com/shorts/{id}
 * - https://m.youtube.com/watch?v={id} (mobile)
 *
 * videoId は YouTube 仕様で 11 文字の [A-Za-z0-9_-]。
 *
 * サムネ URL:
 * - maxresdefault.jpg (1280x720): 高画質、 ただし古い/低画質動画は存在しないことがある
 * - hqdefault.jpg (480x360): フォールバック、 全動画で存在
 * - 詳細画面の画像エリア (CSS 700-900px) に対しては maxresdefault で十分。
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const PATTERNS = [
  // watch?v=ID
  /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/,
  // youtu.be/ID
  /youtu\.be\/([A-Za-z0-9_-]{11})(?:[?&#]|$)/,
  // embed/ID
  /youtube\.com\/embed\/([A-Za-z0-9_-]{11})(?:[?&#]|$)/,
  // shorts/ID
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})(?:[?&#]|$)/,
];

/** 与えられた URL が YouTube URL か判定し、 videoId を返す。 該当しないなら null。 */
export function parseYoutubeUrl(url: string): string | null {
  if (typeof url !== 'string') return null;
  // host を素朴に判定 (誤って Twitter URL 内の "youtube" 文字列にマッチしないように)
  const lower = url.toLowerCase();
  if (
    !lower.includes('youtube.com/') &&
    !lower.includes('youtu.be/') &&
    !lower.includes('m.youtube.com/')
  ) {
    return null;
  }
  for (const re of PATTERNS) {
    const m = url.match(re);
    if (m && VIDEO_ID_RE.test(m[1])) return m[1];
  }
  return null;
}

/** videoId から最高画質のサムネ URL を返す (maxresdefault)。 */
export function buildYoutubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/** videoId から hq フォールバック サムネ URL を返す (全動画で存在)。 */
export function buildYoutubeThumbnailUrlFallback(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** videoId から通常の YouTube watch URL を組み立てる (canonical URL)。 */
export function buildYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
