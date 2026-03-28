import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMitigationStore, type TutorialSnapshot } from './useMitigationStore';
import { usePlanStore } from './usePlanStore';
import { getMitigationsFromStore } from '../hooks/useSkillsData';

// ─────────────────────────────────────────────
// Tutorial Step Definitions
// ─────────────────────────────────────────────
// Each step describes WHAT to highlight and WHEN to advance.
// The `completionEvent` string is dispatched by other stores/components
// when the user satisfies the step condition.
//
// To add a new tutorial step:
//   1. Add a TutorialStep entry to TUTORIAL_STEPS below
//   2. Add matching i18n keys under "tutorial.<id>_title" / "tutorial.<id>_desc"
//   3. Add `data-tutorial="<id>"` to the target element
//   4. Call `useTutorialStore.getState().completeEvent('<completionEvent>')` from the relevant action
// ─────────────────────────────────────────────

export interface TutorialStep {
    /** Unique step identifier */
    id: string;
    /** CSS selector for the element to highlight (via data-tutorial attribute) */
    targetSelector: string;
    /** i18n key for step title */
    titleKey: string;
    /** i18n key for step description */
    descriptionKey: string;
    /** The event name that triggers completion of this step */
    completionEvent: string;
    /**
     * If true, the step shows a centered dialog instead of
     * highlighting a specific element (e.g., completion step).
     */
    isDialog?: boolean;
    /**
     * Which route this step appears on.
     * 'portal' = PortalPage (/), 'miti' = MitiPlannerPage (/miti)
     * Used by the overlay to know when to render.
     */
    route?: 'portal' | 'miti';
    /**
     * If true, the spotlight overlay won't darken the entire screen.
     * Useful for targets inside an already-darkened modal.
     */
    isModalTarget?: boolean;
    /** If true, the step requires the user to click a "Next" button instead of interacting with the UI. */
    isAcknowledgeStep?: boolean;
    /** If true, uses a lighter overlay to keep the timeline table visible. */
    isTimelineStep?: boolean;
    /** Forced tooltip position */
    tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'right-center' | 'keep';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
    // Step 0: Portal — choose the Mitigation Planner
    {
        id: 'portal-select',
        targetSelector: '[data-tutorial="portal-miti-card"]',
        titleKey: 'tutorial.portal_select_title',
        descriptionKey: 'tutorial.portal_select_desc',
        completionEvent: 'portal:tool-selected',
        route: 'portal',
    },
    // Step 1: サイドバーからコンテンツを選択 → 名前入力スキップ → チュートリアル専用プラン作成
    {
        id: 'content-select',
        targetSelector: '[data-tutorial-first-item]',
        titleKey: 'tutorial.content_select_title',
        descriptionKey: 'tutorial.content_select_desc',
        completionEvent: 'timeline:events-loaded',
        route: 'miti',
    },
    // Step 2: Open Party Settings
    {
        id: 'open-party-settings',
        targetSelector: '[data-tutorial="party-comp"]',
        titleKey: 'tutorial.open_party_settings_title',
        descriptionKey: 'tutorial.open_party_settings_desc',
        completionEvent: 'party-settings:opened',
        route: 'miti',
    },
    // Step 3: Party composition — 4 people via slot clicks
    {
        id: 'party-slots',
        targetSelector: '[data-tutorial="party-slots-target"]',
        titleKey: 'tutorial.party_slots_title',
        descriptionKey: 'tutorial.party_slots_desc',
        completionEvent: 'party:four-set',
        route: 'miti',
        isModalTarget: true,
    },
    // Step 4: Party composition — remaining 4 via palette
    {
        id: 'party-palette',
        targetSelector: '[data-tutorial="party-palette-target"]',
        titleKey: 'tutorial.party_palette_title',
        descriptionKey: 'tutorial.party_palette_desc',
        completionEvent: 'party:all-set',
        route: 'miti',
        isModalTarget: true,
    },
    // Step 5: Set My Job
    {
        id: 'party-myjob',
        targetSelector: '[data-tutorial="my-job-btn-pld"]',
        titleKey: 'tutorial.party_myjob_title',
        descriptionKey: 'tutorial.party_myjob_desc',
        completionEvent: 'my-job:set',
        route: 'miti',
        isModalTarget: true,
    },
    // Step 6: Close Modal
    {
        id: 'party-close',
        targetSelector: '[data-tutorial="party-settings-close-btn"]',
        titleKey: 'tutorial.party_close_title',
        descriptionKey: 'tutorial.party_close_desc',
        completionEvent: 'party-settings:closed',
        route: 'miti',
        isModalTarget: true,
    },
    // ==========================================
    // Phase 2: Timeline Practical Usage (Steps 7-10)
    // ==========================================

