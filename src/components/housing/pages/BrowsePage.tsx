import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { useKeywordFilteredListings } from '../../../lib/housing/useKeywordFilteredListings';
import { mergeListingsForViewer } from '../../../lib/housing/listingPublish';
import { sortListingsForGallery } from '../../../lib/housing/sortListingsForGallery';
import { canAddToTour, tourAnchorRegion, tourRegionConflict } from '../../../lib/housing/tourCrossing';
import type { MockListing } from '../../../data/housing/mockListings';
import { showToast } from '../../Toast';
import { FilterPanel } from '../workspace/FilterPanel';
import { EmptyResult } from '../workspace/EmptyResult';
import { PersonalTagFilterLink } from '../workspace/PersonalTagFilterLink';
import { ListingGrid } from '../browse/ListingGrid';
import type { BrowseSortOrder } from '../browse/BrowseSortSelect';
import { BrowseViewToggle } from '../browse/BrowseViewToggle';
import { BrowseMapView } from '../browse/map/BrowseMapView';
import { TourTray } from '../browse/TourTray';
import { MannerNoticeDialog } from '../workspace/MannerNoticeDialog';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { FavoritesPreviewStrip } from '../browse/FavoritesPreviewStrip';
import { orderTourStopIds } from '../../../lib/housing/orderTourStops';
import { PERSONAL_TAG_ID_PREFIX } from '../../../constants/housing';

/**
 * 探すページ (3カラム): 左=フィルター / 中央=物件グリッド / 右=ツアートレイ。
 * 実データは useHousingListingsStore (Firestore)。フィルターは applyFilters (既存)。
 */
