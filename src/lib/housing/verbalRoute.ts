import type { WardMapJson } from '../../data/housing/wardMapManifest';
import { nearestPointOnPolylines, type PolylineEdge } from './mapGeometry';
import type { Vec } from './plotBearing';

type Pt = [number, number];

function unit(dx: number, dy: number): Pt {
  const l = Math.hypot(dx, dy);
  return l === 0 ? [0, 0] : [dx / l, dy / l];
}
function pointAtFraction(pts: Pt[], f: number): Pt {
  if (pts.length <= 1) return pts[0] ?? [0, 0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const target = total * f;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + seg >= target) {
      const t = seg === 0 ? 0 : (target - acc) / seg;
      return [pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])];
    }
    acc += seg;
  }
  return pts[pts.length - 1];
}

/** origin から経路 30% 地点への向きが dirVec の反対半平面(dot<0)なら reroute。 */
export function shouldReroute(withStartPts: Pt[], dirVec: Vec): boolean {
  if (withStartPts.length < 2) return false;
  const s = withStartPts[0];
  const p = pointAtFraction(withStartPts, 0.3);
  const [hx, hy] = unit(p[0] - s[0], p[1] - s[1]);
  return hx * dirVec.x + hy * dirVec.y < 0;
}

/** origin を道に投影 → その乗り口から dirVec 方向へノードを貪欲に辿った px 点列 [ramp, node1, ...]。道無しで null。 */
export function directionalWalk(json: WardMapJson, startPt: Vec, dirVec: Vec, maxNodes = 6): Pt[] | null {
  const w = json.viewBox.w, h = json.viewBox.h;
  const edgesPx: PolylineEdge[] = json.edges.map((e) => ({
    a: e.a, b: e.b, polyline: e.polyline.map(([x, y]) => [x * w, y * h] as Pt),
  }));
  const nodePx = new Map<string, Pt>(json.nodes.map((n) => [n.id, [n.x * w, n.y * h] as Pt]));
  const onRamp = nearestPointOnPolylines(startPt.x, startPt.y, edgesPx);
  if (!onRamp) return null;
  const ramp: Pt = [onRamp.x, onRamp.y];
  const edge = edgesPx[onRamp.edgeIndex];
  const aPt = nodePx.get(edge.a)!, bPt = nodePx.get(edge.b)!;
  const ua = unit(aPt[0] - ramp[0], aPt[1] - ramp[1]);
  const ub = unit(bPt[0] - ramp[0], bPt[1] - ramp[1]);
  const dA = ua[0] * dirVec.x + ua[1] * dirVec.y;
  const dB = ub[0] * dirVec.x + ub[1] * dirVec.y;
  let cur = dA >= dB ? edge.a : edge.b;
  let prev = dA >= dB ? edge.b : edge.a;

  // 隣接: node → [{to, poly(node起点に向き揃え済)}]
  const adj = new Map<string, { to: string; poly: Pt[] }[]>();
  for (const e of edgesPx) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ to: e.b, poly: e.polyline });
    adj.get(e.b)!.push({ to: e.a, poly: e.polyline.slice().reverse() });
  }

  const walk: Pt[] = [ramp, nodePx.get(cur)!];
  const visited = new Set<string>([cur]);
  for (let step = 0; step < maxNodes; step++) {
    const options = (adj.get(cur) ?? []).filter((o) => o.to !== prev && !visited.has(o.to));
    let best: { to: string; poly: Pt[] } | null = null;
    let bestDot = -Infinity;
    for (const o of options) {
      const p0 = o.poly[0], p1 = o.poly[1] ?? nodePx.get(o.to)!;
      const [hx, hy] = unit(p1[0] - p0[0], p1[1] - p0[1]);
      const d = hx * dirVec.x + hy * dirVec.y;
      if (d > bestDot) { bestDot = d; best = o; }
    }
    if (!best || bestDot < 0) break; // 方角に沿う前進辺なし
    walk.push(...best.poly.slice(1));
    visited.add(best.to);
    prev = cur; cur = best.to;
  }
  return walk;
}

/** 歩き点列 pts 上で door に最も近い点(セグメント投影込み)とそのセグメント番号。 */
export function findCornerOnWalk(pts: Pt[], door: Pt): { point: Pt; segIndex: number } {
  const near = nearestPointOnPolylines(door[0], door[1], [{ a: '', b: '', polyline: pts }]);
  if (!near) return { point: pts[pts.length - 1], segIndex: Math.max(0, pts.length - 2) };
  return { point: [near.x, near.y], segIndex: near.segIndex };
}
