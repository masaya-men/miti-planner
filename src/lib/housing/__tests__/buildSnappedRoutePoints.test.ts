import { describe, it, expect } from 'vitest';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { buildSnappedRoutePoints } from '../wardRoute';

// 水平3ノードの道: n1(0.1,0.5)-n2(0.5,0.5)-n3(0.9,0.5)。viewBox 100x100 → px [10,50]-[50,50]-[90,50]。
const GRAPH: WardMapJson = {
  area: 'Test',
  viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'n1', x: 0.1, y: 0.5 },
    { id: 'n2', x: 0.5, y: 0.5 },
    { id: 'n3', x: 0.9, y: 0.5 },
  ],
  edges: [
    { a: 'n1', b: 'n2', polyline: [[0.1, 0.5], [0.5, 0.5]] },
    { a: 'n2', b: 'n3', polyline: [[0.5, 0.5], [0.9, 0.5]] },
  ],
  houses: [],
  roadPath: '',
  visibleRoadPath: null,
};

const near = (p: [number, number], x: number, y: number) => {
  expect(p[0]).toBeCloseTo(x, 4);
  expect(p[1]).toBeCloseTo(y, 4);
};

describe('buildSnappedRoutePoints', () => {
  it('離れた2点は道(分岐点経由)を辿る — 斜め直線にしない', () => {
    // start(20,40) end(80,40): 別 edge に投影 → (20,50)→n2(50,50)→(80,50)
    const r = buildSnappedRoutePoints(GRAPH, { x: 20, y: 40 }, { x: 80, y: 40 })!;
    expect(r).not.toBeNull();
    expect(r.length).toBe(3);
    near(r[0], 20, 50);   // 始点=道への投影
    near(r[1], 50, 50);   // 分岐点 n2 を通る(道を使う)
    near(r[2], 80, 50);   // 終点=道への投影
  });

  it('同一 edge 上の2点は その区間を辿る', () => {
    const r = buildSnappedRoutePoints(GRAPH, { x: 20, y: 40 }, { x: 40, y: 40 })!;
    expect(r.length).toBe(2);
    near(r[0], 20, 50);
    near(r[1], 40, 50);
  });

  it('両端が n2 の別 edge 側に落ちても n2 経由で道を使う(退化の解消)', () => {
    // start(45,40)→edge0, end(55,40)→edge1。同一ノード n2 の両隣 → n2 経由
    const r = buildSnappedRoutePoints(GRAPH, { x: 45, y: 40 }, { x: 55, y: 40 })!;
    expect(r.length).toBe(3);
    near(r[0], 45, 50);
    near(r[1], 50, 50);   // n2
    near(r[2], 55, 50);
  });

  it('道が無い(edges空)なら null', () => {
    const empty = { ...GRAPH, edges: [] };
    expect(buildSnappedRoutePoints(empty, { x: 20, y: 40 }, { x: 80, y: 40 })).toBeNull();
  });
});
