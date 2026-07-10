import { describe, it, expect, beforeEach } from 'vitest';
import { useEphemeralListingsStore } from '../useEphemeralListingsStore';
import { createEphemeralListing } from '../../lib/housing/ephemeralListing';

function makeListing(seed: number) {
  return createEphemeralListing({
    area: 'Mist',
    ward: (seed % 30) + 1,
    buildingType: 'house',
    plot: (seed % 60) + 1,
    size: 'M',
  });
}

describe('useEphemeralListingsStore — persist なし専用 store', () => {
  beforeEach(() => {
    useEphemeralListingsStore.getState().clear();
  });

  it('初期状態は空配列', () => {
    expect(useEphemeralListingsStore.getState().ephemeralListings).toEqual([]);
  });

  it('add で 1 件追加され true を返す', () => {
    const listing = makeListing(0);
    const result = useEphemeralListingsStore.getState().add(listing);
    expect(result).toBe(true);
    expect(useEphemeralListingsStore.getState().ephemeralListings).toEqual([listing]);
  });

  it('remove で id 一致の 1 件だけ消える', () => {
    const a = makeListing(0);
    const b = makeListing(1);
    useEphemeralListingsStore.getState().add(a);
    useEphemeralListingsStore.getState().add(b);
    useEphemeralListingsStore.getState().remove(a.id);
    expect(useEphemeralListingsStore.getState().ephemeralListings).toEqual([b]);
  });

  it('clear で全件消える', () => {
    useEphemeralListingsStore.getState().add(makeListing(0));
    useEphemeralListingsStore.getState().add(makeListing(1));
    useEphemeralListingsStore.getState().clear();
    expect(useEphemeralListingsStore.getState().ephemeralListings).toEqual([]);
  });

  it('EPHEMERAL_POOL_LIMIT (30件) までは add が true・31件目は false で弾かれる', () => {
    for (let i = 0; i < 30; i++) {
      const result = useEphemeralListingsStore.getState().add(makeListing(i));
      expect(result).toBe(true);
    }
    expect(useEphemeralListingsStore.getState().ephemeralListings).toHaveLength(30);

    const overflowResult = useEphemeralListingsStore.getState().add(makeListing(30));
    expect(overflowResult).toBe(false);
    expect(useEphemeralListingsStore.getState().ephemeralListings).toHaveLength(30);
  });
});
