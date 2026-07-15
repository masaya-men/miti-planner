import { describe, it, expect } from 'vitest';
import {
  isTourExpired,
  shouldGcSharedTour,
  SHARED_TOUR_IDLE_MS,
  SHARED_TOUR_GC_GRACE_MS,
} from '../lifecycle';

describe('isTourExpired', () => {
  it('ended は即 true', () => {
    expect(isTourExpired({ status: 'ended', lastActivityAt: 0 }, 0)).toBe(true);
  });
  it('2時間無操作で true', () => {
    expect(isTourExpired({ status: 'live', lastActivityAt: 0 }, SHARED_TOUR_IDLE_MS + 1)).toBe(true);
    expect(isTourExpired({ status: 'live', lastActivityAt: 0 }, SHARED_TOUR_IDLE_MS - 1)).toBe(false);
  });
});

describe('shouldGcSharedTour', () => {
  it('live doc 欠落は GC 対象', () => {
    expect(shouldGcSharedTour({ createdAt: 0 }, null, 0)).toBe(true);
  });
  it('ended でも猶予内は GC しない / 猶予超で GC', () => {
    expect(shouldGcSharedTour({ createdAt: 0 }, { status: 'ended', lastActivityAt: 0 }, SHARED_TOUR_GC_GRACE_MS - 1)).toBe(false);
    expect(shouldGcSharedTour({ createdAt: 0 }, { status: 'ended', lastActivityAt: 0 }, SHARED_TOUR_GC_GRACE_MS + 1)).toBe(true);
  });
  it('live で期限切れ+猶予超は GC', () => {
    expect(shouldGcSharedTour({ createdAt: 0 }, { status: 'live', lastActivityAt: 0 }, SHARED_TOUR_GC_GRACE_MS + 1)).toBe(true);
  });
  it('live で活動中(期限内)は GC しない', () => {
    expect(shouldGcSharedTour({ createdAt: 0 }, { status: 'live', lastActivityAt: 0 }, SHARED_TOUR_IDLE_MS - 1)).toBe(false);
  });
});
