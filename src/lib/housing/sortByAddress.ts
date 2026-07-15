import type { MockListing } from '../../data/housing/mockListings';

/** house を先、 apartment を後にする (同 ward 内で建物タイプを揃える) */
function buildingOrder(buildingType: string | undefined): number {
    return buildingType === 'apartment' ? 1 : 0;
}

type SortableListing = Pick<
    MockListing,
    'dc' | 'server' | 'area' | 'ward' | 'plot' | 'buildingType' | 'apartmentBuilding' | 'roomNumber'
>;

/**
 * Sort housing listings by physical address: DC → server → area → ward → buildingType → 内訳。
 *
 * house: plot 番号で昇順
 * apartment: apartmentBuilding (1 → 2) → roomNumber で昇順
 *
 * 同 ward 内では house を先に並べてから apartment を並べる (アパートは末尾に集約)。
 * Always returns a new array (does not mutate input).
 */
export function sortByAddress<T extends SortableListing>(items: T[]): T[] {
    // unlisted は dc/server/area/ward が undefined (住所非公開)。空文字/0 扱いで比較しても
    // クラッシュせず、既存の実データ (常に値あり) の並び順は一切変わらない。
    return [...items].sort((a, b) =>
        (a.dc ?? '').localeCompare(b.dc ?? '')
        || (a.server ?? '').localeCompare(b.server ?? '')
        || (a.area ?? '').localeCompare(b.area ?? '')
        || ((a.ward ?? 0) - (b.ward ?? 0))
        || (buildingOrder(a.buildingType) - buildingOrder(b.buildingType))
        || ((a.plot ?? 0) - (b.plot ?? 0))
        || ((a.apartmentBuilding ?? 0) - (b.apartmentBuilding ?? 0))
        || ((a.roomNumber ?? 0) - (b.roomNumber ?? 0)),
    );
}
