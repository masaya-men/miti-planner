import { bbox, offsetPoly } from './armor/geom';
import type { CapSpec } from './armor/types';

/** 標準部品のボタン(clip-path 用): キーの当たり判定。bbox 原点基準 */
export function hitPolygon(cap: CapSpec): string {
  const bb = bbox(cap.pts);
  const f = (v: number) => `${+v.toFixed(2)}px`;
  return `polygon(${offsetPoly(cap.pts, -0.8).map(([x, y]) => `${f(x - bb.x)} ${f(y - bb.y)}`).join(', ')})`;
}
