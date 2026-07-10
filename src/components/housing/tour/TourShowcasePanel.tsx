import { useTranslation } from 'react-i18next';
import type { TourStep } from '../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { TourLivingMedia } from './TourLivingMedia';

export interface TourShowcasePanelProps {
  currentStep: TourStep | null;
  /** 次の目的地(タイトル+住所+小メディア)。最後の目的地では null。 */
  nextStep: TourStep | null;
  onOpenReport: () => void;
}

/**
 * 左カラム: 目的地ショーケース (表示専用)。
 * タイトル → 写真/動画(生きたカード) → 住所 → 紹介文(固定高・空は「──」)
 * ── 次の目的地(タイトル+住所小+右寄せ小メディア)
 * ── 報告。
 * 操作(前へ/見学/次へ)と行き方は右パネル(TourProgressPanel)へ移設した。
 */
export const TourShowcasePanel: React.FC<TourShowcasePanelProps> = ({
  currentStep,
  nextStep,
  onOpenReport,
}) => {
  const { t, i18n } = useTranslation();
  const listing = currentStep?.listing ?? null;
  const isApartment = listing?.buildingType === 'apartment';
  const next = nextStep?.listing ?? null;
  const nextIsApartment = next?.buildingType === 'apartment';

  return (
    <div className="housing-tour-dest">
      {listing && (
        <div className="housing-tour-dest-card">
          <div className="housing-tour-dest-title-row">
            <h2 className="housing-tour-dest-title">
              {listing.title?.trim() || formatHousingAddress(listing, i18n.language)}
            </h2>
            {isEphemeralListingId(listing.id) && (
              <span className="housing-ephemeral-badge">{t('housing.ephemeral.badge')}</span>
            )}
          </div>

          <TourLivingMedia listing={listing} />

          <p className="housing-tour-dest-addrsize">
            {formatHousingAddress(listing, i18n.language)}
            {!isApartment && listing.size ? ` ・ ${listing.size}` : ''}
          </p>

          <div className="housing-tour-dest-intro">
            <span className="housing-tour-dest-intro-label">{t('housing.tour.nav.dest.memo')}</span>
            <div className="housing-tour-dest-intro-body">
              {listing.description?.trim() ? listing.description : '──'}
            </div>
          </div>
        </div>
      )}

      <div className="housing-tour-dest-bottom">
        {next && (
          <div className="housing-tour-dest-next">
            <span className="housing-tour-dest-next-label">{t('housing.tour.nav.legend.next')}</span>
            <div className="housing-tour-dest-next-row">
              <div className="housing-tour-dest-next-info">
                <span className="housing-tour-dest-next-title">
                  {next.title?.trim() || formatHousingAddress(next, i18n.language)}
                </span>
                <span className="housing-tour-dest-next-addr">
                  {formatHousingAddress(next, i18n.language)}
                  {!nextIsApartment && next.size ? ` ・ ${next.size}` : ''}
                </span>
              </div>
              <TourLivingMedia listing={next} className="is-next" />
            </div>
          </div>
        )}

        <button type="button" className="housing-tour-dest-report" onClick={onOpenReport}>
          {t('housing.tour.nav.report_button')}
        </button>
      </div>
    </div>
  );
};
