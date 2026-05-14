import { useEffect, useRef, type RefObject } from 'react';
import { isAtScrollBoundary, isSmoothScrollSupported, springStep } from './smoothScrollLogic';
import { useTutorialStore } from '../../store/useTutorialStore';

type Options = {
    readonly stiffness?: number;
    readonly disabled?: boolean;
    /** true なら Shift+ホイールで横スクロール (deltaY を scrollLeft へ即時反映、 spring なし) */
    readonly horizontalScrollOnShift?: boolean;
    /** wheel deltaY に掛ける倍率 (デフォルト 1.0)。 stiffness を下げて両端イージングを
     *  強くしつつ最高速度を維持したいときに 1.5-2.0 を指定する。 横スクロール (Shift+wheel)
     *  にも同じ倍率が適用される。 */
    readonly wheelMultiplier?: number;
    /** true なら wheel preventDefault と同時に stopPropagation も呼び、 親要素の
     *  useSmoothWheelScroll に伝播させない (= 入れ子スクロール領域での親子競合回避)。
     *  境界到達時は元から早期 return するため、 子で受けきれない場合の親へのフォール
     *  バックは維持される (子の境界で親にスクロールが委譲される)。 */
    readonly stopPropagation?: boolean;
};

const MAX_DT = 0.05;
const EXTERNAL_SCROLL_DIFF_THRESHOLD = 10;

/**
 * 特定要素のホイール縦スクロールを critical-damped spring で補間する hook。
 * 横スクロール (deltaX) と境界 (top/bottom で対応方向) ではネイティブに任せる。
 * 外部から scrollTop が大幅変動 (>10px) したら内部 state をリセット → JS scrollTo/scrollIntoView との干渉防止。
 * Tutorial 中は自動的に wheel をブロックして意図しないスクロールでターゲット要素が画面外に行くのを防ぐ。
 */
export function useSmoothWheelScroll(
    ref: RefObject<HTMLElement | null>,
    options: Options = {},
): void {
    const {
        stiffness = 200,
        disabled: explicitDisabled = false,
        horizontalScrollOnShift = false,
        wheelMultiplier = 1,
        stopPropagation = false,
    } = options;
    const isTutorialActive = useTutorialStore((s) => s.isActive);
    const disabled = explicitDisabled || isTutorialActive;
    const stateRef = useRef<{ targetDy: number; velY: number; lastTime: number }>({ targetDy: 0, velY: 0, lastTime: 0 });
    const rafRef = useRef<number | null>(null);
    const lastAppliedScrollTopRef = useRef<number>(0);

    useEffect(() => {
        if (!isSmoothScrollSupported(window)) return;
        const el = ref.current;
        if (!el) return;

        // disabled=true (Tutorial 中など): wheel を preventDefault でブロックして native scroll も止める
        if (disabled) {
            const blockHandler = (e: WheelEvent): void => { e.preventDefault(); };
            el.addEventListener('wheel', blockHandler, { passive: false });
            return (): void => { el.removeEventListener('wheel', blockHandler); };
        }

        const damping = 2 * Math.sqrt(stiffness);
        lastAppliedScrollTopRef.current = el.scrollTop;

        const step = (now: number): void => {
            const s = stateRef.current;
            const dt = s.lastTime === 0 ? 1 / 60 : (now - s.lastTime) / 1000;
            s.lastTime = now;

            const result = springStep({ targetDy: s.targetDy, velY: s.velY }, dt, stiffness, damping, MAX_DT);
            s.targetDy = result.state.targetDy;
            s.velY = result.state.velY;

            if (result.atRest) {
                s.lastTime = 0;
                rafRef.current = null;
                return;
            }

            const max = el.scrollHeight - el.clientHeight;
            const next = el.scrollTop + result.stepY;
            if (next <= 0) {
                el.scrollTop = 0;
                lastAppliedScrollTopRef.current = 0;
                s.targetDy = 0; s.velY = 0; s.lastTime = 0;
                rafRef.current = null;
                return;
            }
            if (next >= max) {
                el.scrollTop = max;
                lastAppliedScrollTopRef.current = max;
                s.targetDy = 0; s.velY = 0; s.lastTime = 0;
                rafRef.current = null;
                return;
            }
            el.scrollTop = next;
            lastAppliedScrollTopRef.current = next;

            rafRef.current = requestAnimationFrame(step);
        };

        const onWheel = (e: WheelEvent): void => {
            let dy = e.deltaY;
            if (e.deltaMode === 1) dy *= 16;
            else if (e.deltaMode === 2) dy *= window.innerHeight;
            if (dy === 0) return;
            dy *= wheelMultiplier;

            // Shift+ホイール: deltaY を scrollLeft に即時反映 (spring なし、 ネイティブ感覚優先)
            if (horizontalScrollOnShift && e.shiftKey) {
                const maxLeft = el.scrollWidth - el.clientWidth;
                if (maxLeft > 0) {
                    e.preventDefault();
                    if (stopPropagation) e.stopPropagation();
                    el.scrollLeft = Math.max(0, Math.min(maxLeft, el.scrollLeft + dy));
                }
                return;
            }

            const boundary = isAtScrollBoundary(el.scrollTop, el.scrollHeight, el.clientHeight, dy);
            if (boundary !== null) return;

            e.preventDefault();
            if (stopPropagation) e.stopPropagation();
            stateRef.current.targetDy += dy;

            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(step);
            }
        };

        const onScroll = (): void => {
            const current = el.scrollTop;
            if (Math.abs(current - lastAppliedScrollTopRef.current) > EXTERNAL_SCROLL_DIFF_THRESHOLD) {
                stateRef.current.targetDy = 0;
                stateRef.current.velY = 0;
                stateRef.current.lastTime = 0;
                if (rafRef.current !== null) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }
            }
            lastAppliedScrollTopRef.current = current;
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('scroll', onScroll, { passive: true });

        return (): void => {
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('scroll', onScroll);
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            stateRef.current.targetDy = 0;
            stateRef.current.velY = 0;
            stateRef.current.lastTime = 0;
        };
    }, [ref, stiffness, disabled, horizontalScrollOnShift, wheelMultiplier, stopPropagation]);
}
