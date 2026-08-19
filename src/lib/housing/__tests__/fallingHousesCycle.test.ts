import { describe, it, expect } from 'vitest';
import {
  pickHouseCount,
  layoutHouses,
  nearestNeighborOrder,
  buildPathD,
  phaseDurationMs,
  nextPhase,
  MIN_HOUSES,
  MAX_HOUSES,
  FALL_STAGGER_MS,
  FALL_DURATION_MS,
  SETTLE_PAUSE_MS,
  PATH_DRAW_MS,
  WALK_MS,
  HOLD_MS,
  FADE_MS,
} from '../fallingHousesCycle';

describe('fallingHousesCycle (2026-08-19 Allmarksまとめてインポート演出)', () => {
  it('pickHouseCount: 4〜6の範囲に収まる (rng境界値含む)', () => {
    expect(pickHouseCount(() => 0)).toBe(MIN_HOUSES);
    expect(pickHouseCount(() => 0.999)).toBe(MAX_HOUSES);
  });

  it('layoutHouses: 指定件数ぶんの座標を返す', () => {
    const points = layoutHouses(5, () => 0.5);
    expect(points).toHaveLength(5);
    points.forEach((p) => {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    });
  });

  it('layoutHouses: count=0 は空配列', () => {
    expect(layoutHouses(0)).toEqual([]);
  });

  it('nearestNeighborOrder: 全indexを1回ずつ含む順列を返す', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 20, y: 0 },
      { x: 80, y: 0 },
    ];
    const order = nearestNeighborOrder(points);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(order[0]).toBe(0); // 常に index 0 始まり
  });

  it('nearestNeighborOrder: 最近傍から辿るので隣接距離の総和が「発見順」より短いか同等', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }, // 遠い
      { x: 10, y: 0 },  // 近い
    ];
    const order = nearestNeighborOrder(points);
    // 0 の次に近いのは index 2 (距離10) のはず、index 1 (距離100) ではない。
    expect(order[1]).toBe(2);
  });

  it('buildPathD: 2点未満は空文字', () => {
    expect(buildPathD([{ x: 0, y: 0 }], [0])).toBe('');
    expect(buildPathD([], [])).toBe('');
  });

  it('buildPathD: M始まりでQコマンドを点の数-1個含む(直線ではなく曲線)', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const d = buildPathD(points, [0, 1, 2]);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(2);
  });

  it('phaseDurationMs: falling は家の数に応じて伸びる', () => {
    const four = phaseDurationMs('falling', 4);
    const six = phaseDurationMs('falling', 6);
    expect(six).toBeGreaterThan(four);
    expect(four).toBe(3 * FALL_STAGGER_MS + FALL_DURATION_MS + SETTLE_PAUSE_MS);
  });

  it('phaseDurationMs: その他フェーズは固定値', () => {
    expect(phaseDurationMs('path', 5)).toBe(PATH_DRAW_MS);
    expect(phaseDurationMs('walking', 5)).toBe(WALK_MS);
    expect(phaseDurationMs('hold', 5)).toBe(HOLD_MS);
    expect(phaseDurationMs('fading', 5)).toBe(FADE_MS);
  });

  it('nextPhase: falling→path→walking→hold→fading→null の順', () => {
    expect(nextPhase('falling')).toBe('path');
    expect(nextPhase('path')).toBe('walking');
    expect(nextPhase('walking')).toBe('hold');
    expect(nextPhase('hold')).toBe('fading');
    expect(nextPhase('fading')).toBeNull();
  });
});
