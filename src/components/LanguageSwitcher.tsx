import React, { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';
import type { ContentLanguage } from '../store/useThemeStore';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useTransitionOverlay } from './ui/TransitionOverlay';

const LANGUAGES: { code: ContentLanguage; label: string }[] = [
    { code: 'ja', label: '日本語' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'ko', label: '한국어' },
];

export const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();
    const { setContentLanguage } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const currentLang = i18n.language as ContentLanguage;
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const handleLanguageChange = (lang: ContentLanguage) => {
        if (currentLang === lang) { setOpen(false); return; }
        setOpen(false);
        runTransition(() => {
            i18n.changeLanguage(lang);
            setContentLanguage(lang);
        }, 'language');
    };

    // クリック外で閉じる
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const currentLabel = LANGUAGES.find(l => l.code === currentLang)?.label ?? 'JP';

    return (
        <div ref={ref} data-tutorial-always className="relative select-none">
            <button
                onClick={() => setOpen(prev => !prev)}
                className="flex items-center gap-1.5 bg-transparent rounded-full px-2.5 py-1 border border-app-border h-[32px] transition-colors hover:border-app-text cursor-pointer"
            >
                <Globe size={14} className="text-app-text-muted" />
                <span className="text-app-base font-black text-app-text">{currentLabel}</span>
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-1 z-[999] bg-app-surface border border-app-border rounded-lg shadow-lg py-1 min-w-[120px]">
                    {LANGUAGES.map(({ code, label }) => (
                        <button
                            key={code}
                            onClick={() => handleLanguageChange(code)}
                            className={`w-full text-left px-3 py-2 text-app-base transition-colors cursor-pointer ${
                                currentLang === code
                                    ? 'bg-app-text text-app-bg font-black'
                                    : 'text-app-text hover:bg-app-surface2 font-medium'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
