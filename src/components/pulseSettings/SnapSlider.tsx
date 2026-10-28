import { useState, useRef, useCallback } from 'react';

const PULSE_MIN = 1;
const PULSE_MAX = 5;

// 吸着スライダー
export const SnapSlider: React.FC<{
    value: number;
    onChange: (v: number) => void;
    leftLabel: string;
    rightLabel: string;
    disabled?: boolean;
    min?: number;
    max?: number;
}> = ({ value, onChange, leftLabel, rightLabel, disabled, min = PULSE_MIN, max = PULSE_MAX }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const getValueFromX = useCallback((clientX: number) => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (max - min) + min);
    }, [value, min, max]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onChange(getValueFromX(e.clientX));
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || disabled) return;
        onChange(getValueFromX(e.clientX));
    };

    const handlePointerUp = () => setDragging(false);

    const percent = ((value - min) / (max - min)) * 100;

    return (
        <div className="flex items-center gap-2">
            <span className="text-app-xs text-app-text-muted min-w-4 whitespace-nowrap text-right shrink-0">{leftLabel}</span>
            <div
                ref={trackRef}
                className="relative flex-1 h-5 flex items-center cursor-pointer"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <div className="absolute left-0 right-0 h-[2px] bg-app-border rounded-full" />
                <div className="absolute left-0 h-[2px] bg-app-text/40 rounded-full" style={{ width: `${percent}%` }} />
                {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(step => (
                    <div
                        key={step}
                        className={`absolute w-1 h-1 rounded-full -translate-x-1/2 ${step <= value ? 'bg-app-text/60' : 'bg-app-border'}`}
                        style={{ left: `${((step - min) / (max - min)) * 100}%` }}
                    />
                ))}
                <div
                    className="absolute w-3 h-3 rounded-full bg-app-text border-2 border-app-bg -translate-x-1/2 transition-[left] duration-75 shadow-sm"
                    style={{ left: `${percent}%` }}
                />
            </div>
            <span className="text-app-xs text-app-text-muted min-w-4 whitespace-nowrap shrink-0">{rightLabel}</span>
        </div>
    );
};
