import { buildAetherflowChainFrom } from '../../utils/scholarAutoInsert';
import { buildAstrologianDrawChainFrom } from '../../utils/astrologianAutoInsert';
import { getMitigationsFromStore } from '../../hooks/useSkillsData';
import { completeTutorialEvent } from '../tutorialBridge';
import type { MitigationState, SliceContext } from './types';
import { computeApplyAutoPlan } from './partyCompute';
import { resolveShieldLinks } from './shieldLinks';

export const createMitigationSlice = ({ set, get, pushHistory }: SliceContext): Pick<MitigationState,
    'clearMitigationsByMember' | 'clearAllMitigations' | 'applyAutoPlan' | 'dismissAetherflowChainPrompt' | 'confirmAetherflowChain' | 'dismissAstrologianDrawChainPrompt' | 'confirmAstrologianDrawChain' | 'addMitigation' | 'removeMitigation' | 'updateMitigationTime'
> => ({
    // Bulk delete: clear mitigations for a specific member
    clearMitigationsByMember: (memberId) => {
        // ②-b-2: 当該メンバーの mitigations を removeItems で除去。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const ids = get().timelineMitigations.filter(m => m.ownerId === memberId).map(m => m.id);
            get()._collabHandlers!.removeItems('timelineMitigations', ids);
            return;
        }
        pushHistory();
        set((state) => ({
            timelineMitigations: state.timelineMitigations.filter(m => m.ownerId !== memberId)
        }));
    },

    // Bulk delete: clear ALL mitigations
    clearAllMitigations: () => {
        // ②-b-2: timelineMitigations を全置換([])で原子的にクリア。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.batch([{ kind: 'replace', key: 'timelineMitigations', items: [] }]);
            return;
        }
        pushHistory();
        set({ timelineMitigations: [] });
    },

    // 👇追加：オートプラン用の一括上書き処理（履歴はここで「1回」だけ保存される）
    applyAutoPlan: ({ mitigations, warnings }) => {
        // ②-b-2: 最終 mitigations 全置換 + warning 更新後 events を 1 batch で原子的に。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const next = computeApplyAutoPlan(get(), mitigations, warnings);
            get()._collabHandlers!.batch([
                { kind: 'replace', key: 'timelineMitigations', items: next.timelineMitigations },
                { kind: 'upsert', key: 'timelineEvents', items: next.timelineEvents.map(e => ({ id: e.id, warning: e.warning })) },
            ]);
            return;
        }
        pushHistory();
        set(state => computeApplyAutoPlan(state, mitigations, warnings));
    },
    dismissAetherflowChainPrompt: () => set({ aetherflowChainPrompt: null }),

    confirmAetherflowChain: () => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者のみブロック
        const state = get();
        if (!state.aetherflowChainPrompt) return;
        const { memberId, startTime } = state.aetherflowChainPrompt;
        if (state._collabActive && state._collabHandlers) {
            // 共同編集中: 連鎖を計算して Yjs へ委譲(observeDeep→_applyMitigationsFromCollab で反映)。
            // pushHistory は collab では使わない(CRDT undo が真実)。プロンプト解除はローカル UI 状態。
            const chain = buildAetherflowChainFrom(memberId, startTime, state.timelineMitigations, state.timelineEvents);
            state._collabHandlers.upsertItems('timelineMitigations', chain);
            set({ aetherflowChainPrompt: null });
            return;
        }
        pushHistory();
        set((s) => {
            const chain = buildAetherflowChainFrom(memberId, startTime, s.timelineMitigations, s.timelineEvents);
            return {
                timelineMitigations: [...s.timelineMitigations, ...chain],
                aetherflowChainPrompt: null,
            };
        });
    },

    dismissAstrologianDrawChainPrompt: () => set({ astrologianDrawChainPrompt: null }),

    confirmAstrologianDrawChain: () => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者のみブロック
        const state = get();
        if (!state.astrologianDrawChainPrompt) return;
        const { memberId, startTime, startKind } = state.astrologianDrawChainPrompt;
        if (state._collabActive && state._collabHandlers) {
            const chain = buildAstrologianDrawChainFrom(memberId, startTime, startKind, state.timelineMitigations, state.timelineEvents);
            state._collabHandlers.upsertItems('timelineMitigations', chain);
            set({ astrologianDrawChainPrompt: null });
            return;
        }
        pushHistory();
        set((s) => {
            const chain = buildAstrologianDrawChainFrom(memberId, startTime, startKind, s.timelineMitigations, s.timelineEvents);
            return {
                timelineMitigations: [...s.timelineMitigations, ...chain],
                astrologianDrawChainPrompt: null,
            };
        });
    },
    addMitigation: (mitigation) => {
        // 競合表示: ユーザーが今置いたインスタンスを記録(自動配置 autoHidden は除外)。
        // この id は脈動/矢印から除外され「既存の相手だけ光る」を実現する。
        if (!mitigation.autoHidden) {
            set({ lastPlacedMitigationId: mitigation.id });
        }
        // 共同編集中: Yjs へ委譲(セラフィム cascade 等は handlers 実装側で Y 操作)。
        // timelineMitigations は handler→observeDeep→_applyMitigationsFromCollab 経由で更新。
        // プロンプト等の UI 一時状態はローカルに反映(yjs 非依存)。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            if (mitigation.mitigationId === 'aetherflow') {
                set({ aetherflowChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time } });
            }
            const isManualDraw = !mitigation.autoHidden &&
                (mitigation.mitigationId === 'astral_draw' || mitigation.mitigationId === 'umbral_draw');
            if (isManualDraw) {
                set({ astrologianDrawChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time, startKind: mitigation.mitigationId as 'astral_draw' | 'umbral_draw' } });
            }
            get()._collabHandlers!.add(mitigation);
            completeTutorialEvent('mitigation:added');
            return;
        }
        pushHistory();
        set((state) => {
            let currentMitigations = [...state.timelineMitigations];

            // 副作用：サモン・セラフィムを配置した場合、重複する同一学者の「転化」を削除する
            if (mitigation.mitigationId === 'summon_seraph') {
                const seraphDuration = 22;
                const seraphStart = mitigation.time;
                const seraphEnd = seraphStart + seraphDuration;

                currentMitigations = currentMitigations.filter(m => {
                    if (m.mitigationId === 'dissipation' && m.ownerId === mitigation.ownerId) {
                        const dissStart = m.time;
                        const dissEnd = m.time + m.duration;
                        // 重複判定
                        return (dissEnd <= seraphStart || dissStart >= seraphEnd);
                    }
                    return true;
                });
            }

            const newMitigations = [...currentMitigations, mitigation];

            // 手動で aetherflow を置いたときは「リキャストごと配置」確認プロンプトを表示
            const aetherflowPromptPatch = mitigation.mitigationId === 'aetherflow'
                ? { aetherflowChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time } }
                : {};

            // 手動で astral_draw / umbral_draw を置いたときは「以降 60s 毎に交互配置」確認プロンプトを表示
            // ただし autoHidden (戦闘前 t=-3 の自動配置) はユーザー操作ではないのでトリガーしない
            const isManualDraw = !mitigation.autoHidden &&
                (mitigation.mitigationId === 'astral_draw' || mitigation.mitigationId === 'umbral_draw');
            const astrologianPromptPatch = isManualDraw
                ? {
                    astrologianDrawChainPrompt: {
                        memberId: mitigation.ownerId,
                        startTime: mitigation.time,
                        startKind: mitigation.mitigationId as 'astral_draw' | 'umbral_draw',
                    },
                }
                : {};

            return {
                timelineMitigations: resolveShieldLinks(newMitigations, getMitigationsFromStore()),
                ...aetherflowPromptPatch,
                ...astrologianPromptPatch,
            };
        });
        // Tutorial: notify that a mitigation has been added
        completeTutorialEvent('mitigation:added');
    },

    removeMitigation: (id) => {
        // 共同編集中: Yjs へ委譲(requires 依存削除等は handlers 実装側で Y 操作)。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.remove(id);
            return;
        }
        pushHistory();
        set((state) => {
            const removed = state.timelineMitigations.find(m => m.id === id);
            if (!removed) return { timelineMitigations: resolveShieldLinks(state.timelineMitigations.filter(m => m.id !== id), getMitigationsFromStore()) };

            const removedDef = getMitigationsFromStore().find(d => d.id === removed.mitigationId);
            if (!removedDef) return { timelineMitigations: resolveShieldLinks(state.timelineMitigations.filter(m => m.id !== id), getMitigationsFromStore()) };

            // requires チェックは ID 比較のみで Mitigation の値（value/recast 等）を読まないため、
            // モード解決不要。詳細は spec 参照。
            // Find skills that depend on the removed skill
            const dependentIds = getMitigationsFromStore().filter(d => d.requires === removed.mitigationId).map(d => d.id);

            const removedStart = removed.time;
            const removedEnd = removed.time + removed.duration;

            const filtered = state.timelineMitigations.filter(m => {
                if (m.id === id) return false; // Remove the target itself
                // Remove dependents that overlap the removed skill's window
                if (dependentIds.includes(m.mitigationId) && m.ownerId === removed.ownerId) {
                    return !(m.time >= removedStart && m.time < removedEnd);
                }
                return true;
            });
            return {
                timelineMitigations: resolveShieldLinks(filtered, getMitigationsFromStore())
            };
        });
    },

    updateMitigationTime: (id, newTime) => {
        // 競合表示: ドラッグで動かしたインスタンスを「直前に触った1件」として記録。
        // これを脈動/矢印から除外することで、移動先で競合した場合も「既存の相手だけ光る」(配置と統一)。
        set({ lastPlacedMitigationId: id });
        // 共同編集中: Yjs へ委譲(セラフィム cascade 等は handlers 実装側で Y 操作)。
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.updateTime(id, newTime);
            return;
        }
        pushHistory();
        set((state) => {
            let currentMitigations = state.timelineMitigations.map(m =>
                m.id === id ? { ...m, time: newTime } : m
            );

            const moved = currentMitigations.find(m => m.id === id);
            if (moved && moved.mitigationId === 'summon_seraph') {
                const seraphDuration = 22;
                const seraphStart = moved.time;
                const seraphEnd = seraphStart + seraphDuration;

                currentMitigations = currentMitigations.filter(m => {
                    if (m.id === id) return true; // 自分自身は残す
                    if (m.mitigationId === 'dissipation' && m.ownerId === moved.ownerId) {
                        const dissStart = m.time;
                        const dissEnd = m.time + m.duration;
                        // 重複判定
                        return (dissEnd <= seraphStart || dissStart >= seraphEnd);
                    }
                    return true;
                });
            }

            return {
                timelineMitigations: resolveShieldLinks(currentMitigations, getMitigationsFromStore())
            };
        });
    },
});
