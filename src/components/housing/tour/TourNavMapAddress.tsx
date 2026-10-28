import { useTranslation } from 'react-i18next';
import { formatFullHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { canDisplayFullAddress } from '../../../lib/housing/listingPublish';
import { isExtensionWard } from '../../../lib/housing/resolveWardMapRef';
import type { MockListing } from '../../../data/housing/mockListings';

/** 地図左上のフル住所オーバーレイ(表示のみ)。 */
export const TourNavMapAddress: React.FC<{ addressListing: MockListing; originLabel: string | null }> = ({ addressListing, originLabel }) => {
  const { t, i18n } = useTranslation();
  return (
    <div className="housing-tour-map-address" data-testid="tour-map-address">
      <div className="housing-tour-map-address-full">
        <span className="housing-tour-map-address-full-text">
          {canDisplayFullAddress(addressListing)
            ? formatFullHousingAddress(addressListing, i18n.language)
            : t('housing.card.addressPrivate')}
        </span>
        {canDisplayFullAddress(addressListing) && isExtensionWard(addressListing) && (
          <span className="housing-tour-map-address-badge" data-testid="tour-map-extension-badge">
            {t('housing.tour.nav.address.extension_badge')}
          </span>
        )}
      </div>
      {canDisplayFullAddress(addressListing) && originLabel && (
        <div className="housing-tour-map-address-aetheryte">
          {t('housing.tour.nav.address.nearest_aetheryte', { aetheryte: originLabel })}
        </div>
      )}
    </div>
  );
};
