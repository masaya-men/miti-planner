import { useTranslation } from 'react-i18next';
import { ProgressRing } from './ProgressRing';
import { TourRouteSteps } from './TourRouteSteps';
import type { TourProgress, TourStep } from '../../../lib/housing/tourNav';

export interface TourProgressPanelProps {
  progress: TourProgress;
  steps: TourStep[];
  currentIndex: number;
  onFinish: () => void;
}

/**
 * 右カラム: ツアー進行状況パネル (表示専用)。
 * リング + 到着済み/残り軒数 + 全ステップ縦リスト (TourRouteSteps) + 「ツアーを終了」。
 * Phase 3 で左右役割を入替え、ステップ一覧をここ (旧 NextDestination) から移設した。
 * store 配線・データ解決は TourNavPage が担う。ここは progress/steps/currentIndex を渡されるだけ。
 */
export const TourProgressPanel: React.FC<TourProgressPanelProps> = ({
  progress,
  steps,
  currentIndex,
  onFinish,
}) => {
  const { t } = useTranslation();
  const { total, arrivedCount, remainingCount, percent } = progress;

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

      <TourRouteSteps steps={steps} currentIndex={currentIndex} />

      <button type="button" className="housing-tour-progress-finish" onClick={onFinish}>
        {t('housing.tour.nav.finish')}
      </button>
    </div>
  );
};
