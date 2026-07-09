import { useTranslation } from 'react-i18next';

interface GuideStep {
  num: number;
  titleKey: string;
  descKey: string;
}

const STEPS: GuideStep[] = [
  { num: 1, titleKey: 'housing.register.guide.step1_title', descKey: 'housing.register.guide.step1_desc' },
  { num: 2, titleKey: 'housing.register.guide.step2_title', descKey: 'housing.register.guide.step2_desc' },
  { num: 3, titleKey: 'housing.register.guide.step3_title', descKey: 'housing.register.guide.step3_desc' },
];

/**
 * 登録ページ左カラムの案内。`FavoritesOnboarding` と同じ静かなトーン
 * (教育目的のみ、最初から✅を付けない、ステップ番号は青)。
 * 登録枠残数はスクロールに埋もれないよう左カラム下端に固定表示する (RegisterPage 側・#6)。
 */
export const RegisterGuide: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="housing-register-guide" data-testid="housing-register-guide">
      <h2 className="housing-register-guide-title">{t('housing.register.guide.title')}</h2>
      <ol className="housing-register-guide-steps">
        {STEPS.map((s) => (
          <li key={s.num} className="housing-register-guide-step">
            <span className="housing-register-guide-num" aria-hidden="true">
              {s.num}
            </span>
            <div className="housing-register-guide-body">
              <span className="housing-register-guide-step-title">{t(s.titleKey)}</span>
              <span className="housing-register-guide-step-desc">{t(s.descKey)}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
