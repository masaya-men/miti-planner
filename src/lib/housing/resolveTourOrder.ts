import type { MockListing } from '../../data/housing/mockListings';
import { orderTourStopIds } from './orderTourStops';

export interface ResolveTourOrderOptions {
  /** ピン留め(「この位置に固定」)した listing id のリスト。trayIds に無い id は無視。 */
  pinnedIds: string[];
  /** true = 手動並び替え済み (trayIds の現在順をそのまま返す)。false = 自動順+ピン固定。 */
  manualOrder: boolean;
}

/**
 * ツアーの巡回順(=表示順=開始順)を確定する (ツアー順制御: ドラッグ並び替え + ピン留め + 効率順ボタン)。
 *
 * 2026-07-17 実機FB反映: ピンの意味を「最初/最後に固定」から「その位置に固定」へ刷新。
 *
 * - manualOrder=true: trayIds をそのまま返す (ピンは見ない。ドラッグ確定後は素通しが従来挙動)。
 * - manualOrder=false (既定): pinned な id は trayIds 内の**現在 index**に固定し、
 *   残りの unpinned だけを既存の自動順 (orderTourStopIds) で並べ替えて、空いているスロットへ
 *   先頭から詰める。
 * - pinned id が trayIds に存在しない場合は無視する (削除済み等)。
 */
export function resolveTourOrder(
  trayIds: string[],
  pool: MockListing[],
  opts: ResolveTourOrderOptions,
): string[] {
  if (opts.manualOrder) return trayIds;

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
