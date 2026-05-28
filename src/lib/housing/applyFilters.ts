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
}

export function applyFilters(listings: MockListing[], filters: FilterCondition): MockListing[] {
    return listings.filter((listing) => {
        if (filters.dc && listing.dc !== filters.dc) return false;
        if (filters.regions.length > 0 && !filters.regions.includes(listing.region)) return false;
        if (filters.servers.length > 0 && !filters.servers.includes(listing.server)) return false;
        if (filters.areas.length > 0 && !filters.areas.includes(listing.area)) return false;
        // サイズフィルタが指定されている時、 apartment (size 未定義) は概念的に該当しないので除外。
        if (filters.sizes.length > 0 && (listing.size === undefined || !filters.sizes.includes(listing.size))) return false;
        if (filters.tags.length > 0 && !filters.tags.some((t) => listing.tags.includes(t))) return false;
        return true;
    });
}
