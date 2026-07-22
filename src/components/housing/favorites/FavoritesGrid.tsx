import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from '../browse/ListingCard';
import { useListScrollRestore } from '../../../lib/housing/useListScrollRestore';

export interface FavoritesGridProps {
  listings: MockListing[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onAddToTour: (id: string) => void;
}

/**
 * お気に入りページ中央グリッド。
 * ListingCard を selectable モードで並べる。
 * - 件数見出し / タブ: Task4 で追加
 * - 空状態: Task2 の FavoritesPage が担うため、ここは非空前提
 * - グリッドレイアウトは探すと共通の housing-listing-grid を再利用
 * - スクロール位置の保存・復元は 'favorites' キー固定 (このグリッドは常にお気に入り専用)。
 */
export const FavoritesGrid: React.FC<FavoritesGridProps> = ({
  listings,
  selected,
  onToggleSelect,
  onAddToTour,
}) => {
  const containerRef = useListScrollRestore('favorites');
  return (
    <div className="housing-listing-grid" data-testid="housing-favorites-grid" ref={containerRef}>
      {listings.map((l) => (
        <ListingCard
          key={l.id}
          listing={l}
          selectable
          selected={selected.has(l.id)}
          onToggleSelect={onToggleSelect}
          onAddToTour={onAddToTour}
        />
      ))}
    </div>
  );
};
