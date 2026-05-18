import { useTranslation } from 'react-i18next';
import { Map as MapIcon, LayoutGrid } from 'lucide-react';
import { useHousingViewStore } from '../../../store/useHousingViewStore';

export const ViewModeToggle: React.FC = () => {
    const { t } = useTranslation();
    const viewMode = useHousingViewStore((s) => s.viewMode);
    const setViewMode = useHousingViewStore((s) => s.setViewMode);

    return (
        <div
            className="housing-view-mode-toggle"
            role="tablist"
            aria-label={t('housing.workspace.center.toggle.label')}
        >
            <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'map'}
                data-active={viewMode === 'map'}
                onClick={() => setViewMode('map')}
            >
                <MapIcon size={14} aria-hidden="true" />
                {t('housing.workspace.center.toggle.map')}
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'pinterest'}
                data-active={viewMode === 'pinterest'}
                onClick={() => setViewMode('pinterest')}
            >
                <LayoutGrid size={14} aria-hidden="true" />
                {t('housing.workspace.center.toggle.pinterest')}
            </button>
        </div>
    );
};
