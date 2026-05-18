import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PanelDirection = 'left' | 'right';

export interface PanelCloseButtonProps {
    direction: PanelDirection;
    onClick: () => void;
}

export const PanelCloseButton: React.FC<PanelCloseButtonProps> = ({ direction, onClick }) => {
    const { t } = useTranslation();
    const ariaLabel = direction === 'left'
        ? t('housing.workspace.panel.close_left')
        : t('housing.workspace.panel.close_right');
    const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
    return (
        <button
            type="button"
            className="housing-panel-close"
            aria-label={ariaLabel}
            onClick={onClick}
        >
            <Icon size={16} aria-hidden="true" />
        </button>
    );
};
