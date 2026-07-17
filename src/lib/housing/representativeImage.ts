import type { MockListing } from '../../data/housing/mockListings';

/**
 * 代表画像 URL の解決 (純関数)。
 *
 * imageMode ('thumbnail' | 'sns' | 'none') に応じて thumbnailPath / ogImageUrl を
 * 優先し、無ければプレースホルダにフォールバックする。
 *
 * 2026-07-04 (Task6): TourProgressPanel.tsx に同一ロジックが複製されていた
 * (rule of three) ため切り出し。TourShowcasePanel.tsx と TourProgressPanel.tsx は
 * このヘルパを使う。
 * 2026-07-10 (地図表示モード計画 Task1): ListingCard.tsx のローカル実装をこちらへ
 * 移設 (挙動変更なし)。地図モードの拡大カード (Task2予定の MapSpotCard 等) からも
 * 代表画像を参照する見込みのため、プレースホルダ定数を export する。
 * FavoritesPreviewStrip.tsx のローカル実装はスコープ外のためまだ移設していない
 * (将来別途移行)。
 */
export const LISTING_IMAGE_PLACEHOLDER = '/housing/mock-thumbs/1.svg';

export function representativeImage(listing: MockListing): string {
  if (listing.imageMode === 'thumbnail' && listing.thumbnailPath) return listing.thumbnailPath;
  if (listing.imageMode === 'sns' && listing.ogImageUrl) return listing.ogImageUrl;
  return LISTING_IMAGE_PLACEHOLDER;
}

/**
 * 実画像 (thumbnailPath / ogImageUrl) を持つかどうか。
 * false = representativeImage() がプレースホルダ SVG にフォールバックする状態。
 * ツアートレイの行サムネ (TourTrayList) 等、プレースホルダ画像そのものを出さず
 * アイコン枠に切り替えたい呼び出し元向け (2026-07-17)。
 */
export function hasRepresentativeImage(listing: MockListing): boolean {
  return (
    (listing.imageMode === 'thumbnail' && Boolean(listing.thumbnailPath)) ||
    (listing.imageMode === 'sns' && Boolean(listing.ogImageUrl))
  );
}
