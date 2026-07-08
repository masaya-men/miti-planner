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
 * ヘッダー(進行状況 + N/M インジケーター) → 縦ステッパー(可能な限り広く・多く) →
 * フェーズ枠(移動中=行き方/見学中=タイマー) → 操作3ボタン(横長・前へ/見学開始/次へ) →
 * (任意) 注記 → ツアーを終了(小さな下線テキスト・最下部)。
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
        <span className="housing-tour-progress-count">{arrivedCount}/{total}</span>
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
          {t('housing.tour.nav.actions.view')}
        </button>
        <button
          type="button"
          className="housing-tour-progress-action housing-tour-progress-action--next"
          onClick={onNext}
        >
          {t(isLast ? 'housing.tour.nav.actions.complete' : 'housing.tour.nav.actions.next')}
        </button>
      </div>
      <span className="housing-tour-progress-view-note">{t('housing.tour.nav.actions.view_optional')}</span>

      <button type="button" className="housing-tour-progress-finish" onClick={onFinish}>
        {t('housing.tour.nav.finish')}
      </button>
    </div>
  );
};
