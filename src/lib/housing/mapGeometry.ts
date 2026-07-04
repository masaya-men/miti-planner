export interface PolylineEdge { a: string; b: string; polyline: [number, number][] }
export interface NearestPoint { x: number; y: number; edgeIndex: number; segIndex: number; t: number; dist: number }

/** 点(px)から edges の全セグメントへの最近点。polyline は px 単位(0..1 × viewBox 済み)。edges 空なら null。 */
export function nearestPointOnPolylines(px: number, py: number, edges: PolylineEdge[]): NearestPoint | null {
  let best: NearestPoint | null = null;
  for (let ei = 0; ei < edges.length; ei++) {
    const pl = edges[ei].polyline;
    for (let si = 0; si + 1 < pl.length; si++) {
      const [x1, y1] = pl[si];
      const [x2, y2] = pl[si + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = x1 + t * dx, cy = y1 + t * dy;
      const d = Math.hypot(px - cx, py - cy);
      if (!best || d < best.dist) best = { x: cx, y: cy, edgeIndex: ei, segIndex: si, t, dist: d };
    }
  }
  return best;
}
