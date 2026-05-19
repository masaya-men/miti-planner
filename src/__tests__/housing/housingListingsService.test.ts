import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/firebase', () => ({ db: {} }));
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));

import {
  findListingsByAddressKey,
  findChambersInPlot,
  findHouseForChamber,
  findApartmentRoomsInWard,
} from '../../lib/housingListingsService';

const baseQuery = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane' as const,
  ward: 3,
};

beforeEach(() => {
  mockGetDocs.mockReset();
  mockQuery.mockReset();
  mockCollection.mockReset();
  mockWhere.mockReset();
  mockLimit.mockReset();
});

describe('findListingsByAddressKey', () => {
  it('addressKey で一致する listings を返す', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'l1', data: () => ({ ownerUid: 'u1', addressKey: 'k', dc: 'Mana', server: 'P', area: 'Shirogane', ward: 3, plot: 12, size: 'M', imageMode: 'none', tags: ['modern'], createdAt: 0, updatedAt: 0, isHidden: false, reportCount: 0 }) },
      ],
    });
    const results = await findListingsByAddressKey('k');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('l1');
    expect(mockWhere).toHaveBeenCalledWith('addressKey', '==', 'k');
    expect(mockWhere).toHaveBeenCalledWith('isHidden', '==', false);
  });
  it('一致なし→空配列', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const results = await findListingsByAddressKey('k');
    expect(results).toEqual([]);
  });
});

describe('findChambersInPlot', () => {
  it('指定 plot の FC 個室を返す', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'a', data: () => ({ roomKind: 'private_chamber', plot: 12, roomNumber: 2 }) },
        { id: 'b', data: () => ({ roomKind: 'private_chamber', plot: 12, roomNumber: 5 }) },
      ],
    });
    const r = await findChambersInPlot({ ...baseQuery, plot: 12 });
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('findHouseForChamber', () => {
  it('指定 plot の家全体を返す (= roomKind=undefined)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'house', data: () => ({ roomKind: undefined, plot: 12, buildingType: 'house' }) },
      ],
    });
    const r = await findHouseForChamber({ ...baseQuery, plot: 12 });
    expect(r?.id).toBe('house');
  });

  it('親家全体が未登録なら null', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const r = await findHouseForChamber({ ...baseQuery, plot: 12 });
    expect(r).toBeNull();
  });
});

describe('findApartmentRoomsInWard', () => {
  it('同 ward のアパ部屋を currentRoom 除いて返す', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'r7', data: () => ({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 7 }) },
        { id: 'r50', data: () => ({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 50 }) },
        { id: 'r42', data: () => ({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 42 }) },
      ],
    });
    const r = await findApartmentRoomsInWard({ ...baseQuery, currentRoomNumber: 42 });
    expect(r.map((x) => x.roomNumber)).toEqual([7, 50]);
  });
});
