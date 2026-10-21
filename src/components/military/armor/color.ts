import type { Rgb } from './types';

export const hex = (h: string): Rgb => {
  h = h.trim();
  if (h.startsWith('rgb')) return (h.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3) as Rgb;
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as Rgb;
export const css = (c: Rgb): string => `rgb(${c[0]},${c[1]},${c[2]})`;
const norm = (v: number[]): number[] => { const l = Math.hypot(...v); return v.map((x) => x / l); };
export const LIGHT = norm([-0.42, -0.9, 1.0]);
export const FLAT = LIGHT[2];
/** 面の明るさ(向き ox,oy から光を計算)。raised=false ならくぼみ */
export const shade = (ox: number, oy: number, raised: boolean): number => {
  const n = raised ? norm([ox, oy, 0.9]) : norm([-ox, -oy, 0.9]);
  return Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
};
export const facetCol = (b: number, t: { face: Rgb; hi: Rgb; lo: Rgb }): Rgb =>
  (b >= FLAT ? mix(t.face, t.hi, Math.min(1, (b - FLAT) / (1 - FLAT) * 1.2)) : mix(t.lo, t.face, Math.pow(b / FLAT, 1.25)));
