/**
 * ヘッダー(H1〜H5)と通気口の座標表(見本 milspec-v11.js js:863-940 の手打ち座標を MW の関数にしたもの)。
 * 座標はヘッダー区画 / 通気口区画の左上基準。パスは M/L/H/V の絶対座標のみ(stretchPath の制約)。
 * 引数 MW は layoutMW 済み(>= 1189)。
 */
import type { CapSpec, PanelSpec, PlacedPanel, Pt, StretchFrame } from './armor/types';
import { bank, chamRect, circ, shift, stadium } from './armor/geom';
import { stretchPlaced } from './armor/stretch';

export const HDR_BASE_MW = 1189;
export const HDR_H = 102;

/** 幅が 1189 未満のときの縮小率 */
export const headerScale = (MW: number): number => (MW < HDR_BASE_MW ? MW / HDR_BASE_MW : 1);
/** サイドバー 274 + 列の隙間 2。開閉でヘッダー区画の幅が変わる量 */
export const SIDEBAR_SPAN = 276;
/** 縮小率は常にサイドバー開状態の幅で決める(閉じても同じ値。閉じた分は描画幅 mwFor が広がる) */
export const headerScaleFor = (zoneWidth: number, sidebarOpen: boolean): number =>
  headerScale(sidebarOpen ? zoneWidth : zoneWidth - SIDEBAR_SPAN);
/** 内箱は scale 倍されて幅 100%/scale に広がるので、描画幅は 区画の実幅 ÷ 縮小率(1189 未満にはしない) */
export const mwFor = (zoneWidth: number, scale: number): number =>
  Math.max(HDR_BASE_MW, Math.round(zoneWidth / scale));
/** 縮小時は 1189 で描く */
export const layoutMW = (MW: number): number => Math.max(MW, HDR_BASE_MW);

/** ヘッダーの伸縮線は x = 700(これより左は左端基準・右は MW 基準)。relayout の継ぎ目にも使う */
export const HDR_FRAME: StretchFrame = { w0: HDR_BASE_MW, h0: HDR_H, sx: 700, sy: 9999 };

export interface HdrKeyRow {
  id: 'aux' | 'com' | 'party' | 'io' | 'mainstream' | 'gear' | 'sort';
  x: number; y: number; caps: CapSpec[];
}

type XY = { x: number; y: number };
type XYWH = XY & { w: number; h: number };

export interface HdrDecor {
  logo: XY;
  decal: XY;
  idH1: XY;
  rivets: XY[];
  /** 銘板の箱(区画座標)と、箱内の文字位置 */
  nameplate: XYWH & { eng: XY; ttl: XY; sub: XY };
  barcode: XY;
  sn: XY;
  h3: { trb: XY; turbines: XY[]; lamps: XY; rotating: XY; clock: XY | null; clockLabel: XY | null; id: XY };
  h4: { aux: XY; dsp: XY; rocker: XYWH; mode: XY; lever: XYWH; com: XY; id: XY };
  h5: { party: XY; crt: XYWH; sort: XY };
}

// キー列の輪郭(js:893, 910, 920, 924)
const tOut: Pt[] = [[0, 0], [134, 0], [140, 6], [140, 28], [6, 28], [0, 22]];
const pOut: Pt[] = [[0, 0], [238, 0], [250, 12], [250, 32], [9, 32], [0, 23]];
const nOut: Pt[] = [[10, 0], [219, 0], [209, 32], [0, 32]];
const sOut: Pt[] = [[12, 0], [166, 0], [166, 20], [154, 32], [0, 32], [0, 12]];

// 見本の cluster(): 親パネルの pockets に shift(outline, 列x-パネルx, 列y-パネルy) を足す
const pocket = (outline: Pt[], colX: number, colY: number, panel: PlacedPanel, b = 1.8) =>
  ({ b, pts: shift(outline, colX - panel.x, colY - panel.y) });

