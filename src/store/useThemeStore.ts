import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type ContentLanguage = 'ja' | 'en' | 'zh' | 'ko' | 'zh-Hant';
/** モバイル軽減表: 軽減アイコン⇄エフェクト棒の表示モード。
 * 'icon'=常にアイコンのまま(変身しない) / 'scroll'=スクロール連動で変身 / 'bar'=常にエフェクト棒。
 * 2026-08-14ユーザー要望=ON/OFFの2択ではなく3パターンを切り替えたい。 */
export type MobileEffectBarMode = 'icon' | 'scroll' | 'bar';

interface ThemeState {
    theme: Theme;
    contentLanguage: ContentLanguage;
    /** 初期値はOSの「視差効果を減らす」設定を尊重する('icon' or 'scroll')が、ユーザーがFAB経由で
     * 明示的に切り替えたらその選択を優先して永続化する(2026-08-13ユーザー要望=OS設定に関わらず
     * アプリ側で単独に切り替えたい)。 */
    mobileEffectBarMode: MobileEffectBarMode;
    setTheme: (theme: Theme) => void;
    setContentLanguage: (lang: ContentLanguage) => void;
    setMobileEffectBarMode: (mode: MobileEffectBarMode) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark',
            contentLanguage: 'ja',
            mobileEffectBarMode: (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'icon' : 'scroll',
            setTheme: (theme) => {
                set({ theme });
                // Apply theme class to document element
                const root = document.documentElement;
                root.classList.remove('theme-dark', 'theme-light');
                root.classList.add(`theme-${theme}`);
            },
            setContentLanguage: (lang) => set({ contentLanguage: lang }),
            setMobileEffectBarMode: (mode) => set({ mobileEffectBarMode: mode }),
        }),
        {
            name: 'theme-storage',
        }
    )
);