    // Step 7: AoE Mitigation
    {
        id: 'tutorial-7a-aoe-danger',
        targetSelector: '[data-tutorial="tutorial-damage-cell-4-aoe"]',
        titleKey: 'tutorial.step7a_title',
        descriptionKey: 'tutorial.step7a_desc',
        completionEvent: 'tutorial:acknowledged-7a',
        route: 'miti',
        isAcknowledgeStep: true,
        isTimelineStep: true,
        tooltipPosition: 'right',   // 7/23: 要素の右
    },
    {
        id: 'tutorial-7b-aoe-cell',
        targetSelector: '[data-tutorial="miti-cell-st-4"]',
        titleKey: 'tutorial.step7b_title',
        descriptionKey: 'tutorial.step7b_desc',
        completionEvent: 'tutorial:opened-miti-selector',
        route: 'miti',
        isTimelineStep: true,
        tooltipPosition: 'left',    // 8/23: 要素の左
    },
    {
        id: 'tutorial-7c-aoe-skill',
        targetSelector: '[data-tutorial="tutorial-skill-reprisal"]',
        titleKey: 'tutorial.step7c_title',
        descriptionKey: 'tutorial.step7c_desc',
        completionEvent: 'mitigation:added',
        route: 'miti',
        isModalTarget: true,
        isTimelineStep: true,
    },
    {
        id: 'tutorial-7d-aoe-success',
        targetSelector: '[data-tutorial="tutorial-damage-cell-4-aoe"]',
        titleKey: 'tutorial.step7d_title',
        descriptionKey: 'tutorial.step7d_desc',
        completionEvent: 'tutorial:acknowledged-7d',
        route: 'miti',
        isAcknowledgeStep: true,
        isTimelineStep: true,
        tooltipPosition: 'right',   // 10/23: 要素の右
    },

    // Step 8: Targeted Mitigation (TB)
    {
        id: 'tutorial-8a-tb-danger',
        targetSelector: '[data-tutorial="tutorial-damage-cell-10-tb"]',
        titleKey: 'tutorial.step8a_title',
        descriptionKey: 'tutorial.step8a_desc',
        completionEvent: 'tutorial:acknowledged-8a',
        route: 'miti',
        isAcknowledgeStep: true,
        isTimelineStep: true,
        tooltipPosition: 'right',   // 11/23: 要素の右
    },
    {
        id: 'tutorial-8b-tb-cell',
        targetSelector: '[data-tutorial="miti-cell-st-10"]',
        titleKey: 'tutorial.step8b_title',
        descriptionKey: 'tutorial.step8b_desc',
        completionEvent: 'tutorial:opened-miti-selector',
        route: 'miti',
        isTimelineStep: true,
        tooltipPosition: 'left',    // 12/23: 要素の左
    },
    {
        id: 'tutorial-8c-tb-skill',
        targetSelector: '[data-tutorial="tutorial-skill-intervention"]',
        titleKey: 'tutorial.step8c_title',
        descriptionKey: 'tutorial.step8c_desc',
        completionEvent: 'tutorial:selected-target-miti',
        route: 'miti',
        isModalTarget: true,
        isTimelineStep: true,
    },
    {
        id: 'tutorial-8d-tb-target',
        targetSelector: '[data-tutorial="tutorial-target-mt"]',
        titleKey: 'tutorial.step8d_title',
        descriptionKey: 'tutorial.step8d_desc',
        completionEvent: 'mitigation:added',
        route: 'miti',
        isModalTarget: true,
        isTimelineStep: true,
    },
    {
        id: 'tutorial-8e-tb-success',
        targetSelector: '[data-tutorial="tutorial-damage-cell-10-tb"]',
        titleKey: 'tutorial.step8e_title',
        descriptionKey: 'tutorial.step8e_desc',
        completionEvent: 'tutorial:acknowledged-8e',
        route: 'miti',
        isAcknowledgeStep: true,
        isTimelineStep: true,
        tooltipPosition: 'right',   // 15/23: 要素の右
    },

