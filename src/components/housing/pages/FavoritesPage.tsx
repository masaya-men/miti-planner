import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { FavoritesGrid } from '../favorites/FavoritesGrid';

/**
 * お気に入りページ (3カラム): 左=オンボ(後続タスク) / 中央=お気に入りグリッド / 右=トレイ(後続タスク)。
 * Task2 はカラム骨組みと空状態のみ。Task3 で中央グリッドを結線。
 */
export const FavoritesPage: React.FC = () => {
  const { t } = useTranslation();
  const ids = useHousingFavoritesStore((s) => s.ids);
  const allListings = useHousingListingsStore((s) => s.listings);

  // ids → listings に解決 (順序は ids の順を維持)
  const listings = ids
    .map((id) => allListings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => l != null);

  // 選択状態 (Task4 一括操作バーで使う)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const handleToggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Task5 でトレイに配線する
  const handleAddToTour = useCallback((_id: string) => {
    // TODO(Task5): ツアートレイへの追加を配線する
  }, []);

  return (
    <div className="housing-browse">
      {/* 左カラム: オンボーディング (Task6 で実装) */}
      <section className="housing-browse-panel" data-region="left">
        <div className="housing-browse-col housing-browse-col-left" />
      </section>

      {/* 中央カラム: お気に入りグリッド */}
      <section className="housing-browse-panel" data-region="center">
        <div className="housing-browse-col housing-browse-col-center">
          {ids.length === 0 ? (
            <div
              className="housing-center-loading"
              data-testid="housing-favorites-empty"
            >
              {t('housing.favorites.empty')}
            </div>
          ) : (
            <FavoritesGrid
              listings={listings}
              selected={selected}
              onToggleSelect={handleToggleSelect}
              onAddToTour={handleAddToTour}
            />
          )}
        </div>
      </section>

      {/* 右カラム: トレイ (後続タスクで実装) */}
      <section className="housing-browse-panel" data-region="right">
        <div className="housing-browse-col housing-browse-col-right" />
      </section>
    </div>
  );
};
