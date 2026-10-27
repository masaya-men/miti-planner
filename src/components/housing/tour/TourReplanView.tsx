import { useTranslation } from 'react-i18next';
import { TourTrayDetailPanel } from './TourTrayDetailPanel';
import { TourVisitedList } from './TourVisitedList';
import { TourTrayBoard } from '../browse/TourTrayBoard';
import { TourTrayList } from '../browse/TourTrayList';
import type { MockListing } from '../../../data/housing/mockListings';
import type { TourReplan } from './useTourReplan';

interface TourReplanViewProps {
  isMobile: boolean;
  listingIds: string[];
  currentIndex: number;
  pool: MockListing[];
  replan: TourReplan;
}

/**
 * ツアー中ページ(TourNavPage)のナビ中の並び替え画面 (PC=詳細+蛇行グリッド / スマホ=縦一覧)。
 * 見学済みの家は上に読み取り専用で並べ、残りの家だけを並び替える。
 */
export const TourReplanView: React.FC<TourReplanViewProps> = ({ isMobile, listingIds, currentIndex, pool, replan }) => {
  const { t } = useTranslation();
  const { replanDraft, setReplanDraft, replanSelectedId, setReplanSelectedId, resumeFromReplan } = replan;
  const currentId = listingIds[currentIndex];
  const visited = listingIds
    .slice(0, currentIndex)
    .map((id) => pool.find((l) => l.id === id))
    .filter((l): l is MockListing => Boolean(l));
  const replanSelected = replanSelectedId ? (pool.find((l) => l.id === replanSelectedId) ?? null) : null;
  const visitedSection = visited.length > 0 && (
    <>
      <h3 className="housing-tour-replan-subtitle">{t('housing.tour.replan.visited')}</h3>
      <TourVisitedList listings={visited} />
    </>
  );
  const upcomingTitle = <h3 className="housing-tour-replan-subtitle">{t('housing.tour.replan.upcoming')}</h3>;
  if (isMobile) {
    return (
      <div className="housing-tour-plan-mobile">
        <p className="housing-tour-plan-detail-note">{t('housing.tour.replan.hint')}</p>
        {visitedSection}
        {upcomingTitle}
        <TourTrayList listingIds={replanDraft} onChange={setReplanDraft} removable={false} currentId={currentId} />
        <p className="housing-tour-plan-detail-note">{t('housing.tour.replan.resume_note')}</p>
        <button type="button" className="housing-tour-tray-start" onClick={resumeFromReplan}>
          {t('housing.tour.replan.resume')}
        </button>
      </div>
    );
  }
  return (
    <div className="housing-tour-plan">
      <section className="housing-tour-page-panel" data-region="left">
        <div className="housing-tour-page-col">
          <TourTrayDetailPanel
            listing={replanSelected}
            onStartClick={resumeFromReplan}
            startDisabled={replanDraft.length === 0}
            startLabel={t('housing.tour.replan.resume')}
            note={t('housing.tour.replan.resume_note')}
          />
        </div>
      </section>
      <section className="housing-tour-page-panel" data-region="right">
        <div className="housing-tour-page-col">
          <TourTrayBoard
            listingIds={replanDraft}
            onChange={setReplanDraft}
            selectedId={replanSelectedId}
            onSelect={setReplanSelectedId}
            hint={t('housing.tour.replan.hint')}
            removable={false}
            currentId={currentId}
          >
            {visitedSection}
            {upcomingTitle}
          </TourTrayBoard>
        </div>
      </section>
    </div>
  );
};
