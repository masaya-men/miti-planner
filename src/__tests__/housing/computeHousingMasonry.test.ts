import { describe, it, expect } from 'vitest';
import { computeHousingMasonry } from '../../lib/housing/computeHousingMasonry';

describe('computeHousingMasonry', () => {
  it('空配列は totalHeight 0', () => {
    const r = computeHousingMasonry({ cards: [], containerWidth: 800, gap: 12, targetColumnUnit: 220 });
    expect(r.totalHeight).toBe(0);
    expect(r.positions).toEqual({});
  });

  it('コンテナ幅から列数を算出 (≈220px 目安)', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, aspectRatio: 1 }));
    expect(computeHousingMasonry({ cards: mk(1), containerWidth: 480, gap: 12, targetColumnUnit: 220 }).columnCount).toBe(2);
    expect(computeHousingMasonry({ cards: mk(1), containerWidth: 720, gap: 12, targetColumnUnit: 220 }).columnCount).toBe(3);
    expect(computeHousingMasonry({ cards: mk(1), containerWidth: 1100, gap: 12, targetColumnUnit: 220 }).columnCount).toBe(4);
  });

  it('列幅は gap を差し引いて均等', () => {
    const r = computeHousingMasonry({ cards: [{ id: 'a', aspectRatio: 1 }], containerWidth: 812, gap: 12, targetColumnUnit: 220 });
    expect(r.columnCount).toBe(3);
    expect(r.columnWidth).toBeCloseTo((812 - 24) / 3, 5);
  });

  it('高さ = 列幅 ÷ 縦横比', () => {
    const r = computeHousingMasonry({ cards: [{ id: 'a', aspectRatio: 2 }], containerWidth: 224, gap: 12, targetColumnUnit: 220 });
    expect(r.columnCount).toBe(1);
    expect(r.positions.a.w).toBeCloseTo(224, 5);
    expect(r.positions.a.h).toBeCloseTo(112, 5);
    expect(r.positions.a.x).toBe(0);
    expect(r.positions.a.y).toBe(0);
  });

  it('最短列に配置する (2列で高さ差を埋める)', () => {
    const r = computeHousingMasonry({
      cards: [
        { id: 'a', aspectRatio: 0.5 },
        { id: 'b', aspectRatio: 2 },
        { id: 'c', aspectRatio: 2 },
      ],
      containerWidth: 480, gap: 12, targetColumnUnit: 220,
    });
    expect(r.columnCount).toBe(2);
    expect(r.positions.a.x).toBe(0);
    expect(r.positions.b.x).toBeCloseTo(r.columnWidth + 12, 5);
    expect(r.positions.c.x).toBeCloseTo(r.positions.b.x, 5);
    expect(r.positions.c.y).toBeGreaterThan(0);
  });

  it('totalHeight は最も低い列の最大 (末尾 gap を除く)', () => {
    const r = computeHousingMasonry({ cards: [{ id: 'a', aspectRatio: 1 }], containerWidth: 224, gap: 12, targetColumnUnit: 220 });
    expect(r.totalHeight).toBeCloseTo(224, 5);
  });
});
