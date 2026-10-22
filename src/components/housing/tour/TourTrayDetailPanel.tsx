import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { canDisplayAddress, canDisplayFullAddress } from '../../../lib/housing/listingPublish';
import { formatFullHousingAddress, formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { TourLivingMedia } from './TourLivingMedia';
import { HousingerByline } from '../housinger/HousingerByline';

export interface TourTrayDetailPanelProps {
  /** グリッドで選択中の家。トレイが空の一瞬だけ null。 */
  listing: MockListing | null;
  onStartClick: () => void;
  startDisabled: boolean;
  /** 開始ボタンの文言の差し替え (ナビ中の並び替え用)。未指定は housing.tray.start。 */
  startLabel?: string;
  /** 開始ボタンの上に出す補足文 (任意)。 */
  note?: string;
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
  startLabel,
  note,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="housing-tour-plan-detail">
      {listing ? (
        <div className="housing-tour-plan-detail-body">
          <TourLivingMedia key={listing.id} listing={listing} showFavorite={!isEphemeralListingId(listing.id)} />
          {!isEphemeralListingId(listing.id) && <HousingerByline ownerUid={listing.ownerUid} />}
          <h2 className="housing-tour-dest-title">
            {listing.title?.trim()
              || (canDisplayAddress(listing)
                ? formatHousingAddress(listing, i18n.language)
                : t('housing.card.addressPrivate'))}
          </h2>
          {/* タイトルがあるときだけ住所を 1 行足す (タイトル無しは h2 自体が住所なので重複させない)。
              非公開(住所を出せない)ときは出さない。 */}
          {listing.title?.trim() && canDisplayAddress(listing) && (
            <p className="housing-tour-dest-addrsize">
              {canDisplayFullAddress(listing)
                ? formatFullHousingAddress(listing, i18n.language)
                : formatHousingAddress(listing, i18n.language)}
            </p>
          )}
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
      {note && <p className="housing-tour-plan-detail-note">{note}</p>}
      <button
        type="button"
        className="housing-tour-tray-start"
        disabled={startDisabled}
        onClick={onStartClick}
      >
        <Play size={14} aria-hidden="true" />
        {startLabel ?? t('housing.tray.start')}
      </button>
    </div>
  );
};
