import { describe, it, expect } from 'vitest';
import { computeSegmentFills } from '../stepperProgress';

describe('computeSegmentFills', () => {
  it('p=0 で全て 0', () => {
    expect(computeSegmentFills(0, [10, 5, 10])).toEqual([0, 0, 0]);
  });
  it('p=1 で全て 1', () => {
    expect(computeSegmentFills(1, [10, 5, 10])).toEqual([1, 1, 1]);
  });
  it('途中は実長で按分される (total30, p=0.5 → 15px 塗り)', () => {
    // [10,10,10]: 15px 塗り → 円1=満(10) / 線1=半分(5/10) / 円2=0
    expect(computeSegmentFills(0.5, [10, 10, 10])).toEqual([1, 0.5, 0]);
  });
  it('セグメント境界ちょうど', () => {
    expect(computeSegmentFills(10 / 30, [10, 10, 10])).toEqual([1, 0, 0]);
  });
  it('p は 0..1 にクランプされる', () => {
    expect(computeSegmentFills(-1, [10, 10])).toEqual([0, 0]);
    expect(computeSegmentFills(2, [10, 10])).toEqual([1, 1]);
  });
  it('空配列は空を返す', () => {
    expect(computeSegmentFills(0.5, [])).toEqual([]);
  });
  it('総長 0 は全 0 (ゼロ除算しない)', () => {
    expect(computeSegmentFills(0.5, [0, 0])).toEqual([0, 0]);
  });
  it('長さ 0 のセグメントは 0、他は正しく塗る', () => {
    expect(computeSegmentFills(1, [10, 0, 10])).toEqual([1, 0, 1]);
  });
});
