import type { MockListing } from '../../data/housing/mockListings';

/**
 * 一覧表示用の 2 段 sort:
 * - 各 addressKey の代表 (= 同住所内で lastConfirmedAt 最大の listing) を選び、
 *   その createdAt desc で住所グループの並びを決める
 * - 同 addressKey 内では lastConfirmedAt desc で並ぶ
 * - 同 lastConfirmedAt 内は createdAt desc で安定化
 *
 * 設計書 docs/.private/2026-05-27-housing-video-3frame-and-phase2.md §3.6
 *
 * Always returns a new array (does not mutate input).
 */
export function sortListingsForGallery<
    T extends Pick<MockListing, 'createdAt' | 'lastConfirmedAt' | 'addressKey'>,
>(listings: T[]): T[] {
    if (listings.length === 0) return [];

    const groups = new Map<string, T[]>();
    for (const l of listings) {
        const arr = groups.get(l.addressKey);
        if (arr) arr.push(l);
        else groups.set(l.addressKey, [l]);
    }

    for (const arr of groups.values()) {
        arr.sort(
            (a, b) =>
                b.lastConfirmedAt - a.lastConfirmedAt || b.createdAt - a.createdAt,
        );
    }

    const sortedGroups = Array.from(groups.values()).sort(
        (a, b) => b[0].createdAt - a[0].createdAt,
    );

    return sortedGroups.flat();
}
