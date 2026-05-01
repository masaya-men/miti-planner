import { describe, it, expect } from 'vitest';
import { computeCueItems } from '../utils/pipViewLogic';
import type { TimelineEvent, AppliedMitigation } from '../types';

const evt = (id: string, time: number, name = id): TimelineEvent => ({
    id,
    time,
    name: { ja: name, en: name, ko: name, zh: name },
    damageType: 'magical',
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

    it('returns only events that have mitigations from selected members', () => {
        const events = [evt('e1', 10), evt('e2', 20), evt('e3', 30)];
        const mitigations = [
            miti('m1', 10, 'MT', 'rampart'),
            miti('m2', 20, 'H1', 'sacred_soil'),
            miti('m3', 30, 'D1', 'feint'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT', 'H1']));
        expect(result.map(r => r.event.id)).toEqual(['e1', 'e2']);
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

    it('sorts events by time ascending', () => {
        const events = [evt('e1', 30), evt('e2', 10), evt('e3', 20)];
        const mitigations = [
            miti('m1', 30, 'MT', 'rampart'),
            miti('m2', 10, 'MT', 'reprisal'),
            miti('m3', 20, 'MT', 'arms_length'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result.map(r => r.event.time)).toEqual([10, 20, 30]);
    });

    it('handles event with no mitigation owner match (skipped)', () => {
        const events = [evt('e1', 10), evt('e2', 20)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['H1']));
        expect(result).toEqual([]);
    });
});