    // Step 9: Add Mechanic
    {
        id: 'tutorial-9a-add-mechanic-btn',
        targetSelector: '[data-tutorial="add-event-btn-11"]',
        titleKey: 'tutorial.step9a_title',
        descriptionKey: 'tutorial.step9a_desc',
        completionEvent: 'tutorial:opened-add-event-modal',
        route: 'miti',
        isTimelineStep: true,
        tooltipPosition: 'right',   // 16/23: 要素の右
    },
    {
        id: 'tutorial-9b-name-input',
        targetSelector: '[data-tutorial="event-name-input"]',
        titleKey: 'tutorial.step9b_title',
        descriptionKey: 'tutorial.step9b_desc',
        completionEvent: 'tutorial:entered-event-name',
        route: 'miti',
        isModalTarget: true,
    },
    {
        id: 'tutorial-9c-damage-input',
        targetSelector: '[data-tutorial="event-actual-damage-input"]',
        titleKey: 'tutorial.step9c_title',
        descriptionKey: 'tutorial.step9c_desc',
        completionEvent: 'tutorial:entered-event-damage',
        route: 'miti',
        isModalTarget: true,
    },
    {
        id: 'tutorial-9d-miti-select',
        targetSelector: '[data-tutorial="tutorial-skill-target"]',
        titleKey: 'tutorial.step9d_title',
        descriptionKey: 'tutorial.step9d_desc',
        completionEvent: 'tutorial:selected-event-mitis',
        route: 'miti',
        isModalTarget: true,
        // 19/24: モーダル外の右に配置（isModalTargetのロジックに委任）
    },
    {
        id: 'tutorial-9e-save-btn',
        targetSelector: '[data-tutorial="event-save-btn"]',
        titleKey: 'tutorial.step9e_title',
        descriptionKey: 'tutorial.step9e_desc',
        completionEvent: 'event:created',
        route: 'miti',
        isModalTarget: true,
    },

    // Step 10: My Job Highlight
    {
        id: 'tutorial-10-my-job-highlight',
        targetSelector: '[data-tutorial="my-job-highlight-btn"]',
        titleKey: 'tutorial.step10_title',
        descriptionKey: 'tutorial.step10_desc',
        completionEvent: 'tutorial:my-job-highlight-toggled',
        route: 'miti',
        isTimelineStep: true,
        tooltipPosition: 'left',    // 21/23: 要素の左
    },
    {
        id: 'tutorial-10b-highlight-result',
        targetSelector: '',
        titleKey: 'tutorial.step10b_title',
        descriptionKey: 'tutorial.step10b_desc',
        completionEvent: 'tutorial:acknowledged-10b',
        route: 'miti',
        isAcknowledgeStep: true,
        isTimelineStep: true,
    },

    // Step 11: 新規作成ボタンを押させる → モーダルを見せる → 閉じさせる
    {
        id: 'tutorial-11a-new-plan-click',
        targetSelector: '[data-tutorial="new-plan"]',
        titleKey: 'tutorial.step11a_title',
        descriptionKey: 'tutorial.step11a_desc',
        completionEvent: 'sidebar:new-plan-clicked',
        route: 'miti',
        isTimelineStep: true,       // 23/24: 暗くせずクリックブロックのみ
    },
    {
        id: 'tutorial-11b-new-plan-close',
        targetSelector: '[data-tutorial="new-plan-close"]',
        titleKey: 'tutorial.step11b_title',
        descriptionKey: 'tutorial.step11b_desc',
        completionEvent: 'tutorial:new-plan-modal-closed',
        route: 'miti',
        isModalTarget: true,
    },

    // Final Completion Dialog
    {
        id: 'complete',
        targetSelector: '',
        titleKey: 'tutorial.complete_title',
        descriptionKey: 'tutorial.complete_desc',
        completionEvent: 'tutorial:acknowledged',
        isDialog: true,
        route: 'miti',
    },
];

