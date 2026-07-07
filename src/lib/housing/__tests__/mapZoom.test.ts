import { describe, it, expect } from 'vitest';
import { applyWheelZoom, type MapView } from '../mapZoom';

const contentAt = (v: MapView, mx: number, my: number) => [(mx - v.tx) / v.scale, (my - v.ty) / v.scale];

describe('applyWheelZoom', () => {
  it('ズームインしてもカーソル下の内容座標は不変', () => {
    const v: MapView = { scale: 1, tx: 0, ty: 0 };
    const before = contentAt(v, 100, 80);
    const nv = applyWheelZoom(v, 100, 80, -100); // deltaY<0 = zoom in
    expect(nv.scale).toBeCloseTo(1.1, 5);
    const after = contentAt(nv, 100, 80);
    expect(after[0]).toBeCloseTo(before[0], 4);
    expect(after[1]).toBeCloseTo(before[1], 4);
  });

  it('ズームアウトでもカーソル下の内容座標は不変', () => {
    const v: MapView = { scale: 4, tx: -120, ty: -60 };
    const before = contentAt(v, 200, 150);
    const nv = applyWheelZoom(v, 200, 150, +100); // zoom out
    expect(nv.scale).toBeCloseTo(4 / 1.1, 5);
    const after = contentAt(nv, 200, 150);
    expect(after[0]).toBeCloseTo(before[0], 4);
    expect(after[1]).toBeCloseTo(before[1], 4);
  });

  it('最小(1)より縮小しない=同一 v を返す', () => {
    const v: MapView = { scale: 1, tx: 0, ty: 0 };
    expect(applyWheelZoom(v, 50, 50, +100)).toBe(v);
  });

  it('最大(8)より拡大しない=同一 v を返す', () => {
    const v: MapView = { scale: 8, tx: -10, ty: -10 };
    expect(applyWheelZoom(v, 50, 50, -100)).toBe(v);
  });
});
