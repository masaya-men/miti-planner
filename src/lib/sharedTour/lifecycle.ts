import type { SharedTourLiveState, SharedTourMeta } from '../../types/sharedTour.js';

/** 無操作とみなす閾値（2時間）。この時間 lastActivityAt が更新されないと expired 扱い */
export const SHARED_TOUR_IDLE_MS = 2 * 60 * 60 * 1000;

/** expired から物理削除までの猶予（6時間）。ended 直後でも参加者が結果画面を見る時間を残す */
export const SHARED_TOUR_GC_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * ツアーが期限切れ（expired）かどうかを判定する純関数。
 * - status が 'ended' なら即 true（ホストが明示的に終了した）
 * - それ以外は最終活動からの経過時間が SHARED_TOUR_IDLE_MS を超えたら true（無操作タイムアウト）
 */
export function isTourExpired(
  live: Pick<SharedTourLiveState, 'status' | 'lastActivityAt'>,
  nowMs: number,
): boolean {
  if (live.status === 'ended') return true;
  return nowMs - live.lastActivityAt > SHARED_TOUR_IDLE_MS;
}

/**
 * 共有ツアーを物理削除（GC）してよいかを判定する純関数。
 * - live doc が存在しない（null）＝孤児メタのため即 GC 対象
 * - live doc がある場合は「期限切れ」かつ「最終活動から GC 猶予を超えている」場合のみ GC 対象
 */
export function shouldGcSharedTour(
  // _meta: 現ロジックでは未使用だがインターフェース仕様どおりの引数（将来 createdAt 起点の判定を足す余地を残す）
  _meta: Pick<SharedTourMeta, 'createdAt'>,
  live: Pick<SharedTourLiveState, 'status' | 'lastActivityAt'> | null,
  nowMs: number,
): boolean {
  if (live === null) return true;
  return isTourExpired(live, nowMs) && nowMs - live.lastActivityAt > SHARED_TOUR_GC_GRACE_MS;
}
