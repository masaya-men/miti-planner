import React, { useState } from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useThemeStore } from '../store/useThemeStore';
import { Sidebar } from './Sidebar';
import { Sun, Moon } from 'lucide-react';
import clsx from 'clsx';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { theme, setTheme } = useThemeStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // ベースの背景色（一番底の色）
    const bgClass = theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50';

    return (
        <div className={`flex min-h-screen h-screen overflow-hidden font-sans text-app-text selection:bg-app-accent/20 transition-colors duration-300 ${bgClass} relative`}>

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
                    // 👇 透明度を上げて色の主張を少し強める
                    theme === 'dark' ? "bg-blue-600/30" : "bg-blue-300/50"
                )} />
                <div className={clsx(
                    "absolute rounded-full mix-blend-screen dark:mix-blend-color-dodge filter blur-[120px] animate-blob-2",
                    "w-[70vw] h-[70vw] md:w-[50vw] md:h-[50vw] right-[-10%] bottom-[-10%]",
                    // 👇 透明度を上げて色の主張を少し強める
                    theme === 'dark' ? "bg-cyan-500/25" : "bg-cyan-200/60"
                )} />
            </div>

            {/* サイドバー */}
            <Sidebar isOpen={isSidebarOpen} />

            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">

                {/* 👇 3. ヘッダーを「真のすりガラス」に変更（bg-white/40 などで半透明化） */}
                <header className={clsx(
                    "h-14 shrink-0 border-b flex items-center justify-between px-4 z-40 relative transition-colors duration-300 shadow-sm",
                    theme === 'dark'
                        ? "bg-slate-900/40 border-slate-700/50 backdrop-blur-xl"
                        : "bg-white/40 border-slate-200/50 backdrop-blur-xl"
                )}>
                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                    <div className="flex items-center gap-3">
                        {/* 👇 【修正】スピン＆バウンドをより強調、色もアニメーション */}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="relative w-10 h-10 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex justify-center items-center active:scale-90 group"
                        >
                            {/* 完璧な×になるよう調整し、バウンドを強化、色をアクセントカラーに */}
                            <div className={clsx("relative w-5 h-4 flex justify-center items-center pointer-events-none transition-transform duration-700 ease-[cubic-bezier(0.5,2.5,0.4,0.8)]", isSidebarOpen && "rotate-[180deg]")}>
                                {/* 上の線 */}
                                <span className={clsx(
                                    "absolute h-[2px] w-full bg-current rounded-full transition-all duration-700 ease-[cubic-bezier(0.5,2.5,0.4,0.8)] ORIGIN-CENTER",
                                    isSidebarOpen ? "rotate-45" : "-translate-y-[7px]",
                                    // 開いたときはアクセントカラーに
                                    isSidebarOpen ? "text-app-accent" : "text-app-text-muted group-hover:text-app-text"
                                )} />
                                {/* 真ん中の線 */}
                                <span className={clsx(
                                    "absolute h-[2px] w-full bg-current rounded-full transition-all duration-300 ease-in-out",
                                    isSidebarOpen ? "opacity-0 translate-x-6 scale-x-0" : "opacity-100",
                                    "text-app-text-muted group-hover:text-app-text"
                                )} />
                                {/* 下の線 */}
                                <span className={clsx(
                                    "absolute h-[2px] w-full bg-current rounded-full transition-all duration-700 ease-[cubic-bezier(0.5,2.5,0.4,0.8)] ORIGIN-CENTER",
                                    isSidebarOpen ? "-rotate-45" : "translate-y-[7px]",
                                    // 開いたときはアクセントカラーに
                                    isSidebarOpen ? "text-app-accent" : "text-app-text-muted group-hover:text-app-text"
                                )} />
                            </div>
                        </button>
                        <img
                            src="/icons/logo.png"
                            alt="Logo"
                            className="h-14 w-auto object-contain filter grayscale sepia hue-rotate-[190deg] saturate-[300%] brightness-110 dark:sepia-0 dark:hue-rotate-0 dark:saturate-100 dark:brightness-[1.5] dark:drop-shadow-[0_0_12px_rgba(226,232,240,0.6)] transition-all duration-300 pointer-events-none"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="relative p-1.5 w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </header>

                <main className="flex-1 flex flex-col relative overflow-hidden transition-colors duration-300">
                    {children}
                </main>

                <footer className={clsx(
                    "h-8 shrink-0 backdrop-blur-md border-t flex items-center justify-center z-50 pointer-events-none transition-colors duration-300",
                    "border-white/20 dark:border-white/10",
                    theme === 'dark' ? "bg-slate-900/40" : "bg-white/40"
                )}>
                    <p className="text-[10px] text-slate-400 font-medium tracking-wide">
                        (C) SQUARE ENIX CO., LTD. All Rights Reserved. Not affiliated with Square Enix.
                    </p>
                </footer>
            </div>
        </div>
    );
};