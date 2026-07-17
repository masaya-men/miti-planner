import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import { resolveTourOrder } from '../resolveTourOrder';

const listing = (over: Partial<MockListing>): MockListing => ({
  id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
  area: 'Mist', ward: 1, buildingType: 'house', plot: 1, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over,
});

describe('resolveTourOrder', () => {
  // region 自動順は JP < NA < EU < OCE (ALL_REGIONS)。
  const pool = [
    listing({ id: 'na', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'n' }),
    listing({ id: 'jp', region: 'JP', addressKey: 'j' }),
    listing({ id: 'eu', region: 'EU', dc: 'Chaos', server: 'Cerberus', addressKey: 'e' }),
    listing({ id: 'oce', region: 'OCE', dc: 'Materia', server: 'Bismarck', addressKey: 'o' }),
  ];

  it('ピンなし(manualOrder=false) = orderTourStopIds の自動順そのまま', () => {
    const trayIds = ['na', 'jp', 'eu'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: [], manualOrder: false }),
    ).toEqual(['jp', 'na', 'eu']);
  });

  it('1件ピン留め: pinned は trayIds 内の現在 index に固定され、残りだけ自動順で詰まる', () => {
    // trayIds = [eu, na, jp] で eu (index0) をピン。残り [na, jp] の自動順は [jp, na]。
    const trayIds = ['eu', 'na', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['eu'], manualOrder: false }),
    ).toEqual(['eu', 'jp', 'na']);
  });

  it('複数ピン留め: 両方の位置を固定したまま中間の unpinned だけ自動順で入れ替わる', () => {
    // trayIds = [na, eu, oce, jp] で eu(index1)/oce(index2) をピン。
    // unpinned = [na, jp] (index0, index3) の自動順は [jp, na]。
    const trayIds = ['na', 'eu', 'oce', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['eu', 'oce'], manualOrder: false }),
    ).toEqual(['jp', 'eu', 'oce', 'na']);
  });

  it('manualOrder=true はピンを見ず trayIds をそのまま返す (ドラッグ確定後の素通し)', () => {
    const trayIds = ['eu', 'na', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['na'], manualOrder: true }),
    ).toEqual(['eu', 'na', 'jp']);
  });

  it('末尾にピン留めした状態で新しい行き先を追加しても、ピンは追加後の現在 index を維持する', () => {
    // 元々 [na, jp] で jp (末尾, index1) をピン。そこへ eu を追加して [na, jp, eu] になっても
    // ピンは「index1 に固定」であり続ける (=役割ではなく位置を覚えている新セマンティクス)。
    const trayIds = ['na', 'jp', 'eu'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['jp'], manualOrder: false }),
    ).toEqual(['na', 'jp', 'eu']);
  });

  it('pinned id が trayIds に存在しない場合は無視する', () => {
    const trayIds = ['na', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['ghost'], manualOrder: false }),
    ).toEqual(['jp', 'na']);
  });

  it('trayIds が空なら空配列', () => {
    expect(
      resolveTourOrder([], pool, { pinnedIds: [], manualOrder: false }),
    ).toEqual([]);
  });
});
