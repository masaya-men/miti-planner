import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import { orderTourStops, orderTourStopIds } from '../orderTourStops';

const listing = (over: Partial<MockListing>): MockListing => ({
  id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
  area: 'Mist', ward: 1, buildingType: 'house', plot: 1, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over,
});

describe('orderTourStops', () => {
  it('空配列はそのまま空配列', () => { expect(orderTourStops([])).toEqual([]); });

  it('元配列を mutate しない', () => {
    const input = [ listing({ id: 'b', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'kb' }), listing({ id: 'a', region: 'JP', addressKey: 'ka' }) ];
    const snap = input.map((l) => l.id); orderTourStops(input);
    expect(input.map((l) => l.id)).toEqual(snap);
  });

  it('最上位はリージョン順 (JP→NA→EU→OCE)', () => {
    const input = [ listing({ id: 'eu', region: 'EU', dc: 'Chaos', server: 'Cerberus', addressKey: 'e' }), listing({ id: 'oce', region: 'OCE', dc: 'Materia', server: 'Bismarck', addressKey: 'o' }), listing({ id: 'jp', region: 'JP', addressKey: 'j' }), listing({ id: 'na', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'n' }) ];
    expect(orderTourStops(input).map((l) => l.id)).toEqual(['jp', 'na', 'eu', 'oce']);
  });

  it('同リージョン内は DC → サーバー → エリア → 区 → 番地', () => {
    const input = [
      listing({ id: 'plot10', server: 'Anima', area: 'Mist', ward: 1, plot: 10, addressKey: 'k1' }),
      listing({ id: 'plot3', server: 'Anima', area: 'Mist', ward: 1, plot: 3, addressKey: 'k2' }),
      listing({ id: 'ward2', server: 'Anima', area: 'Mist', ward: 2, plot: 1, addressKey: 'k3' }),
      listing({ id: 'lav', server: 'Anima', area: 'LavenderBeds', ward: 1, plot: 1, addressKey: 'k4' }),
      listing({ id: 'srv', server: 'Asura', area: 'Mist', ward: 1, plot: 1, addressKey: 'k5' }),
      listing({ id: 'dc', dc: 'Meteor', server: 'Belias', area: 'Mist', ward: 1, plot: 1, addressKey: 'k6' }),
    ];
    expect(orderTourStops(input).map((l) => l.id)).toEqual(['plot3', 'plot10', 'ward2', 'lav', 'srv', 'dc']);
  });

  it('同 ward 内は house が apartment より先・apartment は 棟→部屋 昇順', () => {
    const input = [
      listing({ id: 'apt2', buildingType: 'apartment', plot: undefined, size: undefined, apartmentBuilding: 2, roomNumber: 1, addressKey: 'a2' }),
      listing({ id: 'apt1', buildingType: 'apartment', plot: undefined, size: undefined, apartmentBuilding: 1, roomNumber: 5, addressKey: 'a1' }),
      listing({ id: 'house', buildingType: 'house', plot: 30, addressKey: 'h' }),
    ];
    expect(orderTourStops(input).map((l) => l.id)).toEqual(['house', 'apt1', 'apt2']);
  });

  it('同住所 (同 addressKey) は隣接維持し lastConfirmedAt desc', () => {
    const input = [ listing({ id: 'other', addressKey: 'kk', plot: 20 }), listing({ id: 'dupA', addressKey: 'same', plot: 5, lastConfirmedAt: 100 }), listing({ id: 'dupB', addressKey: 'same', plot: 5, lastConfirmedAt: 900 }) ];
    expect(orderTourStops(input).map((l) => l.id)).toEqual(['dupB', 'dupA', 'other']);
  });
});

describe('orderTourStopIds', () => {
  it('pool の住所情報で id を並べ替える', () => {
    const pool = [ listing({ id: 'na', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'n' }), listing({ id: 'jp', region: 'JP', addressKey: 'j' }) ];
    expect(orderTourStopIds(['na', 'jp'], pool)).toEqual(['jp', 'na']);
  });
  it('pool に無い id は末尾に元順で温存', () => {
    const pool = [listing({ id: 'jp', region: 'JP', addressKey: 'j' })];
    expect(orderTourStopIds(['ghost', 'jp'], pool)).toEqual(['jp', 'ghost']);
  });
});
