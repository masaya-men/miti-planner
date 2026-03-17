import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMitigationStore } from './useMitigationStore';
import { MITIGATIONS } from '../data/mockData';

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
    tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'right-center'; // Tooltip placement preference
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
    // Step 1: Sidebar — click "New Plan"
    {
        id: 'new-plan',
        targetSelector: '[data-tutorial="new-plan"]',
        titleKey: 'tutorial.new_plan_title',
        descriptionKey: 'tutorial.new_plan_desc',
        completionEvent: 'sidebar:new-plan-clicked',
        route: 'miti',
    },
    // Step 2: Content selection dialog
    {
        id: 'content-select',
        targetSelector: '[data-tutorial-first-item]',
        titleKey: 'tutorial.content_select_title',
        descriptionKey: 'tutorial.content_select_desc',
        completionEvent: 'timeline:events-loaded',
        route: 'miti',
    },
    // Step 2.5: Open Party Settings
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
        tooltipPosition: 'bottom',
    },
    {
        id: 'tutorial-7b-aoe-cell',
        targetSelector: '[data-tutorial="miti-cell-st-4"]',
        titleKey: 'tutorial.step7b_title',
        descriptionKey: 'tutorial.step7b_desc',
        completionEvent: 'tutorial:opened-miti-selector',
        route: 'miti',
        isTimelineStep: true,
        tooltipPosition: 'bottom',
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
        tooltipPosition: 'bottom',
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
        tooltipPosition: 'bottom',
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
        tooltipPosition: 'bottom',
    },
    {
        id: 'tutorial-8b-tb-cell',
        targetSelector: '[data-tutorial="miti-cell-st-10"]',
        titleKey: 'tutorial.step8b_title',
        descriptionKey: 'tutorial.step8b_desc',
        completionEvent: 'tutorial:opened-miti-selector',
        route: 'miti',
        isTimelineStep: true,
        tooltipPosition: 'bottom',
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
        tooltipPosition: 'bottom',
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
        tooltipPosition: 'bottom',
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
        tooltipPosition: 'bottom',
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
        tooltipPosition: 'bottom',
    },
    {
        id: 'tutorial-9b-name-input',
        targetSelector: '[data-tutorial="event-name-input"]',
        titleKey: 'tutorial.step9b_title',
        descriptionKey: 'tutorial.step9b_desc',
        completionEvent: 'tutorial:entered-event-name',
        route: 'miti',
        isModalTarget: true,
        tooltipPosition: 'right-center',
    },
    {
        id: 'tutorial-9c-damage-input',
        targetSelector: '[data-tutorial="event-actual-damage-input"]',
        titleKey: 'tutorial.step9c_title',
        descriptionKey: 'tutorial.step9c_desc',
        completionEvent: 'tutorial:entered-event-damage',
        route: 'miti',
        isModalTarget: true,
        tooltipPosition: 'right-center',
    },
    {
        id: 'tutorial-9d-miti-select',
        targetSelector: '[data-tutorial="tutorial-skill-target"]',
        titleKey: 'tutorial.step9d_title',
        descriptionKey: 'tutorial.step9d_desc',
        completionEvent: 'tutorial:selected-event-mitis',
        route: 'miti',
        isModalTarget: true,
        tooltipPosition: 'right-center',
    },
    {
        id: 'tutorial-9e-save-btn',
        targetSelector: '[data-tutorial="event-save-btn"]',
        titleKey: 'tutorial.step9e_title',
        descriptionKey: 'tutorial.step9e_desc',
        completionEvent: 'event:created',
        route: 'miti',
        isModalTarget: true,
        tooltipPosition: 'right-center',
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
        tooltipPosition: 'bottom',
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
        tooltipPosition: 'bottom',
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
    /** Whether a restart confirmation dialog should be shown */
    pendingTutorialRestart: boolean;
    /** Whether an exit confirmation dialog should be shown */
    pendingTutorialExit: boolean;
    /** Step index to start from after restart confirmation */
    _pendingStepIndex: number;

    // ── Actions ──
    /** Start the tutorial from step 0 */
    startTutorial: () => void;
    /** Confirm the restart after user approval */
    confirmRestart: () => void;
    /** Cancel the restart dialog */
    cancelRestart: () => void;
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
// Store Implementation
// ─────────────────────────────────────────────

export const useTutorialStore = create<TutorialState>()(
    persist(
        (set, get) => ({
            isActive: false,
            currentStepIndex: 0,
            hasCompleted: false,
            pendingTutorialRestart: false,
            pendingTutorialExit: false,
            _pendingStepIndex: 0,

            startTutorial: () => {
                // Check if there is existing data that would be lost
                const mitiState = useMitigationStore.getState();
                const hasData = mitiState.timelineEvents.length > 0
                    || mitiState.timelineMitigations.length > 0
                    || mitiState.partyMembers.some((m: any) => m.jobId !== null);

                if (hasData) {
                    set({ pendingTutorialRestart: true, _pendingStepIndex: 0 });
                } else {
                    set({ isActive: true, currentStepIndex: 0 });
                }
            },

            confirmRestart: () => {
                useMitigationStore.getState().resetForTutorial();
                const stepIndex = get()._pendingStepIndex;
                set({ isActive: true, currentStepIndex: stepIndex, pendingTutorialRestart: false, _pendingStepIndex: 0 });
            },

            cancelRestart: () => {
                set({ pendingTutorialRestart: false, _pendingStepIndex: 0 });
            },

            startFromStep: (stepIndex: number) => {
                if (stepIndex >= 0 && stepIndex < TUTORIAL_STEPS.length) {
                    const mitiState = useMitigationStore.getState();
                    const hasData = mitiState.timelineEvents.length > 0
                        || mitiState.timelineMitigations.length > 0
                        || mitiState.partyMembers.some((m: any) => m.jobId !== null);

                    if (hasData) {
                        set({ pendingTutorialRestart: true, _pendingStepIndex: stepIndex });
                    } else {
                        set({ isActive: true, currentStepIndex: stepIndex });
                    }
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
                const currentStep = TUTORIAL_STEPS[currentStepIndex];

                // --- Undo Logic for Tutorial Backwards Navigation ---
                if (currentStep) {
                    const mitiState = useMitigationStore.getState();

                    if (currentStep.id === 'tutorial-7d-aoe-success') {
                        // Undo AoE Mitigation added at 4s
                        const placed = mitiState.timelineMitigations.find(m => m.time === 4 && m.duration >= 10);
                        if (placed) mitiState.removeMitigation(placed.id);
                    } else if (currentStep.id === 'tutorial-8e-tb-success' || currentStep.id === 'tutorial-8d-tb-target') {
                        // Undo targeted buff added at 10s (Not MT's own buff)
                        const placedBuff = mitiState.timelineMitigations.find(m => m.time === 10 && m.ownerId !== 'MT');
                        if (placedBuff && currentStep.id === 'tutorial-8e-tb-success') {
                            mitiState.removeMitigation(placedBuff.id);
                        }
                    } else if (currentStep.id === 'tutorial-10-my-job-highlight') {
                        // Undo manually created event
                        const createdEvent = mitiState.timelineEvents.find(e => e.time !== 4 && e.time !== 10);
                        if (createdEvent) mitiState.removeEvent(createdEvent.id);
                    } else if (currentStep.id === 'tutorial-9a-add-mechanic-btn') {
                        // Ensure modal is closed if we're backing out of step 9
                        // The app might not have a direct close from here but it's handled by typical user interactions.
                    }
                }

                const prevIndex = currentStepIndex - 1;
                if (prevIndex >= 0) {
                    set({ currentStepIndex: prevIndex });
                }
            },

            completeTutorial: () => {
                useMitigationStore.getState().resetForTutorial();
                set({ isActive: false, hasCompleted: true, currentStepIndex: 0 });
            },

            skipTutorial: () => {
                useMitigationStore.getState().resetForTutorial();
                set({ isActive: false, hasCompleted: true, currentStepIndex: 0, pendingTutorialExit: false });
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
                        // Pre-populate timeline for the second half of the tutorial
                        const mitiState = useMitigationStore.getState();
                        const party = mitiState.partyMembers;
                        const h1 = party.find((p) => p.id === 'H1');
                        const mt = party.find((p) => p.id === 'MT');

                        if (h1 && mt && mt.jobId) {
                            // 1. AoE Event (108% of H1 HP)
                            mitiState.addEvent({
                                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
                                name: { ja: '全体攻撃サンプル', en: 'AoE Sample' },
                                time: 4,
                                damageAmount: Math.floor(h1.stats.hp * 1.08),
                                damageType: 'unavoidable',
                                target: 'AoE',
                            });

                            // 2. TB Event (170% of MT HP)
                            const tbEventId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
                            mitiState.addEvent({
                                id: tbEventId,
                                name: { ja: 'タンクバスター', en: 'Tank Buster' },
                                time: 10,
                                // ~195% HP ensures it is still strictly lethal even with ~46% mitigation applied.
                                damageAmount: Math.floor(mt.stats.hp * 1.95),
                                damageType: 'physical',
                                target: 'MT',
                            });

                            // 3. Pre-place MT's 120s mitigation (family: 'tank_40')
                            // All tank 120s mitigations share family 'tank_40' (e.g. Shadowed Vigil, Guardian, Great Nebula)
                            const mt120sMiti = MITIGATIONS.find(m => m.jobId === mt.jobId && m.family === 'tank_40');
                            if (mt120sMiti) {
                                mitiState.addMitigation({
                                    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'mit_' + Math.random().toString(36).substring(2, 9),
                                    mitigationId: mt120sMiti.id,
                                    time: 10,
                                    duration: mt120sMiti.duration,
                                    ownerId: 'MT',
                                });
                            }
                        }

                        // Auto-scroll to the first tutorial event
                        setTimeout(() => {
                            const scrollContainer = document.querySelector('.timeline-scroll-container');
                            const row = document.querySelector('[data-time-row="3"]') as HTMLElement;
                            if (scrollContainer && row) {
                                scrollContainer.scrollTo({
                                    top: row.offsetTop, // Snap top edge exactly to the container
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
            partialize: (state) => ({ hasCompleted: state.hasCompleted }),
        }
    )
);

