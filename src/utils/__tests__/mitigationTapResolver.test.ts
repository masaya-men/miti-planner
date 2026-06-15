import { describe, it, expect } from 'vitest';
import { resolveMitigationTap } from '../mitigationTapResolver';
import type { Mitigation, AppliedMitigation } from '../../types';

const mit = (over: Partial<Mitigation>): Mitigation => ({
    id: 'm', jobId: 'pld', name: { ja: '', en: '' }, icon: '', recast: 0,
    duration: 8, type: 'all', value: 10, isShield: false, ...over,
}) as Mitigation;

const applied = (over: Partial<AppliedMitigation>): AppliedMitigation => ({
    id: 'a', mitigationId: 'x', time: 0, duration: 30, ownerId: 'H1', ...over,
});

describe('resolveMitigationTap', () => {
    it('self スコープは即配置 (place)', () => {
        expect(resolveMitigationTap(mit({ scope: 'self' }), 100, [])).toEqual({ kind: 'place' });
    });

    it('party スコープは即配置 (place)', () => {
        expect(resolveMitigationTap(mit({ scope: 'party' }), 100, [])).toEqual({ kind: 'place' });
    });

    it('scope 未定義は即配置 (place)', () => {
        expect(resolveMitigationTap(mit({}), 100, [])).toEqual({ kind: 'place' });
    });

    it('target スコープは対象選択 (selectTarget)', () => {
        expect(resolveMitigationTap(mit({ scope: 'target' }), 100, [])).toEqual({ kind: 'selectTarget' });
    });

    it('copiesShield: 有効な鼓舞が1つ → 自動リンクして即配置', () => {
        const shields = [applied({ id: 's1', mitigationId: 'adloquium', time: 90, duration: 30 })];
        expect(resolveMitigationTap(mit({ copiesShield: 'adloquium' }), 100, shields))
            .toEqual({ kind: 'place', linkedMitigationId: 's1' });
    });

    it('copiesShield: 有効な鼓舞が0個 → 鼓舞選択 (空配列)', () => {
        expect(resolveMitigationTap(mit({ copiesShield: 'adloquium' }), 100, []))
            .toEqual({ kind: 'selectShield', shields: [] });
    });

    it('copiesShield: 有効な鼓舞が2個 → 鼓舞選択 (2件)', () => {
        const shields = [
            applied({ id: 's1', mitigationId: 'adloquium', time: 90, duration: 30 }),
            applied({ id: 's2', mitigationId: 'adloquium', time: 95, duration: 30 }),
        ];
        const r = resolveMitigationTap(mit({ copiesShield: 'adloquium' }), 100, shields);
        expect(r.kind).toBe('selectShield');
        expect(r.kind === 'selectShield' && r.shields).toHaveLength(2);
    });

    it('copiesShield: 期限切れ/対象時刻外の鼓舞は数えない', () => {
        const shields = [
            applied({ id: 'expired', mitigationId: 'adloquium', time: 0, duration: 30 }), // 0..30, 100 では切れている
            applied({ id: 'future', mitigationId: 'adloquium', time: 200, duration: 30 }), // まだ来ていない
        ];
        expect(resolveMitigationTap(mit({ copiesShield: 'adloquium' }), 100, shields))
            .toEqual({ kind: 'selectShield', shields: [] });
    });
});
