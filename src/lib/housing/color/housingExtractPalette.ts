// 写真の 16×16 の画素 → その家の系統(多い順)。
// 11-12 masaya 決定: 影(暗い所)は数えず、明るく見えている所の中で
//   「いちばん多い系統」+「30% 以上の系統」を付ける。明るい所がほとんど無い写真は黒。
import { familyOfOklch } from './housingColorFamily.js';
import type { ColorFamily } from './housingColorSwatches.js';
import { toOklch } from './housingOklch.js';

const ALPHA_MIN = 128;
/** これより暗い画素は影として数えない。 */
export const SHADOW_L = 0.3;
/** 明るい画素がこの割合未満なら、写真全体を黒とする。 */
const MIN_LIT_SHARE = 0.25;
/** いちばん多い系統の他に付けるのは、明るい所のこの割合以上を占める系統だけ。 */
export const MIN_SHARE = 0.3;
/** 決まりを変えたら上げる。古い決まりで保存した色は「未計算」扱いになり、取り直しの対象になる。 */
export const PALETTE_RULE = 4;

const toHex = (r: number, g: number, b: number): string =>
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

export function extractPalette(rgba: Uint8ClampedArray): ColorFamily[] {
    const counts = new Map<ColorFamily, number>();
    let opaque = 0;
    let lit = 0;
    for (let i = 0; i + 3 < rgba.length; i += 4) {
        if (rgba[i + 3] < ALPHA_MIN) continue;
        opaque++;
        const oklch = toOklch(toHex(rgba[i], rgba[i + 1], rgba[i + 2]));
        if (oklch.l < SHADOW_L) continue;
        lit++;
        const family = familyOfOklch(oklch);
        counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    if (opaque === 0) return [];
    if (lit < opaque * MIN_LIT_SHARE) return ['black'];
    return [...counts.entries()]
        .sort((x, y) => y[1] - x[1])
        .filter(([, count], rank) => rank === 0 || count >= lit * MIN_SHARE)
        .map(([family]) => family);
}
