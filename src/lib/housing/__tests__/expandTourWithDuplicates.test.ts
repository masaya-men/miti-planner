import { describe, it, expect } from 'vitest';
import { expandTourWithDuplicates } from '../expandTourWithDuplicates';
import type { MockListing } from '../../../data/housing/mockListings';

const mk = (id: string, addressKey: string): MockListing =>
  ({ id, addressKey }) as unknown as MockListing;

describe('expandTourWithDuplicates', () => {
  it('追加 listing の addressKey と一致する他 listing を全部追加する', () => {
    const all = [mk('A', 'k1'), mk('A2', 'k1'), mk('A3', 'k1'), mk('B', 'k2')];
    const result = expandTourWithDuplicates([], 'A', all);
    expect(result.nextIds.sort()).toEqual(['A', 'A2', 'A3']);
    expect(result.autoAddedCount).toBe(2);
  });

  it('既にツアー内に同 addressKey の listing が居れば skip (冪等)', () => {
    const all = [mk('A', 'k1'), mk('A2', 'k1'), mk('A3', 'k1')];
    const result = expandTourWithDuplicates(['A2'], 'A', all);
    expect(result.nextIds.sort()).toEqual(['A', 'A2', 'A3']);
    expect(result.autoAddedCount).toBe(1);
  });

  it('addressKey が unique なら自動追加は 0', () => {
    const all = [mk('A', 'k1'), mk('B', 'k2')];
    const result = expandTourWithDuplicates([], 'A', all);
    expect(result.nextIds).toEqual(['A']);
    expect(result.autoAddedCount).toBe(0);
  });

  it('addressKey が空文字なら自動追加せず本体だけ追加', () => {
    const all = [mk('A', ''), mk('A2', '')];
    const result = expandTourWithDuplicates([], 'A', all);
    expect(result.nextIds).toEqual(['A']);
    expect(result.autoAddedCount).toBe(0);
  });

  it('newListingId が all に居なければ no-op (= 安全)', () => {
    const all = [mk('A', 'k1')];
    const result = expandTourWithDuplicates(['X'], 'unknown', all);
    expect(result.nextIds).toEqual(['X']);
    expect(result.autoAddedCount).toBe(0);
  });

  it('既に newListingId 自身がツアー内なら他不在分のみ追加 (= 重複 add の冪等)', () => {
    const all = [mk('A', 'k1'), mk('A2', 'k1'), mk('A3', 'k1')];
    const result = expandTourWithDuplicates(['A', 'A2'], 'A', all);
    expect(result.nextIds.sort()).toEqual(['A', 'A2', 'A3']);
    expect(result.autoAddedCount).toBe(1);
  });

  it('元の tourListingIds の順序は破壊しない (= prepend ではなく append)', () => {
    const all = [mk('X', 'k0'), mk('A', 'k1'), mk('A2', 'k1')];
    const result = expandTourWithDuplicates(['X'], 'A', all);
    expect(result.nextIds[0]).toBe('X');
    expect(result.nextIds.slice(1).sort()).toEqual(['A', 'A2']);
  });
});
