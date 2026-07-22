import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingListOrderStore } from '../../store/useHousingListOrderStore';

describe('useHousingListOrderStore', () => {
  beforeEach(() => useHousingListOrderStore.getState().reset());

  it('browse の既定 sortMode は random, housinger は newest', () => {
    const { entries } = useHousingListOrderStore.getState();
    expect(entries.browse.sortMode).toBe('random');
    expect(entries.housinger.sortMode).toBe('newest');
  });

  it('scrollTop は3キーとも既定 0', () => {
    const { entries } = useHousingListOrderStore.getState();
    expect(entries.browse.scrollTop).toBe(0);
    expect(entries.favorites.scrollTop).toBe(0);
    expect(entries.housinger.scrollTop).toBe(0);
  });

  it('favorites の既定 favTab は all', () => {
    expect(useHousingListOrderStore.getState().entries.favorites.favTab).toBe('all');
  });

  it('setScrollTop は対象キーだけ更新する (他キーは不変)', () => {
    useHousingListOrderStore.getState().setScrollTop('browse', 250);
    const { entries } = useHousingListOrderStore.getState();
    expect(entries.browse.scrollTop).toBe(250);
    expect(entries.favorites.scrollTop).toBe(0);
  });

  it('setSortMode は対象キーの sortMode を更新する', () => {
    useHousingListOrderStore.getState().setSortMode('browse', 'oldest');
    expect(useHousingListOrderStore.getState().entries.browse.sortMode).toBe('oldest');
  });

  it('setFavTab は対象キーの favTab を更新する', () => {
    useHousingListOrderStore.getState().setFavTab('favorites', 'recent');
    expect(useHousingListOrderStore.getState().entries.favorites.favTab).toBe('recent');
  });

  it('reshuffle は seed を変える (同じ値になる確率は無視できるほど低い)', () => {
    const before = useHousingListOrderStore.getState().entries.browse.seed;
    useHousingListOrderStore.getState().reshuffle('browse');
    const after = useHousingListOrderStore.getState().entries.browse.seed;
    expect(after).not.toBe(before);
  });

  it('reshuffle は対象キー以外の seed を変えない', () => {
    const beforeFav = useHousingListOrderStore.getState().entries.favorites.seed;
    useHousingListOrderStore.getState().reshuffle('browse');
    expect(useHousingListOrderStore.getState().entries.favorites.seed).toBe(beforeFav);
  });

  it('reset は全キーを既定値に戻す', () => {
    useHousingListOrderStore.getState().setScrollTop('browse', 999);
    useHousingListOrderStore.getState().setSortMode('housinger', 'oldest');
    useHousingListOrderStore.getState().reset();
    const { entries } = useHousingListOrderStore.getState();
    expect(entries.browse.scrollTop).toBe(0);
    expect(entries.housinger.sortMode).toBe('newest');
  });
});
