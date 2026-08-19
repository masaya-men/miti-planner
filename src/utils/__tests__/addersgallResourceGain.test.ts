import { describe, it, expect, vi } from 'vitest';

// master data 未ロード時は STATIC_MITIGATIONS(=mockData)へフォールバックさせる
vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: {
        getState: () => ({ skills: null, stats: null, config: null }),
    },
}));

import { getAddersgallStacks } from '../resourceTracker';
import type { AppliedMitigation } from '../../types';

function makeApplied(id: string, time: number): AppliedMitigation {
    return { id: `inst_${id}_${time}`, mitigationId: id, time, duration: 1, ownerId: 'h1' };
}

describe('アダーガルゲージ: リゾーマタで1スタック回復する', () => {
    it('リゾーマタ未使用: ケーラコレ1回消費後は2スタックのまま(回帰確認)', () => {
        const applied = [makeApplied('kerachole', 0)];
        expect(getAddersgallStacks(1, applied)).toBe(2);
    });

    it('ケーラコレで1消費(3→2)した直後にリゾーマタで1回復(2→3)する', () => {
        const applied = [makeApplied('kerachole', 0), makeApplied('rhizomata', 1)];
        expect(getAddersgallStacks(2, applied)).toBe(3);
    });

    it('満タン(3)のときにリゾーマタを使っても3を超えない(上限キャップ)', () => {
        const applied = [makeApplied('rhizomata', 0)];
        expect(getAddersgallStacks(1, applied)).toBe(3);
    });

    it('2回消費(3→1)の後にリゾーマタで1回復(1→2)する', () => {
        const applied = [makeApplied('kerachole', 0), makeApplied('kerachole', 1), makeApplied('rhizomata', 2)];
        expect(getAddersgallStacks(3, applied)).toBe(2);
    });
});
