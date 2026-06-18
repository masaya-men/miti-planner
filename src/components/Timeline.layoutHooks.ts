import { useState, useLayoutEffect } from 'react';

/**
 * PC 横スクロール同期: スキル領域要素だけ translateX を当てる。
 * 情報列見出し（フェーズ/ラベル/時間/敵攻撃/ダメージ列）は translate しない。
 * shadowEls は scrollLeft > 0 で timeline-info-pane--scrolled を付与する（Task 5 で配線）。
 */
export function applyHorizontalScrollSync(opts: {
  scrollLeft: number;
  skillEls: (HTMLElement | null | undefined)[];
  shadowEls?: (HTMLElement | null | undefined)[];
}): void {
  const { scrollLeft, skillEls, shadowEls = [] } = opts;
  for (const el of skillEls) {
    if (el) el.style.transform = `translateX(-${scrollLeft}px)`;
  }
  for (const el of shadowEls) {
    if (!el) continue;
    el.classList.toggle('timeline-info-pane--scrolled', scrollLeft > 0);
  }
}

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
        // ヘッダー/コントロールバーのスキル領域 (#timeline-*-skill) は translateX のため
        // transform が掛かり offsetParent 化する。その場合 el.offsetLeft はスキル領域内の
        // 相対値 (情報列ぶん member-start が欠落) になり、本文シート基準の絶対 left とズレる。
        // → offsetParent を辿ってスキル領域の offsetLeft (= member-start) まで積み上げ、
        //   バー(=シート)基準の絶対 left に補正する。スキル領域を経由しない場合は従来どおり。
        let node: HTMLElement | null = el;
        let acc = 0;
        let viaSkill = false;
        while (node) {
          acc += node.offsetLeft;
          if (node.id === 'timeline-controls-skill' || node.id === 'timeline-header-skill') {
            viaSkill = true;
            break;
          }
          node = node.offsetParent as HTMLElement | null;
        }
        next.set(id, {
          left: (viaSkill ? acc : el.offsetLeft) + padL,
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
