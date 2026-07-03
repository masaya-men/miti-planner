import { useTranslation } from 'react-i18next';

export interface ProgressRingProps {
  /** 0-100 の進捗率。範囲外の値は clamp する。 */
  percent: number;
}

// viewBox 座標系 (0-100) 上のジオメトリ。px ではないので --housing-* トークン化の対象外
// (MapView.tsx の r / strokeWidth 直書きと同じ扱い)。
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * ツアー進捗リング (SVG 2円)。
 * トラック = --housing-divider、進捗弧 = --housing-aether (機能表現の青)。
 * 中央に「{percent}% 完了」(housing.tour.nav.progress.percent_done) を表示。
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({ percent }) => {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(100, percent));
  const displayPercent = Math.round(clamped);
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="housing-tour-progress-ring" data-testid="housing-tour-progress-ring">
      <svg
        className="housing-tour-progress-ring-svg"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <circle className="housing-tour-progress-ring-track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="housing-tour-progress-ring-fill"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="housing-tour-progress-ring-label">
        {t('housing.tour.nav.progress.percent_done', { percent: displayPercent })}
      </span>
    </div>
  );
};
