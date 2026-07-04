import { describe, it, expect } from 'vitest';
import { getPlotOriginNode } from '../plotOrigin';

describe('getPlotOriginNode', () => {
  it('全5エリア×全60区画で起点ノードが解決できる (300/300)', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
      for (let p = 1; p <= 60; p++) {
        const o = getPlotOriginNode(area, p);
        expect(o, `${area} ${p}`).not.toBeNull();
        expect(o!.node.length).toBeGreaterThan(0);
      }
    }
  });

  it('本街(1-30)は非[拡張街]シャード・拡張街(31-60)は[拡張街]シャードに解決 (クロス0)', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
      for (let p = 1; p <= 30; p++) expect(getPlotOriginNode(area, p)!.aetheryte.startsWith('[拡張街]'), `${area} ${p}`).toBe(false);
      for (let p = 31; p <= 60; p++) expect(getPlotOriginNode(area, p)!.aetheryte.startsWith('[拡張街]'), `${area} ${p}`).toBe(true);
    }
  });

  it('plot 無し/範囲外/未知エリアは null', () => {
    expect(getPlotOriginNode('Mist', null)).toBeNull();
    expect(getPlotOriginNode('Mist', 61)).toBeNull();
    expect(getPlotOriginNode('Nowhere', 1)).toBeNull();
  });
});
