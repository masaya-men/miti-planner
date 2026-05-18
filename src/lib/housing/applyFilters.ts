import type { MockListing } from '../../data/housing/mockListings';
import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';
import type { Region } from '../../data/housing/dcServerMap';

export interface FilterCondition {
    dc: string | null;
    regions: Region[] | string[];
    servers: string[];
    areas: HousingArea[];
    sizes: HousingSize[];
    tags: string[];
    searchText: string;
}

function matchesSearchText(listing: MockListing, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const haystack = `${listing.description ?? ''} ${listing.tags.join(' ')} ${listing.dc} ${listing.server} ${listing.area}`.toLowerCase();
    return haystack.includes(needle);
}

export function applyFilters(listings: MockListing[], filters: FilterCondition): MockListing[] {
    return listings.filter((listing) => {
        if (filters.dc && listing.dc !== filters.dc) return false;
        if (filters.regions.length > 0 && !filters.regions.includes(listing.region)) return false;
        if (filters.servers.length > 0 && !filters.servers.includes(listing.server)) return false;
        if (filters.areas.length > 0 && !filters.areas.includes(listing.area)) return false;
        if (filters.sizes.length > 0 && !filters.sizes.includes(listing.size)) return false;
        if (filters.tags.length > 0 && !filters.tags.some((t) => listing.tags.includes(t))) return false;
        if (!matchesSearchText(listing, filters.searchText)) return false;
        return true;
    });
}
