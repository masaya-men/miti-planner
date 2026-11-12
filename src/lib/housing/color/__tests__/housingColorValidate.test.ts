import { describe, it, expect } from 'vitest';
import { validateListingColors, COLOR_FAMILY_NAMES } from '../housingColorValidate';
import { PALETTE_RULE } from '../housingExtractPalette';

describe('validateListingColors', () => {
    it('正しい値は通る(正規化して返す)', () => {
        expect(validateListingColors({ colorFamilies: ['red', 'blue'], colorRule: PALETTE_RULE }))
            .toEqual({ ok: true, colorFamilies: ['red', 'blue'], colorRule: PALETTE_RULE });
    });
    it('空配列(どの色にも当てはまらない)も通る', () => {
        expect(validateListingColors({ colorFamilies: [], colorRule: PALETTE_RULE }).ok).toBe(true);
    });
    it('許可外の名前を弾く', () => {
        expect(validateListingColors({ colorFamilies: ['magenta'], colorRule: PALETTE_RULE }).ok).toBe(false);
    });
    it('4件以上を弾く', () => {
        expect(validateListingColors({ colorFamilies: ['red', 'blue', 'green', 'pink'], colorRule: PALETTE_RULE }).ok).toBe(false);
    });
    it('重複を弾く', () => {
        expect(validateListingColors({ colorFamilies: ['red', 'red'], colorRule: PALETTE_RULE }).ok).toBe(false);
    });
    it('colorRule が現行と違えば弾く', () => {
        expect(validateListingColors({ colorFamilies: ['red'], colorRule: PALETTE_RULE - 1 }).ok).toBe(false);
        expect(validateListingColors({ colorFamilies: ['red'] }).ok).toBe(false);
    });
    it('型違いを弾く', () => {
        expect(validateListingColors({ colorFamilies: 'red', colorRule: PALETTE_RULE }).ok).toBe(false);
        expect(validateListingColors({ colorFamilies: [1], colorRule: PALETTE_RULE }).ok).toBe(false);
        expect(validateListingColors(null).ok).toBe(false);
        expect(validateListingColors('x').ok).toBe(false);
    });
    it('許可リストは14系統(丸の13 + 薄い灰)', () => {
        expect(COLOR_FAMILY_NAMES).toHaveLength(14);
        expect(validateListingColors({ colorFamilies: ['lightGray'], colorRule: PALETTE_RULE }).ok).toBe(true);
    });
});
