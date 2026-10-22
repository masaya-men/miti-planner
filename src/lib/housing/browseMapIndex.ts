// 探すページ 地図表示: 「DC × ワールド × エリア × 区 × 本街/拡張街」の件数索引 (純関数)。
// 入力は applyFilters 適用済み (ただし dc / servers だけは外した) の listing 群。
// 案内板 (MapRail) と DC メニュー (MapDcMenu) の件数・自動選択はすべてここから導く。

import type { MockListing } from '../../data/housing/mockListings';
import type { HousingArea } from '../../store/useHousingFilterStore';
import { resolveWardMapRef } from './resolveWardMapRef';
import type { WardMapKind } from './browseMapSpots';

export interface MapIndexEntry {
  dc: string;
  server: string;
  area: HousingArea;
  ward: number;
  kind: WardMapKind;
  n: number;
}

export interface MapSelection {
  server: string;
  area: HousingArea;
  ward: number;
  kind: WardMapKind;
}

/** 本街(main)を先に見るための走査順 (同数なら main / 若い区 / 先に出た方が勝つ)。 */
export function buildMapIndex(listings: MockListing[]): MapIndexEntry[] {
  const byKey = new Map<string, MapIndexEntry>();
  for (const l of listings) {
    // 住所非公開 (area/ward/server 無し) は地図に置けない
    if (!l.dc || !l.server || l.area === undefined || l.ward === undefined) continue;
    const ref = resolveWardMapRef(l.area, l.plot ?? null, l.apartmentBuilding ?? null, l.buildingType);
    if (!ref) continue; // データ異常は件数に含めない (地図側と同じ扱い)
    const kind: WardMapKind = ref.mapKey.endsWith('-sub') ? 'sub' : 'main';
    const key = `${l.dc}|${l.server}|${l.area}|${l.ward}|${kind}`;
    const cur = byKey.get(key);
    if (cur) cur.n += 1;
    else byKey.set(key, { dc: l.dc, server: l.server, area: l.area, ward: l.ward, kind, n: 1 });
  }
  return [...byKey.values()];
}

const sumOf = (entries: MapIndexEntry[], pred: (e: MapIndexEntry) => boolean): number =>
  entries.reduce((s, e) => (pred(e) ? s + e.n : s), 0);

export const countDc = (idx: MapIndexEntry[], dc: string) => sumOf(idx, (e) => e.dc === dc);
export const countServer = (idx: MapIndexEntry[], dc: string, server: string) =>
  sumOf(idx, (e) => e.dc === dc && e.server === server);
export const countArea = (idx: MapIndexEntry[], dc: string, server: string, area: HousingArea) =>
  sumOf(idx, (e) => e.dc === dc && e.server === server && e.area === area);
export const countWard = (idx: MapIndexEntry[], dc: string, server: string, area: HousingArea, ward: number) =>
  sumOf(idx, (e) => e.dc === dc && e.server === server && e.area === area && e.ward === ward);
export const countKind = (
  idx: MapIndexEntry[], dc: string, server: string, area: HousingArea, ward: number, kind: WardMapKind,
) => sumOf(idx, (e) => e.dc === dc && e.server === server && e.area === area && e.ward === ward && e.kind === kind);

/** 件数最多の entry (同数は走査順の先勝ち: main 優先は kind 比較で担保)。無ければ null。 */
function pickBest(entries: MapIndexEntry[]): MapIndexEntry | null {
  let best: MapIndexEntry | null = null;
  for (const e of entries) {
    if (!best || e.n > best.n || (e.n === best.n && e.kind === 'main' && best.kind === 'sub')) best = e;
  }
  return best;
}
const toSel = (e: MapIndexEntry): MapSelection => ({ server: e.server, area: e.area, ward: e.ward, kind: e.kind });

/** DC 内で最多の (ワールド×エリア×区×本街/拡張街)。 */
export const bestInDc = (idx: MapIndexEntry[], dc: string): MapSelection | null => {
  const b = pickBest(idx.filter((e) => e.dc === dc));
  return b ? toSel(b) : null;
};
/** ワールドを選び直した時: そのワールドで最多の エリア×区×種別。 */
export const bestInServer = (idx: MapIndexEntry[], dc: string, server: string): MapSelection | null => {
  const b = pickBest(idx.filter((e) => e.dc === dc && e.server === server));
  return b ? toSel(b) : null;
};
/** エリアを選び直した時: そのエリアで最多の 区×種別。 */
export const bestInArea = (idx: MapIndexEntry[], dc: string, server: string, area: HousingArea): MapSelection | null => {
  const b = pickBest(idx.filter((e) => e.dc === dc && e.server === server && e.area === area));
  return b ? toSel(b) : null;
};
/** 区を選び直した時: その区で件数の多い側 (同数は本街)。 */
export function bestKindInWard(
  idx: MapIndexEntry[], dc: string, server: string, area: HousingArea, ward: number,
): WardMapKind {
  return countKind(idx, dc, server, area, ward, 'sub') > countKind(idx, dc, server, area, ward, 'main') ? 'sub' : 'main';
}
