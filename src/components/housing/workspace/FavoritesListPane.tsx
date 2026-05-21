import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import type { MockListing } from '../../../data/housing/mockListings';
import { useMarqueeSelection } from '../../../lib/housing/useMarqueeSelection';
import { FavoriteCard, type FavoriteCardClickModifiers } from './FavoriteCard';

export interface FavoritesListPaneProps {
    selected: Set<string>;
    onSelectionChange: (next: Set<string>) => void;
}

export const FavoritesListPane: React.FC<FavoritesListPaneProps> = ({
    selected,
    onSelectionChange,
}) => {
    const { t } = useTranslation();
    const favoriteIds = useHousingFavoritesStore((s) => s.ids);
    const listings = useHousingListingsStore((s) => s.listings);
    const favorites = favoriteIds
        .map((id) => listings.find((l) => l.id === id))
        .filter((l): l is MockListing => Boolean(l));
    const containerRef = useRef<HTMLDivElement>(null);
    const lastClickedRef = useRef<string | null>(null);

    const handleCardClick = useCallback(
        (id: string, mod: FavoriteCardClickModifiers) => {
            const next = new Set(selected);
            if (mod.shift && lastClickedRef.current) {
                const ids = favorites.map((l) => l.id);
                const a = ids.indexOf(lastClickedRef.current);
                const b = ids.indexOf(id);
                if (a !== -1 && b !== -1) {
                    const lo = Math.min(a, b);
                    const hi = Math.max(a, b);
                    for (let i = lo; i <= hi; i++) next.add(ids[i]);
                }
            } else if (mod.ctrl || mod.meta) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            } else {
                next.clear();
                next.add(id);
            }
            lastClickedRef.current = id;
            onSelectionChange(next);
        },
        [favorites, selected, onSelectionChange],
    );

    const marqueeRect = useMarqueeSelection({
        containerRef,
        itemSelector: '[data-listing-id]',
        onComplete: (ids, mod) => {
            const additive = mod.shift || mod.ctrl || mod.meta;
            const next = additive ? new Set(selected) : new Set<string>();
            ids.forEach((id) => next.add(id));
            onSelectionChange(next);
        },
    });

    if (favorites.length === 0) {
        return (
            <div className="housing-favorites-empty">
                <p>{t('housing.workspace.favorites.empty')}</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="housing-favorites-pane">
            <div className="housing-favorites-pane-head">
                <h3 className="housing-favorites-pane-title">
                    {t('housing.workspace.favorites.title')} ({favorites.length})
                </h3>
                {selected.size > 0 && (
                    <button
                        type="button"
                        onClick={() => onSelectionChange(new Set())}
                        className="housing-favorites-clear-btn"
                    >
                        {t('housing.workspace.favorites.clear_selection')} ({selected.size})
                    </button>
                )}
            </div>
            <p className="housing-favorites-pane-hint">{t('housing.workspace.favorites.hint')}</p>
            <div className="housing-favorites-list">
                {favorites.map((listing) => (
                    <FavoriteCard
                        key={listing.id}
                        listing={listing}
                        selected={selected.has(listing.id)}
                        onClick={(mod) => handleCardClick(listing.id, mod)}
                    />
                ))}
            </div>
            {marqueeRect && (
                <div
                    className="housing-marquee-rect"
                    style={{
                        left: marqueeRect.x,
                        top: marqueeRect.y,
                        width: marqueeRect.w,
                        height: marqueeRect.h,
                    }}
                />
            )}
        </div>
    );
};
