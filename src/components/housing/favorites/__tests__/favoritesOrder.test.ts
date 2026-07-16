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

  // バグ修正 (2026-07-17): ids に同じ id が複数回含まれていると、そのまま解決回数分だけ
  // 重複してカード表示され、見出しの件数 (呼び出し元は listings.length を表示に使う) も
  // 水増しされていた。1 件に集約する (先勝ちで順序維持)。
  it('重複 id は 1 件にまとめる (recent: 先勝ちの逆順を維持)', () => {
    const listings = [mk('a'), mk('b')];
    expect(orderFavorites(['a', 'b', 'a'], listings, 'recent').map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('重複 id は 1 件にまとめる (all: 件数が水増しされない)', () => {
    const listings = [mk('a'), mk('b')];
    const result = orderFavorites(['a', 'a', 'b', 'a'], listings, 'all');
    expect(result.map((l) => l.id)).toEqual(['a', 'b']);
    expect(result).toHaveLength(2);
  });
});
