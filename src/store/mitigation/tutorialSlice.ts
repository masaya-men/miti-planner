import type { PartyMember } from '../../types';
import { calculateMemberValues } from '../../utils/calculator';
import type { TutorialSnapshot, MitigationState, SliceContext } from './types';
import { INITIAL_PARTY } from './partyDefaults';

export const createTutorialSlice = ({ set, get }: SliceContext): Pick<MitigationState,
    'resetForTutorial' | 'restoreFromSnapshot'
> => ({
    resetForTutorial: () => {
        // 共同編集中は全消しさせない(チュートリアルは collab ルームでは到達しないが安全側で防ぐ)。
        if (get()._collabActive) return;
        const maxLevel = 100;
        const freshMembers = INITIAL_PARTY.map(m => ({
            ...m,
            computedValues: calculateMemberValues(m, maxLevel)
        }));
        set({
            currentLevel: maxLevel,
            timelineEvents: [],
            timelineMitigations: [],
            phases: [],
            labels: [],
            partyMembers: freshMembers,
            myMemberId: null,
            myJobHighlight: false,
            hideEmptyRows: true,
            hiddenPartyMemberIds: [],
            timelineSortOrder: 'light_party',
            memos: [],
            // 進捗トラッキング: リセット時もデフォルト値に戻す
            progress: { points: [], cleared: false },
            toolMode: 'idle',
            _history: [],
            _future: [],
            // 根治(I-1): どの表も載っていない状態なので持ち主を断つ。
            // stale な _loadedPlanId への幽霊保存(ログアウト/全消し後)を防ぐ。
            _loadedPlanId: null,
        });
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tutorial:reset-ui'));
        }
    },

    restoreFromSnapshot: (snapshot: TutorialSnapshot) => {
        // ②-b-2: 共同編集中は部屋の seed が唯一の正。チュートリアル復元で無言 desync させない。
        if (get()._collabActive) return;
        const currentLevel = get().currentLevel;
        const membersWithComputed = snapshot.partyMembers.map((m: PartyMember) => ({
            ...m,
            computedValues: calculateMemberValues(m, currentLevel)
        }));
        set({
            timelineEvents: snapshot.timelineEvents,
            timelineMitigations: snapshot.timelineMitigations,
            phases: snapshot.phases,
            labels: snapshot.labels,
            partyMembers: membersWithComputed,
            myMemberId: snapshot.myMemberId,
            myJobHighlight: snapshot.myJobHighlight,
            hideEmptyRows: snapshot.hideEmptyRows,
            hiddenPartyMemberIds: [],
            timelineSortOrder: 'light_party',
            _history: [],
            _future: [],
        });
    },
});
