import type { PlanData } from '../../types';
import { PLAN_LIMITS } from '../../types/firebase';
import { compressPlanData, decompressPlanData } from '../../utils/compression';
import type { PlanState, PlanSliceContext } from './types';

export const createArchiveSlice = ({ set, get }: PlanSliceContext): Pick<
    PlanState,
    | 'archivePlan'
    | 'archivePlans'
    | 'decompressArchivedPlan'
    | 'recompressStaleArchives'
    | 'silentCompressStale'
> => ({
    /**
     * 指定プランをアーカイブ（gzip圧縮してdataをcompressedDataに置き換え）
     */
    archivePlan: async (id) => {
        const plan = get().plans.find(p => p.id === id);
        if (!plan || plan.archived) return;
        const compressed = await compressPlanData(plan.data);
        set((state) => ({
            plans: state.plans.map(p =>
                p.id === id
                    ? { ...p, archived: true, compressedData: compressed, data: undefined as unknown as PlanData }
                    : p
            ),
            _dirtyPlanIds: new Set([...state._dirtyPlanIds, id]),
        }));
    },

    /**
     * 複数プランを順番にアーカイブ
     */
    archivePlans: async (ids) => {
        for (const id of ids) {
            await get().archivePlan(id);
        }
    },

    /**
     * アーカイブ済みプランのcompressedDataを解凍して返す
     * プラン自体のstateは変更しない
     */
    decompressArchivedPlan: async (id) => {
        const plan = get().plans.find(p => p.id === id);
        if (!plan) return null;
        // dataが既に展開されていればそのまま返す
        if (plan.data && Object.keys(plan.data).length > 0) return plan.data;
        if (!plan.compressedData) return null;
        return decompressPlanData(plan.compressedData);
    },

    /**
     * archived済みなのにdataが残っているプランを検知して再圧縮
     */
    recompressStaleArchives: async () => {
        const stale = get().plans.filter(p =>
            p.archived && p.data && Object.keys(p.data).length > 0
        );
        for (const plan of stale) {
            await get().archivePlan(plan.id);
        }
    },

    /**
     * 7日以上開かれていない非アーカイブプランをサイレント圧縮
     * archived フラグは変更しない（タブ移動しない）
     */
    silentCompressStale: async () => {
        const { getStalePlanIds } = await import('../../utils/lastOpenedStore');
        const plans = get().plans;
        const candidates = plans.filter(p =>
            !p.archived &&
            p.data && Object.keys(p.data).length > 0
        );
        if (candidates.length === 0) return;

        const staleIds = getStalePlanIds(
            candidates.map(p => p.id),
            PLAN_LIMITS.SILENT_COMPRESS_AFTER_DAYS
        );
        if (staleIds.length === 0) return;

        for (const id of staleIds) {
            const plan = get().plans.find(p => p.id === id);
            if (!plan || !plan.data) continue;
            const compressed = await compressPlanData(plan.data);
            set((state) => ({
                plans: state.plans.map(p =>
                    p.id === id
                        ? { ...p, compressedData: compressed, data: undefined as unknown as PlanData }
                        : p
                ),
                _dirtyPlanIds: new Set([...state._dirtyPlanIds, id]),
            }));
        }
    },
});
