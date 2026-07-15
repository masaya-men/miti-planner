import type { MockListing } from '../../data/housing/mockListings';

/** 隣接2地点(前の家→次の家)の移動種別。 */
export type TourCrossing =
  | { kind: 'none' }
  | { kind: 'start'; dc: string; world: string } // 1件目: まずどこへ向かうかの出発案内(出発地不明のため目的地を示す)
  | { kind: 'world'; world: string }            // ワールド訪問(同DC・別ワールド)
  | { kind: 'dc'; dc: string; world: string }   // DCトラベル(別DC・同リージョン)。着地ワールドも持つ
  | { kind: 'region' };                          // 別リージョン(通常はブロックで来ない・防御表示)

type Loc = Pick<MockListing, 'region' | 'dc' | 'server'>;

/** prev=null(1件目)は 'none'。判定順: region → dc → server。 */
export function crossingBetween(prev: Loc | null, current: Loc): TourCrossing {
  if (!prev) return { kind: 'none' };
  // unlisted は dc/server が undefined (住所非公開)。空文字にフォールバックしてもクラッシュしない
  // (現状 unlisted はツアーに乗る導線が無いため実質未使用・将来 Task7 でガードされる想定)。
  if (prev.region !== current.region) {
    // OCE(Materia)は日/米/欧と相互 DC トラベル可能(ユーザー確定)。 跨ぎは「DCトラベル」として案内する。
    // それ以外の別リージョン(通常はトレイ段階でブロックされ到達しない)は防御表示のまま。
    if (prev.region === 'OCE' || current.region === 'OCE') {
      return { kind: 'dc', dc: current.dc ?? '', world: current.server ?? '' };
    }
    return { kind: 'region' };
  }
  if (prev.dc !== current.dc) return { kind: 'dc', dc: current.dc ?? '', world: current.server ?? '' };
  if (prev.server !== current.server) return { kind: 'world', world: current.server ?? '' };
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
 * トレイの「非OCEアンカー地域」。 OCE(Materia)は日/米/欧のどれとでも混在可なのでアンカーにしない。
 * 非OCE地域が1つでもあればそれ(先頭)を返す。 無ければ(空 or OCEのみ) null。
 * ジェネリックにして入力の Region 型をそのまま保つ(呼び出し元の型崩れ防止)。
 */
export function tourAnchorRegion<T extends string>(regions: (T | null | undefined)[]): T | null {
  for (const r of regions) {
    if (r && r !== 'OCE') return r;
  }
  return null;
}

/**
 * トレイに追加してよいか。 OCE(Materia)は常に追加可(日/米/欧のどれとでも混在可・ユーザー確定)。
 * 非OCE地域は、 トレイのアンカー(既存の非OCE地域)が無いか同一のときのみ可。
 */
export function canAddToTour(trayAnchorRegion: string | null, candidateRegion: string): boolean {
  if (candidateRegion === 'OCE') return true;
  return trayAnchorRegion === null || trayAnchorRegion === candidateRegion;
}

/**
 * 地点集合の地域衝突。 OCE(Materia)は混在可なので除外し、 非OCE地域が2種以上で衝突(その配列を返す)。
 * 1種以下なら null(=問題なし)。
 */
export function tourRegionConflict(stops: Loc[]): string[] | null {
  // unlisted (region undefined) は地域衝突判定の対象外 (住所非公開でどの地域か分からないため)。
  const nonOce = [...new Set(
    stops.map((s) => s.region).filter((r): r is Exclude<typeof r, undefined> => r !== undefined && r !== 'OCE'),
  )];
  return nonOce.length > 1 ? nonOce : null;
}
