import { describe, it, expect, vi, afterEach } from 'vitest';
import { stretchSpec, stretchPlaced } from '../stretch';
import { seedOf } from '../weather';
import type { PanelSpec, StretchFrame } from '../types';

const f: StretchFrame = { w0: 274, h0: 122, sx: 137, sy: 61 };

afterEach(() => { vi.restoreAllMocks(); });

describe('stretch(縮める方向の検知)', () => {
  const zf: StretchFrame = { w0: 274, h0: 679, sx: 137, sy: 300 };
  it('右端が線に近いパネルを縮めると dev でエラーを出す', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    stretchPlaced({ x: 120, y: 0, w: 30, h: 50, spec: { pts: [[0, 0], [30, 0], [30, 50]] } }, zf, 250, 679);
    expect(err).toHaveBeenCalled();
  });
  it('幅が 0 以下になるとエラーを出す', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    stretchPlaced({ x: 100, y: 0, w: 40, h: 50, spec: { pts: [[0, 0]] } }, zf, 100, 679);
    expect(err).toHaveBeenCalled();
  });
  it('線より右にあるパネルの通常の縮小はエラーなしで x - 24', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = stretchPlaced({ x: 200, y: 0, w: 74, h: 110, spec: { pts: [[10, 5], [60, 5]] } }, zf, 250, 679);
    expect(r.x).toBe(176);
    expect(err).not.toHaveBeenCalled();
  });
});

describe('stretch', () => {
  it('点と path を伸ばす', () => {
    const spec: PanelSpec = { pts: [[232, 0], [16, 0], [16, 100]], scribes: ['M 142 105 H 206'] };
    const r = stretchSpec(spec, f, 300, 122);
    expect(r.pts[0]).toEqual([258, 0]);
    expect(r.pts[1]).toEqual([16, 0]);
    expect(r.pts[2]).toEqual([16, 100]);
    expect(r.scribes).toEqual(['M 168 105 H 232']);
  });
  it('y 方向・pockets・circles', () => {
    const spec: PanelSpec = { pts: [[0, 0]], pockets: [{ b: 2, pts: [[10, 100]] }], circles: [[200, 100, 3]] };
    const r = stretchSpec(spec, f, 274, 142);
    expect(r.pockets?.[0].pts[0]).toEqual([10, 120]);
    expect(r.circles?.[0]).toEqual([200, 120, 3]);
  });
  it('未対応コマンドは Error', () => {
    expect(() => stretchSpec({ pts: [], scribes: ['M 0 0 C 1 1 2 2 3 3'] }, f, 300, 122)).toThrow(Error);
  });
  describe('stretchPlaced(区画座標)', () => {
    const zf: StretchFrame = { w0: 274, h0: 679, sx: 137, sy: 300 };
    const S1pts: PanelSpec = { pts: [[16, 0], [232, 0], [274, 42]] };
    it('右寄りのパネルは平行移動のみ', () => {
      const r = stretchPlaced({ x: 200, y: 0, w: 74, h: 110, spec: { pts: [[10, 5], [60, 5]] } }, zf, 300, 679);
      expect(r).toMatchObject({ x: 226, y: 0, w: 74, h: 110 });
      expect(r.spec.pts).toEqual([[10, 5], [60, 5]]);
    });
    it('境界をまたぐパネルは幅が伸びる', () => {
      const r = stretchPlaced({ x: 0, y: 0, w: 274, h: 122, spec: S1pts }, zf, 300, 679);
      expect(r).toMatchObject({ x: 0, w: 300 });
      expect(r.spec.pts[1]).toEqual([258, 0]);
      expect(r.spec.pts[0]).toEqual([16, 0]);
    });
    it('境界の手前のパネルは変わらない', () => {
      const p = { x: 0, y: 0, w: 100, h: 50, spec: { pts: [[1, 1], [99, 49]] as [number, number][] } };
      const r = stretchPlaced(p, zf, 300, 679);
      expect(r).toMatchObject({ x: 0, y: 0, w: 100, h: 50 });
      expect(r.spec.pts).toEqual(p.spec.pts);
    });
    it('縦方向', () => {
      const r = stretchPlaced({ x: 0, y: 400, w: 274, h: 100, spec: { pts: [[0, 0]] } }, zf, 274, 800);
      expect(r).toMatchObject({ y: 521, h: 100 });
    });
  });
  it('wx の heat / wear / streaks も追従する', () => {
    const r = stretchSpec({ pts: [[0, 0]], wx: { heat: [[200, 10, 5], [35, 10, 5]], wear: [[200, 100, 9, 3]], streaks: [[200, 20, 6]] } }, f, 300, 122);
    expect(r.wx?.heat).toEqual([[226, 10, 5], [35, 10, 5]]);
    expect(r.wx?.wear).toEqual([[226, 100, 9, 3]]);
    expect(r.wx?.streaks).toEqual([[226, 20, 6]]);
  });
  it('seed を元の形から固定し、サイズが変わっても同じ', () => {
    const spec: PanelSpec = { pts: [[16, 0], [232, 0], [274, 42], [0, 100]] };
    const a = stretchSpec(spec, f, 300, 122), b = stretchSpec(spec, f, 320, 122);
    expect(a.seed).toBe(seedOf(spec.pts));
    expect(b.seed).toBe(a.seed);
    expect(stretchSpec({ ...spec, seed: 5 }, f, 300, 122).seed).toBe(5);
  });
});
