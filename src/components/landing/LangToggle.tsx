import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../store/useThemeStore';
import type { ContentLanguage } from '../../store/useThemeStore';

const LANGUAGES: { code: ContentLanguage; label: string }[] = [
  { code: 'ja', label: 'JP' },
  { code: 'en', label: 'EN' },
  { code: 'zh', label: 'ZH' },
  { code: 'ko', label: 'KO' },
];

export function LangToggle() {
  const { i18n } = useTranslation();
  const { setContentLanguage } = useThemeStore();
  const current = i18n.language;

  const switchTo = (lang: ContentLanguage) => {
    if (current === lang) return;
    i18n.changeLanguage(lang);
    setContentLanguage(lang);
  };

  return (
    <div
      className="fixed right-4 md:right-6 top-4 md:top-6 z-[10000] flex items-center gap-2"
    >
      {LANGUAGES.map(({ code, label }, idx) => (
        <button
          key={code}
          onClick={() => switchTo(code)}
          className="font-mono text-xs tracking-widest transition-opacity duration-200 hover:opacity-80"
          style={{
            color: 'var(--color-lp-text)',
            opacity: current === code ? 1 : 0.35,
          }}
          data-hover
        >
          {label}
          {idx < LANGUAGES.length - 1 && (
            <span
              className="ml-2 pointer-events-none select-none"
              style={{ opacity: 0.2, color: 'var(--color-lp-text)' }}
            >
              |
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
