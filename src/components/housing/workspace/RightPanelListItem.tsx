import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import {
    handleYoutubeThumbnailError,
    handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';

export interface RightPanelListItemProps {
    listing: MockListing;
    active: boolean;
    onClick: () => void;
}

const PLACEHOLDER = '/housing/mock-thumbs/1.svg';

export const RightPanelListItem: React.FC<RightPanelListItemProps> = ({ listing, active, onClick }) => {
    const { i18n } = useTranslation();
    const imgSrc =
        listing.imageMode === 'thumbnail' && listing.thumbnailPath
            ? listing.thumbnailPath
            : listing.imageMode === 'sns' && listing.ogImageUrl
                ? listing.ogImageUrl
                : PLACEHOLDER;
    const title = formatHousingAddress(listing, i18n.language);
    const isApartment = listing.buildingType === 'apartment';

    return (
        <button
            type="button"
            data-active={active}
            onClick={onClick}
            className="housing-right-list-item"
        >
            <div className="housing-right-list-item-thumb">
                <img
                    src={imgSrc}
                    alt=""
                    loading="lazy"
                    onError={handleYoutubeThumbnailError}
                    onLoad={handleYoutubeThumbnailLoad}
                />
            </div>
            <div className="housing-right-list-item-body">
                <div className="housing-right-list-item-title">
                    {title}
                    {!isApartment && listing.size && (
                        <span className="housing-right-list-item-size">{listing.size}</span>
                    )}
                </div>
                {listing.description && (
                    <div className="housing-right-list-item-desc">{listing.description}</div>
                )}
            </div>
        </button>
    );
};
