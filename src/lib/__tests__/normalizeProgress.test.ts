import { describe, it, expect } from 'vitest';
import { normalizeProgress } from '../progressLogic';

describe('normalizeProgress', () => {
  it('undefined/null → 空 progress', () => {
    expect(normalizeProgress(undefined)).toEqual({ points: [], cleared: false, activeDays: undefined, activeHours: undefined });
    expect(normalizeProgress(null)).toEqual({ points: [], cleared: false, activeDays: undefined, activeHours: undefined });
  });
  it('新形式(points) はそのまま保持(id は自動採番で付与される)', () => {
    // normalizeProgress は id なしの点に id を採番する。id 以外のフィールドが保持されることを検証。
    const p = { points: [{ ts: 5, reachedPos: 120 }], cleared: true, activeDays: 3, activeHours: 6 };
    const result = normalizeProgress(p);
    expect(result.cleared).toBe(true);
    expect(result.activeDays).toBe(3);
    expect(result.activeHours).toBe(6);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({ ts: 5, reachedPos: 120 });
    expect(typeof result.points[0].id).toBe('string');
  });
  it('旧形式(dailyBest) → points へ順序維持で救済(id は自動採番)', () => {
    const r = normalizeProgress({ dailyBest: [{ reachedPos: 30 }, { reachedPos: 90 }] });
    expect(r.points).toHaveLength(2);
    expect(r.points[0]).toMatchObject({ ts: 1, reachedPos: 30 });
    expect(r.points[1]).toMatchObject({ ts: 2, reachedPos: 90 });
    expect(r.cleared).toBe(false);
  });
  it('points も dailyBest も無い → 空 points', () => {
    expect(normalizeProgress({ cleared: false }).points).toEqual([]);
  });
  it('不正な reachedPos は 0 にフォールバック(id は自動採番)', () => {
    const pts = normalizeProgress({ dailyBest: [{ reachedPos: 'x' as unknown as number }] }).points;
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ ts: 1, reachedPos: 0 });
  });
});
