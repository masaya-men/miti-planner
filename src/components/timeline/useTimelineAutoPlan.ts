import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { SavedPlan } from '../../types';
import { useMitigationStore } from '../../store/useMitigationStore';
import { generateAutoPlan } from '../../utils/autoPlanner';
import { showToast } from '../toastBus';
import type { SheetImportResult } from '../../lib/sheetImport/buildPlanFromSheets';
import { importWithLimitCheck } from '../../lib/sheetImport/importWithLimitCheck';
import type { ContentSelectionDefault } from '../../lib/contentSelection';

type ConfirmDialogState = {
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning';
    confirmLabel?: string;
    cancelLabel?: string;
} | null;

interface UseTimelineAutoPlanArgs {
    readOnlyRef: RefObject<boolean>;
    setConfirmDialog: Dispatch<SetStateAction<ConfirmDialogState>>;
    currentContentId: string | null;
    currentPlan: SavedPlan | undefined;
    t: TFunction;
}

/**
 * オートプラン実行・スプシ取り込みの確定と、軽減表シート/AA モード/AA 設定の開閉 state。
 * Timeline 本体から移したもの(元と同じ位置で呼ぶ。確認ダイアログの state は本体に残り、setter を受ける)。
 */
export function useTimelineAutoPlan({
    readOnlyRef, setConfirmDialog, currentContentId, currentPlan, t,
}: UseTimelineAutoPlanArgs) {
    const handleAutoPlan = useCallback(() => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        const executePlan = () => {
            const { timelineEvents, partyMembers, currentLevel } = useMitigationStore.getState();
            const result = generateAutoPlan(timelineEvents, partyMembers, currentLevel);
            useMitigationStore.getState().applyAutoPlan(result);
        };

        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setTimeout(() => {
                const isConfirmed = window.confirm(
                    t('timeline.auto_plan_confirm_mobile', "オートプランを実行しますか？\n\n※現在の軽減の配置はすべて削除され、新しく上書きされます。")
                );
                if (isConfirmed) {
                    executePlan();
                }
            }, 150);
        } else {
            setConfirmDialog({
                title: t('timeline.auto_plan_title', 'オートプラン実行'),
                message: t('timeline.auto_plan_confirm', '現在のタイムラインに基づいて軽減プランを自動生成します。\n既存の配置はすべて削除され、新しく上書きされます。実行しますか？'),
                variant: 'warning',
                onConfirm: () => {
                    executePlan();
                    setConfirmDialog(null);
                },
            });
        }
    }, [readOnlyRef, setConfirmDialog, t]);

    const sheetImportDefault = useMemo<ContentSelectionDefault>(() => ({
        contentId: currentContentId,
        level: currentPlan?.level ?? null,
        category: currentPlan?.category ?? null,
        title: currentPlan?.title ?? '',
    }), [currentContentId, currentPlan]);

    // スプシ取り込み: コンテンツ選択値で確定。満杯時は LimitResolutionSheet で削除を待つ。
    const handleSheetImport = useCallback(
        async (result: SheetImportResult, opts: { contentId: string | null }): Promise<boolean> => {
            const committed = await importWithLimitCheck(
                result,
                opts.contentId,
                t('sheetImport.default_plan_title'),
            );
            if (committed) showToast(t('sheetImport.created'));
            return committed;
        },
        [t],
    );

    const [isAaModeEnabled, setIsAaModeEnabled] = useState(false);
    const [aaSettingsOpen, setAaSettingsOpen] = useState(false);

    return {
        handleAutoPlan, sheetImportDefault, handleSheetImport,
        isAaModeEnabled, setIsAaModeEnabled,
        aaSettingsOpen, setAaSettingsOpen,
    };
}
