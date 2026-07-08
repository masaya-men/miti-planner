import { useTranslation } from 'react-i18next';
import type { TourStep } from '../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { TourLivingMedia } from './TourLivingMedia';

export interface TourShowcasePanelProps {
  currentStep: TourStep | null;
  /** 次の目的地(生きたカードのメディアのみ)。最後の目的地では null。 */
  nextStep: TourStep | null;
  onOpenReport: () => void;
}

/**
 * 左カラム: 目的地ショーケース (表示専用)。
 * 見ている家の紹介に専念: 生きたカード画像 → タイトル → 住所+サイズ(1行) → DC/サーバー →
 * 紹介文(固定高スクロール) → 次の目的地カード(動く・情報なし) → 報告。
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

  return (
    <div className="housing-tour-dest">
      {listing && (
        <div className="housing-tour-dest-card">
          <TourLivingMedia listing={listing} />

          <div className="housing-tour-dest-head">
            <h2 className="housing-tour-dest-title">
              {listing.title?.trim() || formatHousingAddress(listing, i18n.language)}
            </h2>
            <p className="housing-tour-dest-addrsize">
              {formatHousingAddress(listing, i18n.language)}
              {!isApartment && listing.size ? ` ・ ${listing.size}` : ''}
            </p>
            <span className="housing-tour-dest-world">
              {listing.dc} / {listing.server}
            </span>
          </div>

          <div className="housing-tour-dest-intro">
            <span className="housing-tour-dest-intro-label">{t('housing.tour.nav.dest.memo')}</span>
            <div className="housing-tour-dest-intro-body">
              {listing.description?.trim()
                ? listing.description
                : t('housing.tour.nav.dest.no_memo')}
            </div>
          </div>

          {nextStep?.listing && (
            <div className="housing-tour-dest-nextcard">
              <TourLivingMedia listing={nextStep.listing} className="is-next" />
            </div>
          )}
        </div>
      )}

      <button type="button" className="housing-tour-dest-report" onClick={onOpenReport}>
        {t('housing.tour.nav.report_button')}
      </button>
    </div>
  );
};
