import { useEffect, useRef, useState } from 'react';

/**
 * window が直近 `debounceMs` 以内に scroll イベントを発火していれば true。
 * 一覧の hero / ambient slideshow をスクロール中だけ止めるためのフラグ。
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
    window.addEventListener('scroll', handler, { passive: true });
    return (): void => {
      window.removeEventListener('scroll', handler);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [debounceMs]);

  return scrolling;
}
