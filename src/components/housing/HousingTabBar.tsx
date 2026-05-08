import { useTranslation } from 'react-i18next';

export type HousingTab = 'search' | 'tour' | 'register';

interface Props {
  activeTab: HousingTab;
  onChange: (tab: HousingTab) => void;
}

export const HousingTabBar: React.FC<Props> = ({ activeTab, onChange }) => {
  const { t } = useTranslation();
  const tabs: { id: HousingTab; labelKey: string }[] = [
    { id: 'search', labelKey: 'housing.tabs.search' },
    { id: 'tour', labelKey: 'housing.tabs.tour' },
    { id: 'register', labelKey: 'housing.tabs.register' },
  ];

  return (
    <div role="tablist" className="flex border-b border-app-border bg-app-surface">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`flex-1 py-3 text-app-md font-medium tracking-wider transition-colors ${
              active
                ? 'text-app-text border-b-2 border-app-text'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
};