/** MW=1189 の見本座標でパネルを作る(MW 依存の式は 1189 を入れた値。幅が増える分は stretchPlaced が動かす) */
function basePanels(): PlacedPanel[] {
  const MW = HDR_BASE_MW;
  const iw = MW - 879;
  const chassis: PanelSpec = { tone: 'chs', b: 2, shadow: 3, pts: [[0, 0], [MW, 0], [MW, 102], [0, 102]], wx: { chips: 0.4, grime: 0.6 } };
  const h1: PanelSpec = {
    tone: 'pri', b: 4, pts: chamRect(120, 42, 10, 10, 10, 10),
    // 見本の末尾 Z は最後の点へ L で戻す形に直す(stretchPath は M/L/H/V のみ)
    scribes: ['M 13 5.5 H 107 L 114.5 13 V 29 L 107 36.5 H 13 L 5.5 29 V 13 L 13 5.5'],
    wx: { chips: 1.2 },
  };
  const h2: PanelSpec = {
    tone: 'sec', b: 4, pts: [[0, 0], [386, 0], [386, 28], [372, 42], [14, 42], [0, 28]],
    pockets: [{ b: 2, fill: '#0c0e10', pts: shift(chamRect(362, 30, 4, 4, 9, 9), 12, 6) }],
    wx: { chips: 0.9 },
  };
  const h3: PanelSpec = {
    tone: 'pri', b: 4, pts: [[0, 6], [8, 0], [iw - 18, 0], [iw, 18], [iw, 44], [104, 44], [96, 36], [0, 36]],
    circles: [[35, 19, 17], [75, 19, 17]],
    seams: [`M 112 39 H ${iw >= 300 ? iw - 120 : iw - 24}`],
    wx: { heat: [[35, 19, 24], [75, 19, 24]], chips: 1.1 },
  };
  const h4: PanelSpec = {
    tone: 'pri', b: 4, pts: [[18, 0], [353, 0], [353, 44], [8, 44], [0, 36], [0, 18]],
    scribes: ['M 160 9 V 40', 'M 200 9 V 40', 'M 248 9 V 40'],
    wx: { chips: 1, wear: [[222, 26, 24, 5], [178, 26, 14, 2]] },
  };
  const h5: PanelSpec = {
    tone: 'pri', b: 4, pts: [[0, 0], [MW - 300, 0], [MW - 294, -4], [MW, -4], [MW, 48], [30, 48], [0, 18]],
    pockets: [{ b: 2.2, fill: '#040505', pts: shift(chamRect(334, 40, 8, 3, 8, 3), 346, 4) }],
    scribes: [`M ${MW - 298} 8 V 42`],
    seams: ['M 96 5.6 H 336'],
    wx: { chips: 1, wear: [[MW - 150, 26, 80, 5], [150, 28, 110, 4]] },
  };
  return [
    { x: 0, y: 0, w: MW, h: 102, spec: chassis },
    { x: 4, y: 4, w: 120, h: 42, spec: h1 },
    { x: 128, y: 4, w: 386, h: 42, spec: h2 },
    { x: 518, y: 4, w: iw, h: 44, spec: h3 },
    { x: MW - 357, y: 4, w: 353, h: 44, spec: h4 },
    { x: 0, y: 52, w: MW, h: 48, spec: h5 },
  ];
}

