import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useThemeStore } from './store/useThemeStore';
import { LandingPage } from './components/landing/LandingPage';
import { MitiPlannerPage } from './components/MitiPlannerPage';
import { SharePage } from './components/SharePage';
// ⑤-3b: ジョイナーページは collabProvider(yjs/y-partyserver)を静的 import するため、
// 遅延ロードしてソロ利用者の初期 bundle に yjs を載せない(設計の遅延ロード方針維持)。
const CollabJoinerPage = lazy(() => import('./components/CollabJoinerPage'));
import { SupportPage } from './components/SupportPage';
import StrategyBoardPastePage from './components/StrategyBoardPastePage';
import { HousingDetailPage } from './components/housing/listing/HousingDetailPage';
import { HousingShell } from './components/housing/shell/HousingShell';
import { BrowsePage } from './components/housing/pages/BrowsePage';
import { FavoritesPage } from './components/housing/pages/FavoritesPage';
import { RegisterPage } from './components/housing/pages/RegisterPage';
import { HousingEditPage } from './components/housing/pages/HousingEditPage';
import { HousingerPage } from './components/housing/pages/HousingerPage';
import { TourNavPage } from './components/housing/pages/TourNavPage';
import { JoinTourPage } from './components/housing/pages/JoinTourPage';
import { EntranceAuthoringPage } from './components/housing/dev/EntranceAuthoringPage';
import { TourPreviewPage } from './components/housing/dev/TourPreviewPage';
import { RouteAuthoringPage } from './components/housing/dev/RouteAuthoringPage';
import { isAppRoute, rememberAppRoute } from './lib/lastAppRoute';
import { requestPersistentStorage } from './lib/requestPersistentStorage';

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
import { AdminPersonalTags } from './components/admin/AdminPersonalTags';
import { AdminHousingerReports } from './components/admin/AdminHousingerReports';
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
 * AppRoutes — ルート定義。
 *
 * Task 2.3: 物件詳細は background-location (「一覧の上にモーダルを被せる」) パターンを撤去し、
 * シェル子ルート `/housing/listing/:listingId` (HousingDetailPage、大パネル1枚) に一本化した。
 * 一覧のカードクリック / 直URL / 共有URL / 通知タップ、すべて通常遷移で同じページに着地する。
 */
function AppRoutes() {
  const location = useLocation();

  // 管理画面の「アプリに戻る」 用に、 アプリ画面 (軽減表 / ハウジング) にいる間は経路を記録する。
  useEffect(() => {
    if (isAppRoute(location.pathname)) {
      rememberAppRoute(location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  return (
    <Routes location={location}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/miti" element={<MitiPlannerPage />} />
      <Route path="/share/:shareId" element={<SharePage />} />
      {/* ⑤-3b: ジョイナー読み取り専用ライブビュー(招待リンク専用・内部導線なし)。lazy chunk。 */}
      <Route path="/collab/:roomToken" element={<Suspense fallback={null}><CollabJoinerPage /></Suspense>} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/stgy" element={<StrategyBoardPastePage />} />

      {/* 再構築: URL タブで切り替わるシェル。子ルートは第1スパンで探すのみ、
          以降のスパンで favorites/plan/tour/register/mypage を追加する。 */}
      <Route path="/housing" element={<HousingShell />}>
        <Route index element={<BrowsePage />} />
        {/* 未実装タブは暫定で「準備中」に着地 (以降のスパンで本実装に差し替え)。 */}
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="tour" element={<TourNavPage />} />
        {/* Task 2.3: 共有ツアー参加者ページ。ホストの tour(TourNavPage) とは path 深さ違いで衝突しない。 */}
        <Route path="tour/:tourToken" element={<JoinTourPage />} />
        <Route path="register" element={<RegisterPage />} />
        {/* Task 7 拡張 (2026-07-24): マイページ = 自分の uid で HousingerPage を表示 (:uid なし)。 */}
        <Route path="mypage" element={<HousingerPage />} />
        {/* Task 2.3: 詳細大パネル。一覧カード/直URL/共有URL/通知タップ、全経路の単一着地点。 */}
        <Route path="listing/:listingId" element={<HousingDetailPage />} />
        {/* Task 3.3a: 編集ページ。詳細の編集導線 (kebab/通報バナー) から navigate してくる。 */}
        <Route path="listing/:listingId/edit" element={<HousingEditPage />} />
        {/* Task 7: ハウジンガーページ。 詳細の登録者行クリック / 個人タグ絞り込みリンク等から着地する。 */}
        <Route path="housinger/:uid" element={<HousingerPage />} />
      </Route>
      {/* 開発専用: 入口オーサリングツール(Task5)。本番ビルドでは import.meta.env.DEV が false に畳み込まれ、route ごとツリーから除去される。 */}
      {import.meta.env.DEV && (
        <Route path="/housing/dev/entrances" element={<EntranceAuthoringPage />} />
      )}
      {/* 開発専用: 全住所ツアープレビュー。本番ビルドでは import.meta.env.DEV が false に畳み込まれ、route ごとツリーから除去される。 */}
      {import.meta.env.DEV && (
        <Route path="/housing/dev/tour-preview" element={<TourPreviewPage />} />
      )}
      {/* 開発専用: 経路お絵かきツール。本番ビルドでは import.meta.env.DEV が false に畳み込まれ、route ごとツリーから除去される。 */}
      {import.meta.env.DEV && (
        <Route path="/housing/dev/routes" element={<RouteAuthoringPage />} />
      )}
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
        <Route path="personal-tags" element={<AdminPersonalTags />} />
        <Route path="housinger-reports" element={<AdminHousingerReports />} />
      </Route>
      {/* Catch-all: redirect unknown paths to portal */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
    // ローカルデータを消去対象外へ昇格要求（best-effort・失敗無害）
    requestPersistentStorage();
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
