import { bank, circ, shift, stadium } from '../armor/geom';
import type { CapSpec, PlacedPanel, PocketSpec, Pt, StretchFrame } from '../armor/types';

// 表の操作列の形(見本 v11 js:942-962)。座標は見本の区画座標(操作列の装甲の左上が原点)。

/** 見本の JX: 副装甲(ジョブの基板)の左端 */
export const DECK_JX = 574;
/** 操作列の装甲の幅(JX - 4) */
export const DECK_W = DECK_JX - 4;
export const DECK_H = 40;
/** 副装甲の基準幅(見本の区画 MW=1189 のとき MW - JX)。実幅は MilspecArmor が親の実寸へ伸ばす */
export const BOARD_W0 = 1189 - DECK_JX;

/** キー列(.kc)の原点。キーは各 cap の bbox の位置に置く */
export const DECK_COLS = { aa: { x: 342, y: 12 }, ur: { x: 418, y: 12 }, tr: { x: 478, y: 12 } } as const;
/** 赤い差し色(見本 js:958 の .acc.dng) */
export const DECK_ACC = { x: 529.5, y: 15, w: 1.6, h: 7 } as const;

const aaOut: Pt[] = [[0, 0], [64, 0], [70, 6], [70, 24], [6, 24], [0, 18]];
const trOut: Pt[] = [[0, 0], [42, 0], [48, 6], [48, 24], [0, 24]];
const urOut: Pt[] = stadium(0, 0, 54, 24);

const toCaps = (pts: Pt[][]): CapSpec[] => pts.map((p) => ({ pts: p }));
export const aaCaps: CapSpec[] = toCaps(bank(aaOut, [1]));
export const trCaps: CapSpec[] = toCaps(bank(trOut, [1]));
/** 元に戻す・やり直す(stadium の中に丸キー 2 つ) */
export const urCaps: CapSpec[] = [{ pts: circ(12, 12, 9.6) }, { pts: circ(42, 12, 9.6) }];

const pocket = (outline: Pt[], col: { x: number; y: number }, b = 1.8): PocketSpec => ({ b, pts: shift(outline, col.x, col.y) });

/** 操作列の装甲(見本 js:945: 輪郭・scribe・汚し・3 つの凹み) */
export function deckPanel(): PlacedPanel {
  return {
    x: 0, y: 0, w: DECK_W, h: DECK_H,
    spec: {
      tone: 'pri', b: 3,
      pts: [[0, 0], [DECK_JX - 16, 0], [DECK_JX - 4, 12], [DECK_JX - 4, DECK_H], [10, DECK_H], [0, 30]],
      scribes: ['M 330 7 V 34'],
      wx: { chips: 1.1, wear: [[200, 26, 130, 6], [450, 24, 70, 3]] },
      pockets: [pocket(aaOut, DECK_COLS.aa), pocket(urOut, DECK_COLS.ur, 1.6), pocket(trOut, DECK_COLS.tr)],
    },
  };
}

/** 副装甲(見本 js:959-961: ジョブの基板の床の窪み)。bw = 基準幅 */
export function boardPanel(bw: number = BOARD_W0): PlacedPanel {
  const pocketPts: Pt[] = [[14, 4], [bw - 5, 4], [bw - 5, 36], [4, 36], [4, 14]];
  return {
    x: 0, y: 0, w: bw, h: DECK_H,
    spec: {
      tone: 'sec', b: 3,
      pts: [[0, 12], [12, 0], [bw, 0], [bw, DECK_H], [0, DECK_H]],
      pockets: [{ b: 1.8, pts: pocketPts, fill: 'var(--ma-pcb)' }],
      wx: { chips: 0.8 },
    },
  };
}

/** 装甲は固定の幅(伸ばさない) */
export const DECK_FRAME: StretchFrame = { w0: DECK_W, h0: DECK_H, sx: 100000, sy: 100000 };
/** 副装甲は左の斜めの角(x<=14)だけ固定し、残りは親の実幅へ伸ばす */
export const BOARD_FRAME: StretchFrame = { w0: BOARD_W0, h0: DECK_H, sx: 14.5, sy: 100000 };
