import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    useHousingFilterStore,
    type HousingArea,
    type HousingSize,
} from '../../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { getTagsByKind } from '../../../data/housingTags';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import {
    ALL_DCS,
    ALL_REGIONS,
    DC_SERVER_MAP,
    type Region,
} from '../../../data/housing/dcServerMap';
import { REGION_LABELS, type RegionLocale } from '../../../data/housing/regionMap';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { FilterDropdown } from './FilterDropdown';
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
    /** 開閉しない固定パネル (探すページ) では閉じるボタンを出さない。既定=表示 (legacy 用)。 */
    hideClose?: boolean;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ onClose, onRegisterClick, hideClose }) => {
    const { t, i18n } = useTranslation();
    const locale = pickLocale(i18n.language);

    const dc = useHousingFilterStore((s) => s.dc);
    const regions = useHousingFilterStore((s) => s.regions);
    const servers = useHousingFilterStore((s) => s.servers);
    const areas = useHousingFilterStore((s) => s.areas);
    const sizes = useHousingFilterStore((s) => s.sizes);
    const tags = useHousingFilterStore((s) => s.tags);
    const setDC = useHousingFilterStore((s) => s.setDC);
    const toggleRegion = useHousingFilterStore((s) => s.toggleRegion);
    const toggleServer = useHousingFilterStore((s) => s.toggleServer);
    const toggleArea = useHousingFilterStore((s) => s.toggleArea);
    const toggleSize = useHousingFilterStore((s) => s.toggleSize);
    const toggleTag = useHousingFilterStore((s) => s.toggleTag);
    const setCounts = useHousingFilterStore((s) => s.setCounts);
    const clearAll = useHousingFilterStore((s) => s.clearAll);
    // 件数の母集団はアクティブビューに揃える (CenterArea / RightPanel と同じ規約):
    // list ビュー = 共有ストアの実データ、 map ビュー = sampleWardLayout 準拠の MOCK (Phase 2B)。
    const viewMode = useHousingViewStore((s) => s.viewMode);
    const realListings = useHousingListingsStore((s) => s.listings);
    const source = viewMode === 'map' ? MOCK_LISTINGS : realListings;

    const result = useMemo(
        () => applyFilters(source, { dc, regions, servers, areas, sizes, tags }),
        [source, dc, regions, servers, areas, sizes, tags],
    );

    useEffect(() => {
        setCounts(result.length, source.length);
    }, [result.length, source.length, setCounts]);

    const availableServers = dc ? DC_SERVER_MAP[dc]?.servers ?? [] : [];

    const allLabel = t('housing.workspace.filter.all');
    const countLabel = (n: number) => t('housing.workspace.filter.selected_count', { count: n });
    const hasActiveFilter =
        Boolean(dc) || regions.length > 0 || servers.length > 0 ||
        areas.length > 0 || sizes.length > 0 || tags.length > 0;

    return (
        <>
            <div className="housing-panel-head">
                <div className="housing-panel-title">{t('housing.workspace.filter.title')}</div>
                <div className="housing-panel-meta">
                    <ResultCountBadge result={result.length} total={source.length} />
                </div>
            </div>
            <div className="housing-panel-body">
                <FilterDropdown
                    label={t('housing.workspace.filter.dc')}
                    mode="single"
                    options={ALL_DCS.map((d) => ({ value: d, label: d }))}
                    selected={dc ? [dc] : []}
                    onSelect={(v) => setDC(dc === v ? null : v)}
                    allLabel={allLabel}
                    countLabel={countLabel}
                />

                <FilterDropdown
                    label={t('housing.workspace.filter.region')}
                    mode="multi"
                    options={ALL_REGIONS.map((r: Region) => ({ value: r, label: REGION_LABELS[r][locale] }))}
                    selected={regions}
                    onSelect={(v) => toggleRegion(v)}
                    allLabel={allLabel}
                    countLabel={countLabel}
                />

                {dc && availableServers.length > 0 && (
                    <FilterDropdown
                        label={t('housing.workspace.filter.server')}
                        mode="multi"
                        options={availableServers.map((s) => ({ value: s, label: s }))}
                        selected={servers}
                        onSelect={(v) => toggleServer(v)}
                        allLabel={allLabel}
                        countLabel={countLabel}
                    />
                )}

                <FilterDropdown
                    label={t('housing.workspace.filter.area')}
                    mode="multi"
                    options={AREAS.map((a) => ({ value: a, label: a }))}
                    selected={areas}
                    onSelect={(v) => toggleArea(v as HousingArea)}
                    allLabel={allLabel}
                    countLabel={countLabel}
                />

                <div className="housing-filter-field">
                    <span className="housing-filter-field-label">
                        {t('housing.workspace.filter.size')}
                    </span>
                    <div
                        className="housing-size-seg"
                        role="group"
                        aria-label={t('housing.workspace.filter.size')}
                    >
                        {SIZES.map((sz) => (
                            <button
                                key={sz}
                                type="button"
                                className="housing-size-seg-btn"
                                data-active={sizes.includes(sz)}
                                aria-pressed={sizes.includes(sz)}
                                aria-label={sz}
                                onClick={() => toggleSize(sz)}
                            >
                                {t(`housing.workspace.filter.size_${sz.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>
                </div>

                <FilterDropdown
                    label={t('housing.workspace.filter.theme')}
                    mode="multi"
                    options={getTagsByKind('theme').map((tag) => ({
                        value: tag.id,
                        label: t(tag.i18nKey, { defaultValue: tag.id }),
                    }))}
                    selected={tags}
                    onSelect={(v) => toggleTag(v)}
                    allLabel={allLabel}
                    countLabel={countLabel}
                />

                {hasActiveFilter && (
                    <button type="button" className="housing-filter-clear-all" onClick={clearAll}>
                        {t('housing.workspace.filter.clear_all')}
                    </button>
                )}

                <RegisterCTA onClick={onRegisterClick} />

                {!hideClose && (
                    <div className="housing-filter-panel-footer">
                        <PanelCloseButton direction="left" onClick={onClose} />
                    </div>
                )}
            </div>
        </>
    );
};
