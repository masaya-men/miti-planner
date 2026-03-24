import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useThemeStore } from './store/useThemeStore';
import { PortalPage } from './components/PortalPage';
import { MitiPlannerPage } from './components/MitiPlannerPage';
import { SharePage } from './components/SharePage';
import { BubblePreview } from './components/BubblePreview';
import { PrivacyPolicyPage, TermsPage } from './components/LegalPage';
import { TutorialOverlay } from './components/TutorialOverlay';
import { ToastContainer } from './components/Toast';
import { useTranslation } from 'react-i18next';

/**
 * App — Root component with route definitions.
 *
 * Route map (centralized here for easy extension):
 *   /      → PortalPage (landing / tool selector)
 *   /miti   → MitiPlannerPage (mitigation planner tool)
 *
 * To add a new tool page:
 *   1. Create the page component in src/components/
 *   2. Add a <Route> entry below
 *   3. Add a card entry in PortalPage's TOOL_CARDS array
 */
function App() {
  const theme = useThemeStore((state) => state.theme);
  const { i18n } = useTranslation();

  // Sync theme class on <html> so Tailwind dark: variants work
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  // Update document title based on language
  useEffect(() => {
    const title = i18n.language.startsWith('ja')
      ? 'LoPo │ 軽減プランナー'
      : 'LoPo │ Mitigation Planner';
    document.title = title;
    // Sync <html lang> for SEO and accessibility
    document.documentElement.lang = i18n.language.startsWith('ja') ? 'ja' : 'en';
  }, [i18n.language]);

  return (
    <div className="relative w-full h-full">
      <Routes>
        <Route path="/" element={<PortalPage />} />
        <Route path="/miti" element={<MitiPlannerPage />} />
        <Route path="/share/:shareId" element={<SharePage />} />
        <Route path="/dev/bubbles" element={<BubblePreview />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        {/* Catch-all: redirect unknown paths to portal */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TutorialOverlay />
      <ToastContainer />
    </div>
  );
}

export default App;
