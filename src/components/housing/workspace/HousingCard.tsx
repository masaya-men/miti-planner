import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatHousingAddressAria } from '../../../lib/housing/formatHousingAddress';
import {
    handleYoutubeThumbnailError,
    handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { HousingCardAmbientSlideshow } from './HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from './HousingCardVideoOverlay';
import { resolveCoverAspectRatio } from '../../../lib/housing/resolveCoverAspectRatio';

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
    const { t } = useTranslation();
    const isFavorite = useHousingFavoritesStore((s) => s.ids.includes(listing.id));
    const addFavorite = useHousingFavoritesStore((s) => s.add);
    const removeFavorite = useHousingFavoritesStore((s) => s.remove);
    const viewerUid = useAuthStore((s) => s.user?.uid ?? null);
    const isMine = viewerUid !== null && listing.ownerUid === viewerUid;
    const imgSrc = resolveImageSource(listing);
    const alt = formatHousingAddressAria(listing);

    const videoKind: 'twitter' | 'youtube' | null = listing.videoUrl
        ? 'twitter'
        : listing.youtubeVideoId
            ? 'youtube'
            : null;
    // カバー縦横比は resolveCoverAspectRatio で常に確定 (不明時は既定比)。
    // masonry の item 高さと一致させ、全カードで CLS ゼロにするため undefined にしない。
    const coverAspectRatio = resolveCoverAspectRatio(listing);
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
        <div className="housing-card-wrap">
            <button type="button" className="housing-card" onClick={onClick} aria-label={alt}>
                <div
                    className="housing-card-thumb"
                    ref={thumbRef}
                    data-fixed-aspect="true"
                    style={{ aspectRatio: String(coverAspectRatio) }}
                >
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
            </button>
            {isMine && (
                <span className="housing-card-mine-badge" aria-hidden="true">
                    {t('housing.workspace.card.mine_badge')}
                </span>
            )}
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
