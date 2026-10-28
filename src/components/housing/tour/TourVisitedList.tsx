import { useTranslation } from 'react-i18next';
import { Lock, Route } from 'lucide-react';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { canDisplayAddress } from '../../../lib/housing/listingPublish';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { representativeImage, hasRepresentativeImage } from '../../../lib/housing/representativeImage';
import type { MockListing } from '../../../data/housing/mockListings';
import { HousingImage } from '../media/HousingImage';
import './TourVisitedList.css';

export interface TourVisitedListProps {
  /** 見学済みの家 (ツアーで回った順)。 */
  listings: MockListing[];
}

/**
 * ナビ中の並び替え画面: 見学済みの家の固定リスト。
 * 鍵アイコン・番号・サムネ・名前・「見学済み」。薄く表示しドラッグ・削除はできない。
 * 0 件のときは何も描画しない (小見出しごと呼び出し側で出さない)。
 */
export const TourVisitedList: React.FC<TourVisitedListProps> = ({ listings }) => {
  const { t, i18n } = useTranslation();
  if (listings.length === 0) return null;

  return (
    <ol className="housing-tour-visited-list">
      {listings.map((l, index) => {
        const addr = canDisplayAddress(l)
          ? formatHousingAddress(l, i18n.language)
          : t('housing.card.addressPrivate');
        const title = l.title?.trim() || addr;
        const showImage = !isEphemeralListingId(l.id) && hasRepresentativeImage(l);
        return (
          <li key={l.id} className="housing-tour-visited-item" title={title}>
            <Lock size={14} className="housing-tour-visited-lock" aria-hidden="true" />
            <span className="housing-tour-visited-num">{index + 1}</span>
            {showImage ? (
              <HousingImage className="housing-tour-tray-thumb" src={representativeImage(l)} variant="small" />
            ) : (
              <span className="housing-tour-tray-thumb housing-tour-tray-thumb-placeholder" aria-hidden="true">
                <Route size={16} aria-hidden="true" />
              </span>
            )}
            <span className="housing-tour-tray-info">
              <span className="housing-tour-tray-title">{title}</span>
            </span>
            <span className="housing-tour-visited-tag">{t('housing.tour.replan.visited')}</span>
          </li>
        );
      })}
    </ol>
  );
};
