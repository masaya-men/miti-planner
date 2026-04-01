// src/store/useTutorialStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TUTORIALS, TUTORIAL_IDS, type TutorialStep } from '../data/tutorialDefinitions';
import { useMitigationStore, type TutorialSnapshot } from './useMitigationStore';
import { usePlanStore } from './usePlanStore';

// ─────────────────────────────────────────────
// 後方互換: 旧コードが TUTORIAL_STEPS を import している箇所向け
// ─────────────────────────────────────────────
export { type TutorialStep } from '../data/tutorialDefinitions';
export const TUTORIAL_STEPS = TUTORIALS.main.steps;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TutorialState {
  // 現在の状態
  activeTutorialId: string | null;
  currentStep: number;
  isActive: boolean;

  // 完了状態（localStorage永続化）
  completed: Record<string, boolean>;

  // 退避フラグ
  pendingExit: boolean;

  // 旧コードとの互換用
  hasCompleted: boolean;
  hasVisitedShare: boolean;
  currentStepIndex: number;

  // スナップショット（メインチュートリアル用）
  _savedSnapshot: TutorialSnapshot | null;
  _savedPlanId: string | null;

  // アクション
  startTutorial: (id?: string) => void;
  completeEvent: (eventName: string) => void;
  skipTutorial: () => void;
  requestExit: () => void;
  confirmExit: () => void;
  cancelExit: () => void;
  resetTutorial: () => void;
  setVisitedShare: () => void;
  completeTutorial: () => void;

  // 旧互換
  startFromStep: (step: number) => void;

  // ヘルパー
  getCurrentStep: () => TutorialStep | null;
  getActiveTutorial: () => (typeof TUTORIALS)[string] | null;
}

