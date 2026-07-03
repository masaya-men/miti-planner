import { describe, it, expect } from 'vitest';
import { WARD_CENTER_NODE, plotToPlacement, buildRoutePath, nodeToPoint, MAP_VIEWBOX } from '../wardRoute';
import mistWard from '../../../data/housing/mistWard.generated.json';

describe('plotToPlacement', () => {
  it('存在する plot は viewBox 内の座標を返す', () => {
    const known = (mistWard.houses as Array<{ kind: string; plot: number }>).find((h) => h.kind === 'plot')!;
    const p = plotToPlacement(known.plot);
    expect(p).not.toBeNull();
    expect(p!.x).toBeGreaterThanOrEqual(0);
    expect(p!.x).toBeLessThanOrEqual(MAP_VIEWBOX.w);
    expect(p!.y).toBeGreaterThanOrEqual(0);
    expect(p!.y).toBeLessThanOrEqual(MAP_VIEWBOX.h);
  });
  it('存在しない plot は null', () => {
    expect(plotToPlacement(9999)).toBeNull();
  });
});

describe('buildRoutePath', () => {
  it('中心ノード→既知プロットのノード で path(M...L...) を返す', () => {
    const house = (mistWard.houses as Array<{ kind: string; plot: number; node: string | null }>)
      .find((h) => h.kind === 'plot' && h.node)!;
    const path = buildRoutePath(WARD_CENTER_NODE, house.node!);
    expect(path).toBeTruthy();
    expect(path!.startsWith('M')).toBe(true);
  });
  it('未知ノードは null', () => {
    expect(buildRoutePath(WARD_CENTER_NODE, 'node_zzz')).toBeNull();
  });
});

describe('nodeToPoint', () => {
  it('既知ノードは viewBox 内の座標を返す', () => {
    const p = nodeToPoint(WARD_CENTER_NODE);
    expect(p).not.toBeNull();
    expect(p!.x).toBeGreaterThanOrEqual(0);
    expect(p!.x).toBeLessThanOrEqual(MAP_VIEWBOX.w);
    expect(p!.y).toBeGreaterThanOrEqual(0);
    expect(p!.y).toBeLessThanOrEqual(MAP_VIEWBOX.h);
  });
  it('未知ノードは null', () => {
    expect(nodeToPoint('node_zzz')).toBeNull();
  });
});
