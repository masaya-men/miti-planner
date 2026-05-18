import { describe, it, expect } from 'vitest';
import { pickRandomWard, listListingsForWard, wardKeyOf } from '../../lib/housing/randomWard';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('wardKeyOf', () => {
    it('builds a deterministic key from listing fields', () => {
        const key = wardKeyOf({ dc: 'Mana', server: 'Anima', area: 'Shirogane', ward: 3 });
        expect(key).toBe('mana-anima-shirogane-3');
    });
});

describe('pickRandomWard', () => {
    it('returns null when no ward in mock data meets a 5-listing threshold', () => {
        // Mock data spreads listings across many wards; each ward has < 5 listings.
        expect(pickRandomWard(MOCK_LISTINGS, 5)).toBeNull();
    });

    it('returns the qualifying ward key when given synthetic data', () => {
        const base = MOCK_LISTINGS[0];
        const synthetic = Array.from({ length: 5 }, (_, i) => ({ ...base, id: `s-${i}`, plot: i + 1 }));
        const key = pickRandomWard(synthetic, 5);
        expect(key).toBe(wardKeyOf(base));
    });

    it('returns null when threshold is unreachable', () => {
        expect(pickRandomWard(MOCK_LISTINGS, 100)).toBeNull();
    });

    it('honours injected rand for deterministic selection', () => {
        const a = MOCK_LISTINGS[0];
        const b = { ...MOCK_LISTINGS[2], dc: 'Crystal', server: 'Balmung', area: 'LavenderBeds' as const, ward: 9 };
        const synthetic = [
            ...Array.from({ length: 3 }, (_, i) => ({ ...a, id: `a-${i}`, plot: i + 1 })),
            ...Array.from({ length: 3 }, (_, i) => ({ ...b, id: `b-${i}`, plot: i + 1 })),
        ];
        const aKey = wardKeyOf(a);
        const bKey = wardKeyOf(b);
        const picked0 = pickRandomWard(synthetic, 3, () => 0);
        const picked1 = pickRandomWard(synthetic, 3, () => 0.99);
        expect([aKey, bKey]).toContain(picked0);
        expect([aKey, bKey]).toContain(picked1);
        expect(picked0).not.toBe(picked1);
    });
});

describe('listListingsForWard', () => {
    it('returns listings that match the given ward key', () => {
        const listings = listListingsForWard(MOCK_LISTINGS, 'mana-anima-shirogane-3');
        expect(listings.length).toBeGreaterThan(0);
        expect(listings.every((l) => wardKeyOf(l) === 'mana-anima-shirogane-3')).toBe(true);
    });

    it('returns empty array when ward key has no listings', () => {
        expect(listListingsForWard(MOCK_LISTINGS, 'no-such-ward')).toEqual([]);
    });
});
