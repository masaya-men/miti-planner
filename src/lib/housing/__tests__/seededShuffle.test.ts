import { describe, it, expect } from 'vitest';
import { seededShuffle, generateShuffleSeed } from '../seededShuffle';

describe('seededShuffle', () => {
  it('同じ seed なら常に同じ並びを返す', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(items, 42);
    const b = seededShuffle(items, 42);
    expect(a).toEqual(b);
  });

  it('seed が違えば並びが変わる (十分な要素数で偶然一致しない)', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
  });

  it('元配列を変更しない', () => {
    const items = [1, 2, 3];
    const original = [...items];
    seededShuffle(items, 7);
    expect(items).toEqual(original);
  });

  it('要素数・要素の集合は保たれる (並びだけ変わる)', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = seededShuffle(items, 99);
    expect(shuffled.length).toBe(items.length);
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it('空配列で空配列を返す', () => {
    expect(seededShuffle([], 1)).toEqual([]);
  });
});

describe('generateShuffleSeed', () => {
  it('整数を返す', () => {
    const seed = generateShuffleSeed();
    expect(Number.isInteger(seed)).toBe(true);
  });
});
