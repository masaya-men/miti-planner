import { useTranslation } from 'react-i18next';

export interface ComingSoonPageProps {
  /** どのタブの準備中か (data 属性でマーキング。将来ページ別文言に使える)。 */
  tab?: string;
}

/**
 * 未実装タブの暫定着地。各ページは以降のスパンで本実装に差し替える。
 */
export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ tab }) => {
  const { t } = useTranslation();
  return (
    <div className="housing-coming-soon-page" data-tab={tab}>
      <div className="housing-coming-soon-inner">
        <div className="housing-coming-soon-eyebrow">{t('housing.coming_soon.eyebrow')}</div>
        <h1 className="housing-coming-soon-title">{t('housing.coming_soon.title')}</h1>
        <p className="housing-coming-soon-lead">{t('housing.coming_soon.lead')}</p>
      </div>
    </div>
  );
};
