import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../store/useThemeStore';

const LANGS = ['JA', 'EN', 'KO', 'ZH'] as const;

export const StatusBar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <footer
      className="relative z-20 flex items-center justify-between gap-6 px-6 h-8 text-xs"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderTop: '1px solid rgba(255, 255, 255, 0.22)',
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0,0,0,0.55), 0 0 10px rgba(0,0,0,0.32)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="opacity-55 uppercase tracking-wider">{t('housing.workspace.statusbar.theme_label')}</span>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`px-2 py-0.5 rounded ${theme === 'light' ? 'bg-white/20' : ''}`}
          style={{ color: theme === 'light' ? '#ffc987' : 'inherit' }}
        >
          {t('housing.workspace.statusbar.theme_light')}
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-white/20' : ''}`}
          style={{ color: theme === 'dark' ? '#ffc987' : 'inherit' }}
        >
          {t('housing.workspace.statusbar.theme_dark')}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="opacity-55 uppercase tracking-wider">{t('housing.workspace.statusbar.lang_label')}</span>
        {LANGS.map((lang) => {
          const code = lang.toLowerCase();
          const isActive = i18n.language === code;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => i18n.changeLanguage(code)}
              className={`px-2 py-0.5 rounded ${isActive ? 'bg-white/20' : ''}`}
              style={{ color: isActive ? '#ffc987' : 'inherit' }}
            >
              {lang}
            </button>
          );
        })}
      </div>
    </footer>
  );
};
