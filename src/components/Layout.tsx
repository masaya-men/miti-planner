import React, { useState } from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useThemeStore } from '../store/useThemeStore';
import { Sidebar } from './Sidebar';
import { Menu, Sun, Moon } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { theme, setTheme } = useThemeStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Default/Forest/Obsidian theme logic can be expanded.
    // For now, let's use the abstract-dark for dark themes, and light for others.
    const bgClass = theme === 'dark' ? 'bg-abstract-dark' : 'bg-abstract-light';

    return (
        <div className={`flex min-h-screen h-screen overflow-hidden font-sans text-app-text selection:bg-app-accent/20 transition-colors duration-300 ${bgClass}`}>
            <Sidebar isOpen={isSidebarOpen} />

            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Header */}
                <header className="h-14 shrink-0 border-b border-glass-border bg-glass-header backdrop-blur-xl flex items-center justify-between px-4 z-50 relative transition-colors duration-300 shadow-glass">
                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-glass-border to-transparent pointer-events-none" />
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                        >
                            <Menu size={20} />
                        </button>
                        <img
                            src="/icons/logo.png"
                            alt="Logo"
                            className="h-14 w-auto object-contain filter grayscale sepia hue-rotate-[190deg] saturate-[300%] brightness-110 dark:sepia-0 dark:hue-rotate-0 dark:saturate-100 dark:brightness-[1.5] dark:drop-shadow-[0_0_12px_rgba(226,232,240,0.6)] transition-all duration-300"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors flex items-center justify-center cursor-pointer"
                            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <LanguageSwitcher />
                        {/* Settings or User Profile could go here */}
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 flex flex-col relative overflow-hidden transition-colors duration-300">
                    {children}
                </main>

                {/* Footer / Legal */}
                <footer className="h-8 shrink-0 bg-glass-panel backdrop-blur-md border-t border-glass-border flex items-center justify-center z-50 pointer-events-none transition-colors duration-300">
                    <p className="text-[10px] text-app-text-muted font-medium tracking-wide">
                        (C) SQUARE ENIX CO., LTD. All Rights Reserved. Not affiliated with Square Enix.
                    </p>
                </footer>
            </div>
        </div>
    );
};
