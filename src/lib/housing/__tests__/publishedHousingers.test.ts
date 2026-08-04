import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase', () => ({
  db: {},
}));

const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));

import { listPublishedHousingers, stripLeadingSymbolsForSort } from '../publishedHousingers';

const PROFILE = {
  displayName: 'yuura',
  displayNameLower: 'yuura',
  avatarUrl: null,
  bio: null,
  snsUrl: null,
  isPublished: true,
  isModerationHidden: false,
  reportCount: 0,
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(() => {
  mockCollection.mockReset();
  mockQuery.mockReset();
  mockWhere.mockReset();
  mockOrderBy.mockReset();
  mockLimit.mockReset();
  mockGetDocs.mockReset();
});

describe('listPublishedHousingers', () => {
  it('isPublished==true かつ isModerationHidden==false を displayNameLower 昇順・既定500件でクエリする', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'hashed:taro', data: () => ({ ...PROFILE, displayName: 'taro', displayNameLower: 'taro' }) },
        { id: 'hashed:hanako', data: () => ({ ...PROFILE, displayName: 'hanako', displayNameLower: 'hanako' }) },
      ],
    });
    const r = await listPublishedHousingers();
    expect(r.map((h) => h.uid)).toEqual(['hashed:hanako', 'hashed:taro']);
    expect(mockWhere).toHaveBeenCalledWith('isPublished', '==', true);
    expect(mockWhere).toHaveBeenCalledWith('isModerationHidden', '==', false);
    expect(mockOrderBy).toHaveBeenCalledWith('displayNameLower');
    expect(mockLimit).toHaveBeenCalledWith(500);
  });

  it('各要素に uid (doc ID) が含まれる', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'hashed:abc', data: () => PROFILE }],
    });
    const r = await listPublishedHousingers();
    expect(r[0].uid).toBe('hashed:abc');
    expect(r[0].displayName).toBe('yuura');
  });

  it('max を指定するとその件数でクエリする', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await listPublishedHousingers(50);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('0件なら空配列', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const r = await listPublishedHousingers();
    expect(r).toEqual([]);
  });

  it('例外時は空配列に丸める', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('permission-denied'));
    const r = await listPublishedHousingers();
    expect(r).toEqual([]);
  });

  it('先頭記号を無視して並び替える', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'hashed:e', data: () => ({ ...PROFILE, displayName: '#Ephemeral_studio', displayNameLower: '#ephemeral_studio' }) },
        { id: 'hashed:a', data: () => ({ ...PROFILE, displayName: 'Ayase', displayNameLower: 'ayase' }) },
        { id: 'hashed:z', data: () => ({ ...PROFILE, displayName: 'Zebra', displayNameLower: 'zebra' }) },
      ],
    });
    const r = await listPublishedHousingers();
    expect(r.map((h) => h.uid)).toEqual(['hashed:a', 'hashed:e', 'hashed:z']);
  });
});

describe('stripLeadingSymbolsForSort', () => {
  it('先頭の記号・アンダースコアを取り除く', () => {
    expect(stripLeadingSymbolsForSort('#ephemeral_studio')).toBe('ephemeral_studio');
    expect(stripLeadingSymbolsForSort('__foo')).toBe('foo');
  });

  it('先頭が既に文字・数字ならそのまま', () => {
    expect(stripLeadingSymbolsForSort('ayase')).toBe('ayase');
  });

  it('記号のみで全て取り除かれる場合は元の文字列にフォールバックする', () => {
    expect(stripLeadingSymbolsForSort('###')).toBe('###');
  });
});
