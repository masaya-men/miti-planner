import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_LISTINGS, type MockListing } from '../../../data/housing/mockListings';
import { sortByAddress } from '../../../lib/housing/sortByAddress';
import { TourBuilderItem } from './TourBuilderItem';

export const TOUR_BUILDER_DROP_ID = 'tour-zone';

export interface TourBuilderPaneProps {
    listingIds: string[];
    onChange: (next: string[]) => void;
    /** Externally controlled "auto re-sort by address" toggle. The pane owns the
     *  default value (`true`), but the parent can flip it back to `true` after
     *  a user customizes the order from outside (e.g. dropping new items). */
    autoSort?: boolean;
    onAutoSortChange?: (next: boolean) => void;
}

export const TourBuilderPane: React.FC<TourBuilderPaneProps> = ({
    listingIds,
    onChange,
    autoSort: autoSortProp,
    onAutoSortChange,
}) => {
    const { t } = useTranslation();
    const [internalAutoSort, setInternalAutoSort] = useState(true);
    const autoSort = autoSortProp ?? internalAutoSort;
    const setAutoSort = (next: boolean) => {
        if (onAutoSortChange) onAutoSortChange(next);
        else setInternalAutoSort(next);
    };

    const { setNodeRef, isOver } = useDroppable({ id: TOUR_BUILDER_DROP_ID });

    const listings = useMemo<MockListing[]>(
        () => listingIds
            .map((id) => MOCK_LISTINGS.find((l) => l.id === id))
            .filter((l): l is MockListing => Boolean(l)),
        [listingIds],
    );

    // Re-sort whenever autoSort is on and the address order doesn't match.
    useEffect(() => {
        if (!autoSort) return;
        if (listings.length < 2) return;
        const sortedIds = sortByAddress(listings).map((l) => l.id);
        if (sortedIds.join(',') !== listingIds.join(',')) {
            onChange(sortedIds);
        }
    }, [autoSort, listings, listingIds, onChange]);

    const sortableIds = listingIds.map((id) => `tour:${id}`);

    return (
        <div className="housing-tour-builder" data-drop-active={isOver}>
            <div className="housing-tour-builder-head">
                <h3 className="housing-tour-builder-title">
                    {t('housing.workspace.tour_builder.title')} ({listings.length})
                </h3>
                {!autoSort && listings.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setAutoSort(true)}
                        className="housing-tour-builder-sort-btn"
                    >
                        {t('housing.workspace.tour_builder.sort_by_address')}
                    </button>
                )}
            </div>
            <div ref={setNodeRef} className="housing-tour-builder-body" data-drop-over={isOver}>
                {listings.length === 0 ? (
                    <div className="housing-tour-builder-empty">
                        <p>{t('housing.workspace.tour_builder.empty')}</p>
                    </div>
                ) : (
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                        <AnimatePresence initial={false}>
                            {listings.map((listing, i) => (
                                <motion.div
                                    key={listing.id}
                                    layout
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                >
                                    <TourBuilderItem
                                        listing={listing}
                                        index={i}
                                        onRemove={() =>
                                            onChange(listingIds.filter((id) => id !== listing.id))
                                        }
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </SortableContext>
                )}
            </div>
        </div>
    );
};
