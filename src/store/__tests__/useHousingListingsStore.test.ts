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
  lastConfirmedAt: 1, isHidden: false, reportCount: 0, deletedAt: null, ...over,
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

  it('load: 同住所複数 listing は lastConfirmedAt desc、 別住所は createdAt desc で並ぶ', async () => {
    getGalleryListingsMock.mockResolvedValueOnce([
      // addr-X (代表 createdAt=300, lastConfirmedAt=800)
      doc({ id: 'x1', addressKey: 'addr-X', createdAt: 300, lastConfirmedAt: 800, plot: 6, size: 'M' }),
      doc({ id: 'x2', addressKey: 'addr-X', createdAt: 250, lastConfirmedAt: 400, plot: 6, size: 'M' }),
      // addr-Y (代表 createdAt=500)
      doc({ id: 'y1', addressKey: 'addr-Y', createdAt: 500, lastConfirmedAt: 600, plot: 7, size: 'M' }),
    ]);
    await useHousingListingsStore.getState().load();
    const ids = useHousingListingsStore.getState().listings.map((l) => l.id);
    // addr-Y (createdAt=500) → addr-X (createdAt=300 で x1, x2 順)
    expect(ids).toEqual(['y1', 'x1', 'x2']);
  });

  it('upsert: 別住所に古い listing を追加すると sort 後は後ろに来る (= 先頭追加では失敗するケース)', async () => {
    getGalleryListingsMock.mockResolvedValueOnce([
      doc({ id: 'newer', addressKey: 'addr-A', createdAt: 500, lastConfirmedAt: 500, plot: 6, size: 'M' }),
    ]);
    await useHousingListingsStore.getState().load();

    const older = {
      ...useHousingListingsStore.getState().listings[0],
      id: 'older',
      addressKey: 'addr-B',
      createdAt: 100,
      lastConfirmedAt: 100,
    };
    useHousingListingsStore.getState().upsert(older);

    // 現状の「先頭追加」 では [older, newer] になるが、 sort 適用後は createdAt desc で [newer, older]
    const ids = useHousingListingsStore.getState().listings.map((l) => l.id);
    expect(ids).toEqual(['newer', 'older']);
  });

  it('upsert: 同住所への新規追加で lastConfirmedAt が既存より低いと後ろに挿入される', async () => {
    getGalleryListingsMock.mockResolvedValueOnce([
      doc({ id: 'recent_confirm', addressKey: 'same', createdAt: 100, lastConfirmedAt: 900, plot: 6, size: 'M' }),
    ]);
    await useHousingListingsStore.getState().load();

    const olderConfirm = {
      ...useHousingListingsStore.getState().listings[0],
      id: 'older_confirm',
      addressKey: 'same',
      createdAt: 200, // createdAt は新しいが
      lastConfirmedAt: 100, // lastConfirmedAt が低い
    };
    useHousingListingsStore.getState().upsert(olderConfirm);

    // 同住所内では lastConfirmedAt desc → recent_confirm (900) が先、 older_confirm (100) が後
    // 現状の「先頭追加」 では [older_confirm, recent_confirm] になるが、 sort 適用後は逆転
    const ids = useHousingListingsStore.getState().listings.map((l) => l.id);
    expect(ids).toEqual(['recent_confirm', 'older_confirm']);
  });
});
