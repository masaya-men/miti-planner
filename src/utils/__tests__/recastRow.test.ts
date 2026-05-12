import { describe, it, expect } from 'vitest';
import type { AppliedMitigation, Mitigation } from '../../types';
import { getActiveRecasts, selectVisibleByLimit, calculateAngle } from '../recastRow';

const makeMitigation = (id: string, recast: number): Mitigation => ({
  id, jobId: 'WAR', name: { ja: id, en: id }, icon: '/icons/' + id + '.png',
  recast, duration: 10, type: 'all', value: 10,
});

const makePlacement = (id: string, mitigationId: string, time: number, ownerId = 'T1'): AppliedMitigation => ({
  id, mitigationId, time, ownerId, duration: 0,
});

describe('calculateAngle', () => {
  it('returns 0deg when no time elapsed (remaining = recast)', () => {
    expect(calculateAngle(60, 60)).toBe(0);
  });
  it('returns 180deg at half elapsed', () => {
    expect(calculateAngle(30, 60)).toBeCloseTo(180);
  });
  it('returns ~360deg when almost expired', () => {
    expect(calculateAngle(0.01, 60)).toBeCloseTo(360, 0);
  });
  it('clamps to [0, 360]', () => {
    expect(calculateAngle(-10, 60)).toBe(360);
    expect(calculateAngle(100, 60)).toBe(0);
  });
  it('returns 0 when recastSec is 0 or negative', () => {
    expect(calculateAngle(0, 0)).toBe(0);
    expect(calculateAngle(10, -5)).toBe(0);
  });
});

describe('getActiveRecasts', () => {
  const defs = [makeMitigation('holmgang', 240), makeMitigation('thrill', 90)];

  it('includes a skill placed in the past that is still on CD', () => {
    const placements = [makePlacement('p1', 'holmgang', 0)];
    const result = getActiveRecasts(placements, defs, 60);
    expect(result).toHaveLength(1);
    expect(result[0].mitigationId).toBe('holmgang');
    expect(result[0].remaining).toBe(180);
  });

  it('excludes skills whose CD has already expired', () => {
    const placements = [makePlacement('p1', 'thrill', 0)];
    const result = getActiveRecasts(placements, defs, 100);
    expect(result).toHaveLength(0);
  });

  it('excludes skills placed in the future (currentTime < placementTime)', () => {
    const placements = [makePlacement('p1', 'thrill', 200)];
    const result = getActiveRecasts(placements, defs, 60);
    expect(result).toHaveLength(0);
  });

  it('uses the most recent placement when the same skill is placed multiple times', () => {
    const placements = [
      makePlacement('p1', 'thrill', 0),
      makePlacement('p2', 'thrill', 100),
    ];
    const result = getActiveRecasts(placements, defs, 120);
    expect(result).toHaveLength(1);
    expect(result[0].remaining).toBe(70);
  });

  it('returns placements sorted by ascending remaining time', () => {
    const placements = [
      makePlacement('p1', 'holmgang', 0),
      makePlacement('p2', 'thrill', 30),
    ];
    const result = getActiveRecasts(placements, defs, 60);
    expect(result[0].mitigationId).toBe('thrill');
    expect(result[1].mitigationId).toBe('holmgang');
  });

  it('excludes mitigations whose def.recast is 0 or negative', () => {
    const zeroRecast = makeMitigation('instant', 0);
    const placements = [makePlacement('p1', 'instant', 0)];
    const result = getActiveRecasts(placements, [zeroRecast], 5);
    expect(result).toHaveLength(0);
  });
});

describe('selectVisibleByLimit', () => {
  it('returns all when count is within limit', () => {
    const actives = [
      { placementId: 'p1', mitigationId: 'a', remaining: 10, placementTime: 0, recast: 60, ownerId: 'T1' },
      { placementId: 'p2', mitigationId: 'b', remaining: 30, placementTime: 5, recast: 60, ownerId: 'T1' },
    ];
    const result = selectVisibleByLimit(actives, 6);
    expect(result).toHaveLength(2);
  });

  it('drops the shortest remaining when over limit', () => {
    const actives = [
      { placementId: 'p1', mitigationId: 'a', remaining: 5,  placementTime: 0, recast: 60, ownerId: 'T1' },
      { placementId: 'p2', mitigationId: 'b', remaining: 30, placementTime: 5, recast: 60, ownerId: 'T1' },
      { placementId: 'p3', mitigationId: 'c', remaining: 60, placementTime: 1, recast: 60, ownerId: 'T1' },
    ];
    const result = selectVisibleByLimit(actives, 2);
    expect(result.map(r => r.mitigationId)).toEqual(['c', 'b']);
  });

  it('reorders the surviving entries by placementTime ascending', () => {
    const actives = [
      { placementId: 'p1', mitigationId: 'a', remaining: 50, placementTime: 30, recast: 60, ownerId: 'T1' },
      { placementId: 'p2', mitigationId: 'b', remaining: 60, placementTime: 10, recast: 60, ownerId: 'T1' },
    ];
    const result = selectVisibleByLimit(actives, 6);
    expect(result.map(r => r.mitigationId)).toEqual(['b', 'a']);
  });

  it('returns empty array when input is empty', () => {
    expect(selectVisibleByLimit([], 6)).toEqual([]);
  });

  it('returns empty array when limit is 0 even if input is non-empty', () => {
    const actives = [
      { placementId: 'p1', mitigationId: 'a', remaining: 30, placementTime: 0, recast: 60, ownerId: 'T1' },
    ];
    expect(selectVisibleByLimit(actives, 0)).toEqual([]);
  });
});
