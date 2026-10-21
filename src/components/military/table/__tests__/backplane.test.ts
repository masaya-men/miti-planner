import { describe, it, expect } from 'vitest';
import { backplaneSVG, meander } from '../backplane';

const names = (s: string) => [...s.matchAll(/data-trace="([^"]+)"/g)].map((m) => m[1]);
const cents = (n: number, step = 120) => Array.from({ length: n }, (_, i) => 40 + i * step);

describe('backplaneSVG', () => {
  it('8 人: バス 4 + 扇 (7 隙間 x 2 側 x 6) + 蛇行は境目以外の 6 隙間 x 2', () => {
    const s = backplaneSVG({ centers: cents(8), pw: 1000, lpGap: 3 });
    const n = names(s);
    expect(n.filter((x) => x.startsWith('bp:b')).length).toBe(4);
    expect(n.filter((x) => x.startsWith('bp:f')).length).toBe(14 * 6);
    expect(n.filter((x) => x.startsWith('bp:m')).length).toBe(6 * 2);
    expect(n).toContain('bp:f0r0'); expect(n).not.toContain('bp:f0l0'); expect(n).toContain('bp:f7l5');
  });
  it('ライトパーティ順(lpGap=3)のときだけ U2 と LP1 | LP2', () => {
    expect(backplaneSVG({ centers: cents(8), pw: 1000, lpGap: 3 })).toContain('>U2<');
    expect(backplaneSVG({ centers: cents(8), pw: 1000, lpGap: 3 })).toContain('LP1 | LP2');
    const role = backplaneSVG({ centers: cents(8), pw: 1000, lpGap: null });
    expect(role).not.toContain('U2');
    expect(names(role).filter((x) => x.startsWith('bp:m')).length).toBe(7 * 2);
  });
  it('6 人: 隙間 5・扇 10 束', () => {
    const n = names(backplaneSVG({ centers: cents(6), pw: 800, lpGap: null }));
    expect(n.filter((x) => x.startsWith('bp:f')).length).toBe(10 * 6);
    expect(n.filter((x) => x.startsWith('bp:m')).length).toBe(5 * 2);
  });
  it('隙間が狭い(b-a < 8)と蛇行・部品を省く', () => {
    const n = names(backplaneSVG({ centers: cents(3, 60), pw: 400, lpGap: null }));
    expect(n.filter((x) => x.startsWith('bp:m')).length).toBe(0);
  });
  it('シルク J1.. と BUS', () => {
    const s = backplaneSVG({ centers: cents(3), pw: 500, lpGap: null });
    expect(s).toContain('>J1<'); expect(s).toContain('>J3<'); expect(s).toContain('>BUS<');
  });
});

describe('meander', () => {
  it('始点と終点が x0 / x1', () => {
    const p = meander(10, 90, 3, 2.4, 2, 1.25);
    expect(p[0]).toEqual([10, 3]); expect(p[p.length - 1]).toEqual([90, 3]);
  });
});
