import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { playMitSlide } from './slideMotion';

// 効果アイコンの滑り(見本 v11 js:640-647)。並び替え(sortOrder の変化)の直後に left が変わったときだけ、
// 前の left から滑って差さる。left は列の実測(memberLayout)から来るので sortOrder の変化より少し遅れて変わる。
const WINDOW_MS = 600;

/** 動きを減らす設定。enabled のときだけ matchMedia を購読する(標準テーマではリスナーを付けない) */
function useReducedIf(enabled: boolean): boolean {
  const [reduced, setReduced] = useState(() => enabled && typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [enabled]);
  return reduced;
}

export function useSortSlide(
  ref: RefObject<HTMLElement | null>,
  o: { left: number; sortOrder: string; enabled: boolean; delay: number },
): void {
  const reduced = useReducedIf(o.enabled);
  const prevLeft = useRef(o.left);
  const prevSort = useRef(o.sortOrder);
  const sortAt = useRef(-Infinity);
  useLayoutEffect(() => {
    const now = performance.now();
    if (prevSort.current !== o.sortOrder) { prevSort.current = o.sortOrder; sortAt.current = now; }
    const dx = prevLeft.current - o.left;
    prevLeft.current = o.left;
    if (!o.enabled || reduced || Math.abs(dx) < 1 || now - sortAt.current > WINDOW_MS || !ref.current) return;
    sortAt.current = -Infinity;
    playMitSlide(ref.current, dx, o.delay);
  }, [o.left, o.sortOrder, o.enabled, o.delay, reduced, ref]);
}
