import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import { resolveTourOrder } from '../resolveTourOrder';

const listing = (over: Partial<MockListing>): MockListing => ({
  id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
  area: 'Mist', ward: 1, buildingType: 'house', plot: 1, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over,
});

describe('resolveTourOrder', () => {
  const pool = [
    listing({ id: 'na', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'n' }),
    listing({ id: 'jp', region: 'JP', addressKey: 'j' }),
    listing({ id: 'eu', region: 'EU', dc: 'Chaos', server: 'Cerberus', addressKey: 'e' }),
  ];

  it('自動順 (manualOrder=false)・ピン無し = orderTourStopIds と同じ', () => {
    const trayIds = ['na', 'jp', 'eu'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedFirstId: null, pinnedLastId: null, manualOrder: false }),
    ).toEqual(['jp', 'na', 'eu']);
  });

  it('自動順 + ピン: 残りだけ自動順にして pinnedFirst/pinnedLast を前後に固定', () => {
    const trayIds = ['na', 'jp', 'eu'];
    // pinnedFirst=eu, pinnedLast=na: 残り(jp)だけ自動順に整列
    expect(
      resolveTourOrder(trayIds, pool, { pinnedFirstId: 'eu', pinnedLastId: 'na', manualOrder: false }),
    ).toEqual(['eu', 'jp', 'na']);
  });

  it('手動順 (manualOrder=true)・ピン無し = trayIds の現在順をそのまま維持', () => {
    const trayIds = ['eu', 'na', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedFirstId: null, pinnedLastId: null, manualOrder: true }),
    ).toEqual(['eu', 'na', 'jp']);
  });

  it('手動順 + ピン: 現在順を維持しつつ pinned だけ先頭/末尾へ移動', () => {
    // trayIds の並びは eu, na, jp。pinnedFirst=jp, pinnedLast=eu を指定すると
    // 中間(na)の相対順は保ったまま [jp, na, eu] になる。
    const trayIds = ['eu', 'na', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedFirstId: 'jp', pinnedLastId: 'eu', manualOrder: true }),
    ).toEqual(['jp', 'na', 'eu']);
  });

  it('pinned id が trayIds に存在しない場合は無視する', () => {
    const trayIds = ['na', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedFirstId: 'ghost', pinnedLastId: null, manualOrder: false }),
    ).toEqual(['jp', 'na']);
  });

  it('pinnedFirstId と pinnedLastId が同一 id なら first を優先し last は無視する', () => {
    const trayIds = ['na', 'jp', 'eu'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedFirstId: 'na', pinnedLastId: 'na', manualOrder: true }),
    ).toEqual(['na', 'jp', 'eu']);
  });

  it('trayIds が空なら空配列', () => {
    expect(
      resolveTourOrder([], pool, { pinnedFirstId: null, pinnedLastId: null, manualOrder: false }),
    ).toEqual([]);
  });
});
