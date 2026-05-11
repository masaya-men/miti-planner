import { describe, it, expect } from 'vitest';
import type { AppliedMitigation, TimelineEvent } from '../../types';
import { hasAnyAstrologianDraw, buildAstrologianAutoInserts } from '../astrologianAutoInsert';

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

    it('イベントが無いとき、 戦闘前 Astral のみ配置 (もしくは空)', () => {
        const inserts = buildAstrologianAutoInserts(member, [], []);
        // 戦闘前 Astral だけは置く (= maxTime 0 でも -3 < 0 で挿入)、 t=9 以降は maxTime=0 だと挿入されない
        const prepull = inserts.find(i => i.time === -3 && i.mitigationId === 'astral_draw');
        expect(prepull).toBeDefined();
        // t=9 以降 (maxTime > 9) のときだけ挿入されるはずなので、 イベント無しでは無い
        expect(inserts.filter(i => i.time >= 9)).toEqual([]);
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
