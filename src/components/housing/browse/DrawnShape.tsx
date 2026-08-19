import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface DrawnShapeProps {
  /** `<path>` として描く場合の d 属性(points と排他)。 */
  d?: string;
  /** `<polygon>` として描く場合の points 属性(d と排他)。 */
  points?: string;
  /** true の間、線が実寸に応じた速さでスーッと描かれる演出を再生する。
   * false のときは常に描き終わった状態(通常のストローク)で静止表示する
   * (完了後の hold/fading フェーズ・reduced motion で使う)。 */
  animate: boolean;
  durationMs: number;
  delayMs?: number;
  className: string;
}

/**
 * SVGの `<path>`/`<polygon>` を、実際の線の長さぶん `stroke-dasharray`/`stroke-dashoffset` を
 * 実測して(`getTotalLength()`)「その形なりの速さ」でスーッと描く演出。
 * 固定の大きすぎるダッシュ値を使う簡易トリックだと、短い形(家の区画等)は一瞬で
 * 描き終わったように見えてしまう問題があるため、要素ごとに実測する
 * (2026-08-19: 家の区画もゆっくり描いてほしいというユーザーFBで導入)。
 *
 * 手順: ①マウント時に実寸を測り dasharray=length・dashoffset=length(=完全に隠れた状態)を
 * transition 無しで適用 → ②次のフレームで dashoffset=0 に切り替え、そのときだけ
 * transition を効かせる(2段階にしないとブラウザが「隠れた状態」を描画する前に
 * 目標値へ飛んでしまい、アニメーションして見えない)。
 */
export const DrawnShape: React.FC<DrawnShapeProps> = ({ d, points, animate, durationMs, delayMs = 0, className }) => {
  const ref = useRef<SVGPathElement & SVGPolygonElement>(null);
  const [length, setLength] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.getTotalLength !== 'function') return;
    try {
      setLength(el.getTotalLength());
    } catch {
      setLength(null);
    }
  }, []);

  useEffect(() => {
    if (!animate || length == null) return;
    setDrawn(false);
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [animate, length]);

  let style: React.CSSProperties | undefined;
  if (!animate) {
    style = undefined; // 静止表示: dasharray無し、通常のストロークをそのまま見せる。
  } else if (length == null) {
    style = { opacity: 0 }; // 実寸計測前: 未ダッシュの全表示状態を一瞬見せないよう隠す。
  } else {
    style = {
      strokeDasharray: length,
      strokeDashoffset: drawn ? 0 : length,
      transition: drawn ? `stroke-dashoffset ${durationMs}ms ease-out ${delayMs}ms` : 'none',
    };
  }

  if (d != null) return <path ref={ref} d={d} className={className} style={style} />;
  return <polygon ref={ref} points={points} className={className} style={style} />;
};
