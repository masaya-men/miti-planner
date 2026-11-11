import { describe, it, expect } from 'vitest';
import { extractPalette, PALETTE_RULE, MIN_SHARE } from '../housingExtractPalette';
import { colorFamilyOf } from '../housingColorFamily';
import { SEARCH_SWATCHES, swatchNameKey } from '../housingColorSwatches';
import { toOklch } from '../housingOklch';

function fill(n: number, pixel: (i: number) => [number, number, number, number]): Uint8ClampedArray {
    const a = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) a.set(pixel(i), i * 4);
    return a;
}

describe('housingExtractPalette (AllMarks と同じ結果になること)', () => {
    it('決まりの番号と下限が AllMarks と同じ', () => {
        expect(PALETTE_RULE).toBe(3);
        expect(MIN_SHARE).toBe(0.2);
    });
    it('2色の絵は両方の系統を返す', () => {
        const px = fill(256, (i) => (i < 128 ? [0x1c, 0x7e, 0xd6, 255] : [0xfa, 0xb0, 0x05, 255]));
        expect(extractPalette(px).sort()).toEqual(['blue', 'yellow']);
    });
    it('完全に透明なら []', () => {
        expect(extractPalette(fill(256, () => [10, 20, 30, 0]))).toEqual([]);
    });
    it('ノイズのある単色は1系統', () => {
        const px = fill(256, (i) => [0x1c + (i % 7), 0x7e + (i % 5), 0xd6 - (i % 6), 255]);
        expect(extractPalette(px)).toEqual(['blue']);
    });
    it('20% 未満は含めない・20% は含める', () => {
        const accent = fill(100, (i) => (i < 90 ? [0xff, 0xff, 0xff, 255] : [0xe0, 0x31, 0x31, 255]));
        expect(extractPalette(accent)).toEqual(['white']);
        const fifth = fill(100, (i) => (i < 80 ? [0xff, 0xff, 0xff, 255] : [0xe0, 0x31, 0x31, 255]));
        expect(extractPalette(fifth)).toEqual(['white', 'red']);
    });
    it('肌・木・パンは赤にならない', () => {
        for (const rgb of [[0xe0, 0xac, 0x8c], [0x8b, 0x5a, 0x2b], [0xc6, 0x86, 0x42]] as const) {
            expect(extractPalette(fill(100, () => [...rgb, 255]))).not.toContain('red');
        }
    });
    it('多い順に並ぶ', () => {
        const px = fill(100, (i) => (i < 70 ? [0xe0, 0x31, 0x31, 255] : [0x1c, 0x7e, 0xd6, 255]));
        expect(extractPalette(px)).toEqual(['red', 'blue']);
    });
    it('最大3件', () => {
        const colors: [number, number, number, number][] = [[0xe0, 0x31, 0x31, 255], [0x1c, 0x7e, 0xd6, 255], [0x2f, 0x9e, 0x44, 255], [0xfa, 0xb0, 0x05, 255]];
        const px = fill(100, (i) => colors[Math.floor(i / 25)]);
        expect(extractPalette(px)).toHaveLength(3);
    });
});

describe('housingColorFamily', () => {
    it('50見本はそれぞれ自分の系統になる', () => {
        expect(SEARCH_SWATCHES).toHaveLength(50);
        SEARCH_SWATCHES.forEach((hex, i) => expect(colorFamilyOf(hex)).toBe(swatchNameKey(i)));
    });
    it('任意の色は一番近い系統', () => {
        expect(colorFamilyOf('#ff0000')).toBe('red');
        expect(colorFamilyOf('#0000ff')).toBe('blue');
        expect(colorFamilyOf('#2050e0')).toBe('blue');
        expect(colorFamilyOf('#00c800')).toBe('green');
        expect(colorFamilyOf('#fefefe')).toBe('white');
    });
});

describe('housingOklch', () => {
    it('白は明るさ約1・彩度ほぼ0、黒は明るさ0', () => {
        expect(toOklch('#ffffff').l).toBeCloseTo(1, 2);
        expect(toOklch('#ffffff').c).toBeLessThan(0.01);
        expect(toOklch('#000000').l).toBeCloseTo(0, 3);
    });
    it('赤の色相は約29度', () => {
        expect(toOklch('#ff0000').h).toBeGreaterThan(25);
        expect(toOklch('#ff0000').h).toBeLessThan(35);
    });
});
