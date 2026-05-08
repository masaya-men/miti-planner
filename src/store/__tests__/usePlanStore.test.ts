import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SavedPlan } from '../../types';
import { usePlanStore } from '../usePlanStore';
import { planService } from '../../lib/planService';

vi.mock('../../lib/firebase', () => ({
    db: {},
    auth: {},
    storage: {},
}));

vi.mock('../../lib/planService', () => ({
    planService: {
        fetchUserPlans: vi.fn(async () => []),
        createPlan: vi.fn(async () => undefined),
    },
}));

function makePlan(overrides: Partial<SavedPlan>): SavedPlan {
    return {
        id: 'plan_local_1',
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: 'fru',
        title: 'FRU 練習',
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: { currentLevel: 100 } as any,
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

describe('usePlanStore.importLocalPlans', () => {
    beforeEach(() => {
        usePlanStore.setState({ plans: [], _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() });
        vi.mocked(planService.fetchUserPlans).mockReset();
        vi.mocked(planService.createPlan).mockReset();
        vi.mocked(planService.fetchUserPlans).mockResolvedValue([]);
        vi.mocked(planService.createPlan).mockResolvedValue(undefined);
    });

    it('ローカル 0 件のときは何もせず result を返す', async () => {
        usePlanStore.setState({ plans: [makePlan({ id: 'p1', ownerId: 'discord:U1' })] });
        const result = await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        expect(result).toEqual({ imported: 0, skipped: 0, contentBreakdown: {} });
        expect(planService.createPlan).not.toHaveBeenCalled();
    });

    it('全件取り込み: ストアの local プランがクラウドプランで置き換わる', async () => {
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'l1', title: 'A' }),
                makePlan({ id: 'l2', title: 'B' }),
            ],
        });
        const result = await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        expect(result.imported).toBe(2);
        expect(result.skipped).toBe(0);
        const plans = usePlanStore.getState().plans;
        expect(plans).toHaveLength(2);
        expect(plans.find(p => p.id === 'l1')).toBeUndefined();
        expect(plans.find(p => p.id === 'l2')).toBeUndefined();
        expect(plans.every(p => p.ownerId === 'discord:U1')).toBe(true);
        expect(planService.createPlan).toHaveBeenCalledTimes(2);
    });

    it('部分取り込み: 枠超過分は skipped、ローカル残存', async () => {
        const remote: SavedPlan[] = [1, 2, 3, 4].map(n => makePlan({
            id: `r${n}`, ownerId: 'discord:U1', title: `R${n}`,
        }));
        vi.mocked(planService.fetchUserPlans).mockResolvedValue(remote);
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'l1', title: 'L1' }),
                makePlan({ id: 'l2', title: 'L2' }),
                makePlan({ id: 'l3', title: 'L3' }),
            ],
        });
        const result = await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(2);
        const plans = usePlanStore.getState().plans;
        const localRemaining = plans.filter(p => p.ownerId === 'local');
        expect(localRemaining).toHaveLength(2);
    });

    it('createPlan 失敗時は result から減算しローカル残存', async () => {
        vi.mocked(planService.createPlan)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('Network error'));
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'l1', title: 'A' }),
                makePlan({ id: 'l2', title: 'B' }),
            ],
        });
        const result = await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(1);
        const plans = usePlanStore.getState().plans;
        expect(plans.find(p => p.id === 'l2')?.ownerId).toBe('local');
    });

    it('同名衝突時は (2) で取り込み', async () => {
        const remote: SavedPlan[] = [makePlan({ id: 'r1', ownerId: 'discord:U1', title: 'FRU 練習' })];
        vi.mocked(planService.fetchUserPlans).mockResolvedValue(remote);
        usePlanStore.setState({
            plans: [makePlan({ id: 'l1', title: 'FRU 練習' })],
        });
        await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        const plans = usePlanStore.getState().plans;
        const imported = plans.find(p => p.ownerId === 'discord:U1' && p.title === 'FRU 練習 (2)');
        expect(imported).toBeDefined();
    });
});
