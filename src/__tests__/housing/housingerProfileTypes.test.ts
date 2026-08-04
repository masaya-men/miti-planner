import { describe, it, expect } from 'vitest';
import type { HousingerProfile } from '../../types/housing';

describe('HousingerProfile型', () => {
  it('ogRepresentativeListingIds/avatarPngUrlを省略してもコンパイルできる(既存データ互換)', () => {
    const legacy: HousingerProfile = {
      displayName: 'テスト',
      displayNameLower: 'テスト',
      avatarUrl: null,
      bio: null,
      snsUrl: null,
      isPublished: true,
      isModerationHidden: false,
      reportCount: 0,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(legacy.ogRepresentativeListingIds).toBeUndefined();
  });

  it('ogRepresentativeListingIdsに順序付き配列を設定できる', () => {
    const profile: HousingerProfile = {
      displayName: 'テスト',
      displayNameLower: 'テスト',
      avatarUrl: null,
      avatarPngUrl: 'https://example.com/a.png',
      bio: null,
      snsUrl: null,
      isPublished: true,
      isModerationHidden: false,
      reportCount: 0,
      createdAt: 0,
      updatedAt: 0,
      ogRepresentativeListingIds: ['listing-1', 'listing-2'],
    };
    expect(profile.ogRepresentativeListingIds?.[0]).toBe('listing-1');
  });
});
