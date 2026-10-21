import type { Pt } from './types';

export const dedupe = (pts: Pt[]): Pt[] => pts.filter((p, i, a) => { const q = a[(i - 1 + a.length) % a.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01; });

interface Edge { p: Pt; d: Pt }

/** 時計回り(画面座標)の多角形を d だけ内側へ(負なら外側へ) */
export function offsetPoly(pts: Pt[], d: number): Pt[] {
  const n = pts.length, L: Edge[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    L.push({ p: [a[0] - dy * d, a[1] + dx * d], d: [dx, dy] });
  }
  return pts.map((_, i): Pt => {
    const A = L[(i - 1 + n) % n], B = L[i], den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(den) < 1e-9) return B.p;
    const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den;
    return [A.p[0] + t * A.d[0], A.p[1] + t * A.d[1]];
  });
}

/** 折れ線(開いた線)を平行にずらす */
export function offsetLine(pts: Pt[], d: number): Pt[] {
  const n = pts.length, L: Edge[] = [];
  for (let i = 0; i < n - 1; i++) { const a = pts[i], b = pts[i + 1]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l; L.push({ p: [a[0] - dy * d, a[1] + dx * d], d: [dx, dy] }); }
  return pts.map((_, i): Pt => {
    if (i === 0) return L[0].p;
    if (i === n - 1) { const s = L[n - 2], b = pts[n - 1]; return [b[0] - s.d[1] * d, b[1] + s.d[0] * d]; }
    const A = L[i - 1], B = L[i], den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(den) < 1e-9) return B.p;
    const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den;
    return [A.p[0] + t * A.d[0], A.p[1] + t * A.d[1]];
  });
}

export const pd = (pts: Pt[]): string => 'M ' + pts.map((p) => p.map((v) => +v.toFixed(2)).join(' ')).join(' L ');
/** points 属性用 */
export const P = (pts: Pt[]): string => pts.map((p) => p.map((v) => +v.toFixed(2)).join(',')).join(' ');
export const busPaths = (center: Pt[], n: number, pitch: number): Pt[][] => Array.from({ length: n }, (_, k) => offsetLine(center, (k - (n - 1) / 2) * pitch));

/** a*x + b*y + c >= 0 の側を残す */
export function clipHalf(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], dp = a * p[0] + b * p[1] + c, dq = a * q[0] + b * q[1] + c;
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}

export const bbox = (pts: Pt[]): { x: number; y: number; w: number; h: number } => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
export const centroid = (pts: Pt[]): Pt => {
  let a = 0, cx = 0, cy = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], c = p[0] * q[1] - q[0] * p[1]; a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; });
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
};
export function spanAt(pts: Pt[], y: number): [number, number] {
  const xs: number[] = [];
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; if ((p[1] - y) * (q[1] - y) < 0) xs.push(p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1])); });
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 0];
}

/** 受け皿の輪郭をキーに割る。割り線は全部同じ傾き(s)。weights = 各キーの幅の比 */
export function bank(outline: Pt[], weights: number[], { clear = 2.3, gap = 2.2, s = -0.28 }: { clear?: number; gap?: number; s?: number } = {}): Pt[][] {
  const inner = offsetPoly(dedupe(outline), clear), bb = bbox(inner), ym = bb.y + bb.h / 2 + 0.001;
  const [x0, x1] = spanAt(inner, ym), tot = weights.reduce((a, b) => a + b, 0), k = Math.hypot(1, s);
  let acc = x0; const cuts = weights.slice(0, -1).map((w) => (acc += (x1 - x0) * w / tot));
  return weights.map((_, i) => {
    let poly = inner;
    if (i > 0) { const xm = cuts[i - 1]; poly = clipHalf(poly, 1, -s, -(xm - s * ym) - gap / 2 * k); }
    if (i < weights.length - 1) { const xm = cuts[i]; poly = clipHalf(poly, -1, s, (xm - s * ym) - gap / 2 * k); }
    return dedupe(poly);
  });
}

export const circ = (cx: number, cy: number, r: number, n = 32): Pt[] => Array.from({ length: n }, (_, i): Pt => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
export const stadium = (x: number, y: number, w: number, h: number, n = 12): Pt[] => {
  const r = h / 2, pts: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i * Math.PI / n; pts.push([x + w - r + r * Math.cos(a), y + r + r * Math.sin(a)]); }
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + i * Math.PI / n; pts.push([x + r + r * Math.cos(a), y + r + r * Math.sin(a)]); }
  return dedupe(pts);
};
export const chamRect = (w: number, h: number, tl = 0, tr = 0, br = 0, bl = 0): Pt[] =>
  dedupe([[tl, 0], [w - tr, 0], [w, tr], [w, h - br], [w - br, h], [bl, h], [0, h - bl], [0, tl]]);
export const shift = (pts: Pt[], x: number, y: number): Pt[] => pts.map(([a, b]): Pt => [a + x, b + y]);
