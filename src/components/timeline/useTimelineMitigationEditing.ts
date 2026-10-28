import { useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { TFunction } from 'i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useProgressRecording } from '../progress/useProgressRecording';
import { useStableCallback } from '../../hooks/useStableCallback';
import { migrateMitigations } from '../../utils/jobMigration';
import { buildAppliedMitigation } from './sheet/sheetTap';
import type { SheetColumn } from './sheet/sheetColumns';
import type { useTimelineDialogs } from './useTimelineDialogs';
import type { TimelineEvent, Mitigation, PartyMember, AppliedMitigation } from '../../types';

type Dialogs = ReturnType<typeof useTimelineDialogs>;
type StoreState = ReturnType<typeof useMitigationStore.getState>;

type MitigationEditingArgs = Pick<Dialogs,
    | 'setSelectedEvent' | 'setSelectedTime' | 'setIsModalOpen' | 'setConfirmDialog'
    | 'setSelectorPosition' | 'setSelectedMemberId' | 'setSelectedMitigationTime' | 'setMitigationSelectorOpen'
    | 'selectedMemberId' | 'selectedMitigationTime'
    | 'setMobileMitiFlow' | 'mobileContextMenu' | 'setMobileContextMenu'
    | 'labelSelectMode' | 'setLabelSelectMode' | 'timelineSelectMode' | 'setTimelineSelectMode'
    | 'setJobPickerPosition' | 'setJobPickerMemberId' | 'setJobPickerOpen' | 'jobPickerMemberId'
    | 'migrationConfig' | 'setMigrationConfig'
> & Pick<StoreState,
    | 'removeEvent' | 'addMitigation' | 'setMemberJob' | 'changeMemberJobWithMitigations'
    | 'updateLabelStartTime' | 'updateLabelEndTime' | 'updatePhaseStartTime' | 'updatePhaseEndTime'
> & {
    readOnlyRef: RefObject<boolean>;
    sheetColumnMapRef: RefObject<ReadonlyMap<string, SheetColumn[]> | null>;
    handleSheetCellTap: (sheetMap: ReadonlyMap<string, SheetColumn[]>, memberId: string, time: number, e: React.MouseEvent) => void;
    handleAddClick: (time: number, e: React.MouseEvent) => void;
    handlePhaseAdd: (time: number, e: React.MouseEvent) => void;
    handleLabelAdd: (time: number, e: React.MouseEvent) => void;
    handleEventClick: (event: TimelineEvent, e: React.MouseEvent) => void;
    setMobilePartyOpen: (open: boolean) => void;
    setMobileToolsOpen: (open: boolean) => void;
    setMobileMenuOpen: (open: boolean) => void;
    throttledUpdatePreview: (time: number | null) => void;
    partyMembers: PartyMember[];
    timelineMitigations: AppliedMitigation[];
    t: TFunction;
};

/** 軽減選択・モバイル長押し・行の選択モード・ジョブ変更/移行。行へ渡すコールバックの useStableCallback もここ */
export function useTimelineMitigationEditing({
    setSelectedEvent, setSelectedTime, setIsModalOpen, setConfirmDialog,
    setSelectorPosition, setSelectedMemberId, setSelectedMitigationTime, setMitigationSelectorOpen,
    selectedMemberId, selectedMitigationTime,
    setMobileMitiFlow, mobileContextMenu, setMobileContextMenu,
    labelSelectMode, setLabelSelectMode, timelineSelectMode, setTimelineSelectMode,
    setJobPickerPosition, setJobPickerMemberId, setJobPickerOpen, jobPickerMemberId,
    migrationConfig, setMigrationConfig,
    removeEvent, addMitigation, setMemberJob, changeMemberJobWithMitigations,
    updateLabelStartTime, updateLabelEndTime, updatePhaseStartTime, updatePhaseEndTime,
    readOnlyRef, sheetColumnMapRef, handleSheetCellTap,
    handleAddClick, handlePhaseAdd, handleLabelAdd, handleEventClick,
    setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen, throttledUpdatePreview,
    partyMembers, timelineMitigations, t,
}: MitigationEditingArgs) {
    const handleCellClick = useCallback((memberId: string, time: number, e: React.MouseEvent) => {
        // 進捗記録モード中はクリックを横取りして到達点を記録（既存の軽減配置には入らない）
        if (useProgressRecording.getState().recordMode) {
            e.stopPropagation();
            e.preventDefault();
            useProgressRecording.getState().commitReachedPos(time);
            return;
        }
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        // メモモード中は軽減配置選択を起動しない (= シート空白クリックでメモ作成に統一)
        if (useMitigationStore.getState().toolMode === 'memo') return;
        const member = useMitigationStore.getState().partyMembers.find(m => m.id === memberId);
        const isTutorial = useTutorialStore.getState().isActive;
        if (!member || (!member.jobId && !isTutorial)) return;

        // スプシ表示: モーダルを開かず、押した列の技をその場に置く / 消す / 弾く / 小窓で相手を選ぶ
        const sheetMap = sheetColumnMapRef.current;
        if (sheetMap) {
            handleSheetCellTap(sheetMap, memberId, time, e);
            return;
        }

        setSelectorPosition({ x: e.clientX, y: e.clientY });
        setSelectedMemberId(memberId);
        setSelectedMitigationTime(time);
        setMitigationSelectorOpen(true);
        // ── Tutorial: セルクリックイベント ──
        useTutorialStore.getState().completeEvent('mitigation:cell-clicked');
    }, [handleSheetCellTap, readOnlyRef, setMitigationSelectorOpen, setSelectedMemberId, setSelectedMitigationTime, setSelectorPosition, sheetColumnMapRef]);

    const handleMobileDamageClick = useCallback((time: number, e: React.MouseEvent) => {
        e.stopPropagation();
        // 他のボトムメニューを閉じてから軽減シートを開く
        setMobilePartyOpen(false);
        setMobileToolsOpen(false);
        setMobileMenuOpen(false);
        setMobileMitiFlow({ isOpen: true, time, step: 'job', selectedMemberId: null, pending: null });
    }, [setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen, setMobileMitiFlow]);

    const handleMobileLongPress = useCallback((event: TimelineEvent | null, time: number) => {
        setMobilePartyOpen(false);
        setMobileToolsOpen(false);
        setMobileMenuOpen(false);
        if (event === null) {
            // 空行の長押し: PC の `+` ボタン相当として直接 EventModal を開く
            setSelectedEvent(null);
            setSelectedTime(time);
            setIsModalOpen(true);
            return;
        }
        setMobileContextMenu({ isOpen: true, event, time });
    }, [setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen, setMobileContextMenu, setSelectedEvent, setSelectedTime, setIsModalOpen]);

    // 行(TimelineRow/MobileTimelineRow)の onTimelineSelect / onTimelineSelectHover。
    // PC・スマホで中身が同じなので1組にまとめる(元はレンダー行のループ内でそれぞれ別の
    // インライン関数として毎行・毎レンダー作っていたため、行の memo 比較を素通りできなかった)。
    const handleTimelineSelect = (time: number) => {
        if (labelSelectMode) {
            if (labelSelectMode.field === 'startTime') {
                updateLabelStartTime(labelSelectMode.labelId, time);
            } else {
                updateLabelEndTime(labelSelectMode.labelId, time);
            }
            setLabelSelectMode(null);
            throttledUpdatePreview(null);
            return;
        }
        if (timelineSelectMode) {
            if (timelineSelectMode.field === 'startTime') {
                updatePhaseStartTime(timelineSelectMode.phaseId, time);
            } else {
                updatePhaseEndTime(timelineSelectMode.phaseId, time);
            }
            setTimelineSelectMode(null);
            throttledUpdatePreview(null);
        }
    };
    const handleTimelineSelectHover = (time: number) => {
        if (timelineSelectMode || labelSelectMode) throttledUpdatePreview(time);
    };

    // perf(timeline-row-memo): 行に渡すコールバックは全部 useStableCallback で包み、参照を
    // 固定する。行の memo 比較(rowPropsEqual)が「関数の中身は同じだが参照が違うだけ」で
    // 毎回 false を返し全行描き直しになっていたのを防ぐ。呼び出し自体は if/ループの中ではなく
    // コンポーネント本体のトップレベルに置く(フックのルール)。
    const stableAddClick = useStableCallback(handleAddClick);
    const stablePhaseAdd = useStableCallback(handlePhaseAdd);
    const stableLabelAdd = useStableCallback(handleLabelAdd);
    const stableEventClick = useStableCallback(handleEventClick);
    const stableCellClick = useStableCallback(handleCellClick);
    const stableMobileDamageClick = useStableCallback(handleMobileDamageClick);
    const stableMobileLongPress = useStableCallback(handleMobileLongPress);
    const stableTimelineSelect = useStableCallback(handleTimelineSelect);
    const stableTimelineSelectHover = useStableCallback(handleTimelineSelectHover);

    const handleContextEdit = useCallback(() => {
        if (!mobileContextMenu?.event) return;
        setSelectedEvent(mobileContextMenu.event);
        setSelectedTime(mobileContextMenu.time);
        setIsModalOpen(true);
        setMobileContextMenu(null);
    }, [mobileContextMenu, setIsModalOpen, setMobileContextMenu, setSelectedEvent, setSelectedTime]);

    const handleContextAdd = useCallback(() => {
        if (!mobileContextMenu) return;
        setSelectedEvent(null);
        setSelectedTime(mobileContextMenu.time);
        setIsModalOpen(true);
        setMobileContextMenu(null);
    }, [mobileContextMenu, setIsModalOpen, setMobileContextMenu, setSelectedEvent, setSelectedTime]);

    const handleContextDelete = useCallback(() => {
        if (!mobileContextMenu?.event) return;
        setConfirmDialog({
            title: t('timeline.event_delete'),
            message: t('timeline.delete_event_confirm'),
            variant: 'danger',
            onConfirm: () => {
                removeEvent(mobileContextMenu.event!.id);
                setConfirmDialog(null);
                setMobileContextMenu(null);
            },
        });
    }, [mobileContextMenu, t, removeEvent, setConfirmDialog, setMobileContextMenu]);

    // 他のボトムメニューが開いたら軽減追加シートを閉じる
    useEffect(() => {
        const close = () => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }));
        window.addEventListener('mobile:close-miti-flow', close);
        return () => window.removeEventListener('mobile:close-miti-flow', close);
    }, [setMobileMitiFlow]);

    const handleMitigationSelect = (mitigation: Mitigation & { _targetId?: string; _linkedMitigationId?: string }) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (!selectedMemberId) return;

        addMitigation(buildAppliedMitigation(mitigation, selectedMitigationTime, selectedMemberId, {
            targetId: mitigation._targetId,
            linkedMitigationId: mitigation._linkedMitigationId,
        }));
        setMitigationSelectorOpen(false);

    };

    const handleJobIconClick = (memberId: string, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        setJobPickerPosition({ x: e.clientX, y: e.clientY });
        setJobPickerMemberId(memberId);
        setJobPickerOpen(true);
    };

    type MigrationMode = 'inherit' | 'common_only' | 'reset';
    const handleJobSelect = (jobId: string) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (jobPickerMemberId) {
            const targetMember = partyMembers.find(m => m.id === jobPickerMemberId);
            if (targetMember) {
                if (targetMember.jobId === jobId) {
                    setJobPickerOpen(false);
                    return;
                }

                const hasMitigations = timelineMitigations.some(m => m.ownerId === targetMember.id);

                if (hasMitigations && targetMember.jobId) {
                    setMigrationConfig({
                        isOpen: true,
                        memberId: targetMember.id,
                        oldJobId: targetMember.jobId,
                        newJobId: jobId
                    });
                    setJobPickerOpen(false);
                    return;
                } else {
                    setMemberJob(targetMember.id, jobId);
                }
            }
        }
        setJobPickerOpen(false);
    };

    const handleMigrationConfirm = (mode: MigrationMode) => {
        if (!migrationConfig) return;

        const { memberId, oldJobId, newJobId } = migrationConfig;

        const memberMitis = timelineMitigations.filter(m => m.ownerId === memberId);
        const newMitis = migrateMitigations(oldJobId, newJobId, memberId, memberMitis, mode);

        changeMemberJobWithMitigations(memberId, newJobId, newMitis);
        setMigrationConfig(null);
    };

    const handleMigrationCancel = () => {
        setMigrationConfig(null);
    };

    return {
        handleCellClick,
        stableAddClick, stablePhaseAdd, stableLabelAdd, stableEventClick, stableCellClick,
        stableMobileDamageClick, stableMobileLongPress, stableTimelineSelect, stableTimelineSelectHover,
        handleContextEdit, handleContextAdd, handleContextDelete,
        handleMitigationSelect, handleJobIconClick, handleJobSelect,
        handleMigrationConfirm, handleMigrationCancel,
    };
}
