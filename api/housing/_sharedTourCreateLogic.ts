import { SHARED_TOUR_MAX_STOPS, type TourSnapshot } from '../../src/types/sharedTour.js';
import { snapshotContainsHiddenAddress } from '../../src/lib/sharedTour/snapshot.js';

/** 招待発行リクエストの検証結果。 */
export type ParseCreateSharedTourResult =
  | { ok: true; snapshot: TourSnapshot[]; containsHiddenAddress: boolean }
  | { ok: false; reason: 'empty' | 'too_many' | 'bad_shape' };

/**
 * create-shared-tour のリクエスト body を検証する純関数。
 * 検証順序: bad_shape (形) → empty (0件) → too_many (上限超過) → 要素形状 (id) → ok。
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

  const typedSnapshot = snapshot as TourSnapshot[];
  return {
    ok: true,
    snapshot: typedSnapshot,
    containsHiddenAddress: snapshotContainsHiddenAddress(typedSnapshot),
  };
}
