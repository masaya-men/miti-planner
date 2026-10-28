import type { SavedPlan } from '../../types';
import { getTemplate } from '../../data/templateLoader';
import { PLAN_LIMITS } from '../../types/firebase';
import { ensurePhaseEndTimes } from '../../utils/phaseMigration';
import { ensureLabelEndTimes } from '../../utils/labelMigration';
import { generateUniqueTitle } from '../../utils/planTitle';
import { tagCreationIntent } from './tagCreationIntent';
import type { PlanState, PlanSliceContext } from './types';

export const createDuplicateSlice = ({ set, get }: PlanSliceContext): Pick<
    PlanState,
    | 'duplicatePlan'
> => ({
    duplicatePlan: async (planId) => {
        const state = get();
        const source = state.plans.find(p => p.id === planId);
        if (!source) return null;

        // 件数制限チェック
        const totalPlans = state.plans.length;
        if (totalPlans >= PLAN_LIMITS.MAX_TOTAL_PLANS) return null;

        if (source.contentId) {
            const contentPlans = state.plans.filter(p => p.contentId === source.contentId);
            if (contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) return null;
        }

        // 圧縮済みプランはデータを復元してからコピー
        let sourceData = source.data;
        if (!sourceData || Object.keys(sourceData).length === 0) {
            const decompressed = await get().decompressArchivedPlan(planId);
            if (!decompressed) return null;
            sourceData = decompressed;
        }

        // 連番サフィックス生成: "M1S" → "M1S (2)", "M1S (2)" → "M1S (3)"
        // 同コンテンツ内のみで重複判定する
        const newTitle = generateUniqueTitle(source.title, get().plans, source.contentId);

        const newPlan: SavedPlan = {
            ...structuredClone(source),
            id: `plan_${crypto.randomUUID()}`,
            ownerId: 'local',
            ownerDisplayName: 'Guest',
            title: newTitle,
            data: structuredClone(sourceData),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isPublic: false,
            archived: false,
            compressedData: undefined,
            // データ安全(2026-08-08): 複製は独立した新しいプラン。元プランが
            // 共同編集ルームに繋がっていても、複製先まで同じ部屋の「持ち主」を
            // 名乗らせない(reseed信頼境界ガードが誤って信頼してしまうため)。
            activeCollabRoomToken: undefined,
            collabMaxParticipants: undefined,
        };

        // 最新テンプレートでイベント・フェーズ・ラベルを差し替え
        if (source.contentId) {
            try {
                const tpl = await getTemplate(source.contentId);
                if (tpl) {
                    const tplMaxEventTime = tpl.timelineEvents.length > 0
                        ? tpl.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
                        : undefined;
                    newPlan.data = {
                        ...newPlan.data,
                        timelineEvents: [...tpl.timelineEvents],
                        phases: tpl.phases ? ensurePhaseEndTimes(tpl.phases
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
                            })), tplMaxEventTime) : [],
                        labels: tpl.labels
                            ? ensureLabelEndTimes(tpl.labels.map(l => ({
                                id: crypto.randomUUID(),
                                name: l.name,
                                startTime: l.startTimeSec,
                                ...(l.endTimeSec !== undefined ? { endTime: l.endTimeSec } : {}),
                            })), tplMaxEventTime)
                            : newPlan.data.labels,
                    };
                }
            } catch {
                // テンプレート取得失敗時はソースのイベントをそのまま使用
            }
        }

        // 「ログイン中作成」 フラグ付与 (LocalImportDialog 誤発火防止)。
        // duplicatePlan は addPlan を経由しないので、 ここで明示的に helper を呼ぶ必要がある。
        const finalPlan = tagCreationIntent(newPlan);

        // ソースプランの直後に挿入
        const sourceIndex = get().plans.findIndex(p => p.id === planId);
        const newPlans = [...get().plans];
        newPlans.splice(sourceIndex + 1, 0, finalPlan);

        set({
            plans: newPlans,
            _dirtyPlanIds: new Set([...get()._dirtyPlanIds, finalPlan.id]),
        });
        return finalPlan;
    },
});
