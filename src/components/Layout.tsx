import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileBottomSheet } from './MobileBottomSheet';
import { TutorialOverlay } from './TutorialOverlay';
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

    // ベースの背景色（一番底の色）
    const bgClass = theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50';

    return (
        <div className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden font-sans text-app-text selection:bg-app-accent/20 transition-colors duration-300 ${bgClass} relative`}>

            {/* 👇 【修正】アニメーションをより激しく、速く */}
            <style>{`
                @keyframes float-blob-1 {
                    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
                    25% { transform: translate(15vw, -10vh) scale(1.3); opacity: 0.8; }
                    50% { transform: translate(25vw, 10vh) scale(1.1); opacity: 0.6; }
                    75% { transform: translate(10vw, 20vh) scale(1.4); opacity: 0.9; }
                }
                @keyframes float-blob-2 {
                    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
                    20% { transform: translate(-20vw, 15vh) scale(1.4); opacity: 0.7; }
                    40% { transform: translate(-30vw, -10vh) scale(1.2); opacity: 0.5; }
                    60% { transform: translate(-15vw, -25vh) scale(1.5); opacity: 0.8; }
                    80% { transform: translate(5vw, -15vh) scale(1.1); opacity: 0.6; }
                }
                /* 時間を短縮（12s->6s, 15s->8s）して動きを速く */
                .animate-blob-1 { animation: float-blob-1 6s ease-in-out infinite; }
                .animate-blob-2 { animation: float-blob-2 8s ease-in-out infinite; }
            `}</style>

            {/* 背景Blob */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen dark:mix-blend-color-dodge filter blur-[100px] animate-blob-1",
                    "w-[80vw] h-[80vw] md:w-[60vw] md:h-[60vw] left-[-10%] top-[-10%]",
                    // 👇 透明度を下げて、少し深めの色（より落ち着いた印象）に変更
                    theme === 'dark' ? "bg-blue-800/20" : "bg-slate-300/40"
                )} />
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen dark:mix-blend-color-dodge filter blur-[100px] animate-blob-2",
                    "w-[70vw] h-[70vw] md:w-[50vw] md:h-[50vw] right-[-10%] bottom-[-10%]",
                    // 👇 透明度を下げて、少し深めの色（より落ち着いた印象）に変更
                    theme === 'dark' ? "bg-indigo-900/20" : "bg-indigo-100/40"
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
                    theme === 'dark'
                        ? "bg-slate-900/40 border-slate-700/50 backdrop-blur-xl"
                        : "bg-white/40 border-slate-200/50 backdrop-blur-xl"
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
                            onClick={() => useTutorialStore.getState().startTutorial()}
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
                    theme === 'dark'
                        ? "bg-slate-900/60 border-slate-700/50 backdrop-blur-xl"
                        : "bg-white/60 border-slate-200/50 backdrop-blur-xl"
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
                    theme === 'dark' ? "bg-slate-900/40" : "bg-white/40"
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

            {/* Tutorial Overlay — rendered above everything */}
            <TutorialOverlay />
        </div>
    );
};