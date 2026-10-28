import { useEffect, useState } from 'react';
import type { useShareImportFlow } from '../../store/useShareImportFlow';

type ImportItems = ReturnType<typeof useShareImportFlow.getState>['importItems'];

export const useActiveImportItem = (importItems: ImportItems) => {
    // 左カラムのアイテム選択 (= プレビュー対象)。 importItems の最初のアイテムを初期値にする。
    const [activeItemId, setActiveItemId] = useState<string | null>(null);

    useEffect(() => {
        if (importItems.length === 0) return;
        const ids = new Set(
            importItems.map((i) => i.sourcePlanId ?? i.sourceShareId),
        );
        if (!activeItemId || !ids.has(activeItemId)) {
            const firstId =
                importItems[0].sourcePlanId ?? importItems[0].sourceShareId;
            setActiveItemId(firstId);
        }
    }, [importItems, activeItemId]);
    return { activeItemId, setActiveItemId };
};
