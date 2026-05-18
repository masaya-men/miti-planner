import { useEffect, useRef } from 'react';

export interface UseAutoScrollOptions {
    pxPerSecond: number;
    paused: boolean;
    /** When the bottom is reached, jump back to top */
    loop?: boolean;
}

/**
 * rAF-based auto-scroll for the right panel browse-mode list.
 * - Pauses while `paused` is true (so callers can stop on hover)
 * - When the bottom is reached, jumps back to top if `loop` is true
 * - Frame-rate independent: scroll delta is `pxPerSecond * dt`
 */
export function useAutoScroll(
    ref: React.RefObject<HTMLElement | null>,
    { pxPerSecond, paused, loop = true }: UseAutoScrollOptions,
) {
    const lastTsRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (paused) {
            lastTsRef.current = null;
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }
        const tick = (ts: number) => {
            const prev = lastTsRef.current;
            lastTsRef.current = ts;
            if (prev !== null) {
                const dt = (ts - prev) / 1000;
                const delta = pxPerSecond * dt;
                const max = el.scrollHeight - el.clientHeight;
                if (max > 0) {
                    let next = el.scrollTop + delta;
                    if (next >= max) next = loop ? 0 : max;
                    el.scrollTop = next;
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            lastTsRef.current = null;
        };
    }, [ref, pxPerSecond, paused, loop]);
}
