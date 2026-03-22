import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedPlan } from '../types';
import type { TemplateData } from '../data/templateLoader';
import type { PlanData } from '../types';

interface PlanState {
    plans: SavedPlan[];
    currentPlanId: string | null;
    lastActivePlanId: string | null;

    // Actions
    addPlan: (plan: SavedPlan) => void;
    updatePlan: (id: string, data: Partial<SavedPlan>) => void;
    deletePlan: (id: string) => void;
    setCurrentPlanId: (id: string | null) => void;
    getPlan: (id: string) => SavedPlan | undefined;
    createPlanFromTemplate: (contentId: string, templateData: TemplateData, title: string, initialData: PlanData) => SavedPlan;
}

export const usePlanStore = create<PlanState>()(
    persist(
        (set, get) => ({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,

            addPlan: (plan) => set((state) => ({
                plans: [plan, ...state.plans]
            })),

            updatePlan: (id, data) => set((state) => ({
                plans: state.plans.map((p) => (p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p))
            })),

            deletePlan: (id) => set((state) => ({
                plans: state.plans.filter((p) => p.id !== id),
                currentPlanId: state.currentPlanId === id ? null : state.currentPlanId,
                lastActivePlanId: state.lastActivePlanId === id ? null : state.lastActivePlanId
            })),

            setCurrentPlanId: (id) => set({ 
                currentPlanId: id,
                ...(id ? { lastActivePlanId: id } : {})
            }),

            getPlan: (id: string) => get().plans.find((p) => p.id === id),

            createPlanFromTemplate: (contentId, templateData, title, initialData) => {
                const newPlanId = `plan_${Date.now()}`;
                const newPlan: SavedPlan = {
                    id: newPlanId,
                    ownerId: 'local',
                    ownerDisplayName: 'Guest',
                    contentId: contentId,
                    title: title,
                    isPublic: false,
                    copyCount: 0,
                    useCount: 0,
                    data: {
                        ...initialData,
                        timelineEvents: [...templateData.timelineEvents],
                        phases: templateData.phases ? templateData.phases
                            .filter(p => p.startTimeSec >= 0) // 戦闘開始前のフェーズを除外
                            .map((p, i, arr) => {
                            // endTime = 次のフェーズの開始時刻。最後のフェーズはタイムラインの最大時刻
                            const nextStart = arr[i + 1]?.startTimeSec;
                            const maxTime = Math.max(...templateData.timelineEvents.map(e => e.time), 0);
                            return {
                                id: `phase_${p.id}`,
                                name: p.name ? `Phase ${i + 1}\n${p.name}` : `Phase ${i + 1}`,
                                endTime: nextStart !== undefined ? nextStart : maxTime + 10
                            };
                        }) : [],
                    },
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                get().addPlan(newPlan);
                get().setCurrentPlanId(newPlanId);
                return newPlan;
            },
        }),
        {
            name: 'plan-storage',
            version: 1,
        }
    )
);
