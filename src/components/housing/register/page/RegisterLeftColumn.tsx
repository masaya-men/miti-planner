import { RegisterStepperNav, type RegisterStep } from '../RegisterStepperNav';
import { registrationTicketsRemaining } from '../../../../utils/housingQuota';
import { REGISTRATION_INITIAL_BONUS, REGISTRATION_DAILY_QUOTA } from '../../../../constants/housing';
import { useTranslation } from 'react-i18next';

export const RegisterLeftColumn: React.FC<{ steps: RegisterStep[]; onJump: (id: number) => void; progress: number; isAdmin: boolean; remaining: number | null; registrationCount: number | null }> = ({ steps, onJump, progress, isAdmin, remaining, registrationCount }) => {
  const { t } = useTranslation();
  return (
    <section className="housing-register-panel" data-region="left">
      <div className="housing-register-col housing-register-col-left">
        <div className="housing-register-left-scroll">
          <RegisterStepperNav steps={steps} onJump={onJump} progress={progress} />
        </div>
        {(isAdmin || (remaining != null && registrationCount != null)) && (
          <>
            <p
              className="housing-register-left-remaining"
              data-testid="housing-register-guide-remaining"
            >
              {isAdmin
                ? t('housing.register.quota.admin')
                : registrationTicketsRemaining(registrationCount!) > 0
                  ? t('housing.register.quota.tickets_remaining', {
                      remaining: registrationTicketsRemaining(registrationCount!),
                      total: REGISTRATION_INITIAL_BONUS,
                    })
                  : t('housing.register.quota.daily_remaining', {
                      remaining: remaining!,
                      max: REGISTRATION_DAILY_QUOTA,
                    })}
            </p>
            {!isAdmin && registrationTicketsRemaining(registrationCount!) > 0 && (
              <p className="housing-register-left-remaining-hint">
                {t('housing.register.quota.tickets_hint', { max: REGISTRATION_DAILY_QUOTA })}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
};
