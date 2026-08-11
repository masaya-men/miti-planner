import type { MockListing } from '../../data/housing/mockListings';
import { orderTourStopIds } from './orderTourStops';

export interface ResolveTourOrderOptions {
  /** ピン留め(「この位置に固定」)した listing id のリスト。trayIds に無い id は無視。 */
  pinnedIds: string[];
}

/**
 * ツアーの巡回順(=表示順=開始順)を確定する (ツアー順制御: ドラッグ並び替え + ピン留め + 効率順ボタン)。
 *
 * 2026-08-11 実機FB反映(2回目): 「手動並び替え済みかどうか」のグローバルなモード切替は廃止。
 * ドラッグは呼び出し側 (useTourTrayOrdering) が「動かしたカードをその場でピン留めする」ことで
 * 表現し、この関数は常に同じ1つのルールだけを適用する:
 * pinned な id は trayIds 内の**現在 index**に固定し、残りの unpinned だけを既存の自動順
 * (orderTourStopIds) で並べ替えて、空いているスロットへ先頭から詰める。
 * pinned id が trayIds に存在しない場合は無視する (削除済み等)。
 */
export function resolveTourOrder(
  trayIds: string[],
  pool: MockListing[],
  opts: ResolveTourOrderOptions,
): string[] {
  const pinnedSet = new Set(opts.pinnedIds.filter((id) => trayIds.includes(id)));
  const unpinnedIds = trayIds.filter((id) => !pinnedSet.has(id));
  const orderedUnpinned = orderTourStopIds(unpinnedIds, pool);

  const result: string[] = new Array(trayIds.length);
  let cursor = 0;
  for (let i = 0; i < trayIds.length; i++) {
    const id = trayIds[i];
    if (pinnedSet.has(id)) {
      result[i] = id;
    } else {
      result[i] = orderedUnpinned[cursor];
      cursor += 1;
    }
  }
  return result;
}
