import { useCallback, useEffect } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useProgressRecording } from '../progress/useProgressRecording';
import { useStableCallback } from '../../hooks/useStableCallback';
import { migrateMitigations } from '../../utils/jobMigration';
import { buildAppliedMitigation } from './sheet/sheetTap';
import type { SheetColumn } from './sheet/sheetColumns';
import type { useTimelineDialogs } from './useTimelineDialogs';
import type { TimelineEvent, Mitigation, PartyMember, AppliedMitigation, LocalizedString, Phase, Label } from '../../types';

/*
 * 窓の開閉と編集の操作(クリック・保存・削除・軽減選択・ジョブ変更)。Timeline 本体から移したもの。
 * 本体では途中に useTimelineSheetTap が挟まっていたため、呼び出し順を保つよう元の位置ごとに 2 つのフックへ割っている。
 * 本体では元と同じ位置で呼ぶこと(useStableCallback の layout effect・mobile:close-miti-flow の effect の相対順を保つ)。
 * 閲覧専用(readOnlyRef)のガードは各ハンドラの先頭にそのまま残している。
 */

type Dialogs = ReturnType<typeof useTimelineDialogs>;
type StoreState = ReturnType<typeof useMitigationStore.getState>;

type EventEditingArgs = Pick<Dialogs,
    | 'selectedEvent' | 'setSelectedEvent' | 'setSelectedTime' | 'setEventModalPosition' | 'setIsModalOpen'
    | 'eventPopover' | 'setEventPopover' | 'setConfirmDialog'
    | 'selectedPhase' | 'setSelectedPhase' | 'selectedPhaseTime' | 'setSelectedPhaseTime'
    | 'setPhaseModalPosition' | 'setIsPhaseModalOpen' | 'setPhasePopover'
    | 'selectedLabel' | 'setSelectedLabel' | 'selectedLabelTime' | 'setSelectedLabelTime'
    | 'setLabelModalPosition' | 'setIsLabelModalOpen' | 'setLabelPopover'
> & Pick<StoreState,
    | 'addEvent' | 'updateEvent' | 'removeEvent'
    | 'addPhase' | 'updatePhase' | 'removePhase' | 'updatePhaseStartTime' | 'updatePhaseEndTime'
    | 'addLabel' | 'updateLabel' | 'removeLabel' | 'updateLabelStartTime' | 'updateLabelEndTime'
> & {
    readOnlyRef: RefObject<boolean>;
    isAaModeEnabled: boolean;
    setIsAaModeEnabled: Dispatch<SetStateAction<boolean>>;
    phases: Phase[];
    labels: Label[];
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    timeToYMapRef: RefObject<Map<number, number>>;
    t: TFunction;
};

