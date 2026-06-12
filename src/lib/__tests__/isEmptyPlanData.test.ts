import { describe, it, expect } from 'vitest';
import { isEmptyPlanData } from '../isEmptyPlanData';
import type { PlanData } from '../../types';

function makeData(overrides: Partial<PlanData>): PlanData {
    return {
        currentLevel: 100,
        timelineEvents: [],
        timelineMitigations: [],
        phases: [],
        partyMembers: [],
        aaSettings: { damage: 0, type: 'physical', target: 'MT' },
        schAetherflowPatterns: {},
        ...overrides,
    } as PlanData;
}

describe('isEmptyPlanData (空上書きガード判定)', () => {
    it('undefined / null は空とみなす', () => {
        expect(isEmptyPlanData(undefined)).toBe(true);
        expect(isEmptyPlanData(null)).toBe(true);
    });

    it('events/軽減/メンバー/フェーズ がすべて空なら空 (getSnapshot のデフォルトは空)', () => {
        // getSnapshot() は空でも currentLevel 等のキーを持つが、中身ゼロは空判定
        expect(isEmptyPlanData(makeData({}))).toBe(true);
    });

    it('partyMembers が 1 人でもいれば非空', () => {
        expect(isEmptyPlanData(makeData({ partyMembers: [{ id: 'm1' } as any] }))).toBe(false);
    });

    it('timelineEvents があれば非空', () => {
        expect(isEmptyPlanData(makeData({ timelineEvents: [{ id: 'e1' } as any] }))).toBe(false);
    });

    it('timelineMitigations があれば非空', () => {
        expect(isEmptyPlanData(makeData({ timelineMitigations: [{ id: 'mit1' } as any] }))).toBe(false);
    });

    it('phases があれば非空', () => {
        expect(isEmptyPlanData(makeData({ phases: [{ id: 'p1' } as any] }))).toBe(false);
    });
});
