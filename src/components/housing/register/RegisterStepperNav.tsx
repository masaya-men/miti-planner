import { useTranslation } from 'react-i18next';

export type RegisterStepState = 'idle' | 'active' | 'done';

export interface RegisterStep {
  id: number;
  labelKey: string;
  state: RegisterStepState;
}

interface Props {
  steps: RegisterStep[];
  onJump: (id: number) => void;
}

/**
 * 登録ページ左カラム: ライブステッパーナビ (media/address/intro/visibility/confirm)。
 * スクロール位置と連動する現在地表示 + クリックで該当セクションへジャンプ。
 * `done` は「そのセクションの必須が埋まったか」を RegisterPage が算出して渡す
 * (このコンポーネント自体は状態を持たず表示に徹する)。
 * 既定 public のような「最初から✅」は作らない (feedback_form_ux_progress)。
 */
export const RegisterStepperNav: React.FC<Props> = ({ steps, onJump }) => {
  const { t } = useTranslation();
  return (
    <nav className="housing-register-stepper" aria-label={t('housing.register.stepper_aria_label')}>
      <ol className="housing-register-stepper-list">
        {steps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              className={`housing-register-stepper-item is-${step.state}`}
              data-testid={`housing-register-step-${step.id}`}
              aria-current={step.state === 'active' ? 'step' : undefined}
              onClick={() => onJump(step.id)}
            >
              <span className="housing-register-stepper-num" aria-hidden="true">
                <span className="housing-register-stepper-num-digit">{step.id}</span>
                <svg
                  className="housing-register-stepper-check"
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8.5L6.2 11.5L13 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="housing-register-stepper-label">{t(step.labelKey)}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
};
