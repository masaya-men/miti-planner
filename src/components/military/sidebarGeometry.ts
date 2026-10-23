/**
 * サイドバーの座標表(見本 milspec-v11.js js:798-857 の手打ち座標を純データにしたもの)。
 * 装甲パネル・キーの受け皿・キー列・飾り・光の経路。座標はすべて区画(ゾーン)座標。
 * パスは M/L/H/V の絶対座標のみ(stretchPath の制約)。
 */
import type { CapSpec, PanelSpec, PlacedPanel, Pt, StretchFrame } from './armor/types';
import { bank, chamRect, shift } from './armor/geom';

/** 区画の基準 274x679。y が 300 より下のものは高さの増減ぶんだけ動く */
export const SB_FRAME: StretchFrame = { w0: 274, h0: 679, sx: 274, sy: 300 };

/** 区画の高さ h のときの y(伸縮境界より下は増減分だけ動く) */
export function sbY(y: number, h: number): number {
  return y > SB_FRAME.sy ? y + (h - SB_FRAME.h0) : y;
}

/** M/L/H/V 絶対座標の path の y を sbY で変換する(光の経路用)。H の数値は x なので触らない */
export function sbPath(d: string, h: number): string {
  const tok = d.trim().split(/\s+/);
  const out: string[] = [];
  let cmd = '';
  let idx = 0; // 命令内の数値の通し番号(M/L は偶数=x・奇数=y)
  for (const t of tok) {
    if (/^[MLHV]$/.test(t)) { cmd = t; idx = 0; out.push(t); continue; }
    const v = parseFloat(t);
    const isY = cmd === 'V' || ((cmd === 'M' || cmd === 'L') && idx % 2 === 1);
    out.push(String(isY ? sbY(v, h) : v));
    idx++;
  }
  return out.join(' ');
}

// 見本の cluster(): host パネルの pockets に shift(outline, 列x-パネルx, 列y-パネルy) を足す
const pocket = (outline: Pt[], colX: number, colY: number, panel: PlacedPanel, b = 1.8) =>
  ({ b, pts: shift(outline, colX - panel.x, colY - panel.y) });

// キー列の輪郭(js:804, 809, 846, 855)
const cOut: Pt[] = [[8, 0], [231, 0], [250, 19], [250, 26], [242, 34], [0, 34], [0, 8]];
const aOut: Pt[] = [[0, 0], [240, 0], [250, 10], [250, 34], [10, 34], [0, 24]];
const uOut: Pt[] = [[0, 0], [124, 0], [130, 6], [130, 22], [6, 22], [0, 16]];
const bOut: Pt[] = [[8, 0], [250, 0], [250, 24], [0, 24], [0, 8]];

const S1: PlacedPanel = {
  x: 0, y: 0, w: 274, h: 122,
  spec: {
    tone: 'pri', b: 4,
    pts: [[16, 0], [232, 0], [274, 42], [274, 104], [268, 110], [206, 110], [198, 118], [150, 118], [142, 110], [6, 110], [0, 104], [0, 16]],
    scribes: ['M 142 105 H 206'],
    seams: ['M 10 60 H 116 L 120 56 H 228 L 232 60 H 236'],
    wx: { chips: 1.1, wear: [[130, 58, 118, 7]] },
  },
};
const S2: PlacedPanel = {
  x: 0, y: 114, w: 274, h: 492,
  spec: {
    tone: 'sec', b: 4,
    pts: [[0, 0], [134, 0], [144, 10], [212, 10], [222, 0], [274, 0], [274, 452], [234, 492], [12, 492], [0, 480]],
    pockets: [{ b: 2.4, fill: 'var(--ma-pcb)', pts: [[10, 22], [264, 22], [264, 444], [230, 478], [10, 478]] }],
    scribes: ['M 264 460 L 244 480', 'M 5.5 34 V 466', 'M 12 16 H 124 L 128 20', 'M 232 20 L 236 16 H 268'],
    wx: { chips: 0.9 },
  },
};
// 後付けの補修板
const PATCH: PlacedPanel = {
  x: 22, y: 594.4, w: 38, h: 7.6,
  spec: { tone: 'pri', b: 1.1, shadow: 0.8, pts: chamRect(38, 7.6, 1.6, 1.6, 1.6, 1.6), wx: { chips: 0.8, grime: 0 } },
};
const S3: PlacedPanel = {
  x: 0, y: 612, w: 274, h: 67,
  spec: {
    tone: 'pri', b: 4,
    pts: [[14, 0], [226, 0], [236, 10], [274, 10], [274, 67], [0, 67], [0, 14]],
    seams: ['M 8 31.2 H 146 L 149 28.2 H 264'],
    wx: { chips: 1.2, wear: [[120, 36, 110, 5]] },
  },
};

