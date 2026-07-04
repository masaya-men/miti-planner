import { describe, it, expect } from 'vitest';
import { nearestPointOnPolylines, segmentPolygonIntersection } from '../mapGeometry';

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

describe('segmentPolygonIntersection', () => {
  const box: [number, number][] = [[40, 40], [60, 40], [60, 60], [40, 60]]; // 中心(50,50)

  it('外(左)から中心へ向かう線分は左辺 x=40 で交わる', () => {
    const r = segmentPolygonIntersection(0, 50, 50, 50, box)!;
    expect(r.x).toBeCloseTo(40, 5);
    expect(r.y).toBeCloseTo(50, 5);
  });

  it('a に近い側の交点を返す(貫通しても入口で止める)', () => {
    const r = segmentPolygonIntersection(0, 50, 100, 50, box)!;
    expect(r.x).toBeCloseTo(40, 5); // 入口(左辺)。出口 x=60 ではない
  });

  it('多角形に触れない線分は null', () => {
    expect(segmentPolygonIntersection(0, 0, 10, 0, box)).toBeNull();
  });
});
