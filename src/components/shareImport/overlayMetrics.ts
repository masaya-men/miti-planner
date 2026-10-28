import { getImportItemFraction, isImportItemTerminal } from './shareImportProgress';
import type { useShareImportFlow } from '../../store/useShareImportFlow';

type FlowState = ReturnType<typeof useShareImportFlow.getState>;

/** 中央オーバーレイ用の集計 (importing / done 中のみ意味あり) */
export const computeOverlayMetrics = (
    importItems: FlowState['importItems'],
    progressMap: FlowState['progressMap'],
) => {
    if (importItems.length === 0) {
        return { percent: 0, completedCount: 0, totalCount: 0 };
    }
    let totalFraction = 0;
    let completedCount = 0;
    for (const item of importItems) {
        const planId = item.sourcePlanId ?? item.sourceShareId;
        const events = Array.from(progressMap.values()).filter(
            (e) => e.planId === planId,
        );
        totalFraction += getImportItemFraction(events);
        if (isImportItemTerminal(events)) completedCount += 1;
    }
    return {
        percent: (totalFraction / importItems.length) * 100,
        completedCount,
        totalCount: importItems.length,
    };
};
