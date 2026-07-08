import { useTranslation } from 'react-i18next';
import type { PlotDirections } from '../../../lib/housing/wardDirections';
import { useElapsed, formatElapsed, formatClock } from '../../../lib/housing/useElapsed';

export interface TourPhaseZoneProps {
  phase: 'moving' | 'viewing';
  /** 移動中に出す行き方。無ければ枠のみ。 */
  directions: PlotDirections | null;
  /** 見学開始の epoch ms（viewing のとき非 null 想定）。 */
  viewStartAt: number | null;
}

/**
 * 右パネルのフェーズ枠。ボタンのすぐ上で、フェーズにより中身が入れ替わる。
 * 移動中 = 行き方(テレポ+徒歩) / 見学中 = 見学タイマー(開始時刻+経過)。
 */
export const TourPhaseZone: React.FC<TourPhaseZoneProps> = ({ phase, directions, viewStartAt }) => {
  const { t } = useTranslation();
  const elapsed = useElapsed(phase === 'viewing' ? viewStartAt : null);

  if (phase === 'viewing' && viewStartAt != null) {
    return (
      <div className="housing-tour-phasezone housing-tour-phasezone-timer" data-testid="tour-phase-timer">
        <span className="housing-tour-phasezone-timer-started">
          {t('housing.tour.nav.viewing.started_at', { time: formatClock(viewStartAt) })}
        </span>
        <span className="housing-tour-phasezone-timer-elapsed">
          {t('housing.tour.nav.viewing.elapsed', { elapsed: formatElapsed(elapsed) })}
        </span>
      </div>
    );
  }

  if (!directions) {
    return <div className="housing-tour-phasezone housing-tour-phasezone-empty" aria-hidden="true" />;
  }

  return (
    <div className="housing-tour-phasezone housing-tour-phasezone-route">
      <span className="housing-tour-phasezone-route-label">{t('housing.tour.nav.dest.directions')}</span>
      <p className="housing-tour-phasezone-route-teleport">
        {t('housing.tour.nav.dest.teleport_to', { aetheryte: directions.aetheryte })}
      </p>
      {directions.directions && (
        <p className="housing-tour-phasezone-route-walk">{directions.directions}</p>
      )}
    </div>
  );
};
