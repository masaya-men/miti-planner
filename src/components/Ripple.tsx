import React, { useState, useLayoutEffect } from 'react';

interface RippleProps { color?: string; }

export const Ripple: React.FC<RippleProps> = ({ color = 'bg-white/40' }) => {
    const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

    useLayoutEffect(() => {
        let bounce: number;
        if (ripples.length > 0) bounce = window.setTimeout(() => setRipples([]), 600);
        return () => window.clearTimeout(bounce);
    }, [ripples]);

    const addRipple = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setRipples(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() }]);
    };

    return (
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]" onMouseDown={addRipple}>
            {ripples.map(r => (
                <span
                    key={r.id}
                    className={`absolute rounded-full pointer-events-none animate-ripple ${color}`}
                    style={{
                        top: r.y,
                        left: r.x,
                        width: 20,
                        height: 20,
                        transform: 'translate(-50%, -50%)',
                        // 👇 追加：本物の水のような光沢と屈折（歪み）のエフェクト
                        boxShadow: 'inset 0 0 15px rgba(255,255,255,0.4), 0 0 10px rgba(255,255,255,0.2)',
                        backdropFilter: 'brightness(1.2) blur(2px)'
                    }}
                />
            ))}
        </div>
    );
};