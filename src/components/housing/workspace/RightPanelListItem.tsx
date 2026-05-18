import type { MockListing } from '../../../data/housing/mockListings';

export interface RightPanelListItemProps {
    listing: MockListing;
    active: boolean;
    onClick: () => void;
}

const PLACEHOLDER = '/housing/mock-thumbs/1.svg';

export const RightPanelListItem: React.FC<RightPanelListItemProps> = ({ listing, active, onClick }) => {
    const imgSrc =
        listing.imageMode === 'thumbnail' && listing.thumbnailPath
            ? listing.thumbnailPath
            : listing.imageMode === 'sns' && listing.ogImageUrl
                ? listing.ogImageUrl
                : PLACEHOLDER;

    return (
        <button
            type="button"
            data-active={active}
            onClick={onClick}
            className="housing-right-list-item"
        >
            <div className="housing-right-list-item-thumb">
                <img src={imgSrc} alt="" loading="lazy" />
            </div>
            <div className="housing-right-list-item-body">
                <div className="housing-right-list-item-title">
                    {listing.area} {listing.ward}-{listing.plot}
                    <span className="housing-right-list-item-size">{listing.size}</span>
                </div>
                {listing.description && (
                    <div className="housing-right-list-item-desc">{listing.description}</div>
                )}
            </div>
        </button>
    );
};
