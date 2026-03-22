import React from 'react';
import { useThemeStore } from '../store/useThemeStore';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();
    const { setContentLanguage } = useThemeStore();
    const currentLang = i18n.language;

    const handleLanguageChange = (lang: string) => {
        if (currentLang === lang) return;
        i18n.changeLanguage(lang);
        setContentLanguage(lang as 'ja' | 'en');
    };

    return (
        <div className="flex items-center bg-[rgba(var(--app-accent-rgb),0.08)] dark:bg-[rgba(var(--app-accent-rgb),0.06)] rounded-full pl-2 pr-1 py-1 border border-[rgba(var(--app-accent-rgb),0.3)] dark:border-[rgba(var(--app-accent-rgb),0.25)] relative h-[32px] select-none shadow-[0_0_8px_rgba(var(--app-accent-rgb),0.15)] group transition-colors hover:border-[rgba(var(--app-accent-rgb),0.5)]">
            {/* Globe Icon - Left */}
            <div className="pr-2 border-r border-slate-300 dark:border-white/10 flex items-center justify-center text-[rgba(var(--app-accent-rgb),0.6)] group-hover:text-app-accent transition-colors mr-1">
                <Globe size={14} />
            </div>

            {/* Toggle Container - Right */}
            <div className="flex relative w-[80px] h-full items-center">
                {/* Sliding Highlight Background */}
                <div className="absolute inset-y-0.5 inset-x-0.5 pointer-events-none">
                    <div
                        className={`w-1/2 h-full rounded-[4px] bg-[rgba(var(--app-accent-rgb),0.25)] border border-[rgba(var(--app-accent-rgb),0.6)] shadow-[0_0_14px_rgba(var(--app-accent-rgb),0.4),inset_0_1px_0_rgba(var(--app-accent-rgb),0.5)] transform transition-transform duration-300 ease-out skew-x-[-12deg] ${currentLang === 'en' ? 'translate-x-full' : 'translate-x-0'
                            }`}
                    />
                </div>

                {/* Labels */}
                <button
                    onClick={() => handleLanguageChange('ja')}
                    className={`flex-1 relative z-10 text-[10px] font-black transition-colors duration-200 flex items-center justify-center cursor-pointer ${currentLang === 'ja' ? 'text-app-accent drop-shadow-[0_0_6px_rgba(var(--app-accent-rgb),0.6)]' : 'text-app-text-muted hover:text-app-text'
                        }`}
                >
                    JP
                </button>
                <button
                    onClick={() => handleLanguageChange('en')}
                    className={`flex-1 relative z-10 text-[10px] font-black transition-colors duration-200 flex items-center justify-center cursor-pointer ${currentLang === 'en' ? 'text-app-accent drop-shadow-[0_0_6px_rgba(var(--app-accent-rgb),0.6)]' : 'text-app-text-muted hover:text-app-text'
                        }`}
                >
                    EN
                </button>
            </div>
        </div>
    );
};
