import type { MockListing } from '../../data/housing/mockListings';

/** 隣接2地点(前の家→次の家)の移動種別。 */
export type TourCrossing =
  | { kind: 'none' }
  | { kind: 'start'; dc: string; world: string } // 1件目: まずどこへ向かうかの出発案内(出発地不明のため目的地を示す)
  | { kind: 'world'; world: string; dc: string } // ワールド訪問(同DC・別ワールド)。dc は表示側の displayWorldName(dc, world) 用
  | { kind: 'dc'; dc: string; world: string }   // DCトラベル(別DC・同リージョン)。着地ワールドも持つ
  | { kind: 'region' };                          // 別リージョン(通常はブロックで来ない・防御表示)

type Loc = Pick<MockListing, 'region' | 'dc' | 'server'>;

/** リージョン→移動可能圏。KR/CN は物理分離、それ以外(JP/NA/EU/OCE)は相互移動可能なグローバル圏。 */
export type TravelGroup = 'GLOBAL' | 'KR' | 'CN';

/** リージョン→移動可能圏。KR/CN は物理分離、それ以外(JP/NA/EU/OCE)は相互移動可能なグローバル圏。 */
export function travelGroupOf(region: string): TravelGroup {
  return region === 'KR' ? 'KR' : region === 'CN' ? 'CN' : 'GLOBAL';
}

/** prev=null(1件目)は 'none'。判定順: region → dc → server。 */
export function crossingBetween(prev: Loc | null, current: Loc): TourCrossing {
  if (!prev) return { kind: 'none' };
  // unlisted は dc/server が undefined (住所非公開)。空文字にフォールバックしてもクラッシュしない
  // (現状 unlisted はツアーに乗る導線が無いため実質未使用・将来 Task7 でガードされる想定)。
  if (prev.region !== current.region) {
    // OCE(Materia)は日/米/欧と相互 DC トラベル可能(ユーザー確定)。 跨ぎは「DCトラベル」として案内する。
    // ただし KR/CN は物理分離のため、この OCE 特例は両者ともグローバル圏(JP/NA/EU/OCE)のときだけ適用。
    // KR/CN が絡む跨ぎ(通常はトレイ段階でブロックされ到達しない)は防御表示のまま。
    const prevGroup = prev.region ? travelGroupOf(prev.region) : 'GLOBAL';
    const currentGroup = current.region ? travelGroupOf(current.region) : 'GLOBAL';
    if (prevGroup === 'GLOBAL' && currentGroup === 'GLOBAL' && (prev.region === 'OCE' || current.region === 'OCE')) {
      return { kind: 'dc', dc: current.dc ?? '', world: current.server ?? '' };
    }
    return { kind: 'region' };
  }
  if (prev.dc !== current.dc) return { kind: 'dc', dc: current.dc ?? '', world: current.server ?? '' };
  if (prev.server !== current.server) return { kind: 'world', world: current.server ?? '', dc: current.dc ?? '' };
  return { kind: 'none' };
}

/**
 * ツアー1件目の「まずどこへ向かうか」出発案内 (#2)。
 * 前の家が無く跨ぎ判定できないため、出発地は不明として目的地 (DC/ワールド) を示すだけの
 * 'start' を返す。world (server) が無い (住所未確定の一時追加等) ときは案内を出さない ('none')。
 */
export function firstDestination(current: Loc): TourCrossing {
  if (!current.server) return { kind: 'none' };
  return { kind: 'start', dc: current.dc ?? '', world: current.server };
}

/**
 * トレイの「アンカー地域」。 非OCE のリージョンがあればその先頭を返し(OCE はグローバル圏内
 * ワイルドカードなのでアンカーにしない=[OCE, NA] でも NA がアンカーになり追加時に即ブロックできる)、
 * OCE しか無ければ 'OCE' を返す(OCE のみのトレイに KR/CN を混ぜさせないため)。
 * 無ければ(空 or すべて null/undefined) null。
 * ジェネリックにして入力の Region 型をそのまま保つ(呼び出し元の型崩れ防止)。
 */
export function tourAnchorRegion<T extends string>(regions: (T | null | undefined)[]): T | null {
  let oce: T | null = null;
  for (const r of regions) {
    if (!r) continue;
    if (r !== 'OCE') return r;
    if (oce === null) oce = r;
  }
  return oce;
}

/**
 * トレイに追加してよいか。
 * - 空トレイ(アンカー無し)は何でも可。
 * - KR/CN は物理分離: アンカーと候補の移動可能圏(travelGroupOf)が異なれば不可。
 * - グローバル圏(JP/NA/EU/OCE)同士では、OCE(Materia)は常に追加可(日/米/欧のどれとでも混在可・ユーザー確定)。
 *   非OCE地域は、アンカーが OCE か同一地域のときのみ可。
 */
export function canAddToTour(trayAnchorRegion: string | null, candidateRegion: string): boolean {
  if (trayAnchorRegion === null) return true;
  if (travelGroupOf(trayAnchorRegion) !== travelGroupOf(candidateRegion)) return false; // KR/CN分離
  if (candidateRegion === 'OCE') return true; // OCEはグローバル圏内ワイルドカード(従来)
  return trayAnchorRegion === 'OCE' || trayAnchorRegion === candidateRegion; // 非OCEは同一地域のみ(従来)
}

/**
 * 地点集合の地域衝突。
 * 定義済み region の distinct な移動可能圏(travelGroupOf)が2種以上あれば衝突(distinct region 配列を返す)。
 * それ以外(移動可能圏が1種以下)は従来ルール: OCE(Materia)は混在可なので除外し、
 * 非OCE地域が2種以上で衝突(その配列を返す)。 1種以下なら null(=問題なし)。
 */
export function tourRegionConflict(stops: Loc[]): string[] | null {
  // unlisted (region undefined) は地域衝突判定の対象外 (住所非公開でどの地域か分からないため)。
  const regions = stops.map((s) => s.region).filter((r): r is Exclude<typeof r, undefined> => r !== undefined);
  const distinctRegions = [...new Set(regions)];
  const distinctGroups = new Set(distinctRegions.map((r) => travelGroupOf(r)));
  if (distinctGroups.size > 1) return distinctRegions;

  const nonOce = distinctRegions.filter((r) => r !== 'OCE');
  return nonOce.length > 1 ? nonOce : null;
}
