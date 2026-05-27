import { useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import {
    handleYoutubeThumbnailError,
    handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { HousingCardAmbientSlideshow } from './HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from './HousingCardVideoOverlay';

export interface FavoriteCardClickModifiers {
    shift: boolean;
    ctrl: boolean;
    meta: boolean;
}

export interface FavoriteCardProps {
    listing: MockListing;
    selected: boolean;
    onClick: (mod: FavoriteCardClickModifiers) => void;
}

const PLACEHOLDER = '/housing/mock-thumbs/1.svg';

export const dragId = (listingId: string) => `fav:${listingId}`;

export const FavoriteCard: React.FC<FavoriteCardProps> = ({ listing, selected, onClick }) => {
    const { i18n } = useTranslation();
    const imgSrc =
        listing.imageMode === 'thumbnail' && listing.thumbnailPath
            ? listing.thumbnailPath
            : listing.imageMode === 'sns' && listing.ogImageUrl
                ? listing.ogImageUrl
                : PLACEHOLDER;
    const addr = formatHousingAddress(listing, i18n.language);
    const isApartment = listing.buildingType === 'apartment';

    // No transform — we render a DragOverlay so the source element stays
    // anchored. Just fade the source to communicate "this is the one being
    // dragged" (Notion / Trello convention).
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: dragId(listing.id),
        data: { source: 'favorites', listingId: listing.id },
    });

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

    return (
        <button
            ref={setNodeRef}
            type="button"
            data-listing-id={listing.id}
            data-selected={selected}
            data-dragging={isDragging}
            onClick={(e) => onClick({ shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey })}
            className="housing-favorite-card"
            {...listeners}
            {...attributes}
        >
            <div className="housing-favorite-card-thumb" ref={thumbRef}>
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
            <div className="housing-favorite-card-body">
                <div className="housing-favorite-card-title">
                    {listing.dc}/{listing.server} {addr}
                    {!isApartment && listing.size && (
                        <span className="housing-favorite-card-size">{listing.size}</span>
                    )}
                </div>
                {listing.description && (
                    <div className="housing-favorite-card-desc">{listing.description}</div>
                )}
            </div>
        </button>
    );
};
