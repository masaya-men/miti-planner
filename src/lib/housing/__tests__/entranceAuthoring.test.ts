import { describe, it, expect } from 'vitest';
import { normToPx, pxToNorm, buildEntranceExport, buildFullExport } from '../entranceAuthoring';

describe('entranceAuthoring', () => {
  const vb = { w: 100, h: 200 };

  it('normToPx は 0..1 を viewBox px に変換', () => {
    expect(normToPx(0.5, 0.25, vb)).toEqual({ x: 50, y: 50 });
  });

  it('pxToNorm は viewBox px を 0..1 に変換(往復整合)', () => {
    const [nx, ny] = pxToNorm(50, 50, vb);
    expect(nx).toBeCloseTo(0.5, 6);
    expect(ny).toBeCloseTo(0.25, 6);
  });

  it('buildEntranceExport は該当 mapKey を差し替え、他 mapKey を保持', () => {
    const existing = { mist: { '6': [0.4, 0.5] as [number, number] }, goblet: { '3': [0.1, 0.2] as [number, number] } };
    const out = buildEntranceExport(existing, 'mist', { '6': [0.42, 0.58], '12': [0.3, 0.3] });
    expect(out.mist).toEqual({ '6': [0.42, 0.58], '12': [0.3, 0.3] });
    expect(out.goblet).toEqual({ '3': [0.1, 0.2] });
  });

  it('overrides が空なら該当 mapKey を落とす', () => {
    const existing = { mist: { '6': [0.4, 0.5] as [number, number] }, goblet: { '3': [0.1, 0.2] as [number, number] } };
    const out = buildEntranceExport(existing, 'mist', {});
    expect(out.mist).toBeUndefined();
    expect(out.goblet).toEqual({ '3': [0.1, 0.2] });
  });

  it('buildFullExport は複数マップの編集を全て含む', () => {
    const overrides = {
      mist: { '6': [0.42, 0.58] as [number, number] },
      goblet: { '3': [0.1, 0.2] as [number, number] },
    };
    const out = buildFullExport(overrides);
    expect(out.mist).toEqual({ '6': [0.42, 0.58] });
    expect(out.goblet).toEqual({ '3': [0.1, 0.2] });
  });

  it('buildFullExport は空(点ゼロ)のマップを落とす', () => {
    const overrides = {
      mist: { '6': [0.42, 0.58] as [number, number] },
      goblet: {},
    };
    const out = buildFullExport(overrides);
    expect(out.mist).toEqual({ '6': [0.42, 0.58] });
    expect(out.goblet).toBeUndefined();
  });
});
