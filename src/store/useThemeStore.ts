import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCanPreviewWip, useCanPreviewWip } from '../hooks/useCanPreviewWip';
import { useTutorialStore } from './useTutorialStore';
import { matchesMobile } from '../hooks/useIsMobile';

export type Theme = 'dark' | 'light';
/** テーマの「スタイル軸」。明るさ軸(theme)と直交。'military' = 軍事SF HUD (MIL-SPEC)。 */
export type ThemeStyle = 'standard' | 'military';
export type ContentLanguage = 'ja' | 'en' | 'zh' | 'ko' | 'zh-Hant';
/** モバイル軽減表: 軽減アイコン⇄エフェクト棒の表示モード。
 * 'icon'=常にアイコンのまま(変身しない) / 'scroll'=スクロール連動で変身 / 'bar'=常にエフェクト棒。
 * 2026-08-14ユーザー要望=ON/OFFの2択ではなく3パターンを切り替えたい。 */
export type MobileEffectBarMode = 'icon' | 'scroll' | 'bar';
/** 軽減表の表示モード。'lanes'=ふつう(列ごとのレーン) / 'sheet'=スプシ風(PC・WIP権限のみ)。 */
export type TimelineView = 'lanes' | 'sheet';

interface ThemeState {
    theme: Theme;
    themeStyle: ThemeStyle;
    contentLanguage: ContentLanguage;
    /** 初期値は常に'icon'(2026-08-14ユーザー判断='scroll'はスクロール時の重さの根本原因が
     * 未解決のためピッカーから一時除外、解決策が出るまでの暫定対応)。ユーザーがFAB経由で
     * 明示的に切り替えたらその選択を優先して永続化する(2026-08-13ユーザー要望=OS設定に関わらず
     * アプリ側で単独に切り替えたい)。 */
    mobileEffectBarMode: MobileEffectBarMode;
    /** 保存値。実際に使う値は resolveTimelineView / useEffectiveTimelineView で解決する。 */
    timelineView: TimelineView;
    setTheme: (theme: Theme) => void;
    setThemeStyle: (style: ThemeStyle) => void;
    setContentLanguage: (lang: ContentLanguage) => void;
    setMobileEffectBarMode: (mode: MobileEffectBarMode) => void;
    setTimelineView: (view: TimelineView) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark',
            themeStyle: 'standard',
            contentLanguage: 'ja',
            mobileEffectBarMode: 'icon',
            timelineView: 'lanes',
            setTheme: (theme) => {
                set({ theme });
                applyThemeClasses(theme, resolveThemeStyle(get().themeStyle, getCanPreviewWip(), useTutorialStore.getState().isActive));
            },
            setThemeStyle: (themeStyle) => {
                set({ themeStyle });
                applyThemeClasses(get().theme, resolveThemeStyle(themeStyle, getCanPreviewWip(), useTutorialStore.getState().isActive));
            },
            setContentLanguage: (lang) => set({ contentLanguage: lang }),
            setMobileEffectBarMode: (mode) => set({ mobileEffectBarMode: mode }),
            setTimelineView: (view) => set({ timelineView: view }),
        }),
        {
            name: 'theme-storage',
            version: 3,
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
                if (version < 3 && state.timelineView == null) {
                    state.timelineView = 'lanes';
                }
                return state;
            },
        }
    )
);

/** スタイルごとに <html> へ足すクラス(standard は明るさクラスだけ)。
 *  スタイルを増やすときはここと index.html の起動時スクリプトの両方に足す(themeStyleClasses.test.ts が突き合わせる)。 */
export const THEME_STYLE_CLASS: Record<ThemeStyle, string | null> = {
    standard: null,
    military: 'theme-military',
};

/** <html> のテーマクラス(明るさ theme-dark / theme-light + スタイル別クラス)を正しい状態へ正規化する。
 *  App.tsx の useEffect と store の setter が共用し、付与ロジックを1箇所に閉じる。 */
export function applyThemeClasses(theme: Theme, style: ThemeStyle): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const styleClasses = Object.values(THEME_STYLE_CLASS).filter((c): c is string => c !== null);
    root.classList.remove('theme-dark', 'theme-light', ...styleClasses);
    root.classList.add(`theme-${theme}`);
    const styleClass = THEME_STYLE_CLASS[style];
    if (styleClass) root.classList.add(styleClass);
}

/** 実際に使うスタイル。保存値が 'military' でも、WIP 閲覧権限(DEV か管理者)が無ければ 'standard'。
 *  チュートリアル実行中は MIL-SPEC 非対応のため常に 'standard'(2026-10-22 masaya 判断)。
 *  保存値自体は消さない(管理者に戻れば・チュートリアルが終われば軍事が復活する)。 */
export function resolveThemeStyle(saved: ThemeStyle, canPreview: boolean, tutorialActive = false): ThemeStyle {
    if (tutorialActive) return 'standard';
    return canPreview ? saved : 'standard';
}

/** コンポーネント用: 保存値 + 権限 + チュートリアル実行中かから実際に使うスタイルを返す。 */
export function useEffectiveThemeStyle(): ThemeStyle {
    const saved = useThemeStore((s) => s.themeStyle);
    const canPreview = useCanPreviewWip();
    const tutorialActive = useTutorialStore((s) => s.isActive);
    return resolveThemeStyle(saved, canPreview, tutorialActive);
}

/** 実際に使う表示モード。WIP 閲覧権限が無い / チュートリアル中 / スマホ幅 のどれかなら常に 'lanes'。
 *  保存値自体は消さない(権限が戻れば・チュートリアルが終われば復活する)。 */
export function resolveTimelineView(saved: TimelineView, canPreview: boolean, tutorialActive: boolean, isMobile: boolean): TimelineView {
    if (!canPreview || tutorialActive || isMobile) return 'lanes';
    return saved;
}

/** コンポーネント用: 保存値 + 権限 + チュートリアル + スマホ幅(Timeline.tsx と同じ innerWidth < 768)から実効モードを返す。 */
export function useEffectiveTimelineView(): TimelineView {
    const saved = useThemeStore((s) => s.timelineView);
    const canPreview = useCanPreviewWip();
    const tutorialActive = useTutorialStore((s) => s.isActive);
    const isMobile = matchesMobile(window);
    return resolveTimelineView(saved, canPreview, tutorialActive, isMobile);
}
