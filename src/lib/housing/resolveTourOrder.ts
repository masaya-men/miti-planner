import type { MockListing } from '../../data/housing/mockListings';
import { orderTourStopIds } from './orderTourStops';

export interface ResolveTourOrderOptions {
  /** 「最初に固定」した listing id。trayIds に無ければ無視。 */
  pinnedFirstId: string | null;
  /** 「最後に固定」した listing id。trayIds に無ければ無視。first と同一なら無視 (first 優先)。 */
  pinnedLastId: string | null;
  /** true = 手動並び替え済み (trayIds の現在順を維持)。false = 自動順 (orderTourStopIds)。 */
  manualOrder: boolean;
}

/**
 * ツアーの巡回順(=表示順=開始順)を確定する (ツアー順制御: ドラッグ並び替え + 最初/最後固定ピン)。
 *
 * - manualOrder=false (既定): pinned を除いた残りに既存の自動順 (orderTourStopIds) を適用し、
 *   [pinnedFirst, ...auto(middle), pinnedLast] を返す (従来の自動順+ピンの組み合わせ)。
 * - manualOrder=true: trayIds の現在順 (ドラッグ結果) を維持しつつ、pinned だけ先頭/末尾へ移動する。
 * - pinned id が trayIds に存在しない場合は無視する (削除済み等)。
 * - pinnedFirstId と pinnedLastId が同一 id の場合は first を優先し、last は無視する。
 */
export function resolveTourOrder(
  trayIds: string[],
  pool: MockListing[],
  opts: ResolveTourOrderOptions,
): string[] {
  const pinnedFirstId =
    opts.pinnedFirstId != null && trayIds.includes(opts.pinnedFirstId) ? opts.pinnedFirstId : null;
  const pinnedLastId =
    opts.pinnedLastId != null && opts.pinnedLastId !== pinnedFirstId && trayIds.includes(opts.pinnedLastId)
      ? opts.pinnedLastId
      : null;

  const middleIds = trayIds.filter((id) => id !== pinnedFirstId && id !== pinnedLastId);
  const orderedMiddle = opts.manualOrder ? middleIds : orderTourStopIds(middleIds, pool);

  return [
    ...(pinnedFirstId ? [pinnedFirstId] : []),
    ...orderedMiddle,
    ...(pinnedLastId ? [pinnedLastId] : []),
  ];
}
