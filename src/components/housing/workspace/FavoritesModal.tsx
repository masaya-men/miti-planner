import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play } from 'lucide-react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    type DragEndEvent,
    type DragStartEvent,
    type Modifier,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { sortByAddress } from '../../../lib/housing/sortByAddress';
import { FavoritesListPane } from './FavoritesListPane';
import { TourBuilderPane, TOUR_BUILDER_DROP_ID } from './TourBuilderPane';
import { ShareTourButton } from './ShareTourButton';
import { MannerNoticeDialog, isMannerNoticeDismissed } from './MannerNoticeDialog';

const TOUR_ID_STORAGE_KEY = 'housing-tour-id';

/**
 * DragOverlay modifier: pin the overlay's center to the cursor instead of
 * keeping the source's relative offset. Without this the pill UI shows up
 * far from where the user actually clicked (because the source card is much
 * bigger than the overlay pill). Mirrors dnd-kit/modifiers' snapCenterToCursor.
 */
const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
    if (!draggingNodeRect || !activatorEvent) return transform;
    const coords = getEventCoordinates(activatorEvent);
    if (!coords) return transform;
    const offsetX = coords.x - draggingNodeRect.left;
    const offsetY = coords.y - draggingNodeRect.top;
    return {
        ...transform,
        x: transform.x + offsetX - draggingNodeRect.width / 2,
        y: transform.y + offsetY - draggingNodeRect.height / 2,
    };
};

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
    const [staging, setStaging] = useState(false);
    const [autoSort, setAutoSort] = useState(true);
    const [draggingFavId, setDraggingFavId] = useState<string | null>(null);

    const tourId = useMemo(getOrCreateTourId, []);

    // PointerSensor with a small activation distance so single-clicks still
    // fire the multi-select handler instead of being swallowed by the drag.
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    // Each time the modal opens, reset both the multi-select state and the
    // tour-builder draft so the user starts from a clean slate.
    useEffect(() => {
        if (open) {
            setSelected(new Set());
            setTourIds([]);
            setStaging(false);
            setAutoSort(true);
        }
    }, [open]);

    if (!open) return null;

    const allFavoritesSorted = (): string[] => {
        const all = favoriteIds
            .map((id) => MOCK_LISTINGS.find((l) => l.id === id))
            .filter((l): l is typeof MOCK_LISTINGS[number] => Boolean(l));
        return sortByAddress(all).map((l) => l.id);
    };

    // §7.5: "入った瞬間に並び替えが動的にアニメーションで可視化される". Stage the
    // ids in the tour builder first so the spring/FLIP animation runs, then
    // either confirm via the manner notice or commit straight through.
    const STAGE_ANIMATION_MS = 700;

    const beginTourStart = () => {
        if (favoriteIds.length === 0) return;
        const ids = tourIds.length > 0 ? tourIds : allFavoritesSorted();
        if (ids.length === 0) return;
        setTourIds(ids);
        setStaging(true);
        window.setTimeout(() => {
            setStaging(false);
            if (isMannerNoticeDismissed()) {
                commitStart(ids);
            } else {
                setMannerOpen(true);
            }
        }, STAGE_ANIMATION_MS);
    };

    const commitStart = (ids?: string[]) => {
        const target = ids ?? (tourIds.length > 0 ? tourIds : allFavoritesSorted());
        if (target.length === 0) return;
        setTourListings(target);
        startTour();
        enterTourMode();
        setMannerOpen(false);
        onClose();
    };

    // §7.4: DnD でツアーエリアへ. Identify by id prefix so favorites cards and
    // tour-builder items live in the same DndContext without colliding.
    const handleDragStart = (event: DragStartEvent) => {
        const idStr = String(event.active.id);
        if (idStr.startsWith('fav:')) setDraggingFavId(idStr.slice(4));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setDraggingFavId(null);
        const { active, over } = event;
        if (!over) return;
        const activeId = String(active.id);
        const overId = String(over.id);

        if (activeId.startsWith('fav:')) {
            // Dropped a favorites card → add to tour
            const droppedOnBuilder = overId === TOUR_BUILDER_DROP_ID || overId.startsWith('tour:');
            if (!droppedOnBuilder) return;
            const dragged = activeId.slice(4);
            // Multi-select drag: if the dragged card is in the current selection,
            // bring the whole selection along; otherwise just the single card.
            const idsToAdd = selected.has(dragged) ? Array.from(selected) : [dragged];
            const merged = Array.from(new Set([...tourIds, ...idsToAdd]));
            if (merged.length === tourIds.length) return; // nothing new
            setTourIds(merged); // TourBuilderPane's autoSort effect will re-sort if active
            // Clear multi-select after a successful drop (parity with Finder DnD).
            setSelected(new Set());
        } else if (activeId.startsWith('tour:') && overId.startsWith('tour:')) {
            // Reorder within the tour builder.
            if (activeId === overId) return;
            const fromId = activeId.slice(5);
            const toId = overId.slice(5);
            const oldIdx = tourIds.indexOf(fromId);
            const newIdx = tourIds.indexOf(toId);
            if (oldIdx === -1 || newIdx === -1) return;
            setTourIds(arrayMove(tourIds, oldIdx, newIdx));
            // User-driven reorder disables auto-sort so the new order sticks.
            setAutoSort(false);
        }
    };

    const draggingListing = draggingFavId
        ? MOCK_LISTINGS.find((l) => l.id === draggingFavId)
        : null;
    const draggingCount = draggingFavId
        ? (selected.has(draggingFavId) ? selected.size : 1)
        : 0;

    // The tour-builder shows ONLY explicitly-staged ids — driven either by
    // DnD from the favorites pane or by "全部回る". Click-selecting on the left
    // is just multi-select state and does NOT bleed into the tour builder,
    // otherwise a casual click feels like you've already committed to a tour.
    const builderIds = tourIds;

    return (
        <>
            <DndContext
                sensors={sensors}
                autoScroll={false}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
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
                                    disabled={favoriteIds.length === 0 || staging}
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
                                <TourBuilderPane
                                    listingIds={builderIds}
                                    onChange={setTourIds}
                                    autoSort={autoSort}
                                    onAutoSortChange={setAutoSort}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
                    {draggingListing && (
                        <div className="housing-drag-overlay">
                            <span className="housing-drag-overlay-label">
                                {draggingListing.area} {draggingListing.ward}-{draggingListing.plot}
                            </span>
                            {draggingCount > 1 && (
                                <span className="housing-drag-overlay-count">+{draggingCount - 1}</span>
                            )}
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            <MannerNoticeDialog
                open={mannerOpen}
                onCancel={() => setMannerOpen(false)}
                onStart={() => commitStart()}
            />
        </>
    );
};
