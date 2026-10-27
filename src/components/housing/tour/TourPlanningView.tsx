import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { TourEmptyState } from './TourEmptyState';
import { TourTrayDetailPanel } from './TourTrayDetailPanel';
import { TourTrayBoard } from '../browse/TourTrayBoard';
import { TourTrayList } from '../browse/TourTrayList';
import { EphemeralAddPanel } from '../browse/EphemeralAddPanel';
import { MannerNoticeDialog } from '../workspace/MannerNoticeDialog';
import type { TourPlanning } from './useTourPlanning';

interface TourPlanningViewProps {
  isMobile: boolean;
  plan: TourPlanning;
  onGoFavorites: () => void;
}

/**
 * ツアー中ページ(TourNavPage)の計画フェーズ (listingIds は空) の表示。
 * トレイが空 → 空状態 / トレイに行き先あり → 計画画面 (PC=詳細+蛇行グリッド / スマホ=縦一覧)。
 * 「住所から追加」モーダル (EphemeralAddPanel) は、trayIds 0↔1 や PC↔スマホ切替でレイアウトが
 * 入れ替わってもアンマウントされないよう、下のフラグメント直下に1つだけ置く。
 */
export const TourPlanningView: React.FC<TourPlanningViewProps> = ({ isMobile, plan, onGoFavorites }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    addOpen, setAddOpen, onAddToTray,
    trayIds, setTrayIds, trayRegionForAdd,
    selectedPlanId, setSelectedPlanId, selectedPlanListing,
    planMannerOpen, setPlanMannerOpen, commitPlanStart,
  } = plan;
  const planning = trayIds.length > 0;
  return (
    <>
      {!planning && (
        <div className="housing-tour-page">
          <section
            className="housing-tour-page-panel housing-tour-page-panel-solo"
            data-region="center"
          >
            <TourEmptyState
              onGoFavorites={onGoFavorites}
              onGoBrowse={() => navigate('/housing')}
              onOpenAdd={() => setAddOpen(true)}
              addOpen={addOpen}
            />
          </section>
        </div>
      )}

      {planning && isMobile && (
        <div className="housing-tour-plan-mobile">
          <button
            type="button"
            className="housing-ephemeral-toggle"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((o) => !o)}
          >
            <Plus size={14} aria-hidden="true" />
            {t('housing.ephemeral.add_button')}
          </button>
          <TourTrayList listingIds={trayIds} onChange={setTrayIds} />
          <button
            type="button"
            className="housing-tour-tray-start"
            disabled={trayIds.length === 0}
            onClick={() => setPlanMannerOpen(true)}
          >
            {t('housing.tray.start')}
          </button>
          <MannerNoticeDialog
            open={planMannerOpen}
            onCancel={() => setPlanMannerOpen(false)}
            onStart={commitPlanStart}
          />
        </div>
      )}

      {planning && !isMobile && (
        <div className="housing-tour-plan">
          <section className="housing-tour-page-panel" data-region="left">
            <div className="housing-tour-page-col">
              <TourTrayDetailPanel
                listing={selectedPlanListing}
                onStartClick={() => setPlanMannerOpen(true)}
                startDisabled={trayIds.length === 0}
              />
            </div>
          </section>
          <section className="housing-tour-page-panel" data-region="right">
            <div className="housing-tour-page-col">
              <TourTrayBoard
                listingIds={trayIds}
                onChange={setTrayIds}
                selectedId={selectedPlanId}
                onSelect={setSelectedPlanId}
              />
            </div>
          </section>
          <MannerNoticeDialog
            open={planMannerOpen}
            onCancel={() => setPlanMannerOpen(false)}
            onStart={commitPlanStart}
          />
        </div>
      )}

      <EphemeralAddPanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={onAddToTray}
        trayRegion={trayRegionForAdd}
      />
    </>
  );
};
