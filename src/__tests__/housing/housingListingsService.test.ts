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

import { findListingsByAddressKey } from '../../lib/housingListingsService';

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
