import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from './ListingCard';

export interface ListingGridProps {
  listings: MockListing[];
  onAddToTour: (id: string) => void;
}

/**
 * 探すページ中央のグリッド。上部に [一覧|マップ|ルート] 切替 (第1スパンは一覧のみ実装)。
 * マップ/ルートは地図配線が要るため次スパンで有効化する (今は disabled)。
 */
export const ListingGrid: React.FC<ListingGridProps> = ({ listings, onAddToTour }) => {
  const { t } = useTranslation();
  return (
    <div className="housing-listing-grid-wrap">
      <div className="housing-listing-grid-toolbar">
        <div className="housing-view-toggle" role="tablist" aria-label={t('housing.browse.view_aria')}>
          <button type="button" role="tab" aria-selected className="housing-view-tab is-active">
            {t('housing.browse.view_list')}
          </button>
          <button type="button" role="tab" aria-selected={false} className="housing-view-tab" disabled>
            {t('housing.browse.view_map')}
          </button>
          <button type="button" role="tab" aria-selected={false} className="housing-view-tab" disabled>
            {t('housing.browse.view_route')}
          </button>
        </div>
        <span className="housing-listing-grid-count">{listings.length}</span>
      </div>
      <div className="housing-listing-grid">
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} onAddToTour={onAddToTour} />
        ))}
      </div>
    </div>
  );
};
