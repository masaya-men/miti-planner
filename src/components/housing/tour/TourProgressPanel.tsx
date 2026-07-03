import { useTranslation } from 'react-i18next';
import { ProgressRing } from './ProgressRing';
import type { TourProgress } from '../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { representativeImage } from '../../../lib/housing/representativeImage';

export interface TourProgressPanelProps {
  progress: TourProgress;
  onFinish: () => void;
}

/**
 * 左カラム: ツアー進捗パネル (表示専用)。
 * リング + 到着済み/残り軒数 + 次に訪れる場所 + 最近訪れた場所 + 「ツアーを終了」。
 * store 配線・データ解決は TourNavPage (Task8) が担う。ここは progress を渡されるだけ。
 */
export const TourProgressPanel: React.FC<TourProgressPanelProps> = ({ progress, onFinish }) => {
  const { t, i18n } = useTranslation();
  const { total, arrivedCount, remainingCount, percent, currentStep, recent } = progress;
  const nextListing = currentStep?.listing ?? null;

  return (
    <div className="housing-tour-progress">
      <div className="housing-tour-progress-head">
        <span className="housing-tour-progress-title">{t('housing.tour.nav.progress.label')}</span>
        <span className="housing-tour-progress-count">
          {t('housing.tour.nav.progress.done_of_total', { done: arrivedCount, total })}
        </span>
      </div>

      <ProgressRing percent={percent} />

      <div className="housing-tour-progress-stats">
        <div className="housing-tour-progress-stat">
          <span className="housing-tour-progress-stat-value">{arrivedCount}</span>
          <span className="housing-tour-progress-stat-label">
            {t('housing.tour.nav.progress.arrived')}
          </span>
        </div>
        <div className="housing-tour-progress-stat">
          <span className="housing-tour-progress-stat-value">{remainingCount}</span>
          <span className="housing-tour-progress-stat-label">
            {t('housing.tour.nav.progress.remaining')}
          </span>
        </div>
      </div>

      {nextListing && (
        <div className="housing-tour-progress-section">
          <span className="housing-tour-progress-section-heading">
            {t('housing.tour.nav.next_place')}
          </span>
          <div className="housing-tour-progress-next-card">
            <img
              className="housing-tour-progress-next-thumb"
              src={representativeImage(nextListing)}
              alt=""
              loading="lazy"
            />
            <span className="housing-tour-progress-next-addr">
              {formatHousingAddress(nextListing, i18n.language)}
            </span>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="housing-tour-progress-section">
          <span className="housing-tour-progress-section-heading">
            {t('housing.tour.nav.recent')}
          </span>
          <ol className="housing-tour-progress-recent-list">
            {recent.map((step) =>
              step.listing ? (
                <li key={step.id} className="housing-tour-progress-recent-item">
                  {formatHousingAddress(step.listing, i18n.language)}
                </li>
              ) : null
            )}
          </ol>
        </div>
      )}

      <button type="button" className="housing-tour-progress-finish" onClick={onFinish}>
        {t('housing.tour.nav.finish')}
      </button>
    </div>
  );
};
