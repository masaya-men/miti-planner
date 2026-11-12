// 1 つの色 → 系統(red, brown, white …)。OKLCH の明るさ・鮮やかさ・色相で振り分ける。
// 決まりは 11-12 に公開中の家 354 軒の写真で masaya が試し台で決めた物(白 = 明るさ 0.70 以上の無彩色)。
// 線を動かしたら PALETTE_RULE を上げる(保存済みの色が取り直しの対象になる)。
import type { ColorFamily } from './housingColorSwatches.js';
import { toOklch, type Oklch } from './housingOklch.js';

/** これより鮮やかさが低い色は無彩色(白・灰・黒)。 */
const NEUTRAL_CHROMA = 0.04;
/** 無彩色の明るさの区切り: 白 / 薄い灰 / 灰 / 黒。 */
const WHITE_L = 0.7;
const LIGHT_GRAY_L = 0.6;
const GRAY_L = 0.42;
/** 色があってもこれより暗いと黒。 */
const BLACK_L = 0.25;

/** OKLCH → 系統。 */
export function familyOfOklch({ l, c, h }: Oklch): ColorFamily {
    if (c < NEUTRAL_CHROMA || (l > 0.9 && c < 0.06)) {
        if (l >= WHITE_L) return 'white';
        if (l >= LIGHT_GRAY_L) return 'lightGray';
        return l >= GRAY_L ? 'gray' : 'black';
    }
    if (l < BLACK_L) return 'black';
    // 黄みの橙で鮮やかさが控えめ = 木・肌・パン → 茶 / 明るければベージュ
    if (h >= 40 && h < 95 && c < 0.13) return l >= 0.78 ? 'beige' : 'brown';
    if (h < 15 || h >= 350) return 'pink';
    if (h < 40) return 'red';
    if (h < 75) return 'orange';
    if (h < 115) return 'yellow';
    if (h < 175) return 'green';
    if (h < 225) return 'lightBlue';
    if (h < 280) return 'blue';
    if (h < 320) return 'purple';
    return 'pink';
}

/** '#rrggbb' → 系統。 */
export function colorFamilyOf(hex: string): ColorFamily {
    return familyOfOklch(toOklch(hex));
}
