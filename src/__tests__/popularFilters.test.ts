// globals: true モード（vitest.config.ts）に従い、describe/it/expect はグローバル使用。
import { filterVisible, isVisible, calculateScore7d, dayKeyDaysBefore, todayKey } from '../../api/popular/popularFilters';

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

describe('todayKey', () => {
    it('returns YYYYMMDD format (8 digits)', () => {
        const k = todayKey();
        expect(k).toMatch(/^\d{8}$/);
    });
    it('matches the UTC date prefix', () => {
        const expected = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        expect(todayKey()).toBe(expected);
    });
});

describe('dayKeyDaysBefore', () => {
    it('day-0 equals todayKey', () => {
        expect(dayKeyDaysBefore(0)).toBe(todayKey());
    });
    it('day-7 is lexicographically less than day-0', () => {
        expect(dayKeyDaysBefore(7) < dayKeyDaysBefore(0)).toBe(true);
    });
    it('day-30 is also lexicographically less than day-7', () => {
        expect(dayKeyDaysBefore(30) < dayKeyDaysBefore(7)).toBe(true);
    });
});

describe('calculateScore7d', () => {
    it('returns 0 for undefined/null/empty input', () => {
        expect(calculateScore7d(undefined, '20260101')).toBe(0);
        expect(calculateScore7d(null, '20260101')).toBe(0);
        expect(calculateScore7d({}, '20260101')).toBe(0);
    });
    it('sums values whose keys are >= windowStart', () => {
        const byDay = { '20260101': 1, '20260105': 2, '20260110': 4 };
        expect(calculateScore7d(byDay, '20260104')).toBe(6); // 2+4
    });
    it('excludes values whose keys are < windowStart', () => {
        const byDay = { '20260101': 100, '20260102': 50 };
        expect(calculateScore7d(byDay, '20260103')).toBe(0);
    });
    it('includes the boundary key (>=)', () => {
        const byDay = { '20260103': 7, '20260104': 3 };
        expect(calculateScore7d(byDay, '20260103')).toBe(10);
    });
});
