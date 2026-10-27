import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { canAddToTour, tourAnchorRegion, tourRegionConflict } from '../../../lib/housing/tourCrossing';
import { resolveTourOrder } from '../../../lib/housing/resolveTourOrder';
import { showToast } from '../../Toast';
import type { MockListing } from '../../../data/housing/mockListings';

/**
 * ツアー中ページ(TourNavPage)の計画フェーズ (ツアー未開始): 住所から追加・トレイ・選択・開始。
 */
export function useTourPlanning(pool: MockListing[]) {
  const { t } = useTranslation();

  // 空状態/計画画面の「住所から追加」モーダル (計画: 住所登録なし一時ツアー Task3)。
  // 開閉 state をここ (TourNavPage) が持つことで、trayIds 0↔1 や PC↔スマホ切替でレイアウトが
  // 入れ替わっても EphemeralAddPanel がアンマウントされず、Allmarks 一括インポートの進捗が
  // 途中で消えない。
  const [addOpen, setAddOpen] = useState(false);
  // BrowsePage.addToTray と同型: 一時 listing をストアから fresh 解決 → 跨ぎ検査 →
  // useTourTrayStore へ積む。旧実装はページローカルの emptyTrayIds に積んでいたため、
  // 探す等へ遷移した瞬間に消え、trayIds が 0 のままで PC 計画ビューにも切り替わらなかった
  // (2026-09-04 bug #3 修正)。
  const onAddToTray = useCallback(
    (id: string) => {
      const eph = useEphemeralListingsStore.getState().ephemeralListings;
      const candidate = pool.find((l) => l.id === id) ?? eph.find((l) => l.id === id);
      if (!candidate || candidate.visibility === 'unlisted') return;
      const curTrayIds = useTourTrayStore.getState().trayIds;
      const trayRegion = tourAnchorRegion(
        curTrayIds.map(
          (tid) => (pool.find((l) => l.id === tid) ?? eph.find((l) => l.id === tid))?.region ?? null,
        ),
      );
      if (!canAddToTour(trayRegion, candidate.region ?? '')) {
        showToast(t('housing.tour.region_block'), 'error');
        return;
      }
      useTourTrayStore
        .getState()
        .setTrayIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [pool, t],
  );

  // 計画画面(蛇行グリッド): トレイに1件以上あれば「ツアー未開始だが計画中」として
  // TourEmptyState の代わりに TourTrayDetailPanel + TourTrayBoard(PC)/TourTrayList(スマホ)を出す。
  const trayIds = useTourTrayStore((s) => s.trayIds);
  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
  const pinnedIds = useTourTrayStore((s) => s.pinnedIds);
  // EphemeralAddPanel の早期跨ぎブロック用: いまトレイに入っている家の非OCEアンカー地域。
  const trayRegionForAdd = useMemo(
    () => tourAnchorRegion(trayIds.map((tid) => pool.find((l) => l.id === tid)?.region ?? null)),
    [trayIds, pool],
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planMannerOpen, setPlanMannerOpen] = useState(false);

  // 選択中idがトレイから外れたら(削除/開始等)、先頭の家へ選択を戻す。
  // 「先頭」はトレイ配列の生の順ではなく、グリッド/一覧が実際に表示している解決済みの順
  // (resolveTourOrder = ピン留め + 効率順) の先頭に合わせる。
  // でないと初期選択の家がカード①と一致せず紛らわしい。
  useEffect(() => {
    if (trayIds.length === 0) {
      setSelectedPlanId(null);
      return;
    }
    if (!selectedPlanId || !trayIds.includes(selectedPlanId)) {
      const displayOrder = resolveTourOrder(trayIds, pool, { pinnedIds });
      setSelectedPlanId(displayOrder[0] ?? trayIds[0]);
    }
  }, [trayIds, selectedPlanId, pool, pinnedIds]);

  const selectedPlanListing = selectedPlanId
    ? (pool.find((l) => l.id === selectedPlanId) ?? null)
    : null;

  // 計画画面の「ツアーを開始する」。BrowsePage.commitStart / FavoritesPage.commitStart と同型
  // (resolveTourOrder → 跨ぎ検査 → マナー確認 → setListings/start/enterTourMode/clear)。
  // 既にこのページ(/housing/tour)にいるため、開始後の navigate は不要
  // (useHousingTourStore.listingIds が非0になり、このページ自身が実行中の3パネルへ再描画される)。
  const commitPlanStart = useCallback(() => {
    if (trayIds.length === 0) return;
    const orderedIds = resolveTourOrder(trayIds, pool, { pinnedIds });
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
    setPlanMannerOpen(false);
  }, [trayIds, pool, pinnedIds, t]);

  return {
    addOpen, setAddOpen, onAddToTray,
    trayIds, setTrayIds, trayRegionForAdd,
    selectedPlanId, setSelectedPlanId, selectedPlanListing,
    planMannerOpen, setPlanMannerOpen, commitPlanStart,
  };
}

export type TourPlanning = ReturnType<typeof useTourPlanning>;
