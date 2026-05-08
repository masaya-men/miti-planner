import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { HOUSING_ROUTES } from '../../constants/housing';
import { HousingTabBar, type HousingTab } from './HousingTabBar';
import { HousingPlaceholderView } from './HousingPlaceholderView';
import { HousingRegisterView } from './register/HousingRegisterView';
import { HousingOnboardingDialog, hasSeenHousingOnboarding } from './HousingOnboardingDialog';

function readTabFromHash(): HousingTab {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'search' || hash === 'tour' || hash === 'register') return hash;
  return 'search';
}

export const HousingPage: React.FC = () => {
  useCanonicalUrl(HOUSING_ROUTES.TOP);
  const { t } = useTranslation();
  const [tab, setTab] = useState<HousingTab>(readTabFromHash);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenHousingOnboarding());

  useEffect(() => { document.title = t('app.page_title_housing'); }, [t]);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = (next: HousingTab) => {
    window.location.hash = next;
    setTab(next);
  };

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-app-bg)', color: 'var(--color-app-text)' }}
    >
      <HousingTabBar activeTab={tab} onChange={handleTabChange} />
      <div className="flex-1">
        {tab === 'search' && <HousingPlaceholderView i18nKey="housing.placeholder.search" />}
        {tab === 'tour' && <HousingPlaceholderView i18nKey="housing.placeholder.tour" />}
        {tab === 'register' && <HousingRegisterView />}
      </div>
      <HousingOnboardingDialog
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </main>
  );
};
