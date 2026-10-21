import { describe, it, expect } from 'vitest';
import { stretchSpec, stretchPlaced } from '../stretch';
import { seedOf } from '../weather';
import type { PanelSpec, StretchFrame } from '../types';

const f: StretchFrame = { w0: 274, h0: 122, sx: 137, sy: 61 };

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
  it('stretchPlaced は w/h を差分だけ伸ばす', () => {
    const p = stretchPlaced({ x: 5, y: 6, w: 274, h: 122, spec: { pts: [[232, 0]] } }, f, 300, 130);
    expect(p).toMatchObject({ x: 5, y: 6, w: 300, h: 130 });
    expect(p.spec.pts[0]).toEqual([258, 0]);
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
