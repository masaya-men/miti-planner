import { useEffect, useRef, useState } from 'react';

export interface MarqueeRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface MarqueeModifiers {
    shift: boolean;
    ctrl: boolean;
    meta: boolean;
}

export interface UseMarqueeSelectionOptions {
    /** Container ref. Marquee starts only when mousedown target is the container itself
     * (or an element explicitly marked with data-marquee-bg="true"). */
    containerRef: React.RefObject<HTMLElement | null>;
    /** CSS selector for selectable items. Each item must carry data-listing-id="..." */
    itemSelector: string;
    /** Called when the drag ends. Receives the selected ids plus the modifier
     *  keys held at mousedown (so callers can decide additive vs replace selection). */
    onComplete: (selectedIds: string[], modifiers: MarqueeModifiers) => void;
}

/**
 * Rubber-band selection over a container.
 *
 * Background-only: drag must start on the container itself (or a marked
 * background element). Clicking a child item does NOT trigger marquee — that
 * way per-item clicks (single select / drag) keep their normal semantics, the
 * same convention as Windows Explorer / macOS Finder.
 */
export function useMarqueeSelection({
    containerRef,
    itemSelector,
    onComplete,
}: UseMarqueeSelectionOptions) {
    const [rect, setRect] = useState<MarqueeRect | null>(null);
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const modifiersRef = useRef<MarqueeModifiers>({ shift: false, ctrl: false, meta: false });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const isBackground = target === container || target.dataset.marqueeBg === 'true';
            if (!isBackground) return;
            const cRect = container.getBoundingClientRect();
            startRef.current = { x: e.clientX - cRect.left, y: e.clientY - cRect.top };
            modifiersRef.current = { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey };
            setRect({ x: startRef.current.x, y: startRef.current.y, w: 0, h: 0 });
        };

        const onMove = (e: MouseEvent) => {
            const start = startRef.current;
            if (!start) return;
            const cRect = container.getBoundingClientRect();
            const curX = e.clientX - cRect.left;
            const curY = e.clientY - cRect.top;
            setRect({
                x: Math.min(start.x, curX),
                y: Math.min(start.y, curY),
                w: Math.abs(curX - start.x),
                h: Math.abs(curY - start.y),
            });
        };

        const onUp = (e: MouseEvent) => {
            const start = startRef.current;
            if (!start) return;
            const cRect = container.getBoundingClientRect();
            const endX = e.clientX - cRect.left;
            const endY = e.clientY - cRect.top;
            const rx1 = Math.min(start.x, endX);
            const ry1 = Math.min(start.y, endY);
            const rx2 = Math.max(start.x, endX);
            const ry2 = Math.max(start.y, endY);

            const items = container.querySelectorAll<HTMLElement>(itemSelector);
            const selected: string[] = [];
            items.forEach((el) => {
                const r = el.getBoundingClientRect();
                const ix1 = r.left - cRect.left;
                const iy1 = r.top - cRect.top;
                const ix2 = ix1 + r.width;
                const iy2 = iy1 + r.height;
                const intersects = !(ix2 < rx1 || ix1 > rx2 || iy2 < ry1 || iy1 > ry2);
                if (intersects) {
                    const id = el.dataset.listingId;
                    if (id) selected.push(id);
                }
            });

            onComplete(selected, modifiersRef.current);
            startRef.current = null;
            setRect(null);
        };

        container.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            container.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [containerRef, itemSelector, onComplete]);

    return rect;
}
