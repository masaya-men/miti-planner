import { useThemeStore } from '../../store/useThemeStore';
import { getContentById } from '../../data/contentRegistry';
import { getPhaseName } from '../../types';
import type { SavedPlan } from '../../types';

/** ヘッダーに出すコンテンツ名。viewer モードは部屋の contentId、通常はプランの contentId から引く */
export function useHeaderContentLabel(
    readOnly: boolean,
    viewer: { contentId: string | null } | undefined,
    currentPlan: SavedPlan | undefined,
): string | null {
    const { contentLanguage } = useThemeStore();
    // viewer モード時: コンテンツ情報を部屋の contentId から取得（usePlanStore 非依存）
    const contentDef = readOnly
        ? (viewer!.contentId ? getContentById(viewer!.contentId) : null)
        : (currentPlan?.contentId ? getContentById(currentPlan.contentId) : null);
    // 和欧間スペース: 漢字/かな↔半角英数字の間にスペースを挿入
    const addWaEiSpace = (text: string): string =>
        text.replace(/([\u3000-\u9FFF\uF900-\uFAFF])([A-Za-z0-9])/g, '$1 $2')
            .replace(/([A-Za-z0-9])([\u3000-\u9FFF\uF900-\uFAFF])/g, '$1 $2');

    const rawContentLabel = contentDef
        ? getPhaseName(contentDef.name, contentLanguage)
        : null;
    const contentLabel = rawContentLabel && contentLanguage === 'ja'
        ? addWaEiSpace(rawContentLabel)
        : rawContentLabel;
    return contentLabel;
}