export function headerLayout(MW: number): {
  frame: StretchFrame; panels: PlacedPanel[]; keyRows: HdrKeyRow[]; decor: HdrDecor;
  traces: { name: string; d: string; pc: 'seam' | 'leak' }[];
  meter: { ix: number; iw: number; showClock: boolean };
} {
  MW = Math.max(MW, HDR_BASE_MW); // 縮小時は layoutMW 済みの値を渡す約束。誤用しても 1189 未満では描かない
  const frame = { ...HDR_FRAME };
  const panels = basePanels().map((p) => stretchPlaced(p, frame, MW, HDR_H));
  const p4 = panels[4], p5 = panels[5];
  const ix = 518, iw = MW - 879, showClock = iw >= 300, cx = MW - 357;

  // 列の位置が MW で動くものは、伸縮ではなく MW から直接置く(伸縮線をまたぐ輪郭が歪まないように)
  p4.spec.pockets = [pocket(tOut, cx + 14, 15, p4), pocket(stadium(0, 0, 86, 28), cx + 254, 15, p4, 1.6)];
  if (MW - 514 - 690 > 40) p5.spec.seams = [...(p5.spec.seams ?? []), `M 690 5.6 H ${MW - 514}`];
  p5.spec.pockets = [
    ...(p5.spec.pockets ?? []),
    pocket(pOut, 21, 63, p5),
    pocket(stadium(0, 0, 64, 32), 276, 63, p5, 1.6),
    pocket(nOut, MW - 502, 63, p5),
    pocket(circ(19, 16, 16), MW - 272, 63, p5, 1.6),
    pocket(sOut, MW - 190, 63, p5),
  ];

  const keyRows: HdrKeyRow[] = [
    { id: 'aux', x: cx + 14, y: 15, caps: bank(tOut, [1]).map((pts) => ({ pts })) },
    { id: 'com', x: cx + 254, y: 15, caps: [12, 32.7, 53.3, 74].map((x) => ({ pts: circ(x, 14, 9.6) })) },
    { id: 'party', x: 21, y: 63, caps: bank(pOut, [1, 1.12]).map((pts) => ({ pts })) },
    { id: 'io', x: 276, y: 63, caps: [circ(16, 16, 12.6), circ(48, 16, 12.6)].map((pts) => ({ pts })) },
    { id: 'mainstream', x: MW - 502, y: 63, caps: bank(nOut, [1]).map((pts) => ({ pts })) },
    { id: 'gear', x: MW - 272, y: 63, caps: [{ pts: circ(19, 16, 12.8) }] },
    { id: 'sort', x: MW - 190, y: 63, caps: bank(sOut, [1.28, 1]).map((pts) => ({ pts, lip: true })) },
  ];

  const decor: HdrDecor = {
    logo: { x: 28, y: 13 },
    decal: { x: 29, y: 31.6 },
    idH1: { x: 96, y: 28.5 },
    rivets: [{ x: 132.8, y: 22.5 }, { x: 506.2, y: 22.5 }],
    nameplate: { x: 128, y: 4, w: 386, h: 42, eng: { x: 22, y: 12 }, ttl: { x: 22, y: 20 }, sub: { x: 262, y: 24.5 } },
    barcode: { x: 446, y: 14 },
    sn: { x: 446, y: 26 },
    h3: {
      trb: { x: ix + 98, y: 7 },
      turbines: [{ x: ix + 18, y: 6 }, { x: ix + 58, y: 6 }],
      lamps: { x: ix + 124, y: 12 },
      rotating: { x: ix + 8, y: 42.5 },
      clock: showClock ? { x: ix + iw - 107, y: 18 } : null,
      clockLabel: showClock ? { x: ix + iw - 107, y: 9.5 } : null,
      id: { x: ix + iw - 26, y: 6 },
    },
    h4: {
      aux: { x: MW - 335, y: 8.4 },
      dsp: { x: MW - 191, y: 8.4 },
      rocker: { x: MW - 187, y: 14, w: 17, h: 30 },
      mode: { x: MW - 151, y: 8.4 },
      lever: { x: MW - 150, y: 14, w: 36, h: 30 },
      com: { x: MW - 99, y: 8.4 },
      id: { x: MW - 25, y: 6.5 },
    },
    h5: { party: { x: 34, y: 57.2 }, crt: { x: 349, y: 59, w: 328, h: 34 }, sort: { x: MW - 222, y: 77 } },
  };

  // 光の経路(区画座標・絶対)
  const traces: { name: string; d: string; pc: 'seam' | 'leak' }[] = [
    { name: 'h3', d: `M ${ix + 112} 43 H ${ix + (showClock ? iw - 120 : iw - 24)}`, pc: 'seam' },
    { name: 'h5a', d: 'M 96 57.6 H 336', pc: 'seam' },
  ];
  if (MW - 514 - 690 > 40) traces.push({ name: 'h5b', d: `M 690 57.6 H ${MW - 514}`, pc: 'seam' });

  return { frame, panels, keyRows, decor, traces, meter: { ix, iw, showClock } };
}

/** 通気口(js:930-940)。座標は通気口区画の左上基準 */
export function ventLayout(MW: number): {
  xb0: number; xb1: number; chanL: { x: number; w: number }; chanR: { x: number; w: number };
  pull: { x: number; w: 52 }; pullLabelX: number; hazR: number; pnX: number; leak: string;
} {
  const xb0 = Math.round(MW / 2 - 190), xb1 = xb0 + 11 * 12 - 4;
  return {
    xb0, xb1,
    chanL: { x: 190, w: xb0 - 8 - 190 },
    chanR: { x: xb1 + 8, w: MW - 164 - (xb1 + 8) },
    pull: { x: MW / 2 - 26, w: 52 },
    pullLabelX: MW / 2 + 30,
    hazR: MW - 62,
    pnX: MW - 152,
    leak: `M 0 -1.2 H ${MW}`,
  };
}

/** 台車(光の玉の列+取っ手+PULL 文字)の幅と、レール両端の余白 */
export const CARRIAGE_W = 252;
export const RAIL_MARGIN = 6;
/** 台車の左端(区画座標)。格子 xb0 の 2px 手前 */
export const ventCarriageX = (MW: number): number => MW / 2 - 192;
/** レール(区画座標)。台車の画面上の走行量は SIDEBAR_SPAN/2 で、区画内では ÷scale。
 *  開いた状態では台車は右端・閉じた状態では左端にいて、画面上のレールは開閉で動かない */
export function ventRailRange(MW: number, sidebarOpen: boolean, scale: number): { x: number; w: number } {
  const run = SIDEBAR_SPAN / 2 / scale;
  const cx = ventCarriageX(MW);
  return { x: (sidebarOpen ? cx - run : cx) - RAIL_MARGIN, w: CARRIAGE_W + run + 2 * RAIL_MARGIN };
}
