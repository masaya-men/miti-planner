import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type ContentLanguage = 'ja' | 'en';

interface ThemeState {
    theme: Theme;
    contentLanguage: ContentLanguage;
    setTheme: (theme: Theme) => void;
    setContentLanguage: (lang: ContentLanguage) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark',
            contentLanguage: 'ja',
            setTheme: (theme) => {
                set({ theme });
                // Apply theme class to document element
                const root = document.documentElement;
                root.classList.remove('theme-dark', 'theme-light');
                root.classList.add(`theme-${theme}`);
            },
            setContentLanguage: (lang) => set({ contentLanguage: lang }),
        }),
        {
            name: 'theme-storage',
        }
    )
);
