import { describe, it, expect } from 'vitest';
import {
  isEffectivelyPublic,
  mergeListingsForViewer,
  isAddressHidden,
  canDisplayAddress,
  canDisplayFullAddress,
  isNewListing,
  NEW_LISTING_WINDOW_MS,
} from '../listingPublish';
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

describe('isNewListing', () => {
  it('投稿直後は true', () => {
    expect(isNewListing(NOW, NOW)).toBe(true);
  });
  it('7日未満はtrue', () => {
    expect(isNewListing(NOW, NOW + NEW_LISTING_WINDOW_MS - 1)).toBe(true);
  });
  it('ちょうど7日経過はfalse', () => {
    expect(isNewListing(NOW, NOW + NEW_LISTING_WINDOW_MS)).toBe(false);
  });
  it('7日以上前の投稿はfalse', () => {
    expect(isNewListing(NOW, NOW + NEW_LISTING_WINDOW_MS + 1)).toBe(false);
  });

  it('windowMsを明示指定すればその日数で判定する (管理画面の設定値を渡す想定)', () => {
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    expect(isNewListing(NOW, NOW + threeDays - 1, threeDays)).toBe(true);
    expect(isNewListing(NOW, NOW + threeDays, threeDays)).toBe(false);
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

describe('isAddressHidden (P3 §3.5)', () => {
  it('unlisted は true', () => {
    expect(isAddressHidden({ visibility: 'unlisted' })).toBe(true);
  });
  it('public / private / 未設定は false', () => {
    expect(isAddressHidden({ visibility: 'public' })).toBe(false);
    expect(isAddressHidden({ visibility: 'private' })).toBe(false);
    expect(isAddressHidden({})).toBe(false);
  });
});

describe('canDisplayAddress / canDisplayFullAddress (P3 §3.5 型ガード)', () => {
  it('area/ward がある通常の listing は true', () => {
    const l = base({});
    expect(canDisplayAddress(l)).toBe(true);
    expect(canDisplayFullAddress(l)).toBe(true);
  });
  it('unlisted (area/ward/dc/server/region が undefined) は false', () => {
    const l = { ...base({}), visibility: 'unlisted' as const, area: undefined, ward: undefined, dc: undefined, server: undefined, region: undefined, addressKey: undefined };
    expect(canDisplayAddress(l)).toBe(false);
    expect(canDisplayFullAddress(l)).toBe(false);
  });
  it('area/ward はあるが dc/server/region が欠けている場合 canDisplayAddress は true・canDisplayFullAddress は false', () => {
    const l = { ...base({}), dc: undefined, server: undefined, region: undefined };
    expect(canDisplayAddress(l)).toBe(true);
    expect(canDisplayFullAddress(l)).toBe(false);
  });
});

import { isEligibleForOgRepresentative } from '../listingPublish';

describe('isEligibleForOgRepresentative', () => {
  const now = 1_700_000_000_000;
  it('visibility=public かつ期限内なら true', () => {
    expect(isEligibleForOgRepresentative({ visibility: 'public' }, now)).toBe(true);
  });
  it('visibility=unlisted(住所非公開)は false', () => {
    expect(isEligibleForOgRepresentative({ visibility: 'unlisted' }, now)).toBe(false);
  });
  it('visibility=private は false', () => {
    expect(isEligibleForOgRepresentative({ visibility: 'private' }, now)).toBe(false);
  });
  it('visibility=public でも publishUntil 経過済みなら false', () => {
    expect(isEligibleForOgRepresentative({ visibility: 'public', publishUntil: now - 1000 }, now)).toBe(false);
  });
  it('visibility未設定はfalse(publicを明示していない限り選択不可)', () => {
    expect(isEligibleForOgRepresentative({}, now)).toBe(false);
  });
});
