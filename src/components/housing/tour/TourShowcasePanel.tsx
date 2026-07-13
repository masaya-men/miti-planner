import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TourStep } from '../../../lib/housing/tourNav';
import {
  formatHousingAddress,
  formatFullHousingAddress,
  housingSizeDisplayLabel,
} from '../../../lib/housing/formatHousingAddress';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { saveRegisterPrefill, type RegisterPrefill } from '../../../lib/housing/registerPrefill';
import type { MockListing } from '../../../data/housing/mockListings';
import { TourLivingMedia } from './TourLivingMedia';

export interface TourShowcasePanelProps {
  currentStep: TourStep | null;
  /** 次の目的地(タイトル+住所+小メディア)。最後の目的地では null。 */
  nextStep: TourStep | null;
  onOpenReport: () => void;
}

/**
 * 一時 listing (MockListing 完全互換) の住所/SNS URL を登録フォームへの一回限り受け渡し
 * (registerPrefill) の形へ写す (計画: 住所登録なし一時ツアー Task5)。
 * house/apartment いずれの排他フィールドも createEphemeralListing 側で既に片方だけ入っている
 * (もう片方は undefined) ため、ここでは分岐せずそのまま転記すれば足りる。
 */
function prefillFromListing(listing: MockListing): RegisterPrefill {
  return {
    area: listing.area,
    ward: listing.ward,
    buildingType: listing.buildingType,
    plot: listing.plot,
    size: listing.size,
    apartmentBuilding: listing.apartmentBuilding,
    roomNumber: listing.roomNumber,
    postUrl: listing.postUrl,
  };
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
  const navigate = useNavigate();
  const listing = currentStep?.listing ?? null;
  const isApartment = listing?.buildingType === 'apartment';
  const next = nextStep?.listing ?? null;
  const nextIsApartment = next?.buildingType === 'apartment';

  // 「この家を登録する」(計画: 住所登録なし一時ツアー Task5)。一時の家の住所/SNS URL を
  // sessionStorage 経由で一回だけ登録フォームへ渡し、/housing/register へ遷移する。
  const handleRegisterClick = () => {
    if (!listing) return;
    saveRegisterPrefill(prefillFromListing(listing));
    navigate('/housing/register');
  };

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

          {/* 現在の目的地はどの鯖のどの家か一目で分かるよう、リージョン/DC/ワールド込みの完全住所を出す
              (N: DC込み完全住所)。次の目的地(下の小プレビュー)は幅が狭いため短縮住所のまま。 */}
          <p className="housing-tour-dest-addrsize">
            {formatFullHousingAddress(listing, i18n.language)}
            {!isApartment && listing.size ? ` ・ ${housingSizeDisplayLabel(listing.size)}` : ''}
          </p>

          {isEphemeralListingId(listing.id) && (
            <button
              type="button"
              className="housing-tour-dest-register-link"
              onClick={handleRegisterClick}
            >
              {t('housing.ephemeral.register_link')}
            </button>
          )}

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
                  {!nextIsApartment && next.size ? ` ・ ${housingSizeDisplayLabel(next.size)}` : ''}
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
