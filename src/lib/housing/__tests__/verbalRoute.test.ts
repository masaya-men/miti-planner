import { describe, it, expect } from 'vitest';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { shouldReroute, directionalWalk, findCornerOnWalk, buildVerbalRoute } from '../verbalRoute';

// 合成マップ: O(50,20)から西へ Cn(20,20)→SW(20,70)、東へ ER(70,20)。viewBox 100×100。
const hook: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'O', x: 0.5, y: 0.2 }, { id: 'Cn', x: 0.2, y: 0.2 }, { id: 'SW', x: 0.2, y: 0.7 }, { id: 'ER', x: 0.7, y: 0.2 },
  ],
  edges: [
    { a: 'O', b: 'Cn', polyline: [[0.5, 0.2], [0.2, 0.2]] },
    { a: 'Cn', b: 'SW', polyline: [[0.2, 0.2], [0.2, 0.7]] },
    { a: 'O', b: 'ER', polyline: [[0.5, 0.2], [0.7, 0.2]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
};

describe('shouldReroute', () => {
  it('出だしが方角と同じ半平面 → false(agree)', () => {
    expect(shouldReroute([[0, 0], [30, 0], [30, 10]], { x: 1, y: 0 })).toBe(false);
  });
  it('出だしが方角の反対半平面 → true(reroute)', () => {
    expect(shouldReroute([[0, 0], [30, 0], [30, 10]], { x: -1, y: 0 })).toBe(true);
  });
  it('点が1つ以下 → false', () => {
    expect(shouldReroute([[5, 5]], { x: 1, y: 0 })).toBe(false);
  });
});

describe('directionalWalk', () => {
  it('西へ歩く(2点目は開始より左)', () => {
    const w = directionalWalk(hook, { x: 50, y: 20 }, { x: -1, y: 0 })!;
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(w[1][0]).toBeLessThan(w[0][0]);            // 西=左へ
    expect(w.some(([x, y]) => x === 20 && y === 20)).toBe(true); // Cn を通る
  });
  it('乗り口がノードに一致(東向き)でも先頭に重複点を作らない', () => {
    const w = directionalWalk(hook, { x: 50, y: 20 }, { x: 1, y: 0 })!;
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(w[0][0] === w[1][0] && w[0][1] === w[1][1]).toBe(false); // 先頭2点が同一でない
    expect(w[1][0]).toBeGreaterThan(w[0][0]);                       // 東=右へ
  });
});

describe('findCornerOnWalk', () => {
  it('8-8実座標の歩きで(684,305)付近が入口最寄り=曲がり角', () => {
    const walk: [number, number][] = [[829, 277], [799, 268], [690, 277], [684, 305], [595, 311], [593, 405]];
    const c = findCornerOnWalk(walk, [725, 380]);
    expect(c.point[0]).toBeCloseTo(684, 0);
    expect(c.point[1]).toBeCloseTo(305, 0);
  });
});

// 水平道 w(10,50)-m(50,50)-e(90,50)。agree 用。
const straight: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [{ id: 'w', x: 0.1, y: 0.5 }, { id: 'm', x: 0.5, y: 0.5 }, { id: 'e', x: 0.9, y: 0.5 }],
  edges: [
    { a: 'w', b: 'm', polyline: [[0.1, 0.5], [0.5, 0.5]] },
    { a: 'm', b: 'e', polyline: [[0.5, 0.5], [0.9, 0.5]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
};

// フック+東ショートカット: 最短路は東(ER-ES-DP)経由で入口へ、しかしテキスト方角は西。
const reroute: WardMapJson = {
  area: 'Test', viewBox: { w: 100, h: 100 },
  nodes: [
    { id: 'O', x: 0.5, y: 0.2 }, { id: 'Cn', x: 0.2, y: 0.2 }, { id: 'SW', x: 0.2, y: 0.7 },
    { id: 'ER', x: 0.7, y: 0.2 }, { id: 'ES', x: 0.7, y: 0.5 }, { id: 'DP', x: 0.35, y: 0.5 },
  ],
  edges: [
    { a: 'O', b: 'Cn', polyline: [[0.5, 0.2], [0.2, 0.2]] },
    { a: 'Cn', b: 'SW', polyline: [[0.2, 0.2], [0.2, 0.7]] },
    { a: 'O', b: 'ER', polyline: [[0.5, 0.2], [0.7, 0.2]] },
    { a: 'ER', b: 'ES', polyline: [[0.7, 0.2], [0.7, 0.5]] },
    { a: 'ES', b: 'DP', polyline: [[0.7, 0.5], [0.35, 0.5]] },
  ],
  houses: [], roadPath: '', visibleRoadPath: null,
};

describe('buildVerbalRoute', () => {
  it('agree: 方角と道が一致 → 道追従・jump=null', () => {
    const r = buildVerbalRoute(straight, { x: 15, y: 50 }, { x: 85, y: 50 }, { x: 1, y: 0 })!;
    expect(r.jump).toBeNull();
    expect(r.road[0]).toEqual([15, 50]);
    expect(r.road[r.road.length - 1]).toEqual([85, 50]);
    expect(r.road.some(([x]) => Math.abs(x - 50) < 1)).toBe(true); // 中央ノードを通る(直線でない)
  });
  it('reroute: 最短路は東だがテキスト西 → 西へ歩き曲がり角から破線ジャンプ', () => {
    const r = buildVerbalRoute(reroute, { x: 50, y: 20 }, { x: 35, y: 45 }, { x: -1, y: 0 })!;
    expect(r.jump).not.toBeNull();
    expect(r.jump![r.jump!.length - 1]).toEqual([35, 45]);        // ジャンプ終点=入口
    expect(r.jump![0]).toEqual([20, 45]);                          // 曲がり角(西の縦道上の投影)
    expect(r.road.some(([x, y]) => x === 20 && y === 20)).toBe(true); // 西(Cn)を経由
    expect(r.jump![0]).toEqual(r.road[r.road.length - 1]);         // road 終点 == jump 始点(連続)
  });
});
