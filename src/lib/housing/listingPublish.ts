import type { MockListing } from '../../data/housing/mockListings';

/**
 * 表示時点で「実質公開中」かを判定する遅延評価 (spec A-1)。
 * visibility 未設定 doc は公開扱い (バックフィル前の保険)。
 * publishUntil を過ぎていたら公開扱いしない。now は呼び出し側が渡す (閲覧端末の時計)。
 */
export function isEffectivelyPublic(
  listing: { visibility?: 'public' | 'unlisted' | 'private'; publishUntil?: number | null },
  nowMs: number,
): boolean {
  if (listing.visibility === 'private') return false;
  if (listing.publishUntil != null && listing.publishUntil <= nowMs) return false;
  return true;
}

/**
 * 一覧表示用に「公開クエリの結果」と「自分の登録クエリの結果」を合流する (spec A-3)。
 * - 公開クエリ結果からは他人の期限切れ (実質非公開) を除外する。
 * - 自分の登録は visibility/期限に関係なく全て残す (本人はバッジ付きで見える)。
 * - id で dedup (自分の公開物件が両クエリに出るため)。
 */
export function mergeListingsForViewer(
  publicListings: MockListing[],
  myListings: MockListing[],
  viewerUid: string | null,
  nowMs: number,
): MockListing[] {
  const byId = new Map<string, MockListing>();
  for (const l of publicListings) {
    if (l.ownerUid === viewerUid || isEffectivelyPublic(l, nowMs)) byId.set(l.id, l);
  }
  for (const l of myListings) {
    if (l.ownerUid === viewerUid) byId.set(l.id, l);
  }
  return Array.from(byId.values());
}
