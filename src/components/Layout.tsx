import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileBottomSheet } from './MobileBottomSheet';
import { useTutorialStore } from '../store/useTutorialStore';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { Sun, Moon, Home, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { theme, setTheme } = useThemeStore();
    const navigate = useNavigate();
    // Default sidebar closed on mobile (< 768px)
    const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth >= 768 : true
    );
    const { myJobHighlight, setMyJobHighlight } = useMitigationStore();

    // Mobile modal triggers — these are read by Timeline.tsx via the store
    const [mobilePartyOpen, setMobilePartyOpen] = useState(false);
    const [mobileStatusOpen, setMobileStatusOpen] = useState(false);
    const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // チュートリアル中ならサイドバーを強制的に開く
    const isTutorialActive = useTutorialStore((state) => state.isActive);
    React.useEffect(() => {
        if (isTutorialActive) {
            setIsSidebarOpen(true);
            setMobileMenuOpen(false); // モバイルの場合はサイドメニューを閉じて本体を見せる等（必要に応じて）
        }
    }, [isTutorialActive]);

    // ベースの背景色（テーマ変数を参照するように変更）
    const bgClass = "bg-slate-50 dark:bg-app-bg";

    return (
        <div className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden font-sans text-app-text selection:bg-app-accent/20 transition-colors duration-300 ${bgClass} relative`}>

            {/* 👇 【修正】アニメーションを「より大きく、ゆったりと」した優雅な動きに変更 */}
            <style>{`
@keyframes float-blob-1 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
    25% { transform: translate(30vw, -20vh) scale(1.6); opacity: 0.7; }
    50% { transform: translate(50vw, 20vh) scale(1.2); opacity: 0.5; }
    75% { transform: translate(25vw, 40vh) scale(1.8); opacity: 0.8; }
}
@keyframes float-blob-2 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
    20% { transform: translate(-40vw, 30vh) scale(1.7); opacity: 0.6; }
    40% { transform: translate(-60vw, -25vh) scale(1.3); opacity: 0.4; }
    60% { transform: translate(-30vw, -45vh) scale(1.8); opacity: 0.7; }
    80% { transform: translate(15vw, -35vh) scale(1.1); opacity: 0.5; }
}
@keyframes float-blob-3 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
    33% { transform: translate(30vw, 30vh) scale(2.0); opacity: 0.8; }
    66% { transform: translate(-30vw, 15vh) scale(0.9); opacity: 0.6; }
}
                /* 時間を長く（遅く）して、ゆったりとした優雅な動きに */
                .animate-blob-1 { animation: float-blob-1 20s ease-in-out infinite; }
                .animate-blob-2 { animation: float-blob-2 25s ease-in-out infinite; }
                .animate-blob-3 { animation: float-blob-3 15s ease-in-out infinite; }
