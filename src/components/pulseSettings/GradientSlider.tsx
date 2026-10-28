import { useState, useRef, useCallback } from 'react';

// 連続値スライダー（色相・明度用）
export const GradientSlider: React.FC<{
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    gradient: string;
    thumbColor: string;
    disabled?: boolean;
}> = ({ value, onChange, min, max, gradient, thumbColor, disabled }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const thumbW = 14; // w-3.5 = 14px
    const getValueFromX = useCallback((clientX: number) => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        // サム幅を考慮: 有効トラック範囲は (thumbW/2) 〜 (width - thumbW/2)
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left - thumbW / 2) / (rect.width - thumbW)));
        return ratio * (max - min) + min;
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
        <div
            ref={trackRef}
            className="relative h-5 flex items-center cursor-pointer rounded-full"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <div
                className="absolute left-0 right-0 h-[6px] rounded-full border border-app-border/50 overflow-hidden"
                style={{ background: gradient }}
            />
            {/* サムの幅(14px)を考慮し、端でもはみ出さないようにclamp */}
            <div
                className="absolute w-3.5 h-3.5 rounded-full border-2 border-app-bg shadow-sm transition-[left] duration-75"
                style={{ left: `calc(${percent / 100} * (100% - 14px))`, backgroundColor: thumbColor }}
            />
        </div>
    );
};
