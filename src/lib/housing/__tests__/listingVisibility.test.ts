import { describe, it, expect } from 'vitest';
import { canViewListing } from '../listingVisibility';

describe('canViewListing', () => {
  const owner = 'owner-uid';
  const other = 'other-uid';

  it('通常物件は誰でも表示可', () => {
    expect(canViewListing({ ownerUid: owner }, other)).toBe(true);
    expect(canViewListing({ ownerUid: owner }, null)).toBe(true);
  });

  it('削除済みは家主でも表示不可', () => {
    expect(canViewListing({ ownerUid: owner, deletedAt: Date.now() }, owner)).toBe(false);
  });

  it('非表示 (通報自動非表示) は家主のみ表示可', () => {
    expect(canViewListing({ ownerUid: owner, isHidden: true }, owner)).toBe(true);
  });

  it('非表示は家主以外には表示不可', () => {
    expect(canViewListing({ ownerUid: owner, isHidden: true }, other)).toBe(false);
    expect(canViewListing({ ownerUid: owner, isHidden: true }, null)).toBe(false);
  });

  it('削除済みは非表示判定より優先 (家主でも不可)', () => {
    expect(
      canViewListing({ ownerUid: owner, isHidden: true, deletedAt: Date.now() }, owner),
    ).toBe(false);
  });
});
