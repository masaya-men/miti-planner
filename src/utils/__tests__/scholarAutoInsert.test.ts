import { describe, it, expect } from 'vitest';
import { buildScholarAutoInserts, buildAetherflowChainFrom, hasAnyAetherflow } from '../scholarAutoInsert';
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

    it('既存 aetherflow とリキャスト 60s 衝突する位置にはスキップ（t=15 の場合 t=13/t=73 がスキップされ t=133, 193 のみ）', () => {
        const existing: AppliedMitigation[] = [
            { id: 'y', mitigationId: 'aetherflow', ownerId: 'H1', time: 15, duration: 1 }
        ];
        const inserts = buildScholarAutoInserts('H1', existing, [makeEvent(200)]);
        const afTimes = inserts.filter(m => m.mitigationId === 'aetherflow').map(m => m.time);
        expect(afTimes).toEqual([133, 193]);
    });

    it('既存 aetherflow とリキャスト 60s ちょうどの位置は配置 OK', () => {
        // 既存 t=13、新規候補 t=73 → 差 60 → リキャスト切れる瞬間なので配置 OK
        const existing: AppliedMitigation[] = [
            { id: 'y', mitigationId: 'aetherflow', ownerId: 'H1', time: 13, duration: 1 }
        ];
        const inserts = buildScholarAutoInserts('H1', existing, [makeEvent(100)]);
        const afTimes = inserts.filter(m => m.mitigationId === 'aetherflow').map(m => m.time);
        expect(afTimes).toEqual([73]);
    });

    it('既存 dissipation がリキャスト 120s 衝突する位置にあれば開幕 t=1 はスキップ', () => {
        // 既存 t=50、開幕候補 t=1 → 差 49 < 120 → スキップ
        const existing: AppliedMitigation[] = [
            { id: 'd', mitigationId: 'dissipation', ownerId: 'H1', time: 50, duration: 30 }
        ];
        const inserts = buildScholarAutoInserts('H1', existing, [makeEvent(100)]);
        expect(inserts.filter(m => m.mitigationId === 'dissipation')).toHaveLength(0);
    });

    it('他メンバーの配置は無視する', () => {
        const existing: AppliedMitigation[] = [
            { id: 'z', mitigationId: 'dissipation', ownerId: 'H2', time: 1, duration: 30 }
        ];
        const inserts = buildScholarAutoInserts('H1', existing, [makeEvent(100)]);
        expect(inserts.filter(m => m.mitigationId === 'dissipation')).toHaveLength(1);
    });
});

describe('hasAnyAetherflow', () => {
    it('該当メンバーの aetherflow が無ければ false', () => {
        expect(hasAnyAetherflow('H1', [])).toBe(false);
        const existing: AppliedMitigation[] = [
            { id: 'x', mitigationId: 'dissipation', ownerId: 'H1', time: 1, duration: 30 }
        ];
        expect(hasAnyAetherflow('H1', existing)).toBe(false);
    });

    it('該当メンバーの aetherflow が 1 つでもあれば true', () => {
        const existing: AppliedMitigation[] = [
            { id: 'y', mitigationId: 'aetherflow', ownerId: 'H1', time: 13, duration: 1 }
        ];
        expect(hasAnyAetherflow('H1', existing)).toBe(true);
    });

    it('他メンバーの aetherflow は無視する', () => {
        const existing: AppliedMitigation[] = [
            { id: 'z', mitigationId: 'aetherflow', ownerId: 'H2', time: 13, duration: 1 }
        ];
        expect(hasAnyAetherflow('H1', existing)).toBe(false);
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
