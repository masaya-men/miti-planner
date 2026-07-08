import { useTranslation } from 'react-i18next';
import type { TourStep } from '../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { getPlotDirections } from '../../../lib/housing/wardDirections';

export interface TourShowcasePanelProps {
  currentStep: TourStep | null;
  currentIndex: number;
  isLast: boolean;
  onPrev: () => void;
  onPrimary: () => void;
  onOpenReport: () => void;
}

/**
 * 左カラム: 目的地ショーケース (表示専用)。
 *
 * 今向かうハウジングの魅力を大きく見せる — 写真 + 詳細 (タイトル/住所/サイズ/ワールド/
 * ひとことメモ/行き方) + 操作 (前へ/主ボタン/報告)。
 * Phase 3 で右カラム「次の目的地」から左カラム「ショーケース」へ役割変更。ステップ一覧は
 * 進行状況パネル (右) へ移設した。写真は静止画 (生きたカードは Phase 5)。
 * store 配線・データ解決・onPrev/onPrimary/onOpenReport の中身は TourNavPage が担う。
 */
export const TourShowcasePanel: React.FC<TourShowcasePanelProps> = ({
  currentStep,
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
