import { describe, expect, it } from 'vitest';
import { selectActivePlayers } from '../viewportPlaybackPool';

describe('selectActivePlayers', () => {
  const ratios = new Map<string, number>([
    ['a', 0.9],
    ['b', 0.5],
    ['c', 0.1],
    ['d', 0.7],
  ]);

  it('returns top-N by ratio (highest first)', () => {
    expect(selectActivePlayers(ratios, 2)).toEqual(['a', 'd']);
  });
  it('returns all when N > count', () => {
    expect(new Set(selectActivePlayers(ratios, 99))).toEqual(
      new Set(['a', 'b', 'c', 'd']),
    );
  });
  it('ignores ratio 0', () => {
    const m = new Map([
      ['a', 0],
      ['b', 0.4],
    ]);
    expect(selectActivePlayers(m, 3)).toEqual(['b']);
  });
  it('returns empty for cap 0', () => {
    expect(selectActivePlayers(ratios, 0)).toEqual([]);
  });
  it('breaks ties by id', () => {
    const m = new Map([
      ['y', 0.5],
      ['x', 0.5],
    ]);
    expect(selectActivePlayers(m, 1)).toEqual(['x']);
  });
  it('excludes cards below minRatio', () => {
    const m = new Map([
      ['a', 0.1],
      ['b', 0.4],
      ['c', 0.29],
    ]);
    expect(selectActivePlayers(m, 5, 0.3)).toEqual(['b']);
  });
});