/** 攻撃・フェーズ・ラベルの追加/編集/保存/削除と、攻撃クリック時のポップオーバー操作 */
export function useTimelineEditing({
    selectedEvent, setSelectedEvent, setSelectedTime, setEventModalPosition, setIsModalOpen,
    eventPopover, setEventPopover, setConfirmDialog,
    selectedPhase, setSelectedPhase, selectedPhaseTime, setSelectedPhaseTime,
    setPhaseModalPosition, setIsPhaseModalOpen, setPhasePopover,
    selectedLabel, setSelectedLabel, selectedLabelTime, setSelectedLabelTime,
    setLabelModalPosition, setIsLabelModalOpen, setLabelPopover,
    addEvent, updateEvent, removeEvent,
    addPhase, updatePhase, removePhase, updatePhaseStartTime, updatePhaseEndTime,
    addLabel, updateLabel, removeLabel, updateLabelStartTime, updateLabelEndTime,
    readOnlyRef, isAaModeEnabled, setIsAaModeEnabled, phases, labels, scrollContainerRef, timeToYMapRef, t,
}: EventEditingArgs) {
    const handleAddClick = useCallback((time: number, e: React.MouseEvent) => {
        // 進捗記録モード中はクリックを横取りして到達点を記録（既存の配置/追加には入らない）
        if (useProgressRecording.getState().recordMode) {
            e.stopPropagation();
            e.preventDefault();
            useProgressRecording.getState().commitReachedPos(time);
            return;
        }
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();

        const currentClipboard = useMitigationStore.getState().clipboardEvent;
        if (currentClipboard) {
            const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
            useMitigationStore.getState().addEvent({
                ...currentClipboard,
                id: generateId(),
                time: time
            });
            return;
        }

        if (isAaModeEnabled) {
            // 同じ秒に何件あっても AA を追加する(旧: 2 件あると AA モードを解除してモーダルを開いていた)
            const currentAaSettings = useMitigationStore.getState().aaSettings;
            const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
            useMitigationStore.getState().addEvent({
                id: newId,
                time: time,
                name: { ja: 'AA', en: 'AA' },
                damageAmount: currentAaSettings.damage,
                damageType: currentAaSettings.type,
                target: currentAaSettings.target
            });
            return;
        }

        setEventModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedTime(time);
        setSelectedEvent(null);
        setIsModalOpen(true);
        useTutorialStore.getState().completeEvent('create:event-modal-opened');
    }, [isAaModeEnabled, readOnlyRef, setEventModalPosition, setIsModalOpen, setSelectedEvent, setSelectedTime]);

    const handlePhaseAdd = useCallback((time: number, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        // このtimeがどのフェーズに属するか判定
        const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
        const ownerPhase = sorted.slice().reverse().find(p => p.startTime <= time);
        if (ownerPhase) {
            // 既存フェーズ内クリック → コンテキストメニュー
            setPhasePopover({ phase: ownerPhase, position: { x: e.clientX, y: e.clientY }, clickTime: time });
        } else {
            // フェーズなし → 直接追加モーダル
            setPhaseModalPosition({ x: e.clientX, y: e.clientY });
            setSelectedPhaseTime(time);
            setSelectedPhase(null);
            setIsPhaseModalOpen(true);
        }
    }, [phases, readOnlyRef, setIsPhaseModalOpen, setPhaseModalPosition, setPhasePopover, setSelectedPhase, setSelectedPhaseTime]);

    const handlePhaseEdit = (phase: Phase, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        setPhaseModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedPhase({ id: phase.id, name: phase.name, startTime: phase.startTime, endTime: phase.endTime });
        setIsPhaseModalOpen(true);
    };

    const handlePhaseSave = (name: LocalizedString, startTime?: number, endTime?: number) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedPhase) {
            updatePhase(selectedPhase.id, name);
            if (startTime !== undefined) {
                updatePhaseStartTime(selectedPhase.id, startTime);
            }
            if (endTime !== undefined) {
                updatePhaseEndTime(selectedPhase.id, endTime);
            }
        } else {
            if (selectedPhaseTime !== undefined) {
                addPhase(selectedPhaseTime, name);
            }
        }
    };

    const handlePhaseDelete = () => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedPhase) {
            removePhase(selectedPhase.id);
            setIsPhaseModalOpen(false);
        }
    };

    // ラベル追加・編集・削除
    const handleLabelAdd = useCallback((time: number, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        const sorted = [...labels].sort((a, b) => a.startTime - b.startTime);
        const ownerLabel = sorted.slice().reverse().find(l => l.startTime <= time);
        if (ownerLabel) {
            setLabelPopover({ label: ownerLabel, position: { x: e.clientX, y: e.clientY }, clickTime: time });
        } else {
            setLabelModalPosition({ x: e.clientX, y: e.clientY });
            setSelectedLabelTime(time);
            setSelectedLabel(null);
            setIsLabelModalOpen(true);
        }
    }, [labels, readOnlyRef, setIsLabelModalOpen, setLabelModalPosition, setLabelPopover, setSelectedLabel, setSelectedLabelTime]);

    const handleLabelEdit = (label: Label, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        setLabelModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedLabel({ id: label.id, name: label.name, startTime: label.startTime, endTime: label.endTime });
        setIsLabelModalOpen(true);
    };

    const handleLabelSave = (name: LocalizedString, startTime?: number, endTime?: number) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedLabel) {
            updateLabel(selectedLabel.id, name);
            if (startTime !== undefined) {
                updateLabelStartTime(selectedLabel.id, startTime);
            }
            if (endTime !== undefined) {
                updateLabelEndTime(selectedLabel.id, endTime);
            }
        } else {
            if (selectedLabelTime !== undefined) {
                addLabel(selectedLabelTime, name);
            }
        }
    };

    const handleLabelDelete = () => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedLabel) {
            removeLabel(selectedLabel.id);
            setIsLabelModalOpen(false);
        }
    };

    const handleEventClick = useCallback((event: TimelineEvent, e: React.MouseEvent) => {
        e.stopPropagation();

        if (isAaModeEnabled) {
            setIsAaModeEnabled(false);
        }

        setEventPopover({ event, position: { x: e.clientX, y: e.clientY } });
    }, [isAaModeEnabled, setEventPopover, setIsAaModeEnabled]);

    const handlePopoverEdit = () => {
        if (!eventPopover) return;
        const { event, position } = eventPopover;
        setEventPopover(null);
        setEventModalPosition(position);
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const handlePopoverAdd = () => {
        if (!eventPopover) return;
        const { event, position } = eventPopover;
        setEventPopover(null);
        setEventModalPosition(position);
        setSelectedTime(event.time);
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handlePopoverDelete = () => {
        if (!eventPopover) return;
        const event = eventPopover.event;
        setEventPopover(null);
        setConfirmDialog({
            title: t('timeline.event_delete'),
            message: t('timeline.delete_event_confirm'),
            variant: 'danger',
            onConfirm: () => {
                removeEvent(event.id);
                setConfirmDialog(null);
            },
        });
    };

    const handleSave = (eventData: Omit<TimelineEvent, 'id'>) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        const generateId = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'evt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        };

        const newId = generateId();

        if (selectedEvent) {
            updateEvent(selectedEvent.id, eventData);
        } else {
            addEvent({
                ...eventData,
                id: newId,
            });
        }
        setIsModalOpen(false);

        setTimeout(() => {
            if (scrollContainerRef.current) {
                const targetY = timeToYMapRef.current.get(eventData.time);
                if (targetY !== undefined) {
                    scrollContainerRef.current.scrollTo({
                        top: targetY,
                        behavior: 'smooth'
                    });
                }
            }
        }, 100);
    };

    const handleDelete = () => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedEvent) {
            setConfirmDialog({
                title: t('timeline.event_delete'),
                message: t('timeline.delete_event_confirm'),
                variant: 'danger',
                onConfirm: () => {
                    removeEvent(selectedEvent.id);
                    setIsModalOpen(false);
                    setConfirmDialog(null);
                },
            });
        }
    };

    return {
        handleAddClick, handlePhaseAdd, handlePhaseEdit, handlePhaseSave, handlePhaseDelete,
        handleLabelAdd, handleLabelEdit, handleLabelSave, handleLabelDelete,
        handleEventClick, handlePopoverEdit, handlePopoverAdd, handlePopoverDelete,
        handleSave, handleDelete,
    };
}

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
