import { dedupe } from './geom';
import { seedOf } from './weather';
import type { PanelSpec, PlacedPanel, Pt, StretchFrame } from './types';

/** 境界(sx, sy)より大きい座標だけを、伸びた量(w - w0, h - h0)ぶん動かす */
const mv = (x: number, y: number, f: StretchFrame, w: number, h: number): Pt => [
  x > f.sx ? x + (w - f.w0) : x,
  y > f.sy ? y + (h - f.h0) : y,
];

const isCmd = (t: string): boolean => /^[A-Za-z]$/.test(t);

/** path 文字列(M L H V の絶対座標のみ)を伸ばす。それ以外の命令は Error */
function stretchPath(d: string, f: StretchFrame, w: number, h: number): string {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out: string[] = [];
  let i = 0;
  while (i < toks.length) {
    const cmd = toks[i++];
    if (!isCmd(cmd)) throw new Error(`stretchPath: 命令が来る位置に数値があります: ${cmd}`);
    if (cmd !== 'M' && cmd !== 'L' && cmd !== 'H' && cmd !== 'V') throw new Error(`stretchPath: 未対応の path 命令です: ${cmd}`);
    out.push(cmd);
    while (i < toks.length && !isCmd(toks[i])) {
      if (cmd === 'H') { out.push(String(mv(parseFloat(toks[i]), 0, f, w, h)[0])); i += 1; }
      else if (cmd === 'V') { out.push(String(mv(0, parseFloat(toks[i]), f, w, h)[1])); i += 1; }
      else { const [x, y] = mv(parseFloat(toks[i]), parseFloat(toks[i + 1]), f, w, h); out.push(`${x} ${y}`); i += 2; }
    }
  }
  return out.join(' ');
}

const stretchPts = (pts: Pt[], f: StretchFrame, w: number, h: number): Pt[] => pts.map(([x, y]) => mv(x, y, f, w, h));

/** パネルを w x h に伸ばした形にする(境界より大きい座標だけが動く) */
export function stretchSpec(spec: PanelSpec, f: StretchFrame, w: number, h: number): PanelSpec {
  const out: PanelSpec = { ...spec, pts: stretchPts(spec.pts, f, w, h), seed: spec.seed ?? seedOf(dedupe(spec.pts)) };
  if (spec.wx) {
    const wx = { ...spec.wx };
    if (wx.heat) wx.heat = wx.heat.map(([cx, cy, r]): [number, number, number] => { const [x, y] = mv(cx, cy, f, w, h); return [x, y, r]; });
    if (wx.wear) wx.wear = wx.wear.map(([cx, cy, r, n]): [number, number, number, number] => { const [x, y] = mv(cx, cy, f, w, h); return [x, y, r, n]; });
    if (wx.streaks) wx.streaks = wx.streaks.map(([sx, sy, len]): [number, number, number] => { const [x, y] = mv(sx, sy, f, w, h); return [x, y, len]; });
    out.wx = wx;
  }
  if (spec.pockets) out.pockets = spec.pockets.map((pk) => ({ ...pk, pts: stretchPts(pk.pts, f, w, h) }));
  if (spec.circles) out.circles = spec.circles.map(([cx, cy, r]): [number, number, number] => { const [x, y] = mv(cx, cy, f, w, h); return [x, y, r]; });
  if (spec.scribes) out.scribes = spec.scribes.map((d) => stretchPath(d, f, w, h));
  if (spec.seams) out.seams = spec.seams.map((d) => stretchPath(d, f, w, h));
  return out;
}

/**
 * 区画(ゾーン)内に置かれたパネルを、区画が W x H に伸びたときの形にする。
 * f は区画の座標系(w0,h0 = 見本の区画の大きさ、sx,sy = 伸ばす境界線)。
 * p.x,y,w,h は区画座標、p.spec の点はパネル内座標。
 */
export function stretchPlaced(p: PlacedPanel, f: StretchFrame, W: number, H: number): PlacedPanel {
  const mvx = (v: number): number => (v > f.sx ? v + (W - f.w0) : v);
  const mvy = (v: number): number => (v > f.sy ? v + (H - f.h0) : v);
  const x = mvx(p.x), y = mvy(p.y), w = mvx(p.x + p.w) - x, h = mvy(p.y + p.h) - y;
  const spec = stretchSpec(p.spec, { w0: p.w, h0: p.h, sx: f.sx - p.x, sy: f.sy - p.y }, w, h);
  return { x, y, w, h, spec };
}
