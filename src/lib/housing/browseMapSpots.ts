// 探すページ 地図表示モード の集計純関数 (spec §5.1/5.3, plan Task 1)。
// listing 群は既に `applyFilters` 適用済み前提 (フィルタ完全共有・地図側で独自緩和しない)。

import type { MockListing } from '../../data/housing/mockListings';
import type { HousingArea } from '../../store/useHousingFilterStore';
import { resolveWardMapRef } from './resolveWardMapRef';

export type WardMapKind = 'main' | 'sub';

export interface BrowseMapSpot {
  /** `${kind}:${plot}` (apart は plot=アパートエントリの plot 値、常に 1) */
  key: string;
  kind: 'plot' | 'apart';
  /** json.houses と突き合わせる番号 (main/sub いずれも 1-30 に読み替え済み) */
  plot: number;
  /** この場所の全件 (lastConfirmedAt desc、同値は createdAt desc) */
  listings: MockListing[];
  /** listings[0] (代表 = 最新確認) */
  representative: MockListing;
}

/** 代表選定の並び順: lastConfirmedAt 最大 (同値は createdAt 最大) が先頭。 */
function byRepresentativeDesc(a: MockListing, b: MockListing): number {
  if (b.lastConfirmedAt !== a.lastConfirmedAt) return b.lastConfirmedAt - a.lastConfirmedAt;
  return b.createdAt - a.createdAt;
}

/** フィルタ済み listing 群から、指定 area×ward のものだけを取り出す。 */
export function selectWardListings(filtered: MockListing[], area: HousingArea, ward: number): MockListing[] {
  return filtered.filter((l) => l.area === area && l.ward === ward);
}

/**
 * 同一 ward の listing 群を、指定 mapKey (本街 or 拡張街) の地図上の「番地スポット / アパートスポット」に集約する。
 *
 * - 各 listing を `resolveWardMapRef` に通し、返る mapKey が引数と一致するものだけを対象にする
 *   (不一致は「別マップ (main/sub 違い) に属する」正常な絞り込みなのでスキップのみ・warn しない)。
 * - ref が null (データ異常で解決不能) の listing は console.warn の上でスキップし、クラッシュしない (spec §5.5)。
 * - アパートは highlightPlot が常に 1 固定 (号棟 1/2 のどちらでも、部屋番号違いは区別せず 1 つの
 *   apart スポットに集約 = spec §5.2 建物 1 点粒度)。
 */
export function groupListingsByMapSpot(wardListings: MockListing[], mapKey: string): BrowseMapSpot[] {
  const byKey = new Map<string, MockListing[]>();
  const metaByKey = new Map<string, { kind: 'plot' | 'apart'; plot: number }>();
  const order: string[] = [];

  for (const listing of wardListings) {
    const ref = resolveWardMapRef(listing.area, listing.plot ?? null, listing.apartmentBuilding ?? null, listing.buildingType);
    if (!ref) {
      console.warn('[browseMapSpots] resolveWardMapRef 解決不能:', listing.id);
      continue;
    }
    if (ref.mapKey !== mapKey) continue; // 別マップ(main/sub違い)は対象外

    const key = `${ref.highlightKind}:${ref.highlightPlot}`;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = [];
      byKey.set(key, bucket);
      metaByKey.set(key, { kind: ref.highlightKind, plot: ref.highlightPlot });
      order.push(key);
    }
    bucket.push(listing);
  }

  return order.map((key) => {
    const listings = byKey.get(key)!.slice().sort(byRepresentativeDesc);
    const meta = metaByKey.get(key)!;
    return { key, kind: meta.kind, plot: meta.plot, listings, representative: listings[0] };
  });
}

/** 操作列の件数バッジ用: 指定 area の listing を ward 番号ごとに件数集計する。 */
export function countListingsByWard(filtered: MockListing[], area: HousingArea): Map<number, number> {
  const counts = new Map<number, number>();
  for (const l of filtered) {
    if (l.area !== area) continue;
    counts.set(l.ward, (counts.get(l.ward) ?? 0) + 1);
  }
  return counts;
}

/** 本街/拡張街タブの件数バッジ用: 同一 ward 内の listing を main/sub に振り分けて件数集計する。 */
export function countListingsByMapKind(wardListings: MockListing[]): { main: number; sub: number } {
  let main = 0;
  let sub = 0;
  for (const l of wardListings) {
    const ref = resolveWardMapRef(l.area, l.plot ?? null, l.apartmentBuilding ?? null, l.buildingType);
    if (!ref) continue; // データ異常はどちらの件数にも含めない (クラッシュしない)
    if (ref.mapKey.endsWith('-sub')) sub += 1;
    else main += 1;
  }
  return { main, sub };
}

/** 初期表示対象: フィルタ済み listing のうち最も件数の多い area×ward を返す。0件なら null。 */
export function findInitialWardTarget(filtered: MockListing[]): { area: HousingArea; ward: number } | null {
  if (filtered.length === 0) return null;

  const counts = new Map<string, { area: HousingArea; ward: number; count: number }>();
  for (const l of filtered) {
    const key = `${l.area}:${l.ward}`;
    const cur = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { area: l.area, ward: l.ward, count: 1 });
  }

  let best: { area: HousingArea; ward: number; count: number } | null = null;
  for (const v of counts.values()) {
    if (!best || v.count > best.count) best = v;
  }
  return best ? { area: best.area, ward: best.ward } : null;
}
