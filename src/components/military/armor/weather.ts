import { bbox, P } from './geom';
import type { Pt, PanelSpec, WeatherSpec } from './types';

/** 形から決まる乱数(同じパネルは毎回同じ傷) */
export function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = (pts: Pt[]): number => Math.abs(Math.round(pts.reduce((s, p, i) => s + p[0] * (i + 3) * 7.3 + p[1] * (i + 5) * 13.1, 0))) || 7;

/** 縁の剥げ: 辺に沿って細長い小片。角の近くほど多い */
function chipsSVG(pts: Pt[], R: () => number, amount: number, big = 1): string {
  let s = '';
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], c = pts[(i + 1) % n], dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 5) continue;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const count = Math.floor(L / 42 * amount + R() * 0.7);
    for (let k = 0; k < count; k++) {
      let t = R(); if (R() < 0.6) t = R() < 0.5 ? t * t * 0.3 : 1 - t * t * 0.3;
      const px = a[0] + dx * t + nx * (0.5 + R() * 1.4), py = a[1] + dy * t + ny * (0.5 + R() * 1.4);
      const len = (0.6 + R() * R() * 2.6) * big, wid = (0.4 + R() * 0.7) * big, m = 5 + Math.floor(R() * 3), poly: Pt[] = [];
      for (let j = 0; j < m; j++) { const ang = j / m * Math.PI * 2 + (R() - 0.5) * 0.9, r = 0.55 + R() * 0.55; const lx = Math.cos(ang) * len * r, ly = Math.sin(ang) * wid * r; poly.push([px + ux * lx + nx * ly, py + uy * lx + ny * ly]); }
      s += `<polygon class="wx-chip-sh" points="${P(poly.map(([x, y]): Pt => [x - 0.3, y - 0.35]))}"/><polygon class="wx-chip" points="${P(poly)}"/>`;
    }
  }
  return s;
}

/** 擦り傷: 手が触れる範囲に、短く少し曲がった溝(明 + 暗) */
function scratchesSVG(zones: WeatherSpec['wear'], R: () => number): string {
  let s = '';
  (zones ?? []).forEach(([cx, cy, r, n]) => {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r, x0 = cx + Math.cos(a) * d, y0 = cy + Math.sin(a) * d * 0.6;
      const dir = (R() < 0.7 ? -0.55 : 0.4) + (R() - 0.5) * 0.5, len = 4 + R() * 13, x1 = x0 + Math.cos(dir) * len, y1 = y0 + Math.sin(dir) * len;
      const mx = (x0 + x1) / 2 + (R() - 0.5) * 2.4, my = (y0 + y1) / 2 + (R() - 0.5) * 2.4, d2 = `M ${x0.toFixed(2)} ${y0.toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
      s += `<path class="wx-scr-sh" d="${d2}" transform="translate(0.25 0.35)"/><path class="wx-scr" d="${d2}"/>`;
    }
  });
  return s;
}

/** 汚れ筋: 点から下へ細く垂れる */
const streakSVG = (x: number, y: number, len: number, w = 0.9): string =>
  `<rect class="wx-stk" x="${(x - w / 2).toFixed(2)}" y="${y.toFixed(2)}" width="${w}" height="${len.toFixed(2)}"/>`;

/** パネル 1 枚分の汚し(装甲の描画の最後に重ねる。パネルの形で切り抜く) */
export function weatherSVG(spec: PanelSpec, pts: Pt[], inner: Pt[], id: string): string {
  const wx: WeatherSpec = spec.wx ?? {}, R = rng(seedOf(pts) + (wx.seed ?? 0));
  let s = `<clipPath id="${id}c"><polygon points="${P(pts)}"/></clipPath><g clip-path="url(#${id}c)">`;
  const bb = bbox(inner);
  if (wx.grime !== 0) s += `<rect x="${bb.x}" y="${bb.y + bb.h * 0.45}" width="${bb.w}" height="${bb.h * 0.55}" fill="url(#wx-grime)" opacity="${wx.grime ?? 1}"/>`;
  (wx.heat ?? []).forEach(([cx, cy, r]) => { s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#wx-heat)"/>`; });
  (spec.pockets ?? []).forEach((pk) => { const pp = pk.pts, my = Math.max(...pp.map((p) => p[1])); pp.filter((p) => my - p[1] < 0.5).forEach((p) => { if (R() < 0.8) s += streakSVG(p[0] + (R() - 0.5) * 3, p[1] + 0.8, 4 + R() * 12); }); });
  [...(spec.scribes ?? []), ...(spec.seams ?? [])].forEach((d) => { const nums = d.match(/-?[\d.]+/g); if (!nums || R() < 0.35) return; const m = d.match(/^M\s*([\d.-]+)\s+([\d.-]+)/); if (m) s += streakSVG(+m[1] + 0.4, +m[2] + 1.2, 3 + R() * 9, 0.7); });
  (wx.streaks ?? []).forEach(([x, y, len]) => { s += streakSVG(x, y, len); });
  s += chipsSVG(pts, R, wx.chips ?? 0.9);
  s += scratchesSVG(wx.wear, R);
  return s + '</g>';
}
