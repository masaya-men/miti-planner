import { describe, it, expect } from 'vitest';
import { computeImportPlan } from '../localImportPlanner';
import type { SavedPlan } from '../types';

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
        data: {} as any,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

describe('computeImportPlan', () => {
    it('ローカル 0 件のときは何も返さない', () => {
        const plan = computeImportPlan({
            localPlans: [],
            totalCount: 0,
            byContentCounts: {},
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport).toEqual([]);
        expect(plan.toSkip).toEqual([]);
        expect(plan.result).toEqual({ imported: 0, skipped: 0, contentBreakdown: {} });
    });

    it('全件枠内なら全部取り込む', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', title: 'A' }),
                makePlan({ id: 'b', title: 'B' }),
                makePlan({ id: 'c', title: 'C' }),
            ],
            totalCount: 0,
            byContentCounts: {},
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport).toHaveLength(3);
        expect(plan.toSkip).toHaveLength(0);
        expect(plan.result.imported).toBe(3);
        expect(plan.result.skipped).toBe(0);
        expect(plan.result.contentBreakdown).toEqual({ fru: { imported: 3, skipped: 0 } });
    });

    it('コンテンツ別上限を超えた分は skip', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', title: 'L1' }),
                makePlan({ id: 'b', title: 'L2' }),
                makePlan({ id: 'c', title: 'L3' }),
            ],
            totalCount: 4,
            byContentCounts: { fru: 4 },
            existingTitlesByContent: new Map([['fru', ['Existing1', 'Existing2', 'Existing3', 'Existing4']]]),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport).toHaveLength(1);
        expect(plan.toSkip).toHaveLength(2);
        expect(plan.result.contentBreakdown).toEqual({ fru: { imported: 1, skipped: 2 } });
    });

    it('合計上限を超えた分は skip', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', contentId: 'fru', title: 'A' }),
                makePlan({ id: 'b', contentId: 'dmu', title: 'B' }),
                makePlan({ id: 'c', contentId: 'top', title: 'C' }),
            ],
            totalCount: 49,
            byContentCounts: { fru: 1, dmu: 1, top: 1 },
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport).toHaveLength(1);
        expect(plan.toSkip).toHaveLength(2);
        expect(plan.result.imported).toBe(1);
        expect(plan.result.skipped).toBe(2);
    });

    it('同名衝突時は (2), (3) で採番する', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', title: 'FRU 練習' }),
                makePlan({ id: 'b', title: 'FRU 練習' }),
            ],
            totalCount: 1,
            byContentCounts: { fru: 1 },
            existingTitlesByContent: new Map([['fru', ['FRU 練習']]]),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport[0].finalTitle).toBe('FRU 練習 (2)');
        expect(plan.toImport[1].finalTitle).toBe('FRU 練習 (3)');
    });

    it('衝突しないタイトルはそのまま', () => {
        const plan = computeImportPlan({
            localPlans: [makePlan({ id: 'a', title: 'Unique Title' })],
            totalCount: 0,
            byContentCounts: {},
            existingTitlesByContent: new Map([['fru', ['Other']]]),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport[0].finalTitle).toBe('Unique Title');
    });

    it('新 ID は元 ID と異なり、複数取り込みで重複しない', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'plan_old_1', title: 'A' }),
                makePlan({ id: 'plan_old_2', title: 'B' }),
                makePlan({ id: 'plan_old_3', title: 'C' }),
            ],
            totalCount: 0,
            byContentCounts: {},
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        const newIds = plan.toImport.map(i => i.newId);
        expect(newIds[0]).not.toBe('plan_old_1');
        expect(new Set(newIds).size).toBe(3);
    });

    it('contentId 違いの上限は別々に管理される', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', contentId: 'fru', title: 'F1' }),
                makePlan({ id: 'b', contentId: 'fru', title: 'F2' }),
                makePlan({ id: 'c', contentId: 'dmu', title: 'D1' }),
            ],
            totalCount: 5,
            byContentCounts: { fru: 5, dmu: 0 },
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.result.contentBreakdown).toEqual({
            fru: { imported: 0, skipped: 2 },
            dmu: { imported: 1, skipped: 0 },
        });
    });
});
