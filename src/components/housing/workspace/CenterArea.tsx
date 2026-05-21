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
import { useGalleryListings } from './useGalleryListings';

// 安定参照の空配列 (loading/error 中に applyFilters の deps が毎回変わるのを防ぐ)
const EMPTY_LISTINGS: MockListing[] = [];

export interface CenterAreaProps {
    /** Optional click handler when a card is activated from map / grid. */
    onCardActivate?: (listing: MockListing) => void;
    /** When set, force pinterest view and pre-expand this listing id. */
    focusListingId?: string;
}

export const CenterArea: React.FC<CenterAreaProps> = ({ onCardActivate, focusListingId }) => {
    const { t } = useTranslation();
    const viewMode = useHousingViewStore((s) => s.viewMode);
    const setViewMode = useHousingViewStore((s) => s.setViewMode);
    const dc = useHousingFilterStore((s) => s.dc);
    const regions = useHousingFilterStore((s) => s.regions);
    const servers = useHousingFilterStore((s) => s.servers);
    const areas = useHousingFilterStore((s) => s.areas);
    const sizes = useHousingFilterStore((s) => s.sizes);
    const tags = useHousingFilterStore((s) => s.tags);
    const searchText = useHousingFilterStore((s) => s.searchText);
    const selectedWardId = useHousingRandomStore((s) => s.selectedWardId);
    const selectWard = useHousingRandomStore((s) => s.selectWard);

    // Pinterest (一覧) ビューは実 Firestore データを使う。
    // マップビューは sampleWardLayout (mock 位置) のまま現状維持 (実マップ配置は Phase 2B 別タスク)。
    const gallery = useGalleryListings();
    const galleryListings = gallery.kind === 'ready' ? gallery.listings : EMPTY_LISTINGS;

    // When the URL focuses a specific listing, force pinterest view for card expansion.
    useEffect(() => {
        if (focusListingId) setViewMode('pinterest');
    }, [focusListingId, setViewMode]);

    // Pick a random ward once per session (mock data falls back to SAMPLE_WARD_KEY)
    useEffect(() => {
        if (selectedWardId !== null) return;
        const picked = pickRandomWard(MOCK_LISTINGS, 5) ?? SAMPLE_WARD_KEY;
        selectWard(picked);
    }, [selectedWardId, selectWard]);

    const activeWardKey = selectedWardId ?? SAMPLE_WARD_KEY;

    const filtered = useMemo(
        () => applyFilters(galleryListings, { dc, regions, servers, areas, sizes, tags, searchText }),
        [galleryListings, dc, regions, servers, areas, sizes, tags, searchText],
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
                    {viewMode === 'map'
                        ? `${mapWardListings.length} / ${MOCK_LISTINGS.length}`
                        : `${filtered.length} / ${galleryListings.length}`}
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
                ) : gallery.kind === 'loading' ? (
                    <div className="housing-center-loading">{t('housing.gallery.loading')}</div>
                ) : gallery.kind === 'error' ? (
                    <div className="housing-center-error">{t('housing.gallery.error')}</div>
                ) : pinterestListings.length === 0 ? (
                    <EmptyResult />
                ) : (
                    <div className="housing-center-area-scroll">
                        <PinterestView listings={pinterestListings} initialExpandedId={focusListingId} />
                    </div>
                )}
            </div>
        </>
    );
};
