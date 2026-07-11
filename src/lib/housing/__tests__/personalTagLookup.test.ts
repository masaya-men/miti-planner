import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase', () => ({
  db: {},
}));

const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => mockDoc(...a),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
}));

import { getPersonalTagById } from '../personalTagLookup';
import type { PersonalTag } from '../../../types/housing';

const TAG: PersonalTag = {
  id: 'personal_abc123',
  displayName: 'yuura',
  displayNameLower: 'yuura',
  ownerUid: 'u1',
  createdAt: 0,
  reportCount: 0,
  isHidden: false,
};

beforeEach(() => {
  mockDoc.mockReset();
  mockGetDoc.mockReset();
});

describe('getPersonalTagById', () => {
  it('存在すればタグを返す (探すページの個人タグ絞り込みリンク用、 spec §3.3 契約4)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => TAG });
    const r = await getPersonalTagById('personal_abc123');
    expect(r).toEqual(TAG);
    expect(mockDoc).toHaveBeenCalledWith({}, 'personal_tags', 'personal_abc123');
  });

  it('ドキュメント不存在なら null', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const r = await getPersonalTagById('nope');
    expect(r).toBeNull();
  });

  it('rules 拒否等の例外 (非公開タグ等) も null に丸める', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('permission-denied'));
    const r = await getPersonalTagById('hidden-tag');
    expect(r).toBeNull();
  });
});
