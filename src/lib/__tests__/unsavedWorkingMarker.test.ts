// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { markUnsavedWorking, clearUnsavedWorking, discardUnsavedWorking, recoverUnsavedWorkingOnBoot } from '../unsavedWorkingMarker';
import { takeRecoveredBases } from '../recoveredPlanBases';
import type { SavedPlan } from '../../types';

const p1 = { id: 'p1', updatedAt: 1 } as SavedPlan;
const p2 = { id: 'p2', updatedAt: 1 } as SavedPlan;
const plans = [p1, p2];
const boot = (currentPlanId: string, loadedPlanId: string, list: SavedPlan[] = plans) => {
    const writeBack = vi.fn();
    const recovered = recoverUnsavedWorkingOnBoot({ currentPlanId, loadedPlanId, plans: list, writeBack });
    return { recovered, writeBack };
};

describe('unsavedWorkingMarker(表へ未保存の編集がある印)', () => {
    beforeEach(() => { localStorage.clear(); takeRecoveredBases(); vi.useRealTimers(); });

    it('印が今の表を指し、作業ストアも今の表のものなら起動時に「編集した時刻」で書き戻し、印を倒す', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(5000);
        markUnsavedWorking('p1', plans, false);
        vi.setSystemTime(99_999);
        const { recovered, writeBack } = boot('p1', 'p1');
        expect(recovered).toBe(true);
        expect(writeBack).toHaveBeenCalledWith('p1', 5000);
        expect(takeRecoveredBases().get('p1')).toBe(p1);
        expect(boot('p1', 'p1').recovered).toBe(false);
        vi.useRealTimers();
    });

    it('表へ保存した後(印を倒した後)は書き戻さない', () => {
        markUnsavedWorking('p1', plans, false);
        clearUnsavedWorking('p1');
        const { recovered, writeBack } = boot('p1', 'p1');
        expect(recovered).toBe(false);
        expect(writeBack).not.toHaveBeenCalled();
    });

    it('印が別の表を指している・作業ストアの持ち主が違う時は書き戻さず、印は消す', () => {
        markUnsavedWorking('p2', plans, false);
        expect(boot('p1', 'p1').recovered).toBe(false);
        markUnsavedWorking('p1', plans, false);
        expect(boot('p1', 'p2').recovered).toBe(false);
        expect(localStorage.length).toBe(0);
    });

    it('別の表を保存しても、今の表の印は倒さない', () => {
        markUnsavedWorking('p1', plans, false);
        clearUnsavedWorking('p2');
        expect(boot('p1', 'p1').recovered).toBe(true);
    });

    it('共同編集中・共同編集の表には印を立てない', () => {
        markUnsavedWorking('p1', plans, true);
        expect(localStorage.length).toBe(0);
        markUnsavedWorking('p1', [{ ...p1, activeCollabRoomToken: 't' } as SavedPlan], false);
        expect(localStorage.length).toBe(0);
    });

    it('表が消えていた・編集の後に表が保存されていた時は書き戻さず、印を消す', () => {
        markUnsavedWorking('p1', plans, false);
        expect(boot('p1', 'p1', [p2]).recovered).toBe(false);
        markUnsavedWorking('p1', plans, false);
        expect(boot('p1', 'p1', [{ ...p1, updatedAt: Date.now() + 1000 }]).recovered).toBe(false);
        expect(localStorage.length).toBe(0);
    });

    it('作業ストアを表から読み直した時は印を捨てる', () => {
        markUnsavedWorking('p1', plans, false);
        discardUnsavedWorking();
        expect(boot('p1', 'p1').recovered).toBe(false);
    });
});
