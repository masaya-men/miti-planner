import { describe, it, expect } from 'vitest';
import { toTourSnapshot, buildTourSnapshots, snapshotContainsHiddenAddress } from '../snapshot';
import type { MockListing } from '../../../data/housing/mockListings';

const base = (over: Partial<MockListing>): MockListing => ({
  id: 'x', ownerUid: 'u', area: 'Mist', ward: 1, buildingType: 'house',
  plot: 1, size: 'M', imageMode: 'none', tags: [], visibility: 'public',
  createdAt: 0, lastConfirmedAt: 0, ...over,
} as MockListing);

describe('toTourSnapshot', () => {
  it('外部URLと住所を写すが ownerUid は落とす', () => {
    const s = toTourSnapshot(base({ id: 'a', sourceImageUrls: ['http://x/1.jpg'], imageMode: 'sns' }));
    expect(s.id).toBe('a');
    expect(s.sourceImageUrls).toEqual(['http://x/1.jpg']);
    expect((s as unknown as Record<string, unknown>).ownerUid).toBeUndefined();
  });
});

describe('buildTourSnapshots', () => {
  it('順序を保ち pool に無い id を捨てる', () => {
    const pool = [base({ id: 'a' }), base({ id: 'b' })];
    const out = buildTourSnapshots(['b', 'missing', 'a'], pool);
    expect(out.map(s => s.id)).toEqual(['b', 'a']);
  });
});

describe('snapshotContainsHiddenAddress', () => {
  it('unlisted/private を含むと true', () => {
    expect(snapshotContainsHiddenAddress([{ id: 'a', visibility: 'public' }])).toBe(false);
    expect(snapshotContainsHiddenAddress([{ id: 'a', visibility: 'unlisted' }])).toBe(true);
  });
});