export const BrowsePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const status = useHousingListingsStore((s) => s.status);
  const listings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  // 中央の表示切替 (一覧 | 地図)。セッション記憶 (spec 3.1)。
  const browseView = useHousingViewStore((s) => s.browseView);
  const setBrowseView = useHousingViewStore((s) => s.setBrowseView);

  const dc = useHousingFilterStore((s) => s.dc);
  const regions = useHousingFilterStore((s) => s.regions);
  const servers = useHousingFilterStore((s) => s.servers);
  const areas = useHousingFilterStore((s) => s.areas);
  const sizes = useHousingFilterStore((s) => s.sizes);
  const tags = useHousingFilterStore((s) => s.tags);
  const keyword = useHousingFilterStore((s) => s.keyword);
  // f: 中央フィルター解除ボタンの表示条件。FilterPanel.tsx:100-102 の hasActiveFilter と同じ式
  // (keyword は対象外・据え置き)。
  const hasActiveFilter =
    Boolean(dc) || regions.length > 0 || servers.length > 0 ||
    areas.length > 0 || sizes.length > 0 || tags.length > 0;

  // spec A-3: 公開一覧 + 自分の登録 (非公開/期限切れ含む) を合流。他人視点の表示は不変。
  const merged = useMemo(
    () => sortListingsForGallery(mergeListingsForViewer(listings, myListings, uid, Date.now())),
    [listings, myListings, uid],
  );

  const filteredBase = useMemo(
    () => applyFilters(merged, { dc, regions, servers, areas, sizes, tags }),
    [merged, dc, regions, servers, areas, sizes, tags],
  );
  // keyword は applyFilters(純関数)の後段で適用する (表示名解決に i18n が要るため別レイヤー)。
  const filtered = useKeywordFilteredListings(filteredBase, keyword);

  // 個人タグ 1 つで絞り込み中のとき、 結果一覧の上に「◯◯のハウジンガーページを見る →」リンクを出す
  // (spec 2026-07-10-housinger-profile-design.md §3.3 統合契約4)。
  const personalTagIds = useMemo(
    () => tags.filter((id) => id.startsWith(PERSONAL_TAG_ID_PREFIX)),
    [tags],
  );

  // 並び替え (参考UI「新着順/古い順」)。createdAt を key に client-side sort。
  const [sort, setSort] = useState<BrowseSortOrder>('newest');
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
      ),
    [filtered, sort],
  );

  // ツアートレイのドラフト (#5: ページ横断で保持するストア。詳細ページ往復で消えない)。開始時に tour store へ確定する。
  const trayIds = useTourTrayStore((s) => s.trayIds);
  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
  // マナー通知ダイアログ (#4: 開始のたびに毎回表示)。
  const [mannerOpen, setMannerOpen] = useState(false);
  const addToTray = (id: string) => {
    // 一時 listing は追加直後の stale closure を避けるためストアから fresh に解決する。
    const eph = useEphemeralListingsStore.getState().ephemeralListings;
    const candidate = merged.find((l) => l.id === id) ?? eph.find((l) => l.id === id);
    if (!candidate) return;
    // unlisted は住所が無くツアーに使えない (§8.4・カードボタンは無効だが防御多重化)。
    if (candidate.visibility === 'unlisted') return;
    const pool = [...merged, ...eph];
    // トレイの非OCEアンカー地域 (OCEは日/米/欧と混在可なので除外)。 先頭依存だと OCE 先頭でアンカーを取り違えるため全stopから算出。
    const trayRegion = tourAnchorRegion(
      trayIds.map((tid) => pool.find((l) => l.id === tid)?.region ?? null),
    );
    if (!canAddToTour(trayRegion, candidate.region ?? '')) {
      showToast(t('housing.tour.region_block'), 'error');
      return;
    }
    setTrayIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  // 開始ボタン: まずマナー確認を出す (#4)。トレイが空なら何もしない。
  const onStart = () => {
    if (trayIds.length === 0) return;
    setMannerOpen(true);
  };

  // マナー確認の「はじめる」で実際にツアーを開始する。
  const commitStart = () => {
    if (trayIds.length === 0) return;
    // ツアー解決は merged (探す一覧・非汚染) + 一時 listing。一覧グリッドの merged 自体は変えない。
    const pool = [...merged, ...ephemeral];
    const orderedIds = orderTourStopIds(trayIds, pool);
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
  };

  return (
    <div className="housing-browse">
      <section className="housing-browse-panel" data-region="left">
        <div className="housing-browse-col housing-browse-col-left">
          <FilterPanel
            onClose={() => {}}
            onRegisterClick={() => navigate('/housing/register')}
            hideClose
          />
        </div>
      </section>

      <section className="housing-browse-panel" data-region="center">
        <div className="housing-browse-col housing-browse-col-center">
          <PersonalTagFilterLink tagIds={personalTagIds} />
          {status === 'loading' || status === 'idle' ? (
            <div className="housing-center-loading">{t('housing.gallery.loading')}</div>
          ) : status === 'error' ? (
            <div className="housing-center-error">{t('housing.gallery.error')}</div>
          ) : (
            <>
              {/* 中央だけが切り替わる。トレイ (右カラム) は地図モードでも従来どおり (spec 4.4) */}
              <div className="housing-browse-toolbar">
                <BrowseViewToggle value={browseView} onChange={setBrowseView} />
                {hasActiveFilter && (
                  <button
                    type="button"
                    className="housing-browse-clear-filter"
                    onClick={() => useHousingFilterStore.getState().clearAll()}
                  >
                    {t('housing.browse.clear_filter')}
                  </button>
                )}
              </div>
              {browseView === 'map' ? (
                <BrowseMapView filtered={filtered} onAddToTour={addToTray} />
              ) : filtered.length === 0 ? (
                <EmptyResult />
              ) : (
                <ListingGrid
                  listings={sorted}
                  onAddToTour={addToTray}
                  sort={sort}
                  onSortChange={setSort}
                />
              )}
            </>
          )}
        </div>
      </section>

      <section className="housing-browse-panel" data-region="right">
        <div className="housing-browse-col housing-browse-col-right">
          <TourTray listingIds={trayIds} onChange={setTrayIds} onStart={onStart} onAdd={addToTray} />
          <FavoritesPreviewStrip />
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
