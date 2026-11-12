import { describe, it, expect } from 'vitest';
import { familiesOfSwatches, matchesColors, countColorPending } from '../housingColorFilter';
import { PALETTE_RULE } from '../housingExtractPalette';

const L = (colorFamilies?: string[], colorRule: number | undefined = colorFamilies ? PALETTE_RULE : undefined) => ({ colorFamilies, colorRule });

describe('familiesOfSwatches', () => {
    it('丸の番号を、近い色も含めた系統名にする(重複は1つ)', () => {
        expect(familiesOfSwatches([0])).toEqual(['red', 'pink', 'orange']);
        expect(familiesOfSwatches([10])).toEqual(['white', 'lightGray']);
        expect(familiesOfSwatches([10, 11])).toEqual(['white', 'lightGray', 'gray']);
    });
    it('範囲外の番号は無視', () => {
        expect(familiesOfSwatches([-1, 13, 1.5])).toEqual([]);
    });
});

describe('matchesColors', () => {
    it('未選択なら全部通す(未計算も)', () => {
        expect(matchesColors(L(), [])).toBe(true);
    });
    it('どれか1つ一致すれば通す(OR)', () => {
        expect(matchesColors(L(['red', 'blue']), ['green', 'blue'])).toBe(true);
        expect(matchesColors(L(['red']), ['green', 'blue'])).toBe(false);
    });
    it('未計算は除外', () => {
        expect(matchesColors(L(), ['red'])).toBe(false);
    });
    it('古い決まりで計算した家は未計算扱い', () => {
        expect(matchesColors(L(['red'], PALETTE_RULE - 1), ['red'])).toBe(false);
    });
    it('空配列(計算済み・どの色でもない)は除外', () => {
        expect(matchesColors(L([]), ['red'])).toBe(false);
    });
});

describe('countColorPending', () => {
    it('未計算と古い決まりの数を数える', () => {
        expect(countColorPending([L(['red']), L(), L([]), L(['red'], 1)])).toBe(2);
    });
});
