import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { Sidebar } from './Sidebar';
import { ConsolidatedHeader } from './ConsolidatedHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileBottomSheet } from './MobileBottomSheet';
import { useTutorialStore } from '../store/useTutorialStore';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { Sun, Moon, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const navigate = useNavigate();
    // Default sidebar closed on mobile (< 768px)
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 768 : true
    );
    const { myJobHighlight, setMyJobHighlight } = useMitigationStore();

    // Mobile modal triggers — these are read by Timeline.tsx via the store
    const [mobilePartyOpen, setMobilePartyOpen] = React.useState(false);
    const [mobileStatusOpen, setMobileStatusOpen] = React.useState(false);
    const [mobileToolsOpen, setMobileToolsOpen] = React.useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const { timelineSortOrder, setTimelineSortOrder } = useMitigationStore();
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false);
    const [isHeaderNear, setIsHeaderNear] = React.useState(false);
    // チュートリアル中ならサイドバーを強制的に開く
    const isTutorialActive = useTutorialStore((state) => state.isActive);
    React.useEffect(() => {
        if (isTutorialActive) {
            setIsSidebarOpen(true);
            setIsHeaderCollapsed(false);
            setMobileMenuOpen(false);
        }
    }, [isTutorialActive]);

    // ベースの背景色（テーマ変数を参照するように変更）
    const bgClass = "bg-slate-50 dark:bg-app-bg";

    return (
        <div className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden font-sans text-app-text selection:bg-app-accent/20 ${bgClass} relative`}>

            {/* 👇 【修正】アニメーションを「より大きく、ゆったりと」した優雅な動きに変更 */}
            <style>{`
@keyframes float-blob-1 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
    25% { transform: translate(40vw, -25vh) scale(1.8); opacity: 0.7; }
    50% { transform: translate(70vw, 15vh) scale(1.3); opacity: 0.5; }
    75% { transform: translate(35vw, 45vh) scale(2.0); opacity: 0.8; }
}
@keyframes float-blob-2 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
    20% { transform: translate(-50vw, 35vh) scale(1.9); opacity: 0.6; }
    40% { transform: translate(-75vw, -30vh) scale(1.4); opacity: 0.4; }
    60% { transform: translate(-40vw, -55vh) scale(2.2); opacity: 0.7; }
    80% { transform: translate(25vw, -45vh) scale(1.2); opacity: 0.5; }
}
@keyframes float-blob-3 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
    33% { transform: translate(45vw, 35vh) scale(2.5); opacity: 0.8; }
    66% { transform: translate(-45vw, 20vh) scale(0.8); opacity: 0.6; }
}
                /* 優雅さを保ちつつ、動きを実感できる速さに調整 */
                .animate-blob-1 { animation: float-blob-1 16s ease-in-out infinite; }
                .animate-blob-2 { animation: float-blob-2 20s ease-in-out infinite; }
                .animate-blob-3 { animation: float-blob-3 12s ease-in-out infinite; }
