import type { SavedPlan } from '../../types';
import { useMitigationStore } from '../useMitigationStore';
import { ensurePhaseEndTimes } from '../../utils/phaseMigration';
import { ensureLabelEndTimes } from '../../utils/labelMigration';
import { setLastOpened } from '../../utils/lastOpenedStore';
import { isEmptyPlanData } from '../../lib/isEmptyPlanData';
import { tagCreationIntent } from './tagCreationIntent';
import type { PlanState, PlanSliceContext } from './types';

export const createPlanCrudSlice = ({ set, get }: PlanSliceContext): Pick<
    PlanState,
    | 'addPlan'
    | 'updatePlan'
    | 'deletePlan'
    | 'setCurrentPlanId'
    | 'getPlan'
    | 'createPlanFromTemplate'
    | 'markDirty'
    | 'hasDirtyPlans'
    | 'setPlans'
> => ({
    addPlan: (plan) => {
        // ownerId='' (空文字) は fetchAndMerge で「別端末で削除」と
        // 誤判定されて localStorage から消える致命バグを起こす。
        // 入口で 'local' に正規化して、どの呼び出し元でも安全に
        const stage1: SavedPlan = plan.ownerId === ''
            ? { ...plan, ownerId: 'local' }
            : plan;
        // 「ログイン中作成」 フラグ付与 (LocalImportDialog 誤発火防止)
        const normalizedPlan = tagCreationIntent(stage1);
        // 新規作成プランの lastOpened を即記録: silentCompressStale が
        // 「未記録 = 7日以上未開封」と誤判定して作成直後の plan.data を
        // 圧縮 (data → undefined / compressedData セット) するのを防ぐ
        setLastOpened(normalizedPlan.id, Date.now());
        set((state) => ({
            plans: [normalizedPlan, ...state.plans],
            _dirtyPlanIds: new Set([...state._dirtyPlanIds, normalizedPlan.id]),
        }));
    },

    updatePlan: (id, data) => {
        set((state) => {
            const existing = state.plans.find((p) => p.id === id);
            let patch = data;
            // 空上書きガード (業界標準: 非空データを空データで上書きしない / hydration gate)。
            // 起動時 desync 等で作業ストアが空になった状態の getSnapshot() が、
            // 本物の非空プランを黙って破壊し Firestore へ伝播するのを root で塞ぐ。
            if (
                existing &&
                'data' in data && data.data &&
                isEmptyPlanData(data.data) &&
                !isEmptyPlanData(existing.data)
            ) {
                 
                const { data: _dropped, ...rest } = data;
                // data 以外に更新が無ければ完全 no-op (version++/dirty を作らない)
                if (Object.keys(rest).length === 0) {
                    if (import.meta.env.DEV) {
                        console.warn('[LoPo] 空上書きガード: 非空プラン', id, 'への空データ保存をブロック');
                    }
                    return state;
                }
                // data フィールドだけ落とし、他フィールド (title 等) は通常どおり適用
                patch = rest;
            }
            return {
                plans: state.plans.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
                _dirtyPlanIds: new Set([...state._dirtyPlanIds, id]),
            };
        });
    },

    deletePlan: (id) => {
        const plan = get().plans.find((p) => p.id === id);
        const wasCurrent = get().currentPlanId === id;
        set((state) => {
            const newDirty = new Set(state._dirtyPlanIds);
            newDirty.delete(id);
            const remaining = state.plans.filter((p) => p.id !== id);
            return {
                plans: remaining,
                // 削除したのが現在のプランなら無選択状態に戻す
                currentPlanId: wasCurrent ? null : state.currentPlanId,
                lastActivePlanId: state.lastActivePlanId === id ? null : state.lastActivePlanId,
                _dirtyPlanIds: newDirty,
                _deletedPlanIds: plan && plan.ownerId !== 'local'
                    ? new Set([...state._deletedPlanIds, id])
                    : state._deletedPlanIds,
            };
        });
        // 削除したのが現在のプランなら、ストアをクリア
        if (wasCurrent) {
            useMitigationStore.getState().resetForTutorial();
        }
    },

    setCurrentPlanId: (id) => set({
        currentPlanId: id,
        ...(id ? { lastActivePlanId: id } : {})
    }),

    getPlan: (id: string) => get().plans.find((p) => p.id === id),

    createPlanFromTemplate: (contentId, templateData, title, initialData) => {
        // ⚠ 現状この action は未使用(呼び出し元なし)。UI から使うときは、作業ストアを
        // 新規プランの内容でロードした上で、必ず lib/commitNewPlan の安全順序
        // (持ち主ID確定 → setCurrentPlanId)を通すこと。ここで setCurrentPlanId を
        // 先に呼ぶと、Layout の plan-switch 保存が直前プランを破壊する(C-1 と同型)。
        // 同一 ms 内の連続呼び出しでも衝突しないよう crypto.randomUUID で確実にユニーク化
        const newPlanId = `plan_${crypto.randomUUID()}`;
        const maxEventTime = templateData.timelineEvents.length > 0
            ? templateData.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
            : undefined;
        // ラベル変換: TemplateData.labels → Label[]
        const labels = templateData.labels
            ? ensureLabelEndTimes(templateData.labels.map(l => ({
                id: crypto.randomUUID(),
                name: l.name,
                startTime: l.startTimeSec,
                ...(l.endTimeSec !== undefined ? { endTime: l.endTimeSec } : {}),
            })), maxEventTime)
            : undefined;
        const newPlan: SavedPlan = {
            id: newPlanId,
            ownerId: 'local',
            ownerDisplayName: 'Guest',
            contentId: contentId,
            title: title,
            isPublic: false,
            data: {
                ...initialData,
                timelineEvents: [...templateData.timelineEvents],
                phases: templateData.phases ? ensurePhaseEndTimes(templateData.phases
                    .filter(p => p.startTimeSec >= 0)
                    .map((p) => ({
                        id: `phase_${p.id}`,
                        name: p.name
                            ? (typeof p.name === 'string'
                                ? { ja: p.name, en: p.name }
                                : {
                                    ja: p.name.ja ?? p.name.en ?? '',
                                    en: p.name.en ?? p.name.ja ?? '',
                                    ...(p.name.zh != null ? { zh: p.name.zh } : {}),
                                    ...(p.name['zh-Hant'] != null ? { 'zh-Hant': p.name['zh-Hant'] } : {}),
                                    ...(p.name.ko != null ? { ko: p.name.ko } : {}),
                                })
                            : { ja: '', en: '' },
                        startTime: p.startTimeSec,
                    })), maxEventTime) : [],
                ...(labels ? { labels } : {}),
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        get().addPlan(newPlan);
        get().setCurrentPlanId(newPlanId);
        return newPlan;
    },

    markDirty: (planId) => set((state) => ({
        _dirtyPlanIds: new Set([...state._dirtyPlanIds, planId]),
    })),

    hasDirtyPlans: () => {
        const state = get();
        return state._dirtyPlanIds.size > 0 || state._deletedPlanIds.size > 0;
    },

    setPlans: (plans) => set({ plans }),
});
