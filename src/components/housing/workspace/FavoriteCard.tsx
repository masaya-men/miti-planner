import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';

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
