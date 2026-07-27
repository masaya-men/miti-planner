import { describe, it, expect } from 'vitest';
import { applyFilters, type FilterCondition } from '../../lib/housing/applyFilters';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

const EMPTY: FilterCondition = {
    dc: null,
    regions: [],
    servers: [],
    areas: [],
    sizes: [],
    tags: [],
};

describe('applyFilters', () => {
    it('returns all listings when filters are empty', () => {
        expect(applyFilters(MOCK_LISTINGS, EMPTY).length).toBe(MOCK_LISTINGS.length);
    });

    it('filters by DC (single)', () => {
        const result = applyFilters(MOCK_LISTINGS, { ...EMPTY, dc: 'Mana' });
        expect(result.length).toBeGreaterThan(0);
        expect(result.every((l) => l.dc === 'Mana')).toBe(true);
    });

    it('filters by region (multi, OR)', () => {
        const result = applyFilters(MOCK_LISTINGS, { ...EMPTY, regions: ['JP', 'NA'] });
        expect(result.every((l) => l.region === 'JP' || l.region === 'NA')).toBe(true);
    });

    it('filters by server (multi, OR)', () => {
        const result = applyFilters(MOCK_LISTINGS, { ...EMPTY, servers: ['Anima', 'Cactuar'] });
        expect(result.every((l) => l.server === 'Anima' || l.server === 'Cactuar')).toBe(true);
    });

    it('filters by area (multi, OR)', () => {
        const result = applyFilters(MOCK_LISTINGS, { ...EMPTY, areas: ['Shirogane'] });
        expect(result.every((l) => l.area === 'Shirogane')).toBe(true);
    });

    it('filters by size (multi, OR)', () => {
        const result = applyFilters(MOCK_LISTINGS, { ...EMPTY, sizes: ['L'] });
        expect(result.every((l) => l.size === 'L')).toBe(true);
    });

    it('filters by tag (multi, OR — listing matches if any selected tag matches)', () => {
        const result = applyFilters(MOCK_LISTINGS, { ...EMPTY, tags: ['wafu'] });
        expect(result.every((l) => l.tags.includes('wafu'))).toBe(true);
    });

    it('combines filters with AND across categories', () => {
        const result = applyFilters(MOCK_LISTINGS, {
            ...EMPTY,
            dc: 'Mana',
            areas: ['Shirogane'],
            tags: ['wafu'],
        });
        expect(result.every((l) => l.dc === 'Mana' && l.area === 'Shirogane' && l.tags.includes('wafu'))).toBe(true);
    });

    it('returns empty when no listing matches', () => {
        const result = applyFilters(MOCK_LISTINGS, { ...EMPTY, dc: 'Mana', regions: ['EU'] });
        expect(result.length).toBe(0);
    });

    it('unlisted (region undefined) は地域フィルターが有効でも除外されない (§3.5: 言語既定の地域選択で住所非公開の物件が探すから消える回帰の再発防止)', () => {
        const unlisted = { ...MOCK_LISTINGS[0], id: 'unlisted-test', region: undefined, dc: undefined, server: undefined, area: undefined };
        const result = applyFilters([unlisted], { ...EMPTY, regions: ['JP', 'NA'] });
        expect(result).toHaveLength(1);
    });

    it('unlisted (server undefined) は従来どおりサーバーフィルターでは除外される (地域だけが例外)', () => {
        const unlisted = { ...MOCK_LISTINGS[0], id: 'unlisted-test-2', region: undefined, dc: undefined, server: undefined, area: undefined };
        const result = applyFilters([unlisted], { ...EMPTY, servers: ['Anima'] });
        expect(result).toHaveLength(0);
    });
});
