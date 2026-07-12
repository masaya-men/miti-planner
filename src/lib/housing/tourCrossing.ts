import type { MockListing } from '../../data/housing/mockListings';

/** 隣接2地点(前の家→次の家)の移動種別。 */
export type TourCrossing =
  | { kind: 'none' }
  | { kind: 'world'; world: string }            // ワールド訪問(同DC・別ワールド)
  | { kind: 'dc'; dc: string; world: string }   // DCトラベル(別DC・同リージョン)。着地ワールドも持つ
  | { kind: 'region' };                          // 別リージョン(通常はブロックで来ない・防御表示)

type Loc = Pick<MockListing, 'region' | 'dc' | 'server'>;

/** prev=null(1件目)は 'none'。判定順: region → dc → server。 */
export function crossingBetween(prev: Loc | null, current: Loc): TourCrossing {
  if (!prev) return { kind: 'none' };
  if (prev.region !== current.region) return { kind: 'region' };
  if (prev.dc !== current.dc) return { kind: 'dc', dc: current.dc, world: current.server };
  if (prev.server !== current.server) return { kind: 'world', world: current.server };
  return { kind: 'none' };
}

/** トレイに追加してよいか。空トレイ(trayRegion=null)は何でも可、以降は同リージョンのみ。 */
export function canAddToTour(trayRegion: string | null, candidateRegion: string): boolean {
  return trayRegion === null || trayRegion === candidateRegion;
}

/** 地点集合に含まれる相異なるリージョン。1種以下なら null(=問題なし)。 */
export function tourRegionConflict(stops: Loc[]): string[] | null {
  const regions = [...new Set(stops.map((s) => s.region))];
  return regions.length > 1 ? regions : null;
}
