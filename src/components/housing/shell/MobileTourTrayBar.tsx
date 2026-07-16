import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Play, Route, X } from 'lucide-react';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { mergeListingsForViewer } from '../../../lib/housing/listingPublish';
import { orderTourStopIds } from '../../../lib/housing/orderTourStops';
import { tourRegionConflict } from '../../../lib/housing/tourCrossing';
import { MannerNoticeDialog } from '../workspace/MannerNoticeDialog';
import { showToast } from '../../Toast';
import type { MockListing } from '../../../data/housing/mockListings';

/**
 * スマホ専用のツアートレイ小バー (実機FB#10)。
 *
 * PC ではカードの「ツアーに追加」→ 右パネルのツアートレイ (TourTray) → 開始、という流れだが、
 * スマホは右パネルが非表示のため「追加しても何も起きない」ように見えていた。
 * トレイに 1 件以上積まれている間だけボトムナビの上に固定表示し、件数の確認・開始・クリアを
 * この場で完結させる (どのページでも出る = HousingShell にマウント)。
 *
 * 開始フローは FavoritesPage.commitStart と同型: 並べ替え (orderTourStopIds) → 跨ぎ検査
 * (tourRegionConflict) → マナー確認 (MannerNoticeDialog・毎回) → start。
 */
export const MobileTourTrayBar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const trayIds = useTourTrayStore((s) => s.trayIds);
  const publicListings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  const [mannerOpen, setMannerOpen] = useState(false);

  // 行き先の解決プール: 公開一覧 + 自分の登録 (非公開含む) + 一時 listing (FavoritesPage と同じ合流)。
  const pool = useMemo<MockListing[]>(
    () => [...mergeListingsForViewer(publicListings, myListings, uid, Date.now()), ...ephemeral],
    [publicListings, myListings, uid, ephemeral],
  );

  const commitStart = useCallback(() => {
    if (trayIds.length === 0) return;
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
  }, [trayIds, pool, navigate, t]);

  if (trayIds.length === 0) return null;

  return (
    <>
      <div className="housing-tour-traybar" data-testid="mobile-tour-tray-bar">
        <Route size={16} aria-hidden="true" className="housing-tour-traybar-icon" />
        <span className="housing-tour-traybar-label">
          {t('housing.tray.title')}
          <span className="housing-tour-traybar-count">{trayIds.length}</span>
        </span>
        <button
          type="button"
          className="housing-tour-traybar-start"
          onClick={() => setMannerOpen(true)}
        >
          <Play size={14} aria-hidden="true" />
          {t('housing.mobile.tray_start')}
        </button>
        <button
          type="button"
          className="housing-tour-traybar-clear"
          aria-label={t('housing.mobile.tray_clear')}
          onClick={() => useTourTrayStore.getState().clear()}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <MannerNoticeDialog
        open={mannerOpen}
        onCancel={() => setMannerOpen(false)}
        onStart={commitStart}
      />
    </>
  );
};
