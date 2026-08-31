import { describe, it, expect } from 'vitest';
import { slideshowWindowIndices } from '../slideshowWindow';

describe('slideshowWindowIndices', () => {
  it('n<=3 は全 index を返す', () => {
    expect(slideshowWindowIndices(1, 0)).toEqual([0]);
    expect(slideshowWindowIndices(2, 1)).toEqual([0, 1]);
    expect(slideshowWindowIndices(3, 2)).toEqual([0, 1, 2]);
  });

  it('n=4 は {prev, cur, next} の3枚', () => {
    expect(slideshowWindowIndices(4, 0)).toEqual([3, 0, 1]);
    expect(slideshowWindowIndices(4, 1)).toEqual([0, 1, 2]);
    expect(slideshowWindowIndices(4, 3)).toEqual([2, 3, 0]);
  });

  it('index が範囲外でも環状に正規化する', () => {
    expect(slideshowWindowIndices(4, 5)).toEqual([0, 1, 2]);
    expect(slideshowWindowIndices(4, -1)).toEqual([2, 3, 0]);
  });

  it('n<=0 は空配列', () => {
    expect(slideshowWindowIndices(0, 0)).toEqual([]);
  });
});
