import { describe, it, expect } from 'vitest';
import { HDR_BASE_MW, HDR_CUTS, HDR_BANDS, headerScale, headerScaleFor, mwFor, headerLayout, ventLayout, ventRailRange, ventCarriageX, ventCarriageRun, VENT_RAIL_MIN_X, VENT_PLATE_X } from '../headerGeometry';
import { stretchPlaced } from '../armor/stretch';
import type { PanelSpec, PlacedPanel } from '../armor/types';

type Lay = ReturnType<typeof headerLayout>;
const pn = (l: Lay, name: string): PlacedPanel => l.panels.find((p) => p.name === name)!;
const sp = (l: Lay, name: string): PanelSpec => pn(l, name).spec as PanelSpec;
const absPts = (l: Lay, name: string) => sp(l, name).pts.map(([x, y]) => [x + pn(l, name).x, y + pn(l, name).y]);

describe('headerGeometry(ヘッダーと通気口の座標表)', () => {
  it('縮小率と描画幅', () => {
    expect(HDR_BASE_MW).toBe(1189);
    expect(headerScale(980)).toBeCloseTo(0.824, 3);
    expect(headerScale(1300)).toBe(1);
  });
  it('切れ目: 外枠 700 / 上段 714 / 下段 683、帯は 5 本', () => {
    expect(HDR_CUTS).toEqual({ chs: 700, h3: 714, h5: 683 });
    expect(HDR_BANDS.map((b) => b.cut)).toEqual([700, 714, 700, 683, 700]);
  });
  it('MW=1189: 左右の半分が切れ目で接し、下の板・基板は窓 0', () => {
    const l = headerLayout(1189);
    expect(l.panels.map((p) => p.name)).toEqual(['glow', 'drawer', 'chsL', 'chsR', 'h1', 'h2', 'h3L', 'h3R', 'h4', 'h5L', 'h5R']);
    expect(Math.max(...sp(l, 'h3L').pts.map((p) => p[0]))).toBe(714 - pn(l, 'h3L').x);
    expect(pn(l, 'h3R').x).toBe(714);
    expect(pn(l, 'h5R').x).toBe(683);
    expect(pn(l, 'chsR').x).toBe(700);
    expect(l.drawer.rest).toEqual([683 + 0, 683 + 276]);
    expect(l.frame).toEqual({ w0: 1189, h0: 102, sx: 9999, sy: 9999 });
    expect(l.meter).toEqual({ ix: 518, iw: 310, showClock: true });
  });
  it('MW=1465: 右の半分は全点が +276 平行移動(歪まない)。左は不動', () => {
    const a = headerLayout(1189), b = headerLayout(1465);
    expect(absPts(b, 'h5R')).toEqual(absPts(a, 'h5R').map(([x, y]) => [x + 276, y]));
    expect(absPts(b, 'h3R')).toEqual(absPts(a, 'h3R').map(([x, y]) => [x + 276, y]));
    expect(absPts(b, 'chsR')).toEqual(absPts(a, 'chsR').map(([x, y]) => [x + 276, y]));
    expect(sp(b, 'h5L').pts).toEqual(sp(a, 'h5L').pts);
    expect(pn(b, 'h5L')).toEqual(pn(a, 'h5L'));
    expect(pn(b, 'h4').x).toBe(1108);
    expect(b.meter.iw).toBe(586);
  });
  it('下の板は右に付く: x1 = (MW−1189) + 714 + 60、休む 2 か所は {sidebarOpen, scale} から', () => {
    const o = headerLayout(1189, { sidebarOpen: true, scale: 1 }), c = headerLayout(1465, { sidebarOpen: false, scale: 1 });
    expect(o.drawer.x1).toBe(714 + 60); expect(c.drawer.x1).toBe(276 + 714 + 60);
    expect(o.drawer.rest).toEqual(c.drawer.rest);
    const s = 1000 / 1189, n = headerLayout(mwFor(1276, s), { sidebarOpen: false, scale: s });
    expect(n.drawer.rest[1] - n.drawer.rest[0]).toBeCloseTo(276 / s, 3);
    expect(pn(o, 'drawer').spec).toMatchObject({ kind: 'drawer', x0: 623, x1: 774, shadow: 1, dirt: 2, dark: 1 });
    expect(pn(o, 'glow').spec).toMatchObject({ kind: 'glow', windows: [[6, 46], [54, 98]], glow: 0.55 });
  });
  it('CRT のくぼみは 4px 短い(330)。h5b の経路と H5 中央の継ぎ目線は無い。h3 の継ぎ目は左の板で終わる', () => {
    const l = headerLayout(1465);
    const crt = sp(l, 'h5L').pockets![0].pts;
    expect(Math.max(...crt.map((p) => p[0])) - Math.min(...crt.map((p) => p[0]))).toBe(330);
    expect(l.decor.h5.crt.w).toBe(324);
    expect(l.traces.map((t) => t.name)).toEqual(['h3', 'h5a']);
    expect(l.traces.find((t) => t.name === 'h3')!.d).toBe('M 630 43 H 706');
    expect(sp(l, 'h5L').seams).toEqual(['M 96 5.6 H 336']);
    expect(sp(l, 'h5R').seams).toEqual([]);
    expect(sp(l, 'h3L').seams).toEqual(['M 112 39 H 188']);
  });
  it('stretchPlaced: kind 付きの板は動かさない', () => {
    const p = { x: 683, y: 0, w: 400, h: 102, spec: { kind: 'drawer', x0: 623, x1: 774, rest: [683, 959], bands: HDR_BANDS, shadow: 1, dirt: 2, dark: 1 } } as PlacedPanel;
    expect(stretchPlaced(p, { w0: 1189, h0: 102, sx: 700, sy: 9999 }, 1465, 102)).toBe(p);
  });
  it('キー列と受け皿', () => {
    const l = headerLayout(1465);
    const n = (id: string) => l.keyRows.find((r) => r.id === id)!;
    expect(l.keyRows.map((r) => r.id)).toEqual(['aux', 'com', 'party', 'io', 'members', 'view', 'sort']);
    expect(['aux', 'com', 'party', 'io', 'members', 'view', 'sort'].map((id) => n(id).caps.length)).toEqual([1, 4, 2, 2, 9, 2, 2]);
    expect(n('aux').x).toBe(1122);
    expect(n('members').x).toBe(1465 - 501);
    expect(n('view').x).toBe(1465 - 306);
    expect(n('members').caps.every((c) => c.lip) && n('view').caps.every((c) => c.lip)).toBe(true);
    expect(l.decor.h5.members).toEqual({ x: 1465 - 501, y: 56 });
    expect(l.decor.h5.view).toEqual({ x: 1465 - 306, y: 56 });
    expect(n('sort').caps.every((c) => c.lip)).toBe(true);
    // H4: 受け皿 2 / H5 左: 窪み 1 + 受け皿 2 / H5 右: 受け皿 2(members+view 1 枚 + sort)
    expect(sp(l, 'h4').pockets?.length).toBe(2);
    expect(sp(l, 'h5L').pockets?.length).toBe(3);
    expect(sp(l, 'h5R').pockets?.length).toBe(2);
    expect(sp(l, 'h2').pockets?.[0].fill).toBe('#0c0e10');
    expect(sp(l, 'h5L').pockets?.[0].fill).toBe('#040505');
    // COM の丸キー中心 x
    const xs = n('com').caps.map((c) => { const v = c.pts.map((p) => p[0]); return +((Math.min(...v) + Math.max(...v)) / 2).toFixed(1); });
    expect(xs).toEqual([12, 32.7, 53.3, 74]);
  });
  it('MW=1465 の手計算リテラル(右の半分の板内座標は切れ目から数える・MW に依らない)', () => {
    const l = headerLayout(1465);
    expect(pn(l, 'h5R').x).toBe(683 + 276);
    expect(sp(l, 'h5R').pts).toContainEqual([889 - 683, 0]);
    expect(sp(l, 'h5R').scribes?.[0]).toBe('M 208 8 V 42');
    expect(sp(l, 'h3R').pts).toContainEqual([310 - 196, 18]);
  });
  it('受け皿の先頭点(見本 cluster の式で手計算。右の半分は板の左端 959 を引く)', () => {
    const l = headerLayout(1465);
    const pk = (n: string, k: number) => sp(l, n).pockets![k].pts[0];
    expect(pk('h4', 0)).toEqual([14, 11]);     // aux
    expect(pk('h4', 1)).toEqual([326, 11]);    // com(stadium 先頭 = [72,0] + [254,11])
    expect(pk('h5L', 1)).toEqual([21, 11]);    // party
    expect(pk('h5L', 2)).toEqual([324, 11]);   // io(stadium 先頭 = [48,0] + [276,11])
    expect(pk('h5R', 0)[0]).toBeCloseTo(1465 - 505 + 5 - 959, 6); // members+view = chamRect 先頭 [5,0] + [MW-505, 9.5]
    expect(pk('h5R', 0)[1]).toBeCloseTo(9.5, 6);
    expect(pk('h5R', 1)).toEqual([1287 - 959, 11]);   // sort = [12,0] + [1275,11]
  });
  it('COM 丸キーの y と半径', () => {
    const com = headerLayout(1465).keyRows.find((r) => r.id === 'com')!;
    com.caps.forEach((c) => {
      const xs = c.pts.map((p) => p[0]), ys = c.pts.map((p) => p[1]);
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(14, 6);
      expect((Math.max(...xs) - Math.min(...xs)) / 2).toBeCloseTo(9.6, 6);
    });
  });
  it('1189 未満を渡しても 1189 で描く', () => {
    expect(headerLayout(980).panels).toEqual(headerLayout(1189).panels);
    expect(headerLayout(980).meter.iw).toBe(310);
  });
  it('パス命令が絶対座標だけ', () => {
    const l = headerLayout(1465);
    const specs = l.panels.filter((p) => !('kind' in p.spec)).map((p) => p.spec as PanelSpec);
    const ds = [...specs.flatMap((s) => [...(s.scribes ?? []), ...(s.seams ?? [])]), ...l.traces.map((t) => t.d), ventLayout(1465).leak];
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
  it('台車の走行量: 縮小 1 では今まで通り(画面上 138px)・閉じた位置も MW/2 - 192', () => {
    expect(ventCarriageRun(1189, true, 1)).toBe(138);
    expect(ventCarriageRun(1465, false, 1)).toBe(138);
    expect(ventCarriageX(1465, false, 1)).toBe(1465 / 2 - 192);
    expect(ventRailRange(1189, true, 1)).toEqual({ x: 1189 / 2 - 192 - 138 - 6, w: 252 + 138 + 12 });
  });
  it('狭い画面(960 幅・縮小 0.555): 走行量を縮め、レールの左端は左の板(継ぎ目 190)より右・開閉で画面上一致', () => {
    const s = 0.5551, zo = 660, zc = 660 + 276;
    const mo = mwFor(zo, s), mc = mwFor(zc, s);
    const o = ventRailRange(mo, true, s), c = ventRailRange(mc, false, s);
    expect(VENT_RAIL_MIN_X).toBeGreaterThan(VENT_PLATE_X);
    expect(VENT_RAIL_MIN_X).toBeGreaterThan(161.2 + 6); // 左の刻印 "HDR PNL 1A · DO NOT STEP"(x 70〜161.2)より右
    expect(o.x).toBeGreaterThanOrEqual(VENT_RAIL_MIN_X - 1e-9);
    expect(c.x).toBeGreaterThanOrEqual(VENT_RAIL_MIN_X - 1e-9);
    expect(300 + o.x * s).toBeCloseTo(24 + c.x * s, 0);
    expect(o.w * s).toBeCloseTo(c.w * s, 0);
    // 走行量は縮む(画面上 138 未満)。台車は開いた状態でレールの右端・閉じた状態で左端
    const run = ventCarriageRun(mo, true, s);
    expect(run * s).toBeLessThan(138);
    expect(ventCarriageRun(mc, false, s)).toBeCloseTo(run, 0);
    expect(ventCarriageX(mo, true, s)).toBeCloseTo(o.x + 6 + run);
    expect(300 + ventCarriageX(mo, true, s) * s - run * s).toBeCloseTo(24 + ventCarriageX(mc, false, s) * s, 0);
  });
  it('ventRailRange: 狭い画面(縮小 0.84)でも画面上で一致', () => {
    const s = 1000 / 1189;
    const o = ventRailRange(mwFor(1000, s), true, s), c = ventRailRange(mwFor(1276, s), false, s);
    expect(300 + o.x * s).toBeCloseTo(24 + c.x * s, 0);
    expect(o.w * s).toBeCloseTo(c.w * s, 0);
  });

  it('上の板の切れ目の切り口(machinedEdge)を、帯の高さが 8px 以上の切れ目(714 / 683)の左右の板に載せる。外枠(700)は無し', () => {
    const l = headerLayout(HDR_BASE_MW);
    for (const n of ['h3L', 'h3R', 'h5L', 'h5R']) expect(sp(l, n).extra, n).toContain('fill="#0c0e10"');
    expect(sp(l, 'chsL').extra).toBeUndefined();
    // L は切れ目 − 板の x の位置(暗い帯 1.6px の左端 = 切れ目 − 1.6)、R は板の左端(0)から
    expect(sp(l, 'h3L').extra).toContain(`<rect x="${HDR_CUTS.h3 - pn(l, 'h3L').x - 1.6}"`);
    expect(sp(l, 'h5L').extra).toContain(`<rect x="${HDR_CUTS.h5 - 1.6}"`);
    expect(sp(l, 'h3R').extra).toContain('<rect x="0"');
  });
});
