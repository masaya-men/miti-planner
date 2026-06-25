import { describe, it, expect } from 'vitest';
import { computeCueItems, computeInitialSelection, getDefaultBgColor, isBgLight } from '../utils/pipViewLogic';
import type { TimelineEvent, AppliedMitigation } from '../types';

const evt = (
    id: string,
    time: number,
    target?: 'AoE' | 'MT' | 'ST',
    name = id,
): TimelineEvent => ({
    id,
    time,
    name: { ja: name, en: name, ko: name, zh: name },
    damageType: 'magical',
    target,
} as TimelineEvent);

const miti = (id: string, time: number, ownerId: string, mitigationId: string): AppliedMitigation => ({
    id,
    time,
    ownerId,
    mitigationId,
    duration: 10,
} as AppliedMitigation);

const aaEvt = (id: string, time: number, target: 'MT' | 'ST' = 'MT'): TimelineEvent => ({
    id,
    time,
    name: { ja: 'AA', en: 'AA', ko: 'AA', zh: 'AA' },
    damageType: 'physical',
    target,
} as TimelineEvent);

describe('computeCueItems', () => {
    it('非AA攻撃を全部行にする（軽減ゼロでも）', () => {
        const events = [evt('e1', 10), evt('e2', 20)];
        const result = computeCueItems(events, [], new Set(['MT']));
        expect(result.map(r => r.time)).toEqual([10, 20]);
        expect(result.every(r => r.mitigations.length === 0)).toBe(true);
    });

    it('AAだけの時刻は軽減が無ければ行にしない', () => {
        const events = [aaEvt('a1', 10)];
        const result = computeCueItems(events, [], new Set(['MT']));
        expect(result).toEqual([]);
    });

    it('AAだけの時刻に選択メンバー軽減があれば空欄行(events空)で出す', () => {
        const events = [aaEvt('a1', 10)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result).toHaveLength(1);
        expect(result[0].events).toEqual([]);
        expect(result[0].mitigations.map(m => m.mitigationId)).toEqual(['rampart']);
    });

    it('イベントの無い時刻に選択メンバー軽減があれば空欄行で出す', () => {
        const events = [evt('e1', 20)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result.map(r => r.time)).toEqual([10, 20]);
        const r10 = result.find(r => r.time === 10)!;
        expect(r10.events).toEqual([]);
        expect(r10.mitigations.map(m => m.mitigationId)).toEqual(['rampart']);
    });

    it('実攻撃とAAが同時刻なら events に実攻撃だけ残す', () => {
        const events = [evt('e1', 10, 'AoE'), aaEvt('a1', 10, 'MT')];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result).toHaveLength(1);
        expect(result[0].events.map(e => e.id)).toEqual(['e1']);
    });

    it('メンバー選択は攻撃行に影響せずアイコンのみ絞る／空選択で軽減だけの行は消える', () => {
        const events = [evt('e1', 10), evt('e2', 20)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart'), miti('m2', 30, 'MT', 'reprisal')];
        const sel = computeCueItems(events, mitigations, new Set(['MT']));
        expect(sel.map(r => r.time)).toEqual([10, 20, 30]); // 30 は軽減だけの空欄行
        const none = computeCueItems(events, mitigations, new Set());
        expect(none.map(r => r.time)).toEqual([10, 20]); // 攻撃のみ・30は消える
        expect(none.every(r => r.mitigations.length === 0)).toBe(true);
    });

    it('時刻昇順 + 同時刻は優先度順(AoE>単体>未設定, 同列id昇順)', () => {
        const events = [evt('a-undef', 10, undefined), evt('b-st', 10, 'ST'), evt('c-aoe', 10, 'AoE'), evt('d-mt', 10, 'MT')];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result[0].events.map(e => e.id)).toEqual(['c-aoe', 'b-st', 'd-mt', 'a-undef']);
    });

    it('非選択メンバーの軽減はアイコンに出さない', () => {
        const events = [evt('e1', 10)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart'), miti('m2', 10, 'H1', 'sacred_soil')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result[0].mitigations.map(m => m.mitigationId)).toEqual(['rampart']);
    });
});

describe('computeInitialSelection', () => {
    const activeMembers = [
        { id: 'MT', jobId: 'PLD' },
        { id: 'ST', jobId: 'WAR' },
        { id: 'H1', jobId: 'WHM' },
        { id: 'D1', jobId: 'NIN' },
    ];

    it('returns set with myMemberId when it matches an active member', () => {
        expect(computeInitialSelection('H1', activeMembers)).toEqual(new Set(['H1']));
    });

    it('returns all active member ids when myMemberId is null', () => {
        expect(computeInitialSelection(null, activeMembers)).toEqual(new Set(['MT', 'ST', 'H1', 'D1']));
    });

    it('returns all active member ids when myMemberId is empty string', () => {
        expect(computeInitialSelection('', activeMembers)).toEqual(new Set(['MT', 'ST', 'H1', 'D1']));
    });

    it('returns all active member ids when myMemberId does not match any active member', () => {
        expect(computeInitialSelection('UNKNOWN', activeMembers)).toEqual(new Set(['MT', 'ST', 'H1', 'D1']));
    });

    it('returns empty set when no active members and no myMemberId', () => {
        expect(computeInitialSelection(null, [])).toEqual(new Set());
    });

    it('skips members without jobId (treated as not active)', () => {
        const partial = [
            { id: 'MT', jobId: 'PLD' },
            { id: 'ST', jobId: null },
        ];
        expect(computeInitialSelection(null, partial as any)).toEqual(new Set(['MT']));
    });
});

describe('getDefaultBgColor', () => {
    it('returns dark default when theme=dark and no stored color', () => {
        expect(getDefaultBgColor('dark', null)).toBe('#0F0F10');
    });

    it('returns light default when theme=light and no stored color', () => {
        expect(getDefaultBgColor('light', null)).toBe('#FAFAFA');
    });

    it('prefers stored color over theme default', () => {
        expect(getDefaultBgColor('dark', '#445566')).toBe('#445566');
        expect(getDefaultBgColor('light', '#112233')).toBe('#112233');
    });

    it('falls back to theme default when stored value is invalid', () => {
        expect(getDefaultBgColor('dark', 'not-a-color')).toBe('#0F0F10');
        expect(getDefaultBgColor('light', '#XYZ')).toBe('#FAFAFA');
        expect(getDefaultBgColor('dark', '')).toBe('#0F0F10');
    });
});

describe('isBgLight', () => {
    it('returns true for light backgrounds (#FAFAFA, #FFFFFF)', () => {
        expect(isBgLight('#FAFAFA')).toBe(true);
        expect(isBgLight('#FFFFFF')).toBe(true);
    });

    it('returns false for dark backgrounds (#0F0F10, #000000)', () => {
        expect(isBgLight('#0F0F10')).toBe(false);
        expect(isBgLight('#000000')).toBe(false);
    });

    it('discriminates around the 128 luminance threshold', () => {
        // pure red R=255 → YIQ Y = 76.5 (dark)
        expect(isBgLight('#FF0000')).toBe(false);
        // pure yellow Y = 226.0 (light)
        expect(isBgLight('#FFFF00')).toBe(true);
        // mid-gray #808080 → 128.0, NOT > 128 → false
        expect(isBgLight('#808080')).toBe(false);
        // slightly brighter than mid-gray → true
        expect(isBgLight('#909090')).toBe(true);
    });

    it('returns false for invalid hex (defensive fallback)', () => {
        expect(isBgLight('not-a-color')).toBe(false);
        expect(isBgLight('#XYZ')).toBe(false);
        expect(isBgLight('')).toBe(false);
    });
});
