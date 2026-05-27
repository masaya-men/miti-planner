import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { formatHousingAddressAria } from '../../../lib/housing/formatHousingAddress';
import {
    handleYoutubeThumbnailError,
    handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { HousingCardAmbientSlideshow } from './HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from './HousingCardVideoOverlay';

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
    const alt = formatHousingAddressAria(listing);

    const videoKind: 'twitter' | 'youtube' | null = listing.videoUrl
        ? 'twitter'
        : listing.youtubeVideoId
            ? 'youtube'
            : null;
    const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing.id, videoKind !== null);
    const thumbRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        register(thumbRef.current);
        return (): void => register(null);
    }, [register]);

    const frames = useHousingCardFrames(listing, ambientOn);

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
                <div className="housing-bubble-card-thumb" ref={thumbRef}>
                    <img
                        src={imgSrc}
                        alt=""
                        loading="lazy"
                        onError={handleYoutubeThumbnailError}
                        onLoad={handleYoutubeThumbnailLoad}
                    />
                    <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn} />
                    {isPlaying && videoKind === 'twitter' && listing.videoUrl && (
                        <HousingCardVideoOverlay
                            kind="twitter"
                            videoUrl={listing.videoUrl}
                            posterUrl={listing.videoPosterUrl}
                        />
                    )}
                    {isPlaying && videoKind === 'youtube' && listing.youtubeVideoId && (
                        <HousingCardVideoOverlay
                            kind="youtube"
                            youtubeVideoId={listing.youtubeVideoId}
                        />
                    )}
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
