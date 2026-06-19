import { describe, it, expect } from 'vitest';
import { normalizeProgress } from '../progressLogic';

describe('normalizeProgress', () => {
  it('undefined/null → 空 progress', () => {
    expect(normalizeProgress(undefined)).toEqual({ points: [], cleared: false, activeDays: undefined, activeHours: undefined });
    expect(normalizeProgress(null)).toEqual({ points: [], cleared: false, activeDays: undefined, activeHours: undefined });
  });
  it('新形式(points) はそのまま保持', () => {
    const p = { points: [{ ts: 5, reachedPos: 120 }], cleared: true, activeDays: 3, activeHours: 6 };
    expect(normalizeProgress(p)).toEqual(p);
  });
  it('旧形式(dailyBest) → points へ順序維持で救済', () => {
    const r = normalizeProgress({ dailyBest: [{ reachedPos: 30 }, { reachedPos: 90 }] });
    expect(r.points).toEqual([{ ts: 1, reachedPos: 30 }, { ts: 2, reachedPos: 90 }]);
    expect(r.cleared).toBe(false);
  });
  it('points も dailyBest も無い → 空 points', () => {
    expect(normalizeProgress({ cleared: false }).points).toEqual([]);
  });
  it('不正な reachedPos は 0 にフォールバック', () => {
    expect(normalizeProgress({ dailyBest: [{ reachedPos: 'x' as unknown as number }] }).points).toEqual([{ ts: 1, reachedPos: 0 }]);
  });
});
