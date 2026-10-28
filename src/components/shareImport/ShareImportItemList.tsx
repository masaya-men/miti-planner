import type { RefObject } from 'react';
import { LayoutGroup } from 'framer-motion';
import { SharePlanCard } from '../SharePlanCard';
import { getContentById } from '../../data/contentRegistry';
import { getPhaseName } from '../../types';
import { resolveItemSweepStatus } from './shareImportProgress';
import type { useShareImportFlow } from '../../store/useShareImportFlow';

type FlowState = ReturnType<typeof useShareImportFlow.getState>;

interface ShareImportItemListProps {
    leftListRef: RefObject<HTMLDivElement | null>;
    importItems: FlowState['importItems'];
    activeItemId: string | null;
    progressMap: FlowState['progressMap'];
    selectedItemIds: FlowState['selectedItemIds'];
    redFlaggedPlanIds: FlowState['redFlaggedPlanIds'];
    status: FlowState['status'];
    isBundle: boolean;
    lang: string;
    toggleSelect: FlowState['toggleSelect'];
    setActiveItemId: (id: string) => void;
}

export function ShareImportItemList({
    leftListRef, importItems, activeItemId, progressMap, selectedItemIds, redFlaggedPlanIds,
    status, isBundle, lang, toggleSelect, setActiveItemId,
}: ShareImportItemListProps) {
    // Left list (#1: 単一でも常に描画)
    return (
        <div ref={leftListRef} className="flex-shrink-0 w-[140px] md:w-[280px] border-r border-app-border p-3 overflow-y-auto bg-app-surface2/30 flex flex-col gap-2">
            <LayoutGroup>
                {importItems.map((item) => {
                    const itemPlanId = item.sourcePlanId ?? item.sourceShareId;
                    const isActive = activeItemId === itemPlanId;
                    const itemEvents = Array.from(progressMap.values()).filter(
                        (e) => e.planId === itemPlanId,
                    );
                    const isChecked = selectedItemIds.has(itemPlanId);
                    const isRedFlagged = redFlaggedPlanIds.has(itemPlanId);
                    // #2: コンテンツ名を主タイトル、 プラン名を副タイトル
                    const contentDef = item.contentId
                        ? getContentById(item.contentId)
                        : null;
                    const contentLabel = contentDef
                        ? getPhaseName(contentDef.name, lang)
                        : '';
                    // sweep は importing / done 時のみ表示。
                    // done のときも継続表示するのは、 CLOSE_DELAY_AFTER_DONE_MS の
                    // 1.2 秒間に success 状態の青チェックアイコンを視認させるため。
                    const sweepStatus = (status === 'importing' || status === 'done')
                        ? resolveItemSweepStatus(itemEvents)
                        : undefined;
                    return (
                        <SharePlanCard
                            key={itemPlanId}
                            title={contentLabel || item.title}
                            subtitle={contentLabel ? item.title : undefined}
                            isActive={isActive}
                            // 単一プランでは checkbox を出さない: 外しても取り込みボタンが
                            // disabled になるだけで UX 矛盾になる (キャンセル/取り込みの 2 択で十分)。
                            showCheckbox={isBundle && status === 'preview'}
                            isChecked={isChecked}
                            onToggleCheck={() => toggleSelect(itemPlanId)}
                            onClickRow={() => setActiveItemId(itemPlanId)}
                            isRedFlagged={isRedFlagged}
                            sweepStatus={sweepStatus}
                            sweepColor="blue"
                        />
                    );
                })}
            </LayoutGroup>
        </div>
    );
}
