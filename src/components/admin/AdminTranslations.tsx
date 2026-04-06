import { useTranslation } from 'react-i18next';

export function AdminTranslations() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-app-2xl font-bold mb-6">{t('admin.translations_title')}</h1>
      <p className="text-app-text-muted">Coming soon...</p>
    </div>
  );
}
