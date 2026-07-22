import { useTranslation } from 'react-i18next';
import { Shuffle } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from './ListingCard';
import { BrowseSortSelect, type BrowseSortOrder } from './BrowseSortSelect';
import { useHousingListOrderStore, type HousingListKey } from '../../../store/useHousingListOrderStore';
import { useListScrollRestore } from '../../../lib/housing/useListScrollRestore';

export interface ListingGridProps {
  listings: MockListing[];
  /** 未指定ならカードの「ツアーに追加」ボタン自体を出さない (例: ハウジンガーページの一覧)。 */
  onAddToTour?: (id: string) => void;
  sort: BrowseSortOrder;
  onSortChange: (v: BrowseSortOrder) => void;
  /** スクロール位置の保存・復元、シャッフルボタンの対象キー。 */
  listKey: HousingListKey;
  /** BrowseSortSelect へ渡す選択肢一覧。未指定なら新着順/古い順の2択 (既存仕様)。 */
  sortOrders?: BrowseSortOrder[];
}

/**
 * 探すページ中央のグリッド (ハウジンガーページでも再利用)。上部ツールバー = 「ハウジング一覧 N件」見出し + 並び替え。
 * ビュー切替 [一覧|マップ|ルート] は地図配線 (M1) が済むまで出さない
 * (未配線の disabled タブは「壊れて見える」ため、実装スパンで復活させる)。
 */
export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  onAddToTour,
  sort,
  onSortChange,
  listKey,
  sortOrders,
}) => {
  const { t } = useTranslation();
  const containerRef = useListScrollRestore(listKey);

  const onShuffle = () => {
    useHousingListOrderStore.getState().reshuffle(listKey);
    useHousingListOrderStore.getState().setScrollTop(listKey, 0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  };

  return (
    <div className="housing-listing-grid-wrap">
      <div className="housing-listing-grid-toolbar">
        <h2 className="housing-listing-grid-heading">
          {t('housing.browse.listings_label')}
          <span className="housing-listing-grid-count">
            {t('housing.browse.count_unit', { count: listings.length })}
          </span>
        </h2>
        <div className="housing-listing-grid-toolbar-actions">
          {sort === 'random' && (
            <button
              type="button"
              className="housing-shuffle-btn"
              aria-label={t('housing.browse.shuffle_button')}
              onClick={onShuffle}
            >
              <Shuffle size={16} aria-hidden="true" />
            </button>
          )}
          <BrowseSortSelect value={sort} onChange={onSortChange} orders={sortOrders} />
        </div>
      </div>
      <div className="housing-listing-grid" ref={containerRef}>
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} onAddToTour={onAddToTour} />
        ))}
      </div>
    </div>
  );
};
