/**
 * ヘッダー(H1〜H5)と通気口の座標表(見本 milspec-v11.js js:863-940 の手打ち座標を MW の関数にしたもの)。
 * 座標はヘッダー区画 / 通気口区画の左上基準。パスは M/L/H/V の絶対座標のみ(stretchPath の制約)。
 * 引数 MW は 1189 以上(mwFor 済み)。
 */
import type { CapSpec, DrawerSpec, GlowSpec, PanelSpec, PlacedPanel, Pt, StretchFrame } from './armor/types';
import { bank, bbox, chamRect, circ, clipHalf, dedupe, shift, stadium } from './armor/geom';
import { stretchPlaced } from './armor/stretch';
import { machinedEdge } from './armor/machinedEdge';
import { seedOf } from './armor/weather';

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

/** ヘッダーの伸縮線(w0 / h0 の基準)。headerLayout が板ごとに sx を決めて使う(relayout の継ぎ目は HDR_BANDS を使い、これは使わない) */
const HDR_FRAME: StretchFrame = { w0: HDR_BASE_MW, h0: HDR_H, sx: 700, sy: 9999 };

/** 上の板の切れ目(区画座標・1189 基準)。外枠 700 / 上段(H3)714 / 下段(H5)683。左の板だけが滑る */
export const HDR_CUTS = { chs: 700, h3: 714, h5: 683 } as const;
/** 切れ目の帯(y の範囲)と、その帯に使う切れ目 */
export const HDR_BANDS: { y0: number; y1: number; cut: number }[] = [
  { y0: 0, y1: 4, cut: 700 }, { y0: 4, y1: 48, cut: 714 }, { y0: 48, y1: 52, cut: 700 }, { y0: 52, y1: 100, cut: 683 }, { y0: 100, y1: 102, cut: 700 },
];
/** 左の板の両端が切れ目より外へはみ出す量(窓の外で隠れる分) */
const DRAWER_OVER = 60;
/** 設計書 §0 / D8 の決定値 */
const D8 = { shadow: 1, dirt: 2, dark: 1, glow: 1 } as const;
const GLOW_WINDOWS: readonly (readonly [number, number])[] = Object.freeze([Object.freeze([6, 46] as const), Object.freeze([54, 98] as const)]);

export interface HdrKeyRow {
  id: 'aux' | 'com' | 'party' | 'io' | 'members' | 'view' | 'sort';
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
  h5: { party: XY; crt: XYWH; sort: XY; members: XY; view: XY };
}

// キー列の輪郭(js:893, 910, 920, 924)
const tOut: Pt[] = [[0, 0], [134, 0], [140, 6], [140, 28], [6, 28], [0, 22]];
const pOut: Pt[] = [[0, 0], [238, 0], [250, 12], [250, 32], [9, 32], [0, 23]];
const sOut: Pt[] = [[12, 0], [166, 0], [166, 20], [154, 32], [0, 32], [0, 12]];

// 見本の cluster(): 親パネルの pockets に shift(outline, 列x-パネルx, 列y-パネルy) を足す
const pocket = (outline: Pt[], colX: number, colY: number, panel: PlacedPanel, b = 1.8) =>
  ({ b, pts: shift(outline, colX - panel.x, colY - panel.y) });

/** path 文字列(M L H V の絶対座標のみ)の x を dx だけずらす */
function shiftPathX(d: string, dx: number): string {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out: string[] = [];
  let cmd = '', k = 0;
  toks.forEach((t) => {
    if (/^[A-Za-z]$/.test(t)) { cmd = t; k = 0; out.push(t); return; }
    const v = parseFloat(t);
    out.push(String(cmd === 'V' || (cmd !== 'H' && k % 2 === 1) ? v : v + dx));
    k += 1;
  });
  return out.join(' ');
}

/** 板を切れ目(区画座標 cut)で左右に分ける。くぼみ・ボルト・傷は中心の x で振り分け、右は x を切れ目の分だけ左へ詰めて x=cut に置く。
 *  傷の種は元の形で固定(左右で模様が変わらないように) */
