import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import { useThemeStore } from '../store/useThemeStore';
import clsx from 'clsx';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

// Padding around the spotlight cutout (px)
const SPOTLIGHT_PADDING = 8;
// Border radius for the spotlight cutout (px)
const SPOTLIGHT_RADIUS = 12;

// ─────────────────────────────────────────────
// Hook: useTargetRect
// Tracks position/size of a DOM element by selector.
// Uses ResizeObserver + scroll listeners for reactivity.
// ─────────────────────────────────────────────

function useTargetRect(selector: string): TargetRect | null {
    const [rect, setRect] = useState<TargetRect | null>(null);

    // ─────────────────────────────────────────────
    // Measure target element position
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!selector) {
            setRect(null);
            return;
        }

        let animationFrameId: number;
        let lastRectStr = '';

        const measure = () => {
            const el = document.querySelector(selector); // Use the hook's selector prop
            if (el) {
                const rect = el.getBoundingClientRect();
                const rectStr = `${rect.x},${rect.y},${rect.width},${rect.height}`;

                // Only update React state if the rect actually changed to prevent infinite loops
                if (rectStr !== lastRectStr) {
                    lastRectStr = rectStr;
                    setRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
                }
            } else {
                if (lastRectStr !== 'null') {
                    lastRectStr = 'null';
                    setRect(null);
                }
            }
            animationFrameId = requestAnimationFrame(measure);
        };

        // Start measurement loop
        animationFrameId = requestAnimationFrame(measure);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [selector]); // Dependency on selector

    return rect;
}

// ─────────────────────────────────────────────
// Sub-component: SpotlightOverlay
// Renders the semi-transparent mask with a
// rectangular cutout around the target element.
// ─────────────────────────────────────────────

const SpotlightOverlay: React.FC<{ targetRect: TargetRect | null }> = ({ targetRect }) => {
    if (!targetRect) return null;

    const x = targetRect.left - SPOTLIGHT_PADDING;
    const y = targetRect.top - SPOTLIGHT_PADDING;
    const w = targetRect.width + SPOTLIGHT_PADDING * 2;
    const h = targetRect.height + SPOTLIGHT_PADDING * 2;

    return (
        <>
            <svg
                className="fixed inset-0 w-full h-full z-[10001] pointer-events-none"
                style={{ isolation: 'isolate' }}
            >
                <defs>
                    <mask id="tutorial-spotlight-mask">
                        {/* White = visible (the dark overlay) */}
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {/* Black = transparent (the cutout) */}
                        <rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            rx={SPOTLIGHT_RADIUS}
                            ry={SPOTLIGHT_RADIUS}
                            fill="black"
                        />
                    </mask>
                </defs>
                {/* Semi-transparent overlay with mask */}
                <rect
                    x="0" y="0"
                    width="100%" height="100%"
                    fill="rgba(0,0,0,0.75)"
                    mask="url(#tutorial-spotlight-mask)"
                />
                {/* Glow border around cutout */}
                <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={SPOTLIGHT_RADIUS}
                    ry={SPOTLIGHT_RADIUS}
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.4)"
                    strokeWidth="2"
                    className="animate-tutorial-ripple"
                    style={{ transformOrigin: 'center' }}
                />
            </svg>
            {/* The ripple effect handles the glow now, so we remove the breathing div */}
        </>
    );
};

// ─────────────────────────────────────────────
// Sub-component: Tooltip
// Glassmorphism tooltip that positions itself
// relative to the target element.
// ─────────────────────────────────────────────

interface TooltipProps {
    title: string;
    description: string;
    stepIndex: number;
    totalSteps: number;
    onSkip: () => void;
    onPrev: () => void;
}

