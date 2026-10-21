/** 装甲・キー描画エンジンの型(見本 milspec-v11.js の使われ方から起こしたもの) */
export type Pt = [number, number];
export type Rgb = [number, number, number];
export type Tone = 'pri' | 'sec' | 'chs' | 'key';

/** 汚し(使い込み)の指定 */
export interface WeatherSpec {
  seed?: number;
  /** 下側の汚れの濃さ(0 で無し) */
  grime?: number;
  /** 熱の焼け [cx, cy, r] */
  heat?: [number, number, number][];
  /** 汚れ筋 [x, y, 長さ] */
  streaks?: [number, number, number][];
  /** 縁の剥げの量 */
  chips?: number;
  /** 擦り傷の範囲 [cx, cy, r, 本数] */
  wear?: [number, number, number, number][];
}

export interface PocketSpec {
  b?: number;
  pts: Pt[];
  fill?: string;
}

export interface PanelSpec {
  pts: Pt[];
  tone?: Tone;
  b?: number;
  shadow?: number;
  /** SVG path 文字列(彫り線) */
  scribes?: string[];
  /** SVG path 文字列(継ぎ目) */
  seams?: string[];
  pockets?: PocketSpec[];
  /** ボルト [cx, cy, r] */
  circles?: [number, number, number][];
  wx?: WeatherSpec;
  /** 傷模様の乱数の種。未指定なら形(pts)から決める。伸縮しても傷模様が変わらないよう stretchSpec が固定する */
  seed?: number;
}

export interface PlacedPanel { x: number; y: number; w: number; h: number; spec: PanelSpec }
export interface CapSpec { pts: Pt[]; b?: number; lip?: boolean }
/**
 * 伸縮の基準。座標系は使う関数による:
 * stretchSpec ではパネル内座標、stretchPlaced では区画(ゾーン)座標
 * (w0,h0 = 元の大きさ、sx,sy = これより大きい座標を動かす境界)。
 */
export interface StretchFrame { w0: number; h0: number; sx: number; sy: number }

export interface ToneColors { top: Rgb; bot: Rgb; hi: Rgb; lo: Rgb; face: Rgb }

export interface ArmorPalette {
  pri: ToneColors; sec: ToneColors; chs: ToneColors; key: ToneColors;
  edge: Rgb; keyEdge: Rgb; pkTop: Rgb; pkBot: Rgb;
  scribe: string; scribeHi: string; seam: string; seamCore: string;
  dish: number; keySh: number; grain: number; spec: number;
}
