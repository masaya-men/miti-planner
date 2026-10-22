import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import {
  buildMapIndex, countDc, countServer, countArea, countWard, countKind,
  bestInDc, bestInServer, bestInArea, bestKindInWard,
} from '../browseMapIndex';

let seq = 0;
function mk(over: Partial<MockListing> = {}): MockListing {
  seq += 1;
  return {
    id: `i-${seq}`, ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
    area: 'Mist', ward: 3, buildingType: 'house', plot: 5, size: 'M', imageMode: 'none',
    tags: [], createdAt: 1, lastConfirmedAt: 1, addressKey: `k-${seq}`, ...over,
  };
}

describe('browseMapIndex', () => {
  const pool = [
    mk({ ward: 3, plot: 5 }),
    mk({ ward: 3, plot: 6 }),
    mk({ ward: 3, plot: 40 }), // 拡張街
    mk({ ward: 9, plot: 2 }),
    mk({ area: 'Goblet', ward: 1, plot: 33 }),
    mk({ server: 'Asura', area: 'Shirogane', ward: 2, plot: 1 }),
    mk({ dc: 'Gaia', server: 'Ridill', region: 'JP', ward: 4, plot: 1 }),
    mk({ area: undefined, ward: undefined, plot: undefined }), // 住所非公開は数えない
  ];
  const idx = buildMapIndex(pool);

  it('DC / ワールド / エリア / 区 / 種別ごとに件数を数える', () => {
    expect(countDc(idx, 'Mana')).toBe(6);
    expect(countDc(idx, 'Gaia')).toBe(1);
    expect(countDc(idx, 'Meteor')).toBe(0);
    expect(countServer(idx, 'Mana', 'Anima')).toBe(5);
    expect(countArea(idx, 'Mana', 'Anima', 'Mist')).toBe(4);
    expect(countWard(idx, 'Mana', 'Anima', 'Mist', 3)).toBe(3);
    expect(countKind(idx, 'Mana', 'Anima', 'Mist', 3, 'main')).toBe(2);
    expect(countKind(idx, 'Mana', 'Anima', 'Mist', 3, 'sub')).toBe(1);
  });

  it('DC で最多の ワールド×エリア×区×種別 を返す (同数は本街優先)', () => {
    expect(bestInDc(idx, 'Mana')).toEqual({ server: 'Anima', area: 'Mist', ward: 3, kind: 'main' });
    expect(bestInDc(idx, 'Meteor')).toBeNull();
  });

  it('ワールド・エリアを選び直すと下位は件数最多になる', () => {
    expect(bestInServer(idx, 'Mana', 'Asura')).toEqual({ server: 'Asura', area: 'Shirogane', ward: 2, kind: 'main' });
    expect(bestInArea(idx, 'Mana', 'Anima', 'Goblet')).toEqual({ server: 'Anima', area: 'Goblet', ward: 1, kind: 'sub' });
    expect(bestInArea(idx, 'Mana', 'Anima', 'Empyreum')).toBeNull();
  });

  it('区を選び直すと件数の多い側の種別になる (同数は本街)', () => {
    expect(bestKindInWard(idx, 'Mana', 'Anima', 'Goblet', 1)).toBe('sub');
    expect(bestKindInWard(idx, 'Mana', 'Anima', 'Mist', 3)).toBe('main');
    expect(bestKindInWard(idx, 'Mana', 'Anima', 'Mist', 9)).toBe('main');
  });
});
