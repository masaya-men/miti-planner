import { describe, it, expect } from 'vitest';
import { buildTourPool } from '../buildTourPool';
import { resolveTourSteps } from '../tourNav';
import type { MockListing } from '../../../data/housing/mockListings';

const base = (over: Partial<MockListing>): MockListing =>
  ({ id: 'x', ownerUid: 'o', dc: 'Elemental', server: 'Gaia', region: 'JP',
     area: 'Mist', ward: 1, imageMode: 'none', tags: [], createdAt: 0,
     lastConfirmedAt: 0, addressKey: 'k', ...over } as MockListing);

const NOW = 1000;

describe('buildTourPool', () => {
  it('① 混在 pool で ephemeral id が解決される (mergeListingsForViewer 結果 + ephemeral)', () => {
    const publicListings = [base({ id: 'a' })];
    const ephemeral = [base({ id: 'ephemeral-1', ownerUid: '__ephemeral__' })];
    const pool = buildTourPool(publicListings, [], null, ephemeral, NOW);
    expect(pool.map((l) => l.id).sort()).toEqual(['a', 'ephemeral-1']);
  });

  it('② 同 id は既存 (mergeListingsForViewer 側) 優先で ephemeral 側は無視される', () => {
    const publicListings = [base({ id: 'dup', title: '登録済み' })];
    const ephemeral = [base({ id: 'dup', ownerUid: '__ephemeral__', title: '一時' })];
    const pool = buildTourPool(publicListings, [], null, ephemeral, NOW);
    expect(pool).toHaveLength(1);
    expect(pool[0].title).toBe('登録済み');
  });

  it('③ resolveTourSteps に通すと登録済み+一時の両方が step になる', () => {
    const publicListings = [base({ id: 'a' })];
    const ephemeral = [base({ id: 'ephemeral-1', ownerUid: '__ephemeral__' })];
    const pool = buildTourPool(publicListings, [], null, ephemeral, NOW);
    const steps = resolveTourSteps(['a', 'ephemeral-1'], pool);
    expect(steps.map((s) => s.listing?.id)).toEqual(['a', 'ephemeral-1']);
    expect(steps.every((s) => s.listing != null)).toBe(true);
  });

  it('他人の期限切れ public は除外されつつ ephemeral は残る (mergeListingsForViewer の既存挙動を継承)', () => {
    const publicListings = [base({ id: 'expired', ownerUid: 'other', visibility: 'public', publishUntil: NOW - 1 })];
    const ephemeral = [base({ id: 'ephemeral-2', ownerUid: '__ephemeral__' })];
    const pool = buildTourPool(publicListings, [], 'me', ephemeral, NOW);
    expect(pool.map((l) => l.id)).toEqual(['ephemeral-2']);
  });
});
