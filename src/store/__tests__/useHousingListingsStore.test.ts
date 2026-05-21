import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HousingListing } from '../../types/housing';

const getGalleryListingsMock = vi.fn();
const getListingByIdMock = vi.fn();
vi.mock('../../lib/housingListingsService', () => ({
  getGalleryListings: (...a: unknown[]) => getGalleryListingsMock(...a),
  getListingById: (...a: unknown[]) => getListingByIdMock(...a),
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
  getListingByIdMock.mockReset();
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

  it('fetchAndUpsert: id で 1 件取得→変換し listings に追加 (登録直後の即反映)', async () => {
    getListingByIdMock.mockResolvedValueOnce(doc({ id: 'new1', dc: 'Materia', plot: 6, size: 'M' }));
    await useHousingListingsStore.getState().fetchAndUpsert('new1');
    const s = useHousingListingsStore.getState();
    expect(s.listings.map((l) => l.id)).toContain('new1');
    expect(getListingByIdMock).toHaveBeenCalledWith('new1');
  });

  it('fetchAndUpsert: 取得できない (null) なら listings は変わらない', async () => {
    getListingByIdMock.mockResolvedValueOnce(null);
    await useHousingListingsStore.getState().fetchAndUpsert('missing');
    expect(useHousingListingsStore.getState().listings).toEqual([]);
  });

  it('fetchAndUpsert: 取得失敗してもクラッシュせず握りつぶす (登録自体は成功済み)', async () => {
    getListingByIdMock.mockRejectedValueOnce(new Error('net'));
    await expect(
      useHousingListingsStore.getState().fetchAndUpsert('x'),
    ).resolves.toBeUndefined();
    expect(useHousingListingsStore.getState().listings).toEqual([]);
  });
});
