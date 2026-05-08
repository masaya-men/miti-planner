import { useTranslation } from 'react-i18next';

interface Props {
  i18nKey: string; // 例: 'housing.placeholder.search'
}

export const HousingPlaceholderView: React.FC<Props> = ({ i18nKey }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8 text-center">
      <p className="text-app-md text-app-text-muted">{t(i18nKey)}</p>
    </div>
  );
};
