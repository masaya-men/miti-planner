/**
 * Phase 3: 物件詳細の写真ギャラリー (Phase 3 では 1 枚表示のみ)
 *
 * - 写真がある場合: 1 枚目を大きく表示 (object-fit: contain)
 * - 写真がない場合: プレースホルダ
 * - サムネ一覧やライトボックスは Phase 4 以降
 */
import type { HousingListing } from '../../../types/housing';

export interface HousingPhotoGalleryProps {
  listing: HousingListing;
}

function resolveSource(listing: HousingListing): string | null {
  if (listing.imageMode === 'thumbnail' && listing.thumbnailPath) return listing.thumbnailPath;
  if (listing.imageMode === 'sns' && listing.ogImageUrl) return listing.ogImageUrl;
  return null;
}

export const HousingPhotoGallery: React.FC<HousingPhotoGalleryProps> = ({ listing }) => {
  const src = resolveSource(listing);
  if (!src) {
    return (
      <div className="housing-gallery-empty" aria-hidden="true">
        <span>No image</span>
      </div>
    );
  }
  return (
    <div className="housing-gallery">
      <img src={src} alt="" loading="lazy" className="housing-gallery-main" />
    </div>
  );
};
