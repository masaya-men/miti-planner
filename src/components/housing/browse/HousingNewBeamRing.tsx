import React, { useLayoutEffect, useRef, useState } from 'react';

/** カードの内側の角丸 (housing.css .housing-listing-card の border-radius 14px − 枠線 1px)。 */
const INNER_RADIUS = 13;
/** 光の線の太さの半分ぶん内側に描く (縁からはみ出してカードの overflow で切れないように)。 */
const INSET = 1;

/** 角丸長方形の輪郭 (左上の角の終わりから時計回り)。 */
function roundedRectPath(w: number, h: number): string {
  const x = INSET;
  const y = INSET;
  const rw = w - INSET * 2;
  const rh = h - INSET * 2;
  const r = Math.max(0, Math.min(INNER_RADIUS - INSET, rw / 2, rh / 2));
  return [
    `M${x + r},${y}`,
    `H${x + rw - r}`,
    `A${r},${r} 0 0 1 ${x + rw},${y + r}`,
    `V${y + rh - r}`,
    `A${r},${r} 0 0 1 ${x + rw - r},${y + rh}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + rh - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    'Z',
  ].join(' ');
}

/**
 * NEW カードの縁を光の筋が一周する演出。
 *
 * 2026-10-22 作り替え: 以前は「板全体に光を敷き、mask で内側を切り抜いて縁だけ残す」方式だったが、
 * iPhone (ホーム画面アプリ) で切り抜きが効かない場合があり、光の板がカード画像の上にかぶっていた
 * (回転する子要素をやめる修正後も再発)。切り抜きに頼らず、カードの縁に沿った線 (SVG の path) の上を
 * 破線の 1 区間だけ走らせる方式にした。描くのは縁の線そのものなので、どの端末でも画像にはかぶらない。
 * 線の長さは pathLength=100 で正規化し、破線とずらし量を % 感覚で書けるようにしている。
 */
export const HousingNewBeamRing: React.FC<{ delayMs: number }> = ({ delayMs }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number, h: number) =>
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);
    if (typeof ResizeObserver === 'undefined') return;
    // contentRect は transform (ホバーやふわっと表示の移動) の影響を受けない素の大きさ。
    const ro = new ResizeObserver(([entry]) => apply(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const d = size && size.w > 0 && size.h > 0 ? roundedRectPath(size.w, size.h) : null;
  return (
    <svg
      ref={ref}
      className="housing-card-new-beam-glow"
      style={{ '--beam-delay': `${delayMs}ms` } as React.CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
      {d && (
        <>
          <path className="housing-card-new-beam-tail" d={d} pathLength={100} />
          <path className="housing-card-new-beam-head" d={d} pathLength={100} />
        </>
      )}
    </svg>
  );
};
