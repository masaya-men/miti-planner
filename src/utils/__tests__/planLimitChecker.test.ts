import { describe, it, expect } from 'vitest';
import { checkPlanLimit } from '../planLimitChecker';
import { PLAN_LIMITS } from '../../types/firebase';
import type { SavedPlan } from '../../types';

const mkPlan = (id: string, contentId: string): SavedPlan => ({
  id,
  ownerId: 'local',
  ownerDisplayName: '',
  title: id,
  contentId,
  isPublic: false,
  copyCount: 0,
  useCount: 0,
  data: {} as any,
  createdAt: 0,
  updatedAt: 0,
});

describe('checkPlanLimit', () => {
  it('returns exceeded=false when under limit', () => {
    const plans = [mkPlan('p1', 'fru'), mkPlan('p2', 'fru')];
    const result = checkPlanLimit(plans, 'fru');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(2);
    expect(result.max).toBe(PLAN_LIMITS.MAX_PLANS_PER_CONTENT);
  });

  it('returns max_per_content when at content limit', () => {
    const plans = Array.from({ length: 5 }, (_, i) => mkPlan(`p${i}`, 'fru'));
    const result = checkPlanLimit(plans, 'fru');
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('max_per_content');
    expect(result.current).toBe(5);
    expect(result.max).toBe(5);
  });

  it('returns max_total when at total limit', () => {
    const plans = Array.from({ length: 50 }, (_, i) => mkPlan(`p${i}`, `c${i}`));
    const result = checkPlanLimit(plans, 'newContent');
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('max_total');
    expect(result.current).toBe(50);
    expect(result.max).toBe(50);
  });

  it('prioritizes max_total over max_per_content', () => {
    // 50 件総 + その中 5 件が同 contentId
    const same = Array.from({ length: 5 }, (_, i) => mkPlan(`p${i}`, 'fru'));
    const others = Array.from({ length: 45 }, (_, i) => mkPlan(`q${i}`, `c${i}`));
    const plans = [...same, ...others];
    const result = checkPlanLimit(plans, 'fru');
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('max_total');
  });

  it('returns exceeded=false for empty plans array', () => {
    const result = checkPlanLimit([], 'fru');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(0);
    expect(result.max).toBe(PLAN_LIMITS.MAX_PLANS_PER_CONTENT);
  });

  it('counts only the specified contentId', () => {
    const plans = [
      mkPlan('p1', 'fru'),
      mkPlan('p2', 'fru'),
      mkPlan('p3', 'tea'),
      mkPlan('p4', 'tea'),
      mkPlan('p5', 'tea'),
    ];
    const result = checkPlanLimit(plans, 'fru');
    expect(result.current).toBe(2);
    expect(result.exceeded).toBe(false);
  });

  it('handles boundary at max-1 (allows one more)', () => {
    const plans = Array.from({ length: 4 }, (_, i) => mkPlan(`p${i}`, 'fru'));
    const result = checkPlanLimit(plans, 'fru');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(4);
  });
});
