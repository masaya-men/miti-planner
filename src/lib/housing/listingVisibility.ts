/**
 * 物件を閲覧者 (viewer) に表示してよいかの判定 (純粋関数)。
 *
 * - `deletedAt` があれば誰にも表示しない (削除済み)
 * - `isHidden` (通報 3 件で自動非表示) は **家主のみ**表示可。
 *   家主は通知から開いて編集 / 異議 / 削除で対処する必要があるため、
 *   自分の物件は非表示でも開けなければならない (= 通報フローの目的)。
 * - それ以外は表示可
 */
export interface ListingVisibilityInput {
  deletedAt?: number | null;
  isHidden?: boolean;
  ownerUid?: string;
}

export function canViewListing(
  listing: ListingVisibilityInput,
  viewerUid: string | null,
): boolean {
  if (listing.deletedAt) return false;
  if (listing.isHidden && listing.ownerUid !== viewerUid) return false;
  return true;
}
