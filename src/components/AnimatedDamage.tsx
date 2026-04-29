import { useEffect, useRef, useState } from 'react';
import './AnimatedDamage.css';

interface AnimatedDamageProps {
    value: number;
    isLethal?: boolean;
    className?: string;
}

interface RenderState {
    exiting: string[];
    entering: string[];
}

// 設計書の値（変えるなら spec も同期更新）
const EXIT_DURATION_MS = 120;
const EXIT_STAGGER_MS = 10;
const SWAP_DELAY_MS = 10;

function exitTotalMs(charCount: number): number {
    return EXIT_DURATION_MS + Math.max(0, charCount - 1) * EXIT_STAGGER_MS;
}

export function AnimatedDamage({ value, className }: AnimatedDamageProps) {
    const initialChars = value.toLocaleString().split('');
    const [renderState, setRenderState] = useState<RenderState>({
        exiting: [],
        entering: initialChars,
    });
    const prevValueRef = useRef(value);
    const timerRef = useRef<number | null>(null);
    const hasChangedOnceRef = useRef(false);

    useEffect(() => {
        if (prevValueRef.current === value) return;
        prevValueRef.current = value;

        const newChars = value.toLocaleString().split('');
        hasChangedOnceRef.current = true;

        // mid-swap 中の割り込み: 既存タイマーをキャンセルし、即 enter フェーズへ
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            setRenderState({ exiting: [], entering: newChars });
            return;
        }

        // 通常の swap: 旧 chars を exit に移し、タイマーで enter
        setRenderState(prev => ({
            exiting: prev.entering,
            entering: [],
        }));

        const oldCharCount = renderState.entering.length;
        const totalExit = exitTotalMs(oldCharCount) + SWAP_DELAY_MS;

        timerRef.current = window.setTimeout(() => {
            setRenderState({ exiting: [], entering: newChars });
            timerRef.current = null;
        }, totalExit);
    }, [value]); // renderState.entering は意図的に依存配列に含めない（無限ループ回避）

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    return (
        <div className={`dmg-slot ${className ?? ''}`.trim()}>
            {renderState.exiting.map((ch, i) => (
                <span key={`exit-${i}`} className="ch exit" style={{ ['--i' as never]: i }}>
                    {ch}
                </span>
            ))}
            {renderState.entering.map((ch, i) => {
                // .enter クラスは hasChangedOnce かつ exiting が空のときだけ付与
                const shouldHaveEnterClass = hasChangedOnceRef.current && renderState.exiting.length === 0;
                const fullClass = `ch${shouldHaveEnterClass ? ' enter' : ''}`;
                return (
                    <span key={`enter-${value}-${i}`} className={fullClass} style={{ ['--i' as never]: i }}>
                        {ch}
                    </span>
                );
            })}
        </div>
    );
}
