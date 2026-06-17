import { describe, it, expect } from 'vitest';

// master data 未ロード時は mockData(STATIC_MITIGATIONS)へフォールバック
import { vi } from 'vitest';
vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: { getState: () => ({ skills: null, stats: null, config: null }) },
}));

import { findSameSkillCdConflicts } from '../resourceTracker';
import type { AppliedMitigation } from '../../types';

// reprisal_war: recast 60 / duration 15 (mockData)
function ap(id: string, mitId: string, time: number, ownerId = 'm1'): AppliedMitigation {
    return { id, mitigationId: mitId, time, duration: 15, ownerId };
}

describe('findSameSkillCdConflicts', () => {
    it('同オーナー同技でリキャスト内に2つ → 両方を競合として返す', () => {
        // 1:00(=60s) と 1:30(=90s)。recast 60 → 90 < 60+60 = 被り
        const list = [ap('a', 'reprisal_war', 60), ap('b', 'reprisal_war', 90)];
        const r = findSameSkillCdConflicts(list);
        expect(r.has('a')).toBe(true);
        expect(r.has('b')).toBe(true);
    });

    it('リキャストを超えて離れていれば競合しない', () => {
        // 60s と 130s。130 >= 60+60 → 被らない
        const list = [ap('a', 'reprisal_war', 60), ap('b', 'reprisal_war', 130)];
        const r = findSameSkillCdConflicts(list);
        expect(r.size).toBe(0);
    });

    it('オーナーが違えば同技でも競合しない', () => {
        const list = [ap('a', 'reprisal_war', 60, 'MT'), ap('b', 'reprisal_war', 90, 'ST')];
        const r = findSameSkillCdConflicts(list);
        expect(r.size).toBe(0);
    });

    it('チャージ技(ディヴァインベニゾン)は対象外', () => {
        // divine_benison: maxCharges 2 → このルールでは競合扱いしない
        const list = [ap('a', 'divine_benison', 0), ap('b', 'divine_benison', 10)];
        const r = findSameSkillCdConflicts(list);
        expect(r.size).toBe(0);
    });

    it('解消(離す)すると集合から外れる', () => {
        const before = findSameSkillCdConflicts([ap('a', 'reprisal_war', 60), ap('b', 'reprisal_war', 90)]);
        expect(before.size).toBe(2);
        const after = findSameSkillCdConflicts([ap('a', 'reprisal_war', 60), ap('b', 'reprisal_war', 200)]);
        expect(after.size).toBe(0);
    });
});
