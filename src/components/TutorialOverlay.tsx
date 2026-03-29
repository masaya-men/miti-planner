import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import { useMitigationStore } from '../store/useMitigationStore';
import clsx from 'clsx';
import { X, AlertTriangle } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

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
    onPrev: () => void;
    onNext?: () => void;
    targetRects?: TargetRect[];
    stepId?: string;
    tooltipPosition?: string;
    isModalTarget?: boolean;
}

const TOOLTIP_W = 340;
const TOOLTIP_H_EST = 220; // 推定高さ
const TOOLTIP_MARGIN = 16;

// 前回位置を記憶（'keep' 用）
let _lastTooltipPos: { top: number; left: number } | null = null;

/** ターゲット要素に対してカードを配置。
 * - isModalTarget: モーダルの外側に配置し、縦軸のみ追従
 * - tooltipPosition: 'right' | 'left' | 'bottom' | 'right-center' | 'keep'
 * - デフォルト: ターゲットの右、画面端なら左
 */
function calcTooltipPos(
    targetRects: TargetRect[],
    stepId?: string,
    tooltipPosition?: string,
    isModalTarget?: boolean
): { top: number; left: number } {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const SAFE_MARGIN = 40; // 上下の余裕（見切れ防止を厚めに）

    // 'keep': 前回位置を維持（直前のクリックでターゲットが隠れるケース向け）
    if (tooltipPosition === 'keep' && _lastTooltipPos) {
        return _lastTooltipPos;
    }

    if (targetRects.length === 0) {
        // ステップ遷移中の1フレーム空振り → 前回位置を維持して中央ジャンプを防ぐ
        if (_lastTooltipPos) return _lastTooltipPos;
        const pos = { top: (vh - TOOLTIP_H_EST) / 2, left: (vw - TOOLTIP_W) / 2 };
        _lastTooltipPos = pos;
        return pos;
    }

    const rect = targetRects[0];

    // 上下の安全位置を計算するヘルパー
    const safeTop = (centerY: number) => Math.max(SAFE_MARGIN, Math.min(
        centerY - TOOLTIP_H_EST / 2,
        vh - TOOLTIP_H_EST - SAFE_MARGIN
    ));

    // --- モーダル内ターゲット: モーダルの外側に配置、縦軸のみ追従 ---
    if (isModalTarget) {
        const selector = TUTORIAL_STEPS.find(s => s.id === stepId)?.targetSelector;
        const targetEl = selector ? document.querySelector(selector) : null;
        const modal = targetEl?.closest('[data-tutorial-modal]') as HTMLElement | null;

        if (modal) {
            const modalRect = modal.getBoundingClientRect();
            const topPos = safeTop(rect.top + rect.height / 2);

            // モーダルの右 → 左 → フォールバック
            if (modalRect.right + TOOLTIP_MARGIN + TOOLTIP_W <= vw - TOOLTIP_MARGIN) {
                const pos = { top: topPos, left: modalRect.right + TOOLTIP_MARGIN };
                _lastTooltipPos = pos;
                return pos;
            }
            if (modalRect.left - TOOLTIP_MARGIN - TOOLTIP_W >= TOOLTIP_MARGIN) {
                const pos = { top: topPos, left: modalRect.left - TOOLTIP_MARGIN - TOOLTIP_W };
                _lastTooltipPos = pos;
                return pos;
            }
            const pos = { top: topPos, left: Math.max(TOOLTIP_MARGIN, vw - TOOLTIP_W - TOOLTIP_MARGIN) };
            _lastTooltipPos = pos;
            return pos;
        }
    }

    const centerY = rect.top + rect.height / 2;

    // --- 'right': ターゲットの右に強制配置 ---
    if (tooltipPosition === 'right') {
        const pos = {
            top: safeTop(centerY),
            left: Math.min(rect.left + rect.width + TOOLTIP_MARGIN, vw - TOOLTIP_W - TOOLTIP_MARGIN)
        };
        _lastTooltipPos = pos;
        return pos;
    }

    // --- 'left': ターゲットの左に強制配置 ---
    if (tooltipPosition === 'left') {
        const pos = {
            top: safeTop(centerY),
            left: Math.max(TOOLTIP_MARGIN, rect.left - TOOLTIP_W - TOOLTIP_MARGIN)
        };
        _lastTooltipPos = pos;
        return pos;
    }

    // --- 'bottom': ターゲットの下に横中央揃え ---
    if (tooltipPosition === 'bottom') {
        const pos = {
            top: Math.min(rect.top + rect.height + TOOLTIP_MARGIN, vh - TOOLTIP_H_EST - SAFE_MARGIN),
            left: Math.max(TOOLTIP_MARGIN, Math.min(
                rect.left + rect.width / 2 - TOOLTIP_W / 2,
                vw - TOOLTIP_W - TOOLTIP_MARGIN
            ))
        };
        _lastTooltipPos = pos;
        return pos;
    }

    // --- 'right-center': ターゲットの右に垂直中央揃え ---
    if (tooltipPosition === 'right-center') {
        const topPos = safeTop(centerY);
        const leftPos = rect.left + rect.width + TOOLTIP_MARGIN;
        if (leftPos + TOOLTIP_W <= vw - TOOLTIP_MARGIN) {
            const pos = { top: topPos, left: leftPos };
            _lastTooltipPos = pos;
            return pos;
        }
        const pos = { top: topPos, left: Math.max(TOOLTIP_MARGIN, rect.left - TOOLTIP_W - TOOLTIP_MARGIN) };
        _lastTooltipPos = pos;
        return pos;
    }

    // --- デフォルト: ターゲットの右、画面端なら左 ---
    const topPos = safeTop(centerY);
    const spaceRight = vw - (rect.left + rect.width + TOOLTIP_MARGIN);
    if (spaceRight >= TOOLTIP_W + TOOLTIP_MARGIN) {
        const pos = { top: topPos, left: rect.left + rect.width + TOOLTIP_MARGIN };
        _lastTooltipPos = pos;
        return pos;
    }
    const leftPos = rect.left - TOOLTIP_MARGIN - TOOLTIP_W;
    if (leftPos >= TOOLTIP_MARGIN) {
        const pos = { top: topPos, left: leftPos };
        _lastTooltipPos = pos;
        return pos;
    }
    const pos = { top: topPos, left: Math.max(TOOLTIP_MARGIN, vw - TOOLTIP_W - TOOLTIP_MARGIN) };
    _lastTooltipPos = pos;
    return pos;
}

