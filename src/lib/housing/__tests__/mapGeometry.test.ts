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

  it('多頂点 polyline で正しいセグメントに落ちる', () => {
    const threeVertex = [{ a: 'n1', b: 'n2', polyline: [[0, 0], [10, 0], [10, 10]] as [number, number][] }];
    // 点(14,5)は第2セグメント[10,0]→[10,10]の垂線の足(10,5)に落ちる
    // seg0: (10,0)dist≈6.4 | seg1: (10,5)dist=4 → seg1が最近
    const r = nearestPointOnPolylines(14, 5, threeVertex)!;
    expect(r.x).toBeCloseTo(10, 5);
    expect(r.y).toBeCloseTo(5, 5);
    expect(r.segIndex).toBe(1);
    expect(r.t).toBeCloseTo(0.5, 5);
    expect(r.dist).toBeCloseTo(4, 5);
  });

  it('退化(長さ0)セグメントは端点へフォールバック', () => {
    const degenerate = [{ a: 'n1', b: 'n2', polyline: [[5, 5], [5, 5]] as [number, number][] }];
    // 長さ0セグメント: len2=0 → t=0で端点(5,5)にフォールバック
    const r = nearestPointOnPolylines(8, 9, degenerate)!;
    expect(r.x).toBeCloseTo(5, 5);
    expect(r.y).toBeCloseTo(5, 5);
    expect(r.t).toBe(0);
    expect(r.dist).toBeCloseTo(5, 5); // hypot(3,4)=5
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
