import { describe, it, expect } from 'vitest';
import type { AppliedMitigation, TimelineEvent } from '../../types';
import { hasAnyAstrologianDraw, buildAstrologianAutoInserts, buildAstrologianDrawChainFrom } from '../astrologianAutoInsert';

const member = 'H1';

function mkEvent(time: number): TimelineEvent {
    return {
        id: `e_${time}`,
        time,
        name: { ja: 'ダメ', en: 'Dmg' },
        damageType: 'physical',
        damageAmount: 1000,
        target: 'MT',
    } as TimelineEvent;
}

describe('hasAnyAstrologianDraw', () => {
    it('astral_draw が 1 つでもあれば true', () => {
        const mits: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: member, time: 0, duration: 1 } as AppliedMitigation,
        ];
        expect(hasAnyAstrologianDraw(member, mits)).toBe(true);
    });

    it('umbral_draw が 1 つでもあれば true', () => {
        const mits: AppliedMitigation[] = [
            { id: '1', mitigationId: 'umbral_draw', ownerId: member, time: 0, duration: 1 } as AppliedMitigation,
        ];
        expect(hasAnyAstrologianDraw(member, mits)).toBe(true);
    });

    it('他メンバーのドローはカウントしない', () => {
        const mits: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: 'H2', time: 0, duration: 1 } as AppliedMitigation,
        ];
        expect(hasAnyAstrologianDraw(member, mits)).toBe(false);
    });

    it('ドローが無ければ false', () => {
        expect(hasAnyAstrologianDraw(member, [])).toBe(false);
    });
});

describe('buildAstrologianAutoInserts', () => {
    it('空状態から戦闘前 Astral + 9s Umbral + 65s Astral + 60s 毎交互を配置', () => {
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, [], events);

        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'astral_draw', time: -3 },
            { id: 'umbral_draw', time: 9 },
            { id: 'astral_draw', time: 65 },
            { id: 'umbral_draw', time: 125 },
        ]);
    });

    it('戦闘前 Astral Draw のみ autoHidden が立つ', () => {
        const events: TimelineEvent[] = [mkEvent(120)];
        const inserts = buildAstrologianAutoInserts(member, [], events);

        const prepull = inserts.find(i => i.time === -3);
        expect(prepull?.autoHidden).toBe(true);

        const others = inserts.filter(i => i.time !== -3);
        for (const o of others) {
            expect(o.autoHidden).toBeUndefined();
        }
    });

    it('既に astral_draw がある場合は配置をスキップ', () => {
        const existing: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: member, time: 0, duration: 1 } as AppliedMitigation,
        ];
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, existing, events);
        expect(inserts).toEqual([]);
    });

    it('既に umbral_draw がある場合も配置をスキップ', () => {
        const existing: AppliedMitigation[] = [
            { id: '1', mitigationId: 'umbral_draw', ownerId: member, time: 9, duration: 1 } as AppliedMitigation,
        ];
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, existing, events);
        expect(inserts).toEqual([]);
    });

    it('他メンバーのドローは無視して配置する', () => {
        const existing: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: 'H2', time: 0, duration: 1 } as AppliedMitigation,
        ];
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, existing, events);
        expect(inserts.length).toBeGreaterThan(0);
    });

    it('イベントが無いとき、 20分 (1200秒) まで配置される', () => {
        const inserts = buildAstrologianAutoInserts(member, [], []);
        const prepull = inserts.find(i => i.time === -3);
        expect(prepull).toBeDefined();
        // 1200秒までのドローが配置される
        const draws = inserts.filter(i => i.time >= 9);
        expect(draws.length).toBeGreaterThan(0);
        // 最後のドローが1200秒以内であることを確認
        expect(Math.max(...draws.map(d => d.time))).toBeLessThanOrEqual(1200);
    });

    it('全インサートに ownerId と genId 由来の id が入る', () => {
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, [], events);
        for (const i of inserts) {
            expect(i.ownerId).toBe(member);
            expect(i.id).toBeDefined();
            expect(i.id.length).toBeGreaterThan(0);
        }
    });

    it('全インサートに duration が指定されている', () => {
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, [], events);
        for (const i of inserts) {
            expect(i.duration).toBe(1);
        }
    });

    it('長尺コンテンツ (10 分) で 60 秒毎に Astral / Umbral 交互配置', () => {
        const events: TimelineEvent[] = [mkEvent(600)];
        const inserts = buildAstrologianAutoInserts(member, [], events);
        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'astral_draw', time: -3 },
            { id: 'umbral_draw', time: 9 },
            { id: 'astral_draw', time: 65 },
            { id: 'umbral_draw', time: 125 },
            { id: 'astral_draw', time: 185 },
            { id: 'umbral_draw', time: 245 },
            { id: 'astral_draw', time: 305 },
            { id: 'umbral_draw', time: 365 },
            { id: 'astral_draw', time: 425 },
            { id: 'umbral_draw', time: 485 },
            { id: 'astral_draw', time: 545 },
        ]);
    });
});

