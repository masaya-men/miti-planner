import { useTranslation } from 'react-i18next';
import { ProgressRing } from './ProgressRing';
import { TourRouteSteps } from './TourRouteSteps';
import { TourPhaseZone } from './TourPhaseZone';
import type { TourProgress, TourStep } from '../../../lib/housing/tourNav';
import type { PlotDirections } from '../../../lib/housing/wardDirections';

export interface TourProgressPanelProps {
  progress: TourProgress;
  steps: TourStep[];
  currentIndex: number;
  phase: 'moving' | 'viewing';
  viewStartAt: number | null;
  directions: PlotDirections | null;
  /** 見学ボタンを押せるか(=現在の家が表示できる)。 */
  canView: boolean;
  isLast: boolean;
  onPrev: () => void;
  onViewStart: () => void;
  onNext: () => void;
  onFinish: () => void;
}

/**
 * 右カラム: 進行状況＋操作の司令塔 (表示専用)。
 * リング＋軒数(横並び) → 縦ステッパー → フェーズ枠(移動中=行き方/見学中=タイマー) →
 * 操作3ボタン(前へ/見学/次へ) → ツアーを終了。
 */
export const TourProgressPanel: React.FC<TourProgressPanelProps> = ({
  progress, steps, currentIndex, phase, viewStartAt, directions,
  canView, isLast, onPrev, onViewStart, onNext, onFinish,
}) => {
  const { t } = useTranslation();
  const { total, arrivedCount, percent } = progress;

  return (
    <div className="housing-tour-progress">
      <div className="housing-tour-progress-head">
        <span className="housing-tour-progress-title">{t('housing.tour.nav.progress.label')}</span>
        <span className="housing-tour-progress-count">
          {t('housing.tour.nav.progress.done_of_total', { done: arrivedCount, total })}
        </span>
      </div>

      <div className="housing-tour-progress-summary">
        <ProgressRing percent={percent} />
      </div>

      <TourRouteSteps steps={steps} currentIndex={currentIndex} />

      <TourPhaseZone phase={phase} directions={directions} viewStartAt={viewStartAt} />

      <div className="housing-tour-progress-actions">
        <button
          type="button"
          className="housing-tour-progress-action housing-tour-progress-action--prev"
          onClick={onPrev}
          disabled={currentIndex === 0}
        >
          {t('housing.tour.nav.actions.prev')}
        </button>
        <button
          type="button"
          className="housing-tour-progress-action housing-tour-progress-action--view"
          onClick={onViewStart}
          disabled={!canView || phase === 'viewing'}
        >
          <span className="housing-tour-progress-action-main">{t('housing.tour.nav.actions.view')}</span>
          <span className="housing-tour-progress-action-sub">{t('housing.tour.nav.actions.view_optional')}</span>
        </button>
        <button
          type="button"
          className="housing-tour-progress-action housing-tour-progress-action--next"
          onClick={onNext}
        >
          {t(isLast ? 'housing.tour.nav.actions.complete' : 'housing.tour.nav.actions.next')}
        </button>
      </div>

      <button type="button" className="housing-tour-progress-finish" onClick={onFinish}>
        {t('housing.tour.nav.finish')}
      </button>
    </div>
  );
};
