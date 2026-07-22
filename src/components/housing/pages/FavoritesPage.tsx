import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { expandTourWithDuplicates } from '../../../lib/housing/expandTourWithDuplicates';
import { mergeListingsForViewer } from '../../../lib/housing/listingPublish';
import { sortListingsForGallery } from '../../../lib/housing/sortListingsForGallery';
import { canAddToTour, tourAnchorRegion, tourRegionConflict } from '../../../lib/housing/tourCrossing';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import type { MockListing } from '../../../data/housing/mockListings';
import { showToast } from '../../Toast';
import { FavoritesGrid } from '../favorites/FavoritesGrid';
import { FavoritesTabs } from '../favorites/FavoritesTabs';
import { FavoritesBulkBar } from '../favorites/FavoritesBulkBar';
import { FavoritesOnboarding } from '../favorites/FavoritesOnboarding';
import { TourTray } from '../browse/TourTray';
import { MannerNoticeDialog } from '../workspace/MannerNoticeDialog';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { orderFavorites } from '../favorites/favoritesOrder';
import type { FavTab } from '../favorites/favoritesOrder';
import { resolveTourOrder } from '../../../lib/housing/resolveTourOrder';
import { useHousingListOrderStore } from '../../../store/useHousingListOrderStore';

/**
 * お気に入りページ (3カラム): 左=オンボ(後続タスク) / 中央=お気に入りグリッド / 右=トレイ。
 * Task5: 一括バー + 選択→トレイ配線 + 重複自動追加 (expandTourWithDuplicates)。
 */
export const FavoritesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const ids = useHousingFavoritesStore((s) => s.ids);
  const publicListings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const status = useHousingListingsStore((s) => s.status);
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  // spec A-3: 公開一覧 + 自分の登録 (非公開/期限切れ含む) を合流。他人視点の表示は不変。
  const allListings = useMemo(
    () => sortListingsForGallery(mergeListingsForViewer(publicListings, myListings, uid, Date.now())),
    [publicListings, myListings, uid],
  );

  // タブ状態 (すべて/最近追加)。探す/ハウジンガーと同じストアに保持し、詳細ページ往復で保持する。
  const tab = useHousingListOrderStore((s) => s.entries.favorites.favTab);
  const setTab = (v: FavTab) => useHousingListOrderStore.getState().setFavTab('favorites', v);

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

  // ツアートレイのドラフト (#5: ページ横断で保持するストア。詳細ページ往復で消えない)
  const trayIds = useTourTrayStore((s) => s.trayIds);
  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
  // ツアー順制御 (ドラッグ並び替え + ピン留め): resolveTourOrder が参照する。
  const pinnedIds = useTourTrayStore((s) => s.pinnedIds);
  const manualOrder = useTourTrayStore((s) => s.manualOrder);

  // マナー通知ダイアログ
  const [mannerOpen, setMannerOpen] = useState(false);

  /**
   * 複数 id をトレイへ追加する。expandTourWithDuplicates で同住所の重複を自動追加。
   * setState updater 内で副作用(トースト)は出さないよう、計算を先に行う。
   */
  const addToTray = useCallback((idsToAdd: string[]) => {
    const eph = useEphemeralListingsStore.getState().ephemeralListings;
    const pool = [...allListings, ...eph];
    const regionOf = (id: string) => pool.find((l) => l.id === id)?.region ?? null;
    let nextIds = trayIds;
    let totalAutoAdded = 0;
    let blocked = false;
    for (const addId of idsToAdd) {
      // unlisted は住所が無くツアーに使えない (一括「すべて/選択を追加」がカードボタンを迂回するため
      // ここでも弾く・§8.4/deviation 3)。
      if (pool.find((l) => l.id === addId)?.visibility === 'unlisted') continue;
      // 非OCEアンカー地域 (OCEは混在可なので除外・OCE先頭でも正しくアンカーを取る)。
      const trayRegion = tourAnchorRegion(nextIds.map(regionOf));
      const candRegion = regionOf(addId);
      if (candRegion !== null && !canAddToTour(trayRegion, candRegion)) { blocked = true; continue; }
      if (isEphemeralListingId(addId)) {
        if (!nextIds.includes(addId)) nextIds = [...nextIds, addId];
        continue;
      }
      const r = expandTourWithDuplicates(nextIds, addId, allListings);
      if (r.nextIds.length === nextIds.length) continue;
      nextIds = r.nextIds;
      totalAutoAdded += r.autoAddedCount;
    }
    if (nextIds.length !== trayIds.length) {
      setTrayIds(nextIds);
      if (totalAutoAdded > 0) {
        showToast(t('housing.workspace.tour.auto_added_toast', { count: totalAutoAdded }), 'info');
      }
    }
    if (blocked) showToast(t('housing.tour.region_block'), 'error');
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
    // ツアー解決は allListings (お気に入り一覧・非汚染) + 一時 listing。一覧自体は変えない。
    const pool = [...allListings, ...ephemeral];
    const orderedIds = resolveTourOrder(trayIds, pool, { pinnedIds, manualOrder });
    const stops = orderedIds
      .map((id) => pool.find((l) => l.id === id))
      .filter((l): l is MockListing => Boolean(l));
    const conflict = tourRegionConflict(stops);
    if (conflict) {
      showToast(t('housing.tour.region_block_start', { regions: conflict.join(' / ') }), 'error');
      return;
    }
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    useTourTrayStore.getState().clear();
    setMannerOpen(false);
    navigate('/housing/tour');
  }, [trayIds, allListings, ephemeral, pinnedIds, manualOrder, navigate, t]);

  const handleStart = useCallback(() => {
    if (trayIds.length === 0) return;
    // #4: 「次回から表示しない」は廃止。開始のたびに毎回マナー確認を出す。
    setMannerOpen(true);
  }, [trayIds]);

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
                {/* 実機FB第2弾#3: スマホは一括バーが下でスクロールされがちなので、見出し行にも複製する。 */}
                {isMobile && (
                  <button
                    type="button"
                    className="housing-fav-addall-top"
                    onClick={handleAddAll}
                    disabled={listings.length === 0}
                  >
                    {t('housing.favorites.bulk_add_all')}
                  </button>
                )}
              </div>
              {/* 実機FB第5弾: スマホは「タブ + 選択カウント」を1行に同居させ、常に2行構成
                  (タブ行 / ボタン行) に固定する。ラッパは PC では display:contents で無害。 */}
              <div className="housing-fav-tabsrow">
                <FavoritesTabs
                  tab={tab}
                  onChange={setTab}
                />
                {isMobile && selected.size > 0 && (
                  <span className="housing-fav-selcount">
                    {t('housing.favorites.bulk_selected_count', { count: selected.size })}
                  </span>
                )}
              </div>
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
          <TourTray listingIds={trayIds} onChange={setTrayIds} onStart={handleStart} onAdd={(id) => addToTray([id])} />
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
