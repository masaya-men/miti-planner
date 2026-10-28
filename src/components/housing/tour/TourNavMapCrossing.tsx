import { useTranslation, Trans } from 'react-i18next';
import type { TourCrossing } from '../../../lib/housing/tourCrossing';
import { displayDcName, displayWorldName } from '../../../lib/housing/housingTerms';
import { getAreaName } from '../../../lib/housing/areaName';
import { pickRegionLocale } from '../../../data/housing/regionMap';
import type { HousingArea } from '../../../types/housing';
import './TourNavMapCrossing.css';

/** 地域跨ぎステップの案内カード(ぼかし+説明文)。 */
export const TourNavMapCrossing: React.FC<{ crossing: TourCrossing; crossingReadOnly: boolean }> = ({ crossing, crossingReadOnly }) => {
  const { t, i18n } = useTranslation();
  const locale = pickRegionLocale(i18n.language);
  return (
    <div className="housing-tour-map-cross" data-testid="tour-map-cross">
      <div className="housing-tour-map-cross-card">
        <p className="housing-tour-map-cross-text">
          {crossing.kind === 'start' && (
            t('housing.tour.nav.cross.start', { dc: displayDcName(crossing.dc, locale), world: displayWorldName(crossing.dc, crossing.world, locale) })
          )}
          {crossing.kind === 'dc' && (
            <Trans
              i18nKey="housing.tour.nav.cross.dc"
              values={{
                dc: displayDcName(crossing.dc, locale),
                world: displayWorldName(crossing.dc, crossing.world, locale),
                area: crossing.area ? getAreaName(crossing.area as HousingArea, i18n.language) : '',
                ward: crossing.ward ?? '',
              }}
              components={{ hl: <span className="housing-tour-map-cross-highlight" /> }}
            />
          )}
          {crossing.kind === 'world' && (
            <Trans
              i18nKey="housing.tour.nav.cross.world"
              values={{
                world: displayWorldName(crossing.dc, crossing.world, locale),
                area: crossing.area ? getAreaName(crossing.area as HousingArea, i18n.language) : '',
                ward: crossing.ward ?? '',
              }}
              components={{ hl: <span className="housing-tour-map-cross-highlight" /> }}
            />
          )}
          {crossing.kind === 'region' && (
            t('housing.tour.nav.cross.region')
          )}
        </p>
        {crossingReadOnly && (
          // 参加者は操作できない。地図は主催者が「次へ」を押すと(broadcast で)出る。
          <p className="housing-tour-map-cross-waiting">{t('housing.tour.nav.cross.waiting')}</p>
        )}
      </div>
    </div>
  );
};
