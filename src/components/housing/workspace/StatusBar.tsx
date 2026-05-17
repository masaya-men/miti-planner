import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../store/useThemeStore';

const LANGS = ['ja', 'en', 'ko', 'zh'] as const;
const BUILD_VERSION = import.meta.env.VITE_HOUSING_BUILD ?? 'v0.3-α';

/**
 * StatusBar — mockup-faithful telemetry strip.
 * Left group: ● Build version · Lat/Lon · Theme readout
 * Right group: Stops · ETA · FPS · Lang switcher
 *
 * Plan A scope: numeric fields are placeholders until selection / tour state lands
 * in Plan C/D. Theme readout reflects useThemeStore (live). Lang switcher kept
 * accessible here since /housing is a standalone route without global nav.
 */
export const StatusBar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  const themeLabel = theme === 'light'
    ? t('housing.workspace.topbar.theme_light')
    : t('housing.workspace.topbar.theme_dark');

  return (
    <footer className="housing-status">
      <div className="housing-status-group">
        <span>
          <span className="housing-status-dot" aria-hidden="true" />
          {t('housing.workspace.statusbar.build_label')}&nbsp;
          <span className="housing-accent">{BUILD_VERSION}</span>
        </span>
        <span>
          {t('housing.workspace.statusbar.lat_label')} 31.41 · {t('housing.workspace.statusbar.lon_label')} 22.07
        </span>
        <span>
          {t('housing.workspace.statusbar.theme_readout_label')}&nbsp;
          <span className="housing-accent">{themeLabel}</span>
        </span>
      </div>

      <div className="housing-status-group">
        <span>
          {t('housing.workspace.statusbar.stops_label')}&nbsp;
          <span className="housing-accent">0</span>&nbsp;/&nbsp;7
        </span>
        <span>
          {t('housing.workspace.statusbar.eta_label')} 00:00
        </span>
        <span>
          {t('housing.workspace.statusbar.fps_label')}&nbsp;
          <span className="housing-accent">60</span>
        </span>
        <span className="housing-status-lang">
          {LANGS.map((lang) => {
            const isActive = i18n.language === lang || i18n.language.startsWith(`${lang}-`);
            return (
              <button
                key={lang}
                type="button"
                aria-pressed={isActive}
                className={isActive ? 'is-on' : ''}
                onClick={() => i18n.changeLanguage(lang)}
              >
                {lang}
              </button>
            );
          })}
        </span>
      </div>
    </footer>
  );
};
