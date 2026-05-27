import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DuplicateEntry } from '../../lib/housingApiClient';

interface Props {
  duplicates: DuplicateEntry[];
  onCorrect: () => void;
  onProceed: () => void;
  onClose: () => void;
}

export const HousingDuplicateWarningDialog: React.FC<Props> = ({ duplicates, onCorrect, onProceed, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-app-surface border border-app-border rounded-lg max-w-md w-full p-6">
        <h2 className="text-app-2xl font-bold mb-4">{t('housing.duplicate.title')}</h2>
        <p className="text-app-md text-app-text-muted mb-4">
          {t('housing.duplicate.lead', { count: duplicates.length })}
        </p>
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {duplicates.map((d) => (
            <div key={d.id} className="bg-app-surface2 border border-app-border rounded p-3">
              <p className="text-app-sm">
                {t('housing.duplicate.created_at', {
                  date: new Date(d.createdAt).toLocaleDateString(),
                })}
              </p>
              <p className="text-app-sm text-app-text-muted">
                {d.tags.slice(0, 3).map((tag) => t(`housing.tag.${tag}`)).join(' / ')}
              </p>
            </div>
          ))}
        </div>
        <p className="text-app-sm text-app-text-muted mb-4">{t('housing.duplicate.hint')}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCorrect}
            className="px-4 py-2 rounded-md bg-app-blue text-white hover:bg-app-blue-hover text-app-md"
          >
            {t('housing.duplicate.correct')}
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="px-4 py-2 rounded-md border border-app-border text-app-text hover:bg-app-surface2 text-app-md"
          >
            {t('housing.duplicate.proceed')}
          </button>
        </div>
      </div>
    </div>
  );
};
