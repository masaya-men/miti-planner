import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';

const PLACEHOLDER = '/housing/mock-thumbs/placeholder.svg';

export interface MapBubbleCardProps {
    listing: MockListing;
    /** Normalized 0..1 within the parent map container. */
    x: number;
    y: number;
    onClick: () => void;
}

function resolveImageSource(listing: MockListing): string {
    if (listing.imageMode === 'thumbnail' && listing.thumbnailPath) return listing.thumbnailPath;
    if (listing.imageMode === 'sns' && listing.ogImageUrl) return listing.ogImageUrl;
    return PLACEHOLDER;
}

export const MapBubbleCard: React.FC<MapBubbleCardProps> = ({ listing, x, y, onClick }) => {
    const { t } = useTranslation();
    const isFavorite = useHousingFavoritesStore((s) => s.ids.includes(listing.id));
    const addFavorite = useHousingFavoritesStore((s) => s.add);
    const removeFavorite = useHousingFavoritesStore((s) => s.remove);
    const imgSrc = resolveImageSource(listing);
    const alt = `${listing.area} ${listing.ward}-${listing.plot}`;

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFavorite) removeFavorite(listing.id);
        else addFavorite(listing.id);
    };

    return (
        <button
            type="button"
            className="housing-bubble-card"
            style={{ left: `${(x * 100).toFixed(3)}%`, top: `${(y * 100).toFixed(3)}%` }}
            onClick={onClick}
            aria-label={alt}
        >
            <div className="housing-bubble-card-body">
                <div className="housing-bubble-card-thumb">
                    <img src={imgSrc} alt="" loading="lazy" />
                </div>
                <div className="housing-bubble-card-label">
                    {listing.area.slice(0, 3)} {listing.ward}-{listing.plot}
                </div>
            </div>
            <span
                role="button"
                tabIndex={0}
                className="housing-bubble-card-fav"
                data-active={isFavorite}
                aria-label={isFavorite
                    ? t('housing.workspace.card.favorite_remove')
                    : t('housing.workspace.card.favorite')}
                aria-pressed={isFavorite}
                onClick={handleFavoriteClick}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleFavoriteClick(e as unknown as React.MouseEvent);
                    }
                }}
            >
                <Heart size={12} aria-hidden="true" fill={isFavorite ? 'currentColor' : 'none'} />
            </span>
            <span className="housing-bubble-card-pin" aria-hidden="true" />
        </button>
    );
};