// ─────────────────────────────────────────────
// ヘルパー: チュートリアル終了時の状態復元
// ─────────────────────────────────────────────
function restoreUserState(state: TutorialState) {
  const mitiState = useMitigationStore.getState();
  const planStore = usePlanStore.getState();

  // チュートリアル専用プランを削除
  const tutorialPlan = planStore.plans.find(p =>
    p.title.endsWith('_チュートリアル') || p.title.endsWith('_Tutorial')
  );
  if (tutorialPlan) {
    planStore.deletePlan(tutorialPlan.id);
  }

  // 元のプランに復元
  if (state._savedPlanId) {
    const savedPlan = planStore.getPlan(state._savedPlanId);
    if (savedPlan) {
      mitiState.loadSnapshot(savedPlan.data);
      planStore.setCurrentPlanId(state._savedPlanId);
    } else if (state._savedSnapshot) {
      mitiState.restoreFromSnapshot(state._savedSnapshot);
    }
  } else if (state._savedSnapshot) {
    mitiState.restoreFromSnapshot(state._savedSnapshot);
  }
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────
export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      // 状態
      activeTutorialId: null,
      currentStep: 0,
      isActive: false,
      completed: Object.fromEntries(TUTORIAL_IDS.map(id => [id, false])),
      pendingExit: false,
      hasCompleted: false,
      hasVisitedShare: false,
      currentStepIndex: 0,
      _savedSnapshot: null,
      _savedPlanId: null,

      // ─── アクション ───

      startTutorial: (id = 'main') => {
        const tutorial = TUTORIALS[id];
        if (!tutorial) return;

        const mitiState = useMitigationStore.getState();
        const planStore = usePlanStore.getState();

        // メインチュートリアル・create-plan チュートリアルの場合、現在の状態を退避
        let snapshot: TutorialSnapshot | null = null;
        let savedPlanId: string | null = null;
        if (id === 'main' || id === 'create-plan') {
          savedPlanId = planStore.currentPlanId;
          if (savedPlanId) {
            planStore.updatePlan(savedPlanId, { data: mitiState.getSnapshot() });
          }
          snapshot = {
            timelineEvents: JSON.parse(JSON.stringify(mitiState.timelineEvents)),
            timelineMitigations: JSON.parse(JSON.stringify(mitiState.timelineMitigations)),
            phases: JSON.parse(JSON.stringify(mitiState.phases)),
            partyMembers: JSON.parse(JSON.stringify(mitiState.partyMembers)),
            myMemberId: mitiState.myMemberId,
            myJobHighlight: mitiState.myJobHighlight,
            hideEmptyRows: mitiState.hideEmptyRows,
          };
          // main はリセット、create-plan はリセットしない（新規作成がチュートリアルの一部）
          if (id === 'main') {
            mitiState.resetForTutorial();
          }
        }

        set({
          activeTutorialId: id,
          currentStep: 0,
          isActive: true,
          pendingExit: false,
          currentStepIndex: 0,
          _savedSnapshot: snapshot,
          _savedPlanId: savedPlanId,
        });
      },

      completeEvent: (eventName: string) => {
        const { isActive, activeTutorialId, currentStep } = get();
        if (!isActive || !activeTutorialId) return;

        const tutorial = TUTORIALS[activeTutorialId];
        if (!tutorial) return;

        const step = tutorial.steps[currentStep];
        if (!step) return;

        if (step.completionEvent === eventName) {
          const nextStep = currentStep + 1;
          if (nextStep >= tutorial.steps.length) {
            // チュートリアル完了
            get().completeTutorial();
          } else {
            set({
              currentStep: nextStep,
              currentStepIndex: nextStep,
            });
          }
        }
      },

      completeTutorial: () => {
        const { activeTutorialId } = get();
        if (!activeTutorialId) return;

        // メインチュートリアル・create-plan チュートリアルの場合は状態復元
        if (activeTutorialId === 'main' || activeTutorialId === 'create-plan') {
          restoreUserState(get());
        }

        set(state => ({
          activeTutorialId: null,
          currentStep: 0,
          isActive: false,
          currentStepIndex: 0,
          pendingExit: false,
          hasCompleted: activeTutorialId === 'main' ? true : state.hasCompleted,
          completed: { ...state.completed, [activeTutorialId]: true },
          _savedSnapshot: null,
          _savedPlanId: null,
        }));
      },

      skipTutorial: () => {
        set({ pendingExit: true });
      },

      requestExit: () => {
        set({ pendingExit: true });
      },

      confirmExit: () => {
        const { activeTutorialId } = get();
        if (activeTutorialId === 'main' || activeTutorialId === 'create-plan') {
          restoreUserState(get());
        }
        set({
          activeTutorialId: null,
          currentStep: 0,
          isActive: false,
          pendingExit: false,
          currentStepIndex: 0,
          _savedSnapshot: null,
          _savedPlanId: null,
        });
        // チュートリアル中に開いたモーダルをすべて閉じる
        window.dispatchEvent(new Event('tutorial:close-all-modals'));
        window.dispatchEvent(new Event('tutorial:close-new-plan-modal'));
      },

      cancelExit: () => {
        set({ pendingExit: false });
      },

      resetTutorial: () => {
        set({
          activeTutorialId: null,
          currentStep: 0,
          isActive: false,
          completed: Object.fromEntries(TUTORIAL_IDS.map(id => [id, false])),
          hasCompleted: false,
          hasVisitedShare: false,
          pendingExit: false,
          currentStepIndex: 0,
          _savedSnapshot: null,
          _savedPlanId: null,
        });
      },

      setVisitedShare: () => {
        set({ hasVisitedShare: true });
      },

      // 旧互換: startFromStep(1) → startTutorial('main')
      startFromStep: (_step: number) => {
        get().startTutorial('main');
      },

      // ヘルパー
      getCurrentStep: () => {
        const { activeTutorialId, currentStep } = get();
        if (!activeTutorialId) return null;
        return TUTORIALS[activeTutorialId]?.steps[currentStep] ?? null;
      },

      getActiveTutorial: () => {
        const { activeTutorialId } = get();
        if (!activeTutorialId) return null;
        return TUTORIALS[activeTutorialId] ?? null;
      },
    }),
    {
      name: 'tutorial-storage',
      partialize: (state) => ({
        completed: state.completed,
        hasCompleted: state.hasCompleted,
        hasVisitedShare: state.hasVisitedShare,
      }),
    }
  )
);
