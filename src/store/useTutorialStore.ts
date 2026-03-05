import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        targetSelector: '[data-tutorial="slots-area"]',
        titleKey: 'tutorial.party_slots_title',
        descriptionKey: 'tutorial.party_slots_desc',
        completionEvent: 'party:four-set',
        route: 'miti',
    },
    // Step 4: Party composition — remaining 4 via palette
    {
        id: 'party-palette',
        targetSelector: '[data-tutorial="palette-area"]',
        titleKey: 'tutorial.party_palette_title',
        descriptionKey: 'tutorial.party_palette_desc',
        completionEvent: 'party:all-set',
        route: 'miti',
    },
    // Step 5: Save Settings
    {
        id: 'party-save',
        targetSelector: '[data-tutorial="party-save-btn"]',
        titleKey: 'tutorial.party_save_title',
        descriptionKey: 'tutorial.party_save_desc',
        completionEvent: 'party-settings:closed',
        route: 'miti',
    },
    // Step 6: Expand timeline row
    {
        id: 'row-expand',
        targetSelector: '[data-tutorial="row-expand-btn"]',
        titleKey: 'tutorial.row_expand_title',
        descriptionKey: 'tutorial.row_expand_desc',
        completionEvent: 'timeline:row-expanded',
        route: 'miti',
    },
    // Step 7: Place mitigation
    {
        id: 'miti-place',
        targetSelector: '[data-tutorial="miti-cell"]',
        titleKey: 'tutorial.miti_place_title',
        descriptionKey: 'tutorial.miti_place_desc',
        completionEvent: 'mitigation:placed',
        route: 'miti',
    },
    // Step 8: Completion Dialog
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

    // ── Actions ──
    /** Start the tutorial from step 0 */
    startTutorial: () => void;
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

            startTutorial: () => {
                set({ isActive: true, currentStepIndex: 0 });
            },

            startFromStep: (stepIndex: number) => {
                if (stepIndex >= 0 && stepIndex < TUTORIAL_STEPS.length) {
                    set({ isActive: true, currentStepIndex: stepIndex });
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
                const prevIndex = currentStepIndex - 1;
                if (prevIndex >= 0) {
                    set({ currentStepIndex: prevIndex });
                }
            },

            completeTutorial: () => {
                set({ isActive: false, hasCompleted: true, currentStepIndex: 0 });
            },

            skipTutorial: () => {
                set({ isActive: false, hasCompleted: true, currentStepIndex: 0 });
            },

            resetTutorial: () => {
                set({ isActive: false, hasCompleted: false, currentStepIndex: 0 });
            },

            completeEvent: (eventName: string) => {
                const { isActive, currentStepIndex } = get();
                if (!isActive) return;

                const currentStep = TUTORIAL_STEPS[currentStepIndex];
                if (currentStep && currentStep.completionEvent === eventName) {
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
