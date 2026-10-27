import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeProgress } from '../lib/progressLogic';
import { calculateMemberValues } from '../utils/calculator';
import { isTutorialActive } from './tutorialBridge';
import { MAX_HISTORY, type HistorySnapshot, type MitigationState, type SliceContext } from './mitigation/types';
import { INITIAL_PARTY } from './mitigation/partyDefaults';
import { createCollabSlice } from './mitigation/collabSlice';
import { createHistorySlice } from './mitigation/historySlice';
import { createMitigationSlice } from './mitigation/mitigationSlice';
import { createViewSlice } from './mitigation/viewSlice';
import { createPartySlice } from './mitigation/partySlice';
import { createEventSlice } from './mitigation/eventSlice';
import { createPhaseLabelSlice } from './mitigation/phaseLabelSlice';
import { createMemoProgressSlice } from './mitigation/memoProgressSlice';
import { createTutorialSlice } from './mitigation/tutorialSlice';

export type { AASettings, TutorialSnapshot } from './mitigation/types';
export { getDefaultTankStats, getDefaultHealerStats, DEFAULT_TANK_STATS, DEFAULT_HEALER_STATS } from './mitigation/partyDefaults';

export const useMitigationStore = create<MitigationState>()(
    persist(
        (set, get) => {

            // Helper: push current state snapshot onto history stack before mutating
            const pushHistory = () => {
                const state = get();
                const snapshot: HistorySnapshot = {
                    timelineMitigations: [...state.timelineMitigations],
                    timelineEvents: [...state.timelineEvents],
                    phases: [...state.phases],
                    labels: [...state.labels],
                    partyMembers: [...state.partyMembers]
                };
                const newHistory = [...state._history, snapshot].slice(-MAX_HISTORY);
                set({ _history: newHistory, _future: [] });
            };

            // Initialize values for default party
            const currentLevel = 100; // 初期値
            const initialMembers = INITIAL_PARTY.map(m => ({
                ...m,
                computedValues: calculateMemberValues(m, currentLevel)
            }));

            const ctx: SliceContext = { set, get, pushHistory };

            return {
                mitigations: [],
                partyMembers: initialMembers,
                timelineEvents: [],
                phases: [],
                labels: [],
                timelineMitigations: [],
                aaSettings: {
                    damage: 0,
                    type: 'magical',
                    target: 'MT'
                },
                currentLevel: currentLevel,
                schAetherflowPatterns: {} as Record<string, 1 | 2>,
                myMemberId: null,
                myJobHighlight: false,
                hideEmptyRows: true,
                showRowBorders: false,
                sheetRowBorders: true,
                hiddenPartyMemberIds: [],
                clipboardEvent: null,
                timelineSortOrder: 'light_party',
                lastPlacedMitigationId: null,
                aetherflowChainPrompt: null,
                astrologianDrawChainPrompt: null,
                // メモ機能 (#57)
                memos: [],
                // 進捗トラッキング (#HUD)
                progress: { points: [], cleared: false },
                toolMode: 'idle',
                _history: [],
                _future: [],
                _collabActive: false,
                _collabHandlers: null,
                _collabCanUndo: false,
                _collabCanRedo: false,
                _collabReadonly: false,
                _loadedPlanId: null,

                // 操作のまとまり(src/store/mitigation/*Slice.ts)
                ...createCollabSlice(ctx),
                ...createHistorySlice(ctx),
                ...createMitigationSlice(ctx),
                ...createViewSlice(ctx),
                ...createPartySlice(ctx),
                ...createEventSlice(ctx),
                ...createPhaseLabelSlice(ctx),
                ...createMemoProgressSlice(ctx),
                ...createTutorialSlice(ctx),
            };
        },
        {
            name: 'mitigation-storage',
            version: 4,
            // チュートリアル中はlocalStorageへの書き込みを停止（壊れたデータの永続化を防止）
            storage: {
                getItem: (name: string) => {
                    const str = localStorage.getItem(name);
                    return str ? JSON.parse(str) : null;
                },
                setItem: (name: string, value: unknown) => {
                    // チュートリアル中 or ⑤-3b ジョイナー読み取り専用中は書き込みスキップ
                    // (壊れたデータ／他人の部屋データを自分の localStorage に永続化しない)。
                    if (isTutorialActive() || useMitigationStore.getState()._collabReadonly) return;
                    localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name: string) => {
                    localStorage.removeItem(name);
                },
            },
            partialize: (state: MitigationState) => ({
                currentLevel: state.currentLevel,
                timelineEvents: state.timelineEvents,
                timelineMitigations: state.timelineMitigations,
                phases: state.phases,
                labels: state.labels,
                partyMembers: state.partyMembers,
                schAetherflowPatterns: state.schAetherflowPatterns,
                aaSettings: state.aaSettings,
                myMemberId: state.myMemberId,
                myJobHighlight: state.myJobHighlight,
                hideEmptyRows: state.hideEmptyRows,
                showRowBorders: state.showRowBorders,
                sheetRowBorders: state.sheetRowBorders,
                timelineSortOrder: state.timelineSortOrder,
                hiddenPartyMemberIds: state.hiddenPartyMemberIds,
                memos: state.memos,
                progress: state.progress,
                // データ安全(2026-08-07): 持ち主の札も再読込をまたいで持ち歩く。
                // これが無いと起動のたびに null に戻り、誤った札の貼り直しを招く。
                _loadedPlanId: state._loadedPlanId,
            }),
            migrate: (persistedState: any, _version: number) => {
                return persistedState;
            },
            merge: (persisted: any, current: MitigationState) => {
                if (!persisted) return current;
                return {
                    ...current,
                    ...persisted,
                    // 進捗: 旧形式(dailyBest)で永続化された端末を新形式(points)へ正規化（undefined.map クラッシュ防止）
                    progress: normalizeProgress(persisted.progress),
                    // Re-calculate computed values just in case
                    partyMembers: (persisted.partyMembers || current.partyMembers).map((m: any) => ({
                        ...m,
                        computedValues: calculateMemberValues(m, persisted.currentLevel || current.currentLevel)
                    }))
                };
            }
        }
    )
);