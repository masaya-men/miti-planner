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
}

export const HousingOnboardingDialog: React.FC<Props> = ({ open, onClose }) => {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-app-surface border border-app-border rounded-lg max-w-md w-full p-6">
        <h2 className="text-app-3xl font-bold mb-4">{t('housing.onboarding.title')}</h2>
        <p className="text-app-md mb-3">{t('housing.onboarding.lead')}</p>
        <ul className="text-app-md space-y-2 mb-4 list-disc list-inside text-app-text-muted">
          <li>{t('housing.onboarding.bullet1')}</li>
          <li>{t('housing.onboarding.bullet2')}</li>
          <li>{t('housing.onboarding.bullet3')}</li>
        </ul>
        <p className="text-app-sm text-app-text-muted mb-4">
          {t('housing.onboarding.image_modes_note')}
        </p>
        <button
          type="button"
          onClick={() => { markHousingOnboardingSeen(); onClose(); }}
          className="w-full bg-app-blue text-white rounded-md py-2 font-semibold hover:bg-app-blue-hover text-app-md"
        >
          {t('housing.onboarding.start')}
        </button>
      </div>
    </div>
  );
};
