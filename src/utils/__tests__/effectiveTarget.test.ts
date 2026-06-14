import { describe, it, expect } from 'vitest';
import { getEffectiveTarget, buildEffectiveTargetMap } from '../effectiveTarget';
import type { TimelineEvent, AppliedMitigation, Phase } from '../../types';

const ev = (id: string, time: number, target: TimelineEvent['target']): TimelineEvent => ({
    id, time, name: { ja: '', en: '' }, damageType: 'magical', target,
});
const swap = (id: string, time: number, ownerId = 'MT'): AppliedMitigation => ({
    id, mitigationId: 'provoke_pld', time, duration: 0, ownerId,
});
const phases: Phase[] = [
    { id: 'p1', name: { ja: '', en: '' }, startTime: 0, endTime: 100 },
    { id: 'p2', name: { ja: '', en: '' }, startTime: 100, endTime: 200 },
];

describe('getEffectiveTarget', () => {
    it('挑発0個なら元 target を返す（恒等）', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [], phases)).toBe('MT');
        expect(getEffectiveTarget(ev('e', 50, 'ST'), [], phases)).toBe('ST');
    });

    it('AoE は常に不変', () => {
        expect(getEffectiveTarget(ev('e', 50, 'AoE'), [swap('s', 10)], phases)).toBe('AoE');
    });

    it('同一フェーズ内・前に挑発1個 → 反転', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 10)], phases)).toBe('ST');
    });

    it('同一フェーズ内・前に挑発2個 → 元に戻る', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('a', 10), swap('b', 20)], phases)).toBe('MT');
    });

    it('挑発がイベントより後 → 影響なし', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 60)], phases)).toBe('MT');
    });

    it('同時刻の挑発は効かない（厳密 <）', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 50)], phases)).toBe('MT');
    });

    it('別フェーズの挑発は影響しない', () => {
        expect(getEffectiveTarget(ev('e', 150, 'MT'), [swap('s', 10)], phases)).toBe('MT');
    });

    it('ownerId に依らず一律カウント（ST が挑発でも反転）', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 10, 'ST')], phases)).toBe('ST');
    });

    it('フェーズ未定義（phases 空）でも全体を1フェーズ扱いで動く', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 10)], [])).toBe('ST');
    });
});

describe('buildEffectiveTargetMap', () => {
    it('eventId → 実効ターゲットの Map を返す', () => {
        const events = [ev('e1', 50, 'MT'), ev('e2', 60, 'ST')];
        const map = buildEffectiveTargetMap(events, [swap('s', 10)], phases);
        expect(map.get('e1')).toBe('ST');
        expect(map.get('e2')).toBe('MT');
    });
});
