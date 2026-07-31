import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase', () => ({
  db: {},
}));

const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => mockDoc(...a),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));

import { getPersonalTagById, listAllPersonalTags, stripLeadingSymbolsForSort } from '../personalTagLookup';
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
  mockCollection.mockReset();
  mockQuery.mockReset();
  mockWhere.mockReset();
  mockOrderBy.mockReset();
  mockLimit.mockReset();
  mockGetDocs.mockReset();
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

describe('listAllPersonalTags', () => {
  it('isHidden==false を displayNameLower 昇順・既定500件でクエリする', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ ...TAG, id: 'personal_taro', displayName: 'taro' }) },
        { data: () => ({ ...TAG, id: 'personal_hanako', displayName: 'hanako' }) },
      ],
    });
    const r = await listAllPersonalTags();
    expect(r.map((t) => t.id)).toEqual(['personal_taro', 'personal_hanako']);
    expect(mockWhere).toHaveBeenCalledWith('isHidden', '==', false);
    expect(mockOrderBy).toHaveBeenCalledWith('displayNameLower');
    expect(mockLimit).toHaveBeenCalledWith(500);
  });

  it('max を指定するとその件数でクエリする', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await listAllPersonalTags(50);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('0件なら空配列', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const r = await listAllPersonalTags();
    expect(r).toEqual([]);
  });

  it('先頭記号を無視して並び替える (# 始まりの名前が記号を無視した位置に来る)', async () => {
    // Firestore の orderBy('displayNameLower') は生のコードポイント比較なので、
    // 記号始まりの名前 (# は 'a' よりコードポイントが小さい) が実際には先頭で返ってくる。
    // クライアント側の再ソートでこれが是正され、 'E' の並び (Ayase と Zebra の間) に来ることを検証する。
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ ...TAG, id: 'personal_ephemeral', displayName: '#Ephemeral_studio', displayNameLower: '#ephemeral_studio' }) },
        { data: () => ({ ...TAG, id: 'personal_ayase', displayName: 'Ayase', displayNameLower: 'ayase' }) },
        { data: () => ({ ...TAG, id: 'personal_zebra', displayName: 'Zebra', displayNameLower: 'zebra' }) },
      ],
    });
    const r = await listAllPersonalTags();
    expect(r.map((t) => t.id)).toEqual(['personal_ayase', 'personal_ephemeral', 'personal_zebra']);
  });

  it('英数字 → ひらがなの順序 (Ayase → かずタマ) が壊れていないこと', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ ...TAG, id: 'personal_kazutama', displayName: 'かずタマ', displayNameLower: 'かずタマ' }) },
        { data: () => ({ ...TAG, id: 'personal_ayase', displayName: 'Ayase', displayNameLower: 'ayase' }) },
      ],
    });
    const r = await listAllPersonalTags();
    expect(r.map((t) => t.id)).toEqual(['personal_ayase', 'personal_kazutama']);
  });
});

describe('stripLeadingSymbolsForSort', () => {
  it('先頭の記号・アンダースコアを取り除く', () => {
    expect(stripLeadingSymbolsForSort('#ephemeral_studio')).toBe('ephemeral_studio');
    expect(stripLeadingSymbolsForSort('__foo')).toBe('foo');
  });

  it('先頭が既に文字・数字ならそのまま', () => {
    expect(stripLeadingSymbolsForSort('ayase')).toBe('ayase');
    expect(stripLeadingSymbolsForSort('かずタマ')).toBe('かずタマ');
    expect(stripLeadingSymbolsForSort('5abc')).toBe('5abc');
  });

  it('記号のみで全て取り除かれる場合は元の文字列にフォールバックする', () => {
    expect(stripLeadingSymbolsForSort('###')).toBe('###');
  });
});