const Tooltip: React.FC<TooltipProps> = ({
    title, description, stepIndex, totalSteps, onSkip, onPrev
}) => {
    const { t } = useTranslation();
    const theme = useThemeStore((s) => s.theme);

    // Completely centered position, ignoring placement/anchorRect
    const getPosition = (): React.CSSProperties => {
        return {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
        };
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%', transform: 'translate(-50%, -50%)' }}
            exit={{ opacity: 0, scale: 0.96, x: '-50%' }}
            transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
            className={clsx(
                "fixed z-[10002] w-[360px] max-w-[90vw] rounded-2xl border p-6 text-center",
                "backdrop-blur-xl shadow-2xl",
                theme === 'dark'
                    ? "bg-slate-900/90 border-cyan-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                    : "bg-white/90 border-blue-200/40 shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
            )}
            style={{ ...getPosition(), pointerEvents: 'auto' }}
        >
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
                {Array.from({ length: totalSteps }, (_, i) => (
                    <div
                        key={i}
                        className={clsx(
                            "h-2 rounded-full transition-all duration-300",
                            i === stepIndex ? "w-8 bg-app-accent shadow-[0_0_8px_rgba(56,189,248,0.5)]" : "w-2 bg-app-text-muted/30"
                        )}
                    />
                ))}
            </div>

            <div className="mb-4 text-xs font-bold text-app-accent uppercase tracking-widest">
                STEP {stepIndex + 1}
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-app-text mb-3">{title}</h3>

            {/* Description */}
            <p className="text-sm text-app-text-sec leading-relaxed mb-6 mx-auto max-w-[90%]">{description}</p>

            {/* Actions */}
            <div className="flex items-center justify-between">
                <div>
                    {stepIndex > 0 && (
                        <button
                            onClick={onPrev}
                            className="text-xs text-app-accent hover:text-app-text transition-colors cursor-pointer font-bold"
                        >
                            &larr; {t('tutorial.prev', '一つ戻る')}
                        </button>
                    )}
                </div>
                <button
                    onClick={onSkip}
                    className="text-xs text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
                >
                    {t('tutorial.skip')}
                </button>
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────
// Sub-component: CompletionDialog
// Centered dialog for the final tutorial step.
// ─────────────────────────────────────────────

interface CompletionDialogProps {
    title: string;
    description: string;
    onComplete: () => void;
}

const CompletionDialog: React.FC<CompletionDialogProps> = ({ title, description, onComplete }) => {
    const { t } = useTranslation();
    const theme = useThemeStore((s) => s.theme);

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-sm"
            />
            {/* Dialog */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
                className={clsx(
                    "fixed z-[99999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                    "w-[400px] max-w-[90vw] rounded-2xl border p-8 text-center",
                    "backdrop-blur-xl shadow-2xl",
                    theme === 'dark'
                        ? "bg-slate-900/95 border-cyan-500/20 shadow-[0_16px_64px_rgba(0,0,0,0.7)]"
                        : "bg-white/95 border-blue-200/40 shadow-[0_16px_64px_rgba(0,0,0,0.15)]"
                )}
            >
                {/* Celebration emoji */}
                <div className="text-5xl mb-4">🎉</div>

                <h3 className="text-xl font-bold text-app-text mb-3">{title}</h3>
                <p className="text-sm text-app-text-sec leading-relaxed mb-6">{description}</p>

                <button
                    onClick={onComplete}
                    className={clsx(
                        "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer",
                        "bg-app-accent text-white hover:brightness-110 active:scale-95",
                        "shadow-[0_4px_12px_rgba(56,189,248,0.3)]"
                    )}
                >
                    {t('tutorial.complete')}
                </button>
            </motion.div>
        </>
    );
};

// ─────────────────────────────────────────────
// Main Component: TutorialOverlay
// Orchestrates the spotlight, tooltip, and
// completion dialog based on tutorial store state.
// ─────────────────────────────────────────────

export const TutorialOverlay: React.FC = () => {
    const { isActive, currentStepIndex, skipTutorial, completeEvent } =
        useTutorialStore();
    const { t } = useTranslation();

    const currentStep = TUTORIAL_STEPS[currentStepIndex];
    const targetRect = useTargetRect(isActive && currentStep ? currentStep.targetSelector : '');

    // Determine the current route context
    const location = useLocation();
    const currentRoute = location.pathname === '/' ? 'portal' : 'miti';

    // If step targets a different route, don't render anything (no blocking)
    const stepRoute = currentStep?.route ?? 'miti';
    const routeMatch = stepRoute === currentRoute;

    // Dynamically apply uniform highlight CSS class to the DOM target
    useEffect(() => {
        if (!isActive || !currentStep?.targetSelector || !routeMatch) return;

        const selector = currentStep.targetSelector;
        let animationFrameId: number;
        let currentTarget: Element | null = null;

        const attachClass = () => {
            const el = document.querySelector(selector);
            if (el !== currentTarget) {
                if (currentTarget) currentTarget.classList.remove('tutorial-target-highlight');
                if (el) el.classList.add('tutorial-target-highlight');
                currentTarget = el;
            }
            animationFrameId = requestAnimationFrame(attachClass);
        };

        animationFrameId = requestAnimationFrame(attachClass);

        return () => {
            cancelAnimationFrame(animationFrameId);
            if (currentTarget) currentTarget.classList.remove('tutorial-target-highlight');
        };
    }, [currentStep?.targetSelector, isActive, routeMatch]);

    // Allow clicking through to the target element while blocking everything else
    useEffect(() => {
        if (!isActive || !currentStep || !routeMatch) return;

        const handleClick = (e: MouseEvent) => {
            // If the step is a dialog, don't intercept clicks (dialog handles its own)
            if (currentStep.isDialog) return;

            const target = e.target as HTMLElement;

            // Allow clicks on the tooltip itself (skip button etc.)
            if (target.closest('[data-tutorial-tooltip]')) return;

            // Allow clicks inside tutorial-managed modals (e.g., PartySettingsModal)
            if (target.closest('[data-tutorial-modal]')) return;

            // Allow clicks on the highlighted target element
            const targetEl = document.querySelector(currentStep.targetSelector);
            if (targetEl && (targetEl === target || targetEl.contains(target))) return;

            // Block all other clicks
            e.preventDefault();
            e.stopPropagation();
        };

        // Capture phase to intercept early
        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, [isActive, currentStep, routeMatch]);

    if (!routeMatch) return null;

    return (
        <AnimatePresence>
            {isActive && currentStep && (
                currentStep.isDialog ? (
                    <CompletionDialog
                        key="dialog"
                        title={t(currentStep.titleKey)}
                        description={t(currentStep.descriptionKey)}
                        onComplete={() => {
                            completeEvent('tutorial:acknowledged');
                        }}
                    />
                ) : (
                    <div key="overlay" data-tutorial-overlay className="fixed inset-0 z-[99999] pointer-events-none">
                        <SpotlightOverlay targetRect={targetRect} />
                        <div data-tutorial-tooltip className="pointer-events-auto">
                            <Tooltip
                                title={t(currentStep.titleKey)}
                                description={t(currentStep.descriptionKey)}
                                stepIndex={currentStepIndex}
                                totalSteps={TUTORIAL_STEPS.length}
                                onSkip={skipTutorial}
                                onPrev={useTutorialStore.getState().prevStep}
                            />
                        </div>
                    </div>
                )
            )}
        </AnimatePresence>
    );
};
