import { isEffectivelyPublic } from './listingPublish';

/**
 * 物件を閲覧者 (viewer) に表示してよいかの判定 (純粋関数)。
 *
 * - `deletedAt` があれば誰にも表示しない (削除済み)
 * - `isHidden` (通報 3 件で自動非表示) は **家主のみ**表示可。
 *   家主は通知から開いて編集 / 異議 / 削除で対処する必要があるため、
 *   自分の物件は非表示でも開けなければならない (= 通報フローの目的)。
 * - 他人の物件は「実質公開中」(visibility=private でない かつ publishUntil 未経過) でなければ表示不可。
 *   期限切れの public も他人には隠す (spec A-1 の遅延評価を詳細ページにも適用)。
 * - それ以外は表示可
 */
export interface ListingVisibilityInput {
  deletedAt?: number | null;
  isHidden?: boolean;
  ownerUid?: string;
  visibility?: 'public' | 'private';
  publishUntil?: number | null;
}

export function canViewListing(
  listing: ListingVisibilityInput,
  viewerUid: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (listing.deletedAt) return false;
  if (listing.isHidden && listing.ownerUid !== viewerUid) return false;
  const isOwner = listing.ownerUid === viewerUid;
  if (!isOwner && !isEffectivelyPublic(listing, nowMs)) return false;
  return true;
}
