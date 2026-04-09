import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../store/useThemeStore';
import type { ContentLanguage } from '../store/useThemeStore';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { Tooltip } from './ui/Tooltip';

const LANGUAGES: { code: ContentLanguage; label: string }[] = [
    { code: 'ja', label: '日本語' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'ko', label: '한국어' },
];

export const LanguageSwitcher: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { setContentLanguage } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const currentLang = i18n.language as ContentLanguage;
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const globeRef = useRef<HTMLButtonElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

    const handleLanguageChange = (lang: ContentLanguage) => {
        if (currentLang === lang) { setOpen(false); return; }
        setOpen(false);
        runTransition(() => {
            i18n.changeLanguage(lang);
            setContentLanguage(lang);
        }, 'language');
    };

    // ドロップダウン位置計算
    useEffect(() => {
        if (!open || !globeRef.current) return;
        const rect = globeRef.current.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + 4,
            right: window.innerWidth - rect.right,
        });
    }, [open]);

    // クリック外で閉じる
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [open]);

    return (
        <div ref={ref} data-tutorial-always className="relative select-none">
            <Tooltip content={t('app.switch_language')}>
                <button
                    ref={globeRef}
                    onClick={() => setOpen(prev => !prev)}
                    className="group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 bg-transparent border-app-border text-app-text hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text"
                >
                    <Globe size={16} className="group-hover:rotate-45 transition-transform duration-500" />
                </button>
            </Tooltip>

            {open && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
                    <div
                        className="fixed z-[9999] bg-app-surface border border-app-border rounded-lg shadow-lg py-1 min-w-[130px]"
                        style={{ top: dropdownPos.top, right: dropdownPos.right }}
                    >
                        {LANGUAGES.map(({ code, label }) => (
                            <button
                                key={code}
                                onClick={() => handleLanguageChange(code)}
                                className={`w-full text-left px-3 py-2 text-app-base transition-colors cursor-pointer ${
                                    currentLang === code
                                        ? 'bg-app-toggle text-app-toggle-text font-black'
                                        : 'text-app-text hover:bg-app-surface2 font-medium'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};
