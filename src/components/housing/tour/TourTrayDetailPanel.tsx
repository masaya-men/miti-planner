import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { canDisplayAddress } from '../../../lib/housing/listingPublish';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { TourLivingMedia } from './TourLivingMedia';
import { HousingerByline } from '../housinger/HousingerByline';

export interface TourTrayDetailPanelProps {
  /** グリッドで選択中の家。トレイが空の一瞬だけ null。 */
  listing: MockListing | null;
  onStartClick: () => void;
  startDisabled: boolean;
}

/**
 * ツアー計画画面(PC)の左側: 選択中の家の詳細を固定表示する。
 * 見た目はツアー実行中の現在地カード(TourShowcasePanel)に準拠するが、
 * 「次の目的地」「報告」等の実行中専用要素は持たない(表示専用の簡易版)。
 */
export const TourTrayDetailPanel: React.FC<TourTrayDetailPanelProps> = ({
  listing,
  onStartClick,
  startDisabled,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="housing-tour-plan-detail">
      {listing ? (
        <div className="housing-tour-plan-detail-body">
          <TourLivingMedia listing={listing} showFavorite={!isEphemeralListingId(listing.id)} />
          {!isEphemeralListingId(listing.id) && <HousingerByline ownerUid={listing.ownerUid} />}
          <h2 className="housing-tour-dest-title">
            {listing.title?.trim()
              || (canDisplayAddress(listing)
                ? formatHousingAddress(listing, i18n.language)
                : t('housing.card.addressPrivate'))}
          </h2>
          <div className="housing-tour-dest-intro">
            <span className="housing-tour-dest-intro-label">{t('housing.tour.nav.dest.memo')}</span>
            <div className="housing-tour-dest-intro-body">
              {listing.description?.trim() ? listing.description : '──'}
            </div>
          </div>
        </div>
      ) : (
        <div className="housing-tour-plan-detail-empty">{t('housing.tray.empty')}</div>
      )}
      <button
        type="button"
        className="housing-tour-tray-start"
        disabled={startDisabled}
        onClick={onStartClick}
      >
        <Play size={14} aria-hidden="true" />
        {t('housing.tray.start')}
      </button>
    </div>
  );
};
