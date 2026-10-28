import { useCallback } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useProgressRecording } from '../progress/useProgressRecording';
import type { useTimelineDialogs } from './useTimelineDialogs';
import type { TimelineEvent, LocalizedString, Phase, Label } from '../../types';

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
