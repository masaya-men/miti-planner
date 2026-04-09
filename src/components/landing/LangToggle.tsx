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
    <div className="flex items-center gap-0.5">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchTo(code)}
          className="font-mono text-[11px] tracking-[0.1em] px-1.5 py-0.5 transition-opacity duration-200 hover:opacity-80"
          style={{
            color: 'var(--color-lp-text)',
            opacity: current === code ? 1 : 0.3,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
