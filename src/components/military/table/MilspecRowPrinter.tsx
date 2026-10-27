import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { usePlanStore } from '../../../store/usePlanStore';
import { onPower } from '../power/power';
import { printRows, cancelPrintRows } from './printRows';

// 表の行の描き込みのきっかけ(見本 v11 js:1019 / 1106 / 1172)。
// プランの切替 = 200ms・コンテンツの切替 = 160ms・電源投入 = 620ms。何も描かない(null)。
// scrollRef = スクロールする側(可視範囲の基準)。Timeline から軍事のときだけ lazy で置かれる。

export function MilspecRowPrinter({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const planId = usePlanStore((s) => s.currentPlanId);
  const contentId = usePlanStore((s) => s.plans.find((p) => p.id === s.currentPlanId)?.contentId ?? null);
  const prev = useRef({ planId, contentId });
  const raf = useRef(0);

  /** 行が差し替わった後(次の描画)で描き込む */
  const run = (base: number) => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => { if (scrollRef.current) printRows(scrollRef.current, base); });
  };

  useEffect(() => {
    const p = prev.current;
    prev.current = { planId, contentId };
    if (p.planId !== planId) run(200);
    else if (p.contentId !== contentId) run(160);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, contentId]);

  useEffect(() => {
    const off = onPower((e) => { if (e.state === 'on' && !e.reduced) run(620); });
    return () => {
      off(); cancelAnimationFrame(raf.current);
      // 標準へ戻すとき: 走っているアニメ・milspec-pr クラス・listener を片付ける
      // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup 時点の scrollRef.current(最新の DOM 要素)に対して後片付けしたいので、effect 実行時の要素に写さない
      if (scrollRef.current) cancelPrintRows(scrollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