function splitPlaced(p: PlacedPanel, cut: number, nameL: string, nameR: string): [PlacedPanel, PlacedPanel] {
  const spec = p.spec as PanelSpec, cl = cut - p.x, seed = spec.seed ?? seedOf(dedupe(spec.pts));
  const isL = (x: number): boolean => x < cl;
  const firstX = (d: string): number => parseFloat(d.match(/^M\s*(-?[\d.]+)/)![1]);
  const mk = (pts: Pt[]): PanelSpec => ({ ...spec, pts, seed, pockets: [], circles: [], scribes: [], seams: [], wx: { ...(spec.wx ?? {}), heat: [], wear: [] } });
  const L = mk(clipHalf(spec.pts, -1, 0, cl));
  const R = mk(clipHalf(spec.pts, 1, 0, -cl).map(([x, y]): Pt => [x - cl, y]));
  (spec.pockets ?? []).forEach((pk) => { const b = bbox(pk.pts); if (isL(b.x + b.w / 2)) L.pockets!.push(pk); else R.pockets!.push({ ...pk, pts: pk.pts.map(([x, y]): Pt => [x - cl, y]) }); });
  (spec.circles ?? []).forEach(([cx, cy, r]) => { if (isL(cx)) L.circles!.push([cx, cy, r]); else R.circles!.push([cx - cl, cy, r]); });
  (spec.scribes ?? []).forEach((d) => { if (isL(firstX(d))) L.scribes!.push(d); else R.scribes!.push(shiftPathX(d, -cl)); });
  (spec.seams ?? []).forEach((d) => { if (isL(firstX(d))) L.seams!.push(d); else R.seams!.push(shiftPathX(d, -cl)); });
  (spec.wx?.heat ?? []).forEach(([cx, cy, r]) => { if (isL(cx)) L.wx!.heat!.push([cx, cy, r]); else R.wx!.heat!.push([cx - cl, cy, r]); });
  (spec.wx?.wear ?? []).forEach(([cx, cy, r, n]) => { if (isL(cx)) L.wx!.wear!.push([cx, cy, r, n]); else R.wx!.wear!.push([cx - cl, cy, r, n]); });
  return [
    { name: nameL, x: p.x, y: p.y, w: cl, h: p.h, spec: L },
    { name: nameR, x: cut, y: p.y, w: p.w - cl, h: p.h, spec: R },
  ];
}

/** MW=1189 の見本座標でパネルを作る(切れ目で左右に分けた後)。右の半分と h4 は headerLayout が MW 分だけ平行移動する */
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
    seams: ['M 112 39 H 188'], // 継ぎ目は左の板で終わる(区画座標 630〜706)
    wx: { heat: [[35, 19, 24], [75, 19, 24]], chips: 1.1 },
  };
  const h4: PanelSpec = {
    tone: 'pri', b: 4, pts: [[18, 0], [353, 0], [353, 44], [8, 44], [0, 36], [0, 18]],
    scribes: ['M 160 9 V 40', 'M 200 9 V 40', 'M 248 9 V 40'],
    wx: { chips: 1, wear: [[222, 26, 24, 5], [178, 26, 14, 2]] },
  };
  const h5: PanelSpec = {
    tone: 'pri', b: 4, pts: [[0, 0], [MW - 300, 0], [MW - 294, -4], [MW, -4], [MW, 48], [30, 48], [0, 18]],
    pockets: [{ b: 2.2, fill: '#040505', pts: shift(chamRect(330, 40, 8, 3, 8, 3), 346, 4) }],
    scribes: [`M ${MW - 298} 8 V 42`],
    seams: ['M 96 5.6 H 336'],
    wx: { chips: 1, wear: [[MW - 150, 26, 80, 5], [150, 28, 110, 4]] },
  };
  const [chsL, chsR] = splitPlaced({ x: 0, y: 0, w: MW, h: 102, spec: chassis }, HDR_CUTS.chs, 'chsL', 'chsR');
  const [h3L, h3R] = splitPlaced({ x: 518, y: 4, w: iw, h: 44, spec: h3 }, HDR_CUTS.h3, 'h3L', 'h3R');
  const [h5L, h5R] = splitPlaced({ x: 0, y: 52, w: MW, h: 48, spec: h5 }, HDR_CUTS.h5, 'h5L', 'h5R');
  // 上の板の切れ目の切り口(見本 v3 machinedEdge)。帯が 8px 未満の外枠(700)は出ない。板内座標(L は切れ目 − 板の x、R は 0 から)
  const edge = (l: PlacedPanel, r: PlacedPanel, cut: number) => {
    (l.spec as PanelSpec).extra = machinedEdge('L', cut - l.x, { y0: 0, y1: l.h });
    (r.spec as PanelSpec).extra = machinedEdge('R', 0, { y0: 0, y1: r.h });
  };
  edge(h3L, h3R, HDR_CUTS.h3);
  edge(h5L, h5R, HDR_CUTS.h5);
  return [
    chsL, chsR,
    { name: 'h1', x: 4, y: 4, w: 120, h: 42, spec: h1 },
    { name: 'h2', x: 128, y: 4, w: 386, h: 42, spec: h2 },
    h3L, h3R,
    { name: 'h4', x: MW - 357, y: 4, w: 353, h: 44, spec: h4 },
    h5L, h5R,
  ];
}

