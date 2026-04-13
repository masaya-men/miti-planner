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

    it('大規模データ（FRU相当）の往復テスト', async () => {
        // 8人パーティメンバー
        const partyIds = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'] as const;
        const partyMembers: PlanData['partyMembers'] = partyIds.map((id) => ({
            id,
            jobId: 'PLD',
            role: 'tank' as const,
            stats: { hp: 100000, mainStat: 3000, det: 2000, crt: 2500, ten: 1500, ss: 400, wd: 132 },
            computedValues: {},
        }));

        // 約400件のタイムラインイベント
        const timelineEvents: PlanData['timelineEvents'] = Array.from({ length: 400 }, (_, i) => ({
            id: `event-${i}`,
            time: i * 3,
            name: { ja: `スキル${i}`, en: `Skill ${i}` },
            damageType: i % 2 === 0 ? 'magical' : 'physical',
            damageAmount: 50000 + i * 100,
            target: 'AoE' as const,
        }));

        // 約200件の軽減適用
        const timelineMitigations: PlanData['timelineMitigations'] = Array.from({ length: 200 }, (_, i) => ({
            id: `mit-${i}`,
            mitigationId: `reprisal`,
            time: i * 6,
            duration: 10,
            ownerId: partyIds[i % 8],
        }));

        // 複数フェーズ
        const phases: PlanData['phases'] = [
            { id: 'p1', name: { ja: 'フェーズ1', en: 'Phase 1' }, startTime: 0, endTime: 300 },
            { id: 'p2', name: { ja: 'フェーズ2', en: 'Phase 2' }, startTime: 300, endTime: 600 },
            { id: 'p3', name: { ja: 'フェーズ3', en: 'Phase 3' }, startTime: 600, endTime: 900 },
            { id: 'p4', name: { ja: 'フェーズ4', en: 'Phase 4' }, startTime: 900, endTime: 1200 },
        ];

        const largePlanData: PlanData = {
            currentLevel: 100,
            timelineEvents,
            timelineMitigations,
            phases,
            labels: [],
            partyMembers,
            aaSettings: { damage: 120000, type: 'magical', target: 'MT' },
            schAetherflowPatterns: {},
            myMemberId: 'H1',
        };

        const compressed = await compressPlanData(largePlanData);
        const decompressed = await decompressPlanData(compressed);

        // 元データと一致すること
        expect(decompressed).toEqual(largePlanData);

        // 圧縮率が合理的であること（圧縮後のサイズが元の50%未満）
        const originalSize = JSON.stringify(largePlanData).length;
        expect(compressed.length).toBeLessThan(originalSize * 0.5);
    });

    it('圧縮済みプランの共有パス: data=undefined + compressedData から復元できる', async () => {
        // Sidebar.tsx の共有ハンドラと同じ条件分岐を再現
        const original = samplePlanData;
        const compressed = await compressPlanData(original);

        // サイレント圧縮後のプラン状態をシミュレート
        const plan = {
            id: 'plan_1',
            title: 'テスト軽減表',
            contentId: 'fru',
            data: undefined as unknown as PlanData,  // 圧縮済みなのでundefined
            compressedData: compressed,
        };

        // Sidebar.tsx の共有ハンドラと同じ条件分岐
        let planData = plan.data;
        if ((!planData || Object.keys(planData).length === 0) && plan.compressedData) {
            planData = await decompressPlanData(plan.compressedData);
        }

        // 共有データとして渡されるオブジェクト
        const sharePayload = {
            contentId: plan.contentId,
            title: plan.title,
            planData,
        };

        expect(sharePayload.planData).toEqual(original);
        expect(sharePayload.title).toBe('テスト軽減表');
        expect(sharePayload.contentId).toBe('fru');
    });

    it('通常プランの共有パス: data が存在する場合は解凍しない', async () => {
        const plan = {
            id: 'plan_2',
            title: '通常プラン',
            contentId: 'm1s',
            data: samplePlanData,
            compressedData: undefined as string | undefined,
        };

        let planData = plan.data;
        if ((!planData || Object.keys(planData).length === 0) && plan.compressedData) {
            planData = await decompressPlanData(plan.compressedData);
        }

        expect(planData).toEqual(samplePlanData);
    });

    it('複数回の往復（3回）で元データと一致する', async () => {
        let data = samplePlanData;

        for (let i = 0; i < 3; i++) {
            const compressed = await compressPlanData(data);
            data = await decompressPlanData(compressed);
        }

        expect(data).toEqual(samplePlanData);
    });
});
