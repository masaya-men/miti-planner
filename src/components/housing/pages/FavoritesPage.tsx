import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { expandTourWithDuplicates } from '../../../lib/housing/expandTourWithDuplicates';
import { showToast } from '../../Toast';
import { FavoritesGrid } from '../favorites/FavoritesGrid';
import { FavoritesTabs } from '../favorites/FavoritesTabs';
import { FavoritesBulkBar } from '../favorites/FavoritesBulkBar';
import { FavoritesOnboarding } from '../favorites/FavoritesOnboarding';
import { TourTray } from '../browse/TourTray';
import { MannerNoticeDialog, isMannerNoticeDismissed } from '../workspace/MannerNoticeDialog';
import { orderFavorites } from '../favorites/favoritesOrder';
import type { FavTab } from '../favorites/favoritesOrder';

/**
 * お気に入りページ (3カラム): 左=オンボ(後続タスク) / 中央=お気に入りグリッド / 右=トレイ。
 * Task5: 一括バー + 選択→トレイ配線 + 重複自動追加 (expandTourWithDuplicates)。
 */
export const FavoritesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const ids = useHousingFavoritesStore((s) => s.ids);
  const allListings = useHousingListingsStore((s) => s.listings);
  const status = useHousingListingsStore((s) => s.status);

  // タブ状態 (すべて/最近追加)
  const [tab, setTab] = useState<FavTab>('all');

  // ids → orderFavorites で並び替え
  const listings = orderFavorites(ids, allListings, tab);

  // 選択状態
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const handleToggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ツアートレイのドラフト (このページローカル)
  const [trayIds, setTrayIds] = useState<string[]>([]);

  // マナー通知ダイアログ
  const [mannerOpen, setMannerOpen] = useState(false);

  /**
   * 複数 id をトレイへ追加する。expandTourWithDuplicates で同住所の重複を自動追加。
   * setState updater 内で副作用(トースト)は出さないよう、計算を先に行う。
   */
  const addToTray = useCallback((idsToAdd: string[]) => {
    let nextIds = trayIds;
    let totalAutoAdded = 0;
    for (const addId of idsToAdd) {
      const r = expandTourWithDuplicates(nextIds, addId, allListings);
      if (r.nextIds.length === nextIds.length) continue;
      nextIds = r.nextIds;
      totalAutoAdded += r.autoAddedCount;
    }
    if (nextIds.length === trayIds.length) return; // 何も増えない
    setTrayIds(nextIds);
    if (totalAutoAdded > 0) {
      showToast(t('housing.workspace.tour.auto_added_toast', { count: totalAutoAdded }), 'info');
    }
  }, [trayIds, allListings, t]);

  // ハンドラ群
  const handleAddToTour = useCallback((id: string) => addToTray([id]), [addToTray]);

  const handleAddSelected = useCallback(() => {
    addToTray(Array.from(selected));
  }, [addToTray, selected]);

  const handleAddAll = useCallback(() => {
    addToTray(listings.map((l) => l.id));
  }, [addToTray, listings]);

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(listings.map((l) => l.id)));
  }, [listings]);

  const handleClearSelect = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleRemoveFromFav = useCallback(() => {
    const toRemove = Array.from(selected);
    toRemove.forEach((id) => useHousingFavoritesStore.getState().remove(id));
    setSelected(new Set());
  }, [selected]);

  // ツアー開始: マナー通知 dismiss 済みなら直接、未 dismiss ならダイアログを挟む
  const commitStart = useCallback(() => {
    if (trayIds.length === 0) return;
    useHousingTourStore.getState().setListings(trayIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    setMannerOpen(false);
    navigate('/housing/tour');
  }, [trayIds, navigate]);

  const handleStart = useCallback(() => {
    if (trayIds.length === 0) return;
    if (isMannerNoticeDismissed()) {
      commitStart();
    } else {
      setMannerOpen(true);
    }
  }, [trayIds, commitStart]);

  return (
    <div className="housing-browse">
      {/* 左カラム: オンボーディング (はじめての方へ・教育のみ) */}
      <section className="housing-browse-panel" data-region="left">
        <div className="housing-browse-col housing-browse-col-left">
          <FavoritesOnboarding />
        </div>
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
            /* 正常表示: 見出し → タブ → 一括バー → グリッド */
            <div className="housing-listing-grid-wrap" data-testid="housing-favorites-content">
              <div className="housing-listing-grid-toolbar">
                <h2 className="housing-listing-grid-heading">
                  {t('housing.favorites.title')}
                  <span className="housing-listing-grid-count">
                    {t('housing.browse.count_unit', { count: listings.length })}
                  </span>
                </h2>
              </div>
              <FavoritesTabs
                tab={tab}
                onChange={setTab}
              />
              <FavoritesBulkBar
                total={listings.length}
                selectedCount={selected.size}
                onSelectAll={handleSelectAll}
                onClearSelect={handleClearSelect}
                onAddAll={handleAddAll}
                onAddSelected={handleAddSelected}
                onRemoveFromFav={handleRemoveFromFav}
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

      {/* 右カラム: ツアートレイ */}
      <section className="housing-browse-panel" data-region="right">
        <div className="housing-browse-col housing-browse-col-right">
          <TourTray listingIds={trayIds} onChange={setTrayIds} onStart={handleStart} />
        </div>
      </section>

      <MannerNoticeDialog
        open={mannerOpen}
        onCancel={() => setMannerOpen(false)}
        onStart={commitStart}
      />
    </div>
  );
};
