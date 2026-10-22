import { describe, it, expect } from 'vitest';
import { HDR_BASE_MW, headerScale, headerScaleFor, mwFor, layoutMW, headerLayout, ventLayout, ventRailRange, ventCarriageX } from '../headerGeometry';
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
  it('MW=1465 の手計算リテラル', () => {
    const l = headerLayout(1465);
    expect(l.panels[5].spec.pts[1]).toEqual([1165, 0]);
    expect(l.panels[5].spec.pts[2]).toEqual([1171, -4]);
    expect(l.panels[5].spec.scribes?.[0]).toBe('M 1167 8 V 42');
    expect(l.panels[3].spec.pts).toContainEqual([586, 18]);
    expect(l.panels[3].spec.seams?.[0]).toBe('M 112 39 H 466');
    expect(l.panels[5].spec.seams).toContain('M 690 5.6 H 951');
  });
  it('受け皿の先頭点(見本 cluster の式で手計算)', () => {
    const l = headerLayout(1465);
    const pk = (i: number, k: number) => l.panels[i].spec.pockets![k].pts[0];
    expect(pk(4, 0)).toEqual([14, 11]);     // aux
    expect(pk(4, 1)).toEqual([326, 11]);    // com(stadium 先頭 = [72,0] + [254,11])
    expect(pk(5, 1)).toEqual([21, 11]);     // party
    expect(pk(5, 2)).toEqual([324, 11]);    // io(stadium 先頭 = [48,0] + [276,11])
    expect(pk(5, 3)).toEqual([973, 11]);    // mainstream = [10,0] + [963,11]
    expect(pk(5, 4)[0]).toBeCloseTo(1212, 6); // gear = [19,0] + [1193,11]
    expect(pk(5, 4)[1]).toBeCloseTo(11, 6);
    expect(pk(5, 5)).toEqual([1287, 11]);   // sort = [12,0] + [1275,11]
  });
  it('COM 丸キーの y と半径', () => {
    const com = headerLayout(1465).keyRows.find((r) => r.id === 'com')!;
    com.caps.forEach((c) => {
      const xs = c.pts.map((p) => p[0]), ys = c.pts.map((p) => p[1]);
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(14, 6);
      expect((Math.max(...xs) - Math.min(...xs)) / 2).toBeCloseTo(9.6, 6);
    });
  });
  it('h5b のしきい値', () => {
    const has = (mw: number) => headerLayout(mw).traces.some((t) => t.name === 'h5b');
    expect(has(1244)).toBe(false);
    expect(has(1245)).toBe(true);
  });
  it('1189 未満を渡しても 1189 で描く', () => {
    expect(headerLayout(980).panels).toEqual(headerLayout(1189).panels);
    expect(headerLayout(980).meter.iw).toBe(310);
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
  it('headerScaleFor: 開状態の幅で縮小率を決め、閉じても同じ値', () => {
    expect(headerScaleFor(1189, true)).toBe(1);
    expect(headerScaleFor(1000, true)).toBeCloseTo(1000 / 1189);
    expect(headerScaleFor(1276, false)).toBeCloseTo(1000 / 1189); // 閉じて 276 広がった
    expect(headerScaleFor(1465, false)).toBe(1);
  });
  it('mwFor: 実幅 ÷ 縮小率(1189 未満にはしない)', () => {
    expect(mwFor(1000, 1000 / 1189)).toBe(1189);
    expect(mwFor(1276, 1000 / 1189)).toBe(Math.round(1276 * 1189 / 1000));
    expect(mwFor(1465, 1)).toBe(1465);
  });
  it('狭い画面で開閉しても、右端の部品の画面上の位置と大きさが変わらない', () => {
    const s = 1000 / 1189; // 開: 区画 1000px / 閉: 1276px、区画の左端は 276px 左へ
    const scrX = (zoneLeft: number, w: number, open: boolean) => zoneLeft + headerScaleFor(w, open) * (mwFor(w, headerScaleFor(w, open)) - 150); // レバー x = MW - 150
    expect(scrX(300, 1000, true)).toBeCloseTo(scrX(24, 1276, false), 0);
    expect(headerScaleFor(1000, true)).toBeCloseTo(s);
  });
  it('ventCarriageX: 格子 xb0 の 2px 手前', () => {
    expect(ventCarriageX(1189)).toBe(1189 / 2 - 192);
    expect(ventCarriageX(1190) + 2).toBe(ventLayout(1190).xb0);
  });
  it('ventRailRange: 開/閉どちらで描いても、画面上の同じ場所・同じ長さ', () => {
    const o = ventRailRange(1189, true, 1), c = ventRailRange(1465, false, 1);
    expect(300 + o.x).toBeCloseTo(24 + c.x); // 区画の左端は 開 300 / 閉 24(1489 画面)
    expect(o.w).toBeCloseTo(c.w);
    expect(o.w).toBeCloseTo(252 + 138 + 12);
  });
  it('ventRailRange: 狭い画面(縮小 0.84)でも画面上で一致', () => {
    const s = 1000 / 1189;
    const o = ventRailRange(mwFor(1000, s), true, s), c = ventRailRange(mwFor(1276, s), false, s);
    expect(300 + o.x * s).toBeCloseTo(24 + c.x * s, 0);
    expect(o.w * s).toBeCloseTo(c.w * s, 0);
  });
});
