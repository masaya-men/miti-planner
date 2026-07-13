import { useEffect, useRef, useState } from 'react';

/**
 * 直近 `debounceMs` 以内に scroll イベントが発火していれば true。
 * 一覧の hero / ambient slideshow をスクロール中だけ止めるためのフラグ。
 *
 * `capture: true` が必須: 実際のスクロール容器は一覧グリッド (`.housing-listing-grid`,
 * `overflow-y:auto`) で、`HousingShell` が body を `overflow:hidden` にしているため
 * scroll は window にバブルしてこない。capture フェーズなら子孫要素のスクロールも拾える。
 */
export function useIsScrolling(debounceMs = 150): boolean {
  const [scrolling, setScrolling] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (): void => {
      setScrolling(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setScrolling(false);
        timerRef.current = null;
      }, debounceMs);
    };
    window.addEventListener('scroll', handler, { passive: true, capture: true });
    return (): void => {
      window.removeEventListener('scroll', handler, { capture: true });
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [debounceMs]);

  return scrolling;
}