describe('buildAstrologianDrawChainFrom', () => {
    it('astral_draw を手動配置すると次は umbral_draw から 60s 毎交互', () => {
        const events: TimelineEvent[] = [mkEvent(300)];
        const inserts = buildAstrologianDrawChainFrom(member, 60, 'astral_draw', [], events);
        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'umbral_draw', time: 120 },
            { id: 'astral_draw', time: 180 },
            { id: 'umbral_draw', time: 240 },
            { id: 'astral_draw', time: 300 },
        ]);
    });

    it('umbral_draw を手動配置すると次は astral_draw から 60s 毎交互', () => {
        const events: TimelineEvent[] = [mkEvent(300)];
        const inserts = buildAstrologianDrawChainFrom(member, 60, 'umbral_draw', [], events);
        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'astral_draw', time: 120 },
            { id: 'umbral_draw', time: 180 },
            { id: 'astral_draw', time: 240 },
            { id: 'umbral_draw', time: 300 },
        ]);
    });

    it('最終イベント時刻を超える位置には配置しない', () => {
        const events: TimelineEvent[] = [mkEvent(150)];
        const inserts = buildAstrologianDrawChainFrom(member, 60, 'astral_draw', [], events);
        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'umbral_draw', time: 120 },
        ]);
    });

    it('既存のドローとリキャスト 60s 未満で衝突する位置はスキップ', () => {
        const existing: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: member, time: 60, duration: 1 } as AppliedMitigation,
            // 120s に既存 umbral_draw があるとそこをスキップする
            { id: '2', mitigationId: 'umbral_draw', ownerId: member, time: 120, duration: 1 } as AppliedMitigation,
        ];
        const events: TimelineEvent[] = [mkEvent(300)];
        const inserts = buildAstrologianDrawChainFrom(member, 60, 'astral_draw', existing, events);
        // 120s 位置の umbral_draw は既存なのでスキップ、 180s 以降は配置
        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'astral_draw', time: 180 },
            { id: 'umbral_draw', time: 240 },
            { id: 'astral_draw', time: 300 },
        ]);
    });

    it('他メンバーのドローは衝突判定に含めない', () => {
        const existing: AppliedMitigation[] = [
            { id: '1', mitigationId: 'umbral_draw', ownerId: 'H2', time: 120, duration: 1 } as AppliedMitigation,
        ];
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianDrawChainFrom(member, 60, 'astral_draw', existing, events);
        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'umbral_draw', time: 120 },
            { id: 'astral_draw', time: 180 },
        ]);
    });

    it('startTime 自身は配置しない (startTime + 60 から)', () => {
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianDrawChainFrom(member, 60, 'astral_draw', [], events);
        expect(inserts.some(i => i.time === 60)).toBe(false);
        expect(inserts[0].time).toBe(120);
    });

    it('イベントが無い (maxTime=0) ときは 1200秒 まで配置する', () => {
        const inserts = buildAstrologianDrawChainFrom(member, 60, 'astral_draw', [], []);
        expect(inserts.length).toBeGreaterThan(0);
        expect(Math.max(...inserts.map(i => i.time))).toBeLessThanOrEqual(1200);
    });

    it('全インサートに ownerId と genId 由来の id が入る', () => {
        const events: TimelineEvent[] = [mkEvent(300)];
        const inserts = buildAstrologianDrawChainFrom(member, 60, 'astral_draw', [], events);
        for (const i of inserts) {
            expect(i.ownerId).toBe(member);
            expect(i.id).toBeDefined();
            expect(i.id.length).toBeGreaterThan(0);
            expect(i.duration).toBe(1);
        }
    });
});
