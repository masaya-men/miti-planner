import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useThemeStore } from './store/useThemeStore';
import { LandingPage } from './components/landing/LandingPage';
import { MitiPlannerPage } from './components/MitiPlannerPage';
import { SharePage } from './components/SharePage';
import { PopularPage } from './components/PopularPage';


import { PrivacyPolicyPage, TermsPage, CommercialDisclosurePage } from './components/LegalPage';
import { AdminGuard } from './components/admin/AdminGuard';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminContents } from './components/admin/AdminContents';
import { AdminTemplates } from './components/admin/AdminTemplates';
import { AdminConfig } from './components/admin/AdminConfig';
import { AdminSkills } from './components/admin/AdminSkills';
import { AdminStats } from './components/admin/AdminStats';
import { AdminServers } from './components/admin/AdminServers';
import { ContentWizard } from './components/admin/wizard/ContentWizard';
import { TemplateWizard } from './components/admin/wizard/TemplateWizard';
import { SkillWizard } from './components/admin/wizard/SkillWizard';
import { SkillEditWizard } from './components/admin/wizard/SkillEditWizard';
import { JobWizard } from './components/admin/wizard/JobWizard';
import { StatsWizard } from './components/admin/wizard/StatsWizard';
import { AdminBackups } from './components/admin/AdminBackups';
import { AdminLogs } from './components/admin/AdminLogs';
import { TutorialOverlay } from './components/TutorialOverlay';
import { ToastContainer } from './components/Toast';
import { TransitionOverlayProvider } from './components/ui/TransitionOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTranslation } from 'react-i18next';
import { useMasterDataInit } from './hooks/useMasterData';

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
function App() {
  const theme = useThemeStore((state) => state.theme);
  const { i18n } = useTranslation();
  useMasterDataInit();

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
          <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
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
              fontSize: '1rem',
            }}
          >
            {i18n.language.startsWith('ja') ? 'ページを再読み込み' : 'Reload page'}
          </button>
        </div>
      }
    >
      <TransitionOverlayProvider>
        <div className="relative w-full h-full">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/miti" element={<MitiPlannerPage />} />
            <Route path="/share/:shareId" element={<SharePage />} />
            <Route path="/popular" element={<PopularPage />} />


            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/commercial" element={<CommercialDisclosurePage />} />
            {/* 管理画面 */}
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route index element={<AdminDashboard />} />
              <Route path="contents" element={<AdminContents />} />
              <Route path="templates" element={<AdminTemplates />} />
              <Route path="skills" element={<AdminSkills />} />
              <Route path="stats" element={<AdminStats />} />
              <Route path="servers" element={<AdminServers />} />
              <Route path="config" element={<AdminConfig />} />
              <Route path="content-wizard" element={<ContentWizard />} />
              <Route path="template-wizard" element={<TemplateWizard />} />
              <Route path="skill-wizard" element={<SkillWizard />} />
              <Route path="skill-edit" element={<SkillEditWizard />} />
              <Route path="job-wizard" element={<JobWizard />} />
              <Route path="stats-wizard" element={<StatsWizard />} />
              <Route path="backups" element={<AdminBackups />} />
              <Route path="logs" element={<AdminLogs />} />
            </Route>
            {/* Catch-all: redirect unknown paths to portal */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <TutorialOverlay />
          <ToastContainer />
        </div>
      </TransitionOverlayProvider>
    </ErrorBoundary>
  );
}

export default App;
