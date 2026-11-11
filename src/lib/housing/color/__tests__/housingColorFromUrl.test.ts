import { describe, it, expect } from 'vitest';
import { colorCandidateUrls, colorsFromPixels, representativeUrlForColors } from '../housingColorFromUrl';
import { PALETTE_RULE } from '../housingExtractPalette';

describe('colorCandidateUrls(縮小版を先に・だめなら元の URL)', () => {
    it('housing-media は 480 の縮小版 → 元の順', () => {
        const u = 'https://lopoly.app/housing-media/abc/def.webp';
        expect(colorCandidateUrls(u)).toEqual(['https://lopoly.app/housing-media/abc/def-480.webp', u]);
    });
    it('X の画像は name=small → 元の順', () => {
        const u = 'https://pbs.twimg.com/media/ABC.jpg';
        expect(colorCandidateUrls(u)).toEqual(['https://pbs.twimg.com/media/ABC.jpg?name=small', u]);
    });
    it('YouTube は元の URL から画質を落とす連鎖', () => {
        const list = colorCandidateUrls('https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg');
        expect(list[0]).toContain('maxresdefault');
        expect(list.length).toBeGreaterThan(1);
        expect(list[list.length - 1]).toContain('default.jpg');
    });
    it('縮小版が無い URL は元の1つだけ', () => {
        const u = 'https://example.com/a.jpg';
        expect(colorCandidateUrls(u)).toEqual([u]);
    });
});

describe('representativeUrlForColors', () => {
    it('thumbnail は thumbnailPath、sns は ogImageUrl、画像なしは null', () => {
        expect(representativeUrlForColors({ imageMode: 'thumbnail', thumbnailPath: 'https://x/a.webp' })).toBe('https://x/a.webp');
        expect(representativeUrlForColors({ imageMode: 'sns', ogImageUrl: 'https://x/b.jpg' })).toBe('https://x/b.jpg');
        expect(representativeUrlForColors({ imageMode: 'none' })).toBeNull();
    });
});

describe('colorsFromPixels', () => {
    it('画素から色と決まりの番号を作る', () => {
        const px = new Uint8ClampedArray(256 * 4);
        for (let i = 0; i < 256; i++) px.set([0x1c, 0x7e, 0xd6, 255], i * 4);
        expect(colorsFromPixels(px)).toEqual({ colorFamilies: ['blue'], colorRule: PALETTE_RULE });
    });
    it('全部透明なら空配列(計算済み・どの色でもない)', () => {
        expect(colorsFromPixels(new Uint8ClampedArray(256 * 4))).toEqual({ colorFamilies: [], colorRule: PALETTE_RULE });
    });
});
