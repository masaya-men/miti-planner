import type { WardMapJson } from '../../data/housing/wardMapManifest';
import { nearestPointOnPolylines, type PolylineEdge } from './mapGeometry';
import { buildSnappedRoutePoints } from './wardRoute';
import type { Pt, RouteSegment } from './routePaths';

/** 点をこの px 未満で道に投影できるとき「道の上」とみなす(出だし/終わりの道外連結はこれを超えるので直線を保つ)。 */
const ONROAD_PX = 12;
/** 道なりの全長が直線距離のこの倍を超えたら遠回り誤選択とみなし直線に戻す(暴走ガード)。 */
const MAX_RATIO = 2.5;

function lengthPx(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
}

/**
 * override の road 区間を「道グラフに沿って曲げた」密な点列に展開する純関数(表示専用・保存しない)。
 * 隣接する道上2点の間だけ buildSnappedRoutePoints で道追従。片端が道外/到達不能/遠回りは直線のまま。
 * jump 区間は素通し。0..1 正規化座標 in / out。
 */
export function followRoadSegments(segments: RouteSegment[], json: WardMapJson): RouteSegment[] {
  const w = json.viewBox.w, h = json.viewBox.h;
  const edgesPx: PolylineEdge[] = json.edges.map((e) => ({ a: e.a, b: e.b, polyline: e.polyline.map(([x, y]) => [x * w, y * h] as Pt) }));
  const project = (p: Pt): Pt | null => {
    const n = nearestPointOnPolylines(p[0] * w, p[1] * h, edgesPx);
    return n && n.dist < ONROAD_PX ? ([n.x / w, n.y / h] as Pt) : null;
  };

  return segments.map((s) => {
    if (s.kind !== 'road' || s.points.length < 2) return s;
    // 各点: 道の上なら投影位置に寄せる(境界一致のため確定) / 道外なら原位置維持(出だし・終わりを保つ)。
    const proj = s.points.map(project);
    const anchored: Pt[] = s.points.map((p, i) => proj[i] ?? p);
    const onRoad = proj.map((p) => p !== null);
    const out: Pt[] = [];
    const push = (p: Pt) => { const last = out[out.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p); };

    for (let i = 0; i + 1 < anchored.length; i++) {
      const a = anchored[i], b = anchored[i + 1];
      let seg: Pt[] = [a, b];
      if (onRoad[i] && onRoad[i + 1]) {
        const aPx = { x: a[0] * w, y: a[1] * h }, bPx = { x: b[0] * w, y: b[1] * h };
        const routed = buildSnappedRoutePoints(json, aPx, bPx);
        if (routed && routed.length >= 2) {
          const straight = Math.hypot(bPx.x - aPx.x, bPx.y - aPx.y);
          if (lengthPx(routed) <= straight * MAX_RATIO) seg = routed.map(([x, y]) => [x / w, y / h] as Pt);
        }
      }
      for (const p of seg) push(p);
    }
    return { kind: 'road', points: out };
  });
}