// ─────────────────────────────────────────────
// Store Interface
// ─────────────────────────────────────────────

interface TutorialState {
    /** Whether the tutorial overlay is currently active */
    isActive: boolean;
    /** Current step index (0-based) */
    currentStepIndex: number;
    /** Whether the user has ever completed the tutorial */
    hasCompleted: boolean;
    /** 共有リンクから来たユーザーはチュートリアル自動起動しない */
    hasVisitedShare: boolean;
    /** Whether an exit confirmation dialog should be shown */
    pendingTutorialExit: boolean;
    /** チュートリアル開始確認ダイアログ表示中 */
    pendingTutorialStart: boolean;
    /** 確認ダイアログ経由で開始するステップ番号 */
    _pendingStepIndex: number;
    /** チュートリアル開始前の状態を退避するスナップショット（メモリ上のみ） */
    _savedSnapshot: TutorialSnapshot | null;
    /** 退避したプランID */
    _savedPlanId: string | null;

    // ── Actions ──
    /** Start the tutorial from step 0 (shows confirmation first) */
    startTutorial: () => void;
    /** Confirm tutorial start after dialog */
    confirmStart: () => void;
    /** Cancel tutorial start dialog */
    cancelStart: () => void;
    /** Start the tutorial from a specific step index */
    startFromStep: (stepIndex: number) => void;
    /** Advance to the next step */
    nextStep: () => void;
    /** Go back to the previous step */
    prevStep: () => void;
    /** Mark tutorial as completed and deactivate */
    completeTutorial: () => void;
    /** Skip the tutorial (marks as completed) */
    skipTutorial: () => void;
    /** Request to exit the tutorial (shows confirmation) */
    requestExit: () => void;
    /** Confirm the exit */
    confirmExit: () => void;
    /** Cancel the exit dialog */
    cancelExit: () => void;
    /** Reset tutorial state (for debugging/testing) */
    resetTutorial: () => void;
    /**
     * Called by external stores/components when a completion event fires.
     * If the event matches the current step's completionEvent, auto-advances.
     */
    completeEvent: (eventName: string) => void;
}

// ─────────────────────────────────────────────
// Helper: チュートリアル終了時にユーザーの元の状態を復元
// ─────────────────────────────────────────────
function _restoreUserState(get: () => TutorialState) {
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
    const savedPlanId = get()._savedPlanId;
    if (savedPlanId) {
        const savedPlan = planStore.getPlan(savedPlanId);
        if (savedPlan) {
            // usePlanStoreに保存されたプランデータからloadSnapshotで確実に復元
            mitiState.loadSnapshot(savedPlan.data);
            planStore.setCurrentPlanId(savedPlanId);
        } else {
            // プランが見つからない場合はスナップショットから復元
            const snapshot = get()._savedSnapshot;
            if (snapshot) {
                mitiState.restoreFromSnapshot(snapshot);
            } else {
                mitiState.resetForTutorial();
            }
        }
    } else {
        // 元のプランがない場合はクリーン状態に
        const snapshot = get()._savedSnapshot;
        if (snapshot) {
            mitiState.restoreFromSnapshot(snapshot);
        } else {
            mitiState.resetForTutorial();
        }
    }
}

// ─────────────────────────────────────────────
// Store Implementation
// ─────────────────────────────────────────────

