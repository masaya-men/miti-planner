import { SHARED_TOUR_MAX_STOPS, type TourSnapshot } from '../../src/types/sharedTour.js';
import { snapshotContainsHiddenAddress } from '../../src/lib/sharedTour/snapshot.js';

/** スナップショット JSON のバイト上限（Firestore ドキュメント 1MiB 制限の安全マージン。他フィールド分を残す）。 */
export const SHARED_TOUR_MAX_BYTES = 900_000;

/** 1ホストあたりの同時 live ツアー数上限（原則1件）。 */
export const SHARED_TOUR_MAX_LIVE_PER_HOST = 1;

/** GC 失敗・濫用時の backstop。これ以上保有しているホストは発行そのものを拒否する。 */
export const SHARED_TOUR_HOST_HARD_CAP = 10;

/** 招待発行リクエストの検証結果。 */
export type ParseCreateSharedTourResult =
  | { ok: true; snapshot: TourSnapshot[]; containsHiddenAddress: boolean }
  | { ok: false; reason: 'empty' | 'too_many' | 'bad_shape' | 'too_large' };

/**
 * create-shared-tour のリクエスト body を検証する純関数。
 * 検証順序: bad_shape (形) → empty (0件) → too_many (上限超過) → 要素形状 (id) → too_large (バイト上限) → ok。
 */
export function parseCreateSharedTourRequest(body: unknown): ParseCreateSharedTourResult {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { snapshot?: unknown }).snapshot)) {
    return { ok: false, reason: 'bad_shape' };
  }

  const snapshot = (body as { snapshot: unknown[] }).snapshot;

  if (snapshot.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  if (snapshot.length > SHARED_TOUR_MAX_STOPS) {
    return { ok: false, reason: 'too_many' };
  }

  const isValidElement = snapshot.every(
    (item) => typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string',
  );
  if (!isValidElement) {
    return { ok: false, reason: 'bad_shape' };
  }

  if (JSON.stringify(snapshot).length > SHARED_TOUR_MAX_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  const typedSnapshot = snapshot as TourSnapshot[];
  return {
    ok: true,
    snapshot: typedSnapshot,
    containsHiddenAddress: snapshotContainsHiddenAddress(typedSnapshot),
  };
}

/**
 * ホストの現在の live ツアー保有数から、発行を許可するかを判定する純関数。
 * - reject: ハードキャップ以上保有（GC 失敗/濫用の backstop・発行拒否）
 * - evict : 通常上限以上保有（既存の live を ended にしてから新規発行）
 * - ok    : 上限未満（そのまま発行）
 */
export function resolveHostQuota(existingCount: number, max: number): 'ok' | 'evict' | 'reject' {
  if (existingCount >= SHARED_TOUR_HOST_HARD_CAP) return 'reject';
  if (existingCount >= max) return 'evict';
  return 'ok';
}
