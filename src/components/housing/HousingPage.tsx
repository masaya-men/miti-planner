import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { HOUSING_ROUTES } from '../../constants/housing';
import { HousingTabBar, type HousingTab } from './HousingTabBar';
import { HousingPlaceholderView } from './HousingPlaceholderView';
import { HousingRegisterView } from './register/HousingRegisterView';
import {
  HousingOnboardingDialog,
  hasSeenHousingOnboarding,
  markHousingOnboardingSeen,
} from './HousingOnboardingDialog';
import { isHousingActivated, markHousingActivated } from '../../lib/housingFeatureSession';
import { LoginModal } from '../LoginModal';

function readTabFromHash(): HousingTab {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'search' || hash === 'tour' || hash === 'register') return hash;
  return 'search';
}

export const HousingPage: React.FC = () => {
  useCanonicalUrl(HOUSING_ROUTES.TOP);
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const [tab, setTab] = useState<HousingTab>(readTabFromHash);
  const [housingActivated, setHousingActivated] = useState<boolean | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => { document.title = t('app.page_title_housing'); }, [t]);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // ログイン状態が確定したら featureSession を読み込む
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setHousingActivated(null);
      return;
    }
    isHousingActivated(user.uid)
      .then((activated) => setHousingActivated(activated))
      .catch(() => setHousingActivated(false));
  }, [loading, user]);

  const handleTabChange = (next: HousingTab) => {
    window.location.hash = next;
    setTab(next);
  };

  // ダイアログ表示判定
  const showDialog = (() => {
    if (loading) return false;
    if (user && housingActivated === false) return true;
    if (!user && !hasSeenHousingOnboarding()) return true;
    return false;
  })();

  const dialogMode = user ? 'authenticated' : 'anonymous';

  const handleAcceptCurrentAccount = async () => {
    if (!user) return;
    try {
      await markHousingActivated(user.uid);
      setHousingActivated(true);
    } catch (e) {
      console.error('markHousingActivated failed:', e);
      // 失敗してもダイアログは閉じてユーザーを止めない
      setHousingActivated(true);
    }
  };

  const handleSwitchAccount = async () => {
    markHousingOnboardingSeen();
    try {
      await useAuthStore.getState().signOut();
    } catch (e) {
      console.error('signOut failed:', e);
    }
    setIsLoginOpen(true);
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
        open={showDialog}
        onClose={() => {
          // anonymous モードの onClose は markHousingOnboardingSeen 込みでボタン側に委譲
          // Escape / 背景クリックで閉じた場合の fallback として seen フラグだけ立てる
          if (!user) markHousingOnboardingSeen();
          else setHousingActivated(true);
        }}
        mode={dialogMode}
        onAcceptCurrentAccount={handleAcceptCurrentAccount}
        onSwitchAccount={handleSwitchAccount}
      />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </main>
  );
};
