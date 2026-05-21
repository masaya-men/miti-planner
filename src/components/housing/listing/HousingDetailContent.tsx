/**
 * Phase 3: 物件詳細の中身 (モーダルとフルページの両方で共有)
 *
 * - 左: 写真ギャラリー
 * - 右: タイトル / 住所行 / タグ / 説明 / アクションバー
 * - レイアウトは housing.css のグリッドで制御
 */
import type { HousingListing } from '../../../types/housing';
import { HousingPhotoGallery } from './HousingPhotoGallery';
import { HousingActionBar } from './HousingActionBar';

export interface HousingDetailContentProps {
  listing: HousingListing;
  viewerUid: string | null;
  onClose?: () => void;
}

export const HousingDetailContent: React.FC<HousingDetailContentProps> = ({
  listing,
  viewerUid,
  onClose,
}) => {
  const title = listing.description?.trim()
    ? listing.description
    : `${listing.area} Ward ${listing.ward}`;
  return (
    <div className="housing-detail-content">
      <div className="housing-detail-gallery">
        <HousingPhotoGallery listing={listing} />
      </div>
      <div className="housing-detail-info">
        <h2 className="housing-detail-title">{title}</h2>
        <p className="housing-detail-address">
          {listing.dc} / {listing.server} / {listing.area} / Ward {listing.ward}
          {listing.plot != null && ` / Plot ${listing.plot}`}
          {listing.roomNumber != null && ` / Room ${listing.roomNumber}`}
        </p>
        {listing.tags.length > 0 && (
          <ul className="housing-detail-tags">
            {listing.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        {listing.description && (
          <p className="housing-detail-description">{listing.description}</p>
        )}
        <div className="housing-detail-actions">
          <HousingActionBar
            listing={listing}
            viewerUid={viewerUid}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};
