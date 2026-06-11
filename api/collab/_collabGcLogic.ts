export interface GcRoomDoc { revoked?: boolean; createdAt?: number }

/**
 * revoked かつ createdAt が retentionDays より古い部屋だけ掃除対象。
 * createdAt 欠落は残す（安全側）。
 */
export function shouldGcRoom(room: GcRoomDoc, nowMs: number, retentionDays: number): boolean {
  if (room.revoked !== true) return false;
  if (typeof room.createdAt !== "number") return false;
  return room.createdAt < nowMs - retentionDays * 86_400_000;
}
