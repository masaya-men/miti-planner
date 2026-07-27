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
        // unlisted は region/server/area が undefined (住所非公開)。個別条件が選択されている時は
        // 一致しようがないので除外する (「未選択=絞り込みなし」の時だけそのまま素通り、実質不変)。
        // ただし region だけは例外: 言語切替で「未タッチでも」既定地域が入る (useHousingFilterStore の
        // applyLocaleDefaultRegions) ため、他フィルターと違い実質デフォルトON。ここで弾くと住所非公開の
        // 物件が誰も触っていないのに探すから常に消えてしまう。地域という概念自体を持たない unlisted は
        // 地域フィルターの対象外として素通しする (server/area/size は従来どおり明示操作のみで有効なため除外維持)。
        if (listing.region !== undefined && filters.regions.length > 0 && !filters.regions.includes(listing.region)) return false;
        if (filters.servers.length > 0 && (listing.server === undefined || !filters.servers.includes(listing.server))) return false;
        if (filters.areas.length > 0 && (listing.area === undefined || !filters.areas.includes(listing.area))) return false;
        // サイズフィルタが指定されている時、 apartment (size 未定義) は概念的に該当しないので除外。
        if (filters.sizes.length > 0 && (listing.size === undefined || !filters.sizes.includes(listing.size))) return false;
        if (filters.tags.length > 0 && !filters.tags.some((t) => listing.tags.includes(t))) return false;
        return true;
    });
}