// 受け皿(キー列が乗るパネルに入れる)
(S1.spec as PanelSpec).pockets = [pocket(cOut, 12, 17, S1), pocket(aOut, 12, 66, S1)];
(S3.spec as PanelSpec).pockets = [pocket(uOut, 12, 619, S3), pocket(bOut, 12, 646, S3)];

export const SB_PANELS: PlacedPanel[] = [S1, S2, PATCH, S3];

export interface SbKeyRow { id: 'content' | 'actions' | 'service' | 'dock'; x: number; y: number; caps: CapSpec[] }

export const SB_KEY_ROWS: SbKeyRow[] = [
  { id: 'content', x: 12, y: 17, caps: bank(cOut, [1.0, 0.7, 1.0, 1.36]).map((pts) => ({ pts, lip: true })) },
  { id: 'actions', x: 12, y: 66, caps: bank(aOut, [1.15, 1.3, 1.12]).map((pts) => ({ pts })) },
  { id: 'service', x: 12, y: 619, caps: bank(uOut, [1]).map((pts) => ({ pts })) },
  { id: 'dock', x: 12, y: 646, caps: bank(bOut, [1, 0.82]).map((pts) => ({ pts })) },
];

/** プランツリーの枠(h0 は基準の高さ。実際は区画の伸びに追従) */
export const SB_TREE_BOX = { x: 12, y: 138, w: 250, h0: 452 };

/** 飾りの座標(見本の at(el(...), x, y) の x,y) */
export const SB_DECOR = {
  engraves: [
    { text: 'CONTENT SELECT', x: 20, y: 7 },
    { text: 'SERVICE', x: 150, y: 620.5 },
    { text: 'IDX-2 · PLAN INDEX', x: 14, y: 123 },
  ],
  ids: [
    { text: 'S1', x: 247, y: 56 },
    { text: 'S2', x: 240, y: 121 },
    { text: 'S3', x: 246, y: 627.4 },
  ],
  screws: [{ x: 159, y: 107, rot: '45deg' }, { x: 183, y: 107, rot: '45deg' }],
  rivets: [{ x: 24.2, y: 596.4 }, { x: 55.2, y: 596.4 }],
  plate: { x: 150, y: 628.2 },
  barcode: { x: 212, y: 628.8 },
};

/** 光の経路(区画座標・絶対座標)。seam=継ぎ目沿い / leak=パネルの隙間から漏れる光 */
export const SB_TRACES: { name: string; d: string; pc: 'seam' | 'leak' }[] = [
  { name: 's1', d: 'M 10 60 H 116 L 120 56 H 228 L 232 60 H 236', pc: 'seam' },
  { name: 's3', d: 'M 8 643.2 H 146 L 149 640.2 H 264', pc: 'seam' },
  { name: 'lk:s1s2', d: 'M 4 112 H 137 L 146.5 121 H 203.5 L 213 112 H 270', pc: 'leak' },
  { name: 'lk:s2s3', d: 'M 8 609 H 230 L 237 616 H 272', pc: 'leak' },
  { name: 'lk:s2rail', d: 'M 275 118 V 604', pc: 'leak' },
];

/**
 * 運営通知のマーク(MilspecNotifBeacon)の置き場。
 * ツリー箱(下端 SB_TREE_BOX.y + h0 = 590)の右下の斜め切り欠き(S2 外形 (274,566)-(234,606) = x+y=840 の線)と、
 * S3 パネルの右上(上端 y=612、x>=236 では 622)の間の暗い隙間。座標は基準高さ(679)の区画座標で、
 * y が伸縮境界より下なので sbY で区画の実高に追従する。左上は斜め線に沿って切る(線から約 3px 離す)。
 */
export const SB_NOTIF = {
  x: 238,
  y: 591,
  w: 34,
  h: 26,
  /** 板の輪郭(板の左上原点)。左上の斜辺は x+y=846(S2 の斜め線 840 から約 4px 離れる) */
  pts: [[0, 17], [17, 0], [31, 0], [34, 3], [34, 23], [31, 26], [3, 26], [0, 23]] as Pt[],
};
