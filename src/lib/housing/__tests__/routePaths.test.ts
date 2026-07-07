import { describe, it, expect } from 'vitest';
import { routeToPaths, arcJumpPath, migrateLegacyOverride, pointsToSegments, segmentsToPoints, simplifyPolyline, type Pt } from '../routePaths';

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
    // 中点(50,100)、len=100、膨らみ=40 上 → 制御点 (50, 60)
    expect(d).toBe('M0.0 100.0 Q50.0 60.0 100.0 100.0');
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

describe('pointsToSegments', () => {
  it('連続同 kind をまとめ、境界点を共有して線を繋ぐ', () => {
    const segs = pointsToSegments([
      { x: 0, y: 0, kind: 'road' }, { x: 0.1, y: 0, kind: 'road' },
      { x: 0.2, y: 0, kind: 'jump' }, { x: 0.3, y: 0, kind: 'jump' },
    ]);
    expect(segs).toEqual([
      { kind: 'road', points: [[0, 0], [0.1, 0]] },
      { kind: 'jump', points: [[0.1, 0], [0.2, 0], [0.3, 0]] }, // 境界 [0.1,0] を共有
    ]);
  });
  it('全て同 kind なら 1 セグ', () => {
    const segs = pointsToSegments([{ x: 0, y: 0, kind: 'road' }, { x: 1, y: 1, kind: 'road' }]);
    expect(segs).toEqual([{ kind: 'road', points: [[0, 0], [1, 1]] }]);
  });
  it('空は空', () => {
    expect(pointsToSegments([])).toEqual([]);
  });
});

describe('segmentsToPoints', () => {
  it('境界共有点を畳んで展開し、pointsToSegments と往復一致する', () => {
    const segs: { kind: 'road' | 'jump'; points: Pt[] }[] = [
      { kind: 'road', points: [[0, 0], [0.1, 0]] },
      { kind: 'jump', points: [[0.1, 0], [0.2, 0]] },
    ];
    const pts = segmentsToPoints(segs);
    expect(pts).toEqual([
      { x: 0, y: 0, kind: 'road' }, { x: 0.1, y: 0, kind: 'road' }, { x: 0.2, y: 0, kind: 'jump' },
    ]);
    expect(pointsToSegments(pts)).toEqual(segs);
  });
});

describe('simplifyPolyline', () => {
  it('2点以下はそのまま返す', () => {
    expect(simplifyPolyline([[0, 0]], 0.01)).toEqual([[0, 0]]);
    expect(simplifyPolyline([[0, 0], [1, 1]], 0.01)).toEqual([[0, 0], [1, 1]]);
  });

  it('ほぼ直線上の点は端点2つに畳む', () => {
    const line: Pt[] = [[0, 0], [0.25, 0.001], [0.5, 0], [0.75, 0.001], [1, 0]];
    expect(simplifyPolyline(line, 0.01)).toEqual([[0, 0], [1, 0]]);
  });

  it('明確な頂点は保持する（L字）', () => {
    const bend: Pt[] = [[0, 0], [0.5, 0], [0.5, 0.5]];
    const out = simplifyPolyline(bend, 0.01);
    expect(out).toContainEqual([0.5, 0]);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([0.5, 0.5]);
  });

  it('端点は常に残る', () => {
    const many: Pt[] = Array.from({ length: 20 }, (_, i) => [i / 19, Math.sin(i) * 0.0005] as Pt);
    const out = simplifyPolyline(many, 0.01);
    expect(out[0]).toEqual(many[0]);
    expect(out[out.length - 1]).toEqual(many[many.length - 1]);
    expect(out.length).toBeLessThan(many.length);
  });
});

