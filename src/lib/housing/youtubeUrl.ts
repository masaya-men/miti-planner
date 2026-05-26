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
 * サムネ URL (4 段階フォールバック、 業界標準):
 * - maxresdefault.jpg (1280x720): 高画質、 ただし古い/低画質動画は存在しないことがある
 * - hqdefault.jpg (480x360): 全動画で存在
 * - mqdefault.jpg (320x180): 全動画で存在
 * - default.jpg (120x90): 最終フォールバック、 全動画で存在
 *
 * 落とし穴: maxresdefault 不在の動画では img.youtube.com が 404 でなく
 * HTTP 200 + 120x90 のグレーTV画像を返すケースがある。 onError だけでなく
 * onLoad で naturalWidth===120 もチェックして fallback を発火させる。
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

/** 4 段階フォールバック チェーンの定義 (画質の高い順)。 */
const THUMBNAIL_QUALITY_CHAIN = [
  'maxresdefault',
  'hqdefault',
  'mqdefault',
  'default',
] as const;

type ThumbnailQuality = (typeof THUMBNAIL_QUALITY_CHAIN)[number];

/** videoId から最高画質のサムネ URL を返す (maxresdefault)。 */
export function buildYoutubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/** videoId から hq フォールバック サムネ URL を返す (全動画で存在)。 */
export function buildYoutubeThumbnailUrlFallback(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** videoId と quality からサムネ URL を組み立てる。 */
export function buildYoutubeThumbnailUrlByQuality(
  videoId: string,
  quality: ThumbnailQuality,
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * img.youtube.com サムネ URL から videoId と quality を抽出する。
 * 該当しない URL なら null。
 */
export function parseYoutubeThumbnailUrl(
  url: string,
): { videoId: string; quality: ThumbnailQuality } | null {
  if (typeof url !== 'string') return null;
  const m = url.match(
    /^https?:\/\/(?:img|i)\.(?:youtube|ytimg)\.com\/vi(?:_webp)?\/([A-Za-z0-9_-]{11})\/(maxresdefault|hqdefault|mqdefault|default)\.(?:jpg|webp)(?:[?#].*)?$/,
  );
  if (!m) return null;
  if (!VIDEO_ID_RE.test(m[1])) return null;
  return { videoId: m[1], quality: m[2] as ThumbnailQuality };
}

/**
 * 現在のサムネ URL から次段のフォールバック URL を返す。
 * - maxresdefault → hqdefault → mqdefault → default の連鎖
 * - default の次は null (= もう fallback できない)
 * - YouTube サムネ URL でなければ null (呼び出し側で何もしない判断に使う)
 */
export function nextYoutubeThumbnailFallback(currentUrl: string): string | null {
  const parsed = parseYoutubeThumbnailUrl(currentUrl);
  if (!parsed) return null;
  const idx = THUMBNAIL_QUALITY_CHAIN.indexOf(parsed.quality);
  if (idx < 0 || idx >= THUMBNAIL_QUALITY_CHAIN.length - 1) return null;
  const next = THUMBNAIL_QUALITY_CHAIN[idx + 1];
  return buildYoutubeThumbnailUrlByQuality(parsed.videoId, next);
}

/** videoId から通常の YouTube watch URL を組み立てる (canonical URL)。 */
export function buildYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
