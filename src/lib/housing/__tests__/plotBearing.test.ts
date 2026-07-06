import { describe, it, expect, vi } from 'vitest';

vi.mock('../wardDirections', () => ({ getPlotDirections: vi.fn() }));
import { getPlotDirections } from '../wardDirections';
import { parseCompassBearing, getPlotBearing } from '../plotBearing';

describe('parseCompassBearing', () => {
  it('西 → (-1,0)', () => { expect(parseCompassBearing('西の階段を降りて一つ目の踊り場からジャンプ')).toEqual({ x: -1, y: 0 }); });
  it('北西 → 左上', () => { const v = parseCompassBearing('北西目の前のＳハウス')!; expect(v.x).toBeCloseTo(-Math.SQRT1_2); expect(v.y).toBeCloseTo(-Math.SQRT1_2); });
  it('南東 → 右下', () => { const v = parseCompassBearing('南東ひとつめのＳハウス')!; expect(v.x).toBeCloseTo(Math.SQRT1_2); expect(v.y).toBeCloseTo(Math.SQRT1_2); });
  it('北東 → 右上', () => { const v = parseCompassBearing('北東カーブの坂の途中左のＭハウス')!; expect(v.x).toBeCloseTo(Math.SQRT1_2); expect(v.y).toBeCloseTo(-Math.SQRT1_2); });
  it('修飾付きは先頭語のみ: 北左側 → 北(0,-1)', () => { expect(parseCompassBearing('北左側のＭハウス')).toEqual({ x: 0, y: -1 }); });
  it('空/null → null', () => { expect(parseCompassBearing('')).toBeNull(); expect(parseCompassBearing(null)).toBeNull(); });
});

describe('getPlotBearing', () => {
  it('テキスト方角を優先', () => {
    (getPlotDirections as ReturnType<typeof vi.fn>).mockReturnValue({ aetheryte: 'x', directions: '西の階段' });
    expect(getPlotBearing('Mist', 8, { x: 100, y: 100 }, { x: 50, y: 120 })).toEqual({ x: -1, y: 0 });
  });
  it('テキスト無し → origin→door の単位ベクトル', () => {
    (getPlotDirections as ReturnType<typeof vi.fn>).mockReturnValue({ aetheryte: 'x', directions: '' });
    expect(getPlotBearing('Goblet', 40, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 1, y: 0 });
  });
  it('directions=null(データ欠落) → フォールバック', () => {
    (getPlotDirections as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const v = getPlotBearing('Mist', 99, { x: 0, y: 0 }, { x: 0, y: 5 });
    expect(v).toEqual({ x: 0, y: 1 });
  });
});
