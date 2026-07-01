import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HOUSING_TABS } from './housingTabs';

/**
 * ハウジング上部タブバー。NavLink が active 時に aria-current="page" を自動付与する。
 * アクティブの下線などの見た目は housing.css の `.housing-tab.is-active`。
 */
export const TabBar: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav className="housing-tabbar" aria-label={t('housing.tabs.aria')}>
      {HOUSING_TABS.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.path}
          end={tab.end}
          className={({ isActive }) => `housing-tab${isActive ? ' is-active' : ''}`}
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
};
