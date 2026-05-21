import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HousingListing } from '../../types/housing';

const getGalleryListingsMock = vi.fn();
vi.mock('../../lib/housingListingsService', () => ({
  getGalleryListings: (...a: unknown[]) => getGalleryListingsMock(...a),
}));

import { useHousingListingsStore } from '../useHousingListingsStore';

const doc = (over: Partial<HousingListing>): HousingListing => ({
  id: 'x', ownerUid: 'u', dc: 'Materia', server: 'Bismarck',
  area: 'LavenderBeds', ward: 23, buildingType: 'house', plot: 6, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, updatedAt: 1,
  isHidden: false, reportCount: 0, deletedAt: null, ...over,
});

beforeEach(() => {
  getGalleryListingsMock.mockReset();
  useHousingListingsStore.getState().reset();
});

describe('useHousingListingsStore', () => {
  it('初期状態は idle / listings 空', () => {
    const s = useHousingListingsStore.getState();
    expect(s.status).toBe('idle');
    expect(s.listings).toEqual([]);
  });

  it('load で fetch→アダプタ変換し ready になる (変換不可は除外)', async () => {
    getGalleryListingsMock.mockResolvedValueOnce([
      doc({ id: 'ok', dc: 'Materia', plot: 6, size: 'M' }),
      doc({ id: 'no-region', dc: 'UnknownDC' }),
    ]);
    await useHousingListingsStore.getState().load();
    const s = useHousingListingsStore.getState();
    expect(s.status).toBe('ready');
    expect(s.listings.map((l) => l.id)).toEqual(['ok']);
    expect(s.listings[0].region).toBe('OCE');
  });

  it('load 失敗で error になる', async () => {
    getGalleryListingsMock.mockRejectedValueOnce(new Error('boom'));
    await useHousingListingsStore.getState().load();
    const s = useHousingListingsStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('boom');
  });

  it('ready 済みなら load は再 fetch しない (冪等)', async () => {
    getGalleryListingsMock.mockResolvedValue([doc({ id: 'a' })]);
    await useHousingListingsStore.getState().load();
    await useHousingListingsStore.getState().load();
    expect(getGalleryListingsMock).toHaveBeenCalledTimes(1);
  });
});
