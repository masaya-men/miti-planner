import { describe, it, expect } from 'vitest';
import { sortByAddress } from '../../lib/housing/sortByAddress';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('sortByAddress', () => {
    it('sorts by DC > server > area > ward > plot', () => {
        const sample = MOCK_LISTINGS.slice(0, 8);
        const sorted = sortByAddress(sample);
        for (let i = 1; i < sorted.length; i++) {
            const a = sorted[i - 1];
            const b = sorted[i];
            const cmp =
                (a.dc ?? '').localeCompare(b.dc ?? '')
                || (a.server ?? '').localeCompare(b.server ?? '')
                || (a.area ?? '').localeCompare(b.area ?? '')
                || ((a.ward ?? 0) - (b.ward ?? 0))
                || ((a.plot ?? 0) - (b.plot ?? 0));
            expect(cmp).toBeLessThanOrEqual(0);
        }
    });

    it('does not mutate input', () => {
        const sample = MOCK_LISTINGS.slice(0, 3);
        const before = [...sample];
        sortByAddress(sample);
        expect(sample).toEqual(before);
    });
});
