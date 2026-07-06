import { describe, it, expect } from 'vitest';
import { trimRouteToEndpoints } from '../mapGeometry';

const near = (p: [number, number], x: number, y: number) => {
  expect(p[0]).toBeCloseTo(x, 5);
  expect(p[1]).toBeCloseTo(y, 5);
};

describe('trimRouteToEndpoints', () => {
  const H: [number, number][] = [[0, 0], [10, 0], [20, 0]]; // 水平線 (3頂点)

  it('両端を経路上の投影点に切り詰め、間の頂点は保持する', () => {
    const r = trimRouteToEndpoints(H, { x: 5, y: 5 }, { x: 15, y: 5 });
    expect(r.length).toBe(3);
    near(r[0], 5, 0);   // start投影
    near(r[1], 10, 0);  // 中間頂点保持
    near(r[2], 15, 0);  // end投影
  });

  it('始点側の戻り(スパー)を削る: 始点が先頭頂点より前方なら先頭頂点へ戻らない', () => {
    const r = trimRouteToEndpoints(H, { x: 8, y: 1 }, { x: 18, y: 1 });
    near(r[0], 8, 0);        // (0,0) へ戻らず投影点から開始
    near(r.at(-1)!, 18, 0);
    expect(r.some((p) => p[0] === 0)).toBe(false); // 先頭(0,0)は含まれない
  });

  it('終点側の行き過ぎ(オーバーシュート)を削る: 終点投影より先の頂点を捨てる', () => {
    const r = trimRouteToEndpoints(H, { x: 2, y: 1 }, { x: 12, y: 1 });
    near(r[0], 2, 0);
    near(r.at(-1)!, 12, 0);   // (20,0) まで行き過ぎない
    expect(r.some((p) => p[0] === 20)).toBe(false);
  });

  it('両端が同一セグメント上なら2点だけ返す', () => {
    const r = trimRouteToEndpoints(H, { x: 12, y: 1 }, { x: 18, y: 1 });
    expect(r.length).toBe(2);
    near(r[0], 12, 0);
    near(r[1], 18, 0);
  });

  it('2点未満の経路はそのまま返す(安全)', () => {
    expect(trimRouteToEndpoints([[1, 1]], { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([[1, 1]]);
  });

  it('投影が逆転(終点が始点より手前)なら2点フォールバック', () => {
    // start を末尾寄り(18)、end を先頭寄り(2) にすると posS>posE
    const r = trimRouteToEndpoints(H, { x: 18, y: 1 }, { x: 2, y: 1 });
    expect(r.length).toBe(2);
    near(r[0], 18, 0);
    near(r[1], 2, 0);
  });
});
