export function isSmoothScrollSupported(win: Window): boolean {
    if (typeof win.matchMedia !== 'function') return false;
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!win.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
    return true;
}
