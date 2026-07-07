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
