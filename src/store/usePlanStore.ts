import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedPlan, ContentLevel } from '../types';
import { getContentById } from '../data/contentRegistry';
import { partializePlanState, mergePersistedPlanState } from './planPersist';
import type { PlanState } from './plan/types';
import { createPlanCrudSlice } from './plan/planCrudSlice';
import { createSyncSlice } from './plan/syncSlice';
import { createDuplicateSlice } from './plan/duplicateSlice';
import { createLoginImportSlice } from './plan/loginImportSlice';
import { createArchiveSlice } from './plan/archiveSlice';

export const usePlanStore = create<PlanState>()(
    persist(
        (set, get) => {
            const ctx = { set, get };
            return {
                plans: [],
                currentPlanId: null,
                lastActivePlanId: null,

                // Firestore同期用（persistしない — partialize で除外）
                _dirtyPlanIds: new Set<string>(),
                _deletedPlanIds: new Set<string>(),
                _isSyncing: false,
                _lastSyncAt: 0,
                _saveStatus: 'idle' as const,
                _cloudStatus: 'idle' as const,
                _migrationDone: false,
                setSaveStatus: (status) => set({ _saveStatus: status }),

                ...createPlanCrudSlice(ctx),
                ...createSyncSlice(ctx),
                ...createDuplicateSlice(ctx),
                ...createLoginImportSlice(ctx),
                ...createArchiveSlice(ctx),
            };
        },
        {
            name: 'plan-storage',
            version: 2,
            // plans + 同期インテント (_dirtyPlanIds/_deletedPlanIds) を永続化。
            // Set は配列化して保存し、rehydrate(merge) で Set に戻す。
            // _isSyncing 等の一時状態は保存しない。
            partialize: (state) => partializePlanState(state),
            merge: (persisted, current) => mergePersistedPlanState(persisted, current),
            migrate: (persisted: any, version: number) => {
                if (version < 2) {
                    // v1→v2: levelフィールドをバックフィル
                    // 古いプランはp.levelがなく、data.currentLevelがレベルタブ操作で汚染されるバグがあった
                    const VALID_LEVELS = [70, 80, 90, 100];
                    const state = persisted as { plans?: SavedPlan[] };
                    if (state.plans) {
                        state.plans = state.plans.map(plan => {
                            if (plan.level) return plan;
                            // コンテンツ定義 → data.currentLevel の順でレベルを推定
                            const contentLevel = plan.contentId ? getContentById(plan.contentId)?.level : undefined;
                            const inferred = contentLevel ?? plan.data?.currentLevel;
                            const level = (VALID_LEVELS.includes(Number(inferred)) ? Number(inferred) : 100) as ContentLevel;
                            return { ...plan, level };
                        });
                    }
                }
                return persisted;
            },
        }
    )
);
