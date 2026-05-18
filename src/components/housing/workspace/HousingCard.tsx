import type { MockListing } from '../../../data/housing/mockListings';

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
    const imgSrc = resolveImageSource(listing);
    const alt = `${listing.area} ${listing.ward}-${listing.plot}`;
    return (
        <button type="button" className="housing-card" onClick={onClick} aria-label={alt}>
            <div className="housing-card-thumb">
                <img src={imgSrc} alt="" loading="lazy" />
            </div>
            <div className="housing-card-body">
                <div className="housing-card-title">
                    <span>{listing.area} {listing.ward}-{listing.plot}</span>
                    <span className="housing-card-size">{listing.size}</span>
                </div>
                <div className="housing-card-tags">
                    {listing.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="housing-card-tag">{tag}</span>
                    ))}
                </div>
            </div>
        </button>
    );
};
