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
        <div className="flex items-center bg-slate-200/50 dark:bg-black/40 rounded-full pl-2 pr-1 py-1 border border-slate-300 dark:border-white/10 relative h-[32px] select-none shadow-inner group transition-colors hover:border-slate-400 dark:hover:border-white/20">
            {/* Globe Icon - Left */}
            <div className="pr-2 border-r border-slate-300 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors mr-1">
                <Globe size={14} />
            </div>

            {/* Toggle Container - Right */}
            <div className="flex relative w-[80px] h-full items-center">
                {/* Sliding Highlight Background */}
                <div className="absolute inset-y-0.5 inset-x-0.5 pointer-events-none">
                    <div
                        className={`w-1/2 h-full rounded-[4px] bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] transform transition-transform duration-300 ease-out skew-x-[-12deg] ${currentLang === 'en' ? 'translate-x-full' : 'translate-x-0'
                            }`}
                    />
                </div>

                {/* Labels */}
                <button
                    onClick={() => handleLanguageChange('ja')}
                    className={`flex-1 relative z-10 text-[10px] font-black transition-colors duration-200 flex items-center justify-center cursor-pointer ${currentLang === 'ja' ? 'text-white shadow-black/50 drop-shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-white/60 dark:hover:text-white'
                        }`}
                >
                    JP
                </button>
                <button
                    onClick={() => handleLanguageChange('en')}
                    className={`flex-1 relative z-10 text-[10px] font-black transition-colors duration-200 flex items-center justify-center cursor-pointer ${currentLang === 'en' ? 'text-white shadow-black/50 drop-shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-white/60 dark:hover:text-white'
                        }`}
                >
                    EN
                </button>
            </div>
        </div>
    );
};
