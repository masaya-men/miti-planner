import { useTranslation } from 'react-i18next';
import { HOUSING_AREAS, type HousingArea } from '../../../../types/housing';
import { getAreaName } from '../../../../lib/housing/areaName';
import { pickRegionLocale } from '../../../../data/housing/regionMap';
import { displayWorldName } from '../../../../lib/housing/housingTerms';
import { DC_SERVER_MAP } from '../../../../data/housing/dcServerMap';
import {
  countArea, countDc, countKind, countServer, countWard,
  type MapIndexEntry, type MapSelection,
} from '../../../../lib/housing/browseMapIndex';
import type { WardMapKind } from '../../../../lib/housing/browseMapSpots';
import { useScrollFade } from '../../../../lib/housing/useScrollFade';
import './MapRail.css';

export interface MapRailProps {
  index: MapIndexEntry[];
  dc: string;
  sel: MapSelection;
  onServer: (server: string) => void;
  onArea: (area: HousingArea) => void;
  onWard: (ward: number) => void;
  onKind: (kind: WardMapKind) => void;
}

const bar = (n: number, max: number) => ({ width: `${(n / Math.max(1, max)) * 100}%` });

/**
 * 地図の左の案内板: ワールド → エリア → 区(家のある区だけ) → 本街/拡張街 を件数つきで縦に並べる。
 * 家の無い選択肢は薄く表示して押せない。選択中は aria-pressed。
 * スクロールバーは出さず上下端フェードで続きを示す (フィルターパネルと同じ housing の流儀)。
 */
export const MapRail: React.FC<MapRailProps> = ({ index, dc, sel, onServer, onArea, onWard, onKind }) => {
  const { t, i18n } = useTranslation();
  const locale = pickRegionLocale(i18n.language);
  const { ref, atStart, atEnd, onScroll } = useScrollFade<HTMLDivElement>();

  const servers = (DC_SERVER_MAP[dc]?.servers ?? [])
    .map((sv) => ({ sv, n: countServer(index, dc, sv) }))
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n);
  const smax = Math.max(1, ...servers.map((s) => s.n));
  const areas = HOUSING_AREAS.map((a) => ({ a, n: countArea(index, dc, sel.server, a) }));
  const amax = Math.max(1, ...areas.map((a) => a.n));
  const wards = Array.from({ length: 30 }, (_, i) => i + 1)
    .map((w) => ({ w, n: countWard(index, dc, sel.server, sel.area, w) }))
    .filter((w) => w.n > 0);
  const kinds: WardMapKind[] = ['main', 'sub'];

  return (
    <div
      className="housing-maprail"
      data-testid="housing-map-rail"
      data-at-top={atStart}
      data-at-bottom={atEnd}
    >
      <div className="housing-maprail-scroll" ref={ref} onScroll={onScroll}>
        <section className="housing-maprail-sec" aria-label={t('housing.map.nav.world')}>
          <h5 className="housing-maprail-head">
            <span>{t('housing.map.nav.world')}</span>
            <span>{t('housing.map.nav.count', { count: countDc(index, dc) })}</span>
          </h5>
          {servers.map(({ sv, n }) => (
            <button
              key={sv}
              type="button"
              className="housing-maprail-row"
              data-testid={`housing-maprail-world-${sv}`}
              aria-pressed={sv === sel.server}
              onClick={() => onServer(sv)}
            >
              <span className="housing-maprail-nm">{displayWorldName(dc, sv, locale)}</span>
              <span className="housing-maprail-mini" aria-hidden="true"><i style={bar(n, smax)} /></span>
              <span className="housing-maprail-ct">{n}</span>
            </button>
          ))}
        </section>

        <section className="housing-maprail-sec" aria-label={t('housing.workspace.filter.area')}>
          <h5 className="housing-maprail-head"><span>{t('housing.workspace.filter.area')}</span></h5>
          {areas.map(({ a, n }) => (
            <button
              key={a}
              type="button"
              className="housing-maprail-row"
              data-testid={`housing-maprail-area-${a}`}
              aria-pressed={a === sel.area}
              disabled={n === 0}
              onClick={() => onArea(a)}
            >
              <span className="housing-maprail-nm">{getAreaName(a, i18n.language)}</span>
              <span className="housing-maprail-mini" aria-hidden="true"><i style={bar(n, amax)} /></span>
              <span className="housing-maprail-ct">{n || ''}</span>
            </button>
          ))}
        </section>

        <section className="housing-maprail-sec" aria-label={t('housing.map.nav.ward_heading')}>
          <h5 className="housing-maprail-head"><span>{t('housing.map.nav.ward_heading')}</span></h5>
          <div className="housing-maprail-wards">
            {wards.map(({ w, n }) => (
              <button
                key={w}
                type="button"
                className="housing-maprail-ward"
                data-testid={`housing-maprail-ward-${w}`}
                aria-pressed={w === sel.ward}
                onClick={() => onWard(w)}
              >
                <b>{w}</b>
                <small>{t('housing.map.nav.count', { count: n })}</small>
              </button>
            ))}
          </div>
          <div className="housing-maprail-kinds" role="group">
            {kinds.map((k) => {
              const n = countKind(index, dc, sel.server, sel.area, sel.ward, k);
              return (
                <button
                  key={k}
                  type="button"
                  className="housing-maprail-kind"
                  data-testid={`housing-maprail-kind-${k}`}
                  aria-pressed={k === sel.kind}
                  disabled={n === 0}
                  onClick={() => onKind(k)}
                >
                  {t('housing.map.tab_count', { label: t(`housing.map.${k}_tab`), count: n })}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
