import { useTutorialStore } from './useTutorialStore';
import { useThemeStore, applyThemeClasses, resolveThemeStyle } from './useThemeStore';
import { getCanPreviewWip } from '../hooks/useCanPreviewWip';

/** チュートリアルの開始/終了(isActive の変化)で <html> のテーマクラスを付け直す。
 *  チュートリアル中は MIL-SPEC を標準の見た目に差し替え、終わると保存値へ自動で戻る。
 *  保存値(themeStyle)は書き換えない。多重登録しないよう解除関数を保持する。 */
let unsubscribe: (() => void) | null = null;

export function registerThemeTutorialSync(): void {
    if (unsubscribe) return;
    unsubscribe = useTutorialStore.subscribe((state, prev) => {
        if (state.isActive === prev.isActive) return;
        const { theme, themeStyle } = useThemeStore.getState();
        applyThemeClasses(theme, resolveThemeStyle(themeStyle, getCanPreviewWip(), state.isActive));
    });
}

registerThemeTutorialSync();
