import type { MockListing } from '../../data/housing/mockListings';

/**
 * Sort housing listings by physical address: DC → server → area → ward → plot.
 * Always returns a new array (does not mutate input) so callers can pass store
 * state directly without violating immutability.
 */
export function sortByAddress<T extends Pick<MockListing, 'dc' | 'server' | 'area' | 'ward' | 'plot'>>(
    items: T[],
): T[] {
    return [...items].sort((a, b) =>
        a.dc.localeCompare(b.dc)
        || a.server.localeCompare(b.server)
        || a.area.localeCompare(b.area)
        || (a.ward - b.ward)
        || (a.plot - b.plot),
    );
}