const Tooltip: React.FC<TooltipProps> = ({
    title, description, stepIndex, totalSteps, onPrev, onNext, targetRects = [], stepId, tooltipPosition, isModalTarget
}) => {
    const { t } = useTranslation();
    const { requestExit } = useTutorialStore();

    const pos = calcTooltipPos(targetRects, stepId, tooltipPosition, isModalTarget);

    return (
        <motion.div
            initial={false}
            animate={{ top: pos.top, left: pos.left, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className={clsx(
                "fixed z-[100002] rounded-2xl border p-6 text-center",
                "shadow-lg",
                "bg-app-surface border-app-border"
            )}
            style={{ width: TOOLTIP_W, pointerEvents: 'auto' }}
        >
            {/* Close button (Top Right) — UiTooltip不使用（absoluteが崩れるため） */}
            <button
                onClick={requestExit}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
                aria-label={t('common.close')}
            >
                <X size={14} />
            </button>

            {/* Step indicator — コンパクトな数字表示 */}
            <div className="mb-4 text-xs font-bold text-app-text-muted uppercase tracking-widest">
                {t('tutorial.step_of', { current: stepIndex + 1, total: totalSteps })}
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-app-text mb-3">{title}</h3>

            {/* Description */}
            <p className="text-sm text-app-text leading-relaxed mb-6 mx-auto max-w-[90%]">{description}</p>

            <div className="flex items-center justify-center">
                <div>
                    {stepIndex > 0 && (
                        <button
                            onClick={onPrev}
                            className="text-xs text-app-text-muted hover:text-app-text transition-colors cursor-pointer font-bold"
                        >
                            &larr; {t('tutorial.prev')}
                        </button>
                    )}
                </div>
                {onNext && (
                    <div className="ml-auto">
                        <button
                            onClick={onNext}
                            className="text-xs font-black text-app-bg bg-app-text hover:opacity-80 px-5 py-2 rounded-xl transition-all cursor-pointer shadow-md animate-pulse"
                        >
                            {t('tutorial.next')} →
                        </button>
                    </div>
                )}
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
            {/* Backdrop — z-indexはTooltip(100002)より上に設定 */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100010] bg-black/50 backdrop-blur-[2px]"
            />
            {/* Dialog */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
                className={clsx(
                    "fixed z-[100011] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                    "w-[400px] max-w-[90vw] rounded-2xl border p-8 text-center",
                    "shadow-sm",
                    "bg-app-surface border-app-border"
                )}
            >
                {/* Celebration emoji */}
                <div className="text-5xl mb-4">🎉</div>

                <h3 className="text-xl font-bold text-app-text mb-3">{title}</h3>
                <p className="text-sm text-app-text leading-relaxed mb-6">{description}</p>

                <button
                    onClick={onComplete}
                    className={clsx(
                        "px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer",
                        "bg-app-accent text-app-text-on-accent hover:brightness-110 active:scale-95",
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
    const { isActive, currentStepIndex, completeEvent } =
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

            // Allow clicks inside exit confirmation dialog
            if (target.closest('[data-tutorial-exit-dialog]')) return;

            // テーマ切替・言語切替は常に操作可能
            if (target.closest('[data-tutorial-always]')) return;

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

    // Confirmation dialogs
    const pendingExit = useTutorialStore(s => s.pendingTutorialExit);
    const pendingStart = useTutorialStore(s => s.pendingTutorialStart);

    if (!routeMatch && !pendingExit && !pendingStart) return null;

    // Calculate relative step numbering for the current route
    const currentRouteSteps = TUTORIAL_STEPS.filter(step => step.route === stepRoute && !step.isDialog);
    const relativeStepIndex = currentRouteSteps.findIndex(s => s.id === currentStep?.id);
    const displayStepIndex = relativeStepIndex >= 0 ? relativeStepIndex : 0;

    return (
        <>
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
                                    onPrev={useTutorialStore.getState().prevStep}
                                    onNext={currentStep.isAcknowledgeStep ? () => completeEvent(currentStep.completionEvent) : undefined}
                                    targetRects={targetRects}
                                    stepId={currentStep.id}
                                    tooltipPosition={currentStep.tooltipPosition}
                                    isModalTarget={currentStep.isModalTarget}
                                />
                            </div>
                        </div>
                    )
                )}
            </AnimatePresence>

            {/* Exit Confirmation Dialog */}
            <AnimatePresence>
                {pendingExit && (
                    <>
                        <motion.div
                            key="exit-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100010] bg-black/50 backdrop-blur-[2px]"
                            onClick={() => useTutorialStore.getState().cancelExit()}
                        />
                        <motion.div
                            key="exit-dialog"
                            data-tutorial-exit-dialog
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
                            className={clsx(
                                "fixed z-[100011] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                                "w-[400px] max-w-[90vw] rounded-2xl border p-8 text-center",
                                "shadow-sm overflow-hidden",
                                "bg-app-surface border-app-border"
                            )}
                        >
                            <div className="flex items-center gap-3 mb-6 pr-6">
                                <div className="p-2.5 bg-amber-500/10 rounded-xl shrink-0">
                                    <AlertTriangle className="text-amber-500" size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-app-text text-left leading-tight">
                                    {t('tutorial.exit_title')}
                                </h3>
                                <button
                                    onClick={() => useTutorialStore.getState().cancelExit()}
                                    className="absolute top-6 right-6 p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <p className="text-sm text-app-text leading-relaxed mb-10 text-left px-1 font-medium">
                                {t('tutorial.exit_desc')}
                            </p>

                            <div className="flex gap-4 justify-end items-center">
                                <button
                                    onClick={() => useTutorialStore.getState().cancelExit()}
                                    className="px-6 py-2 text-sm font-bold text-app-text transition-colors cursor-pointer"
                                >
                                    {t('tutorial.exit_cancel')}
                                </button>
                                <button
                                    onClick={() => useTutorialStore.getState().confirmExit()}
                                    className={clsx(
                                        "px-8 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer",
                                        "bg-amber-500 text-white hover:brightness-110 active:scale-95",
                                        "shadow-[0_4px_12px_rgba(245,158,11,0.3)]"
                                    )}
                                >
                                    {t('tutorial.exit_confirm')}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Start Confirmation Dialog — チュートリアル開始確認 */}
            <AnimatePresence>
                {pendingStart && (
                    <>
                        <motion.div
                            key="start-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100010] bg-black/50 backdrop-blur-[2px]"
                            onClick={() => useTutorialStore.getState().cancelStart()}
                        />
                        <motion.div
                            key="start-dialog"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
                            className={clsx(
                                "fixed z-[100011] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                                "w-[420px] max-w-[90vw] rounded-2xl border p-8 text-center",
                                "shadow-sm overflow-hidden",
                                "bg-app-surface border-app-border"
                            )}
                        >
                            <button
                                onClick={() => useTutorialStore.getState().cancelStart()}
                                className="absolute top-6 right-6 p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
                            >
                                <X size={16} />
                            </button>

                            <h3 className="text-lg font-bold text-app-text text-left leading-tight mb-3 pr-8">
                                {t('tutorial.start_title')}
                            </h3>

                            <p className="text-sm text-app-text-sec leading-relaxed mb-8 text-left">
                                {t('tutorial.start_desc')}
                            </p>

                            <div className="flex items-center">
                                {/* 言語切り替え — 海外ユーザー向け */}
                                <LanguageSwitcher />
                                <div className="flex gap-3 ml-auto items-center">
                                    <button
                                        onClick={() => useTutorialStore.getState().cancelStart()}
                                        className="px-4 py-2 text-sm font-bold text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={() => useTutorialStore.getState().confirmStart()}
                                        className={clsx(
                                            "px-7 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer",
                                            "bg-app-text text-app-bg hover:brightness-110 active:scale-95"
                                        )}
                                    >
                                        {t('tutorial.start_confirm')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
