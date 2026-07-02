import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingListingsStore } from '../useHousingListingsStore';

describe('useHousingListingsStore.clearMine', () => {
  beforeEach(() => useHousingListingsStore.getState().reset());
  it('clearMine で myListings が空になる', () => {
    useHousingListingsStore.setState({ myListings: [{ id: 'x' } as any], myStatus: 'ready' });
    useHousingListingsStore.getState().clearMine();
    expect(useHousingListingsStore.getState().myListings).toEqual([]);
    expect(useHousingListingsStore.getState().myStatus).toBe('idle');
  });
});
