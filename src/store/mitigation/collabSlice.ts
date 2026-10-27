import { makeProgressPointId } from '../../lib/progressLogic';
import { calculateMemberValues } from '../../utils/calculator';
import { getMitigationsFromStore } from '../../hooks/useSkillsData';
import type { MitigationState, SliceContext } from './types';
import { resolveShieldLinks } from './shieldLinks';

export const createCollabSlice = ({ set }: SliceContext): Pick<MitigationState,
    '_setCollabUndoRedo' | 'setCollabReadonly' | 'setLoadedPlanId' | 'enterCollabMode' | 'exitCollabMode' | '_applyMitigationsFromCollab' | '_applyEventsFromCollab' | '_applyPhasesFromCollab' | '_applyLabelsFromCollab' | '_applyMemosFromCollab' | '_applyProgressPointsFromCollab' | '_applyPartyMembersFromCollab' | '_applyMetaFromCollab'
> => ({
    _setCollabUndoRedo: (canUndo, canRedo) => set({ _collabCanUndo: canUndo, _collabCanRedo: canRedo }),
    setCollabReadonly: (v) => set({ _collabReadonly: v }),
    setLoadedPlanId: (id) => set({ _loadedPlanId: id }),

    // collab 入室時に solo 履歴を持ち込まない(collab 中は CRDT undo が真実)。
    // hiddenPartyMemberIds/timelineSortOrder も、自分のプランでいじった設定が
    // 無関係な部屋にまで持ち込まれる不具合だったため入室のたびにリセットする(2026-08-26)。
    enterCollabMode: (handlers) => set({ _collabActive: true, _collabHandlers: handlers, _history: [], _future: [], hiddenPartyMemberIds: [], timelineSortOrder: 'light_party' }),

    // collab 退出時も _history/_future をクリア。revoke/手動 disconnect 後の Ctrl+Z で
    // 入室前データへ巻き戻り→Firestore 恒久上書きする経路を塞ぐ(canUndo=false 化)。
    exitCollabMode: () => set({ _collabActive: false, _collabHandlers: null, _collabCanUndo: false, _collabCanRedo: false, _history: [], _future: [] }),

    // 遅延チャンク(collabProvider)の observeDeep から呼ばれる。Yjs 側の最新軽減配列を
    // store に反映。盾連鎖(linkedMitigationId/duration)は派生再計算する。
    // pushHistory は呼ばない(共同編集の反映は undo 履歴に積まない。Undo の CRDT 化は②-c)。
    _applyMitigationsFromCollab: (mitigations) =>
        set({ timelineMitigations: resolveShieldLinks(mitigations, getMitigationsFromStore()) }),

    // ②-b-1: 各要素の Yjs → store 反映(pushHistory なし)。配列は表示順にソートして反映。
    _applyEventsFromCollab: (events) =>
        set({ timelineEvents: [...events].sort((a, b) => a.time - b.time) }),
    _applyPhasesFromCollab: (phases) =>
        set({ phases: [...phases].sort((a, b) => a.startTime - b.startTime) }),
    _applyLabelsFromCollab: (labels) =>
        set({ labels: [...labels].sort((a, b) => a.startTime - b.startTime) }),
    _applyMemosFromCollab: (memos) => set({ memos }),
    _applyProgressPointsFromCollab: (points) =>
        set((state) => ({
            progress: {
                ...state.progress,
                // 旧形式(id 欠落)の点に id を補完する防御(api 側で補完済みが本線だが、
                // 既に id なしで Yjs に入っている在室中の部屋への保険)。
                points: points.map((p) => (p && p.id ? p : { ...p, id: makeProgressPointId() })),
            },
        })),
    _applyPartyMembersFromCollab: (members) =>
        set((state) => ({
            partyMembers: members.map((m) => ({
                ...m,
                computedValues: calculateMemberValues(m, state.currentLevel),
            })),
        })),
    _applyMetaFromCollab: (meta) =>
        set((state) => {
            const patch: Partial<MitigationState> = {};
            if (meta.aaSettings !== undefined) patch.aaSettings = meta.aaSettings;
            if (meta.schAetherflowPatterns !== undefined) patch.schAetherflowPatterns = meta.schAetherflowPatterns;
            // 進捗スカラー(cleared/activeDays/activeHours)を progress に反映。
            if (meta.progressCleared !== undefined || meta.progressActiveDays !== undefined || meta.progressActiveHours !== undefined) {
                patch.progress = {
                    ...state.progress,
                    ...(meta.progressCleared !== undefined ? { cleared: meta.progressCleared } : {}),
                    ...(meta.progressActiveDays !== undefined ? { activeDays: meta.progressActiveDays } : {}),
                    ...(meta.progressActiveHours !== undefined ? { activeHours: meta.progressActiveHours } : {}),
                };
            }
            if (meta.currentLevel !== undefined) {
                patch.currentLevel = meta.currentLevel;
                // computedValues は派生 → ローカル再計算(partyMembers は ②-b-2 で Y 同期済み、ここでは state を読む)。
                patch.partyMembers = state.partyMembers.map((mem) => ({
                    ...mem,
                    computedValues: calculateMemberValues(mem, meta.currentLevel!),
                }));
            }
            return patch;
        }),
});
