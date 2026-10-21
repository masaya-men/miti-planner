import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';

/**
 * 運営非表示の家のカード (ハウジンガーページ専用)。
 * 写真は一切出さない (無地の背景) / クリックしても詳細へ遷移しない (非リンク) /
 * タイトルはそのまま、 横向きの帯「規約違反のため非表示になりました」を重ねる。
 */
export const HiddenListingCard: React.FC<{ listing: MockListing }> = ({ listing }) => {
  const { t } = useTranslation();
  const title = listing.title?.trim() || '';
  return (
    <article className="housing-listing-card housing-listing-card-admin-hidden" data-testid="housing-hidden-listing-card">
      <div className="housing-listing-card-media">
        <div className="housing-listing-card-admin-hidden-band" data-testid="housing-hidden-band">
          {t('housing.card.admin_hidden_band')}
        </div>
        {title && (
          <div className="housing-listing-card-caption" aria-hidden="true">
            <span>{title}</span>
          </div>
        )}
      </div>
    </article>
  );
};
