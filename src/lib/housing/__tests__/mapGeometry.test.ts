import { describe, it, expect } from 'vitest';
import { nearestPointOnPolylines } from '../mapGeometry';

describe('nearestPointOnPolylines', () => {
  const edges = [{ a: 'n1', b: 'n2', polyline: [[0, 0], [10, 0]] as [number, number][] }];

  it('水平線分の真上の点は垂線の足へ落ちる', () => {
    const r = nearestPointOnPolylines(5, 4, edges)!;
    expect(r.x).toBeCloseTo(5, 5);
    expect(r.y).toBeCloseTo(0, 5);
    expect(r.dist).toBeCloseTo(4, 5);
  });

  it('線分の外側の点は端点にクランプされる', () => {
    const r = nearestPointOnPolylines(-3, 0, edges)!;
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.t).toBeCloseTo(0, 5);
  });

  it('複数 edge から最も近いセグメントを選ぶ', () => {
    const two = [
      { a: 'n1', b: 'n2', polyline: [[0, 0], [10, 0]] as [number, number][] },
      { a: 'n3', b: 'n4', polyline: [[0, 100], [10, 100]] as [number, number][] },
    ];
    const r = nearestPointOnPolylines(5, 90, two)!;
    expect(r.edgeIndex).toBe(1);
    expect(r.y).toBeCloseTo(100, 5);
  });

  it('edge が無ければ null', () => {
    expect(nearestPointOnPolylines(0, 0, [])).toBeNull();
  });
});
