import type { MockListing } from '../../../data/housing/mockListings';
import { sortByAddress } from '../../../lib/housing/sortByAddress';

/** お気に入りの並び順タブ */
export type FavTab = 'all' | 'recent';

/**
 * お気に入り一覧の並び替え純関数。
 *
 * - `all`    : ids を listings に解決してから sortByAddress (住所順)。
 * - `recent` : [...ids].reverse() を listings に解決 (add で末尾 push のため逆順=新しい順)。
 * - 解決できない id (listings に存在しない) は除外。
 * - 重複 id は 1 件に集約する (先勝ちで順序維持)。永続化データ (呼び出し元の ids 配列) は
 *   書き換えない、表示直前の防御としての dedupe (バグ修正 2026-07-17: お気に入り件数の
 *   水増し/カードの2重表示の直接原因だった)。
 * - 常に新配列を返す (ミューテーションなし)。
 */
export function orderFavorites(
  ids: string[],
  listings: MockListing[],
  tab: FavTab,
): MockListing[] {
  const uniqueIds = Array.from(new Set(ids));
  const map = new Map<string, MockListing>(listings.map((l) => [l.id, l]));

  if (tab === 'recent') {
    return [...uniqueIds]
      .reverse()
      .map((id) => map.get(id))
      .filter((l): l is MockListing => l != null);
  }

  // 'all': 解決してから住所順ソート
  const resolved = uniqueIds
    .map((id) => map.get(id))
    .filter((l): l is MockListing => l != null);
  return sortByAddress(resolved);
}
