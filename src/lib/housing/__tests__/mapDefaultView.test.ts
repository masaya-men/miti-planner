import { describe, it, expect } from 'vitest';
import { routeBbox, computeDefaultView, type Bbox } from '../mapDefaultView';

// viewBox 点 → 変換後の wrap-px 座標（overlay meet 写像 → zoom transform）。テスト内で見切れ判定に使う。
function project(p: { x: number; y: number }, vb: { w: number; h: number }, wrap: { w: number; h: number }, v: { scale: number; tx: number; ty: number }) {
  const m = Math.min(wrap.w / vb.w, wrap.h / vb.h);
  const ox = (wrap.w - vb.w * m) / 2, oy = (wrap.h - vb.h * m) / 2;
  const X = ox + p.x * m, Y = oy + p.y * m;
  return { x: X * v.scale + v.tx, y: Y * v.scale + v.ty };
}
function within(pt: { x: number; y: number }, wrap: { w: number; h: number }) {
  const e = 0.5; // 端の許容 0.5px
  return pt.x >= -e && pt.x <= wrap.w + e && pt.y >= -e && pt.y <= wrap.h + e;
}

const VB = { w: 470, h: 350 };
const WRAP = { w: 600, h: 450 };

describe('routeBbox', () => {
  it('M/L パスと追加点から bbox を得る', () => {
    const b = routeBbox(['M10 20 L100 40', 'M100 40 L60 200'], [{ x: 5, y: 5 }]);
    expect(b).toEqual({ minX: 5, minY: 5, maxX: 100, maxY: 200 });
  });
  it('空/ null 群は null', () => {
    expect(routeBbox([null, undefined, ''])).toBeNull();
  });
});

describe('computeDefaultView — 見切れ厳禁', () => {
  const cases: Bbox[] = [
    { minX: 50, minY: 40, maxX: 300, maxY: 250 },   // 通常
    { minX: 200, minY: 170, maxX: 210, maxY: 175 }, // 極小（起点と家が近い → 最大ズーム側）
    { minX: 0, minY: 0, maxX: 470, maxY: 350 },      // マップ全体（最小ズーム側）
    { minX: 10, minY: 300, maxX: 460, maxY: 320 },   // 横長で下端
  ];
  it.each(cases)('bbox 四隅は変換後 wrap 内に収まる %#', (bbox) => {
    const v = computeDefaultView(bbox, VB, WRAP, 24);
    const corners = [
      { x: bbox.minX, y: bbox.minY }, { x: bbox.maxX, y: bbox.minY },
      { x: bbox.minX, y: bbox.maxY }, { x: bbox.maxX, y: bbox.maxY },
    ];
    for (const c of corners) expect(within(project(c, VB, WRAP, v), WRAP)).toBe(true);
  });
  it('極小 bbox は scale が上限 8 にクランプ', () => {
    const v = computeDefaultView({ minX: 200, minY: 170, maxX: 201, maxY: 171 }, VB, WRAP, 24);
    expect(v.scale).toBe(8);
  });
  it('マップ全体 bbox は scale が下限 1 にクランプ', () => {
    const v = computeDefaultView({ minX: 0, minY: 0, maxX: 470, maxY: 350 }, VB, WRAP, 24);
    expect(v.scale).toBe(1);
  });
});
