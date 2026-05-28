import type { MockListing } from '../../data/housing/mockListings';

/** カバー縦横比 (w/h) が取得できないカードのフォールバック。4:5 縦長 (Pinterest 風)。 */
export const DEFAULT_COVER_ASPECT_RATIO = 0.8;

/**
 * カードのカバー（詳細ギャラリー1枚目に一致）の縦横比 (w/h) を解決する。
 * 動画があれば videoAspectRatio、 無ければ静止画 1 枚目の比、 どちらも無ければ既定値。
 * HousingCard の表示と masonry の高さ計算で同じ値を使うために集約。
 */
export function resolveCoverAspectRatio(listing: MockListing): number {
  const isVideo = Boolean(listing.videoUrl) || Boolean(listing.youtubeVideoId);
  if (isVideo && typeof listing.videoAspectRatio === 'number' && listing.videoAspectRatio > 0) {
    return listing.videoAspectRatio;
  }
  const firstPhoto = listing.sourceImageAspectRatios?.[0];
  if (typeof firstPhoto === 'number' && firstPhoto > 0) {
    return firstPhoto;
  }
  return DEFAULT_COVER_ASPECT_RATIO;
}
