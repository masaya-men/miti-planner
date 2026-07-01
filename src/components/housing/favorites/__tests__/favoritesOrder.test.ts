import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../../data/housing/mockListings';
import { orderFavorites } from '../favoritesOrder';

/**
 * id だけを持つ最小限の MockListing を作成するヘルパ。
 * sortByAddress が使うフィールドのみ埋める (dc/server/area/ward/plot)。
 */
function mk(id: string, plot = 0, ward = 1, area = 'ミスト', server = 'マンダヴィル', dc = 'Mana'): MockListing {
  return {
    id,
    dc,
    server,
    area,
    ward,
    plot,
    buildingType: 'house',
    title: id,
    tags: [],
    description: '',
    createdAt: 0,
    sourceImageUrls: [],
  } as unknown as MockListing;
}

describe('orderFavorites', () => {
  it('recent は追加順の逆(新しい順)', () => {
    const listings = [mk('a'), mk('b'), mk('c')];
    expect(orderFavorites(['a', 'b', 'c'], listings, 'recent').map((l) => l.id)).toEqual(['c', 'b', 'a']);
  });

  it('all は住所順 (sortByAddress: ward昇順)', () => {
    const listings = [
      mk('w3', 1, 3),
      mk('w1', 1, 1),
      mk('w2', 1, 2),
    ];
    expect(orderFavorites(['w3', 'w1', 'w2'], listings, 'all').map((l) => l.id)).toEqual(['w1', 'w2', 'w3']);
  });

  it('解決できない id は除外される', () => {
    const listings = [mk('a'), mk('c')];
    expect(orderFavorites(['a', 'b', 'c'], listings, 'recent').map((l) => l.id)).toEqual(['c', 'a']);
  });

  it('ids が空のとき空配列を返す', () => {
    expect(orderFavorites([], [mk('a')], 'all')).toEqual([]);
  });
});
