/** 参加者の presence(heartbeat) を「有効」とみなす猶予(90秒)。60秒間隔heartbeatの1回欠落を許容。 */
export const SHARED_TOUR_PRESENCE_STALE_MS = 90_000;

/** 直近の heartbeat から猶予を超えて経過している(=失効/未参加)か。 */
export function isPresenceStale(lastSeenAt: number | undefined, nowMs: number): boolean {
  return lastSeenAt === undefined || nowMs - lastSeenAt >= SHARED_TOUR_PRESENCE_STALE_MS;
}

/**
 * 参加上限チェックが必要か。既存セッションが有効(heartbeat継続中)ならチェック不要
 * (自分自身は既に集計に含まれているため、上限ちょうどでも弾かれてはいけない)。
 * 新規/失効セッションのみ上限チェック対象。
 */
export function shouldEnforceCap(existingLastSeenAt: number | undefined, nowMs: number): boolean {
  return isPresenceStale(existingLastSeenAt, nowMs);
}
