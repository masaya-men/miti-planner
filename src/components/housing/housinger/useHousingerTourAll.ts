/**
 * ハウジンガーページの「まとめてツアー」: ツアーは開始せず、既存トレイ + この人の家を
 * 「並び替え画面」(/housing/tour) のトレイに入れて遷移するだけ。開始は並び替え画面の開始ボタン
 * (マナー確認もそちら)。以前(2026-08-10 バグ修正)の「トレイ + この人の家をマージする」挙動は維持する。
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { mergeListingsForViewer } from '../../../lib/housing/listingPublish';
import { orderTourStopIds } from '../../../lib/housing/orderTourStops';
import { tourRegionConflict } from '../../../lib/housing/tourCrossing';
import { showToast } from '../../Toast';
import type { MockListing } from '../../../data/housing/mockListings';

export function useHousingerTourAll(listings: MockListing[], viewerUid: string | null) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return () => {
    if (listings.length === 0) return;
    const trayIds = useTourTrayStore.getState().trayIds;
    const newIds = listings.map((l) => l.id);
    const mergedIds = [...trayIds, ...newIds.filter((id) => !trayIds.includes(id))];
    // トレイ内の id はこの人以外の家も含みうるため、探すページと同じ合流プールで解決する。
    const publicListings = useHousingListingsStore.getState().listings;
    const myListings = useHousingListingsStore.getState().myListings;
    const ephemeral = useEphemeralListingsStore.getState().ephemeralListings;
    const pool = [
      ...mergeListingsForViewer(publicListings, myListings, viewerUid, Date.now()),
      ...ephemeral,
      ...listings,
    ];
    const orderedIds = orderTourStopIds(mergedIds, pool);
    const stops = orderedIds
      .map((id) => pool.find((l) => l.id === id))
      .filter((l): l is MockListing => Boolean(l));
    const conflict = tourRegionConflict(stops);
    if (conflict) {
      showToast(t('housing.tour.region_block_start', { regions: conflict.join(' / ') }), 'error');
      return;
    }
    useTourTrayStore.getState().setTrayIds(orderedIds);
    navigate('/housing/tour');
  };
}
