import { useTranslation } from 'react-i18next';
import type { TourStep } from '../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { getPlotDirections } from '../../../lib/housing/wardDirections';
import { TourRouteSteps } from './TourRouteSteps';

export interface TourNextDestinationPanelProps {
  currentStep: TourStep | null;
  steps: TourStep[];
  currentIndex: number;
  isLast: boolean;
  onPrev: () => void;
  onPrimary: () => void;
  onOpenReport: () => void;
}

/**
 * 右カラム: 次の目的地パネル (表示専用)。
 *
 * 次に訪れるハウジングの詳細 (サムネ/タイトル/住所/サイズ/ワールド/最寄りエーテライト/
 * ひとことメモ) + ルートのステップ一覧 (TourRouteSteps) + 操作 (前へ/主ボタン/報告)。
 * store 配線・データ解決・onPrev/onPrimary/onOpenReport の中身は TourNavPage (Task8) が担う。
 *
 * 最寄りエーテライト (dest.aetheryte): M1 は徒歩所要時間などの信頼できるデータを
 * 持たないため、作り物の「約N分」は出さずエリア名程度の中立表示に留める。
 */
export const TourNextDestinationPanel: React.FC<TourNextDestinationPanelProps> = ({
  currentStep,
  steps,
  currentIndex,
  isLast,
  onPrev,
  onPrimary,
  onOpenReport,
}) => {
  const { t, i18n } = useTranslation();
  const listing = currentStep?.listing ?? null;
  const isApartment = listing?.buildingType === 'apartment';
  const directions = getPlotDirections(listing?.area ?? '', listing?.plot);

  return (
    <div className="housing-tour-dest">
      {listing && (
        <div className="housing-tour-dest-card">
          <img
            className="housing-tour-dest-thumb"
            src={representativeImage(listing)}
            alt=""
            loading="lazy"
          />
          <div className="housing-tour-dest-head">
            <h2 className="housing-tour-dest-title">
              {listing.title?.trim() || formatHousingAddress(listing, i18n.language)}
            </h2>
            <span className="housing-tour-dest-world">
              {listing.dc} / {listing.server}
            </span>
          </div>

          <dl className="housing-tour-dest-facts">
            <div className="housing-tour-dest-fact">
              <dt className="housing-tour-dest-fact-label">
                {t('housing.tour.nav.dest.address')}
              </dt>
              <dd className="housing-tour-dest-fact-value">
                {formatHousingAddress(listing, i18n.language)}
              </dd>
            </div>
            {!isApartment && listing.size && (
              <div className="housing-tour-dest-fact">
                <dt className="housing-tour-dest-fact-label">
                  {t('housing.tour.nav.dest.size')}
                </dt>
                <dd className="housing-tour-dest-fact-value">{listing.size}</dd>
              </div>
            )}
            <div className="housing-tour-dest-fact">
              <dt className="housing-tour-dest-fact-label">
                {t('housing.tour.nav.dest.world')}
              </dt>
              <dd className="housing-tour-dest-fact-value">{listing.server}</dd>
            </div>
            <div className="housing-tour-dest-fact">
              <dt className="housing-tour-dest-fact-label">
                {t('housing.tour.nav.dest.memo')}
              </dt>
              <dd className="housing-tour-dest-fact-value">
                {listing.description?.trim() ? listing.description : t('housing.tour.nav.dest.no_memo')}
              </dd>
            </div>
          </dl>

          {directions && (
            <div className="housing-tour-dest-route">
              <span className="housing-tour-dest-route-label">
                {t('housing.tour.nav.dest.directions')}
              </span>
              <p className="housing-tour-dest-route-teleport">
                {t('housing.tour.nav.dest.teleport_to', { aetheryte: directions.aetheryte })}
              </p>
              {directions.directions && (
                <p className="housing-tour-dest-route-walk">{directions.directions}</p>
              )}
            </div>
          )}
        </div>
      )}

      <TourRouteSteps steps={steps} currentIndex={currentIndex} />

      <div className="housing-tour-dest-actions">
        <button
          type="button"
          className="housing-tour-dest-prev"
          onClick={onPrev}
          disabled={currentIndex === 0}
        >
          {t('housing.tour.nav.actions.prev')}
        </button>
        <button type="button" className="housing-tour-dest-primary" onClick={onPrimary}>
          {t(isLast ? 'housing.tour.nav.actions.complete' : 'housing.tour.nav.actions.arrive_next')}
        </button>
      </div>

      <button type="button" className="housing-tour-dest-report" onClick={onOpenReport}>
        {t('housing.tour.nav.report_button')}
      </button>
    </div>
  );
};