`}</style>

            {/* 背景Blob */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                {/* 1. 大きなグレーのBlob */}
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen filter blur-[100px] animate-blob-1",
                    "w-[80vw] h-[80vw] md:w-[60vw] md:h-[60vw] left-[-10%] top-[-10%]",
                    "bg-slate-300/40 dark:bg-slate-700/20"
                )} />
                {/* 2. 大きなシルバーのBlob */}
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen filter blur-[100px] animate-blob-2",
                    "w-[70vw] h-[70vw] md:w-[50vw] md:h-[50vw] right-[-10%] bottom-[-10%]",
                    "bg-indigo-100/40 dark:bg-zinc-600/15"
                )} />
                {/* 3. 【新規追加】ほんの一部だけ明るめ・激しく動くルミナスなコア */}
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen filter blur-[80px] animate-blob-3",
                    "w-[40vw] h-[40vw] md:w-[30vw] md:h-[30vw] left-[30%] top-[30%]",
                    "bg-white/50 dark:bg-slate-400/25"
                )} />
            </div>

            {/* サイドバー — on PC: normal flow; on mobile: overlay drawer */}
            {/* PC sidebar */}
            <div className="hidden md:block">
                <Sidebar isOpen={isSidebarOpen} />
            </div>

            {/* Mobile sidebar — slides up from bottom as a sheet */}
            <MobileBottomSheet
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                title="メニュー"
                height="80vh"
            >
                <div className="-mx-4 -mt-3">
                    <Sidebar isOpen={true} />
                </div>
            </MobileBottomSheet>

            <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative z-10">

                {/* ── PC Header ── */}
                <header className={clsx(
                    "h-14 shrink-0 border-b flex items-center justify-between px-4 z-40 relative transition-colors duration-300 shadow-sm",
                    "hidden md:flex",
                    "bg-white/40 border-slate-200/50 backdrop-blur-xl dark:bg-glass-header dark:border-white/5 dark:backdrop-blur-xl"
                )}>
                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                    <div className="flex items-center gap-3">
                        {/* ハンバーガーメニュー */}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="relative w-10 h-10 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex justify-center items-center active:scale-90 group"
                        >
                            <div className={clsx("relative w-5 h-4 flex justify-center items-center pointer-events-none transition-transform duration-700 ease-[cubic-bezier(0.87,0,0.13,1)]", isSidebarOpen ? "rotate-[180deg]" : "rotate-0")}>
                                <span className={clsx(
                                    "absolute h-[2px] w-full bg-current rounded-full transition-all duration-700 ease-[cubic-bezier(0.87,0,0.13,1)]",
                                    isSidebarOpen ? "rotate-45" : "-translate-y-[6px]",
                                    isSidebarOpen ? "text-app-accent" : "text-slate-500 dark:text-slate-400 group-hover:text-app-text"
                                )} />
                                <span className={clsx(
                                    "absolute h-[2px] w-full bg-current rounded-full transition-all duration-500 ease-[cubic-bezier(0.87,0,0.13,1)]",
                                    isSidebarOpen ? "opacity-0 scale-x-0 rotate-90" : "opacity-100 rotate-0",
                                    "text-slate-500 dark:text-slate-400 group-hover:text-app-text"
                                )} />
                                <span className={clsx(
                                    "absolute h-[2px] w-full bg-current rounded-full transition-all duration-700 ease-[cubic-bezier(0.87,0,0.13,1)]",
                                    isSidebarOpen ? "-rotate-45" : "translate-y-[6px]",
                                    isSidebarOpen ? "text-app-accent" : "text-slate-500 dark:text-slate-400 group-hover:text-app-text"
                                )} />
                            </div>
                        </button>
                        <img
                            src="/icons/logo.png"
                            alt="Logo"
                            className="h-14 w-auto object-contain filter grayscale sepia hue-rotate-[190deg] saturate-[300%] brightness-110 dark:sepia-0 dark:hue-rotate-0 dark:saturate-100 dark:brightness-[1.5] dark:drop-shadow-[0_0_12px_rgba(226,232,240,0.6)] transition-all duration-300 pointer-events-none"
                        />

                        {/* Home / Portal button */}
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-lg text-slate-400 hover:text-app-accent hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer active:scale-95"
                            title="ポータルに戻る"
                        >
                            <Home size={16} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Tutorial help button */}
                        <button
                            onClick={() => {
                                const path = window.location.pathname;
                                // If on planner page, skip the portal selection step
                                if (path === '/' || path === '') {
                                    useTutorialStore.getState().startTutorial();
                                } else {
                                    useTutorialStore.getState().startFromStep(1);
                                }
                            }}
                            className="relative p-1.5 w-9 h-9 rounded-lg text-slate-500 hover:text-app-accent dark:text-slate-400 dark:hover:text-app-accent hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                            title="チュートリアル"
                        >
                            <HelpCircle size={18} />
                        </button>
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="relative p-1.5 w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </header>

                {/* ── Mobile Header ── */}
                <header className={clsx(
                    "h-11 shrink-0 border-b flex md:hidden items-center justify-between px-3 z-40 relative transition-colors duration-300",
                    "bg-white/60 border-slate-200/50 backdrop-blur-xl dark:bg-slate-900/60 dark:border-slate-700/50 dark:backdrop-blur-xl"
                )}>
                    <img
                        src="/icons/logo.png"
                        alt="Logo"
                        className="h-8 w-auto object-contain filter grayscale sepia hue-rotate-[190deg] saturate-[300%] brightness-110 dark:sepia-0 dark:hue-rotate-0 dark:saturate-100 dark:brightness-[1.5] dark:drop-shadow-[0_0_8px_rgba(226,232,240,0.6)] transition-all duration-300 pointer-events-none"
                    />

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-1.5 w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
                        >
                            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </header>

                {/* Main content — add bottom padding on mobile for bottom nav */}
                <main className="flex-1 flex flex-col relative overflow-hidden transition-colors duration-300 pb-16 md:pb-0">
                    <MobileTriggersContext.Provider value={{
                        mobilePartyOpen, setMobilePartyOpen,
                        mobileStatusOpen, setMobileStatusOpen,
                        mobileToolsOpen, setMobileToolsOpen,
                        mobileMenuOpen, setMobileMenuOpen
                    }}>
                        {children}
                    </MobileTriggersContext.Provider>
                </main>

                {/* Footer — hidden on mobile, shown on PC */}
                <footer className={clsx(
                    "h-6 shrink-0 backdrop-blur-md border-t hidden md:flex items-center justify-center z-50 pointer-events-none transition-colors duration-300",
                    "border-white/20 dark:border-white/10",
                    "bg-white/40 dark:bg-slate-900/40"
                )}>
                    <p className="text-[8px] text-slate-500 dark:text-slate-600 tracking-wide">
                        (C) SQUARE ENIX CO., LTD. All Rights Reserved. · 当サイトは非公式のファンツールであり、株式会社スクウェア・エニックスとは一切関係ありません。
                    </p>
                </footer>
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