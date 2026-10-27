import { calculateMemberValues } from '../../utils/calculator';
import type { MitigationState, SliceContext } from './types';
import { computeDefaultStatsMembers } from './partyDefaults';
import { computeSetMemberJob, memberJobBatchOps, computeChangeMemberJobWithMitigations, computeUpdatePartyBulk } from './partyCompute';

export const createPartySlice = ({ set, get, pushHistory }: SliceContext): Pick<MitigationState,
    'setCurrentLevel' | 'applyDefaultStats' | 'setMemberJob' | 'changeMemberJobWithMitigations' | 'updatePartyBulk' | 'updateMemberStats' | 'setAaSettings' | 'setSchAetherflowPattern' | 'initializeParty'
> => ({
    setCurrentLevel: (level) => {
        const prevState = get();
        // レベルが変わる場合のみ処理
        if (prevState.currentLevel === level) return;

        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            // level のみ Y へ。computedValues は _applyMetaFromCollab がローカル再計算する
            // (partyMembers 配列自体は b-1 で同期しない)。
            get()._collabHandlers!.setMeta('currentLevel', level);
            return;
        }
        pushHistory();
        set((state) => ({
            currentLevel: level,
            partyMembers: state.partyMembers.map(m => ({
                ...m,
                computedValues: calculateMemberValues(m, level)
            }))
        }));
    },
    applyDefaultStats: (level, patch) => {
        // ②-b-2: 全メンバーの stats 一括更新を partyMembers に upsert(mitigations 波及なし)。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.upsertItems('partyMembers', computeDefaultStatsMembers(get().partyMembers, level, patch));
            return;
        }
        pushHistory();
        set((state) => ({ partyMembers: computeDefaultStatsMembers(state.partyMembers, level, patch) }));
    },
    setMemberJob: (memberId, jobId) => {
        // ②-b-2: ジョブ変更カスケード(メンバー + その mitigations)を 1 batch で原子的に委譲。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const next = computeSetMemberJob(get(), memberId, jobId);
            get()._collabHandlers!.batch(memberJobBatchOps(get().timelineMitigations, memberId, next));
            return;
        }
        pushHistory();
        set((state) => computeSetMemberJob(state, memberId, jobId));
        // Tutorial: detect if 4 or 8 members are set
        // (チュートリアルイベント削除済み: party:eight-set / party:four-set)
    },

    changeMemberJobWithMitigations: (memberId, jobId, mitis) => {
        // ②-b-2: ジョブ変更 + その mitigations 上書きを 1 batch で原子的に委譲。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const next = computeChangeMemberJobWithMitigations(get(), memberId, jobId, mitis);
            get()._collabHandlers!.batch(memberJobBatchOps(get().timelineMitigations, memberId, next));
            return;
        }
        pushHistory();
        set((state) => computeChangeMemberJobWithMitigations(state, memberId, jobId, mitis));
    },

    updatePartyBulk: (updates) => {
        // ②-b-2: 複数メンバーのジョブ/mitigations 一括変更を 1 batch で(members upsert + mitigations 全置換)。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const next = computeUpdatePartyBulk(get(), updates);
            const updatedIds = new Set(updates.map(u => u.memberId));
            const changedMembers = next.partyMembers.filter(m => updatedIds.has(m.id));
            get()._collabHandlers!.batch([
                { kind: 'upsert', key: 'partyMembers', items: changedMembers },
                { kind: 'replace', key: 'timelineMitigations', items: next.timelineMitigations },
            ]);
            return;
        }
        pushHistory();
        set((state) => computeUpdatePartyBulk(state, updates));
        // (チュートリアルイベント削除済み: party:eight-set / party:four-set)
    },

    updateMemberStats: (memberId, stats) => {
        // ②-b-2: 1 メンバーの stats 更新を partyMembers に upsert(mitigations 波及なし)。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const m = get().partyMembers.find((x) => x.id === memberId);
            if (!m) return;
            const newStats = { ...m.stats, ...stats };
            const updated = { ...m, stats: newStats, computedValues: calculateMemberValues({ ...m, stats: newStats }, get().currentLevel) };
            get()._collabHandlers!.upsertItems('partyMembers', [updated]);
            return;
        }
        pushHistory();
        set((state) => ({
            partyMembers: state.partyMembers.map(m => {
                if (m.id === memberId) {
                    const newStats = { ...m.stats, ...stats };
                    const computedValues = calculateMemberValues({ ...m, stats: newStats }, state.currentLevel);
                    return { ...m, stats: newStats, computedValues };
                }
                return m;
            })
        }));
    },

    setAaSettings: (settings) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.setMeta('aaSettings', settings);
            return;
        }
        set({ aaSettings: settings });
    },
    setSchAetherflowPattern: (memberId, pattern) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const h = get()._collabHandlers!;
            // 1. パターン値を planMeta に反映
            h.setMeta('schAetherflowPatterns', { ...get().schAetherflowPatterns, [memberId]: pattern });
            // 2. 既存の自動転化(time<=15)を削除し、新パターンの転化を配置(②-a mitigation 経路)
            get().timelineMitigations
                .filter(m => m.mitigationId === 'dissipation' && m.ownerId === memberId && m.time <= 15)
                .forEach(m => h.remove(m.id));
            h.add({
                id: crypto.randomUUID(),
                mitigationId: 'dissipation',
                ownerId: memberId,
                time: pattern === 1 ? 1 : 14,
                duration: 30,
            });
            return;
        }
        pushHistory();
        set((state) => {
            // Remove any existing dissipation for this member that might have been the previous auto-inserted one
            const existingMitigations = state.timelineMitigations.filter(
                m => !(m.mitigationId === 'dissipation' && m.ownerId === memberId && m.time <= 15)
            );

            const newDissipation = {
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
                mitigationId: 'dissipation',
                ownerId: memberId,
                time: pattern === 1 ? 1 : 14,
                duration: 30
            };

            return {
                schAetherflowPatterns: { ...state.schAetherflowPatterns, [memberId]: pattern },
                timelineMitigations: [...existingMitigations, newDissipation]
            };
        });
    },

    initializeParty: () => {
        // Handled in initial state
    },
});
