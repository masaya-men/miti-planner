/**
 * ハウジンガーページの本体以外の画面: 未ログインのマイページ / プロフィール読み込み中 / 非公開・存在しない。
 * 非公開・存在しない uid は housing トンマナの既存 NotFound (HousingDetailPage.tsx) を
 * 同一形 (unavailable 文言 + ← 探すへ戻る Link) で踏襲する。
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { ListingGridSkeleton } from '../browse/ListingGridSkeleton';
import { HousingerProfileSkeleton } from '../skeleton/HousingSkeletons';

/** マイページ (:uid なし) を未ログインで開いたとき: 読み込み表示を挟まずログイン導線を出す。 */
export const HousingerLoginView: React.FC = () => (
  <div className="housing-detail-panel">
    <div className="housing-detail-shell housinger-page-login-shell">
      <main className="housing-detail-fullpage-main housinger-page-login-main">
        <HousingLoginPrompt context="mypage" />
      </main>
    </div>
  </div>
);

/** 一覧取得中のダミー (本体の一覧列と同じ居場所)。 */
export const HousingerListingsSkeleton: React.FC = () => (
  <div className="housing-listing-grid-wrap">
    <div className="housing-listing-grid-toolbar housing-skel-toolbar-reserve" aria-hidden="true" />
    <ListingGridSkeleton withFooter={false} rows={1} />
  </div>
);

export const HousingerBackLink: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link to="/housing" className="housing-detail-back" aria-label={t('housing.detail.back_aria')}>
      ← {t('housing.detail.back_aria')}
    </Link>
  );
};

export const HousingerLoadingView: React.FC = () => (
  <div className="housing-detail-panel">
    <div className="housing-detail-shell">
      <header className="housing-detail-fullpage-header housinger-page-headerbar">
        <HousingerBackLink />
      </header>
      <main className="housing-detail-fullpage-main housinger-page-main">
        <div className="housinger-page-body">
          <HousingerProfileSkeleton />
          <div className="housinger-page-listings-col">
            <HousingerListingsSkeleton />
          </div>
        </div>
      </main>
    </div>
  </div>
);

export const HousingerUnavailableView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="housing-detail-panel">
      <div className="housing-detail-shell">
        <main className="housing-detail-fullpage-main">
          <p>{t('housing.housinger.unavailable')}</p>
          <HousingerBackLink />
        </main>
      </div>
    </div>
  );
};
