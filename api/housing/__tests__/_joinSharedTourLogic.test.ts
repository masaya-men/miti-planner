import { describe, it, expect } from 'vitest';
import { isPresenceStale, shouldEnforceCap, SHARED_TOUR_PRESENCE_STALE_MS } from '../_joinSharedTourLogic.js';

describe('isPresenceStale', () => {
  it('lastSeenAt が未指定なら stale', () => {
    expect(isPresenceStale(undefined, 1_000_000)).toBe(true);
  });
  it('猶予内なら stale でない', () => {
    const now = 1_000_000;
    expect(isPresenceStale(now - SHARED_TOUR_PRESENCE_STALE_MS + 1, now)).toBe(false);
  });
  it('猶予ちょうど超過で stale', () => {
    const now = 1_000_000;
    expect(isPresenceStale(now - SHARED_TOUR_PRESENCE_STALE_MS, now)).toBe(true);
  });
});

describe('shouldEnforceCap', () => {
  it('isPresenceStale と同じ結果を返す(新規/失効セッションのみ上限チェック対象)', () => {
    const now = 1_000_000;
    expect(shouldEnforceCap(undefined, now)).toBe(true);
    expect(shouldEnforceCap(now - 1000, now)).toBe(false);
  });
});
