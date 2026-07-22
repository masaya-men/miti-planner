import { useLayoutEffect, useRef } from 'react';
import { useHousingListOrderStore, type HousingListKey } from '../../store/useHousingListOrderStore';

/**
 * 一覧グリッドのスクロール位置を保存・復元する。マウント時に保存済み scrollTop を復元し、
 * アンマウント時 (詳細ページへの遷移等) の scrollTop を保存する。
 * 返り値の ref をスクロールコンテナ (overflow-y:auto の要素) に付けること。
 */
export function useListScrollRestore(key: HousingListKey) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = useHousingListOrderStore.getState().entries[key].scrollTop;
    return () => {
      useHousingListOrderStore.getState().setScrollTop(key, el.scrollTop);
    };
  }, [key]);

  return containerRef;
}
