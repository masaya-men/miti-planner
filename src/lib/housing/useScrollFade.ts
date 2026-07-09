import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 縦スクロール要素の「端フェード」制御フック。
 * - atStart: 先頭に居る (上フェード不要) / atEnd: 末尾に居る (下フェード不要)
 * - マウント時 + ResizeObserver (内容/寸法変化) で自動再計算。 スクロール時は onScroll を要素へ。
 * スクロールバーを出さずに「まだ続きがある」ことをフェードで示す業界標準パターンに使う。
 */
export function useScrollFade<T extends HTMLElement = HTMLElement>(): {
  ref: React.RefObject<T>;
  atStart: boolean;
  atEnd: boolean;
  onScroll: () => void;
} {
  const ref = useRef<T>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollTop <= 1);
    setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    onScroll();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => onScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [onScroll]);

  return { ref: ref as React.RefObject<T>, atStart, atEnd, onScroll };
}
