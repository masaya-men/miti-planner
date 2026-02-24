import React, { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

export interface HighlightOverlayHandle {
    show: (time: number, memberId: string) => void;
    hide: () => void;
}

interface TimelineHighlightOverlayProps {
    memberLayout: Map<string, { left: number; width: number }>;
    pixelsPerSecond: number;
    showPreStart: boolean;
}

export const TimelineHighlightOverlay = forwardRef<HighlightOverlayHandle, TimelineHighlightOverlayProps>(({
    memberLayout,
    pixelsPerSecond,
    showPreStart
}, ref) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    const show = useCallback((time: number, memberId: string) => {
        if (!overlayRef.current) return;
        const layout = memberLayout.get(memberId);
        if (!layout) { overlayRef.current.style.display = 'none'; return; }

        const offsetTime = showPreStart ? -10 : 0;
        const top = (time - offsetTime) * pixelsPerSecond;

        overlayRef.current.style.display = 'block';
        overlayRef.current.style.top = `${top}px`;
        overlayRef.current.style.left = `${layout.left}px`;
        overlayRef.current.style.width = `${layout.width}px`;
        overlayRef.current.style.height = `${pixelsPerSecond}px`;
    }, [memberLayout, pixelsPerSecond, showPreStart]);

    const hide = useCallback(() => {
        if (!overlayRef.current) return;
        overlayRef.current.style.display = 'none';
    }, []);

    useImperativeHandle(ref, () => ({ show, hide }), [show, hide]);

    return (
        <div
            ref={overlayRef}
            className="absolute z-10 pointer-events-none rounded"
            style={{
                display: 'none',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)',
                boxShadow: '0 0 15px rgba(255,255,255,0.15), inset 0 0 20px rgba(255,255,255,0.05)',
                borderTop: '1px solid rgba(255,255,255,0.4)',
                borderLeft: '1px solid rgba(255,255,255,0.3)',
                borderRight: '1px solid rgba(255,255,255,0.1)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {/* Top Shine */}
            <div className="absolute -top-[1px] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
        </div>
    );
});
