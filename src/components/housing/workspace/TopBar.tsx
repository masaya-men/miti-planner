import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../store/useThemeStore';

/**
 * TopBar — mockup-faithful header.
 * Layout: [brand mark + LoPo / Housing Tour] · [breadcrumb] · [theme toggle pill]
 * Plan A scope: breadcrumb is a static placeholder until Plan C wires plot selection state.
 */
export const TopBar: React.FC = () => {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <header className="housing-top">
      <div
        className="housing-brand"
        role="img"
        aria-label={t('housing.workspace.topbar.logo_alt')}
      >
        <span className="housing-brand-mark" aria-hidden="true" />
        <span>
          LoPo&nbsp;
          <span className="housing-brand-sub">/ {t('housing.workspace.topbar.subtitle')}</span>
        </span>
      </div>

      <nav className="housing-crumbs" aria-label={t('housing.workspace.topbar.breadcrumb_label')}>
        {/* TODO(Plan C): replace with selected DC / region / ward / plot from state. */}
        <span className="now">{t('housing.workspace.topbar.browse_placeholder')}</span>
      </nav>

      <div className="housing-theme-toggle" role="tablist" aria-label={t('housing.workspace.topbar.theme_toggle_label')}>
        <button
          type="button"
          role="tab"
          aria-selected={theme === 'light'}
          className={theme === 'light' ? 'is-on' : ''}
          onClick={() => setTheme('light')}
        >
          <span aria-hidden="true">☀</span>
          {t('housing.workspace.topbar.theme_light')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={theme === 'dark'}
          className={theme === 'dark' ? 'is-on' : ''}
          onClick={() => setTheme('dark')}
        >
          <span aria-hidden="true">☾</span>
          {t('housing.workspace.topbar.theme_dark')}
        </button>
      </div>
    </header>
  );
};
