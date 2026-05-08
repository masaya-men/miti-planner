import React from 'react';
import { useTranslation } from 'react-i18next';
import { REGISTRATION_INITIAL_BONUS, REGISTRATION_DAILY_QUOTA } from '../../../constants/housing';
import type { CanRegisterResponse } from '../../../lib/housingApiClient';

interface Props {
  status: CanRegisterResponse | null;
}

export const HousingQuotaIndicator: React.FC<Props> = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;

  const onBonus = status.registrationCount < REGISTRATION_INITIAL_BONUS;
  if (onBonus) {
    return (
      <p className="text-app-sm text-app-text-muted">
        {t('housing.register.quota.bonus_phase', {
          count: status.registrationCount,
          bonus: REGISTRATION_INITIAL_BONUS,
        })}
      </p>
    );
  }
  return (
    <p className="text-app-sm text-app-text-muted">
      {t('housing.register.quota.daily_remaining', {
        remaining: status.remaining,
        max: REGISTRATION_DAILY_QUOTA,
      })}
    </p>
  );
};
