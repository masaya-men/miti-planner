import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../store/usePlanStore';
import { getContentById } from '../data/contentRegistry';
import { LoPoButton } from './LoPoButton';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Sun, Moon } from 'lucide-react';
import clsx from 'clsx';

// ── モバイルヘッダー: コンテンツ名+プラン名を中央に表示 ──
export const MobileHeader: React.FC<{
    onHome: () => void;
    theme: string;
    onToggleTheme: () => void;
}> = ({ onHome, theme, onToggleTheme }) => {
    const { i18n } = useTranslation();
    const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
    const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
    const contentLabel = contentDef
        ? (i18n.language.startsWith('ja') ? contentDef.name.ja : contentDef.name.en)
        : null;

    // タップでポップアップ表示（3秒後に自動で閉じる）
    const [popupVisible, setPopupVisible] = React.useState(false);
    const [popupMounted, setPopupMounted] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

    const handleTitleTap = () => {
        clearTimer();
        if (!popupMounted) {
            setPopupMounted(true);
            // マウント後に表示アニメーション開始（次フレーム）
            requestAnimationFrame(() => requestAnimationFrame(() => setPopupVisible(true)));
        } else {
            setPopupVisible(true);
        }
        timerRef.current = setTimeout(() => {
            setPopupVisible(false);
            setTimeout(() => setPopupMounted(false), 250);
        }, 3000);
    };

    const handlePopupDismiss = () => {
        clearTimer();
        setPopupVisible(false);
        setTimeout(() => setPopupMounted(false), 250);
    };

    React.useEffect(() => {
        return () => clearTimer();
    }, []);

    const hasPlanTitle = currentPlan?.title && currentPlan.title !== contentLabel;

    return (
        <header className={clsx(
            "h-9 shrink-0 border-b flex md:hidden items-center justify-between px-2 z-40 relative",
            "bg-app-bg/95 backdrop-blur-md border-app-border"
        )}>
            {/* 左: LoPoロゴ（Homeリンク兼用） */}
            <button
                onClick={onHome}
                className="p-1 text-app-text flex items-center shrink-0 cursor-pointer"
            >
                <LoPoButton size="sm" />
            </button>

            {/* 中央: コンテンツ名 / プラン名（タップでポップアップ） */}
            {currentPlan && (
                <div
                    className="flex-1 min-w-0 flex items-center justify-center gap-1 px-1 cursor-pointer active:opacity-70 transition-opacity"
                    onClick={handleTitleTap}
                >
                    {contentLabel && (
                        <span className="text-[11px] font-black text-app-text truncate leading-none">
                            {contentLabel}
                        </span>
                    )}
                    {hasPlanTitle && (
                        <>
                            {contentLabel && <span className="text-[9px] text-app-text-muted shrink-0">/</span>}
                            <span className="text-[10px] text-app-text-muted truncate leading-none">
                                {currentPlan.title}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* ポップアップ: ヘッダー直下に吹き出し風で表示（md以上は絶対に非表示） */}
            {popupMounted && currentPlan && (
                <>
                    {/* 背景タップで閉じる */}
                    <div
                        className="fixed inset-0 z-[199] md:hidden"
                        onClick={handlePopupDismiss}
                    />
                    <div
                        className={clsx(
                            "absolute left-2 right-2 top-full mt-1.5 z-[200] md:hidden",
                            "rounded-2xl px-4 py-3 border shadow-lg",
                            "dark:bg-[rgba(30,30,30,0.95)] dark:border-white/15 dark:shadow-black/40",
                            "bg-white/95 border-black/8 shadow-black/10",
                            "transition-all duration-250 ease-out origin-top",
                            popupVisible
                                ? "opacity-100 scale-100 translate-y-0"
                                : "opacity-0 scale-95 -translate-y-1"
                        )}
                        style={{
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                        }}
                    >
                        {/* 吹き出しの三角 */}
                        <div className={clsx(
                            "absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-l border-t",
                            "dark:bg-[rgba(30,30,30,0.95)] dark:border-white/15",
                            "bg-white/95 border-black/8"
                        )} />
                        {contentLabel && (
                            <p className="text-[13px] font-black text-app-text text-center leading-snug">
                                {contentLabel}
                            </p>
                        )}
                        {hasPlanTitle && (
                            <p className={clsx(
                                "text-[11px] text-app-text/60 text-center leading-snug",
                                contentLabel && "mt-1"
                            )}>
                                {currentPlan.title}
                            </p>
                        )}
                    </div>
                </>
            )}

            {/* 右: テーマ + 言語 */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    data-tutorial-always
                    onClick={onToggleTheme}
                    className="p-1 w-7 h-7 rounded-md text-app-text hover:bg-app-surface2 flex items-center justify-center cursor-pointer"
                >
                    {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                </button>
                <LanguageSwitcher />
            </div>
        </header>
    );
};
