// 家の色の欄(colorFamilies / colorRule)の検証。サーバー(api)とクライアントの両方が使う純関数。
import { COLOR_FAMILY_NAMES } from './housingColorSwatches.js';
import { PALETTE_RULE } from './housingExtractPalette.js';

export { COLOR_FAMILY_NAMES };
export const MAX_COLOR_FAMILIES = 3;

export type ValidatedColors =
    | { ok: true; colorFamilies: string[]; colorRule: number }
    | { ok: false };

/** 許可リスト・最大 3 件・重複なし・colorRule が現行値、のすべてを満たす時だけ ok。 */
export function validateListingColors(input: unknown): ValidatedColors {
    if (typeof input !== 'object' || input === null) return { ok: false };
    const { colorFamilies, colorRule } = input as { colorFamilies?: unknown; colorRule?: unknown };
    if (colorRule !== PALETTE_RULE) return { ok: false };
    if (!Array.isArray(colorFamilies) || colorFamilies.length > MAX_COLOR_FAMILIES) return { ok: false };
    const seen = new Set<string>();
    for (const f of colorFamilies) {
        if (typeof f !== 'string' || !(COLOR_FAMILY_NAMES as readonly string[]).includes(f) || seen.has(f)) return { ok: false };
        seen.add(f);
    }
    return { ok: true, colorFamilies: [...colorFamilies] as string[], colorRule: PALETTE_RULE };
}
