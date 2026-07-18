import { useTranslation } from 'react-i18next';
import type { PlotDirections } from '../../../lib/housing/wardDirections';
import { useElapsed, formatElapsed, formatClock } from '../../../lib/housing/useElapsed';
import type { TourCrossing } from '../../../lib/housing/tourCrossing';
import { termLabel } from '../../../lib/housing/housingTerms';
import { pickRegionLocale } from '../../../data/housing/regionMap';

export interface TourPhaseZoneProps {
  phase: 'moving' | 'viewing';
  /** 移動中に出す行き方。無ければ枠のみ。 */
  directions: PlotDirections | null;
  /** 見学開始の epoch ms（viewing のとき非 null 想定）。 */
  viewStartAt: number | null;
  /** 前の家→この家の移動種別。省略時は跨ぎ無し扱い。 */
  crossing?: TourCrossing;
}

/**
 * 右パネルのフェーズ枠。ボタンのすぐ上で、フェーズにより中身が入れ替わる。
 * 移動中 = 行き方(テレポ+徒歩) / 見学中 = 見学タイマー(開始時刻+経過)。
 * DC/ワールドを跨ぐ地点では、行き方の上に跨ぎ指示行(DCトラベル/ワールド訪問)を出す。
 */
export const TourPhaseZone: React.FC<TourPhaseZoneProps> = ({
  phase, directions, viewStartAt, crossing = { kind: 'none' },
}) => {
  const { t, i18n } = useTranslation();
  const locale = pickRegionLocale(i18n.language);
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

  const crossLine =
    crossing.kind === 'start' ? t('housing.tour.nav.cross.start', { dc: crossing.dc, world: crossing.world })
    : crossing.kind === 'dc' ? t('housing.tour.nav.cross.dc', { dc: crossing.dc, world: crossing.world })
    : crossing.kind === 'world' ? t('housing.tour.nav.cross.world', { world: crossing.world })
    : crossing.kind === 'region' ? t('housing.tour.nav.cross.region')
    : null;

  if (!directions && !crossLine) {
    return <div className="housing-tour-phasezone housing-tour-phasezone-empty" aria-hidden="true" />;
  }

  return (
    <div className="housing-tour-phasezone housing-tour-phasezone-route">
      {crossLine && (
        <p className="housing-tour-phasezone-cross" data-testid="tour-phase-cross">{crossLine}</p>
      )}
      {directions && (
        <>
          <span className="housing-tour-phasezone-route-label">{t('housing.tour.nav.dest.directions')}</span>
          <p className="housing-tour-phasezone-route-teleport">
            {t('housing.tour.nav.dest.teleport_to', {
              aetheryte: termLabel('aetheryte', directions.aetheryte, locale),
            })}
          </p>
          {directions.directions && (
            <p className="housing-tour-phasezone-route-walk">{directions.directions}</p>
          )}
        </>
      )}
    </div>
  );
};
