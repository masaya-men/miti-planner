// 「色で探す」の 50 見本(10 色相 × 4 段の明るさ + 無彩色 10)と、13 個の系統名。
// AllMarks の lib/color/swatches.ts の移植。見本の hex は「テーマで変わらない見本の色」なのでコード定数。
export const SWATCH_HUE_NAMES = [
    'red', 'orange', 'yellow', 'green', 'lightBlue', 'blue', 'purple', 'pink', 'brown', 'beige',
] as const;

export type SwatchHueName = (typeof SWATCH_HUE_NAMES)[number];
export type SwatchNameKey = SwatchHueName | 'white' | 'gray' | 'black';

// 10 色相 × 4 段(明るい → 暗い)。うす茶・ベージュは無彩色のしきい値(OKLCH 0.03)のすぐ上に置く。
const HUES: readonly (readonly string[])[] = [
    ['#ffc9c9', '#ff8787', '#e03131', '#9b1c1c'], ['#ffd8a8', '#ffa94d', '#f76707', '#a8410a'],
    ['#fff3bf', '#ffe066', '#fab005', '#b07d05'], ['#d3f9d8', '#8ce99a', '#2f9e44', '#1b5e2a'],
    ['#c5f6fa', '#66d9e8', '#1098ad', '#0b5c69'], ['#d0ebff', '#74c0fc', '#1c7ed6', '#123f80'],
    ['#e5dbff', '#b197fc', '#7048e8', '#3f2391'], ['#ffdeeb', '#faa2c1', '#d6336c', '#8a1c44'],
    ['#e8d6bf', '#c49a6c', '#8d5a2b', '#4e3018'], ['#f3e6cb', '#e2cfa3', '#bfa36a', '#7d6a42'],
];

const NEUTRAL: readonly string[] = [
    '#ffffff', '#e9ecef', '#ced4da', '#adb5bd', '#868e96',
    '#495057', '#343a40', '#212529', '#111111', '#000000',
];

export const SWATCH_TONES = 4;
export const SWATCH_HUE_COUNT = SWATCH_HUE_NAMES.length;
/** 色相の丸の数(40)。これ以降の番号が無彩色。 */
export const SWATCH_HUE_END = SWATCH_TONES * SWATCH_HUE_COUNT;
export const SWATCH_COUNT = SWATCH_HUE_END + NEUTRAL.length;

/** 段(明るさ)ごとに全色相 → 次の段 … の順で 40 個、続いて無彩色 10 個。 */
export const SEARCH_SWATCHES: readonly string[] = [
    ...Array.from({ length: SWATCH_HUE_END }, (_, i) => HUES[i % SWATCH_HUE_COUNT][Math.floor(i / SWATCH_HUE_COUNT)]),
    ...NEUTRAL,
];

/** 丸の系統名: 色相名、または white(無彩色の先頭)/ gray(次の 7)/ black(最後の 2)。 */
export function swatchNameKey(index: number): SwatchNameKey {
    if (index < SWATCH_HUE_END) return SWATCH_HUE_NAMES[index % SWATCH_HUE_COUNT];
    const n = index - SWATCH_HUE_END;
    if (n === 0) return 'white';
    return n >= NEUTRAL.length - 2 ? 'black' : 'gray';
}

/** 丸の明るさの段(0 = いちばん明るい … 3 = いちばん暗い)。無彩色は null。 */
export function swatchTone(index: number): number | null {
    return index < SWATCH_HUE_END ? Math.floor(index / SWATCH_HUE_COUNT) : null;
}
