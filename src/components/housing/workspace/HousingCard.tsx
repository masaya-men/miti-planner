import { useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { formatHousingAddress, formatHousingAddressAria } from '../../../lib/housing/formatHousingAddress';
import {
    handleYoutubeThumbnailError,
    handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { resolveSlideshowFrames } from '../../../lib/housing/slideshowFrames';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { HousingCardAmbientSlideshow } from './HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from './HousingCardVideoOverlay';

const PLACEHOLDER = '/housing/mock-thumbs/placeholder.svg';

export interface HousingCardProps {
    listing: MockListing;
    onClick: () => void;
}

function resolveImageSource(listing: MockListing): string {
    if (listing.imageMode === 'thumbnail' && listing.thumbnailPath) return listing.thumbnailPath;
    if (listing.imageMode === 'sns' && listing.ogImageUrl) return listing.ogImageUrl;
    return PLACEHOLDER;
}

export const HousingCard: React.FC<HousingCardProps> = ({ listing, onClick }) => {
    const { t, i18n } = useTranslation();
    const isFavorite = useHousingFavoritesStore((s) => s.ids.includes(listing.id));
    const addFavorite = useHousingFavoritesStore((s) => s.add);
    const removeFavorite = useHousingFavoritesStore((s) => s.remove);
    const imgSrc = resolveImageSource(listing);
    const alt = formatHousingAddressAria(listing);
    const title = formatHousingAddress(listing, i18n.language);
    const isApartment = listing.buildingType === 'apartment';

    const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing.id);
    const thumbRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        register(thumbRef.current);
        return (): void => register(null);
    }, [register]);

    const frames = useMemo(() => resolveSlideshowFrames(listing), [listing]);
    const videoKind: 'twitter' | 'youtube' | null = listing.videoUrl
        ? 'twitter'
        : listing.youtubeVideoId
            ? 'youtube'
            : null;

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFavorite) removeFavorite(listing.id);
        else addFavorite(listing.id);
    };

    return (
        <div className="housing-card-wrap">
            <button type="button" className="housing-card" onClick={onClick} aria-label={alt}>
                <div className="housing-card-thumb" ref={thumbRef}>
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
                <div className="housing-card-body">
                    <div className="housing-card-title">
                        <span>{title}</span>
                        {!isApartment && listing.size && (
                            <span className="housing-card-size">{listing.size}</span>
                        )}
                    </div>
                    <div className="housing-card-tags">
                        {listing.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="housing-card-tag">{tag}</span>
                        ))}
                    </div>
                </div>
            </button>
            <button
                type="button"
                className="housing-card-fav-overlay"
                data-active={isFavorite}
                aria-label={isFavorite
                    ? t('housing.workspace.card.favorite_remove')
                    : t('housing.workspace.card.favorite')}
                aria-pressed={isFavorite}
                onClick={handleFavoriteClick}
            >
                <Heart size={14} aria-hidden="true" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
        </div>
    );
};
