import { describe, it, expect } from 'vitest';
import { MITIGATIONS } from '../../data/mockData';
import { useMitigationStore } from '../../store/useMitigationStore';
import { canStackSameSecond, sameSecondTargets } from '../sameSecondStack';
import type { AppliedMitigation } from '../../types';

const def = (id: string) => MITIGATIONS.find(m => m.id === id)!;
const at = (id: string, time: number, targetId?: string): AppliedMitigation =>
    ({ id, mitigationId: 'divine_benison', time, duration: 15, ownerId: 'H1', targetId });

describe('同じ秒に同じ技を重ねて置けるか(masaya 10-29)', () => {
    it('2 回分ためて相手を選ぶ技だけ重ねられる', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        expect(canStackSameSecond(def('oblation'))).toBe(true);
        expect(canStackSameSecond(def('divine_benison'))).toBe(true);
        expect(canStackSameSecond(def('aquaveil'))).toBe(false);   // 相手を選ぶが 1 回分
        expect(canStackSameSecond(def('consolation'))).toBe(false); // 2 回分だが全体
    });

    it('2 回分になる前のレベルでは重ねられない', () => {
        useMitigationStore.setState({ currentLevel: 80 });
        expect(canStackSameSecond(def('divine_benison'))).toBe(false);
        useMitigationStore.setState({ currentLevel: 100 });
    });

    it('その秒にもう相手にした人と、まだ足せるかを返す', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        const one = sameSecondTargets(def('divine_benison'), 10, [at('a', 10, 'MT'), at('b', 40, 'ST')]);
        expect([...one.used]).toEqual([['MT', 'a']]);
        expect(one.canAddMore).toBe(true);
        const two = sameSecondTargets(def('divine_benison'), 10, [at('a', 10, 'MT'), at('b', 10, 'ST')]);
        expect(two.canAddMore).toBe(false);
    });
});
