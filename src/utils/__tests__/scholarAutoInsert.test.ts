import { describe, it, expect } from 'vitest';
import { buildScholarAutoInserts, buildAetherflowChainFrom } from '../scholarAutoInsert';
import type { AppliedMitigation, TimelineEvent } from '../../types';

const makeEvent = (time: number): TimelineEvent => ({
    id: `evt_${time}`,
    name: { ja: 'E', en: 'E' },
    time,
    damageType: 'magical',
});

describe('buildScholarAutoInserts', () => {
    it('空のタイムラインでも転化 t=1 は挿入される', () => {
        const inserts = buildScholarAutoInserts('H1', [], []);
        expect(inserts.filter(m => m.mitigationId === 'dissipation')).toHaveLength(1);
        expect(inserts.find(m => m.mitigationId === 'dissipation')?.time).toBe(1);
    });

    it('最終イベント 200s まで t=13, 73, 133, 193 の 4 個配置される', () => {
        const events: TimelineEvent[] = [makeEvent(0), makeEvent(200)];
        const inserts = buildScholarAutoInserts('H1', [], events);
        const afs = inserts.filter(m => m.mitigationId === 'aetherflow');
        expect(afs.map(m => m.time).sort((a, b) => a - b)).toEqual([13, 73, 133, 193]);
    });

    it('既に開幕 転化 が置かれていれば追加しない', () => {
        const existing: AppliedMitigation[] = [
            { id: 'x', mitigationId: 'dissipation', ownerId: 'H1', time: 1, duration: 30 }
        ];
        const inserts = buildScholarAutoInserts('H1', existing, [makeEvent(100)]);
        expect(inserts.filter(m => m.mitigationId === 'dissipation')).toHaveLength(0);
    });

    it('既に近傍に aetherflow があれば重複挿入しない', () => {
        const existing: AppliedMitigation[] = [
            { id: 'y', mitigationId: 'aetherflow', ownerId: 'H1', time: 15, duration: 1 }
        ];
        const inserts = buildScholarAutoInserts('H1', existing, [makeEvent(100)]);
        const afTimes = inserts.filter(m => m.mitigationId === 'aetherflow').map(m => m.time);
        expect(afTimes).toEqual([73]);
    });

    it('他メンバーの配置は無視する', () => {
        const existing: AppliedMitigation[] = [
            { id: 'z', mitigationId: 'dissipation', ownerId: 'H2', time: 1, duration: 30 }
        ];
        const inserts = buildScholarAutoInserts('H1', existing, [makeEvent(100)]);
        expect(inserts.filter(m => m.mitigationId === 'dissipation')).toHaveLength(1);
    });
});

describe('buildAetherflowChainFrom', () => {
    it('t=30 から置いた場合、次は t=90, 150... 最終まで', () => {
        const inserts = buildAetherflowChainFrom('H1', 30, [], [makeEvent(200)]);
        expect(inserts.map(m => m.time)).toEqual([90, 150]);
    });

    it('重複する位置はスキップ', () => {
        const existing: AppliedMitigation[] = [
            { id: 'a', mitigationId: 'aetherflow', ownerId: 'H1', time: 90, duration: 1 }
        ];
        const inserts = buildAetherflowChainFrom('H1', 30, existing, [makeEvent(200)]);
        expect(inserts.map(m => m.time)).toEqual([150]);
    });

    it('最終イベントを超える位置は配置しない', () => {
        const inserts = buildAetherflowChainFrom('H1', 30, [], [makeEvent(100)]);
        expect(inserts.map(m => m.time)).toEqual([90]);
    });
});
