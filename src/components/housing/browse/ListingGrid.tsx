import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from './ListingCard';
import { BrowseSortSelect, type BrowseSortOrder } from './BrowseSortSelect';

export interface ListingGridProps {
  listings: MockListing[];
  /** 未指定ならカードの「ツアーに追加」ボタン自体を出さない (例: ハウジンガーページの一覧)。 */
  onAddToTour?: (id: string) => void;
  sort: BrowseSortOrder;
  onSortChange: (v: BrowseSortOrder) => void;
}

/**
 * 探すページ中央のグリッド。上部ツールバー = 「ハウジング一覧 N件」見出し + 並び替え。
 * ビュー切替 [一覧|マップ|ルート] は地図配線 (M1) が済むまで出さない
 * (未配線の disabled タブは「壊れて見える」ため、実装スパンで復活させる)。
 */
export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  onAddToTour,
  sort,
  onSortChange,
}) => {
  const { t } = useTranslation();
  return (
    <div className="housing-listing-grid-wrap">
      <div className="housing-listing-grid-toolbar">
        <h2 className="housing-listing-grid-heading">
          {t('housing.browse.listings_label')}
          <span className="housing-listing-grid-count">
            {t('housing.browse.count_unit', { count: listings.length })}
          </span>
        </h2>
        <BrowseSortSelect value={sort} onChange={onSortChange} />
      </div>
      <div className="housing-listing-grid">
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} onAddToTour={onAddToTour} />
        ))}
      </div>
    </div>
  );
};
