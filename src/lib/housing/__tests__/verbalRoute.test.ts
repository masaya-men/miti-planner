import { describe, it, expect } from 'vitest';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { shouldReroute, directionalWalk, findCornerOnWalk } from '../verbalRoute';

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
});

describe('findCornerOnWalk', () => {
  it('8-8実座標の歩きで(684,305)付近が入口最寄り=曲がり角', () => {
    const walk: [number, number][] = [[829, 277], [799, 268], [690, 277], [684, 305], [595, 311], [593, 405]];
    const c = findCornerOnWalk(walk, [725, 380]);
    expect(c.point[0]).toBeCloseTo(684, 0);
    expect(c.point[1]).toBeCloseTo(305, 0);
  });
});
