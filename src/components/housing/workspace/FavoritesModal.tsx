import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play } from 'lucide-react';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { sortByAddress } from '../../../lib/housing/sortByAddress';
import { FavoritesListPane } from './FavoritesListPane';
import { TourBuilderPane } from './TourBuilderPane';
import { ShareTourButton } from './ShareTourButton';
import { MannerNoticeDialog, isMannerNoticeDismissed } from './MannerNoticeDialog';

const TOUR_ID_STORAGE_KEY = 'housing-tour-id';

function getOrCreateTourId(): string {
    if (typeof window === 'undefined' || !window.sessionStorage) return 't-fallback';
    const existing = sessionStorage.getItem(TOUR_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 10)
        : `t-${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(TOUR_ID_STORAGE_KEY, id);
    return id;
}

export interface FavoritesModalProps {
    open: boolean;
    onClose: () => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({ open, onClose }) => {
    const { t } = useTranslation();
    const favoriteIds = useHousingFavoritesStore((s) => s.ids);
    const enterTourMode = useHousingViewStore((s) => s.enterTourMode);
    const setTourListings = useHousingTourStore((s) => s.setListings);
    const startTour = useHousingTourStore((s) => s.start);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [tourIds, setTourIds] = useState<string[]>([]);
    const [mannerOpen, setMannerOpen] = useState(false);

    const tourId = useMemo(getOrCreateTourId, []);

    // Each time the modal opens, reset both the multi-select state and the
    // tour-builder draft so the user starts from a clean slate.
    useEffect(() => {
        if (open) {
            setSelected(new Set());
            setTourIds([]);
        }
    }, [open]);

    if (!open) return null;

    const allFavoritesSorted = (): string[] => {
        const all = favoriteIds
            .map((id) => MOCK_LISTINGS.find((l) => l.id === id))
            .filter((l): l is typeof MOCK_LISTINGS[number] => Boolean(l));
        return sortByAddress(all).map((l) => l.id);
    };

    const beginTourStart = () => {
        if (favoriteIds.length === 0) return;
        if (isMannerNoticeDismissed()) {
            commitStart();
        } else {
            setMannerOpen(true);
        }
    };

    const commitStart = () => {
        const ids = tourIds.length > 0 ? tourIds : allFavoritesSorted();
        if (ids.length === 0) return;
        setTourListings(ids);
        startTour();
        enterTourMode();
        setMannerOpen(false);
        onClose();
    };

    // The tour-builder displays whatever the user has staged. If nothing is
    // staged, mirror the multi-select picks (so picking on the left side starts
    // populating the right side immediately).
    const builderIds = tourIds.length > 0 ? tourIds : Array.from(selected);

    return (
        <>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={t('housing.workspace.favorites.title')}
                className="housing-favorites-backdrop"
                onClick={onClose}
            >
                <div
                    className="housing-favorites-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="housing-favorites-modal-bar">
                        <div className="housing-favorites-modal-actions">
                            <button
                                type="button"
                                onClick={beginTourStart}
                                disabled={favoriteIds.length === 0}
                                className="housing-favorites-run-all-btn"
                            >
                                <Play size={14} aria-hidden="true" />
                                <span>
                                    {t('housing.workspace.favorites.run_all')} ({favoriteIds.length})
                                </span>
                            </button>
                            <div className="housing-favorites-share-slot">
                                <ShareTourButton tourId={tourId} />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={t('housing.workspace.favorites.close_modal')}
                            className="housing-favorites-close-btn"
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="housing-favorites-modal-body">
                        <div className="housing-favorites-modal-pane housing-favorites-modal-pane-left">
                            <FavoritesListPane
                                selected={selected}
                                onSelectionChange={setSelected}
                            />
                        </div>
                        <div className="housing-favorites-modal-pane housing-favorites-modal-pane-right">
                            <TourBuilderPane listingIds={builderIds} onChange={setTourIds} />
                        </div>
                    </div>
                </div>
            </div>

            <MannerNoticeDialog
                open={mannerOpen}
                onCancel={() => setMannerOpen(false)}
                onStart={commitStart}
            />
        </>
    );
};
