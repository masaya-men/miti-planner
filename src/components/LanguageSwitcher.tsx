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
        <div className="flex items-center bg-transparent rounded-full pl-2 pr-1 py-1 border border-app-border relative h-[32px] select-none group transition-colors hover:border-app-text">
            {/* Globe Icon - Left */}
            <div className="pr-2 border-r border-app-border flex items-center justify-center text-app-text-muted group-hover:text-app-text transition-colors mr-1">
                <Globe size={14} />
            </div>

            {/* Toggle Container - Right */}
            <div className="flex relative w-[80px] h-full items-center">
                {/* Sliding Highlight Background */}
                <div className="absolute inset-y-0.5 inset-x-0.5 pointer-events-none">
                    <div
                        className={`w-1/2 h-full rounded-[4px] bg-app-text border border-app-text transform transition-transform duration-300 ease-out skew-x-[-12deg] ${currentLang === 'en' ? 'translate-x-full' : 'translate-x-0'
                            }`}
                    />
                </div>

                {/* Labels */}
                <button
                    onClick={() => handleLanguageChange('ja')}
                    className={`flex-1 relative z-10 text-[10px] font-black transition-colors duration-200 flex items-center justify-center cursor-pointer ${currentLang === 'ja' ? 'text-app-bg' : 'text-app-text'
                        }`}
                >
                    JP
                </button>
                <button
                    onClick={() => handleLanguageChange('en')}
                    className={`flex-1 relative z-10 text-[10px] font-black transition-colors duration-200 flex items-center justify-center cursor-pointer ${currentLang === 'en' ? 'text-app-bg' : 'text-app-text'
                        }`}
                >
                    EN
                </button>
            </div>
        </div>
    );
};
