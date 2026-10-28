/**
 * ハウジング登録の画像 URL の安全確認 (host allowlist・https・private IP 除外など) の部品。
 * validateImage / buildListingImageFields (housingImageValidation.ts) が使う。
 */
import { isOgpUrlAllowed } from '../lib/housing/ogpHostAllowlist.js';
import { parseTweetUrl } from '../lib/housing/tweetUrlParse.js';
import { parseYoutubeUrl } from '../lib/housing/youtubeUrl.js';

export function isHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isPbsTwimgHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).hostname === 'pbs.twimg.com';
  } catch {
    return false;
  }
}

/**
 * 2026-05-27: Twitter 動画 mp4 URL のホスト検証 (video.twimg.com 限定)。
 * 表示時は /api/tweet-video?url= proxy 経由で <video> 再生するが、 保存時点で
 * host を絞ることで任意 URL 注入を防ぐ。
 */
export function isVideoTwimgHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'video.twimg.com';
  } catch {
    return false;
  }
}

/**
 * sourceImageUrls の各 URL が「Firestore に保存して `<img src>` 直接表示するのに安全」 か判定。
 * - https 必須
 * - private IP (10.x / 127.x / 169.254.x / 172.16-31.x / 192.168.x / 0.x) 拒否
 *
 * 注: OGP 経由で取得した時点で api/og.ts の isImageUrlSafe を通過済みだが、
 * 悪意あるクライアントが直接 API を叩く可能性に備えてサーバー側で再 check する。
 */
export function isExternalImageUrlSafe(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return false;
    const ipv4 = u.hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const a = Number(ipv4[1]);
      const b = Number(ipv4[2]);
      if (
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 0
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Firestore に保存する sourceImageUrls の最大件数 (サニティ防御兼ねる)。
 * 2026-05-27: 4 → 10 に拡大 (画像は外部 URL 直接表示で LoPo 帯域消費ゼロ、 Firestore doc 1MB
 * からも十二分、 housingsnap で 12 枚撮れる物件の取りこぼし防止)。
 */
export const MAX_SOURCE_IMAGE_URLS = 10;

/** 2026-07-21 追加 (Batch2): 1物件に貼れる投稿URLの最大数。 */
export const MAX_SOURCE_POST_URLS = 5;

// 2026-05-26: YouTube サムネ用 host allowlist (任意 URL 注入を防ぐ)。
const YOUTUBE_THUMB_HOSTS = new Set(['img.youtube.com', 'i.ytimg.com']);
export function isYoutubeThumbHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return YOUTUBE_THUMB_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * postUrl (元の投稿へのリンク) が、URL 貼り付け時に許可されているのと同じ種別
 * (Twitter/X の投稿URL・YouTube・OGP allowlist) のいずれかに一致するか判定する。
 * `classifySnsUrl` (src/lib/housing/snsUrlRouting.ts) が使う判定関数と完全に同一のものを
 * 再利用しているため、URL 貼り付け時に成功した postUrl はここでも必ず ok になる。
 */
export function isKnownPostUrlHost(url: string): boolean {
  if (!isHttpsUrl(url)) return false;
  return parseTweetUrl(url) !== null || parseYoutubeUrl(url) !== null || isOgpUrlAllowed(url);
}
