// globals: true モード（vitest.config.ts）に従い、describe/it/expect はグローバル使用。
import { filterVisible, isVisible } from '../../api/popular/popularFilters';

describe('isVisible', () => {
    it('returns true when hidden is undefined', () => {
        expect(isVisible({ hidden: undefined })).toBe(true);
    });
    it('returns true when hidden is false', () => {
        expect(isVisible({ hidden: false })).toBe(true);
    });
    it('returns false when hidden is true', () => {
        expect(isVisible({ hidden: true })).toBe(false);
    });
});

describe('filterVisible', () => {
    it('keeps non-hidden plans', () => {
        const input = [
            { hidden: false, score: 10 },
            { hidden: undefined, score: 5 },
        ];
        expect(filterVisible(input)).toHaveLength(2);
    });
    it('removes hidden plans', () => {
        const input = [
            { hidden: false, score: 10 },
            { hidden: true, score: 999 },
            { hidden: undefined, score: 3 },
        ];
        const result = filterVisible(input);
        expect(result).toHaveLength(2);
        expect(result.every(d => d.hidden !== true)).toBe(true);
    });
    it('returns empty array when all hidden', () => {
        const input = [{ hidden: true }, { hidden: true }];
        expect(filterVisible(input)).toEqual([]);
    });
});
