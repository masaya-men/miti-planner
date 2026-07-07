export type Pt = [number, number];
export interface RouteSegment { kind: 'road' | 'jump'; points: Pt[] }
export interface RouteOverride { segments: RouteSegment[] }

const ARC_K = 0.22; // 弧の膨らみ = 区間長 × この割合
const f = (n: number) => n.toFixed(1);

function roadSubpath(pxPts: Pt[]): string {
  return pxPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`).join(' ');
}

/**
 * px 点列を、各連続ペアを上向き 2 次ベジェ弧にした 1 サブパス d に。
 * ジャンプ(道に無い区間)を「弧を描いて飛ぶ」破線として見せるため。
 */
export function arcJumpPath(pxPts: Pt[]): string {
  let d = `M${f(pxPts[0][0])} ${f(pxPts[0][1])}`;
  for (let i = 1; i < pxPts.length; i++) {
    const [ax, ay] = pxPts[i - 1];
    const [bx, by] = pxPts[i];
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    // 法線を上向き(y 減少)に固定して弧が上へ膨らむようにする。
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const cx = mx + nx * len * ARC_K, cy = my + ny * len * ARC_K;
    d += ` Q${f(cx)} ${f(cy)} ${f(bx)} ${f(by)}`;
  }
  return d;
}

/**
 * 経路セグメント列(0..1)を実線 routePath / 破線弧 routeJumpPath の SVG d に変換する純関数。
 * road セグは M/L 直線、jump セグは弧。各セグは独立サブパスとして 1 本の d に連結するので
 * TourNavMap の <path d> 2 本(実線/破線)のまま任意個・任意順の区間を描ける(消費側 無改造)。
 */
export function routeToPaths(segments: RouteSegment[], w: number, h: number): { routePath: string | null; routeJumpPath: string | null } {
  const toPx = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * w, y * h] as Pt);
  const road = segments.filter((s) => s.kind === 'road' && s.points.length >= 2).map((s) => roadSubpath(toPx(s.points)));
  const jump = segments.filter((s) => s.kind === 'jump' && s.points.length >= 2).map((s) => arcJumpPath(toPx(s.points)));
  return { routePath: road.length ? road.join(' ') : null, routeJumpPath: jump.length ? jump.join(' ') : null };
}

/** 旧 {road, jump} 形式 / 新 {segments} 形式のどちらでも segments 配列に正規化する。 */
export function migrateLegacyOverride(o: { road?: Pt[]; jump?: Pt[] | null; segments?: RouteSegment[] }): RouteSegment[] {
  if (o.segments) return o.segments;
  const segs: RouteSegment[] = [];
  if (o.road && o.road.length) segs.push({ kind: 'road', points: o.road });
  if (o.jump && o.jump.length) segs.push({ kind: 'jump', points: o.jump });
  return segs;
}

export interface RoutePoint { x: number; y: number; kind: 'road' | 'jump' }

/**
 * お絵かきの点列(kind = その点に至る線の種別)を、連続同 kind でまとめて segments に。
 * 種別の境界では前セグの最後の点を次セグ先頭へ引き継ぎ、実線↔弧の線が途切れないようにする。
 */
export function pointsToSegments(points: RoutePoint[]): RouteSegment[] {
  const segs: RouteSegment[] = [];
  for (const p of points) {
    const pt: Pt = [p.x, p.y];
    const last = segs[segs.length - 1];
    if (last && last.kind === p.kind) {
      last.points.push(pt);
    } else {
      const seed: Pt[] = last ? [last.points[last.points.length - 1], pt] : [pt];
      segs.push({ kind: p.kind, points: seed });
    }
  }
  return segs;
}

/** segments を、境界共有点を 1 つに畳んだ点列(kind 付き)に展開。pointsToSegments の逆=編集の初期値に使う。 */
export function segmentsToPoints(segs: RouteSegment[]): RoutePoint[] {
  const pts: RoutePoint[] = [];
  for (const s of segs) {
    for (const [x, y] of s.points) {
      const last = pts[pts.length - 1];
      if (last && last.x === x && last.y === y) continue; // 境界共有点は畳む
      pts.push({ x, y, kind: s.kind });
    }
  }
  return pts;
}

/** 線分 a→b への点 p の垂直距離(線分の端でクランプ)。 */
function perpDist([px, py]: Pt, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const tRaw = ((px - ax) * dx + (py - ay) * dy) / len2;
  const tt = Math.max(0, Math.min(1, tRaw));
  const cx = ax + tt * dx, cy = ay + tt * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Ramer–Douglas–Peucker: 折れ線 pts を許容誤差 epsilon(正規化座標)で間引く純関数。
 * 端点は必ず保持。なぞり(ドラッグ)で増えた過剰な点を少数の折れ線に畳むのに使う。
 */
export function simplifyPolyline(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length <= 2) return pts.slice();
  let maxDist = 0;
  let idx = 0;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], ax, ay, bx, by);
    if (d > maxDist) { maxDist = d; idx = i; }
  }
  if (maxDist > epsilon) {
    const left = simplifyPolyline(pts.slice(0, idx + 1), epsilon);
    const right = simplifyPolyline(pts.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}
