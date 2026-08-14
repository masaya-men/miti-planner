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

/**
 * レベル帯で id が分かれる技(別id版違い)の競合検出漏れバグ回帰テスト。
 * 「同id版違いバグ」対策で低Lv版が _base/_v2 等の別idに分離されたが、getSharedCooldownIds が
 * 単純な id 一致のみだったため、旧idで置いた軽減が現Lvの新idと同じ技として認識されず
 * CD競合が検出されない不具合があった(2026-08-14ユーザー実機報告: ランパートが赤くならない)。
 */
describe('別id版違い(rampart/rampart_v2等)は同じCDグループとして競合検出する', () => {
    it('ランパート: 旧id(rampart_pld)と新id(rampart_v2_pld)を混ぜて置いても被りは競合する', () => {
        // rampart recast=90 → 4秒→7秒(3秒後)は明確にCD内
        const r = findSameSkillCdConflicts([ap('a', 'rampart_pld', 4), ap('b', 'rampart_v2_pld', 7)]);
        expect(r.has('a')).toBe(true);
        expect(r.has('b')).toBe(true);
    });

    it('リプライザル: reprisal_pldとreprisal_base_pldも同じCDグループとして被りを検出する', () => {
        // reprisal recast=60
        const r = findSameSkillCdConflicts([ap('a', 'reprisal_base_pld', 0), ap('b', 'reprisal_pld', 30)]);
        expect(r.has('a')).toBe(true);
        expect(r.has('b')).toBe(true);
    });

    it('原初の血気ライン: bloodwhettingとraw_intuition/nascent_flash系は全て同一CDグループ', () => {
        // recast=25、別名・別アイコンでも同一リキャストを共有する特例
        const r = findSameSkillCdConflicts([ap('a', 'raw_intuition', 0), ap('b', 'nascent_flash', 10)]);
        expect(r.has('a')).toBe(true);
        expect(r.has('b')).toBe(true);
    });

    it('別idでもリキャストを超えて離れていれば競合しない', () => {
        const r = findSameSkillCdConflicts([ap('a', 'rampart_pld', 0), ap('b', 'rampart_v2_pld', 95)]);
        expect(r.size).toBe(0);
    });
});
