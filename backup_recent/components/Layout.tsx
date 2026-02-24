import React from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useThemeStore } from '../store/useThemeStore';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { theme } = useThemeStore();
    // Default/Forest/Obsidian theme logic can be expanded.
    // For now, let's use the abstract-dark for obsidian/dark-like themes, and light for others.
    const bgClass = theme === 'obsidian' ? 'bg-abstract-dark' : (theme === 'default' ? 'bg-abstract-dark' : 'bg-abstract-light');

    return (
        <div className={`flex min-h-screen font-sans text-app-text selection:bg-app-accent/20 transition-colors duration-300 ${bgClass}`}>
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-14 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl flex items-center justify-between px-6 z-50 fixed top-0 w-full transition-colors duration-300 shadow-sm">
                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                    <div className="flex items-center gap-4">
                        <img
                            src="/icons/logo.png"
                            alt="Logo"
                            className="h-14 w-auto object-contain filter grayscale sepia hue-rotate-[190deg] saturate-[300%] brightness-110"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        {/* Settings or User Profile could go here */}
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 pt-14 relative overflow-hidden transition-colors duration-300">
                    {children}
                </main>
            </div>
        </div>
    );
};
