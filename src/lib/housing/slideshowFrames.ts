import type { HousingListing } from '../../types/housing';

export type SlideshowFrame = {
  readonly src: string;
  readonly fallback?: string;
};

/**
 * カード ambient slideshow に使う静止画フレーム配列を listing から構築する。
 * 優先順位:
 *   1. sourceImageUrls (OGP / Twitter 静止画ツイート、 複数枚)
 *   2. youtubeVideoId (storyboard hqdefault + hq1 + hq2 の 3 枚、 fallback `1.jpg` / `2.jpg`)
 *   3. videoPosterUrl (Twitter 動画 only ツイート、 1 枚)
 *   4. thumbnailPaths (旧データ、 Storage 保存済)
 *   5. thumbnailPath (= 1 枚旧データ)
 *   6. ogImageUrl (テキストツイート等の最終 fallback、 1 枚)
 *   7. なし (= 空配列、 カードは "No image" 状態)
 */
export function resolveSlideshowFrames(
  listing: HousingListing,
): readonly SlideshowFrame[] {
  if (Array.isArray(listing.sourceImageUrls) && listing.sourceImageUrls.length > 0) {
    return listing.sourceImageUrls.map((src) => ({ src }));
  }
  if (listing.youtubeVideoId) {
    const base = `https://i.ytimg.com/vi/${listing.youtubeVideoId}`;
    return [
      { src: `${base}/hqdefault.jpg` },
      { src: `${base}/hq1.jpg`, fallback: `${base}/1.jpg` },
      { src: `${base}/hq2.jpg`, fallback: `${base}/2.jpg` },
    ];
  }
  if (listing.videoPosterUrl) {
    return [{ src: listing.videoPosterUrl }];
  }
  if (Array.isArray(listing.thumbnailPaths) && listing.thumbnailPaths.length > 0) {
    return listing.thumbnailPaths.map((src) => ({ src }));
  }
  if (listing.thumbnailPath) {
    return [{ src: listing.thumbnailPath }];
  }
  if (listing.ogImageUrl) {
    return [{ src: listing.ogImageUrl }];
  }
  return [];
}
