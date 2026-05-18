import type { MockListing } from '../../data/housing/mockListings';

export function wardKeyOf(
    input: Pick<MockListing, 'dc' | 'server' | 'area' | 'ward'>,
): string {
    return `${input.dc}-${input.server}-${input.area}-${input.ward}`.toLowerCase();
}

export function listListingsForWard(listings: MockListing[], wardKey: string): MockListing[] {
    return listings.filter((l) => wardKeyOf(l) === wardKey);
}

/**
 * Pick a random ward key that has at least `minListings` listings.
 * Returns null if no ward meets the threshold.
 *
 * Optional `rand` argument lets callers inject determinism (e.g. tests).
 */
export function pickRandomWard(
    listings: MockListing[],
    minListings = 5,
    rand: () => number = Math.random,
): string | null {
    const counts = new Map<string, number>();
    for (const l of listings) {
        const key = wardKeyOf(l);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const eligible: string[] = [];
    for (const [key, count] of counts) {
        if (count >= minListings) eligible.push(key);
    }
    if (eligible.length === 0) return null;
    const idx = Math.floor(rand() * eligible.length);
    return eligible[Math.min(idx, eligible.length - 1)];
}
