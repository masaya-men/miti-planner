import React from 'react';
import { useTranslation } from 'react-i18next';
import { REGISTRATION_INITIAL_BONUS, REGISTRATION_DAILY_QUOTA } from '../../../constants/housing';
import { registrationTicketsRemaining } from '../../../utils/housingQuota';
import type { CanRegisterResponse } from '../../../lib/housingApiClient';

interface Props {
  status: CanRegisterResponse | null;
}

export const HousingQuotaIndicator: React.FC<Props> = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;

  const tickets = registrationTicketsRemaining(status.registrationCount);
  if (tickets > 0) {
    // 初回チケット期間: 残り枚数をカウントダウン表示 (旧「(上限なし)」を廃止)
    return (
      <p className="text-app-sm text-app-text-muted">
        {t('housing.register.quota.tickets_remaining', {
          remaining: tickets,
          total: REGISTRATION_INITIAL_BONUS,
        })}
      </p>
    );
  }
  // チケット使い切り後: 1 日の残り登録枠
  return (
    <p className="text-app-sm text-app-text-muted">
      {t('housing.register.quota.daily_remaining', {
        remaining: status.remaining,
        max: REGISTRATION_DAILY_QUOTA,
      })}
    </p>
  );
};
