import { describe, it, expect } from 'vitest';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { followRoadSegments } from '../followRoad';
import type { RouteSegment } from '../routePaths';

// 山形カーブの道: e0 n1-n2 は途中(0.3,0.3)へ跳ねる曲線 / e1 n2-n3 は直線。viewBox 100x100。
const CURVE: WardMapJson = {
  area: 'Test',
  viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'n1', x: 0.1, y: 0.5 },
    { id: 'n2', x: 0.5, y: 0.5 },
    { id: 'n3', x: 0.9, y: 0.5 },
  ],
  edges: [
    { a: 'n1', b: 'n2', polyline: [[0.1, 0.5], [0.3, 0.3], [0.5, 0.5]] },
    { a: 'n2', b: 'n3', polyline: [[0.5, 0.5], [0.9, 0.5]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
} as unknown as WardMapJson;

// П字の道(左が開いている): 上 e0 / 右 e1 / 下 e2。左端の2点は直線は近いが道は大回り。
const U: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'm1', x: 0.1, y: 0.1 }, { id: 'm2', x: 0.9, y: 0.1 },
    { id: 'm3', x: 0.9, y: 0.9 }, { id: 'm4', x: 0.1, y: 0.9 },
  ],
  edges: [
    { a: 'm1', b: 'm2', polyline: [[0.1, 0.1], [0.9, 0.1]] },
    { a: 'm2', b: 'm3', polyline: [[0.9, 0.1], [0.9, 0.9]] },
    { a: 'm3', b: 'm4', polyline: [[0.9, 0.9], [0.1, 0.9]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
} as unknown as WardMapJson;

// 連結の無い2本の道(到達不能テスト用)。
const SPLIT: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'a1', x: 0.1, y: 0.1 }, { id: 'a2', x: 0.3, y: 0.1 },
    { id: 'b1', x: 0.7, y: 0.9 }, { id: 'b2', x: 0.9, y: 0.9 },
  ],
  edges: [
    { a: 'a1', b: 'a2', polyline: [[0.1, 0.1], [0.3, 0.1]] },
    { a: 'b1', b: 'b2', polyline: [[0.7, 0.9], [0.9, 0.9]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
} as unknown as WardMapJson;

const road = (points: [number, number][]): RouteSegment => ({ kind: 'road', points });
const minY = (pts: [number, number][]) => Math.min(...pts.map((p) => p[1]));

describe('followRoadSegments', () => {
  it('同一 edge 上の2点は そのカーブ頂点を含む点列に展開する', () => {
    const out = followRoadSegments([road([[0.15, 0.5], [0.45, 0.5]])], CURVE);
    const pts = out[0].points;
    expect(pts.length).toBeGreaterThan(2);       // 直線(2点)から増える
    expect(minY(pts)).toBeLessThan(0.4);         // 跳ね(0.3付近)を通る
  });

  it('別 edge をまたぐ2点も 分岐点とカーブを辿って展開する', () => {
    const out = followRoadSegments([road([[0.15, 0.5], [0.85, 0.5]])], CURVE);
    const pts = out[0].points;
    expect(pts.length).toBeGreaterThan(2);
    expect(minY(pts)).toBeLessThan(0.4);         // e0 の跳ねを通る
    expect(pts.some((p) => Math.abs(p[0] - 0.5) < 0.02 && Math.abs(p[1] - 0.5) < 0.02)).toBe(true); // 分岐点 n2 を通る
  });

  it('片端が道の外(出だし/終わり相当)なら 直線のまま', () => {
    const out = followRoadSegments([road([[0.5, 0.9], [0.85, 0.5]])], CURVE); // (0.5,0.9)は道から遠い
    expect(out[0].points.length).toBe(2);
    expect(out[0].points[0]).toEqual([0.5, 0.9]);   // 道外端は原位置維持
  });

  it('道なりが直線の MAX_RATIO 倍を超える大回りは 直線に戻す(暴走ガード)', () => {
    const out = followRoadSegments([road([[0.15, 0.1], [0.15, 0.9]])], U); // 直線80px vs 道230px
    expect(out[0].points.length).toBe(2);
  });

  it('到達不能(連結の無い道)なら 直線に戻す', () => {
    const out = followRoadSegments([road([[0.2, 0.1], [0.8, 0.9]])], SPLIT);
    expect(out[0].points.length).toBe(2);
  });

  it('jump 区間は素通し(不変)', () => {
    const jump: RouteSegment = { kind: 'jump', points: [[0.1, 0.1], [0.5, 0.5]] };
    const out = followRoadSegments([jump], CURVE);
    expect(out[0]).toEqual(jump);
  });
});
