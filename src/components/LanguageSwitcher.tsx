import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const globeRef = useRef<HTMLDivElement>(null);
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
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <div ref={ref} data-tutorial-always className="flex items-center bg-transparent rounded-full pl-2 pr-1 py-1 border border-app-border relative h-[32px] select-none group transition-colors hover:border-app-text">
            {/* Globe Icon - クリックで全言語リスト */}
            <div
                ref={globeRef}
                className="pr-2 border-r border-app-border flex items-center justify-center text-app-text-muted group-hover:text-app-text transition-all cursor-pointer mr-1 hover:scale-110"
                onClick={() => setOpen(prev => !prev)}
            >
                <Globe size={14} className="globe-icon transition-transform" />
            </div>

            {/* JP/EN Toggle - 従来通り */}
            <div className="flex relative w-[80px] h-full items-center">
                <div className="absolute inset-y-0.5 inset-x-0.5 pointer-events-none">
                    <div
                        className={`w-1/2 h-full rounded-[4px] bg-app-text border border-app-text transform transition-transform duration-300 ease-out skew-x-[-12deg] ${currentLang === 'en' ? 'translate-x-full' : 'translate-x-0'}`}
                    />
                </div>
                <button
                    onClick={() => handleLanguageChange('ja')}
                    className={`flex-1 relative z-10 text-app-base font-black transition-colors duration-200 flex items-center justify-center cursor-pointer ${currentLang === 'ja' ? 'text-app-bg' : 'text-app-text'}`}
                >
                    JP
                </button>
                <button
                    onClick={() => handleLanguageChange('en')}
                    className={`flex-1 relative z-10 text-app-base font-black transition-colors duration-200 flex items-center justify-center cursor-pointer ${currentLang === 'en' ? 'text-app-bg' : 'text-app-text'}`}
                >
                    EN
                </button>
            </div>

            {/* 全言語ドロップダウン — Portal で最前面に表示 */}
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
                                        ? 'bg-app-text text-app-bg font-black'
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
