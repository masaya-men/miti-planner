import { useDraggable } from '@dnd-kit/core';
import type { MockListing } from '../../../data/housing/mockListings';

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
    const imgSrc =
        listing.imageMode === 'thumbnail' && listing.thumbnailPath
            ? listing.thumbnailPath
            : listing.imageMode === 'sns' && listing.ogImageUrl
                ? listing.ogImageUrl
                : PLACEHOLDER;

    // No transform — we render a DragOverlay so the source element stays
    // anchored. Just fade the source to communicate "this is the one being
    // dragged" (Notion / Trello convention).
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: dragId(listing.id),
        data: { source: 'favorites', listingId: listing.id },
    });

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
            <div className="housing-favorite-card-thumb">
                <img src={imgSrc} alt="" loading="lazy" />
            </div>
            <div className="housing-favorite-card-body">
                <div className="housing-favorite-card-title">
                    {listing.dc}/{listing.server} {listing.area} {listing.ward}-{listing.plot}
                    <span className="housing-favorite-card-size">{listing.size}</span>
                </div>
                {listing.description && (
                    <div className="housing-favorite-card-desc">{listing.description}</div>
                )}
            </div>
        </button>
    );
};
