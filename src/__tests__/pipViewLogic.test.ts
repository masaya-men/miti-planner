import { describe, it, expect } from 'vitest';
import { computeCueItems, computeInitialSelection, getDefaultBgColor } from '../utils/pipViewLogic';
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

describe('computeCueItems', () => {
    it('returns empty when no member is selected', () => {
        const events = [evt('e1', 10)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        expect(computeCueItems(events, mitigations, new Set())).toEqual([]);
    });

    it('returns only times that have mitigations from selected members', () => {
        const events = [evt('e1', 10), evt('e2', 20), evt('e3', 30)];
        const mitigations = [
            miti('m1', 10, 'MT', 'rampart'),
            miti('m2', 20, 'H1', 'sacred_soil'),
            miti('m3', 30, 'D1', 'feint'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT', 'H1']));
        expect(result.map(r => r.events[0].id)).toEqual(['e1', 'e2']);
    });

    it('merges mitigations from multiple selected members at the same time', () => {
        const events = [evt('e1', 10)];
        const mitigations = [
            miti('m1', 10, 'MT', 'rampart'),
            miti('m2', 10, 'H1', 'sacred_soil'),
            miti('m3', 10, 'D1', 'feint'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT', 'H1', 'D1']));
        expect(result).toHaveLength(1);
        expect(result[0].mitigations.map(m => m.mitigationId)).toEqual(['rampart', 'sacred_soil', 'feint']);
    });

    it('ignores mitigations from non-selected members', () => {
        const events = [evt('e1', 10)];
        const mitigations = [
            miti('m1', 10, 'MT', 'rampart'),
            miti('m2', 10, 'H1', 'sacred_soil'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result[0].mitigations.map(m => m.mitigationId)).toEqual(['rampart']);
    });

    it('sorts groups by time ascending', () => {
        const events = [evt('e1', 30), evt('e2', 10), evt('e3', 20)];
        const mitigations = [
            miti('m1', 30, 'MT', 'rampart'),
            miti('m2', 10, 'MT', 'reprisal'),
            miti('m3', 20, 'MT', 'arms_length'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result.map(r => r.time)).toEqual([10, 20, 30]);
    });

    it('handles event with no mitigation owner match (skipped)', () => {
        const events = [evt('e1', 10), evt('e2', 20)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['H1']));
        expect(result).toEqual([]);
    });

    it('groups multiple events at the same time into one group', () => {
        const events = [
            evt('e1', 10, 'MT'),
            evt('e2', 10, 'AoE'),
        ];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result).toHaveLength(1);
        expect(result[0].events.map(e => e.id)).toEqual(['e2', 'e1']);
    });

    it('orders same-time events by priority: AoE > single-target > undefined', () => {
        const events = [
            evt('a-undef', 10, undefined),
            evt('b-st', 10, 'ST'),
            evt('c-aoe', 10, 'AoE'),
            evt('d-mt', 10, 'MT'),
        ];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result[0].events.map(e => e.id)).toEqual(['c-aoe', 'b-st', 'd-mt', 'a-undef']);
    });

    it('orders same-priority events by id ascending', () => {
        const events = [
            evt('z-aoe', 10, 'AoE'),
            evt('a-aoe', 10, 'AoE'),
        ];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result[0].events.map(e => e.id)).toEqual(['a-aoe', 'z-aoe']);
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
