import { pd, P, busPaths } from './geom';
import type { Pt } from './types';

/** PLAN CORE 基板の寸法。h0 = 見本の高さ / sy = これより下の点だけが高さ差ぶん下へ動く */
export const PLAN_CORE = { w: 249.2, h0: 451.2, sy: 161.6 };

const n2 = (v: number) => +v.toFixed(2);
const OFFS = [-8, -4.8, -1.6, 1.6, 4.8, 8];

/**
 * 見本 buildPlanCore(js:480-530)と、その部品(cu / via / silk / smd / qfp4)を文字列で組み立てる。
 * 返すのは <svg> の中身。縦の伸び縮みは Y() 1 か所に集約している
 * (y > sy の点だけ y + (h - h0))。配線の path には光エンジン用に data-trace / data-trace-end を付ける。
 */
export function planCoreSVG(o: { h: number; id: string }): string {
  const { w, h0, sy } = PLAN_CORE;
  const dh = o.h - h0;
  const Y = (y: number) => (y > sy ? y + dh : y);
  const YP = (pts: Pt[]): Pt[] => pts.map(([x, y]): Pt => [x, Y(y)]);
  const C: Pt = [124, 372], half = 13;
  let out = '';
  const add = (s: string) => { out += s; };

  const cu = (pts: Pt[], name?: string, end?: Pt | null) =>
    add(`<path d="${pd(YP(pts))}" class="milspec-cu"${name ? ` data-trace="${name}"` : ''}${end ? ` data-trace-end="${n2(end[0])},${n2(Y(end[1]))}"` : ''}/>`);
  const via = (x: number, y: number, r = 0.5) => add(`<circle cx="${n2(x)}" cy="${n2(Y(y))}" r="${r}" class="via"/>`);
  const rect = (x: number, y: number, rw: number, rh: number, cls: string, rx?: number) =>
    add(`<rect x="${n2(x)}" y="${n2(Y(y))}" width="${n2(rw)}" height="${n2(rh)}" class="${cls}"${rx != null ? ` rx="${rx}"` : ''}/>`);
  const silk = (x: number, y: number, t: string, anchor?: string, style?: string) =>
    add(`<text x="${n2(x)}" y="${n2(Y(y))}" class="silk"${anchor ? ` text-anchor="${anchor}"` : ''}${style ? ` style="${style}"` : ''}>${t}</text>`);
  const smd = (x: number, y: number, sw: number, sh: number, vert?: boolean) => {
    rect(x, y, sw, sh, 'smd', 0.15);
    if (vert) { rect(x, y, sw, sh * 0.26, 'smd-end'); rect(x, y + sh * 0.74, sw, sh * 0.26, 'smd-end'); }
    else { rect(x, y, sw * 0.26, sh, 'smd-end'); rect(x + sw * 0.74, y, sw * 0.26, sh, 'smd-end'); }
  };
  const qfp4 = (x: number, y: number, sz: number) => {
    const c = [x + sz / 2, y + sz / 2];
    OFFS.forEach((f) => {
      rect(x - 1.3, c[1] + f - 0.3, 1.3, 0.6, 'pin');
      rect(x + sz, c[1] + f - 0.3, 1.3, 0.6, 'pin');
      rect(c[0] + f - 0.3, y - 1.3, 0.6, 1.3, 'pin');
      rect(c[0] + f - 0.3, y + sz, 0.6, 1.3, 'pin');
    });
    rect(x, y, sz, sz, 'ic', 0.6);
    add(`<circle cx="${n2(x + 2.2)}" cy="${n2(Y(y + 2.2))}" r="0.7" class="ic-dot"/>`);
    silk(c[0], c[1] + 1.4, 'U1', 'middle', 'fill:#3d4246;font-size:4.2px');
  };

  const shape: Pt[] = [[0, 0], [w, 0], [w, 418.6], [216.6, h0], [0, h0]];
  // 定義(クリップ・光だまりの放射グラデ・グラウンドの網目。水晶の金属は共通 defs の stl-sh を CSS で参照)
  add(`<defs><clipPath id="${o.id}"><polygon points="${P(YP(shape))}"/></clipPath>` +
    `<radialGradient id="${o.id}g"><stop offset="0" style="stop-color:var(--ma-sig);stop-opacity:0.5"/><stop offset="0.45" style="stop-color:var(--ma-sig);stop-opacity:0.12"/><stop offset="1" style="stop-color:var(--ma-sig);stop-opacity:0"/></radialGradient>` +
    `<pattern id="${o.id}h" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.35" height="2.2" class="hatch"/></pattern>` +
    `</defs>`);
  add(`<g clip-path="url(#${o.id})">`);
  add(`<polygon points="${P(YP(shape))}" class="brd"/>`);
  // グラウンドの網目(左下)と、縁のビアの縫い目
  add(`<polygon points="${P(YP([[6, 404], [74, 404], [74, 446], [6, 446]]))}" fill="url(#${o.id}h)" class="gnd"/>`);
  silk(9, 443, 'GND');
  for (let x = 9; x < 208; x += 7) via(x, h0 - 3.6, 0.36);
  for (let t = 0.05; t < 1; t += 0.12) via(216.6 + (w - 216.6) * t - 3.4, h0 - (h0 - 418.6) * t - 3.4, 0.36);
  for (let y = 12; y < 404; y += 9) via(w - 1.6, y, 0.3);
  // 幹線(左端 4 本)と IDX(右端 4 本)。下で折れ、IC の手前で層を移る(ビア)
  busPaths([[3.6, 0], [3.6, 322], [11.6, 330], [58, 330]], 4, 1.15).forEach((pts, k) => { const e = pts[pts.length - 1]; cu(pts, 's2k' + k, e); via(e[0], e[1], 0.5); });
  busPaths([[w - 4.6, 0], [w - 4.6, 322], [w - 12.6, 330], [w - 58, 330]], 4, 1.15).forEach((pts, k) => { const e = pts[pts.length - 1]; cu(pts, 's2x' + k, e); via(e[0], e[1], 0.5); });
  // IC(U1)から 4 方向の扇。端は端子。一部は枠の外へ(潜る)
  const fan: Record<string, (k: number) => Pt[]> = {
    L: (k) => { const y0 = C[1] + OFFS[k], x0 = C[0] - half - 1.2, x1 = x0 - 4, yt = C[1] + OFFS[k] * 3.4, x2 = x1 - Math.abs(yt - y0), xe = 16 + ((k * 7) % 4) * 8.5; return [[x0, y0], [x1, y0], [x2, yt], [xe, yt]]; },
    R: (k) => { const y0 = C[1] + OFFS[k], x0 = C[0] + half + 1.2, x1 = x0 + 4, yt = C[1] + OFFS[k] * 3.4, x2 = x1 + Math.abs(yt - y0), xe = (k === 2 || k === 3) ? w + 4 : w - 16 - ((k * 7) % 4) * 8.5; return [[x0, y0], [x1, y0], [x2, yt], [xe, yt]]; },
    T: (k) => { const x0 = C[0] + OFFS[k], y0 = C[1] - half - 1.2, y1 = y0 - 4, xt = C[0] + OFFS[k] * 4.2, y2 = y1 - Math.abs(xt - x0), ye = 276 + ((k * 5) % 3) * 9; return [[x0, y0], [x0, y1], [xt, y2], [xt, ye]]; },
    B: (k) => {
      const x0 = C[0] + OFFS[k], y0 = C[1] + half + 1.2, y1 = y0 + 4, xt = C[0] + OFFS[k] * 3.6, y2 = y1 + Math.abs(xt - x0);
      if (k >= 4) return [[x0, y0], [x0, y1], [xt, y2], [xt + 46, y2 + 46]];
      if (k === 0) return [[x0, y0], [x0, y1], [xt, y2], [xt, h0 + 4]];
      return [[x0, y0], [x0, y1], [xt, y2], [xt, 428 + ((k * 5) % 3) * 5]];
    },
  };
  ['L', 'R', 'T', 'B'].forEach((sd) => OFFS.forEach((_, k) => {
    const pts = fan[sd](k), e = pts[pts.length - 1], exit = e[0] > w || e[1] > h0;
    cu(pts, 's2' + sd + k, exit ? null : e);
    if (!exit) add(`<circle cx="${n2(e[0])}" cy="${n2(Y(e[1]))}" r="0.95" class="term"/>`);
  }));
  // 光だまり(Task 4 の coreFire が opacity を動かす)
  add(`<circle cx="${C[0]}" cy="${n2(Y(C[1]))}" r="46" fill="url(#${o.id}g)" class="milspec-core-glow" opacity="0"/>`);
  rect(C[0] - half - 6, C[1] - half - 6, half * 2 + 12, half * 2 + 12, 'crt-yd');
  qfp4(C[0] - half, C[1] - half, half * 2);
  silk(C[0], C[1] + half + 10.5, 'PLAN CORE', 'middle');
  add(`<rect x="${C[0] + 19}" y="${n2(Y(C[1] - 27))}" width="9" height="3.6" rx="1.8" class="xtal"/>`);
  silk(C[0] + 19, C[1] - 29, 'Y1');
  ([[C[0] - 20, C[1] - 20], [C[0] + 17, C[1] - 20], [C[0] - 20, C[1] + 18.6], [C[0] + 17, C[1] + 18.6]] as Pt[]).forEach(([x, y]) => smd(x, y, 2.6, 1.2));
  ([[24, 312, 'TP1'], [w - 30, 312, 'TP2'], [62, 440, 'TP3']] as [number, number, string][]).forEach(([x, y, t]) => {
    add(`<circle cx="${n2(x)}" cy="${n2(Y(y))}" r="1.5" class="tp"/>`);
    silk(x + 2.6, y + 1.1, t);
  });
  for (let i = 0; i < 4; i++) smd(168 + i * 3.2, 298, 2, 1, true);
  silk(168, 296, 'RN1');
  silk(8, 398, 'IDX-2 · REV.C'); silk(20, 326, '↑ S1'); silk(w - 44, 369, 'RAIL →'); silk(99, h0 - 6.5, '↓ S3');
  add('</g>');
  return out;
}
