import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HOUSING_TABS } from './housingTabs';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { useEffect, useRef, useState } from 'react';

/**
 * ハウジング上部タブバー。NavLink が active 時に aria-current="page" を自動付与する。
 * アクティブの下線などの見た目は housing.css の `.housing-tab.is-active`。
 */
export const TabBar: React.FC = () => {
  const { t } = useTranslation();
  const trayCount = useTourTrayStore((s) => s.trayIds.length);
  // 件数が増えた瞬間だけ丸を跳ねさせる (減った/初回描画では跳ねない)。
  const prevCountRef = useRef(trayCount);
  const [bumpKey, setBumpKey] = useState(0);
  useEffect(() => {
    if (trayCount > prevCountRef.current) setBumpKey((k) => k + 1);
    prevCountRef.current = trayCount;
  }, [trayCount]);
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
          {tab.key === 'tour' && trayCount > 0 && (
            <span
              key={bumpKey}
              className={`housing-tab-badge${bumpKey > 0 ? ' is-bump' : ''}`}
              data-testid="housing-tab-tour-badge"
              role="img"
              aria-label={t('housing.tabs.tour_count_aria', { count: trayCount })}
            >
              <span aria-hidden="true">{trayCount}</span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
