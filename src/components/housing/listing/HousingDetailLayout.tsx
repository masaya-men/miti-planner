/**
 * Phase 3: 物件詳細フルページ表示
 *
 * - URL 直アクセス (`/housing/listing/:listingId`) または共有リンクから開く
 * - ヘッダーに「← 戻る」 リンク (一覧に戻る)
 * - 中身は HousingDetailContent を再利用
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';
import { HousingDetailContent } from './HousingDetailContent';

export interface HousingDetailLayoutProps {
  listing: HousingListing;
  viewerUid: string | null;
}

export const HousingDetailLayout: React.FC<HousingDetailLayoutProps> = ({
  listing,
  viewerUid,
}) => {
  const { t } = useTranslation();
  return (
    <div className="housing-detail-fullpage">
      <header className="housing-detail-fullpage-header">
        <Link
          to="/housing"
          className="housing-detail-back"
          aria-label={t('housing.detail.back_aria')}
        >
          ← {t('housing.detail.back_aria')}
        </Link>
      </header>
      <main className="housing-detail-fullpage-main">
        <HousingDetailContent listing={listing} viewerUid={viewerUid} />
      </main>
    </div>
  );
};
