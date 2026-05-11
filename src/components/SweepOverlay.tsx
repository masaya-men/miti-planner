// LocalImportDialog で先行実装した B2 sweep アニメをコンポーネント化したもの。
// ShareImportSheet (青、 取り込み) と LimitResolutionSheet (赤、 削除) で共有する。
// 行の中で `position: relative` の親に `position: absolute` で重ねて使う想定。
//
// 重要 (Phase B-1.5 polish 第 2 弾 #4 fix-2): 旧実装は status='active' で mount した
// 瞬間 width=100% で出すため、 CSS transition が「値変化」 を検知できず 0→100% の
// 充填アニメが視認できなかった。 useState で '0%' で mount し、 useEffect + rAF で
// '100%' に flip することで、 ブラウザが 0% を 1 フレーム描画してから 100% への
// transition を確実に走らせる。
import { useState, useEffect } from 'react';

interface SweepOverlayProps {
    /** idle: 描画前 (width 0%) / active: 走らせ中 (width 0→100%) / success / failed: 100% 維持 */
    status: 'idle' | 'active' | 'success' | 'failed';
    /** blue: 取り込み演出 / red: 削除演出 */
    color: 'blue' | 'red';
    /** sweep 1 本の所要時間 (ms)、 デフォルト 1200ms */
    durationMs?: number;
}

const DEFAULT_DURATION_MS = 1200;

export function SweepOverlay({ status, color, durationMs = DEFAULT_DURATION_MS }: SweepOverlayProps) {
    // success/failed は即座に 100% で表示 (旧仕様の「瞬時」 を維持)。
    // active / idle は初期 '0%' → useEffect で flip して transition を発火。
    const [width, setWidth] = useState<string>(
        status === 'success' || status === 'failed' ? '100%' : '0%',
    );

    useEffect(() => {
        if (status === 'active') {
            // 次フレームで '100%' に flip → CSS transition が 0→100% を走らせる。
            const rafId = requestAnimationFrame(() => setWidth('100%'));
            return () => cancelAnimationFrame(rafId);
        }
        if (status === 'success' || status === 'failed') {
            setWidth('100%');
        } else {
            setWidth('0%');
        }
    }, [status]);

    const bg =
        color === 'red'
            ? 'var(--color-app-red-dim)'
            : 'var(--color-app-blue-dim)';
    return (
        <div
            aria-hidden
            style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width,
                background: bg,
                // active のときだけ width 0→100% の linear アニメ。
                // success/failed/idle は瞬時 (transition なし)。
                transition: status === 'active' ? `width ${durationMs}ms linear` : 'none',
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    );
}