export function headerLayout(MW: number, opts?: { sidebarOpen: boolean; scale: number }): {
  frame: StretchFrame; panels: PlacedPanel[]; keyRows: HdrKeyRow[]; decor: HdrDecor;
  traces: { name: string; d: string; pc: 'seam' | 'leak' }[];
  meter: { ix: number; iw: number; showClock: boolean };
  drawer: { x0: number; x1: number; rest: [number, number] };
} {
  MW = Math.max(MW, HDR_BASE_MW); // 縮小時は mwFor 済みの値を渡す約束。誤用しても 1189 未満では描かない
  const dx = MW - HDR_BASE_MW;
  // 右の半分と h4 は、全点が +dx の平行移動(歪まない)。左の半分は動かさない(frame は「伸ばし終わった」印)
  const frame: StretchFrame = { w0: MW, h0: HDR_H, sx: 9999, sy: 9999 };
  const placed = basePanels().map((p) => stretchPlaced(p, { ...HDR_FRAME, sx: /R$|^h4$/.test(p.name ?? '') ? p.x - 1 : 9999 }, MW, HDR_H));
  const by = (n: string): PlacedPanel => placed.find((p) => p.name === n)!;
  const p4p = by('h4'), p5Lp = by('h5L'), p5Rp = by('h5R');
  const p4 = p4p.spec as PanelSpec, p5L = p5Lp.spec as PanelSpec, p5R = p5Rp.spec as PanelSpec;
  const ix = 518, iw = MW - 879, showClock = iw >= 300, cx = MW - 357;

  // 列の位置が MW で動くものは、MW から直接置く(右の半分は平行移動なので、板内の座標は MW に依らず一定)
  p4.pockets = [pocket(tOut, cx + 14, 15, p4p), pocket(stadium(0, 0, 86, 28), cx + 254, 15, p4p, 1.6)];
  p5L.pockets = [
    ...(p5L.pockets ?? []),
    pocket(pOut, 21, 63, p5Lp),
    pocket(stadium(0, 0, 64, 32), 276, 63, p5Lp, 1.6),
  ];
  p5R.pockets = [
    ...(p5R.pockets ?? []),
    // 表示メンバー + 表の見た目(旧「みんなの軽減表」「歯車」の跡地)。x = 684〜、切れ目 683 の右・SORT 刻印の左
    pocket(chamRect(264, 35, 5, 5, 5, 5), MW - 505, 61.5, p5Rp),
    pocket(sOut, MW - 190, 63, p5Rp),
  ];

  // 左の板(滑る板)・基板の光は MW から直接置く。右に付く: x1 = dx + 714 + 60。休む 2 か所は {sidebarOpen, scale} から(省略時は切れ目の位置)
  const x0 = HDR_CUTS.h5 - DRAWER_OVER, x1 = dx + HDR_CUTS.h3 + DRAWER_OVER;
  const mwOpen = opts ? (opts.sidebarOpen ? MW : MW - SIDEBAR_SPAN / opts.scale) : HDR_BASE_MW;
  const r0 = HDR_CUTS.h5 + (mwOpen - HDR_BASE_MW);
  const rest: [number, number] = [r0, r0 + (opts ? SIDEBAR_SPAN / opts.scale : SIDEBAR_SPAN)];
  const glowSpec: GlowSpec = { kind: 'glow', x0, x1, windows: GLOW_WINDOWS, glow: D8.glow };
  const drawerSpec: DrawerSpec = { kind: 'drawer', x0, x1, rest, bands: HDR_BANDS, shadow: D8.shadow, dirt: D8.dirt, dark: D8.dark };
  const placedDrawer = (name: string, spec: DrawerSpec | GlowSpec): PlacedPanel => ({ name, x: x0, y: 0, w: x1 - x0, h: HDR_H, spec });
  const panels: PlacedPanel[] = [
    placedDrawer('glow', glowSpec), placedDrawer('drawer', drawerSpec),
    ...(['chsL', 'chsR', 'h1', 'h2', 'h3L', 'h3R', 'h4', 'h5L', 'h5R'].map(by)),
  ];

  const keyRows: HdrKeyRow[] = [
    { id: 'aux', x: cx + 14, y: 15, caps: bank(tOut, [1]).map((pts) => ({ pts })) },
    { id: 'com', x: cx + 254, y: 15, caps: [12, 32.7, 53.3, 74].map((x) => ({ pts: circ(x, 14, 9.6) })) },
    { id: 'party', x: 21, y: 63, caps: bank(pOut, [1, 1.12]).map((pts) => ({ pts })) },
    { id: 'io', x: 276, y: 63, caps: [circ(16, 16, 12.6), circ(48, 16, 12.6)].map((pts) => ({ pts })) },
    // ALL + 8 人(ALL のあとだけ 3 広い)。キーは 19×26、受け皿の中に収める
    { id: 'members', x: MW - 501, y: 66, caps: [0, 22, 43, 64, 85, 106, 127, 148, 169].map((dx) => ({ pts: shift(chamRect(19, 26, 3.2, 3.2, 3.2, 3.2), dx, 0), lip: true })) },
    { id: 'view', x: MW - 306, y: 66, caps: [0, 31].map((dx) => ({ pts: shift(chamRect(28, 26, 3.2, 3.2, 3.2, 3.2), dx, 0), lip: true })) },
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
    h5: { party: { x: 34, y: 57.2 }, crt: { x: 349, y: 59, w: 324, h: 34 }, sort: { x: MW - 222, y: 77 }, members: { x: MW - 501, y: 56 }, view: { x: MW - 306, y: 56 } },
  };

  // 光の経路(区画座標・絶対)
  const traces: { name: string; d: string; pc: 'seam' | 'leak' }[] = [
    { name: 'h3', d: 'M 630 43 H 706', pc: 'seam' }, // 左の板で終わる(切れ目 714 の手前)
    { name: 'h5a', d: 'M 96 57.6 H 336', pc: 'seam' },
  ];

  return { frame, panels, keyRows, decor, traces, meter: { ix, iw, showClock }, drawer: { x0, x1, rest } };
}

