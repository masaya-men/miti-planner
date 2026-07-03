import type { MockListing } from '../../data/housing/mockListings';

/**
 * 代表画像 URL の解決 (純関数)。
 *
 * imageMode ('thumbnail' | 'sns' | 'none') に応じて thumbnailPath / ogImageUrl を
 * 優先し、無ければプレースホルダにフォールバックする。
 *
 * 2026-07-04 (Task6): ListingCard.tsx / TourProgressPanel.tsx に同一ロジックが
 * 複製されていた (rule of three) ため切り出し。TourNextDestinationPanel.tsx と
 * TourProgressPanel.tsx はこのヘルパを使う。既出荷の ListingCard.tsx /
 * FavoritesPreviewStrip.tsx のローカル実装は回帰リスク回避のためあえて置換しない
 * (将来別途移行)。
 */
const PLACEHOLDER = '/housing/mock-thumbs/1.svg';

export function representativeImage(listing: MockListing): string {
  if (listing.imageMode === 'thumbnail' && listing.thumbnailPath) return listing.thumbnailPath;
  if (listing.imageMode === 'sns' && listing.ogImageUrl) return listing.ogImageUrl;
  return PLACEHOLDER;
}
