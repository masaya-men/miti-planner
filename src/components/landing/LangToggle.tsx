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
      className="fixed right-5 md:right-8 top-5 md:top-8 z-[100000] flex items-center rounded-full border border-white/20 overflow-hidden"
      style={{ mixBlendMode: 'difference' }}
    >
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchTo(code)}
          className={`group relative px-5 py-3.5 text-app-2xl-plus font-bold tracking-wider transition-all duration-300 overflow-hidden ${
            current === code
              ? 'bg-white text-black'
              : 'text-white/40 hover:text-white'
          }`}
          data-hover
        >
          <span className="relative z-10">{label}</span>
          {current !== code && (
            <div className="absolute inset-0 bg-white/15 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          )}
        </button>
      ))}
    </div>
  );
}
