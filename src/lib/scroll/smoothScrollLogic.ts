export function isSmoothScrollSupported(win: Window): boolean {
    if (typeof win.matchMedia !== 'function') return false;
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!win.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
    return true;
}

export type ScrollBoundary = 'top' | 'bottom' | null;

export function isAtScrollBoundary(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
    deltaY: number,
): ScrollBoundary {
    const max = scrollHeight - clientHeight;
    if (max <= 0) return null;
    if (scrollTop <= 0 && deltaY < 0) return 'top';
    if (scrollTop >= max - 1 && deltaY > 0) return 'bottom';
    return null;
}

export interface SpringState {
    targetDy: number;
    velY: number;
}

export interface SpringStepResult {
    state: SpringState;
    stepY: number;
    atRest: boolean;
}

export function springStep(
    state: SpringState,
    dt: number,
    stiffness: number,
    damping: number,
    maxDt: number,
): SpringStepResult {
    if (state.targetDy === 0 && state.velY === 0) {
        return { state: { targetDy: 0, velY: 0 }, stepY: 0, atRest: true };
    }
    const dtClamped = Math.min(maxDt, dt);
    const a = stiffness * state.targetDy - damping * state.velY;
    const velY = state.velY + a * dtClamped;
    const stepY = velY * dtClamped;
    const targetDy = state.targetDy - stepY;
    const atRest = Math.abs(targetDy) < 0.05 && Math.abs(velY) < 0.5;
    if (atRest) {
        return { state: { targetDy: 0, velY: 0 }, stepY, atRest: true };
    }
    return { state: { targetDy, velY }, stepY, atRest: false };
}
