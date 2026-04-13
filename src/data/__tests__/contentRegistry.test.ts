import { describe, it, expect, vi } from 'vitest';

vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: {
        getState: () => ({ contents: null, config: null }),
    },
}));

import {
    getCurrentExpansionLevel,
    getSavageForCurrentExpansion,
    getAllUltimates,
    getOtherContents,
} from '../contentRegistry';

describe('contentRegistry フィルタ関数', () => {
    it('getCurrentExpansionLevel は最大レベルを返す', () => {
        const level = getCurrentExpansionLevel();
        expect(level).toBe(100);
    });

    it('getSavageForCurrentExpansion は現拡張の零式のみ返す', () => {
        const contents = getSavageForCurrentExpansion();
        expect(contents.length).toBeGreaterThan(0);
        expect(contents.every(c => c.category === 'savage' && c.level === 100)).toBe(true);
    });

    it('getAllUltimates は全絶コンテンツを返す', () => {
        const contents = getAllUltimates();
        expect(contents.length).toBeGreaterThan(0);
        expect(contents.every(c => c.category === 'ultimate')).toBe(true);
        const levels = new Set(contents.map(c => c.level));
        expect(levels.size).toBeGreaterThan(1);
    });

    it('getOtherContents は dungeon/raid/custom のみ返す', () => {
        const contents = getOtherContents();
        const validCats = ['dungeon', 'raid', 'custom'];
        expect(contents.every(c => validCats.includes(c.category))).toBe(true);
    });
});
