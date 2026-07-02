import { useTranslation } from 'react-i18next';

interface OnboardingStep {
  num: number;
  titleKey: string;
  descKey: string;
}

const STEPS: OnboardingStep[] = [
  { num: 1, titleKey: 'housing.favorites.onboarding_step1_title', descKey: 'housing.favorites.onboarding_step1_desc' },
  { num: 2, titleKey: 'housing.favorites.onboarding_step2_title', descKey: 'housing.favorites.onboarding_step2_desc' },
  { num: 3, titleKey: 'housing.favorites.onboarding_step3_title', descKey: 'housing.favorites.onboarding_step3_desc' },
];

/**
 * お気に入りページ左カラムの「はじめての方へ」。
 * 教育目的のみ (進捗表示ではないので最初から✅は付けない)。
 * ステップ番号は青 (進行アクセント = --housing-aether)。
 */
export const FavoritesOnboarding: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="housing-fav-onboarding">
      <h2 className="housing-fav-onboarding-title">{t('housing.favorites.onboarding_title')}</h2>
      <ol className="housing-fav-onboarding-steps">
        {STEPS.map((s) => (
          <li key={s.num} className="housing-fav-onboarding-step">
            <span className="housing-fav-onboarding-num" aria-hidden="true">
              {s.num}
            </span>
            <div className="housing-fav-onboarding-body">
              <span className="housing-fav-onboarding-step-title">{t(s.titleKey)}</span>
              <span className="housing-fav-onboarding-step-desc">{t(s.descKey)}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="housing-fav-onboarding-tip">{t('housing.favorites.onboarding_tip')}</p>
    </div>
  );
};
