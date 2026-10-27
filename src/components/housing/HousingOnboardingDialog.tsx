import { hpx } from '../../lib/housing/housingScale';
import { useTranslation } from 'react-i18next';
import { HousingDialogShell } from './HousingDialogShell';

const STORAGE_KEY = 'housing-onboarding-seen';

export function hasSeenHousingOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHousingOnboardingSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'authenticated' | 'anonymous';
  onAcceptCurrentAccount?: () => void;
  onSwitchAccount?: () => void;
}

export const HousingOnboardingDialog: React.FC<Props> = ({
  open,
  onClose,
  mode,
  onAcceptCurrentAccount,
  onSwitchAccount,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <HousingDialogShell
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--housing-detail-backdrop-bg)', padding: hpx(16) }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('housing.onboarding.title')}
        className="w-full"
        style={{
          maxWidth: hpx(448),
          background: 'var(--housing-panel-bg)',
          border: '1px solid var(--housing-panel-border)',
          borderRadius: 'var(--housing-panel-radius)',
          color: 'var(--housing-text)',
          padding: hpx(24),
        }}
      >
        <h2 style={{
          fontSize: 'var(--housing-text-xl)',
          fontWeight: 600,
          marginBottom: hpx(14),
        }}>
          {t('housing.onboarding.title')}
        </h2>
        <p style={{ fontSize: 'var(--housing-text-base)', marginBottom: 12 }}>
          {t('housing.onboarding.lead')}
        </p>
        <ul style={{
          fontSize: 'var(--housing-text-base)',
          marginBottom: hpx(14),
          paddingLeft: 20,
          listStyle: 'disc',
          color: 'var(--housing-text-dim)',
        }}>
          <li style={{ marginBottom: 6 }}>{t('housing.onboarding.bullet1')}</li>
          <li style={{ marginBottom: 6 }}>{t('housing.onboarding.bullet2')}</li>
          <li>{t('housing.onboarding.bullet3')}</li>
        </ul>
        <p style={{
          fontSize: 'var(--housing-text-sm)',
          color: 'var(--housing-text-dim)',
          marginBottom: hpx(16),
        }}>
          {t('housing.onboarding.image_modes_note')}
        </p>

        {mode === 'authenticated' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={onAcceptCurrentAccount}
              className="housing-action-btn housing-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: `${hpx(10)} ${hpx(14)}` }}
            >
              {t('housing.onboarding.accept_current_account')}
            </button>
            <button
              type="button"
              onClick={onSwitchAccount}
              className="housing-action-btn"
              style={{ width: '100%', justifyContent: 'center', padding: `${hpx(10)} ${hpx(14)}` }}
            >
              {t('housing.onboarding.switch_account')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { markHousingOnboardingSeen(); onClose(); }}
            className="housing-action-btn housing-btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: `${hpx(10)} ${hpx(14)}` }}
          >
            {t('housing.onboarding.start')}
          </button>
        )}
      </div>
    </HousingDialogShell>
  );
};
