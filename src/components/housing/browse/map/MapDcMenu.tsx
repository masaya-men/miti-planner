import { useTranslation } from 'react-i18next';
import { ALL_DCS, ALL_REGIONS, DC_SERVER_MAP } from '../../../../data/housing/dcServerMap';
import { pickRegionLocale, regionLabel } from '../../../../data/housing/regionMap';
import { displayDcName } from '../../../../lib/housing/housingTerms';
import { countDc, type MapIndexEntry } from '../../../../lib/housing/browseMapIndex';
import { useScrollFade } from '../../../../lib/housing/useScrollFade';

export interface MapDcMenuProps {
  index: MapIndexEntry[];
  /** 左の絞り込みの地域 (言語の地域分離を含む)。空なら全地域。対象外の DC は出さない。 */
  regions: string[];
  currentDc: string | null;
  onPick: (dc: string) => void;
}

/**
 * 「マップ」ボタンの下に開く DC 一覧 (地域見出し → DC 名・件数の棒・N 件)。
 * 0 件の DC は薄く表示して押せない。件数は索引 (絞り込み適用済み) から数える。
 */
export const MapDcMenu: React.FC<MapDcMenuProps> = ({ index, regions, currentDc, onPick }) => {
  const { t, i18n } = useTranslation();
  const locale = pickRegionLocale(i18n.language);
  const { ref, atStart, atEnd, onScroll } = useScrollFade<HTMLDivElement>();

  const groups = ALL_REGIONS.map((region) => ({
    region,
    dcs: ALL_DCS.filter(
      (d) => DC_SERVER_MAP[d].region === region && (regions.length === 0 || regions.includes(region)),
    ),
  })).filter((g) => g.dcs.length > 0);
  const max = Math.max(1, ...groups.flatMap((g) => g.dcs.map((d) => countDc(index, d))));

  return (
    <div
      className="housing-dcmenu"
      data-testid="housing-map-dcmenu"
      role="group"
      aria-label={t('housing.map.nav.dc_menu_aria')}
      data-at-top={atStart}
      data-at-bottom={atEnd}
    >
      <div className="housing-dcmenu-scroll" ref={ref} onScroll={onScroll}>
        {groups.map((g) => (
          <div key={g.region} className="housing-dcmenu-group">
            <div className="housing-dcmenu-heading">{regionLabel(g.region, locale)}</div>
            {g.dcs.map((dc) => {
              const n = countDc(index, dc);
              return (
                <button
                  key={dc}
                  type="button"
                  className="housing-dcmenu-row"
                  data-testid={`housing-dcmenu-${dc}`}
                  data-selected={dc === currentDc ? 'true' : 'false'}
                  disabled={n === 0}
                  aria-current={dc === currentDc ? 'true' : undefined}
                  onClick={() => onPick(dc)}
                >
                  <span className="housing-dcmenu-name">{displayDcName(dc, locale)}</span>
                  <span className="housing-dcmenu-bar" aria-hidden="true">
                    <i style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                  <span className="housing-dcmenu-n">{t('housing.map.nav.count', { count: n })}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
