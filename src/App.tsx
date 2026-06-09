import { Routes, Route, Navigate, useLocation, type Location } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useThemeStore } from './store/useThemeStore';
import { LandingPage } from './components/landing/LandingPage';
import { MitiPlannerPage } from './components/MitiPlannerPage';
import { SharePage } from './components/SharePage';
// ⑤-3b: ジョイナーページは collabProvider(yjs/y-partyserver)を静的 import するため、
// 遅延ロードしてソロ利用者の初期 bundle に yjs を載せない(設計の遅延ロード方針維持)。
const CollabJoinerPage = lazy(() => import('./components/CollabJoinerPage'));
import { SupportPage } from './components/SupportPage';
import {
  HousingPage,
  HousingWorkspace,
} from './components/housing';
import { HousingDetailPage } from './components/housing/listing/HousingDetailPage';
import { HousingDetailModalRoute } from './components/housing/listing/HousingDetailModalRoute';
import { isAppRoute, rememberAppRoute } from './lib/lastAppRoute';

import { PrivacyPolicyPage, TermsPage, CommercialDisclosurePage } from './components/LegalPage';
import { AdminGuard } from './components/admin/AdminGuard';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminContents } from './components/admin/AdminContents';
import { AdminTemplates } from './components/admin/AdminTemplates';
import { AdminConfig } from './components/admin/AdminConfig';
import { AdminSkills } from './components/admin/AdminSkills';
import { AdminTranslations } from './components/admin/AdminTranslations';
import { AdminStats } from './components/admin/AdminStats';
import { AdminServers } from './components/admin/AdminServers';
import { ContentWizard } from './components/admin/wizard/ContentWizard';
import { TemplateWizard } from './components/admin/wizard/TemplateWizard';
import { JobWizard } from './components/admin/wizard/JobWizard';
import { StatsWizard } from './components/admin/wizard/StatsWizard';
import { AdminBackups } from './components/admin/AdminBackups';
import { AdminSystemNotifications } from './components/admin/AdminSystemNotifications';
import { AdminLogs } from './components/admin/AdminLogs';
import { AdminUgc } from './components/admin/AdminUgc';
import { AdminFeatured } from './components/admin/AdminFeatured';
import { AdminHousingReports } from './components/admin/AdminHousingReports';
import { TutorialOverlay } from './components/tutorial/TutorialOverlay';
import { ToastContainer } from './components/Toast';
import { TransitionOverlayProvider } from './components/ui/TransitionOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTranslation } from 'react-i18next';
import { useMasterDataInit } from './hooks/useMasterData';
import { usePlanStore } from './store/usePlanStore';

/**
 * App — Root component with route definitions.
 *
 * Route map (centralized here for easy extension):
 *   /      → LandingPage (ランディングページ)
 *   /miti   → MitiPlannerPage (mitigation planner tool)
 *
 * To add a new tool page:
 *   1. Create the page component in src/components/
 *   2. Add a <Route> entry below
 */
/**
 * AppRoutes — background-location 対応ルート定義。
 *
 * 「一覧 (背景) の上にモーダルを被せる」 React Router v6/v7 パターン:
 * - 通常時: `location` をそのまま使う
 * - `location.state.backgroundLocation` がある場合:
 *   1. 背景ルート (一覧) を `backgroundLocation` で描画 (アンマウントしない)
 *   2. 同じ URL のモーダル用ルートを「上に」 重ねて描画
 * - URL 直アクセス時は `backgroundLocation` がないため、 フルページ表示にフォールバック
 */
function AppRoutes() {
  const location = useLocation();
  const state = (location.state as { backgroundLocation?: Location } | null) || {};
  const backgroundLocation = state.backgroundLocation;

  // 管理画面の「アプリに戻る」 用に、 アプリ画面 (軽減表 / ハウジング) にいる間は経路を記録する。
  useEffect(() => {
    if (isAppRoute(location.pathname)) {
      rememberAppRoute(location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/miti" element={<MitiPlannerPage />} />
        <Route path="/share/:shareId" element={<SharePage />} />
        {/* ⑤-3b: ジョイナー読み取り専用ライブビュー(招待リンク専用・内部導線なし)。lazy chunk。 */}
        <Route path="/collab/:roomToken" element={<Suspense fallback={null}><CollabJoinerPage /></Suspense>} />
        <Route path="/support" element={<SupportPage />} />

        <Route path="/housing" element={<HousingWorkspace />} />
        <Route path="/housing/legacy" element={<HousingPage />} />
        <Route path="/housing/p/:listingId" element={<HousingWorkspace />} />
        <Route path="/housing/tour/:tourId" element={<HousingWorkspace />} />
        {/* フルページ詳細 (URL 直アクセス・モーダル経由の両方の受け皿) */}
        <Route path="/housing/listing/:listingId" element={<HousingDetailPage />} />

        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/commercial" element={<CommercialDisclosurePage />} />
        {/* 管理画面 */}
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="contents" element={<AdminContents />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="skills" element={<AdminSkills />} />
          <Route path="translations" element={<AdminTranslations />} />
          <Route path="stats" element={<AdminStats />} />
          <Route path="servers" element={<AdminServers />} />
          <Route path="config" element={<AdminConfig />} />
          <Route path="content-wizard" element={<ContentWizard />} />
          <Route path="template-wizard" element={<TemplateWizard />} />
          <Route path="job-wizard" element={<JobWizard />} />
          <Route path="stats-wizard" element={<StatsWizard />} />
          <Route path="backups" element={<AdminBackups />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="ugc" element={<AdminUgc />} />
          <Route path="featured" element={<AdminFeatured />} />
          <Route path="notifications" element={<AdminSystemNotifications />} />
          <Route path="housing-reports" element={<AdminHousingReports />} />
        </Route>
        {/* Catch-all: redirect unknown paths to portal */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {backgroundLocation && (
        <Routes>
          <Route
            path="/housing/listing/:listingId"
            element={<HousingDetailModalRoute />}
          />
        </Routes>
      )}
    </>
  );
}

function App() {
  const theme = useThemeStore((state) => state.theme);
  const { i18n } = useTranslation();
  useMasterDataInit();

  // 起動時: archivedなのにdataが展開されているプランを再圧縮 + 未使用プランのサイレント圧縮
  useEffect(() => {
    const store = usePlanStore.getState();
    store.recompressStaleArchives();
    store.silentCompressStale();
  }, []);

  // Sync theme class on <html> so Tailwind dark: variants work
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  // Sync <html lang> for SEO and accessibility
  useEffect(() => {
    document.documentElement.lang = i18n.language.startsWith('ja') ? 'ja' : 'en';
  }, [i18n.language]);

  return (
    <ErrorBoundary
      fallback={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            fontFamily: 'sans-serif',
            color: 'var(--color-app-text, #fff)',
            backgroundColor: 'var(--color-app-bg, #000)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 'var(--font-size-4xl)', marginBottom: '1rem' }}>
            {i18n.language.startsWith('ja')
              ? '予期しないエラーが発生しました'
              : 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.5rem',
              border: '1px solid currentColor',
              borderRadius: '0.25rem',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 'var(--font-size-2xl-plus)',
            }}
          >
            {i18n.language.startsWith('ja') ? 'ページを再読み込み' : 'Reload page'}
          </button>
        </div>
      }
    >
      <TransitionOverlayProvider>
        <div className="relative w-full h-full">
          <AppRoutes />
          <TutorialOverlay />
          <ToastContainer />
        </div>
      </TransitionOverlayProvider>
    </ErrorBoundary>
  );
}

export default App;
