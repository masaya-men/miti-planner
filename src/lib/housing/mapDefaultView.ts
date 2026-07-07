import type { MapView } from './mapZoom';

const MIN_SCALE = 1;
const MAX_SCALE = 8;

export interface Bbox { minX: number; minY: number; maxX: number; maxY: number }

/**
 * 経路パス文字列群（+ 追加点）を走査し viewBox 座標系の bbox を返す純関数。
 * パスは "M x y L x y ..."（弧 Q/C 含む場合も可）を前提に、数値を順に x,y ペアとして拾う。
 * 弧の制御点が混ざっても bbox は安全側に広がるだけで、見切れ厳禁の不変条件は保たれる。
 */
export function routeBbox(paths: (string | null | undefined)[], extra: { x: number; y: number }[] = []): Bbox | null {
  const nums: number[] = [];
  for (const p of paths) {
    if (!p) continue;
    const found = p.match(/-?\d+(?:\.\d+)?/g);
    if (found) for (const s of found) nums.push(parseFloat(s));
  }
  const pts: { x: number; y: number }[] = [...extra];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  if (pts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of pts) {
    if (q.x < minX) minX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.x > maxX) maxX = q.x;
    if (q.y > maxY) maxY = q.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * 経路 bbox（viewBox 座標）を wrap（px）いっぱいに収める MapView を返す純関数。
 * overlay は xMidYMid meet なので viewBox→wrap は等倍レターボックス写像。その上へ zoom transform（translate→scale, origin 0,0）を載せる。
 * padPx: 経路が端に貼り付かないための余白。scale は [1,8] にクランプ。
 * bbox は viewBox 内（0..vb.w × 0..vb.h）を前提（routeBbox が保証）。順序反転（min>max）は内部で正規化して安全側に倒す。
 * 不変条件: bbox の四隅（起点エーテライトと家を含む）は変換後 [0,wrap.w]×[0,wrap.h] に必ず収まる（見切れ厳禁）。
 */
export function computeDefaultView(bbox: Bbox, vb: { w: number; h: number }, wrap: { w: number; h: number }, padPx: number): MapView {
  // 呼び出し側が順序反転した bbox を渡しても scale 過大→見切れにならないよう min≤max を強制。
  const minX = Math.min(bbox.minX, bbox.maxX), maxX = Math.max(bbox.minX, bbox.maxX);
  const minY = Math.min(bbox.minY, bbox.maxY), maxY = Math.max(bbox.minY, bbox.maxY);
  const m = Math.min(wrap.w / vb.w, wrap.h / vb.h);
  const ox = (wrap.w - vb.w * m) / 2;
  const oy = (wrap.h - vb.h * m) / 2;
  const X0 = ox + minX * m, Y0 = oy + minY * m;
  const X1 = ox + maxX * m, Y1 = oy + maxY * m;
  const bw = Math.max(1, X1 - X0), bh = Math.max(1, Y1 - Y0);
  const availW = Math.max(1, wrap.w - 2 * padPx), availH = Math.max(1, wrap.h - 2 * padPx);
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(availW / bw, availH / bh)));
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  return { scale: s, tx: wrap.w / 2 - cx * s, ty: wrap.h / 2 - cy * s };
}
