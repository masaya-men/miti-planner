import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'default' | 'obsidian' | 'forest';
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
            theme: 'default',
            contentLanguage: 'ja',
            setTheme: (theme) => {
                set({ theme });
                // Apply theme class to document element
                const root = document.documentElement;
                root.classList.remove('theme-default', 'theme-obsidian', 'theme-forest');
                root.classList.add(`theme-${theme}`);
            },
            setContentLanguage: (lang) => set({ contentLanguage: lang }),
        }),
        {
            name: 'theme-storage',
        }
    )
);
