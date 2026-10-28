import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// ---- 完了画面 ---------------------------------------------------------------

interface DoneScreenProps {
  onReset: () => void;
}

export function DoneScreen({ onReset }: DoneScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-[var(--app-text)]">
      <div className="text-app-6xl font-bold">{t('admin.wizard_success')}</div>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onReset}
          className="border border-[var(--app-text)] px-6 py-2 text-app-2xl font-medium hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
        >
          {t('admin.wizard_add_another')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity"
        >
          {t('admin.wizard_back_to_dashboard')}
        </button>
      </div>
    </div>
  );
}
