import { css, mix } from './color';
import { armorSVG } from './svg';
import { chipsSVG, rng } from './weather';
import { HDR_CUTS } from '../headerGeometry';
import type { ArmorPalette, DrawerSpec, GlowSpec, Pt, ToneColors } from './types';

/**
 * ヘッダー「2 重パネル引き出し」の下の板(網・枠・汚れ・影・レール・止め・縁光)と、その奥の基板(光)の描画。
 * 見本 docs/.private/2026-10-22-header-telescoping-panel-mockup/v3.html の meshDefs / meshField / drawerSVG / GLOWS.a / machinedEdge の写し。
 * 座標は区画座標(絶対)。置く側が viewBox を x0 から始めて板の左上に合わせる。
 */

/** 設計書 §0 / D8 の決定値 */
export const DRAWER = { shadow: 1, dirt: 2, dark: 1, glow: 0.55 } as const;

/** 土台の 3 本(y0, y1)と窓(網が見える y の範囲。枠 3px を含む) */
const CARRIER: [number, number][] = [[0, 6], [46, 54], [98, 102]];
const FIELDS: [number, number][] = [[6, 46], [54, 98]];
/** 基板の部品の繰り返しの周期 */
const TILE = 240;
/** 休む位置の座標は rest(= 一番下の段 H5 の切れ目 683 を基準)で渡される。他の段は切れ目の差だけずらす */
const REST_CUT = HDR_CUTS.h5;
/** ハザード止めの幅 */
const STOP_W = 12;

const f1 = (n: number): string => n.toFixed(1);
const f2 = (n: number): string => n.toFixed(2);

/** 下の板の色: 上の板(pri)より暗く。dark=0 で sec、1 で chs に近づく */
function drawerTone(pal: ArmorPalette, dark: number): ToneColors {
  const a = pal.sec, b = pal.chs, m = (k: 'top' | 'bot' | 'hi' | 'lo') => mix(a[k], b[k], dark * 0.8);
  return { top: m('top'), bot: m('bot'), hi: m('hi'), lo: m('lo'), face: mix(m('top'), m('bot'), 0.45) };
}

/** 位置決めに使う範囲: 窓ごとの {切れ目から決まるずれ, 動く縁が休む 2 か所} */
function travel(spec: DrawerSpec, cut: number): { t0: number; t1: number } {
  const d = cut - REST_CUT;
  return { t0: spec.rest[0] + d, t1: spec.rest[1] + d };
}
/** 窓 [a,b] が属する帯の切れ目 */
function cutOf(spec: DrawerSpec, a: number, b: number): number {
  const cy = (a + b) / 2;
  return (spec.bands.find((bd) => cy >= bd.y0 && cy < bd.y1) ?? spec.bands[0]).cut;
}

