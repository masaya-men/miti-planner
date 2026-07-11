import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { mergeListingsForViewer } from '../../../lib/housing/listingPublish';
import { sortListingsForGallery } from '../../../lib/housing/sortListingsForGallery';
import { FilterPanel } from '../workspace/FilterPanel';
import { EmptyResult } from '../workspace/EmptyResult';
import { PersonalTagFilterLink } from '../workspace/PersonalTagFilterLink';
import { ListingGrid } from '../browse/ListingGrid';
import type { BrowseSortOrder } from '../browse/BrowseSortSelect';
import { TourTray } from '../browse/TourTray';
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

  const dc = useHousingFilterStore((s) => s.dc);
  const regions = useHousingFilterStore((s) => s.regions);
  const servers = useHousingFilterStore((s) => s.servers);
  const areas = useHousingFilterStore((s) => s.areas);
  const sizes = useHousingFilterStore((s) => s.sizes);
  const tags = useHousingFilterStore((s) => s.tags);

  // spec A-3: 公開一覧 + 自分の登録 (非公開/期限切れ含む) を合流。他人視点の表示は不変。
  const merged = useMemo(
    () => sortListingsForGallery(mergeListingsForViewer(listings, myListings, uid, Date.now())),
    [listings, myListings, uid],
  );

  const filtered = useMemo(
    () => applyFilters(merged, { dc, regions, servers, areas, sizes, tags }),
    [merged, dc, regions, servers, areas, sizes, tags],
  );

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

  // ツアートレイのドラフト (このページローカル)。開始時に tour store へ確定する。
  const [trayIds, setTrayIds] = useState<string[]>([]);
  const addToTray = (id: string) =>
    setTrayIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const onStart = () => {
    if (trayIds.length === 0) return;
    const orderedIds = orderTourStopIds(trayIds, merged);
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
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
        </div>
      </section>

      <section className="housing-browse-panel" data-region="right">
        <div className="housing-browse-col housing-browse-col-right">
          <TourTray listingIds={trayIds} onChange={setTrayIds} onStart={onStart} />
          <FavoritesPreviewStrip />
        </div>
      </section>
    </div>
  );
};
