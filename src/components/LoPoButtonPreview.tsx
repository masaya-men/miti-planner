/**
 * LoPoボタンアニメーション プレビュー（開発用・確認後に削除）
 * /dev/lopo-btn でアクセス
 */
import React, { useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';
import { LoPoButton } from './LoPoButton';

export const LoPoButtonPreview: React.FC = () => {
    const { theme, setTheme } = useThemeStore();

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-dark', 'theme-light');
        root.classList.add(`theme-${theme}`);
    }, [theme]);

    useEffect(() => {
        document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center gap-16 p-8">
            <div className="flex flex-col items-center gap-6">
                <p className="text-xs text-app-text-muted">Large（人気ページヘッダー用）— ホバーしてください</p>
                <LoPoButton size="lg" />
            </div>

            <div className="flex flex-col items-center gap-6">
                <p className="text-xs text-app-text-muted">Small（軽減表ヘッダー用）— ホバーしてください</p>
                <LoPoButton size="sm" />
            </div>

            <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="px-4 py-2 rounded-full border border-app-border text-sm cursor-pointer hover:bg-app-text hover:text-app-bg transition-colors"
            >
                {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
        </div>
    );
};
