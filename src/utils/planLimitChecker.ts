import { PLAN_LIMITS } from '../types/firebase';
import type { SavedPlan } from '../types';

export type PlanLimitReason = 'max_total' | 'max_per_content';

export interface PlanLimitCheckResult {
  exceeded: boolean;
  reason?: PlanLimitReason;
  current: number;
  max: number;
}

export function checkPlanLimit(
  plans: SavedPlan[],
  contentId: string,
): PlanLimitCheckResult {
  const totalCount = plans.length;
  if (totalCount >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
    return {
      exceeded: true,
      reason: 'max_total',
      current: totalCount,
      max: PLAN_LIMITS.MAX_TOTAL_PLANS,
    };
  }
  const contentCount = plans.filter(p => p.contentId === contentId).length;
  if (contentCount >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
    return {
      exceeded: true,
      reason: 'max_per_content',
      current: contentCount,
      max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT,
    };
  }
  return {
    exceeded: false,
    current: contentCount,
    max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT,
  };
}
