import { describe, it, expect, vi } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import {
  selectWardListings,
  groupListingsByMapSpot,
  countListingsByWard,
  countListingsByMapKind,
  findInitialWardTarget,
} from '../browseMapSpots';

// MockListing は必須フィールドが多いため最小限を埋めるフィクスチャビルダー
// (tourNav.test.ts の `placeable` パターンを踏襲)。
let seq = 0;
function mkListing(over: Partial<MockListing> = {}): MockListing {
  seq += 1;
  return {
    id: `l-${seq}`,
    ownerUid: 'u1',
    dc: 'Mana',
    server: 'Anima',
    region: 'JP',
    area: 'Mist',
    ward: 3,
    buildingType: 'house',
    plot: 5,
    size: 'M',
    imageMode: 'none',
    tags: [],
    createdAt: 1000,
    lastConfirmedAt: 1000,
    addressKey: `k-${seq}`,
    ...over,
  };
}

describe('groupListingsByMapSpot', () => {
  it('同一plotの複数件は1スポットに集約され、代表はlastConfirmedAt最新', () => {
    const older = mkListing({ id: 'a', plot: 5, lastConfirmedAt: 100, createdAt: 100 });
    const newer = mkListing({ id: 'b', plot: 5, lastConfirmedAt: 200, createdAt: 50 });
    const spots = groupListingsByMapSpot([older, newer], 'mist');
    expect(spots).toHaveLength(1);
    expect(spots[0].key).toBe('plot:5');
    expect(spots[0].kind).toBe('plot');
    expect(spots[0].plot).toBe(5);
    expect(spots[0].listings.map((l) => l.id)).toEqual(['b', 'a']);
    expect(spots[0].representative.id).toBe('b');
  });

  it('lastConfirmedAtが同値ならcreatedAt最大が代表', () => {
    const a = mkListing({ id: 'a', plot: 6, lastConfirmedAt: 100, createdAt: 100 });
    const b = mkListing({ id: 'b', plot: 6, lastConfirmedAt: 100, createdAt: 300 });
    const spots = groupListingsByMapSpot([a, b], 'mist');
    expect(spots[0].representative.id).toBe('b');
  });

  it('アパートは号棟1・2ともに全部屋が1つのapartスポットに集約される', () => {
    const room1 = mkListing({
      id: 'r1', buildingType: 'apartment', apartmentBuilding: 1, plot: undefined, size: undefined, roomNumber: 3,
    });
    const room2 = mkListing({
      id: 'r2', buildingType: 'apartment', apartmentBuilding: 1, plot: undefined, size: undefined, roomNumber: 40,
    });
    const mainSpots = groupListingsByMapSpot([room1, room2], 'mist');
    expect(mainSpots).toHaveLength(1);
    expect(mainSpots[0].key).toBe('apart:1');
    expect(mainSpots[0].kind).toBe('apart');
    expect(mainSpots[0].listings.map((l) => l.id).sort()).toEqual(['r1', 'r2']);

    const subRoom1 = mkListing({
      id: 'sr1', buildingType: 'apartment', apartmentBuilding: 2, plot: undefined, size: undefined, roomNumber: 10,
    });
    const subRoom2 = mkListing({
      id: 'sr2', buildingType: 'apartment', apartmentBuilding: 2, plot: undefined, size: undefined, roomNumber: 55,
    });
    const subSpots = groupListingsByMapSpot([subRoom1, subRoom2], 'mist-sub');
    expect(subSpots).toHaveLength(1);
    expect(subSpots[0].key).toBe('apart:1');
    expect(subSpots[0].listings.map((l) => l.id).sort()).toEqual(['sr1', 'sr2']);
  });

  it('main/subはmapKeyで分かれる (plot5→main, plot35→sub)', () => {
    const mainPlot = mkListing({ id: 'm', plot: 5 });
    const subPlot = mkListing({ id: 's', plot: 35 });
    const mainSpots = groupListingsByMapSpot([mainPlot, subPlot], 'mist');
    expect(mainSpots.map((s) => s.key)).toEqual(['plot:5']);
    expect(mainSpots[0].listings.map((l) => l.id)).toEqual(['m']);

    const subSpots = groupListingsByMapSpot([mainPlot, subPlot], 'mist-sub');
    expect(subSpots.map((s) => s.key)).toEqual(['plot:5']); // 35-30=5 に読み替え
    expect(subSpots[0].listings.map((l) => l.id)).toEqual(['s']);
  });

  it('解決不能なlistingはconsole.warnしてスキップし、クラッシュしない', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = mkListing({ id: 'broken', buildingType: 'house', plot: undefined });
    const ok = mkListing({ id: 'ok', plot: 5 });
    let spots: ReturnType<typeof groupListingsByMapSpot> = [];
    expect(() => {
      spots = groupListingsByMapSpot([broken, ok], 'mist');
    }).not.toThrow();
    expect(spots).toHaveLength(1);
    expect(spots[0].listings.map((l) => l.id)).toEqual(['ok']);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('selectWardListings', () => {
  it('area+wardが一致するlistingだけ返す', () => {
    const a = mkListing({ id: 'a', area: 'Mist', ward: 3 });
    const b = mkListing({ id: 'b', area: 'Mist', ward: 4 });
    const c = mkListing({ id: 'c', area: 'Goblet', ward: 3 });
    const result = selectWardListings([a, b, c], 'Mist', 3);
    expect(result.map((l) => l.id)).toEqual(['a']);
  });
});

describe('countListingsByWard', () => {
  it('area別・ward毎の件数を集計する (他areaの同番号wardは混ざらない)', () => {
    const listings = [
      mkListing({ area: 'Mist', ward: 1 }),
      mkListing({ area: 'Mist', ward: 1 }),
      mkListing({ area: 'Mist', ward: 2 }),
      mkListing({ area: 'Goblet', ward: 1 }),
    ];
    const counts = countListingsByWard(listings, 'Mist');
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(1);
    expect(counts.size).toBe(2);
  });
});

describe('countListingsByMapKind', () => {
  it('main/subの件数を数える', () => {
    const listings = [
      mkListing({ id: 'p5', plot: 5 }),
      mkListing({ id: 'p35', plot: 35 }),
      mkListing({ id: 'p6', plot: 6 }),
    ];
    expect(countListingsByMapKind(listings)).toEqual({ main: 2, sub: 1 });
  });
});

describe('findInitialWardTarget', () => {
  it('最多件数のarea×wardを返す', () => {
    const listings = [
      mkListing({ area: 'Mist', ward: 1 }),
      mkListing({ area: 'Mist', ward: 1 }),
      mkListing({ area: 'Mist', ward: 1 }),
      mkListing({ area: 'Goblet', ward: 2 }),
    ];
    expect(findInitialWardTarget(listings)).toEqual({ area: 'Mist', ward: 1 });
  });

  it('0件ならnull', () => {
    expect(findInitialWardTarget([])).toBeNull();
  });
});
