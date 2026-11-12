// 色の絞り込みの判定(純関数)。applyFilters / 件数 / 注記が使う。
import { SWATCH_COUNT, swatchNameKey } from './housingColorSwatches.js';
import { NEAR_FAMILIES } from './housingColorNear.js';
import { PALETTE_RULE } from './housingExtractPalette.js';

export interface ListingColorFields {
    colorFamilies?: string[];
    colorRule?: number;
}

/** 丸の番号(0〜12)の配列 → 当たりにする系統名の配列(近い色も含む・重複なし・選んだ順)。範囲外は無視。 */
export function familiesOfSwatches(indexes: readonly number[]): string[] {
    const out: string[] = [];
    for (const i of indexes) {
        if (!Number.isInteger(i) || i < 0 || i >= SWATCH_COUNT) continue;
        for (const f of NEAR_FAMILIES[swatchNameKey(i)]) if (!out.includes(f)) out.push(f);
    }
    return out;
}

/** 色が今の決まりで計算済みか。欄が無い・古い決まりなら「未計算(確認中)」。 */
export function isColorComputed(listing: ListingColorFields): boolean {
    return Array.isArray(listing.colorFamilies) && listing.colorRule === PALETTE_RULE;
}

/** 選んだ系統のどれか(OR)が家の系統に含まれるか。未選択なら常に true。未計算・空配列は false。 */
export function matchesColors(listing: ListingColorFields, families: readonly string[]): boolean {
    if (families.length === 0) return true;
    if (!isColorComputed(listing)) return false;
    return families.some((f) => listing.colorFamilies!.includes(f));
}

/** 「色を確認中の家が N 件」の N。 */
export function countColorPending(listings: readonly ListingColorFields[]): number {
    return listings.filter((l) => !isColorComputed(l)).length;
}
