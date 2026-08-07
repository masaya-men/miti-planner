import { describe, it, expect } from 'vitest';
import { shouldRestoreMitigationFromPlan } from '../bootstrapMitigation';
import type { PlanData, SavedPlan } from '../../types';

function emptyData(): PlanData {
    return {
        currentLevel: 100,
        timelineEvents: [],
        timelineMitigations: [],
        phases: [],
        partyMembers: [],
        aaSettings: { damage: 0, type: 'physical', target: 'MT' },
        schAetherflowPatterns: {},
    } as PlanData;
}

function nonEmptyData(): PlanData {
    return { ...emptyData(), partyMembers: [{ id: 'm1' } as any] } as PlanData;
}

function makePlan(data: PlanData): SavedPlan {
    return {
        id: 'fixed', ownerId: 'local', ownerDisplayName: 'Guest', contentId: 'fru',
        title: 'T', isPublic: false, copyCount: 0, useCount: 0, data,
        createdAt: 0, updatedAt: 0,
    } as SavedPlan;
}

/**
 * 起動時 desync 復旧 (hydration gate / bootstrapping):
 * currentPlanId は非空プランを指すのに作業ストアが空 = desync → プランデータを復元すべき。
 * 2026-08-07データ安全監査: 札(loadedPlanId)が currentPlanId と食い違うときも復元すべき。
 */
describe('shouldRestoreMitigationFromPlan (起動時 desync 復旧判定)', () => {
    it('非空プランを指すのに作業ストアが空なら復元すべき (desync 検出)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: emptyData(),
            loadedPlanId: null,
        })).toBe(true);
    });

    it('作業ストアが非空なら復元しない (= 通常リロード時の最新編集を捨てない)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: nonEmptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('プランも空なら復元しない (復元しても無意味)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(emptyData()),
            mitigationSnapshot: emptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('currentPlanId が null なら復元しない', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: null,
            plan: undefined,
            mitigationSnapshot: emptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('プランが見つからない (undefined) なら復元しない', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: undefined,
            mitigationSnapshot: emptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('札が未設定(null)・作業ストア非空 → 復元しない(この修正配信直後の全既存ユーザーの初回起動と同じ状態。データを一切触らない)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: nonEmptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('札が currentPlanId と食い違う・作業ストア非空 → 復元すべき(データ安全監査⑤: マルチタブ desync 検出)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: nonEmptyData(),
            loadedPlanId: 'other-plan',
        })).toBe(true);
    });

    it('札が currentPlanId と一致・作業ストア非空 → 復元しない(正常な状態)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: nonEmptyData(),
            loadedPlanId: 'fixed',
        })).toBe(false);
    });
});
