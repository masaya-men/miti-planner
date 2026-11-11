// 写真の 16×16 の画素 → 主な系統(20% 以上・最大 3 つ・多い順)。AllMarks の extract-palette.ts の移植。
import { colorFamilyOf } from './housingColorFamily.js';

const MAX_COLORS = 3;
const ALPHA_MIN = 128;
const SHIFT = 4; // 1 色あたり 16 段階の箱
/** 系統として数えるのは、絵の中でこの割合以上を占める時だけ(赤で探して肌・木・パンが出ないように)。 */
export const MIN_SHARE = 0.2;
/** 決まりを変えたら上げる。古い決まりで保存した色は「未計算」扱いになり、取り直しの対象になる。 */
export const PALETTE_RULE = 3;

type Bucket = { count: number; r: number; g: number; b: number };

const toHex = (r: number, g: number, b: number): string =>
    '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export function extractPalette(rgba: Uint8ClampedArray): string[] {
    const buckets = new Map<number, Bucket>();
    let total = 0;
    for (let i = 0; i + 3 < rgba.length; i += 4) {
        if (rgba[i + 3] < ALPHA_MIN) continue;
        const r = rgba[i];
        const g = rgba[i + 1];
        const b = rgba[i + 2];
        total++;
        const key = ((r >> SHIFT) << 8) | ((g >> SHIFT) << 4) | (b >> SHIFT);
        const bk = buckets.get(key);
        if (bk) {
            bk.count++;
            bk.r += r;
            bk.g += g;
            bk.b += b;
        } else {
            buckets.set(key, { count: 1, r, g, b });
        }
    }
    const shares = new Map<string, number>();
    for (const bk of buckets.values()) {
        const family = colorFamilyOf(toHex(bk.r / bk.count, bk.g / bk.count, bk.b / bk.count));
        shares.set(family, (shares.get(family) ?? 0) + bk.count);
    }
    return [...shares.entries()]
        .filter(([, count]) => count >= total * MIN_SHARE)
        .sort((x, y) => y[1] - x[1])
        .slice(0, MAX_COLORS)
        .map(([family]) => family);
}
