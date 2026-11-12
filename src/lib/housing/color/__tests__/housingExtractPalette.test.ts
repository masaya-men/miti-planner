import { describe, it, expect } from 'vitest';
import { extractPalette, PALETTE_RULE, MIN_SHARE, SHADOW_L } from '../housingExtractPalette';
import { colorFamilyOf } from '../housingColorFamily';
import { SEARCH_SWATCHES, swatchNameKey } from '../housingColorSwatches';
import { toOklch } from '../housingOklch';

function fill(n: number, pixel: (i: number) => [number, number, number, number]): Uint8ClampedArray {
    const a = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) a.set(pixel(i), i * 4);
    return a;
}

describe('housingExtractPalette(11-12 masaya が試し台で決めた決まり)', () => {
    it('決まりの番号と下限', () => {
        expect(PALETTE_RULE).toBe(4);
        expect(MIN_SHARE).toBe(0.3);
        expect(SHADOW_L).toBe(0.3);
    });
    it('完全に透明なら []', () => {
        expect(extractPalette(fill(256, () => [10, 20, 30, 0]))).toEqual([]);
    });
    it('ノイズのある単色は1系統', () => {
        const px = fill(256, (i) => [0x1c + (i % 7), 0x7e + (i % 5), 0xd6 - (i % 6), 255]);
        expect(extractPalette(px)).toEqual(['blue']);
    });
    it('影(暗い所)は数えない: 7割が影でも、明るい所の色が付く', () => {
        const px = fill(100, (i) => (i < 70 ? [0x10, 0x10, 0x14, 255] : [0xe0, 0x31, 0x31, 255]));
        expect(extractPalette(px)).toEqual(['red']);
    });
    it('明るい所が25%未満の写真は黒', () => {
        const px = fill(100, (i) => (i < 80 ? [0x10, 0x10, 0x14, 255] : [0xe0, 0x31, 0x31, 255]));
        expect(extractPalette(px)).toEqual(['black']);
    });
    it('いちばん多い色は必ず付き、他は30%以上だけ', () => {
        const px = fill(100, (i) => (i < 75 ? [0x1c, 0x7e, 0xd6, 255] : [0xe0, 0x31, 0x31, 255]));
        expect(extractPalette(px)).toEqual(['blue']);
        const px2 = fill(100, (i) => (i < 65 ? [0x1c, 0x7e, 0xd6, 255] : [0xe0, 0x31, 0x31, 255]));
        expect(extractPalette(px2)).toEqual(['blue', 'red']);
    });
    it('どの色も30%未満でも、いちばん多い色は付く', () => {
        const colors: [number, number, number, number][] = [[0xe0, 0x31, 0x31, 255], [0x1c, 0x7e, 0xd6, 255], [0x2f, 0x9e, 0x44, 255], [0xfa, 0xb0, 0x05, 255]];
        const px = fill(100, (i) => colors[i < 28 ? 0 : i < 52 ? 1 : i < 76 ? 2 : 3]);
        expect(extractPalette(px)).toEqual(['red']);
    });
    it('最大3件', () => {
        const colors: [number, number, number, number][] = [[0xe0, 0x31, 0x31, 255], [0x1c, 0x7e, 0xd6, 255], [0x2f, 0x9e, 0x44, 255]];
        const px = fill(99, (i) => colors[Math.floor(i / 33)]);
        expect(extractPalette(px)).toHaveLength(3);
    });
    it('肌・木・パンは赤にならない', () => {
        for (const rgb of [[0xe0, 0xac, 0x8c], [0x8b, 0x5a, 0x2b], [0xc6, 0x86, 0x42]] as const) {
            expect(extractPalette(fill(100, () => [...rgb, 255]))).not.toContain('red');
        }
    });
});

describe('housingColorFamily', () => {
    it('丸の見本はそれぞれ自分の系統になる', () => {
        expect(SEARCH_SWATCHES).toHaveLength(13);
        SEARCH_SWATCHES.forEach((hex, i) => expect(colorFamilyOf(hex)).toBe(swatchNameKey(i)));
    });
    it('任意の色は一番近い系統', () => {
        expect(colorFamilyOf('#ff0000')).toBe('red');
        expect(colorFamilyOf('#0000ff')).toBe('blue');
        expect(colorFamilyOf('#2050e0')).toBe('blue');
        expect(colorFamilyOf('#00c800')).toBe('green');
    });
    it('少し灰色がかった白も白(明るさ0.70以上の無彩色)', () => {
        for (const hex of ['#ffffff', '#f5f5f5', '#e0e0e0', '#c8c8c8', '#bfc4cc']) expect(colorFamilyOf(hex)).toBe('white');
        expect(colorFamilyOf('#909090')).toBe('lightGray');
        expect(colorFamilyOf('#707070')).toBe('gray');
        expect(colorFamilyOf('#303030')).toBe('black');
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
