// 「色で探す」の 13 個の丸と、家に保存する 14 個の系統名(丸の 13 + 薄い灰)。
// 11-12 masaya 決定: 丸 1 個 = 系統 1 つ(同じ結果になる丸を並べない)。丸の hex は「テーマで変わらない見本の色」なのでコード定数。

/** 丸の並び順 = 系統名。7 列 × 2 行(上 = 赤〜紫、下 = ピンク・茶・ベージュ・白・灰・黒)。 */
export const SWATCH_NAMES = [
    'red', 'orange', 'yellow', 'green', 'lightBlue', 'blue', 'purple',
    'pink', 'brown', 'beige', 'white', 'gray', 'black',
] as const;

export type SwatchNameKey = (typeof SWATCH_NAMES)[number];
/** 家に保存する系統。薄い灰は丸には出さず、白と灰のどちらで探しても当たる。 */
export type ColorFamily = SwatchNameKey | 'lightGray';

export const COLOR_FAMILY_NAMES: readonly ColorFamily[] = [...SWATCH_NAMES, 'lightGray'];

/** 丸の見本の色(SWATCH_NAMES と同じ順)。 */
export const SEARCH_SWATCHES: readonly string[] = [
    '#e03131', '#f76707', '#fab005', '#2f9e44', '#1098ad', '#1c7ed6', '#7048e8',
    '#e64980', '#8d5a2b', '#e2cfa3', '#ffffff', '#6c727a', '#1a1a1a',
];

export const SWATCH_COUNT = SWATCH_NAMES.length;

/** 丸の番号 → 系統名。 */
export function swatchNameKey(index: number): SwatchNameKey {
    return SWATCH_NAMES[index];
}
