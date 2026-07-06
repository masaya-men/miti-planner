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

/**
 * 道なり経路(px 点列)を、start/end 点を「その経路上」に投影した位置の間だけに切り詰める純関数。
 * 始点側の戻り(スパー: 経路先頭ノードへ戻る尾)・終点側の行き過ぎ(オーバーシュート: 目的ノードまで
 * 行って玄関へ引き返す)を除去する。返り値 = [start投影点, ...間の頂点..., end投影点]。
 * 経路が2点未満、または投影が逆転/同一なら安全にフォールバック([start投影, end投影] の2点)。
 */
export function trimRouteToEndpoints(
  route: [number, number][],
  start: { x: number; y: number },
  end: { x: number; y: number },
): [number, number][] {
  if (route.length < 2) return route.map(([x, y]) => [x, y]);
  const single: PolylineEdge[] = [{ a: '', b: '', polyline: route }];
  const ps = nearestPointOnPolylines(start.x, start.y, single);
  const pe = nearestPointOnPolylines(end.x, end.y, single);
  if (!ps || !pe) return route.map(([x, y]) => [x, y]);
  const posS = ps.segIndex + ps.t; // 経路先頭からの単調な位置(segIndex+t)
  const posE = pe.segIndex + pe.t;
  if (posS >= posE) return [[ps.x, ps.y], [pe.x, pe.y]];
  const out: [number, number][] = [[ps.x, ps.y]];
  for (let i = ps.segIndex + 1; i <= pe.segIndex; i++) out.push([route[i][0], route[i][1]]);
  out.push([pe.x, pe.y]);
  return out;
}

/** 線分 a->b と閉多角形 poly の、a に最も近い側の交点。交差なしは null。poly は px 頂点列。 */
export function segmentPolygonIntersection(
  ax: number, ay: number, bx: number, by: number, poly: [number, number][],
): { x: number; y: number } | null {
  let bestT = Infinity;
  let res: { x: number; y: number } | null = null;
  const rx = bx - ax, ry = by - ay;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const sx = x2 - x1, sy = y2 - y1;
    const denom = rx * sy - ry * sx;
    if (denom === 0) continue; // 平行
    const t = ((x1 - ax) * sy - (y1 - ay) * sx) / denom; // a->b 上のパラメータ
    const u = ((x1 - ax) * ry - (y1 - ay) * rx) / denom; // 辺上のパラメータ
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < bestT) {
      bestT = t;
      res = { x: ax + t * rx, y: ay + t * ry };
    }
  }
  return res;
}
