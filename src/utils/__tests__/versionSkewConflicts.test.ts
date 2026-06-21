import { describe, it, expect, vi } from 'vitest';

// master data 未ロード時は mockData(STATIC_MITIGATIONS)へフォールバック。
// このテストは mockData を一次ソースとして「同id版違いバグ」の修正を検証する。
vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: { getState: () => ({ skills: null, stats: null, config: null }) },
}));

import { findSameSkillCdConflicts } from '../resourceTracker';
import type { AppliedMitigation } from '../../types';

function ap(id: string, mitId: string, time: number, ownerId = 'm1'): AppliedMitigation {
    return { id, mitigationId: mitId, time, duration: 15, ownerId };
}

/**
 * 同id版違いバグ回帰テスト。
 * mockData は秘策/展開戦術/ゾーエ/テトラグラマトンを「同じ id で2回」定義しており、
 * 競合判定 findSameSkillCdConflicts は new Map(後勝ち)で末尾=低Lv版(旧・長recast / charge無し)を引いてしまう。
 * → Lv100 で正しい間隔(高Lv版の recast)で置いた2発目が誤って競合表示される。
 * 修正(低Lv版を _base 別id化)で、bare id は高Lv版1件に解決され誤competition が消えることを保証する。
 */
describe('同id版違いバグ: Lv100 で正しい間隔の2発は競合しない', () => {
    it('秘策 recitation: recast60 → 75秒離せば競合しない(現状は末尾recast90を引き誤競合)', () => {
        const r = findSameSkillCdConflicts([ap('a', 'recitation', 0), ap('b', 'recitation', 75)]);
        expect(r.size).toBe(0);
    });

    it('展開戦術 deployment_tactics: recast90 → 95秒離せば競合しない(現状は末尾recast120を引き誤競合)', () => {
        const r = findSameSkillCdConflicts([ap('a', 'deployment_tactics', 0), ap('b', 'deployment_tactics', 95)]);
        expect(r.size).toBe(0);
    });

    it('ゾーエ zoe: recast90 → 95秒離せば競合しない(現状は末尾recast120を引き誤競合)', () => {
        const r = findSameSkillCdConflicts([ap('a', 'zoe', 0), ap('b', 'zoe', 95)]);
        expect(r.size).toBe(0);
    });

    it('テトラグラマトン tetragrammaton: Lv100は2チャージ技 → 近接2回でも競合しない(現状は末尾=charge無し版を引き誤競合)', () => {
        const r = findSameSkillCdConflicts([ap('a', 'tetragrammaton', 0), ap('b', 'tetragrammaton', 10)]);
        expect(r.size).toBe(0);
    });
});

describe('同id版違いバグ修正後も、本当の被りは競合検出し続ける(過修正ガード)', () => {
    it('秘策 recitation: recast60 未満(30秒)で2発置けば競合する', () => {
        const r = findSameSkillCdConflicts([ap('a', 'recitation', 0), ap('b', 'recitation', 30)]);
        expect(r.has('a')).toBe(true);
        expect(r.has('b')).toBe(true);
    });
});
