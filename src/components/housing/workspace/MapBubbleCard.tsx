import type { MockListing } from '../../../data/housing/mockListings';

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
    const imgSrc = resolveImageSource(listing);
    const alt = `${listing.area} ${listing.ward}-${listing.plot}`;
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
            <span className="housing-bubble-card-pin" aria-hidden="true" />
        </button>
    );
};
