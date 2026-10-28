import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../store/useThemeStore';
import { useTransitionOverlay } from '../ui/transitionOverlayContext';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { LanguageSwitcher } from '../LanguageSwitcher';

// ========================================
// 共通レイアウト
// ========================================

export const LegalPageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const { theme, setTheme } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const toggleTheme = () => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme');

    // body の overflow-hidden を一時的に解除（src/styles/base/global.css でグローバル設定されている）
    // + マウント時にスクロール位置を上端へリセット（前ページのスクロールが引き継がれるバグ対策）
    React.useEffect(() => {
        document.body.style.overflow = 'auto';
        window.scrollTo(0, 0);
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="min-h-[100dvh] bg-app-bg text-app-text overflow-auto">
            {/* ヘッダー */}
            <header className="sticky top-0 z-50 bg-app-bg/80 backdrop-blur border-b border-app-border">
                <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-app-2xl text-app-text-muted hover:text-app-text transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span>LoPo</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <button
                            onClick={toggleTheme}
                            className="p-1.5 rounded hover:bg-app-surface transition-colors"
                        >
                            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* 本文 */}
            <main className="max-w-2xl mx-auto px-4 py-8">
                {children}
            </main>

            {/* フッター */}
            <footer className="border-t border-app-border py-4 text-center">
                <p className="text-app-xs text-app-text-muted">
                    © SQUARE ENIX CO., LTD. All Rights Reserved.
                </p>
            </footer>
        </div>
    );
};
