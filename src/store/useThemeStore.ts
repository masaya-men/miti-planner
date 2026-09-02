import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
/** テーマの「スタイル軸」。明るさ軸(theme)と直交。'military' = 軍事SF HUD (MIL-SPEC)。 */
export type ThemeStyle = 'standard' | 'military';
export type ContentLanguage = 'ja' | 'en' | 'zh' | 'ko' | 'zh-Hant';
/** モバイル軽減表: 軽減アイコン⇄エフェクト棒の表示モード。
 * 'icon'=常にアイコンのまま(変身しない) / 'scroll'=スクロール連動で変身 / 'bar'=常にエフェクト棒。
 * 2026-08-14ユーザー要望=ON/OFFの2択ではなく3パターンを切り替えたい。 */
export type MobileEffectBarMode = 'icon' | 'scroll' | 'bar';

interface ThemeState {
    theme: Theme;
    themeStyle: ThemeStyle;
    contentLanguage: ContentLanguage;
    /** 初期値は常に'icon'(2026-08-14ユーザー判断='scroll'はスクロール時の重さの根本原因が
     * 未解決のためピッカーから一時除外、解決策が出るまでの暫定対応)。ユーザーがFAB経由で
     * 明示的に切り替えたらその選択を優先して永続化する(2026-08-13ユーザー要望=OS設定に関わらず
     * アプリ側で単独に切り替えたい)。 */
    mobileEffectBarMode: MobileEffectBarMode;
    setTheme: (theme: Theme) => void;
    setThemeStyle: (style: ThemeStyle) => void;
    setContentLanguage: (lang: ContentLanguage) => void;
    setMobileEffectBarMode: (mode: MobileEffectBarMode) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark',
            themeStyle: 'standard',
            contentLanguage: 'ja',
            mobileEffectBarMode: 'icon',
            setTheme: (theme) => {
                set({ theme });
                applyThemeClasses(theme, get().themeStyle);
            },
            setThemeStyle: (themeStyle) => {
                set({ themeStyle });
                applyThemeClasses(get().theme, themeStyle);
            },
            setContentLanguage: (lang) => set({ contentLanguage: lang }),
            setMobileEffectBarMode: (mode) => set({ mobileEffectBarMode: mode }),
        }),
        {
            name: 'theme-storage',
            version: 2,
            // 2026-08-14: 'scroll'(連動)モードを選択肢から一時除外するのに合わせ、
            // 既存ユーザーで'scroll'が永続化済みだった場合は'icon'へ寄せる(1回限りの移行)。
            // 2026-09-02: スタイル軸(themeStyle)追加。旧永続値に無ければ'standard'を補う。
            migrate: (persistedState, version) => {
                const state = persistedState as Partial<ThemeState>;
                if (version < 1 && state.mobileEffectBarMode === 'scroll') {
                    state.mobileEffectBarMode = 'icon';
                }
                if (version < 2 && state.themeStyle == null) {
                    state.themeStyle = 'standard';
                }
                return state;
            },
        }
    )
);

/** <html> のテーマクラス3種(theme-dark / theme-light / theme-military)を正しい状態へ正規化する。
 *  App.tsx の useEffect と store の setter が共用し、付与ロジックを1箇所に閉じる。 */
export function applyThemeClasses(theme: Theme, style: ThemeStyle): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-military');
    root.classList.add(`theme-${theme}`);
    if (style === 'military') root.classList.add('theme-military');
}
