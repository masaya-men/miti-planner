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

interface Props {
  /** canRegister() の remaining。取得前/失敗時は null (残数行を表示しない)。 */
  remaining: number | null;
}

/**
 * 登録ページ左カラムの案内。`FavoritesOnboarding` と同じ静かなトーン
 * (教育目的のみ、最初から✅を付けない、ステップ番号は青)。
 * 登録枠残数は取得できた場合のみヘアライン区切りの下に静かに添える。
 */
export const RegisterGuide: React.FC<Props> = ({ remaining }) => {
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
      {remaining != null && (
        <p className="housing-register-guide-remaining" data-testid="housing-register-guide-remaining">
          {t('housing.register.guide.remaining', { count: remaining })}
        </p>
      )}
    </div>
  );
};
