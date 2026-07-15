import type { MockListing } from '../../data/housing/mockListings';
import { HOUSING_AREAS } from '../../types/housing';

/**
 * 一覧表示用の sort:
 * - 同 addressKey の listing は固まる (= 同住所内で lastConfirmedAt desc → createdAt desc)
 * - グループの並びは住所階層: area (HOUSING_AREAS 順) → DC → server → ward
 *   → buildingType (house 先 / apartment 後) → plot or (apartmentBuilding → roomNumber)
 *
 * 2026-05-28 変更: 旧仕様 (グループ代表の createdAt desc) は「左上=自分、 2番目=後から登録」
 * のような時系列ランダムさで違和感を生んでいた。 地図ビューと整合させるため住所順に変更。
 * 「自分の登録」 はカード側のバッジで識別する設計に分離。
 *
 * Always returns a new array (does not mutate input).
 */

type SortableListing = Pick<
    MockListing,
    | 'id'
    | 'createdAt'
    | 'lastConfirmedAt'
    | 'addressKey'
    | 'area'
    | 'dc'
    | 'server'
    | 'ward'
    | 'buildingType'
    | 'plot'
    | 'apartmentBuilding'
    | 'roomNumber'
>;

function areaIndex(area: string): number {
    const idx = HOUSING_AREAS.indexOf(area as typeof HOUSING_AREAS[number]);
    return idx === -1 ? HOUSING_AREAS.length : idx;
}

function compareByAddress(a: SortableListing, b: SortableListing): number {
    // unlisted は area/dc/server/ward が undefined (住所非公開)。areaIndex('') は「未知のエリア」扱いで
    // HOUSING_AREAS.length (= 末尾) に落ちる既存フォールバックにそのまま乗るため、末尾にまとまる。
    const areaDiff = areaIndex(a.area ?? '') - areaIndex(b.area ?? '');
    if (areaDiff !== 0) return areaDiff;
    const dcDiff = (a.dc ?? '').localeCompare(b.dc ?? '');
    if (dcDiff !== 0) return dcDiff;
    const serverDiff = (a.server ?? '').localeCompare(b.server ?? '');
    if (serverDiff !== 0) return serverDiff;
    if (a.ward !== b.ward) return (a.ward ?? 0) - (b.ward ?? 0);
    const aIsApt = a.buildingType === 'apartment';
    const bIsApt = b.buildingType === 'apartment';
    if (aIsApt !== bIsApt) return aIsApt ? 1 : -1;
    if (aIsApt && bIsApt) {
        const buildingDiff =
            (a.apartmentBuilding ?? 0) - (b.apartmentBuilding ?? 0);
        if (buildingDiff !== 0) return buildingDiff;
        return (a.roomNumber ?? 0) - (b.roomNumber ?? 0);
    }
    return (a.plot ?? 0) - (b.plot ?? 0);
}

export function sortListingsForGallery<T extends SortableListing>(
    listings: T[],
): T[] {
    if (listings.length === 0) return [];

    const groups = new Map<string, T[]>();
    for (const l of listings) {
        // unlisted は addressKey が undefined (住所非公開)。id にフォールバックすることで
        // 「同住所グループ」に誤って合流させず、各 unlisted を単独グループのまま保つ。
        const groupKey = l.addressKey ?? l.id;
        const arr = groups.get(groupKey);
        if (arr) arr.push(l);
        else groups.set(groupKey, [l]);
    }

    for (const arr of groups.values()) {
        arr.sort(
            (a, b) =>
                b.lastConfirmedAt - a.lastConfirmedAt || b.createdAt - a.createdAt,
        );
    }

    const sortedGroups = Array.from(groups.values()).sort((a, b) =>
        compareByAddress(a[0], b[0]),
    );

    return sortedGroups.flat();
}
