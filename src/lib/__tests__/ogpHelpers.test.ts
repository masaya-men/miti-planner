// src/lib/__tests__/ogpHelpers.test.ts
import { describe, it, expect } from 'vitest';
import {
    CONTENT_META,
    getContentName,
    getCategoryTag,
    parseTier,
    trySeriesSummary,
} from '../ogpHelpers';

// ========================================
// CONTENT_META の網羅性テスト
// ========================================
describe('CONTENT_META', () => {
    it('全エントリにja, category, levelが存在する', () => {
        for (const [id, meta] of Object.entries(CONTENT_META)) {
            expect(meta.ja, `${id}.ja が空`).toBeTruthy();
            expect(meta.category, `${id}.category が空`).toBeTruthy();
            expect(typeof meta.level, `${id}.level が数値でない`).toBe('number');
        }
    });

    it('主要なコンテンツIDが存在する', () => {
        const requiredIds = ['m9s', 'm12s_p1', 'fru', 'dsr', 'top', 'tea', 'ucob', 'uwu', 'p9s', 'e9s', 'o9s'];
        for (const id of requiredIds) {
            expect(CONTENT_META[id], `${id} が存在しない`).toBeDefined();
        }
    });
});

// ========================================
// getContentName
// ========================================
describe('getContentName', () => {
    it('存在するcontentIdで日本語名を返す', () => {
        expect(getContentName('m9s')).toBe('至天の座アルカディア零式：ヘビー級1');
    });

    it('nullで空文字を返す', () => {
        expect(getContentName(null)).toBe('');
    });

    it('存在しないIDで空文字を返す', () => {
        expect(getContentName('nonexistent')).toBe('');
    });

    it('絶コンテンツの名前を正しく返す', () => {
        expect(getContentName('fru')).toBe('絶もうひとつの未来');
        expect(getContentName('tea')).toBe('絶アレキサンダー討滅戦');
    });
});

// ========================================
// getCategoryTag
// ========================================
describe('getCategoryTag', () => {
    it('零式コンテンツでSavageタグを返す', () => {
        expect(getCategoryTag('m9s')).toBe('Savage — Lv.100');
    });

    it('絶コンテンツでUltimateタグを返す', () => {
        expect(getCategoryTag('fru')).toBe('Ultimate — Lv.100');
        expect(getCategoryTag('ucob')).toBe('Ultimate — Lv.70');
    });

    it('nullで空文字を返す', () => {
        expect(getCategoryTag(null)).toBe('');
    });

    it('存在しないIDで空文字を返す', () => {
        expect(getCategoryTag('nonexistent')).toBe('');
    });
});

// ========================================
// parseTier
// ========================================
describe('parseTier', () => {
    it('標準的な零式名をパースできる', () => {
        const result = parseTier('至天の座アルカディア零式：ヘビー級1');
        expect(result).toEqual({
            seriesName: '至天の座アルカディア零式',
            tierName: 'ヘビー級',
            label: '1',
        });
    });

    it('前半/後半付きをパースできる', () => {
        const result = parseTier('至天の座アルカディア零式：ヘビー級4（前半）');
        expect(result).toEqual({
            seriesName: '至天の座アルカディア零式',
            tierName: 'ヘビー級',
            label: '4前半',
        });
    });

    it('パンデモニウムをパースできる', () => {
        const result = parseTier('万魔殿パンデモニウム零式：天獄編1');
        expect(result).toEqual({
            seriesName: '万魔殿パンデモニウム零式',
            tierName: '天獄編',
            label: '1',
        });
    });

    it('絶コンテンツ名はパースできない（null）', () => {
        expect(parseTier('絶もうひとつの未来')).toBeNull();
    });

    it('空文字はパースできない（null）', () => {
        expect(parseTier('')).toBeNull();
    });
});

// ========================================
// trySeriesSummary
// ========================================
describe('trySeriesSummary', () => {
    it('同シリーズ・同階級のバンドルでまとめ表記を返す', () => {
        const plans = [
            { contentId: 'm9s', title: 'Plan A' },
            { contentId: 'm10s', title: 'Plan B' },
            { contentId: 'm11s', title: 'Plan C' },
        ];
        const result = trySeriesSummary(plans);
        expect(result).not.toBeNull();
        expect(result!.seriesName).toBe('至天の座アルカディア零式');
        expect(result!.tierName).toBe('ヘビー級');
        expect(result!.summary).toBe('ヘビー級 1 ｜ 2 ｜ 3');
        expect(result!.categoryTag).toBe('Savage — Lv.100');
    });

    it('前半/後半混在でもまとめ表記を返す', () => {
        const plans = [
            { contentId: 'm12s_p1', title: '' },
            { contentId: 'm12s_p2', title: '' },
        ];
        const result = trySeriesSummary(plans);
        expect(result).not.toBeNull();
        expect(result!.summary).toBe('ヘビー級 4前半 ｜ 4後半');
    });

    it('異なるシリーズのバンドルでnullを返す', () => {
        const plans = [
            { contentId: 'm9s', title: '' },
            { contentId: 'p9s', title: '' },
        ];
        expect(trySeriesSummary(plans)).toBeNull();
    });

    it('絶コンテンツのバンドルでnullを返す（parseTierが失敗）', () => {
        const plans = [
            { contentId: 'fru', title: '' },
            { contentId: 'tea', title: '' },
        ];
        expect(trySeriesSummary(plans)).toBeNull();
    });

    it('1件のプランでnullを返す', () => {
        expect(trySeriesSummary([{ contentId: 'm9s', title: '' }])).toBeNull();
    });

    it('contentIdがnullのプランを含むとnullを返す', () => {
        const plans = [
            { contentId: null, title: 'Custom' },
            { contentId: 'm9s', title: '' },
        ];
        expect(trySeriesSummary(plans)).toBeNull();
    });
});
