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
    animating: boolean; // true → entering chars get .enter class (animated), false → static .ch only
}

// 設計書 Revision 3 の値（変えるなら spec も同期更新）
const EXIT_DURATION_MS = 150;
const EXIT_STAGGER_MS = 12;

function exitTotalMs(charCount: number): number {
    return EXIT_DURATION_MS + Math.max(0, charCount - 1) * EXIT_STAGGER_MS;
}

export function AnimatedDamage({ value, isLethal = false, className }: AnimatedDamageProps) {
    const initialChars = value.toLocaleString().split('');
    const [renderState, setRenderState] = useState<RenderState>({
        exiting: [],
        entering: initialChars,
        animating: false,
    });
    const prevValueRef = useRef(value);
    const prevIsLethalRef = useRef(isLethal);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const valueChanged = prevValueRef.current !== value;
        const lethalChanged = prevIsLethalRef.current !== isLethal;
        if (!valueChanged && !lethalChanged) return;

        const newChars = value.toLocaleString().split('');
        prevValueRef.current = value;
        prevIsLethalRef.current = isLethal;

        // 致死状態が変化していない → サイレント更新（アニメ無し）
        if (!lethalChanged) {
            // 既存の swap タイマーが走っている場合は、それは尊重する（サイレント更新がアニメを上書きしないように）
            if (timerRef.current !== null) {
                // mid-swap 中: 直近の swap が完了するまで待つ。entering を新値に差し替えて、アニメは継続
                setRenderState(prev => ({ ...prev, entering: newChars }));
                return;
            }
            setRenderState({ exiting: [], entering: newChars, animating: false });
            return;
        }

        // 致死状態が反転 → オーバーラップ swap 起動
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // 旧 entering を exiting に移し、新値を entering に置く（並行レンダー）
        setRenderState(prev => ({
            exiting: prev.entering,
            entering: newChars,
            animating: true,
        }));

        const oldCharCount = renderState.entering.length;
        const totalExit = exitTotalMs(oldCharCount);

        timerRef.current = window.setTimeout(() => {
            // exit 完了後、exit layer を DOM から除去
            requestAnimationFrame(() => {
                setRenderState(prev => ({ exiting: [], entering: prev.entering, animating: prev.animating }));
                timerRef.current = null;
            });
        }, totalExit);
    }, [value, isLethal]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    return (
        <div className={`dmg-slot ${isLethal ? 'lethal' : ''} ${className ?? ''}`.trim().replace(/\s+/g, ' ')}>
            {renderState.exiting.length > 0 && (
                <div className="dmg-layer-exit">
                    {renderState.exiting.map((ch, i) => (
                        <span key={`exit-${i}`} className="ch exit" style={{ ['--i' as never]: i }}>
                            {ch}
                        </span>
                    ))}
                </div>
            )}
            <div className="dmg-layer-enter">
                {renderState.entering.map((ch, i) => (
                    <span
                        key={renderState.animating ? `enter-${value}-${i}` : `static-${i}`}
                        className={renderState.animating ? "ch enter" : "ch"}
                        style={{ ['--i' as never]: i }}
                    >
                        {ch}
                    </span>
                ))}
            </div>
        </div>
    );
}
