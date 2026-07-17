import { useTranslation } from 'react-i18next';

export interface ComingSoonPageProps {
  /** どのタブの準備中か (data 属性でマーキング。将来ページ別文言に使える)。 */
  tab?: string;
}

/**
 * 未実装タブの暫定着地。各ページは以降のスパンで本実装に差し替える。
 *
 * 実機FB第6弾#2: 現状マイページタブ (`tab="mypage"`, App.tsx) 専用の着地。
 * i18n キーは `housing.mypage_coming_soon.*` を使う (`housing.coming_soon.*` とは別)。
 * 後者はハウジングツアーの旧準備中文言で、 別コンポーネント `HousingComingSoonPage.tsx`
 * (現在は未ルーティングの死蔵コード + 専用テスト) がまだ参照しているため、
 * ここで値を書き換えるとその文言・テストを壊してしまう (2026-07-17 grep で確認)。
 */
export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ tab }) => {
  const { t } = useTranslation();
  return (
    <div className="housing-coming-soon-page" data-tab={tab}>
      <div className="housing-coming-soon-inner">
        <div className="housing-coming-soon-eyebrow">{t('housing.mypage_coming_soon.eyebrow')}</div>
        <h1 className="housing-coming-soon-title">{t('housing.mypage_coming_soon.title')}</h1>
        <p className="housing-coming-soon-lead">{t('housing.mypage_coming_soon.lead')}</p>
      </div>
    </div>
  );
};