/** 通気口(js:930-940)。座標は通気口区画の左上基準 */
export function ventLayout(MW: number): {
  xb0: number; xb1: number; chanL: { x: number; w: number }; chanR: { x: number; w: number };
  pull: { x: number; w: 52 }; pullLabelX: number; hazR: number; pnX: number; leak: string;
} {
  const xb0 = Math.round(MW / 2 - 190), xb1 = xb0 + 11 * 12 - 4;
  return {
    xb0, xb1,
    chanL: { x: VENT_PLATE_X, w: xb0 - 8 - VENT_PLATE_X },
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
/** 通気口の左の板(ハザード・刻印)の右端 = 溝 chanL の左端(ventLayout の chanL.x)。開閉の継ぎ目もここ */
export const VENT_PLATE_X = 190;
/** レールの左端の下限: 左の板(継ぎ目 VENT_PLATE_X)より右。左の刻印 "HDR PNL 1A · DO NOT STEP" は x 70〜約 161(実測)で
 *  左の板に収まるので、継ぎ目より右なら刻印とも重ならない。レールが継ぎ目をまたぐと、開閉で板と一緒に一部が動いてしまう */
export const VENT_RAIL_MIN_X = VENT_PLATE_X + 4;
/** サイドバーを開いた状態の台車の左端(区画座標)= 格子 xb0 の 2px 手前。閉じた状態の MW を渡したときは開いた状態に直して求める */
const openCarriageX = (MW: number, sidebarOpen: boolean, scale: number): number =>
  (sidebarOpen ? MW : MW - SIDEBAR_SPAN / scale) / 2 - 192;
/** 台車の走行量(区画座標)。画面上はサイドバーぶんの半分(SIDEBAR_SPAN/2)で、区画内では ÷scale。
 *  狭い画面(縮小率が小さい)では、レールの左端が VENT_RAIL_MIN_X より左へ出ないよう縮める */
export function ventCarriageRun(MW: number, sidebarOpen: boolean, scale: number): number {
  return Math.max(0, Math.min(SIDEBAR_SPAN / 2 / scale, openCarriageX(MW, sidebarOpen, scale) - RAIL_MARGIN - VENT_RAIL_MIN_X));
}
/** 台車の左端(区画座標)。開いた状態は MW/2 - 192(格子 xb0 の 2px 手前)。閉じた状態は、開いた位置から走行量だけ左
 *  (区画の左端が SIDEBAR_SPAN 左へ動くので、区画座標では +SIDEBAR_SPAN/scale)。縮めないときは MW/2 - 192 と同じ */
export function ventCarriageX(MW: number, sidebarOpen = true, scale = 1): number {
  if (sidebarOpen) return MW / 2 - 192;
  return openCarriageX(MW, false, scale) - ventCarriageRun(MW, false, scale) + SIDEBAR_SPAN / scale;
}
/** レール(区画座標)。開いた状態では台車は右端・閉じた状態では左端にいて、画面上のレールは開閉で動かない */
export function ventRailRange(MW: number, sidebarOpen: boolean, scale: number): { x: number; w: number } {
  const run = ventCarriageRun(MW, sidebarOpen, scale);
  const cx = ventCarriageX(MW, sidebarOpen, scale);
  return { x: (sidebarOpen ? cx - run : cx) - RAIL_MARGIN, w: CARRIAGE_W + run + 2 * RAIL_MARGIN };
}
