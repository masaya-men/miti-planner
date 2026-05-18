import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

export interface RegisterCTAProps {
    onClick: () => void;
}

export const RegisterCTA: React.FC<RegisterCTAProps> = ({ onClick }) => {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            className="housing-register-cta"
            onClick={onClick}
            aria-label={t('housing.workspace.register_cta.aria')}
        >
            <Plus size={16} aria-hidden="true" />
            <span>{t('housing.workspace.register_cta.label_long')}</span>
        </button>
    );
};
