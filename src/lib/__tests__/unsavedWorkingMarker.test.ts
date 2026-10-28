// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { markUnsavedWorking, clearUnsavedWorking, recoverUnsavedWorkingOnBoot } from '../unsavedWorkingMarker';

describe('unsavedWorkingMarker(表へ未保存の編集がある印)', () => {
    beforeEach(() => { localStorage.clear(); });

    it('印が今の表を指し、作業ストアも今の表のものなら起動時に書き戻し、印を倒す', () => {
        markUnsavedWorking('p1');
        const save = vi.fn();
        expect(recoverUnsavedWorkingOnBoot('p1', 'p1', save)).toBe(true);
        expect(save).toHaveBeenCalledTimes(1);
        expect(recoverUnsavedWorkingOnBoot('p1', 'p1', save)).toBe(false);
    });

    it('表へ保存した後(印を倒した後)は書き戻さない', () => {
        markUnsavedWorking('p1');
        clearUnsavedWorking('p1');
        const save = vi.fn();
        expect(recoverUnsavedWorkingOnBoot('p1', 'p1', save)).toBe(false);
        expect(save).not.toHaveBeenCalled();
    });

    it('印が別の表を指している・作業ストアの持ち主が違う時は書き戻さない', () => {
        const save = vi.fn();
        markUnsavedWorking('p2');
        expect(recoverUnsavedWorkingOnBoot('p1', 'p1', save)).toBe(false);
        markUnsavedWorking('p1');
        expect(recoverUnsavedWorkingOnBoot('p1', 'p2', save)).toBe(false);
        expect(save).not.toHaveBeenCalled();
    });

    it('別の表を保存しても、今の表の印は倒さない', () => {
        markUnsavedWorking('p1');
        clearUnsavedWorking('p2');
        const save = vi.fn();
        expect(recoverUnsavedWorkingOnBoot('p1', 'p1', save)).toBe(true);
    });
});
