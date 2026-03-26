import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../store/useThemeStore';

export function LangToggle() {
  const { i18n } = useTranslation();
  const { setContentLanguage } = useThemeStore();
  const current = i18n.language;

  const switchTo = (lang: string) => {
    if (current === lang) return;
    i18n.changeLanguage(lang);
    setContentLanguage(lang as 'ja' | 'en');
  };

  return (
    <div
      className="fixed right-5 md:right-8 top-5 md:top-8 z-[100000] flex items-center rounded-full border border-white/20 overflow-hidden"
      style={{ mixBlendMode: 'difference' }}
    >
      <button
        onClick={() => switchTo('ja')}
        className={`group relative px-7 py-3.5 text-base font-bold tracking-wider transition-all duration-300 overflow-hidden ${
          current === 'ja'
            ? 'bg-white text-black'
            : 'text-white/40 hover:text-white'
        }`}
        data-hover
      >
        <span className="relative z-10">JP</span>
        {current !== 'ja' && (
          <div className="absolute inset-0 bg-white/15 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        )}
      </button>
      <button
        onClick={() => switchTo('en')}
        className={`group relative px-7 py-3.5 text-base font-bold tracking-wider transition-all duration-300 overflow-hidden ${
          current === 'en'
            ? 'bg-white text-black'
            : 'text-white/40 hover:text-white'
        }`}
        data-hover
      >
        <span className="relative z-10">EN</span>
        {current !== 'en' && (
          <div className="absolute inset-0 bg-white/15 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        )}
      </button>
    </div>
  );
}
