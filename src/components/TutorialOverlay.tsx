import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
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
// Hook: useTargetRects
// Tracks position/size of DOM elements by selector.
// Uses requestAnimationFrame for reactivity.
// ─────────────────────────────────────────────

function useTargetRects(selector: string): TargetRect[] {
    // 座標（rects）と一緒に、「どのセレクター（目印）の座標か」もセットで記憶する
    const [state, setState] = useState<{ selector: string, rects: TargetRect[] }>({ selector, rects: [] });

    // 【最重要】今探している目印と、記憶している目印が違う＝「切り替わった直後の古いデータ（名残）」と判定
    const isStale = state.selector !== selector;

    useEffect(() => {
        if (!selector) {
            setState({ selector, rects: [] });
            return;
        }

        let animationFrameId: number;
        let lastRectsStr = '';

        const measure = () => {
            const els = document.querySelectorAll(selector);
            if (els.length > 0) {
                const newRects: TargetRect[] = [];
                let rectsStr = '';
                els.forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    rectsStr += `${rect.x},${rect.y},${rect.width},${rect.height}| `;
                    newRects.push({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
                });

                if (rectsStr !== lastRectsStr) {
                    lastRectsStr = rectsStr;
                    setState({ selector, rects: newRects }); // 新しい座標と目印を保存
                }
            } else {
                if (lastRectsStr !== 'null') {
                    lastRectsStr = 'null';
                    setState({ selector, rects: [] });
                }
            }
            animationFrameId = requestAnimationFrame(measure);
        };

        animationFrameId = requestAnimationFrame(measure);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [selector]);

    // 古いデータ（名残）の場合は、強制的に空っぽ（何も光らせない）にしてUIから消し去る！
    return isStale ? [] : state.rects;
}

// ─────────────────────────────────────────────
// Sub-component: SpotlightOverlay
// Renders the semi-transparent mask with a
// rectangular cutout around the target element.
// ─────────────────────────────────────────────

const SpotlightOverlay: React.FC<{ targetRects: TargetRect[]; isModalTarget?: boolean; isTimelineStep?: boolean }> = ({ targetRects, isModalTarget, isTimelineStep }) => {
    // Removed early return so click blocker/backdrop renders even without targets

    // Build a clip-path that covers the full viewport EXCEPT the target rects (evenodd holes)
    const buildClickBlockerClipPath = (): string => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let path = `M0 0 H${vw} V${vh} H0 Z`;
        for (const rect of targetRects) {
            const x = rect.left - SPOTLIGHT_PADDING;
            const y = rect.top - SPOTLIGHT_PADDING;
            const w = rect.width + SPOTLIGHT_PADDING * 2;
            const h = rect.height + SPOTLIGHT_PADDING * 2;
            path += ` M${x} ${y} h${w} v${h} h${-w} Z`;
        }
        return `path(evenodd, "${path}")`;
    };

    return (
        <>
            {/* Spotlight Brightness Effect — only for timeline steps (no dark overlay) */}
            {isTimelineStep && !isModalTarget && (
                <div className="fixed inset-0 z-[10001] pointer-events-none overflow-hidden">
                    {targetRects.map((rect, idx) => (
                        <div
                            key={`brightness-${idx}`}
                            className="absolute transition-all duration-300"
                            style={{
                                top: rect.top - SPOTLIGHT_PADDING,
                                left: rect.left - SPOTLIGHT_PADDING,
                                width: rect.width + SPOTLIGHT_PADDING * 2,
                                height: rect.height + SPOTLIGHT_PADDING * 2,
                                borderRadius: SPOTLIGHT_RADIUS,
                                backdropFilter: 'brightness(1.8) saturate(1.2)',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Click blocker for timeline steps: transparent wall with holes over target areas */}
            {isTimelineStep && !isModalTarget && (
                <div
                    className="fixed inset-0 z-[10001]"
                    style={{
                        pointerEvents: 'auto',
                        background: 'transparent',
                        clipPath: buildClickBlockerClipPath(),
                    }}
                />
            )}

            <svg
                className="fixed inset-0 w-full h-full z-[10001] pointer-events-none"
                style={{ isolation: 'isolate' }}
            >
                {/* Dark overlay ONLY for non-timeline steps (modal-phase steps) */}
                {!isModalTarget && !isTimelineStep && (
                    <>
                        <defs>
                            <mask id="tutorial-spotlight-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                {targetRects.map((rect, idx) => (
                                    <rect
                                        key={`mask-${idx}`}
                                        x={rect.left - SPOTLIGHT_PADDING}
                                        y={rect.top - SPOTLIGHT_PADDING}
                                        width={rect.width + SPOTLIGHT_PADDING * 2}
                                        height={rect.height + SPOTLIGHT_PADDING * 2}
                                        rx={SPOTLIGHT_RADIUS}
                                        ry={SPOTLIGHT_RADIUS}
                                        fill="black"
                                    />
                                ))}
                            </mask>
                        </defs>
                        <rect
                            x="0" y="0"
                            width="100%" height="100%"
                            fill="rgba(0,0,0,0.75)"
                            mask="url(#tutorial-spotlight-mask)"
                        />
                    </>
                )}
                {/* Glow border around cutout — always rendered */}
                {targetRects.map((rect, idx) => (
                    <rect
                        key={`glow-${idx}`}
                        x={rect.left - SPOTLIGHT_PADDING}
                        y={rect.top - SPOTLIGHT_PADDING}
                        width={rect.width + SPOTLIGHT_PADDING * 2}
                        height={rect.height + SPOTLIGHT_PADDING * 2}
                        rx={SPOTLIGHT_RADIUS}
                        ry={SPOTLIGHT_RADIUS}
                        fill="none"
                        stroke="rgba(226, 232, 240, 0.5)"
                        strokeWidth="2"
                        className="animate-tutorial-ripple"
                        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
                    />
                ))}
            </svg>
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
    onNext?: () => void;
    position?: 'top' | 'right' | 'bottom' | 'left' | 'center' | 'right-center';
}

const Tooltip: React.FC<TooltipProps> = ({
    title, description, stepIndex, totalSteps, onSkip, onPrev, onNext, position = 'center'
}) => {
    const { t } = useTranslation();
    

    const getPosition = (): React.CSSProperties => {
        if (position === 'bottom') {
            return { bottom: '24px', left: '50%' };
        }
        if (position === 'right-center') {
            return { top: '50%', right: '24px' };
        }
        return { top: '50%', left: '50%' };
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96, x: position === 'right-center' ? 16 : '-50%', y: position === 'bottom' ? 8 : '-45%' }}
            animate={{ opacity: 1, scale: 1, x: position === 'right-center' ? 0 : '-50%', y: position === 'bottom' ? 0 : '-50%' }}
            exit={{ opacity: 0, scale: 0.96, x: position === 'right-center' ? 16 : '-50%', y: position === 'bottom' ? 8 : '-45%' }}
            transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
            className={clsx(
                "fixed z-[10002] w-[360px] max-w-[90vw] rounded-2xl border p-6 text-center",
                "backdrop-blur-xl shadow-2xl",
                "bg-white/90 border-slate-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:bg-black/85 dark:border-white/15 dark:shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
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
                            i === stepIndex ? "w-8 bg-app-accent shadow-[0_0_8px_rgba(226,232,240,0.5)]" : "w-2 bg-app-text-muted/30"
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
                <div className="flex items-center gap-4">
                    <button
                        onClick={onSkip}
                        className="text-xs text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
                    >
                        {t('tutorial.skip')}
                    </button>
                    {onNext && (
                        <button
                            onClick={onNext}
                            className="text-xs font-bold text-white bg-app-accent hover:brightness-110 px-4 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                            {t('tutorial.next', '次へ')} &rarr;
                        </button>
                    )}
                </div>
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
                    "bg-white/95 border-slate-200/60 shadow-[0_16px_64px_rgba(0,0,0,0.15)] dark:bg-black/95 dark:border-white/15 dark:shadow-[0_16px_64px_rgba(0,0,0,0.8)]"
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
    const targetRects = useTargetRects(isActive && currentStep ? currentStep.targetSelector : '');

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
        let currentTargets: Element[] = [];

        const attachClass = () => {
            const els = Array.from(document.querySelectorAll(selector));

            // Remove class from elements that are no longer targets
            currentTargets.forEach(el => {
                if (!els.includes(el)) el.classList.remove('tutorial-target-highlight');
            });

            // Add class to new targets
            els.forEach(el => {
                if (!currentTargets.includes(el)) el.classList.add('tutorial-target-highlight');
            });

            currentTargets = els;
            animationFrameId = requestAnimationFrame(attachClass);
        };

        animationFrameId = requestAnimationFrame(attachClass);

        return () => {
            cancelAnimationFrame(animationFrameId);
            currentTargets.forEach(el => el.classList.remove('tutorial-target-highlight'));
        };
    }, [currentStep?.targetSelector, isActive, routeMatch]);

    // Automatically scroll timeline for specific tutorial steps like the 10s TB Threat
    useEffect(() => {
        if (!isActive || !currentStep) return;

        if (currentStep.id === 'tutorial-8a-tb-danger') {
            setTimeout(() => {
                const scrollContainer = document.querySelector('.timeline-scroll-container');
                const row9 = document.querySelector('[data-time-row="9"]') as HTMLElement;
                const row10 = document.querySelector('[data-time-row="10"]') as HTMLElement;

                if (scrollContainer && (row9 || row10)) {
                    const targetTop = row9 ? row9.offsetTop : (row10 ? row10.offsetTop - 50 : 0);
                    scrollContainer.scrollTo({
                        top: targetTop,
                        behavior: 'smooth'
                    });
                }
            }, 100);
        }

        // Auto-focus input fields for mechanic-input steps (no manual click required)
        if (currentStep.id === 'tutorial-9b-name-input' || currentStep.id === 'tutorial-9c-damage-input') {
            setTimeout(() => {
                const input = document.querySelector(currentStep.targetSelector) as HTMLInputElement | null;
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 300);
        }

        // Step 10: Scroll to 9s row so the table (with my-job highlight) is visible
        if (currentStep.id === 'tutorial-10-my-job-highlight') {
            setTimeout(() => {
                const scrollContainer = document.querySelector('.timeline-scroll-container');
                const row9 = document.querySelector('[data-time-row="9"]') as HTMLElement;

                if (scrollContainer && row9) {
                    scrollContainer.scrollTo({
                        top: row9.offsetTop,
                        behavior: 'smooth'
                    });
                }
            }, 100);
        }
    }, [currentStep?.id, isActive]);

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

            // Allow clicks on the highlighted target elements
            const targetEls = Array.from(document.querySelectorAll(currentStep.targetSelector));
            const isClickInsideTarget = targetEls.some(el => el === target || el.contains(target));
            if (isClickInsideTarget) return;

            // Block all other clicks
            e.preventDefault();
            e.stopPropagation();
        };

        // Capture phase to intercept early
        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, [isActive, currentStep, routeMatch]);

    // Restart confirmation dialog
    const pendingRestart = useTutorialStore(s => s.pendingTutorialRestart);

    if (!routeMatch && !pendingRestart) return null;

    // Calculate relative step numbering for the current route
    const currentRouteSteps = TUTORIAL_STEPS.filter(step => step.route === stepRoute && !step.isDialog);
    const relativeStepIndex = currentRouteSteps.findIndex(s => s.id === currentStep?.id);
    const displayStepIndex = relativeStepIndex >= 0 ? relativeStepIndex : 0;

    return (
        <>
            {/* Restart Confirmation Dialog */}
            <AnimatePresence>
                {pendingRestart && (
                    <>
                        <motion.div
                            key="restart-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-sm"
                            onClick={() => useTutorialStore.getState().cancelRestart()}
                        />
                        <motion.div
                            key="restart-dialog"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
                            className={clsx(
                                "fixed z-[99999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                                "w-[400px] max-w-[90vw] rounded-2xl border p-8 text-center",
                                "backdrop-blur-xl shadow-2xl",
                                "bg-white/95 border-blue-200/40 shadow-[0_16px_64px_rgba(0,0,0,0.15)] dark:bg-slate-900/95 dark:border-cyan-500/20 dark:shadow-[0_16px_64px_rgba(0,0,0,0.7)]"
                            )}
                        >
                            <div className="text-4xl mb-4">⚠️</div>
                            <h3 className="text-lg font-bold text-app-text mb-3">
                                {t('tutorial.restart_title', 'チュートリアルを再開しますか？')}
                            </h3>
                            <p className="text-sm text-app-text-sec leading-relaxed mb-6">
                                {t('tutorial.restart_desc', '現在の軽減表・パーティ設定はすべてリセットされます。チュートリアル用のまっさらな状態から再スタートします。')}
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => useTutorialStore.getState().cancelRestart()}
                                    className={clsx(
                                        "px-5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border",
                                        "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                                    )}
                                >
                                    {t('tutorial.restart_cancel', 'キャンセル')}
                                </button>
                                <button
                                    onClick={() => useTutorialStore.getState().confirmRestart()}
                                    className={clsx(
                                        "px-5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer",
                                        "bg-app-accent text-white hover:brightness-110 active:scale-95",
                                        "shadow-[0_4px_12px_rgba(56,189,248,0.3)]"
                                    )}
                                >
                                    {t('tutorial.restart_confirm', 'リセットして開始')}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Tutorial Overlay */}
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
                            <SpotlightOverlay targetRects={targetRects} isModalTarget={currentStep.isModalTarget} isTimelineStep={currentStep.isTimelineStep} />
                            <div data-tutorial-tooltip className="pointer-events-auto">
                                <Tooltip
                                    title={t(currentStep.titleKey)}
                                    description={(() => {
                                        let desc = t(currentStep.descriptionKey);
                                        if (currentStep.id === 'tutorial-9c-damage-input' || currentStep.id === 'tutorial-9e-save-btn') {
                                            const h1 = useMitigationStore.getState().partyMembers.find((m: any) => m.id === 'H1');
                                            const targetNum = Math.floor(h1 ? h1.stats.hp * 0.8 : 80000);
                                            desc = desc.replace('{{damage}}', targetNum.toLocaleString());
                                        }
                                        return desc;
                                    })()}
                                    stepIndex={displayStepIndex}
                                    totalSteps={currentRouteSteps.length}
                                    onSkip={skipTutorial}
                                    onPrev={useTutorialStore.getState().prevStep}
                                    onNext={currentStep.isAcknowledgeStep ? () => completeEvent(currentStep.completionEvent) : undefined}
                                    position={currentStep.tooltipPosition}
                                />
                            </div>
                        </div>
                    )
                )}
            </AnimatePresence>
        </>
    );
};
