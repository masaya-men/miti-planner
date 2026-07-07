import { describe, it, expect } from 'vitest';
import { routeToPaths, arcJumpPath, migrateLegacyOverride, type Pt } from '../routePaths';

describe('routeToPaths', () => {
  it('road セグは M/L 直線サブパスで px 化', () => {
    const { routePath, routeJumpPath } = routeToPaths([{ kind: 'road', points: [[0, 0], [0.5, 0.5]] }], 100, 200);
    expect(routePath).toBe('M0.0 0.0 L50.0 100.0');
    expect(routeJumpPath).toBeNull();
  });
  it('jump セグは Q 弧サブパス、routePath は null', () => {
    const { routePath, routeJumpPath } = routeToPaths([{ kind: 'jump', points: [[0, 0.5], [1, 0.5]] }], 100, 100);
    expect(routePath).toBeNull();
    expect(routeJumpPath).toMatch(/^M0\.0 50\.0 Q/); // 始点 + 弧
    expect(routeJumpPath).toMatch(/100\.0 50\.0$/); // 終点で終わる
  });
  it('road+jump 混在は両方返す(各 1 サブパス)', () => {
    const { routePath, routeJumpPath } = routeToPaths(
      [{ kind: 'road', points: [[0, 0], [0.5, 0]] }, { kind: 'jump', points: [[0.5, 0], [1, 0]] }], 100, 100);
    expect(routePath).toBe('M0.0 0.0 L50.0 0.0');
    expect(routeJumpPath).toMatch(/^M50\.0 0\.0 Q/);
  });
  it('点 1 個以下のセグは無視', () => {
    expect(routeToPaths([{ kind: 'road', points: [[0, 0]] }], 100, 100).routePath).toBeNull();
  });
  it('複数 road セグは M で区切った複数サブパスを 1 本の d に連結', () => {
    const { routePath } = routeToPaths(
      [{ kind: 'road', points: [[0, 0], [0.1, 0]] }, { kind: 'road', points: [[0.5, 0], [0.6, 0]] }], 100, 100);
    expect(routePath).toBe('M0.0 0.0 L10.0 0.0 M50.0 0.0 L60.0 0.0');
  });
});

describe('arcJumpPath', () => {
  it('2 点を上向き Q 弧に(制御点 y が中点より上=小さい)', () => {
    const d = arcJumpPath([[0, 100], [100, 100]]);
    // 中点(50,100)、len=100、膨らみ=22 上 → 制御点 (50, 78)
    expect(d).toBe('M0.0 100.0 Q50.0 78.0 100.0 100.0');
  });
});

describe('migrateLegacyOverride', () => {
  it('{road} を road セグへ', () => {
    expect(migrateLegacyOverride({ road: [[0, 0], [1, 1]], jump: null })).toEqual([{ kind: 'road', points: [[0, 0], [1, 1]] }]);
  });
  it('{road, jump} を road+jump セグへ', () => {
    expect(migrateLegacyOverride({ road: [[0, 0]], jump: [[0, 0], [1, 1]] })).toEqual([
      { kind: 'road', points: [[0, 0]] }, { kind: 'jump', points: [[0, 0], [1, 1]] },
    ]);
  });
  it('segments はそのまま返す', () => {
    const s = [{ kind: 'jump' as const, points: [[0, 0], [1, 1]] as unknown as Pt[] }];
    expect(migrateLegacyOverride({ segments: s })).toBe(s);
  });
});
