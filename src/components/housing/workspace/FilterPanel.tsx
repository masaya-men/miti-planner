import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    useHousingFilterStore,
    type HousingArea,
    type HousingSize,
} from '../../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { MOCK_LISTINGS, SAMPLE_THEME_TAGS } from '../../../data/housing/mockListings';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import {
    ALL_DCS,
    ALL_REGIONS,
    DC_SERVER_MAP,
    type Region,
} from '../../../data/housing/dcServerMap';
import { REGION_LABELS, type RegionLocale } from '../../../data/housing/regionMap';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { FilterSection } from './FilterSection';
import { FilterChip } from './FilterChip';
import { ResultCountBadge } from './ResultCountBadge';
import { RegisterCTA } from './RegisterCTA';
import { PanelCloseButton } from './PanelCloseButton';

const AREAS: HousingArea[] = ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum'];
const SIZES: HousingSize[] = ['S', 'M', 'L'];

function pickLocale(language: string): RegionLocale {
    const head = (language || 'ja').slice(0, 2).toLowerCase();
    if (head === 'en' || head === 'ko' || head === 'zh') return head;
    return 'ja';
}

export interface FilterPanelProps {
    onClose: () => void;
    onRegisterClick: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ onClose, onRegisterClick }) => {
    const { t, i18n } = useTranslation();
    const locale = pickLocale(i18n.language);

    const dc = useHousingFilterStore((s) => s.dc);
    const regions = useHousingFilterStore((s) => s.regions);
    const servers = useHousingFilterStore((s) => s.servers);
    const areas = useHousingFilterStore((s) => s.areas);
    const sizes = useHousingFilterStore((s) => s.sizes);
    const tags = useHousingFilterStore((s) => s.tags);
    const searchText = useHousingFilterStore((s) => s.searchText);
    const setDC = useHousingFilterStore((s) => s.setDC);
    const toggleRegion = useHousingFilterStore((s) => s.toggleRegion);
    const toggleServer = useHousingFilterStore((s) => s.toggleServer);
    const toggleArea = useHousingFilterStore((s) => s.toggleArea);
    const toggleSize = useHousingFilterStore((s) => s.toggleSize);
    const toggleTag = useHousingFilterStore((s) => s.toggleTag);
    const setCounts = useHousingFilterStore((s) => s.setCounts);
    // 件数の母集団はアクティブビューに揃える (CenterArea / RightPanel と同じ規約):
    // list ビュー = 共有ストアの実データ、 map ビュー = sampleWardLayout 準拠の MOCK (Phase 2B)。
    const viewMode = useHousingViewStore((s) => s.viewMode);
    const realListings = useHousingListingsStore((s) => s.listings);
    const source = viewMode === 'map' ? MOCK_LISTINGS : realListings;

    const result = useMemo(
        () => applyFilters(source, { dc, regions, servers, areas, sizes, tags, searchText }),
        [source, dc, regions, servers, areas, sizes, tags, searchText],
    );

    useEffect(() => {
        setCounts(result.length, source.length);
    }, [result.length, source.length, setCounts]);

    const availableServers = dc ? DC_SERVER_MAP[dc]?.servers ?? [] : [];

    return (
        <>
            <div className="housing-panel-head">
                <div className="housing-panel-title">{t('housing.workspace.filter.title')}</div>
                <div className="housing-panel-meta">
                    <ResultCountBadge result={result.length} total={source.length} />
                </div>
            </div>
            <div className="housing-panel-body">
                <FilterSection title={t('housing.workspace.filter.dc')}>
                    {ALL_DCS.map((d) => (
                        <FilterChip
                            key={d}
                            label={d}
                            active={dc === d}
                            onToggle={() => setDC(dc === d ? null : d)}
                        />
                    ))}
                </FilterSection>

                <FilterSection title={t('housing.workspace.filter.region')}>
                    {ALL_REGIONS.map((r: Region) => (
                        <FilterChip
                            key={r}
                            label={REGION_LABELS[r][locale]}
                            active={regions.includes(r)}
                            onToggle={() => toggleRegion(r)}
                        />
                    ))}
                </FilterSection>

                {dc && availableServers.length > 0 && (
                    <FilterSection title={t('housing.workspace.filter.server')}>
                        {availableServers.map((s) => (
                            <FilterChip
                                key={s}
                                label={s}
                                active={servers.includes(s)}
                                onToggle={() => toggleServer(s)}
                            />
                        ))}
                    </FilterSection>
                )}

                <FilterSection title={t('housing.workspace.filter.area')}>
                    {AREAS.map((a) => (
                        <FilterChip
                            key={a}
                            label={a}
                            active={areas.includes(a)}
                            onToggle={() => toggleArea(a)}
                        />
                    ))}
                </FilterSection>

                <FilterSection title={t('housing.workspace.filter.size')}>
                    {SIZES.map((sz) => (
                        <FilterChip
                            key={sz}
                            label={sz}
                            ariaLabel={sz}
                            active={sizes.includes(sz)}
                            onToggle={() => toggleSize(sz)}
                        />
                    ))}
                </FilterSection>

                <FilterSection title={t('housing.workspace.filter.theme')}>
                    {SAMPLE_THEME_TAGS.map((tag) => (
                        <FilterChip
                            key={tag}
                            label={t(`housing.tag.${tag}`, { defaultValue: tag })}
                            active={tags.includes(tag)}
                            onToggle={() => toggleTag(tag)}
                        />
                    ))}
                </FilterSection>

                <RegisterCTA onClick={onRegisterClick} />

                <div className="housing-filter-panel-footer">
                    <PanelCloseButton direction="left" onClick={onClose} />
                </div>
            </div>
        </>
    );
};
