import { useState, useEffect, useRef } from 'react';

export interface MemberRefEntry {
  id: string;
  el: HTMLElement | null;
}

export interface MemberLayoutEntry {
  left: number;
  width: number;
}

/**
 * パーティメンバー列ヘッダー DOM から offsetLeft / offsetWidth を測定し、
 * ResizeObserver で viewport 変化に追従する。
 *
 * CSS clamp() で計算された列幅を JS から知るための唯一の正解パス。
 */
export const useMeasuredMemberLayout = (
  entries: MemberRefEntry[],
): Map<string, MemberLayoutEntry> => {
  const [layout, setLayout] = useState<Map<string, MemberLayoutEntry>>(() => new Map());
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const compute = () => {
      const next = new Map<string, MemberLayoutEntry>();
      for (const { id, el } of entries) {
        if (!el) continue;
        next.set(id, { left: el.offsetLeft, width: el.offsetWidth });
      }
      setLayout(next);
    };

    compute();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => compute());
    observerRef.current = ro;
    for (const { el } of entries) {
      if (el) ro.observe(el);
    }
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [entries]);

  return layout;
};
