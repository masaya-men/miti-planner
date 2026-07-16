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

describe('useHousingListingsStore.remove', () => {
  beforeEach(() => useHousingListingsStore.getState().reset());

  // バグ修正 (2026-07-17): remove が listings しか消さず myListings を消し忘れると、
  // 探すページの mergeListingsForViewer(listings, myListings, ...) 経由で削除済みの
  // 自分の物件が復活表示され続ける (リロードまで消えない)。
  it('remove(id) で listings と myListings の両方から該当 id が消える', () => {
    useHousingListingsStore.setState({
      status: 'ready',
      listings: [{ id: 'a' } as any, { id: 'b' } as any],
      myListings: [{ id: 'a' } as any, { id: 'c' } as any],
    });

    useHousingListingsStore.getState().remove('a');

    expect(useHousingListingsStore.getState().listings.map((l) => l.id)).toEqual(['b']);
    expect(useHousingListingsStore.getState().myListings.map((l) => l.id)).toEqual(['c']);
  });

  it('該当しない id を渡しても listings / myListings の他の要素に影響しない', () => {
    useHousingListingsStore.setState({
      status: 'ready',
      listings: [{ id: 'a' } as any],
      myListings: [{ id: 'a' } as any],
    });

    useHousingListingsStore.getState().remove('does-not-exist');

    expect(useHousingListingsStore.getState().listings.map((l) => l.id)).toEqual(['a']);
    expect(useHousingListingsStore.getState().myListings.map((l) => l.id)).toEqual(['a']);
  });
});
