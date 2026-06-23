import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { SavedPlan } from '../../../types';
import { PLAN_LIMITS } from '../../../types/firebase';
import { importWithLimitCheck } from '../importWithLimitCheck';
import { usePlanStore } from '../../../store/usePlanStore';
import { useShareImportFlow } from '../../../store/useShareImportFlow';
import { commitImportedPlan } from '../commitImportedPlan';

vi.mock('../../../store/usePlanStore', () => ({ usePlanStore: { getState: vi.fn() } }));
vi.mock('../../../store/useShareImportFlow', () => ({ useShareImportFlow: { getState: vi.fn() } }));
vi.mock('../commitImportedPlan', () => ({ commitImportedPlan: vi.fn(() => 'newPlanId') }));

const mkPlan = (id: string, contentId: string): SavedPlan => ({
  id, ownerId: 'local', ownerDisplayName: '', title: id, contentId,
  isPublic: false, copyCount: 0, useCount: 0, data: {} as any, createdAt: 0, updatedAt: 0,
});

const result = {
  timelineEvents: [], timelineMitigations: [], phases: [], labels: [], party: [], skipped: [],
} as any;

const setPlans = (plans: SavedPlan[]) =>
  (usePlanStore.getState as Mock).mockReturnValue({ plans });

let setLimitContext: Mock;
beforeEach(() => {
  vi.clearAllMocks();
  setLimitContext = vi.fn();
  (useShareImportFlow.getState as Mock).mockReturnValue({ setLimitContext });
  (commitImportedPlan as Mock).mockReturnValue('newPlanId');
});

describe('importWithLimitCheck', () => {
  it('上限内なら setLimitContext を呼ばず即 commit、true を返す', async () => {
    setPlans([mkPlan('p1', 'fru')]);
    const committed = await importWithLimitCheck(result, 'fru', 'タイトル');
    expect(committed).toBe(true);
    expect(setLimitContext).not.toHaveBeenCalled();
    expect(commitImportedPlan).toHaveBeenCalledWith(result, { contentId: 'fru', title: 'タイトル' });
  });

  it('max_per_content 到達なら setLimitContext を {reason, contentId} で呼ぶ', async () => {
    setPlans(Array.from({ length: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }, (_, i) => mkPlan(`p${i}`, 'fru')));
    const promise = importWithLimitCheck(result, 'fru', 'タイトル');
    await Promise.resolve();
    expect(setLimitContext).toHaveBeenCalledTimes(1);
    const ctx = setLimitContext.mock.calls[0][0];
    expect(ctx.reason).toBe('max_per_content');
    expect(ctx.contentId).toBe('fru');
    expect(ctx.neededCount).toBe(1);
    ctx.resolve('resolved');
    expect(await promise).toBe(true);
    expect(commitImportedPlan).toHaveBeenCalledWith(result, { contentId: 'fru', title: 'タイトル' });
  });

  it('max_total 到達なら contentId=null で呼ぶ', async () => {
    setPlans(Array.from({ length: PLAN_LIMITS.MAX_TOTAL_PLANS }, (_, i) => mkPlan(`p${i}`, `c${i}`)));
    const promise = importWithLimitCheck(result, 'newContent', 'タイトル');
    await Promise.resolve();
    const ctx = setLimitContext.mock.calls[0][0];
    expect(ctx.reason).toBe('max_total');
    expect(ctx.contentId).toBeNull();
    ctx.resolve('resolved');
    await promise;
  });

  it('cancelled なら commit せず false を返す', async () => {
    setPlans(Array.from({ length: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }, (_, i) => mkPlan(`p${i}`, 'fru')));
    const promise = importWithLimitCheck(result, 'fru', 'タイトル');
    await Promise.resolve();
    const ctx = setLimitContext.mock.calls[0][0];
    ctx.resolve('cancelled');
    expect(await promise).toBe(false);
    expect(commitImportedPlan).not.toHaveBeenCalled();
  });
});
