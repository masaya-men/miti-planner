import React from 'react';
import { useThemeStore } from '../store/useThemeStore';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';

export const ContentLanguageSwitcher: React.FC = () => {
    const { contentLanguage, setContentLanguage } = useThemeStore();
    const { t } = useTranslation();

    const toggleLanguage = () => {
        const newLang = contentLanguage === 'ja' ? 'en' : 'ja';
        setContentLanguage(newLang);
    };

    return (
        <Tooltip content={t('ui.switch_lang', contentLanguage === 'ja' ? 'Switch skill names to English' : 'スキル名を日本語に切り替え')}>
            <button
                onClick={toggleLanguage}
                className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full text-app-lg font-bold text-app-text hover:text-app-text group relative overflow-hidden water-drop"
            >
                <BookOpen size={14} className="text-app-text group-hover:text-amber-300 transition-colors duration-300" />
                <span className="relative z-10 w-4 text-center">
                    {contentLanguage === 'ja' ? 'JP' : 'EN'}
                </span>
            </button>
        </Tooltip>
    );
};
