import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useRipple } from '../../../lib/housing/useRipple';
import { HousingRipple } from '../HousingRipple';

export interface RegisterCTAProps {
    onClick: () => void;
}

export const RegisterCTA: React.FC<RegisterCTAProps> = ({ onClick }) => {
    const { t } = useTranslation();
    const { ripples, onClick: addRipple } = useRipple();
    return (
        <button
            type="button"
            className="housing-register-cta"
            onClick={(e) => {
                addRipple(e);
                onClick();
            }}
            aria-label={t('housing.workspace.register_cta.aria')}
        >
            <Plus size={16} aria-hidden="true" />
            <span>{t('housing.workspace.register_cta.label_long')}</span>
            <HousingRipple ripples={ripples} />
        </button>
    );
};