/** G2 エキスパンドメタルの網(結び目 4 つ・明暗の筋)と、結び目の下の汚れ、帯の縁パターン */
function meshDefs(id: string, pal: ArmorPalette): string {
  const d = pal.drw, c = (k: keyof ArmorPalette['drw']) => css(d[k]);
  const inkDark = css(mix(d.dark, [0, 0, 0], 0.6));
  const sh = `<path d="M 0 5 L 10 0 L 20 5 M 0 5 L 10 10 L 20 5" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="2.6" transform="translate(1.1 1.5)"/>`;
  const dark = `<path d="M 10 0 L 20 5 M 0 5 L 10 10" fill="none" stroke="${c('dark')}" stroke-width="2.2"/><path d="M 10 0 L 20 5 M 0 5 L 10 10" fill="none" stroke="${inkDark}" stroke-width="0.6" transform="translate(0.35 0.55)"/>`;
  const lit = `<path d="M 0 5 L 10 0 M 10 10 L 20 5" fill="none" stroke="${c('lit')}" stroke-width="2.2"/><path d="M 0 5 L 10 0 M 10 10 L 20 5" fill="none" stroke="${c('edgeHi')}" stroke-width="0.55" transform="translate(-0.35 -0.55)"/>`;
  const knots = [[10, 0], [10, 10], [0, 5], [20, 5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="${c('knot')}"/>`).join('') +
    `<circle cx="9.7" cy="-0.3" r="0.45" fill="${c('zinc')}"/><circle cx="9.7" cy="9.7" r="0.45" fill="${c('zinc')}"/>`;
  const nodeGrime = (cx: number, cy: number) => `<ellipse cx="${cx}" cy="${cy + 1.6}" rx="1.9" ry="1.3" fill="url(#grime-r)"/>`;
  // 帯の縁の裏からの光(両縁の細い線。光の近くだけマスクで残す)
  const rim = `<path d="M 0 5 L 10 0 L 20 5 M 0 5 L 10 10 L 20 5" fill="none" stroke="#fff" stroke-width="3.1"/><path d="M 0 5 L 10 0 L 20 5 M 0 5 L 10 10 L 20 5" fill="none" stroke="#000" stroke-width="2.0"/>`;
  return `<pattern id="${id}-mesh" width="20" height="10" patternUnits="userSpaceOnUse">${sh}${dark}${lit}${knots}</pattern>` +
    `<pattern id="${id}-meshg" width="20" height="10" patternUnits="userSpaceOnUse">${nodeGrime(10, 0)}${nodeGrime(10, 10)}${nodeGrime(0, 5)}${nodeGrime(20, 5)}</pattern>` +
    `<pattern id="${id}-rimp" width="20" height="10" patternUnits="userSpaceOnUse">${rim}</pattern>`;
}

/** 窓 1 つぶん(枠・網・汚れ・傷)。dirt = 汚れ/傷のつまみ、t0/t1 = 動く縁が休む 2 か所 */
function meshField(spec: DrawerSpec, pal: ArmorPalette, id: string, y0: number, y1: number, seed: number): string {
  const { x0, x1, dirt: d } = spec, dr = pal.drw, c = (k: keyof ArmorPalette['drw']) => css(dr[k]);
  const R = rng(seed), cut = cutOf(spec, y0, y1), { t0, t1 } = travel(spec, cut), cy = (y0 + y1) / 2;
  const w = x1 - x0, edge = css(pal.edge);
  let s = `<rect x="${x0}" y="${y0 + 3}" width="${w}" height="${y1 - y0 - 6}" fill="url(#${id}-mesh)"/>`;
  // 結び目の下の汚れ
  s += `<rect x="${x0}" y="${y0 + 3}" width="${w}" height="${y1 - y0 - 6}" fill="url(#${id}-meshg)" opacity="${f2(0.55 * d)}"/>`;
  // 溶接した平鋼の枠(上下 3px)+ 枠の縁の欠け
  ([[y0, 'url(#g-vs-up)'], [y1 - 3, 'url(#g-vs)']] as [number, string][]).forEach(([y, g]) => {
    s += `<rect x="${x0}" y="${y}" width="${w}" height="3" fill="url(#stl-sh)"/><rect x="${x0}" y="${y}" width="${w}" height="3" fill="url(#grain)" opacity="0.5"/><rect x="${x0}" y="${y}" width="${w}" height="3" fill="${g}" opacity="0.5"/>`;
    s += chipsSVG([[x0, y], [x1, y], [x1, y + 3], [x0, y + 3]] as Pt[], R, 0.9 * d, 0.9);
  });
  // ビード(溶接の点)+ ビードの隙間だけに錆の滲み(下側)と亜鉛の白い吹き(点)
  for (let x = x0 + 7; x < x1; x += 14) {
    s += `<ellipse cx="${x}" cy="${y0 + 3.4}" rx="2.2" ry="1" fill="${c('frame')}" stroke="${edge}" stroke-width="0.4"/><ellipse cx="${x + 7}" cy="${y1 - 3.4}" rx="2.2" ry="1" fill="${c('frame')}" stroke="${edge}" stroke-width="0.4"/>`;
    if (R() < 0.45 * d) s += `<ellipse cx="${f2(x + 7 + (R() - 0.5) * 2)}" cy="${y1 - 2.2}" rx="3" ry="1.6" fill="url(#rust-r)" opacity="${f2(0.5 + R() * 0.4)}"/>`;
    if (R() < 0.5 * d) s += `<circle cx="${f2(x + (R() - 0.5) * 3)}" cy="${y0 + 4.6}" r="${f2(0.4 + R() * 0.5)}" fill="${c('zinc')}" fill-opacity="0.55"/>`;
    if (R() < 0.35 * d) s += `<circle cx="${f2(x + 7 + (R() - 0.5) * 3)}" cy="${y1 - 4.4}" r="${f2(0.4 + R() * 0.5)}" fill="${c('zinc')}" fill-opacity="0.5"/>`;
  }
  // 枠の下辺に寄る汚れ(重力)+ しずくの垂れ
  s += `<rect x="${x0}" y="${y1 - 11}" width="${w}" height="8" fill="url(#frame-grime)" opacity="${f2(0.8 * d)}"/>`;
  for (let i = 0; i < 6 * d; i++) {
    const x = t0 + R() * (t1 - t0);
    s += `<path class="drw-drip" d="M ${f1(x)} ${y1 - 3} v ${-f1(3 + R() * 7)}" stroke="${c('soot')}" stroke-opacity="${f2(0.25 + R() * 0.2)}" stroke-width="${f2(0.8 + R() * 0.8)}" stroke-linecap="round"/>`;
  }
  // 台の厚み(窓の上の縁の影・下の縁の光)
  s += `<rect x="${x0}" y="${y0}" width="${w}" height="4" fill="url(#g-vs)"/><line x1="${x0}" y1="${y1 - 0.4}" x2="${x1}" y2="${y1 - 0.4}" stroke="#fff" stroke-opacity="0.16" stroke-width="0.5"/>`;
  // ワイパーが通る帯: 油の黒ずみ(下半分に寄る)+ 磨かれた明るい筋(帯の面に沿う横線)
  for (let i = 0; i < 4 * d; i++) {
    const x = t0 + R() * (t1 - t0 - 40), ww = 25 + R() * 45;
    s += `<ellipse cx="${f1(x + ww / 2)}" cy="${f1(cy + 4 + R() * 8)}" rx="${f1(ww / 2)}" ry="${f1(4 + R() * 4)}" fill="url(#oil-r)" opacity="${f2(0.6 + R() * 0.4)}"/>`;
  }
  for (let i = 0; i < 16 * d; i++) {
    const y = y0 + 5 + R() * (y1 - y0 - 10), x = t0 + R() * (t1 - t0 - 30), len = 15 + R() * 70;
    s += `<line x1="${f1(x)}" y1="${f2(y)}" x2="${f1(x + len)}" y2="${f2(y)}" stroke="${c('zinc')}" stroke-opacity="${(0.07 + R() * 0.1).toFixed(3)}" stroke-width="${f2(0.3 + R() * 0.35)}"/>`;
  }
  // 縁が休む 2 か所: つや + 黒ずみの筋
  [t0 + 5, t1 - 5].forEach((x) => {
    s += `<ellipse cx="${x}" cy="${cy}" rx="9" ry="${(y1 - y0) / 2}" fill="url(#polish-r)" opacity="${f2(0.9 * d)}"/><rect x="${x - 1.2}" y="${y0 + 1}" width="2.4" height="${y1 - y0 - 2}" fill="#000" fill-opacity="${(0.22 * d).toFixed(3)}" filter="url(#blur2)"/>`;
  });
  // 進行方向の深い抉り傷(暗い溝 + 上側に明るい縁)
  const gouges = d > 0 ? Math.round(2 + 2 * d) : 0;
  for (let i = 0; i < gouges; i++) {
    const x = t0 + 10 + R() * (t1 - t0 - 90), y = y0 + 8 + R() * (y1 - y0 - 16), len = 30 + R() * 60, dy = (R() - 0.5) * 2.5;
    s += `<path class="drw-gouge" d="M ${f1(x)} ${f1(y)} q ${f1(len / 2)} ${f1(dy)} ${f1(len)} 0" fill="none" stroke="#000" stroke-opacity="0.8" stroke-width="${f2(0.7 + R() * 0.5)}" stroke-linecap="round"/><path d="M ${f1(x)} ${f1(y - 0.7)} q ${f1(len / 2)} ${f1(dy)} ${f1(len)} 0" fill="none" stroke="${c('zinc')}" stroke-opacity="0.45" stroke-width="0.4" stroke-linecap="round"/>`;
  }
  // ハザード止めの脇: 指紋のような曇り(薄い楕円 + 同心の弧)
  const px = t0 + 20;
  for (let i = 0; i < 2; i++) {
    const ex = px + i * 9 + R() * 4, ey = cy - 6 + i * 11 + R() * 3, rot = -20 + R() * 40;
    s += `<g transform="rotate(${rot.toFixed(0)} ${f1(ex)} ${f1(ey)})" opacity="${f2(0.9 * d)}"><ellipse cx="${f1(ex)}" cy="${f1(ey)}" rx="5.5" ry="7.5" fill="url(#print-r)"/>`;
    for (let r = 1.5; r < 6; r += 1.1) s += `<ellipse cx="${f1(ex)}" cy="${f1(ey)}" rx="${f2(r * 0.75)}" ry="${f2(r)}" fill="none" stroke="${c('soot')}" stroke-opacity="0.16" stroke-width="0.3" stroke-dasharray="2 1.2"/>`;
    s += '</g>';
  }
  // 固定側の角の汚れ
  ([[t1 - 3, y0 + 2], [t1 - 3, y1 - 2]] as [number, number][]).forEach(([x, y]) => { s += `<circle cx="${x}" cy="${y}" r="15" fill="url(#grime-r)" opacity="${f2(0.4 + 0.3 * d)}"/>`; });
  // 粒と暗さ
  s += `<rect x="${x0}" y="${y0}" width="${w}" height="${y1 - y0}" fill="url(#grain)" opacity="0.5"/><rect x="${x0}" y="${y0}" width="${w}" height="${y1 - y0}" fill="#000" fill-opacity="${(spec.dark * 0.42).toFixed(3)}"/>`;
  return s;
}

/** ボルト(stl-nut) */
const nut = (cx: number, cy: number, r: number, pal: ArmorPalette): string =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#stl-nut)" stroke="${css(pal.edge)}" stroke-width="0.5"/><line x1="${f2(cx - r * 0.55)}" y1="${f2(cy + r * 0.2)}" x2="${f2(cx + r * 0.55)}" y2="${f2(cy - r * 0.2)}" stroke="${css(pal.chs.lo)}" stroke-width="0.7"/>`;

/** 基板の光のにじみ(静的な楕円。縁光のマスクと基板の両方が同じ形を使う) */
function glowBlobs(x0: number, x1: number, o: number): string {
  let s = '';
  for (let tx = x0; tx < x1; tx += TILE) {
    s += `<ellipse cx="${tx + 130}" cy="26" rx="130" ry="22" fill="url(#glow-g)" opacity="${o}"/><ellipse cx="${tx + 110}" cy="76" rx="130" ry="24" fill="url(#glow-g)" opacity="${o}"/>`;
  }
  return s;
}

/** 下の板(台 3 本 + 窓の網 + 縁光 + レール・止め・ローラー + 上の板の縁の影) */
export function drawerSVG(spec: DrawerSpec, pal: ArmorPalette, id: string): string {
  const { x0, x1 } = spec, w = x1 - x0, tone = drawerTone(pal, spec.dark), edge = css(pal.edge), dr = pal.drw;
  let s = `<defs>${meshDefs(id, pal)}</defs>`;
  CARRIER.forEach(([a, b], i) => {
    s += armorSVG({ tone, b: 1.6, shadow: 0, pts: [[x0, a], [x1, a], [x1, b], [x0, b]], wx: { chips: 0.35, grime: 0.35 }, seed: 500 + i }, pal, `${id}-c${i}`);
  });
  FIELDS.forEach(([a, b], i) => { s += meshField(spec, pal, id, a, b, 23 + i); });
  // 帯の縁の裏からの光: 自前のにじみ(静的)をマスクに、縁の線だけ残す。窓の外は切り抜く
  const win = FIELDS.map(([a, b]) => `<rect x="${x0}" y="${a + 3}" width="${w}" height="${b - a - 6}"/>`).join('');
  s += `<clipPath id="${id}-win">${win}</clipPath>`;
  s += `<mask id="${id}-rim" maskUnits="userSpaceOnUse" x="${x0}" y="0" width="${w}" height="102"><g filter="url(#blur8)">${glowBlobs(x0, x1, 1)}</g></mask>`;
  s += `<g class="drw-rim" clip-path="url(#${id}-win)" mask="url(#${id}-rim)" opacity="${f2(DRAWER.glow * 1.3)}"><rect x="${x0}" y="0" width="${w}" height="102" style="fill:var(--ma-on)" mask="url(#${id}-rm)"/></g>`;
  s += `<mask id="${id}-rm" maskUnits="userSpaceOnUse" x="${x0}" y="0" width="${w}" height="102"><rect x="${x0}" y="0" width="${w}" height="102" fill="url(#${id}-rimp)"/></mask>`;
  // 中央の鋼レール
  s += `<rect x="${x0}" y="47.6" width="${w}" height="4.8" fill="${css(pal.chs.lo)}"/><rect x="${x0}" y="48.3" width="${w}" height="3.4" fill="url(#stl-fl)"/><line x1="${x0}" y1="48.4" x2="${x1}" y2="48.4" stroke="#fff" stroke-opacity="0.4" stroke-width="0.45"/><line x1="${x0}" y1="51.6" x2="${x1}" y2="51.6" stroke="#000" stroke-opacity="0.75" stroke-width="0.6"/>`;
  s += `<rect x="${x0}" y="52.3" width="${w}" height="1.7" fill="url(#wx-grime)" opacity="${f2(0.9 * spec.dirt)}"/>`;
  // ハザード止め・ローラー・弧の傷(段ごと。動く縁が当たる端 t0 に置く)
  spec.bands.filter((b) => b.y1 - b.y0 >= 8).forEach((b) => {
    const { t0 } = travel(spec, b.cut), y = (b.y0 + b.y1) / 2, x = t0 + 15;
    s += `<rect x="${t0}" y="${b.y0 + 3}" width="${STOP_W}" height="${b.y1 - b.y0 - 6}" fill="url(#hz)" stroke="${edge}" stroke-width="0.6"/>`;
    s += `<rect x="${x - 1}" y="${y - 7}" width="12" height="14" rx="1.2" fill="#000" fill-opacity="0.5" filter="url(#blur2)"/>`;
    s += `<rect x="${x}" y="${y - 6}" width="10" height="12" rx="1" fill="${css(pal.chs.bot)}" stroke="${edge}" stroke-width="0.7"/><rect x="${x}" y="${y - 6}" width="10" height="12" fill="url(#grain)" opacity="0.4"/><line x1="${x + 0.6}" y1="${y - 5.4}" x2="${x + 9.4}" y2="${y - 5.4}" stroke="#fff" stroke-opacity="0.2" stroke-width="0.5"/>${nut(x + 5, y, 3.2, pal)}`;
    s += `<path d="M ${x - 4} ${y + 8.5} q 9 2.5 18 0" fill="none" stroke="${css(dr.edgeHi)}" stroke-opacity="${f2(0.35 * spec.dirt)}" stroke-width="0.35"/><path d="M ${x - 3} ${y - 8.5} q 8 -2 16 0" fill="none" stroke="#000" stroke-opacity="${f2(0.45 * spec.dirt)}" stroke-width="0.35"/>`;
  });
  // 上の板の縁の影(帯ごと。近い影 3.5px・遠い影 18px。幅は窓幅で頭打ち)。左の板の縁(lx)は動くので data で印を付ける
  s += `<g class="drw-shadow" opacity="${spec.shadow}">` + spec.bands.map((b, i) => {
    const { t0, t1 } = travel(spec, b.cut), win2 = Math.max(0, t1 - t0), near = Math.min(3.5, win2), far = Math.min(18, win2), h = b.y1 - b.y0;
    const r = (n: string, x: number, ww: number, g: string) => `<rect data-sh="${n}" data-band="${i}" x="${f2(x)}" y="${b.y0}" width="${f2(ww)}" height="${h}" fill="url(#${g})"/>`;
    return r('far-l', t0, far, 'sh-far-l') + r('far-r', t1 - far, far, 'sh-far-r') + r('near-l', t0, near, 'sh-near-l') + r('near-r', t1 - near, near, 'sh-near-r');
  }).join('') + '</g>';
  return s;
}

/** 窓の縁の切り口(上の板の切れ目の側面の削り跡)。L = 左の板の右端、R = 右の板の左端 */
export function machinedEdge(side: 'L' | 'R', cut: number, band: { y0: number; y1: number }): string {
  if (band.y1 - band.y0 < 8) return '';
  const L = side === 'L', x = L ? cut - 1.6 : cut, bx = L ? cut - 4 : cut + 0.6, y0 = band.y0 + 1, y1 = band.y1 - 1;
  let s = `<rect x="${x}" y="${y0}" width="1.6" height="${y1 - y0}" fill="#0c0e10"/>`;
  for (let y = y0 + 1; y < y1; y += 1.6) s += `<line x1="${bx}" y1="${y}" x2="${bx + 3.4}" y2="${f2(y + 0.3)}" stroke="${L ? '#000' : '#fff'}" stroke-opacity="${L ? 0.25 : 0.14}" stroke-width="0.35"/>`;
  s += `<line x1="${L ? cut - 4.1 : cut + 4.1}" y1="${y0}" x2="${L ? cut - 4.1 : cut + 4.1}" y2="${y1}" stroke="#fff" stroke-opacity="${L ? 0.18 : 0.34}" stroke-width="0.55"/><line x1="${L ? cut - 0.3 : cut + 1.9}" y1="${y0}" x2="${L ? cut - 0.3 : cut + 1.9}" y2="${y1}" stroke="#fff" stroke-opacity="0.22" stroke-width="0.45"/>`;
  return s;
}

/** 配線 6 本(上段 3 + 下段 3)。TILE ごとに折れを繰り返す。[基準の y, 折れの列 [x, y]] */
const TRACES: [number, [number, number][]][] = [
  [13, [[96, 13], [104, 21], [196, 21], [204, 13]]],
  [27, [[62, 27], [70, 35], [140, 35], [148, 27]]],
  [40, [[126, 40], [134, 32], [220, 32], [228, 40]]],
  [62, [[76, 62], [84, 70], [170, 70], [178, 62]]],
  [80, [[136, 80], [144, 88], [200, 88], [208, 80]]],
  [92, [[100, 92], [108, 84], [190, 84], [198, 92]]],
];
function tracePath(x0: number, x1: number, y: number, pts: [number, number][]): string {
  let d = `M ${x0} ${y}`;
  for (let tx = x0; tx < x1; tx += TILE) {
    pts.forEach(([x, py], k) => { d += k === 0 ? ` H ${tx + x}` : ` L ${tx + x} ${py}`; });
    d += ` H ${tx + TILE}`;
  }
  return d;
}

/** 基板(窓の奥の光)。窓の形で切り抜き、部品は TILE ごとの繰り返し(窓が長くなっても伸びない)。blur フィルタは置かない */
export function glowSVG(spec: GlowSpec, pal: ArmorPalette, id: string): string {
  const { x0, x1 } = spec, w = x1 - x0, edge = css(pal.edge);
  const clip = spec.windows.map(([a, b]) => `<rect x="${x0}" y="${a + 1}" width="${w}" height="${b - a - 2}"/>`).join('');
  let s = `<defs><clipPath id="${id}-win">${clip}</clipPath></defs><g class="milspec-drw-glow" opacity="${spec.glow}" clip-path="url(#${id}-win)">`;
  // 基板(板 2 枚 = 窓ごと)+ シルク線(24px ごとの縦線)
  spec.windows.forEach(([a, b]) => {
    s += `<rect x="${x0}" y="${a}" width="${w}" height="${b - a}" style="fill:var(--ma-pcb)"/><rect x="${x0}" y="${a}" width="${w}" height="${b - a}" fill="url(#grain)" opacity="0.35"/>`;
    for (let gx = x0 + 10; gx < x1; gx += 24) s += `<line x1="${gx}" y1="${a}" x2="${gx}" y2="${b}" style="stroke:var(--ma-pcb-silk)" stroke-opacity="0.08" stroke-width="0.5"/>`;
  });
  // 配線: 縁(--ma-cu-dim 2.2)+ 芯(--ma-cu 1.3)+ 光の経路(milspec-trc。光はエンジンが走らせる)+ 折れのパッド
  TRACES.forEach(([y, pts], i) => {
    const d = tracePath(x0, x1, y, pts);
    s += `<path d="${d}" fill="none" style="stroke:var(--ma-cu-dim)" stroke-width="2.2" stroke-linejoin="round"/><path d="${d}" fill="none" style="stroke:var(--ma-cu)" stroke-width="1.3" stroke-linejoin="round"/>`;
    s += `<path class="milspec-trc" data-trace="drw:${i + 1}" d="${d}"/>`;
    for (let tx = x0; tx < x1; tx += TILE) {
      pts.forEach(([px, py]) => { s += `<circle cx="${tx + px}" cy="${py}" r="1.7" style="fill:var(--ma-gold)"/><circle cx="${tx + px}" cy="${py}" r="0.6" style="fill:var(--ma-pcb)"/>`; });
    }
  });
  // チップ(上段: 型番入り / 下段: 縦長)
  for (let tx = x0; tx < x1; tx += TILE) {
    const cx = tx + 120;
    s += `<rect x="${cx}" y="18" width="34" height="18" rx="1" fill="${css(pal.chs.lo)}" stroke="${edge}" stroke-width="0.6"/>` +
      `<text x="${cx + 17}" y="29.5" font-family="'Share Tech Mono', monospace" font-size="4.2" text-anchor="middle" letter-spacing="0.1em" style="fill:var(--ma-pcb-silk)">LP-0418</text>`;
    for (let px = cx + 2; px < cx + 34; px += 3) s += `<rect x="${px}" y="15.6" width="1.4" height="2.4" style="fill:var(--ma-gold)"/><rect x="${px}" y="36" width="1.4" height="2.4" style="fill:var(--ma-gold)"/>`;
    const bx = tx + 40;
    s += `<rect x="${bx}" y="63" width="22" height="30" rx="1" fill="${css(pal.chs.lo)}" stroke="${edge}" stroke-width="0.6"/>`;
    for (let py = 65; py < 92; py += 3) s += `<rect x="${bx - 2.4}" y="${py}" width="2.4" height="1.4" style="fill:var(--ma-gold)"/><rect x="${bx + 22}" y="${py}" width="2.4" height="1.4" style="fill:var(--ma-gold)"/>`;
  }
  // 静的なにじみ(基板全体がうっすら緑に照らされる)
  s += glowBlobs(x0, x1, 0.6);
  return s + '</g>';
}
