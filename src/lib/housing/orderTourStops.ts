import type { MockListing } from '../../data/housing/mockListings';
import { HOUSING_AREAS } from '../../types/housing';
import { ALL_REGIONS } from '../../data/housing/dcServerMap';

type OrderableListing = Pick<MockListing,
  'id' | 'region' | 'dc' | 'server' | 'area' | 'ward' | 'buildingType' | 'plot' | 'apartmentBuilding' | 'roomNumber' | 'addressKey' | 'lastConfirmedAt' | 'createdAt'>;

function regionIndex(r: string): number { const i = ALL_REGIONS.indexOf(r as typeof ALL_REGIONS[number]); return i === -1 ? ALL_REGIONS.length : i; }
function areaIndex(a: string): number { const i = HOUSING_AREAS.indexOf(a as typeof HOUSING_AREAS[number]); return i === -1 ? HOUSING_AREAS.length : i; }

// unlisted は region/dc/server/area/ward が undefined (住所非公開)。空文字/0 扱いで比較しても
// クラッシュせず、既存の実データ (常に値あり) の並び順は一切変わらない。
function compareForTour(a: OrderableListing, b: OrderableListing): number {
  const rd = regionIndex(a.region ?? '') - regionIndex(b.region ?? ''); if (rd !== 0) return rd;
  const dc = (a.dc ?? '').localeCompare(b.dc ?? ''); if (dc !== 0) return dc;
  const sv = (a.server ?? '').localeCompare(b.server ?? ''); if (sv !== 0) return sv;
  const ar = areaIndex(a.area ?? '') - areaIndex(b.area ?? ''); if (ar !== 0) return ar;
  if (a.ward !== b.ward) return (a.ward ?? 0) - (b.ward ?? 0);
  const aApt = a.buildingType === 'apartment', bApt = b.buildingType === 'apartment';
  if (aApt !== bApt) return aApt ? 1 : -1;
  if (aApt && bApt) { const bd = (a.apartmentBuilding ?? 0) - (b.apartmentBuilding ?? 0); if (bd !== 0) return bd; return (a.roomNumber ?? 0) - (b.roomNumber ?? 0); }
  return (a.plot ?? 0) - (b.plot ?? 0);
}

/** ツアー巡回順: リージョン→DC→サーバー→エリア→区→建物種別(house先)→番地。同住所(addressKey)は隣接維持。元配列は mutate しない。 */
export function orderTourStops<T extends OrderableListing>(listings: T[]): T[] {
  if (listings.length === 0) return [];
  const groups = new Map<string, T[]>();
  // addressKey 欠落 (unlisted) は id にフォールバックし、他 listing と誤って同住所グループ化しない。
  for (const l of listings) { const key = l.addressKey ?? l.id; const arr = groups.get(key); if (arr) arr.push(l); else groups.set(key, [l]); }
  for (const arr of groups.values()) arr.sort((a, b) => b.lastConfirmedAt - a.lastConfirmedAt || b.createdAt - a.createdAt);
  return Array.from(groups.values()).sort((a, b) => compareForTour(a[0], b[0])).flat();
}

/** id リストを pool の住所情報で並べ替える。pool に無い id は末尾に元順で温存。 */
export function orderTourStopIds(ids: string[], pool: MockListing[]): string[] {
  const byId = new Map(pool.map((l) => [l.id, l]));
  const known: MockListing[] = [], unknown: string[] = [];
  for (const id of ids) { const l = byId.get(id); if (l) known.push(l); else unknown.push(id); }
  return [...orderTourStops(known).map((l) => l.id), ...unknown];
}
