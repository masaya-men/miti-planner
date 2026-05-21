// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HousingListing } from '../../../../types/housing';

const getGalleryListingsMock = vi.fn();
vi.mock('../../../../lib/housingListingsService', () => ({
  getGalleryListings: (...a: unknown[]) => getGalleryListingsMock(...a),
}));

import { useGalleryListings } from '../useGalleryListings';

const doc = (over: Partial<HousingListing>): HousingListing => ({
  id: 'x', ownerUid: 'u', dc: 'Materia', server: 'Bismarck',
  area: 'LavenderBeds', ward: 23, buildingType: 'house', plot: 6, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, updatedAt: 1,
  isHidden: false, reportCount: 0, deletedAt: null, ...over,
});

beforeEach(() => {
  getGalleryListingsMock.mockReset();
});

describe('useGalleryListings', () => {
  it('初期状態は loading', () => {
    getGalleryListingsMock.mockReturnValue(new Promise(() => {})); // 永久 pending
    const { result } = renderHook(() => useGalleryListings());
    expect(result.current.kind).toBe('loading');
  });

  it('取得成功で ready になり、変換不可レコードは除外される', async () => {
    getGalleryListingsMock.mockResolvedValueOnce([
      doc({ id: 'ok', dc: 'Materia', plot: 6, size: 'M' }),
      doc({ id: 'no-region', dc: 'UnknownDC' }),
      doc({ id: 'no-plot', plot: undefined }),
    ]);
    const { result } = renderHook(() => useGalleryListings());
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    if (result.current.kind !== 'ready') throw new Error('not ready');
    expect(result.current.listings.map((l) => l.id)).toEqual(['ok']);
    expect(result.current.listings[0].region).toBe('OCE');
  });

  it('取得失敗で error になる', async () => {
    getGalleryListingsMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useGalleryListings());
    await waitFor(() => expect(result.current.kind).toBe('error'));
    if (result.current.kind !== 'error') throw new Error('not error');
    expect(result.current.message).toBe('boom');
  });
});
