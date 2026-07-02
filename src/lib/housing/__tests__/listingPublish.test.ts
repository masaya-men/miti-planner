import { describe, it, expect } from 'vitest';
import { isEffectivelyPublic, mergeListingsForViewer } from '../listingPublish';
import type { MockListing } from '../../../data/housing/mockListings';

const base = (over: Partial<MockListing>): MockListing =>
  ({ id: 'x', ownerUid: 'o', dc: 'Elemental', server: 'Gaia', region: 'JP',
     area: 'Mist', ward: 1, imageMode: 'none', tags: [], createdAt: 0,
     lastConfirmedAt: 0, addressKey: 'k', ...over } as MockListing);

const NOW = 1000;

describe('isEffectivelyPublic', () => {
  it('visibility 未設定は公開扱い', () => {
    expect(isEffectivelyPublic({}, NOW)).toBe(true);
  });
  it('private は非公開', () => {
    expect(isEffectivelyPublic({ visibility: 'private' }, NOW)).toBe(false);
  });
  it('publishUntil が未来なら公開', () => {
    expect(isEffectivelyPublic({ visibility: 'public', publishUntil: NOW + 1 }, NOW)).toBe(true);
  });
  it('publishUntil が過去なら非公開 (遅延評価)', () => {
    expect(isEffectivelyPublic({ visibility: 'public', publishUntil: NOW - 1 }, NOW)).toBe(false);
  });
  it('publishUntil が null なら無期限公開', () => {
    expect(isEffectivelyPublic({ visibility: 'public', publishUntil: null }, NOW)).toBe(true);
  });
});

describe('mergeListingsForViewer', () => {
  it('公開のみ表示 (未ログイン・他人の非公開は除外)', () => {
    const pub = [base({ id: 'a' })];
    const merged = mergeListingsForViewer(pub, [], null, NOW);
    expect(merged.map((l) => l.id)).toEqual(['a']);
  });
  it('自分の非公開は自分には表示・dedup される', () => {
    const pub = [base({ id: 'a', ownerUid: 'other' })];
    const mine = [base({ id: 'b', ownerUid: 'me', visibility: 'private' }),
                  base({ id: 'a', ownerUid: 'other' })]; // 重複 id
    const merged = mergeListingsForViewer(pub, mine, 'me', NOW);
    expect(merged.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });
  it('他人の期限切れ public は除外 (myListings に無いので落ちる)', () => {
    const pub = [base({ id: 'c', ownerUid: 'other', visibility: 'public', publishUntil: NOW - 1 })];
    const merged = mergeListingsForViewer(pub, [], 'me', NOW);
    expect(merged).toEqual([]);
  });
});
