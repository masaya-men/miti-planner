import { useTranslation } from 'react-i18next';
import type { PlotDirections } from '../../../lib/housing/wardDirections';
import { useElapsed, formatElapsed, formatClock } from '../../../lib/housing/useElapsed';
import { termLabel } from '../../../lib/housing/housingTerms';
import { pickRegionLocale } from '../../../data/housing/regionMap';

export interface TourPhaseZoneProps {
  phase: 'moving' | 'viewing';
  /** 移動中に出す行き方。無ければ枠のみ。 */
  directions: PlotDirections | null;
  /** Task8: 行き方本文の locale 別訳。省略時は directions.directions (ja) を使う。 */
  directionsText?: string | null;
  /** 見学開始の epoch ms（viewing のとき非 null 想定）。 */
  viewStartAt: number | null;
}

/**
 * 右パネルのフェーズ枠。ボタンのすぐ上で、フェーズにより中身が入れ替わる。
 * 移動中 = 行き方(テレポ+徒歩) / 見学中 = 見学タイマー(開始時刻+経過)。
 * DC/ワールドを跨ぐ案内は中央マップの案内カード側に一本化しており、ここには出さない
 * (同じ文言が2箇所に出て見るべき場所が分かりにくいという実機FBで撤去・2026-08-10)。
 */
export const TourPhaseZone: React.FC<TourPhaseZoneProps> = ({
  phase, directions, directionsText, viewStartAt,
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

  if (!directions) {
    return <div className="housing-tour-phasezone housing-tour-phasezone-empty" aria-hidden="true" />;
  }

  return (
    <div className="housing-tour-phasezone housing-tour-phasezone-route">
      <span className="housing-tour-phasezone-route-label">{t('housing.tour.nav.dest.directions')}</span>
      <p className="housing-tour-phasezone-route-teleport">
        {t('housing.tour.nav.dest.teleport_to', {
          aetheryte: termLabel('aetheryte', directions.aetheryte, locale),
        })}
      </p>
      {(directionsText ?? directions.directions) && (
        <p className="housing-tour-phasezone-route-walk">{directionsText ?? directions.directions}</p>
      )}
    </div>
  );
};
