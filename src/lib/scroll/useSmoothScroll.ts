import { useEffect, useRef, type RefObject } from 'react';
import Lenis from 'lenis';
import { isSmoothScrollSupported } from './smoothScrollLogic';

const EASE_OUT_EXPO = (t: number): number => Math.min(1, 1.001 - Math.pow(2, -10 * t));

/**
 * Lenis をページ全体 (document) に適用するスムーズスクロール hook。
 * PC + 非 reduce-motion 環境のみ起動。 触り心地は booklage と同じ。
 */
export function useSmoothScroll(): RefObject<Lenis | null> {
    const lenisRef = useRef<Lenis | null>(null);

    useEffect(() => {
        if (!isSmoothScrollSupported(window)) return;

        const lenis = new Lenis({
            duration: 1.2,
            easing: EASE_OUT_EXPO,
            touchMultiplier: 2,
        });
        lenisRef.current = lenis;

        let rafId = 0;
        const raf = (time: number): void => {
            lenis.raf(time);
            rafId = requestAnimationFrame(raf);
        };
        rafId = requestAnimationFrame(raf);

        return () => {
            cancelAnimationFrame(rafId);
            lenis.destroy();
            lenisRef.current = null;
        };
    }, []);

    return lenisRef;
}
