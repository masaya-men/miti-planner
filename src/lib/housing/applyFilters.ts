import type { MockListing } from '../../data/housing/mockListings';
import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';
import type { Region } from '../../data/housing/dcServerMap';
import { isPersonalTagIdFormat } from '../../data/housingTags';

export interface FilterCondition {
    dc: string | null;
    regions: Region[] | string[];
    servers: string[];
    areas: HousingArea[];
    sizes: HousingSize[];
    tags: string[];
}

export function applyFilters(listings: MockListing[], filters: FilterCondition): MockListing[] {
    // ハウジンガー (personal_) タグと、それ以外 (公式/季節/テーマ/初心者) のタグを分離する。
    // 非ハウジンガー側 = 選んだタグのどれか1つでも一致すればOK (OR)。
    // ハウジンガー側 = 選んだハウジンガーのうち誰か1人の家であればOK (OR)。
    // 両グループとも選択されている場合は、それぞれの条件を両方満たす必要がある (AND)。
    // 片方しか選んでいない場合は、選んでいない側の条件は無条件で満たす扱い (下のif文が素通りする)。
    const personalTags = filters.tags.filter((t) => isPersonalTagIdFormat(t));
    const otherTags = filters.tags.filter((t) => !isPersonalTagIdFormat(t));
    return listings.filter((listing) => {
        if (filters.dc && listing.dc !== filters.dc) return false;
        if (listing.region !== undefined && filters.regions.length > 0 && !filters.regions.includes(listing.region)) return false;
        if (filters.servers.length > 0 && (listing.server === undefined || !filters.servers.includes(listing.server))) return false;
        if (filters.areas.length > 0 && (listing.area === undefined || !filters.areas.includes(listing.area))) return false;
        if (filters.sizes.length > 0 && (listing.size === undefined || !filters.sizes.includes(listing.size))) return false;
        if (otherTags.length > 0 && !otherTags.some((t) => listing.tags.includes(t))) return false;
        if (personalTags.length > 0 && !personalTags.some((t) => listing.tags.includes(t))) return false;
        return true;
    });
}
