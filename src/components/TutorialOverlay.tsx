import React, { useEffect, useState, useCallback, useRef } from 'react';
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
// Gap between target element and tooltip (px)
const TOOLTIP_GAP = 16;

// ─────────────────────────────────────────────
// Hook: useTargetRect
// Tracks position/size of a DOM element by selector.
// Uses ResizeObserver + scroll listeners for reactivity.
// ─────────────────────────────────────────────

function useTargetRect(selector: string): TargetRect | null {
    const [rect, setRect] = useState<TargetRect | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    const measure = useCallback(() => {
        if (!selector) { setRect(null); return; }
        const el = document.querySelector(selector);
        if (!el) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, [selector]);

    useEffect(() => {
        measure();

        // Observe target element resizing
        const el = selector ? document.querySelector(selector) : null;
        if (el) {
            observerRef.current = new ResizeObserver(measure);
            observerRef.current.observe(el);
        }

        // Re-measure on scroll/resize (any scroll container)
        window.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);

        return () => {
            observerRef.current?.disconnect();
            window.removeEventListener('scroll', measure, true);
            window.removeEventListener('resize', measure);
        };
    }, [selector, measure]);

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
                className="fixed inset-0 w-full h-full z-[9998] pointer-events-none"
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
                    fill="rgba(0,0,0,0.65)"
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
                    stroke="rgba(56, 189, 248, 0.5)"
                    strokeWidth="2"
                />
            </svg>
            {/* Breathing glow div around the target */}
            <div
                className="fixed z-[9998] pointer-events-none rounded-xl animate-tutorial-breathe"
                style={{
                    top: y,
                    left: x,
                    width: w,
                    height: h,
                }}
            />
        </>
    );
};

// ─────────────────────────────────────────────
// Sub-component: Tooltip
// Glassmorphism tooltip that positions itself
// relative to the target element.
// ─────────────────────────────────────────────

interface TooltipProps {
    targetRect: TargetRect;
    placement: 'top' | 'bottom' | 'left' | 'right';
    title: string;
    description: string;
    stepIndex: number;
    totalSteps: number;
    onSkip: () => void;
}

const Tooltip: React.FC<TooltipProps> = ({
    targetRect, placement, title, description, stepIndex, totalSteps, onSkip,
}) => {
    const { t } = useTranslation();
    const theme = useThemeStore((s) => s.theme);

    // Calculate tooltip position based on placement, clamped to viewport
    const getPosition = (): React.CSSProperties => {
        const maxWidth = 340;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pad = 16; // viewport margin

        const clampLeft = (rawLeft: number) =>
            Math.max(pad, Math.min(rawLeft, vw - maxWidth - pad));
        const clampTop = (rawTop: number) =>
            Math.max(pad, Math.min(rawTop, vh - 200 - pad)); // 200 ≈ approx tooltip height

        switch (placement) {
            case 'bottom':
                return {
                    top: clampTop(targetRect.top + targetRect.height + SPOTLIGHT_PADDING + TOOLTIP_GAP),
                    left: clampLeft(targetRect.left + targetRect.width / 2 - maxWidth / 2),
                };
            case 'top':
                return {
                    bottom: Math.max(pad, vh - targetRect.top + SPOTLIGHT_PADDING + TOOLTIP_GAP),
                    left: clampLeft(targetRect.left + targetRect.width / 2 - maxWidth / 2),
                };
            case 'right':
                return {
                    top: clampTop(targetRect.top + targetRect.height / 2 - 60),
                    left: Math.min(
                        targetRect.left + targetRect.width + SPOTLIGHT_PADDING + TOOLTIP_GAP,
                        vw - maxWidth - pad
                    ),
                };
            case 'left':
                return {
                    top: clampTop(targetRect.top + targetRect.height / 2 - 60),
                    right: Math.max(pad, vw - targetRect.left + SPOTLIGHT_PADDING + TOOLTIP_GAP),
                };
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: placement === 'top' ? 8 : -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
            className={clsx(
                "fixed z-[9999] w-[340px] rounded-2xl border p-5",
                "backdrop-blur-xl shadow-2xl",
                theme === 'dark'
                    ? "bg-slate-900/90 border-cyan-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                    : "bg-white/90 border-blue-200/40 shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
            )}
            style={{ ...getPosition(), pointerEvents: 'auto' }}
        >
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {Array.from({ length: totalSteps }, (_, i) => (
                        <div
                            key={i}
                            className={clsx(
                                "h-1.5 rounded-full transition-all duration-300",
                                i === stepIndex ? "w-6 bg-app-accent" : "w-1.5 bg-app-text-muted/30"
                            )}
                        />
                    ))}
                </div>
                <span className="text-[11px] text-app-text-muted font-medium">
                    {t('tutorial.step_of', { current: stepIndex + 1, total: totalSteps })}
                </span>
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-app-text mb-2">{title}</h3>

            {/* Description */}
            <p className="text-sm text-app-text-sec leading-relaxed mb-4">{description}</p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
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
                className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            />
            {/* Dialog */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
                className={clsx(
                    "fixed z-[9999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
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

    if (!isActive || !currentStep || !routeMatch) return null;

    // If a tutorial-managed modal is open, let it handle the UI (no duplicate tooltips)
    const tutorialModalOpen = !!document.querySelector('[data-tutorial-modal] [data-tutorial="job-palette"]');
    if (tutorialModalOpen && (currentStep.id === 'party-slots' || currentStep.id === 'party-palette')) return null;

    // Render completion dialog for the final step
    if (currentStep.isDialog) {
        return (
            <AnimatePresence>
                <CompletionDialog
                    title={t(currentStep.titleKey)}
                    description={t(currentStep.descriptionKey)}
                    onComplete={() => {
                        completeEvent('tutorial:acknowledged');
                    }}
                />
            </AnimatePresence>
        );
    }

    // Render spotlight + tooltip for interactive steps
    return (
        <AnimatePresence>
            <div data-tutorial-overlay>
                <SpotlightOverlay targetRect={targetRect} />
                {targetRect && (
                    <div data-tutorial-tooltip>
                        <Tooltip
                            targetRect={targetRect}
                            placement={currentStep.placement}
                            title={t(currentStep.titleKey)}
                            description={t(currentStep.descriptionKey)}
                            stepIndex={currentStepIndex}
                            totalSteps={TUTORIAL_STEPS.length}
                            onSkip={skipTutorial}
                        />
                    </div>
                )}
            </div>
        </AnimatePresence>
    );
};