export const useTutorialStore = create<TutorialState>()(
    persist(
        (set, get) => ({
            isActive: false,
            currentStepIndex: 0,
            hasCompleted: false,
            hasVisitedShare: false,
            pendingTutorialExit: false,
            pendingTutorialStart: false,
            _pendingStepIndex: 0,
            _savedSnapshot: null,
            _savedPlanId: null,

            startTutorial: () => {
                // 確認ダイアログを表示（step 0から）
                set({ pendingTutorialStart: true, _pendingStepIndex: 0 });
            },

            confirmStart: () => {
                const mitiState = useMitigationStore.getState();
                const planStore = usePlanStore.getState();
                const savedPlanId = planStore.currentPlanId;
                const stepIndex = get()._pendingStepIndex;

                // ① 現在のプランのデータをusePlanStoreに保存（後で復元できるように）
                if (savedPlanId) {
                    planStore.updatePlan(savedPlanId, { data: mitiState.getSnapshot() });
                }

                // ② 現在のuseMitigationStoreの状態もメモリに退避（フォールバック用）
                const snapshot: TutorialSnapshot = {
                    timelineEvents: JSON.parse(JSON.stringify(mitiState.timelineEvents)),
                    timelineMitigations: JSON.parse(JSON.stringify(mitiState.timelineMitigations)),
                    phases: JSON.parse(JSON.stringify(mitiState.phases)),
                    partyMembers: JSON.parse(JSON.stringify(mitiState.partyMembers)),
                    myMemberId: mitiState.myMemberId,
                    myJobHighlight: mitiState.myJobHighlight,
                    hideEmptyRows: mitiState.hideEmptyRows,
                };

                // ③ currentPlanIdをnullに（ヘッダー等がユーザーのプランを参照しなくなる）
                planStore.setCurrentPlanId(null);

                // ④ useMitigationStoreをクリーンな状態にリセット
                mitiState.resetForTutorial();

                // ⑤ チュートリアル開始
                set({
                    isActive: true,
                    currentStepIndex: stepIndex,
                    pendingTutorialStart: false,
                    _pendingStepIndex: 0,
                    _savedSnapshot: snapshot,
                    _savedPlanId: savedPlanId,
                });

            },

            cancelStart: () => {
                set({ pendingTutorialStart: false, _pendingStepIndex: 0 });
            },

            startFromStep: (stepIndex: number) => {
                if (stepIndex >= 0 && stepIndex < TUTORIAL_STEPS.length) {
                    // startFromStepも確認ダイアログを経由する
                    set({ pendingTutorialStart: true, _pendingStepIndex: stepIndex });
                }
            },

            nextStep: () => {
                const { currentStepIndex } = get();
                const nextIndex = currentStepIndex + 1;
                if (nextIndex >= TUTORIAL_STEPS.length) {
                    get().completeTutorial();
                } else {
                    set({ currentStepIndex: nextIndex });
                }
            },

            prevStep: () => {
                const { currentStepIndex } = get();
                if (currentStepIndex <= 0) return;

                const mitiState = useMitigationStore.getState();
                const targetStep = TUTORIAL_STEPS[currentStepIndex - 1];

                // まずすべてのモーダル/セレクターを閉じる
                window.dispatchEvent(new CustomEvent('tutorial:close-all-modals'));

                // --- 戻り先のステップに応じたundo ---
                switch (targetStep.id) {
                    // コンテンツ選択に戻す: プラン削除・リセット
                    case 'content-select': {
                        const planStore = usePlanStore.getState();
                        const tutPlan = planStore.plans.find(p =>
                            p.title.endsWith('_チュートリアル') || p.title.endsWith('_Tutorial')
                        );
                        if (tutPlan) planStore.deletePlan(tutPlan.id);
                        mitiState.resetForTutorial();
                        break;
                    }

                    // パーティモーダルを開く前に戻す: パーティ全クリア
                    case 'open-party-settings': {
                        const allClear = mitiState.partyMembers.map(m => ({ memberId: m.id, jobId: null as string | null }));
                        mitiState.updatePartyBulk(allClear);
                        mitiState.setMyMemberId(null);
                        // party-settings:closedで追加されたMT軽減も削除
                        const mtMiti = mitiState.timelineMitigations.find(m => m.id === 'tut_mit_tank40');
                        if (mtMiti) mitiState.removeMitigation(mtMiti.id);
                        break;
                    }

                    // パーティスロット（最初の4人）に戻す: 全メンバークリア、モーダル再開
                    case 'party-slots': {
                        const allClear2 = mitiState.partyMembers.map(m => ({ memberId: m.id, jobId: null as string | null }));
                        mitiState.updatePartyBulk(allClear2);
                        mitiState.setMyMemberId(null);
                        const mtMiti2 = mitiState.timelineMitigations.find(m => m.id === 'tut_mit_tank40');
                        if (mtMiti2) mitiState.removeMitigation(mtMiti2.id);
                        setTimeout(() => window.dispatchEvent(new CustomEvent('tutorial:open-party-modal')), 50);
                        break;
                    }

                    // パーティパレット（残り4人）に戻す: 後半メンバーをクリア
                    case 'party-palette': {
                        // 先着4人を残し、それ以降をクリア
                        const partyOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
                        const keep = new Set<string>();
                        for (const id of partyOrder) {
                            const m = mitiState.partyMembers.find(pm => pm.id === id);
                            if (m?.jobId && keep.size < 4) keep.add(id);
                        }
                        const toClear = mitiState.partyMembers
                            .filter(m => m.jobId !== null && !keep.has(m.id))
                            .map(m => ({ memberId: m.id, jobId: null as string | null }));
                        if (toClear.length > 0) mitiState.updatePartyBulk(toClear);
                        mitiState.setMyMemberId(null);
                        const mtMiti3 = mitiState.timelineMitigations.find(m => m.id === 'tut_mit_tank40');
                        if (mtMiti3) mitiState.removeMitigation(mtMiti3.id);
                        setTimeout(() => window.dispatchEvent(new CustomEvent('tutorial:open-party-modal')), 50);
                        break;
                    }

                    // マイジョブ設定に戻す: myMemberIdクリア
                    case 'party-myjob': {
                        mitiState.setMyMemberId(null);
                        const mtMiti4 = mitiState.timelineMitigations.find(m => m.id === 'tut_mit_tank40');
                        if (mtMiti4) mitiState.removeMitigation(mtMiti4.id);
                        setTimeout(() => window.dispatchEvent(new CustomEvent('tutorial:open-party-modal')), 50);
                        break;
                    }

                    // モーダルを閉じるステップに戻す: モーダル再開、MT軽減削除
                    case 'party-close': {
                        const mtMiti5 = mitiState.timelineMitigations.find(m => m.id === 'tut_mit_tank40');
                        if (mtMiti5) mitiState.removeMitigation(mtMiti5.id);
                        setTimeout(() => window.dispatchEvent(new CustomEvent('tutorial:open-party-modal')), 50);
                        break;
                    }

                    // AoE軽減追加系ステップに戻す: 追加された軽減を削除
                    case 'tutorial-7b-aoe-cell':
                    case 'tutorial-7c-aoe-skill': {
                        const aoeM = mitiState.timelineMitigations.find(m => m.time === 4 && m.id !== 'tut_mit_tank40');
                        if (aoeM) mitiState.removeMitigation(aoeM.id);
                        break;
                    }

                    // TB軽減追加系ステップに戻す: ST由来の軽減を削除
                    case 'tutorial-8b-tb-cell':
                    case 'tutorial-8c-tb-skill':
                    case 'tutorial-8d-tb-target': {
                        const tbM = mitiState.timelineMitigations.find(m => m.time === 10 && m.ownerId !== 'MT');
                        if (tbM) mitiState.removeMitigation(tbM.id);
                        break;
                    }

                    // イベント追加系ステップに戻す: 追加されたイベントを削除
                    case 'tutorial-9a-add-mechanic-btn':
                    case 'tutorial-9b-name-input':
                    case 'tutorial-9c-damage-input':
                    case 'tutorial-9d-miti-select':
                    case 'tutorial-9e-save-btn': {
                        const created = mitiState.timelineEvents.find(e => e.id !== 'tut_evt_aoe' && e.id !== 'tut_evt_tb');
                        if (created) mitiState.removeEvent(created.id);
                        break;
                    }

                    // マイジョブハイライトに戻す: ハイライトOFF、追加イベント削除
                    case 'tutorial-10-my-job-highlight': {
                        mitiState.setMyJobHighlight(false);
                        const created2 = mitiState.timelineEvents.find(e => e.id !== 'tut_evt_aoe' && e.id !== 'tut_evt_tb');
                        if (created2) mitiState.removeEvent(created2.id);
                        break;
                    }

                    // ハイライト結果確認に戻す: ハイライトOFF
                    case 'tutorial-10b-highlight-result': {
                        mitiState.setMyJobHighlight(false);
                        break;
                    }

                    // 新規作成ボタンに戻す: NewPlanModalを閉じる
                    case 'tutorial-11a-new-plan-click': {
                        window.dispatchEvent(new CustomEvent('tutorial:close-new-plan-modal'));
                        break;
                    }

                    // その他（acknowledge系）: 特別なundoなし
                    default:
                        break;
                }

                set({ currentStepIndex: currentStepIndex - 1 });
            },

            completeTutorial: () => {
                try { _restoreUserState(get); } catch (e) { console.error('Tutorial restore failed:', e); }
                set({ isActive: false, hasCompleted: true, currentStepIndex: 0, _savedSnapshot: null, _savedPlanId: null });
            },

            skipTutorial: () => {
                try { _restoreUserState(get); } catch (e) { console.error('Tutorial restore failed:', e); }
                set({ isActive: false, hasCompleted: true, currentStepIndex: 0, pendingTutorialExit: false, _savedSnapshot: null, _savedPlanId: null });
            },

            requestExit: () => {
                set({ pendingTutorialExit: true });
            },

            confirmExit: () => {
                get().skipTutorial();
            },

            cancelExit: () => {
                set({ pendingTutorialExit: false });
            },

            resetTutorial: () => {
                set({ isActive: false, hasCompleted: false, currentStepIndex: 0 });
            },

            completeEvent: (eventName: string) => {
                const { isActive, currentStepIndex } = get();
                if (!isActive) return;

                const currentStep = TUTORIAL_STEPS[currentStepIndex];
                if (currentStep && currentStep.completionEvent === eventName) {
                    if (eventName === 'party-settings:closed') {
                        // イベントは専用プランに事前ロード済み → 軽減配置のみ
                        const mitiState = useMitigationStore.getState();
                        const mt = mitiState.partyMembers.find((p) => p.id === 'MT');

                        // MTの120s軽減を事前配置
                        if (mt?.jobId) {
                            const mt120sMiti = getMitigationsFromStore().find(m => m.jobId === mt.jobId && m.family === 'tank_40');
                            if (mt120sMiti) {
                                mitiState.addMitigation({
                                    id: 'tut_mit_tank40',
                                    mitigationId: mt120sMiti.id,
                                    time: 10,
                                    duration: mt120sMiti.duration,
                                    ownerId: 'MT',
                                });
                            }
                        }

                        // チュートリアルイベントまでスクロール
                        setTimeout(() => {
                            const scrollContainer = document.querySelector('.timeline-scroll-container');
                            const row = document.querySelector('[data-time-row="3"]') as HTMLElement;
                            if (scrollContainer && row) {
                                scrollContainer.scrollTo({
                                    top: row.offsetTop,
                                    behavior: 'smooth'
                                });
                            }
                        }, 300);
                    }

                    get().nextStep();
                }
            },
        }),
        {
            name: 'tutorial-storage',
            // Only persist hasCompleted — runtime state should not be persisted
            partialize: (state) => ({ hasCompleted: state.hasCompleted, hasVisitedShare: state.hasVisitedShare }),
            // リロード時にチュートリアル用プランの残骸を自動削除する
            // isActiveは永続化されないためリロード後は常にfalse → チュートリアル途中の残骸が残る
            onRehydrateStorage: () => {
                // rehydrate完了後のコールバック
                return () => {
                    // 少し遅延させてusePlanStoreのrehydrateも完了してから実行
                    setTimeout(() => {
                        const planStore = usePlanStore.getState();
                        const tutorialPlans = planStore.plans.filter(p =>
                            p.title.endsWith('_チュートリアル') || p.title.endsWith('_Tutorial')
                        );
                        if (tutorialPlans.length > 0) {
                            for (const plan of tutorialPlans) {
                                planStore.deletePlan(plan.id);
                            }
                            // チュートリアル途中でリロードされた場合、useMitigationStoreもクリア
                            useMitigationStore.getState().resetForTutorial();
                            // 残っているプランがあれば最新のものを自動選択して復帰
                            const remaining = usePlanStore.getState().plans;
                            if (remaining.length > 0) {
                                const latest = remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0];
                                useMitigationStore.getState().loadSnapshot(latest.data);
                                usePlanStore.getState().setCurrentPlanId(latest.id);
                            }
                        }
                    }, 0);
                };
            },
        }
    )
);

