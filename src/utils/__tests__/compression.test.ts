import { describe, it, expect } from 'vitest';
import { compressPlanData, decompressPlanData } from '../compression';
import type { PlanData } from '../../types';

const samplePlanData: PlanData = {
    currentLevel: 100,
    timelineEvents: [],
    timelineMitigations: [],
    phases: [{ id: 'p1', name: { ja: 'Phase 1', en: 'Phase 1' }, startTime: 0, endTime: 60 }],
    labels: [],
    partyMembers: [],
    aaSettings: { damage: 5000, type: 'physical', target: 'MT' },
    schAetherflowPatterns: {},
    myMemberId: null,
};

describe('compression', () => {
    it('compressPlanData は base64 文字列を返す', async () => {
        const compressed = await compressPlanData(samplePlanData);
        expect(typeof compressed).toBe('string');
        expect(compressed.length).toBeGreaterThan(0);
        expect(compressed.length).toBeLessThan(JSON.stringify(samplePlanData).length * 2);
    });

    it('decompressPlanData で元データに復元できる', async () => {
        const compressed = await compressPlanData(samplePlanData);
        const decompressed = await decompressPlanData(compressed);
        expect(decompressed).toEqual(samplePlanData);
    });

    it('空の配列を持つデータでも正常に動作する', async () => {
        const minimal: PlanData = {
            currentLevel: 90,
            timelineEvents: [],
            timelineMitigations: [],
            phases: [],
            partyMembers: [],
            aaSettings: { damage: 0, type: 'physical', target: 'MT' },
            schAetherflowPatterns: {},
        };
        const compressed = await compressPlanData(minimal);
        const decompressed = await decompressPlanData(compressed);
        expect(decompressed).toEqual(minimal);
    });
});
