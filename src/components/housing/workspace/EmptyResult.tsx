import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react';

export const EmptyResult: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="housing-empty-result" role="status">
            <SearchX size={48} aria-hidden="true" className="housing-empty-result-icon" />
            <div className="housing-empty-result-title">{t('housing.workspace.empty.title')}</div>
            <div className="housing-empty-result-hint">{t('housing.workspace.empty.hint')}</div>
        </div>
    );
};
