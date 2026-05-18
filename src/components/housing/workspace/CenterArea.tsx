import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { useHousingRandomStore } from '../../../store/useHousingRandomStore';
import { MOCK_LISTINGS, type MockListing } from '../../../data/housing/mockListings';
import { SAMPLE_WARD_KEY } from '../../../data/housing/sampleWardLayout';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { pickRandomWard, listListingsForWard } from '../../../lib/housing/randomWard';
import { ViewModeToggle } from './ViewModeToggle';
import { MapView } from './MapView';
import { PinterestView } from './PinterestView';
import { EmptyResult } from './EmptyResult';

export interface CenterAreaProps {
    /** Optional click handler when a card is activated from map / grid. */
    onCardActivate?: (listing: MockListing) => void;
}

export const CenterArea: React.FC<CenterAreaProps> = ({ onCardActivate }) => {
    const { t } = useTranslation();
    const viewMode = useHousingViewStore((s) => s.viewMode);
    const dc = useHousingFilterStore((s) => s.dc);
    const regions = useHousingFilterStore((s) => s.regions);
    const servers = useHousingFilterStore((s) => s.servers);
    const areas = useHousingFilterStore((s) => s.areas);
    const sizes = useHousingFilterStore((s) => s.sizes);
    const tags = useHousingFilterStore((s) => s.tags);
    const searchText = useHousingFilterStore((s) => s.searchText);
    const selectedWardId = useHousingRandomStore((s) => s.selectedWardId);
    const selectWard = useHousingRandomStore((s) => s.selectWard);

    // Pick a random ward once per session (mock data falls back to SAMPLE_WARD_KEY)
    useEffect(() => {
        if (selectedWardId !== null) return;
        const picked = pickRandomWard(MOCK_LISTINGS, 5) ?? SAMPLE_WARD_KEY;
        selectWard(picked);
    }, [selectedWardId, selectWard]);

    const activeWardKey = selectedWardId ?? SAMPLE_WARD_KEY;

    const filtered = useMemo(
        () => applyFilters(MOCK_LISTINGS, { dc, regions, servers, areas, sizes, tags, searchText }),
        [dc, regions, servers, areas, sizes, tags, searchText],
    );

    const pinterestListings = useMemo(
        () => [...filtered].sort((a, b) => b.createdAt - a.createdAt),
        [filtered],
    );

    const mapWardListings = useMemo(
        () => listListingsForWard(MOCK_LISTINGS, activeWardKey),
        [activeWardKey],
    );

    const noop = (_l: MockListing) => { /* Plan E: route to tour-add flow */ };
    const handleMapClick = onCardActivate ?? noop;

    return (
        <>
            <div className="housing-panel-head">
                <div className="housing-panel-title">
                    {viewMode === 'map'
                        ? t('housing.workspace.panels.center_title')
                        : t('housing.workspace.center.toggle.pinterest')}
                </div>
                <div className="housing-panel-meta">
                    {filtered.length} / {MOCK_LISTINGS.length}
                </div>
            </div>
            <div className="housing-center-area">
                <ViewModeToggle />
                {viewMode === 'map' ? (
                    mapWardListings.length === 0 ? (
                        <EmptyResult />
                    ) : (
                        <MapView onCardClick={handleMapClick} />
                    )
                ) : pinterestListings.length === 0 ? (
                    <EmptyResult />
                ) : (
                    <div className="housing-center-area-scroll">
                        <PinterestView listings={pinterestListings} />
                    </div>
                )}
            </div>
        </>
    );
};
