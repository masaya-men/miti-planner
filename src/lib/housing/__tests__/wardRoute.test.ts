import { describe, it, expect } from 'vitest';
import { WARD_CENTER_NODE, plotToPlacement, buildRoutePath, nodeToPoint, MAP_VIEWBOX } from '../wardRoute';
import mistWard from '../../../data/housing/mistWard.generated.json';
import { plotToPlacementIn, nodeToPointIn, buildRoutePathIn } from '../wardRoute';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import gobletWardRaw from '../../../data/housing/gobletWard.generated.json';
const gobletWard = gobletWardRaw as unknown as WardMapJson;
import { apartToPlacementIn } from '../wardRoute';
import mistSubWardRaw from '../../../data/housing/mistSubWard.generated.json';
const mistSubWard = mistSubWardRaw as unknown as WardMapJson;

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

describe('wardRoute *In (ワード JSON 引数・非 Mist で成立)', () => {
  it('plotToPlacementIn: 既知 plot は px 座標', () => { const p = plotToPlacementIn(gobletWard, 1); expect(p).not.toBeNull(); expect(p!.x).toBeGreaterThan(0); });
  it('plotToPlacementIn: 存在しない plot は null', () => { expect(plotToPlacementIn(gobletWard, 999)).toBeNull(); });
  it('nodeToPointIn: 先頭ノードは座標・未知は null', () => { expect(nodeToPointIn(gobletWard, gobletWard.nodes[0].id)).not.toBeNull(); expect(nodeToPointIn(gobletWard, 'node_zzz')).toBeNull(); });
  it('buildRoutePathIn: 玄関ノードを持つ家まで経路が引ける', () => { const h = gobletWard.houses.find((x) => x.kind === 'plot' && x.node); const path = buildRoutePathIn(gobletWard, gobletWard.nodes[0].id, h!.node!); expect(path).toMatch(/^M/); });
  it('buildRoutePathIn: 未知ノードは null', () => { expect(buildRoutePathIn(gobletWard, gobletWard.nodes[0].id, 'node_zzz')).toBeNull(); });
});

describe('apartToPlacementIn (アパート配置・番号非依存)', () => {
  it('本街マップの apart(apart_1) を返す', () => {
    const p = apartToPlacementIn(gobletWard);
    expect(p).not.toBeNull(); expect(p!.x).toBeGreaterThan(0); expect(p!.nodeId).toBeTruthy();
  });
  it('拡張街マップの apart(apart_2) も番号に依存せず返す (棟2バグ回避)', () => {
    const p = apartToPlacementIn(mistSubWard);
    expect(p).not.toBeNull(); expect(p!.x).toBeGreaterThan(0); expect(p!.nodeId).toBeTruthy();
  });
});
