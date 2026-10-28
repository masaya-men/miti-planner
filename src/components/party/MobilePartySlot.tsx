import React from 'react';
import clsx from 'clsx';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import type { Job } from '../../types';

// ── パーティスロット（長押しで削除） ──
export const PartySlot: React.FC<{
    member: { id: string; jobId: string | null };
    job: Job | null;
    isFocused: boolean;
    isDropTarget: boolean;
    myJobMode: boolean;
    onTap: () => void;
    onLongPress: () => void;
}> = ({ member, job, isFocused, isDropTarget, myJobMode, onTap, onLongPress }) => {
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const movedRef = React.useRef(false);
    const startPosRef = React.useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
        if (!job) return;
        movedRef.current = false;
        const pos = 'touches' in e
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };
        startPosRef.current = pos;
        timerRef.current = setTimeout(() => {
            if (!movedRef.current) onLongPress();
        }, 400);
    };

    const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
        const pos = 'touches' in e
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };
        if (Math.abs(pos.x - startPosRef.current.x) > 8 || Math.abs(pos.y - startPosRef.current.y) > 8) {
            movedRef.current = true;
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        }
    };

    const handlePointerUp = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    React.useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    return (
        <div
            onClick={onTap}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            className={clsx(
                "flex flex-col items-center gap-1 p-2 border transition-all active:scale-95 relative cursor-pointer select-none",
                isDropTarget
                    ? "border-app-blue bg-app-blue-border ring-1 ring-app-blue"
                    : myJobMode
                        ? "border-app-text/50 bg-app-text/5"
                        : isFocused
                            ? "border-app-text bg-app-text/10"
                            : "border-app-border bg-app-surface2"
            )}
            style={{ borderRadius: MOBILE_TOKENS.party.slotRadius }}
        >
            {job ? (
                <img src={job.icon} className="w-8 h-8 object-contain pointer-events-none" />
            ) : (
                <div className="w-8 h-8 rounded-full border border-dashed border-app-border flex items-center justify-center">
                    <span className="text-app-base text-app-text-muted">+</span>
                </div>
            )}
            <span className="text-app-base font-black text-app-text">{member.id}</span>
        </div>
    );
};
