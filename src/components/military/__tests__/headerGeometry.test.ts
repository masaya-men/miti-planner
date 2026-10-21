import { describe, it, expect } from 'vitest';
import { HDR_BASE_MW, headerScale, layoutMW, headerLayout, ventLayout } from '../headerGeometry';
import { stretchPlaced } from '../armor/stretch';

describe('headerGeometry(ヘッダーと通気口の座標表)', () => {
  it('縮小率と描画幅', () => {
    expect(HDR_BASE_MW).toBe(1189);
    expect(headerScale(980)).toBeCloseTo(0.824, 3);
    expect(headerScale(1300)).toBe(1);
    expect(layoutMW(980)).toBe(1189);
    expect(layoutMW(1465)).toBe(1465);
  });
  it('MW=1189', () => {
    const l = headerLayout(1189);
    expect(l.frame).toEqual({ w0: 1189, h0: 102, sx: 700, sy: 9999 });
    expect(l.panels.length).toBe(6);
    expect(l.meter).toEqual({ ix: 518, iw: 310, showClock: true });
    expect(l.traces.map((t) => t.name)).toEqual(['h3', 'h5a']);
    expect(l.panels[3].w).toBe(310);
    expect(l.panels[5].y).toBe(52);
  });
  it('MW=1465', () => {
    const l = headerLayout(1465);
    expect(l.panels[4].x).toBe(1108);
    expect(l.meter.iw).toBe(586);
    expect(l.traces.find((t) => t.name === 'h5b')?.d).toBe('M 690 57.6 H 951');
    expect(l.traces.find((t) => t.name === 'h3')?.d).toBe('M 630 43 H 984');
  });
  it('1189 で作って stretchPlaced で伸ばしたものと pts が一致', () => {
    const base = headerLayout(1189), l = headerLayout(1465);
    base.panels.forEach((p, i) => {
      const s = stretchPlaced(p, base.frame, 1465, 102);
      expect(l.panels[i].x).toBe(s.x);
      expect(l.panels[i].w).toBe(s.w);
      expect(l.panels[i].spec.pts).toEqual(s.spec.pts);
      expect(l.panels[i].spec.scribes).toEqual(s.spec.scribes);
      expect(l.panels[i].spec.wx).toEqual(s.spec.wx);
    });
  });
  it('キー列と受け皿', () => {
    const l = headerLayout(1465);
    const n = (id: string) => l.keyRows.find((r) => r.id === id)!;
    expect(l.keyRows.map((r) => r.id)).toEqual(['aux', 'com', 'party', 'io', 'mainstream', 'gear', 'sort']);
    expect(['aux', 'com', 'party', 'io', 'mainstream', 'gear', 'sort'].map((id) => n(id).caps.length)).toEqual([1, 4, 2, 2, 1, 1, 2]);
    expect(n('aux').x).toBe(1122);
    expect(n('mainstream').x).toBe(963);
    expect(n('sort').caps.every((c) => c.lip)).toBe(true);
    // H4: 受け皿 2 / H5: 窪み 1 + 受け皿 5
    expect(l.panels[4].spec.pockets?.length).toBe(2);
    expect(l.panels[5].spec.pockets?.length).toBe(6);
    expect(l.panels[2].spec.pockets?.[0].fill).toBe('#0c0e10');
    expect(l.panels[5].spec.pockets?.[0].fill).toBe('#040505');
    // COM の丸キー中心 x
    const xs = n('com').caps.map((c) => { const v = c.pts.map((p) => p[0]); return +((Math.min(...v) + Math.max(...v)) / 2).toFixed(1); });
    expect(xs).toEqual([12, 32.7, 53.3, 74]);
  });
  it('パス命令が絶対座標だけ', () => {
    const l = headerLayout(1465);
    const ds = [...l.panels.flatMap((p) => [...(p.spec.scribes ?? []), ...(p.spec.seams ?? [])]), ...l.traces.map((t) => t.d), ventLayout(1465).leak];
    expect(ds.length).toBeGreaterThan(6);
    ds.forEach((d) => expect(d).toMatch(/^[MLHV0-9 .\-]+$/));
  });
  it('通気口', () => {
    const v = ventLayout(1189);
    expect(v.xb0).toBe(405);
    expect(v.xb1).toBe(533);
    expect(v.chanL).toEqual({ x: 190, w: 207 });
    expect(v.chanR).toEqual({ x: 541, w: 484 });
    expect(v.pull).toEqual({ x: 568.5, w: 52 });
    expect(v.pullLabelX).toBe(624.5);
    expect(v.hazR).toBe(1127);
    expect(v.pnX).toBe(1037);
    expect(v.leak).toBe('M 0 -1.2 H 1189');
    expect(ventLayout(1465).xb0).toBe(543);
  });
});