`}</style>

            {/* 背景Blob */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                {/* 1. 大きなグレーのBlob */}
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen filter blur-[100px] animate-blob-1",
                    "w-[90vw] h-[90vw] md:w-[70vw] md:h-[70vw] left-[-15%] top-[-15%]",
                    "bg-slate-300/40 dark:bg-slate-700/30"
                )} />
                {/* 2. 大きなシルバーのBlob */}
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen filter blur-[100px] animate-blob-2",
                    "w-[85vw] h-[85vw] md:w-[65vw] md:h-[65vw] right-[-15%] bottom-[-15%]",
                    "bg-indigo-100/40 dark:bg-zinc-600/20"
                )} />
                {/* 3. 【新規追加】ほんの一部だけ明るめ・激しく動くルミナスなコア */}
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen filter blur-[80px] animate-blob-3",
                    "w-[50vw] h-[50vw] md:w-[40vw] md:h-[40vw] left-[25%] top-[20%]",
                    "bg-white/60 dark:bg-slate-400/35"
                )} />
            </div>

            {/* サイドバー — on PC: normal flow; on mobile: overlay drawer */}
            {/* PC sidebar */}
            <div className="hidden md:block">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    onClose={() => setIsSidebarOpen(false)}
                />
            </div>

            {/* Mobile sidebar — slides up from bottom as a sheet */}
            <MobileBottomSheet
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                title={t('sidebar.menu')}
                height="80vh"
            >
                <div className="-mx-4 -mt-3">
                    <Sidebar isOpen={true} />
                </div>
            </MobileBottomSheet>

            <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative z-10">

                <MobileTriggersContext.Provider value={{
                    mobilePartyOpen, setMobilePartyOpen,
                    mobileStatusOpen, setMobileStatusOpen,
                    mobileToolsOpen, setMobileToolsOpen,
                    mobileMenuOpen, setMobileMenuOpen,
                    isHeaderCollapsed, setIsHeaderCollapsed,
                    isHeaderNear, setIsHeaderNear
                }}>
                    {/* ── PC Header ── */}
                    {/* ── Consolidated Floating Header (on PC) ── */}
                    <div className="hidden md:block h-0 relative z-[120]">
                        <ConsolidatedHeader
                        onAutoPlan={() => {
                            // Dispatch a custom event for Timeline.tsx or use a shared store
                            window.dispatchEvent(new CustomEvent('timeline:autoplan'));
                        }}
                        onImportLogs={() => {
                            window.dispatchEvent(new CustomEvent('timeline:import'));
                        }}
                        partySortOrder={timelineSortOrder}
                        setPartySortOrder={setTimelineSortOrder}
                        statusOpen={mobileStatusOpen}
                        setStatusOpen={setMobileStatusOpen}
                        setPartySettingsOpen={setMobilePartyOpen}
                    />
                </div>

                {/* ── Mobile Header ── */}
                <header className={clsx(
                    "h-11 shrink-0 border-b flex md:hidden items-center justify-between px-3 z-40 relative",
                    "bg-white/60 border-slate-200/50 backdrop-blur-xl dark:bg-slate-900/60 dark:border-slate-700/50 dark:backdrop-blur-xl"
                )}>
                    {/* Home button for mobile */}
                    <button
                        onClick={() => navigate('/')}
                        className="p-1.5 text-slate-500 dark:text-slate-400 flex items-center gap-1"
                    >
                        <Home size={18} />
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-1.5 w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer"
                        >
                            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </header>

                {/* Main content — add bottom padding on mobile for bottom nav */}
                <motion.main
                    className="flex-1 flex flex-col relative overflow-hidden pb-16 md:pb-0"
                    initial={false}
                    animate={{ paddingTop: isHeaderCollapsed ? 36 : 132 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {children}
                </motion.main>

                {/* Footer — hidden on mobile, shown on PC */}
                <footer className={clsx(
                    "h-6 shrink-0 backdrop-blur-md border-t hidden md:flex items-center justify-center z-50 pointer-events-none",
                    "border-white/20 dark:border-white/10",
                    "bg-white/40 dark:bg-slate-900/40"
                )}>
                    <p className="text-[8px] text-slate-500 dark:text-slate-600 tracking-wide">
                        (C) SQUARE ENIX CO., LTD. All Rights Reserved. · 当サイトは非公式のファンツールであり、株式会社スクウェア・エニックスとは一切関係ありません。
                    </p>
                </footer>
                </MobileTriggersContext.Provider>
            </div>

            {/* Mobile Bottom Nav */}
            <MobileBottomNav
                onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
                onPartyOpen={() => setMobilePartyOpen(!mobilePartyOpen)}
                onStatusOpen={() => setMobileStatusOpen(!mobileStatusOpen)}
                onToolsOpen={() => setMobileToolsOpen(!mobileToolsOpen)}
                myJobHighlight={myJobHighlight}
                onMyJobHighlightToggle={() => setMyJobHighlight(!myJobHighlight)}
                activeTab={mobileMenuOpen ? 'menu' : mobileToolsOpen ? 'tools' : mobilePartyOpen ? 'party' : mobileStatusOpen ? 'status' : undefined}
            />
        </div>
    );
};