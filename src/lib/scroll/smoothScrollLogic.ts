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
