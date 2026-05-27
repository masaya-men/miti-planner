import { useEffect, useRef, useState } from 'react';
import { pickNextStepMs, SLIDESHOW_MAX_STEP_MS } from './slideshowCycle';

/**
 * frameCount 枚の静止画をクロスフェードで切替えるための表示中 index を返す。
 * 各カード独立に 2.6-6 秒ランダム間隔で進む。 初期 index も初期 delay も
 * ランダムにすることで、 多数カードがあっても画面全体が同期せず波打つように desync する。
 * frameCount<2 のときは常に 0 (= 静止)。 Allmarks `use-slideshow-cycle.ts` 移植。
 */
export function useSlideshowCycle(frameCount: number, enabled = true): number {
  const [index, setIndex] = useState(() =>
    frameCount > 1 ? Math.floor(Math.random() * frameCount) : 0,
  );
  const countRef = useRef(frameCount);
  countRef.current = frameCount;

  useEffect(() => {
    if (!enabled || frameCount < 2) {
      setIndex(0);
      return;
    }
    let timer: number;
    const tick = (): void => {
      setIndex((i) => (i + 1) % countRef.current);
      timer = window.setTimeout(tick, pickNextStepMs());
    };
    timer = window.setTimeout(tick, Math.random() * SLIDESHOW_MAX_STEP_MS);
    return (): void => window.clearTimeout(timer);
  }, [frameCount, enabled]);

  return frameCount < 2 ? 0 : index;
}
