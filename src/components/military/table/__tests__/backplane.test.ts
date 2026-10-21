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

describe('扇の配線の形', () => {
  // 扇 1 本の <path d> を経路名で取り出す
  const pathOf = (s: string, name: string) => s.match(new RegExp(`d="([^"]+)" class="milspec-cu" data-trace="${name}"`))?.[1] ?? '';
  // 扇 6 本の点列を、1 本目の始点の x を引いた相対座標にして並べる(差込口の位置の違いを消して形だけ比べる)
  const fanShape = (s: string, j: number) => {
    const ds = [0, 1, 2, 3, 4, 5].map((k) => pathOf(s, `bp:f${j}r${k}`));
    const x0 = Number(ds[0].match(/-?[\d.]+/)?.[0]);
    return ds.map((d) => (d.match(/-?[\d.]+/g) ?? []).map(Number).map((v, i) => (i % 2 === 0 ? +(v - x0).toFixed(2) : v)).join(',')).join('|');
  };
  it('扇の経路が取り出せる(テスト自身の確認)', () => {
    const s = backplaneSVG({ centers: cents(8), pw: 1000, lpGap: null });
    expect(fanShape(s, 0).split('|').every((p) => p.length > 0)).toBe(true);
  });
  it('差込口ごとに曲がり方が違う(全部同じ形の繰り返しにしない)', () => {
    const s = backplaneSVG({ centers: cents(8), pw: 1000, lpGap: null });
    const shapes = new Set([0, 1, 2, 3, 4, 5, 6].map((j) => fanShape(s, j)));
    expect(shapes.size).toBeGreaterThan(3);
  });
  it('同じ入力なら毎回同じ形(再描画でチラつかない)', () => {
    const o = { centers: cents(8), pw: 1000, lpGap: 3 };
    expect(backplaneSVG(o)).toBe(backplaneSVG(o));
  });
});

describe('meander', () => {
  it('始点と終点が x0 / x1', () => {
    const p = meander(10, 90, 3, 2.4, 2, 1.25);
    expect(p[0]).toEqual([10, 3]); expect(p[p.length - 1]).toEqual([90, 3]);
  });
});
