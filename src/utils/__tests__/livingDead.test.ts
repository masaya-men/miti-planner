import { describe, it, expect } from 'vitest';
import {
    isLivingDeadStyle,
    maxHpForEffectiveTarget,
    resolveLivingDeadSurvival,
    type LivingDeadInstance,
} from '../livingDead';
import type { Mitigation, PartyMember } from '../../types';

const baseDef = (over: Partial<Mitigation>): Mitigation => ({
    id: 'x', jobId: 'drk', name: { ja: 'x', en: 'x' }, icon: '', recast: 0, duration: 10, type: 'all', value: 0, ...over,
});

const member = (id: string, hp: number): PartyMember => ({
    id, jobId: 'drk', role: 'tank', stats: { hp, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 }, computedValues: {},
});

describe('isLivingDeadStyle', () => {
    it('isInvincible + walkingDeadDuration>0 のみ true', () => {
        expect(isLivingDeadStyle(baseDef({ isInvincible: true, walkingDeadDuration: 10 }))).toBe(true);
        expect(isLivingDeadStyle(baseDef({ isInvincible: true }))).toBe(false); // 通常無敵
        expect(isLivingDeadStyle(baseDef({ walkingDeadDuration: 10 }))).toBe(false); // 無敵でない
        expect(isLivingDeadStyle(baseDef({ isInvincible: true, walkingDeadDuration: 0 }))).toBe(false);
    });
});

describe('maxHpForEffectiveTarget', () => {
    const pm = [member('MT', 90000), member('ST', 88000), member('H1', 60000)];
    it('MT/ST は当該HP、それ以外は H1 のHP', () => {
        expect(maxHpForEffectiveTarget('MT', pm)).toBe(90000);
        expect(maxHpForEffectiveTarget('ST', pm)).toBe(88000);
        expect(maxHpForEffectiveTarget('AoE', pm)).toBe(60000);
    });
    it('見つからなければ 1 にフォールバック', () => {
        expect(maxHpForEffectiveTarget('MT', [])).toBe(1);
    });
});

describe('resolveLivingDeadSurvival', () => {
    const ld = (over: Partial<LivingDeadInstance> = {}): LivingDeadInstance =>
        ({ id: 'ld1', time: 10, duration: 10, walkingDeadDuration: 10, ownerId: 'MT', ...over });

    it('窓内で最初の致死被弾が引き金になり生存(triggers に記録)', () => {
        const triggers = new Map<string, number>();
        const survived = resolveLivingDeadSurvival(12, 100000, 90000, [ld()], triggers);
        expect(survived).toBe(true);
        expect(triggers.get('ld1')).toBe(12);
    });

    it('窓内でも非致死は生存しない(引き金にならない)', () => {
        const triggers = new Map<string, number>();
        const survived = resolveLivingDeadSurvival(12, 50000, 90000, [ld()], triggers);
        expect(survived).toBe(false);
        expect(triggers.has('ld1')).toBe(false);
    });

    it('引き金後のウォーキングデッド窓[tT,tT+wd)のイベントは致死でも非致死でも生存', () => {
        const triggers = new Map<string, number>([['ld1', 12]]);
        expect(resolveLivingDeadSurvival(18, 50000, 90000, [ld()], triggers)).toBe(true);
        expect(resolveLivingDeadSurvival(21, 200000, 90000, [ld()], triggers)).toBe(true);
    });

    it('ウォーキングデッド窓はリビデ窓を超えて伸びる(引き金が窓終盤)', () => {
        const triggers = new Map<string, number>();
        expect(resolveLivingDeadSurvival(19, 100000, 90000, [ld()], triggers)).toBe(true);
        expect(resolveLivingDeadSurvival(28, 100000, 90000, [ld()], triggers)).toBe(true);
        expect(resolveLivingDeadSurvival(29, 100000, 90000, [ld()], triggers)).toBe(false);
    });

    it('引き金前(窓内だが致死前)の非致死は通常ダメージ(false)', () => {
        const triggers = new Map<string, number>();
        expect(resolveLivingDeadSurvival(11, 50000, 90000, [ld()], triggers)).toBe(false);
        expect(resolveLivingDeadSurvival(13, 100000, 90000, [ld()], triggers)).toBe(true);
        expect(triggers.get('ld1')).toBe(13);
    });

    it('窓内に致死が一度も無ければ生存ゼロ', () => {
        const triggers = new Map<string, number>();
        expect(resolveLivingDeadSurvival(11, 10000, 90000, [ld()], triggers)).toBe(false);
        expect(resolveLivingDeadSurvival(15, 20000, 90000, [ld()], triggers)).toBe(false);
        expect(triggers.size).toBe(0);
    });

    it('リビデ窓外のイベントは(未発動なら)生存しない', () => {
        const triggers = new Map<string, number>();
        expect(resolveLivingDeadSurvival(25, 200000, 90000, [ld()], triggers)).toBe(false);
    });

    it('複数リビデは各自独立に引き金を持つ', () => {
        const triggers = new Map<string, number>();
        const ldA = ld({ id: 'A', time: 10 });
        const ldB = ld({ id: 'B', time: 30 });
        expect(resolveLivingDeadSurvival(12, 100000, 90000, [ldA, ldB], triggers)).toBe(true);
        expect(resolveLivingDeadSurvival(32, 100000, 90000, [ldA, ldB], triggers)).toBe(true);
        expect(triggers.get('A')).toBe(12);
        expect(triggers.get('B')).toBe(32);
    });
});
