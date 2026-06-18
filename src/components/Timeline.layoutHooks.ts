import { useState, useLayoutEffect } from 'react';

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
 *
 * セッション 17: メンバー列に左右 padding (--col-member-pad-x) が追加されたため、
 * padding を引いた「アイコン配置エリアの内側」 を返す。 セッション 16 の VISUAL_OFFSET
 * 計算は内側エリア基準なので、 ここで padding を吸収することでアイコン配置ロジックを
 * 変更せずに済む。
 */
export const useMeasuredMemberLayout = (
  entries: MemberRefEntry[],
): Map<string, MemberLayoutEntry> => {
  const [layout, setLayout] = useState<Map<string, MemberLayoutEntry>>(() => new Map());

  useLayoutEffect(() => {
    const compute = () => {
      const next = new Map<string, MemberLayoutEntry>();
      for (const { id, el } of entries) {
        if (!el) continue;
        const cs = getComputedStyle(el);
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;
        next.set(id, {
          left: el.offsetLeft + padL,
          width: el.offsetWidth - padL - padR,
        });
      }
      setLayout(next);
    };

    compute();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => compute());
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
