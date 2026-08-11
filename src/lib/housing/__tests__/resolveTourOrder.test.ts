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

  it('ピンなし = orderTourStopIds の自動順そのまま', () => {
    const trayIds = ['na', 'jp', 'eu'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: [] }),
    ).toEqual(['jp', 'na', 'eu']);
  });

  it('1件ピン留め: pinned は trayIds 内の現在 index に固定され、残りだけ自動順で詰まる', () => {
    // trayIds = [eu, na, jp] で eu (index0) をピン。残り [na, jp] の自動順は [jp, na]。
    const trayIds = ['eu', 'na', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['eu'] }),
    ).toEqual(['eu', 'jp', 'na']);
  });

  it('複数ピン留め: 両方の位置を固定したまま中間の unpinned だけ自動順で入れ替わる', () => {
    // trayIds = [na, eu, oce, jp] で eu(index1)/oce(index2) をピン。
    // unpinned = [na, jp] (index0, index3) の自動順は [jp, na]。
    const trayIds = ['na', 'eu', 'oce', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['eu', 'oce'] }),
    ).toEqual(['jp', 'eu', 'oce', 'na']);
  });

  it('末尾にピン留めした状態で新しい行き先を追加しても、ピンは追加後の現在 index を維持する', () => {
    // 元々 [na, jp] で jp (末尾, index1) をピン。そこへ eu を追加して [na, jp, eu] になっても
    // ピンは「index1 に固定」であり続ける (=役割ではなく位置を覚えている新セマンティクス)。
    const trayIds = ['na', 'jp', 'eu'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['jp'] }),
    ).toEqual(['na', 'jp', 'eu']);
  });

  it('pinned id が trayIds に存在しない場合は無視する', () => {
    const trayIds = ['na', 'jp'];
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['ghost'] }),
    ).toEqual(['jp', 'na']);
  });

  it('trayIds が空なら空配列', () => {
    expect(
      resolveTourOrder([], pool, { pinnedIds: [] }),
    ).toEqual([]);
  });

  // 2026-08-11: 「手動並び替え済みか」のグローバルモードを撤去したため、ドラッグ確定後
  // (=見た目上バラバラな trayIds) でも、ピンは常に同じ1つのルールで効き続ける。
  it('ドラッグ等で trayIds の並びが崩れていても、ピンは常に自分の現在 index を維持する', () => {
    const trayIds = ['eu', 'na', 'jp']; // 元の自動順とは異なる、ドラッグ後想定の並び
    // na(index1)は固定。残り[eu, jp]は自動順(JP<EU)で並ぶので[jp, eu]になり、
    // 空いているslot(index0, index2)へ順に詰まる。
    expect(
      resolveTourOrder(trayIds, pool, { pinnedIds: ['na'] }),
    ).toEqual(['jp', 'na', 'eu']);
  });
});
