import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_LISTINGS, type MockListing } from '../../../data/housing/mockListings';
import { sortByAddress } from '../../../lib/housing/sortByAddress';
import { TourBuilderItem } from './TourBuilderItem';

export interface TourBuilderPaneProps {
    listingIds: string[];
    onChange: (next: string[]) => void;
}

export const TourBuilderPane: React.FC<TourBuilderPaneProps> = ({ listingIds, onChange }) => {
    const { t } = useTranslation();
    const [autoSort, setAutoSort] = useState(true);

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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIdx = listingIds.indexOf(String(active.id));
        const newIdx = listingIds.indexOf(String(over.id));
        if (oldIdx === -1 || newIdx === -1) return;
        onChange(arrayMove(listingIds, oldIdx, newIdx));
        setAutoSort(false);
    };

    return (
        <div className="housing-tour-builder">
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
            <div className="housing-tour-builder-body">
                {listings.length === 0 ? (
                    <div className="housing-tour-builder-empty">
                        <p>{t('housing.workspace.tour_builder.empty')}</p>
                    </div>
                ) : (
                    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={listingIds} strategy={verticalListSortingStrategy}>
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
                    </DndContext>
                )}
            </div>
        </div>
    );
};
