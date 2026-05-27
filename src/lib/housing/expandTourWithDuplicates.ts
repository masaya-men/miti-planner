/**
 * ツアー追加時に同 addressKey の不在 listing を冪等に追加する pure helper。
 *
 * - newListingId の addressKey と一致する他 listing で、 まだ tourListingIds に
 *   居ないものを「全部追加」 する
 * - addressKey が空 (= '') なら自動追加対象外、 本体だけ追加
 * - newListingId が allListings に存在しない場合は no-op (= 安全)
 * - 戻り値 nextIds は元の tourListingIds 順を維持して末尾に追加分を append
 * - autoAddedCount は newListingId 自身を除いた追加件数 (= トースト件数表示用)
 *
 * 設計書: docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.3
 */
import type { MockListing } from '../../data/housing/mockListings';

export interface ExpandTourResult {
  nextIds: string[];
  autoAddedCount: number;
}

export function expandTourWithDuplicates(
  tourListingIds: string[],
  newListingId: string,
  allListings: MockListing[],
): ExpandTourResult {
  const target = allListings.find((l) => l.id === newListingId);
  const existingSet = new Set(tourListingIds);

  // newListingId が allListings に存在しない場合は no-op
  if (!target) {
    return { nextIds: tourListingIds, autoAddedCount: 0 };
  }

  // addressKey が空: 本体だけ追加 (= 自動展開しない)
  if (!target.addressKey) {
    if (existingSet.has(newListingId)) {
      return { nextIds: tourListingIds, autoAddedCount: 0 };
    }
    return { nextIds: [...tourListingIds, newListingId], autoAddedCount: 0 };
  }

  // addressKey 一致の不在 listing を全部追加
  const peers = allListings.filter(
    (l) => l.addressKey === target.addressKey && !existingSet.has(l.id),
  );
  const peerIds = peers.map((p) => p.id);
  const nextIds = [...tourListingIds, ...peerIds];

  // autoAddedCount = 「自分以外」 の自動追加件数
  const autoAddedCount = Math.max(0, peerIds.length - (peerIds.includes(newListingId) ? 1 : 0));
  return { nextIds, autoAddedCount };
}
