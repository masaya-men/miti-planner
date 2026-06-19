import { describe, it, expect } from 'vitest';
import { stripSharedPersonalData } from '../sharePrivacy';

describe('stripSharedPersonalData', () => {
    const fullPlan = {
        currentLevel: 90,
        timelineEvents: [{ id: 'e', time: 100 }],
        timelineMitigations: [{ id: 'm' }],
        phases: [{ id: 'p', name: 'P1', startTime: 0 }],
        partyMembers: [{ id: 'a', jobId: 'whm' }],
        aaSettings: { damage: 1, type: 'physical', target: 'MT' },
        schAetherflowPatterns: {},
        myMemberId: 'a',
        memos: [{ id: 'memo1', text: '個人的なメモ' }],
        progress: { points: [{ ts: 1, reachedPos: 50 }], cleared: true, activeDays: 3, activeHours: 2 },
    };

    it('progress と memos を除去する', () => {
        const out = stripSharedPersonalData(fullPlan) as Record<string, unknown>;
        expect(out.progress).toBeUndefined();
        expect(out.memos).toBeUndefined();
        expect('progress' in out).toBe(false);
        expect('memos' in out).toBe(false);
    });

    it('それ以外のプラン内容は保持する', () => {
        const out = stripSharedPersonalData(fullPlan) as Record<string, unknown>;
        expect(out.currentLevel).toBe(90);
        expect(out.timelineEvents).toEqual(fullPlan.timelineEvents);
        expect(out.timelineMitigations).toEqual(fullPlan.timelineMitigations);
        expect(out.phases).toEqual(fullPlan.phases);
        expect(out.partyMembers).toEqual(fullPlan.partyMembers);
        expect(out.aaSettings).toEqual(fullPlan.aaSettings);
        expect(out.myMemberId).toBe('a');
    });

    it('非破壊（入力オブジェクトは変更しない）', () => {
        stripSharedPersonalData(fullPlan);
        expect(fullPlan.progress).toBeDefined();
        expect(fullPlan.memos).toBeDefined();
    });

    it('progress/memos を持たないプランでも安全（既存未マイグレ）', () => {
        const minimal = { currentLevel: 80, timelineEvents: [] };
        const out = stripSharedPersonalData(minimal) as Record<string, unknown>;
        expect(out).toEqual(minimal);
        expect('progress' in out).toBe(false);
        expect('memos' in out).toBe(false);
    });

    it('null/undefined/非オブジェクトはそのまま返す', () => {
        expect(stripSharedPersonalData(null)).toBeNull();
        expect(stripSharedPersonalData(undefined)).toBeUndefined();
        expect(stripSharedPersonalData('x' as unknown)).toBe('x');
    });
});
