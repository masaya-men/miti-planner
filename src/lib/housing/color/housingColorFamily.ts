// 色の系統(red, brown, white …)= 50 見本のうち OKLab で一番近い物の系統。
// AllMarks の lib/color/color-family.ts の移植。
import { SEARCH_SWATCHES, swatchNameKey, type SwatchNameKey } from './housingColorSwatches.js';
import { toOklch } from './housingOklch.js';

/** '#rrggbb' の OKLab 座標 [L, a, b]。 */
function toOklab(hex: string): readonly [number, number, number] {
    const { l, c, h } = toOklch(hex);
    const rad = (h * Math.PI) / 180;
    return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/** 見本が届かない画面上の鮮やかな原色の基準点(出さない)。純 #0000ff が青より紫の見本に近くなるのを防ぐ。 */
const VIVID: ReadonlyArray<readonly [string, SwatchNameKey]> = [
    ['#ff0000', 'red'], ['#ff8000', 'orange'], ['#ffff00', 'yellow'], ['#00ff00', 'green'],
    ['#00ffff', 'lightBlue'], ['#0000ff', 'blue'], ['#0040ff', 'blue'], ['#8000ff', 'purple'], ['#ff00ff', 'pink'],
];

const SWATCH_LABS = [
    ...SEARCH_SWATCHES.map((hex, i) => ({ family: swatchNameKey(i), lab: toOklab(hex) })),
    ...VIVID.map(([hex, family]) => ({ family, lab: toOklab(hex) })),
];

/** 色の系統。肌・木・パンは赤でなくベージュ・茶・橙に落ちる。 */
export function colorFamilyOf(hex: string): SwatchNameKey {
    const [L, A, B] = toOklab(hex);
    let best: SwatchNameKey = 'gray';
    let bestD = Infinity;
    for (const s of SWATCH_LABS) {
        const d = (L - s.lab[0]) ** 2 + (A - s.lab[1]) ** 2 + (B - s.lab[2]) ** 2;
        if (d < bestD) {
            bestD = d;
            best = s.family;
        }
    }
    return best;
}
