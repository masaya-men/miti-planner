import { describe, it, expect } from 'vitest';
import { offsetPoly, bbox, chamRect, bank, stadium } from '../geom';
import type { Pt } from '../types';

describe('geom', () => {
  it('offsetPoly: 10x10 の正方形を内側に 1 → 8x8', () => {
    const sq: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const r = offsetPoly(sq, 1);
    const expected = [[1, 1], [9, 1], [9, 9], [1, 9]];
    r.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(expected[i][0]);
      expect(p[1]).toBeCloseTo(expected[i][1]);
    });
  });
  it('bbox(chamRect(20,10,3))', () => {
    expect(bbox(chamRect(20, 10, 3))).toEqual({ x: 0, y: 0, w: 20, h: 10 });
  });
  it('bank: 2 個に割れて隙間がある', () => {
    const r = bank(chamRect(100, 20), [1, 1]);
    expect(r).toHaveLength(2);
    expect(r.reduce((a, p) => a + bbox(p).w, 0)).toBeLessThan(100);
  });
  it('stadium(0,0,30,10) の bbox が 30x10', () => {
    const b = bbox(stadium(0, 0, 30, 10));
    expect(b.w).toBeCloseTo(30);
    expect(b.h).toBeCloseTo(10);
  });
});
