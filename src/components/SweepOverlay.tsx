// LocalImportDialog で先行実装した B2 sweep アニメをコンポーネント化したもの。
// ShareImportSheet (青、 取り込み) と LimitResolutionSheet (赤、 削除) で共有する。
// 行の中で `position: relative` の親に `position: absolute` で重ねて使う想定。

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
    const sweepActive = status === 'active' || status === 'success' || status === 'failed';
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
                width: sweepActive ? '100%' : '0%',
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
