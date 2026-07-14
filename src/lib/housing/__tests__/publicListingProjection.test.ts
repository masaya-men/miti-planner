import { describe, it, expect } from 'vitest';
import { projectPublicListing, ADDRESS_FIELDS } from '../publicListingProjection';

const rawPublic = {
  ownerUid: 'u1', visibility: 'public',
  dc: 'Mana', server: 'Anima', area: 'Shirogane', ward: 5, plot: 12, size: 'M',
  apartmentBuilding: undefined, roomNumber: undefined, addressKey: 'Mana|Anima|Shirogane|W5|H12',
  buildingType: 'house', imageMode: 'thumbnail', thumbnailPaths: ['/a.avif'],
  tags: ['wafu'], title: '和風邸', description: 'desc', createdAt: 100, lastConfirmedAt: 100,
  postUrl: 'https://x.com/a/status/1', tweetId: '1',
  isHidden: false, deletedAt: null, reportCount: 3, restoreCount: 2, updatedAt: 999, // ← 未許可 (漏らさない)
};

const rawUnlisted = { ...rawPublic, visibility: 'unlisted' };

describe('projectPublicListing (許可リスト方式)', () => {
  it('public は住所系フィールドを含む', () => {
    const out = projectPublicListing('id1', rawPublic);
    expect(out.dc).toBe('Mana');
    expect(out.addressKey).toBe('Mana|Anima|Shirogane|W5|H12');
    expect(out.plot).toBe(12);
    expect(out.size).toBe('M');
    expect(out.title).toBe('和風邸');
    expect(out.id).toBe('id1');
    expect(out.visibility).toBe('public');
  });

  it('★ unlisted は住所系フィールドを 1 つも含まない (射影バグ再発防止)', () => {
    const out = projectPublicListing('id2', rawUnlisted);
    for (const f of ADDRESS_FIELDS) {
      expect(out, `unlisted must not expose ${f}`).not.toHaveProperty(f);
    }
    // 画像/タイトル等の安全フィールドは残る
    expect(out.title).toBe('和風邸');
    expect(out.thumbnailPaths).toEqual(['/a.avif']);
    expect(out.visibility).toBe('unlisted');
  });

  it('許可リスト外のフィールド (reportCount / restoreCount / updatedAt) は public でも漏らさない', () => {
    const out = projectPublicListing('id3', rawPublic);
    expect(out).not.toHaveProperty('reportCount');
    expect(out).not.toHaveProperty('restoreCount');
    expect(out).not.toHaveProperty('updatedAt');
  });

  it('窓口は可視 doc のみ返す前提で isHidden=false / deletedAt=null を固定注入する', () => {
    const out = projectPublicListing('id4', rawPublic);
    expect(out.isHidden).toBe(false);
    expect(out.deletedAt).toBeNull();
  });

  it('tags 欠損は空配列', () => {
    const out = projectPublicListing('id5', { ...rawPublic, tags: undefined });
    expect(out.tags).toEqual([]);
  });
});
