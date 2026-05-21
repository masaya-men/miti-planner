import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { useHousingRandomStore } from '../../../store/useHousingRandomStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { listListingsForWard } from '../../../lib/housing/randomWard';
import { AutoScrollList } from './AutoScrollList';
import { TourProgressList } from './TourProgressList';
import { TourKeyboardController } from './TourKeyboardController';
import { PanelCloseButton } from './PanelCloseButton';
import { ResultCountBadge } from './ResultCountBadge';

const TOUR_ID_STORAGE_KEY = 'housing-tour-id';

function getOrCreateTourId(): string {
    if (typeof window === 'undefined' || !window.sessionStorage) {
        return 't-fallback';
    }
    const existing = sessionStorage.getItem(TOUR_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 10)
        : `t-${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(TOUR_ID_STORAGE_KEY, id);
    return id;
}

export interface RightPanelProps {
    onClose: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const mode = useHousingViewStore((s) => s.mode);
    const viewMode = useHousingViewStore((s) => s.viewMode);
    const dc = useHousingFilterStore((s) => s.dc);
    const regions = useHousingFilterStore((s) => s.regions);
    const servers = useHousingFilterStore((s) => s.servers);
    const areas = useHousingFilterStore((s) => s.areas);
    const sizes = useHousingFilterStore((s) => s.sizes);
    const tags = useHousingFilterStore((s) => s.tags);
    const searchText = useHousingFilterStore((s) => s.searchText);
    const selectedWardId = useHousingRandomStore((s) => s.selectedWardId);
    // list ビューは共有ストアの実データ。map ビューは sampleWardLayout (mock) のまま (Phase 2B)。
    const listings = useHousingListingsStore((s) => s.listings);

    const tourId = useMemo(getOrCreateTourId, []);

    const browseListings = useMemo(() => {
        if (viewMode === 'map' && selectedWardId) {
            return listListingsForWard(MOCK_LISTINGS, selectedWardId);
        }
        return applyFilters(listings, { dc, regions, servers, areas, sizes, tags, searchText })
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [viewMode, selectedWardId, listings, dc, regions, servers, areas, sizes, tags, searchText]);

    const browseTotal = viewMode === 'map' ? MOCK_LISTINGS.length : listings.length;

    const isTour = mode === 'tour';

    return (
        <>
            <div className="housing-panel-head">
                <div className="housing-panel-title">
                    {isTour
                        ? t('housing.workspace.panels.right_title_tour', { defaultValue: 'Tour' })
                        : t('housing.workspace.panels.right_title')}
                </div>
                <div className="housing-panel-meta">
                    {isTour ? null : (
                        <ResultCountBadge result={browseListings.length} total={browseTotal} />
                    )}
                </div>
            </div>
            <div className="housing-panel-body housing-right-panel-body">
                {isTour ? (
                    <TourProgressList tourId={tourId} />
                ) : (
                    <AutoScrollList listings={browseListings} />
                )}
                {!isTour && (
                    <div className="housing-filter-panel-footer">
                        <PanelCloseButton direction="right" onClick={onClose} />
                    </div>
                )}
            </div>
            <TourKeyboardController />
        </>
    );
};
