import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LangToggle } from './LangToggle';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('app.page_title_landing');
  }, [t]);

  return (
    <div className="relative min-h-screen text-white"
         style={{ backgroundColor: 'var(--color-lp-bg)' }}>
      <LangToggle />
      <main className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-6xl font-black tracking-tighter mb-8"
              style={{ color: 'var(--color-lp-text)' }}>
            {t('portal.title')}
          </h1>
          <div className="flex gap-8 justify-center">
            <a href="/miti"
               className="px-8 py-4 rounded-xl border text-lg font-semibold transition-all hover:scale-105"
               style={{
                 borderColor: 'var(--color-portal-cyan)',
                 color: 'var(--color-portal-cyan)',
               }}>
              {t('portal.miti_button')}
            </a>
            <button
              onClick={() => alert(t('portal.housing_coming_soon'))}
              className="px-8 py-4 rounded-xl border text-lg font-semibold transition-all hover:scale-105"
              style={{
                borderColor: 'var(--color-portal-amber)',
                color: 'var(--color-portal-amber)',
              }}>
              {t('portal.housing_button')}
            </button>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
