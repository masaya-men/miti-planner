import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { FavoritesGrid } from '../favorites/FavoritesGrid';
import { FavoritesTabs } from '../favorites/FavoritesTabs';
import { orderFavorites } from '../favorites/favoritesOrder';
import type { FavTab } from '../favorites/favoritesOrder';

/**
 * お気に入りページ (3カラム): 左=オンボ(後続タスク) / 中央=お気に入りグリッド / 右=トレイ(後続タスク)。
 * Task4: 中央に すべて/最近追加タブ + orderFavorites による並び替え + ロードガード追加。
 */
export const FavoritesPage: React.FC = () => {
  const { t } = useTranslation();
  const ids = useHousingFavoritesStore((s) => s.ids);
  const allListings = useHousingListingsStore((s) => s.listings);
  const status = useHousingListingsStore((s) => s.status);

  // タブ状態 (すべて/最近追加)
  const [tab, setTab] = useState<FavTab>('all');

  // ids → orderFavorites で並び替え
  const listings = orderFavorites(ids, allListings, tab);

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
            /* favorites 自体が無い: 空状態 */
            <div
              className="housing-center-loading"
              data-testid="housing-favorites-empty"
            >
              {t('housing.favorites.empty')}
            </div>
          ) : status === 'loading' || status === 'idle' ? (
            /* listings ストアがまだ読込中 */
            <div className="housing-center-loading">
              {t('housing.gallery.loading')}
            </div>
          ) : status === 'error' ? (
            /* listings ストアが読込エラー */
            <div className="housing-center-error">
              {t('housing.gallery.error')}
            </div>
          ) : (
            /* 正常表示: 見出し + タブ + グリッド */
            <div className="housing-listing-grid-wrap" data-testid="housing-favorites-content">
              <div className="housing-listing-grid-toolbar">
                <h2 className="housing-listing-grid-heading">
                  {t('housing.favorites.title')}
                  <span className="housing-listing-grid-count">
                    {t('housing.browse.count_unit', { count: ids.length })}
                  </span>
                </h2>
              </div>
              <FavoritesTabs
                tab={tab}
                onChange={setTab}
                counts={{ all: ids.length, recent: ids.length }}
              />
              <FavoritesGrid
                listings={listings}
                selected={selected}
                onToggleSelect={handleToggleSelect}
                onAddToTour={handleAddToTour}
              />
            </div>
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
