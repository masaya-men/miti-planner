import { useShallow } from 'zustand/react/shallow';
import { useMitigationStore } from '../../store/useMitigationStore';

/** Timeline が軽減表の store から読む値と操作。購読の単位(どれが変わったら再描画するか)は元のまま。 */
export function useTimelineStoreBindings() {
    // データ（useShallowで浅い比較 → 値が変わったときだけ再レンダー）
    const {
        aaSettings, partyMembers,
        timelineMitigations, timelineEvents, phases,
        clipboardEvent, hideEmptyRows, currentLevel, showRowBorders: laneRowBorders, sheetRowBorders,
        hiddenPartyMemberIds,
    } = useMitigationStore(useShallow(s => ({
        aaSettings: s.aaSettings,
        partyMembers: s.partyMembers,
        timelineMitigations: s.timelineMitigations,
        timelineEvents: s.timelineEvents,
        phases: s.phases,
        clipboardEvent: s.clipboardEvent,
        hideEmptyRows: s.hideEmptyRows,
        currentLevel: s.currentLevel,
        showRowBorders: s.showRowBorders,
        sheetRowBorders: s.sheetRowBorders,
        hiddenPartyMemberIds: s.hiddenPartyMemberIds,
    })));
    const partySortOrder = useMitigationStore(s => s.timelineSortOrder);
    // ジョイナー閲覧/編集中フラグ。モバイルで currentPlanId が無くても表を隠さないために参照する
    // (本体アプリでは常に false ＝ 影響なし。true になるのは /collab ジョイナーのみ)。
    const collabReadonly = useMitigationStore(s => s._collabReadonly);
    // Undo/Redo可否（リアクティブに監視して disabled 状態を正しく反映する）
    // 共同編集中は Y.UndoManager の可否(_collabCanUndo/Redo)、それ以外はローカル履歴を見る(②-c)。
    const canUndo = useMitigationStore(s => s._collabActive ? s._collabCanUndo : s._history.length > 0);
    const canRedo = useMitigationStore(s => s._collabActive ? s._collabCanRedo : s._future.length > 0);
    // メモモード
    const toolMode = useMitigationStore(s => s.toolMode);
    const memos = useMitigationStore(s => s.memos);
    // アクション（参照安定・再レンダー不発火）
    const addEvent = useMitigationStore(s => s.addEvent);
    const updateEvent = useMitigationStore(s => s.updateEvent);
    const removeEvent = useMitigationStore(s => s.removeEvent);
    const addMitigation = useMitigationStore(s => s.addMitigation);
    const setMemberJob = useMitigationStore(s => s.setMemberJob);
    const setAaSettings = useMitigationStore(s => s.setAaSettings);
    const removeMitigation = useMitigationStore(s => s.removeMitigation);
    const updateMitigationTime = useMitigationStore(s => s.updateMitigationTime);
    const addPhase = useMitigationStore(s => s.addPhase);
    const updatePhase = useMitigationStore(s => s.updatePhase);
    const removePhase = useMitigationStore(s => s.removePhase);
    const updatePhaseEndTime = useMitigationStore(s => s.updatePhaseEndTime);
    const updatePhaseStartTime = useMitigationStore(s => s.updatePhaseStartTime);
    const labels = useMitigationStore(s => s.labels);
    const addLabel = useMitigationStore(s => s.addLabel);
    const updateLabel = useMitigationStore(s => s.updateLabel);
    const removeLabel = useMitigationStore(s => s.removeLabel);
    const updateLabelEndTime = useMitigationStore(s => s.updateLabelEndTime);
    const updateLabelStartTime = useMitigationStore(s => s.updateLabelStartTime);
    const changeMemberJobWithMitigations = useMitigationStore(s => s.changeMemberJobWithMitigations);
    const setClipboardEvent = useMitigationStore(s => s.setClipboardEvent);
    // 「置いた時は既存の相手だけ光る」: 直前に手動配置したインスタンスは脈動/矢印から除外する。
    // リロードで null に戻るため、開き直した時は既存競合が両方光る(自己責任)。
    const lastPlacedMitigationId = useMitigationStore(s => s.lastPlacedMitigationId);

    return {
        aaSettings, partyMembers, timelineMitigations, timelineEvents, phases,
        clipboardEvent, hideEmptyRows, currentLevel, laneRowBorders, sheetRowBorders, hiddenPartyMemberIds,
        partySortOrder, collabReadonly, canUndo, canRedo, toolMode, memos,
        addEvent, updateEvent, removeEvent, addMitigation, setMemberJob, setAaSettings, removeMitigation, updateMitigationTime,
        addPhase, updatePhase, removePhase, updatePhaseEndTime, updatePhaseStartTime,
        labels, addLabel, updateLabel, removeLabel, updateLabelEndTime, updateLabelStartTime,
        changeMemberJobWithMitigations, setClipboardEvent, lastPlacedMitigationId,
    };
}
