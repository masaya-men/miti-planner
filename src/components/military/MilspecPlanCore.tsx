import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { PLAN_CORE, planCoreSVG } from './armor/pcb';
import './MilspecPlanCore.css';

/**
 * サイドバー中段の黒い床(基板 PLAN CORE)。幅は 249.2 固定、高さは自分の親要素の実高に追従する。
 * 光の経路名(data-trace)は planCoreSVG が付ける。
 */
export function MilspecPlanCore({ style }: { style?: CSSProperties }) {
  const ref = useRef<SVGSVGElement>(null);
  const rid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [h, setH] = useState(PLAN_CORE.h0);

  // 親の実高を監視(0 は無視)
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const en = entries[0];
      if (!en) return;
      const bb = Array.isArray(en.borderBoxSize) ? en.borderBoxSize[0] : en.borderBoxSize;
      const nh = bb ? bb.blockSize : en.contentRect.height;
      if (nh <= 0) return;
      setH((prev) => (prev === nh ? prev : nh));
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (el) el.innerHTML = planCoreSVG({ h, id: `mpc${rid}` });
  }, [h, rid]);

  return (
    <svg
      ref={ref}
      className="milspec-pcb milspec-plan-core"
      aria-hidden="true"
      width={PLAN_CORE.w}
      height={h}
      viewBox={`0 0 ${PLAN_CORE.w} ${h}`}
      style={style}
    />
  );
}
