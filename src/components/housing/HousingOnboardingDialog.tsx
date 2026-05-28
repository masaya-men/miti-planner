import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--housing-detail-backdrop-bg)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="max-w-md w-full"
        style={{
          background: 'var(--housing-panel-bg)',
          border: '1px solid var(--housing-panel-border)',
          borderRadius: 'var(--housing-panel-radius)',
          color: 'var(--housing-text)',
          padding: 24,
        }}
      >
        <h2 style={{
          fontSize: 'var(--housing-text-xl)',
          fontWeight: 600,
          marginBottom: 14,
        }}>
          {t('housing.onboarding.title')}
        </h2>
        <p style={{ fontSize: 'var(--housing-text-base)', marginBottom: 12 }}>
          {t('housing.onboarding.lead')}
        </p>
        <ul style={{
          fontSize: 'var(--housing-text-base)',
          marginBottom: 14,
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
          marginBottom: 16,
        }}>
          {t('housing.onboarding.image_modes_note')}
        </p>

        {mode === 'authenticated' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={onAcceptCurrentAccount}
              className="housing-action-btn housing-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
            >
              {t('housing.onboarding.accept_current_account')}
            </button>
            <button
              type="button"
              onClick={onSwitchAccount}
              className="housing-action-btn"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
            >
              {t('housing.onboarding.switch_account')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { markHousingOnboardingSeen(); onClose(); }}
            className="housing-action-btn housing-btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
          >
            {t('housing.onboarding.start')}
          </button>
        )}
      </div>
    </div>
  );
};
