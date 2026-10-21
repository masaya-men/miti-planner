// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---- モック ----
const planState = {
    currentPlanId: 'cur' as string | null,
    plans: [] as any[],
    updatePlan: vi.fn(),
    deleteFromFirestore: vi.fn(),
    deletePlan: vi.fn(),
};
const authState = { user: null as null | { uid: string } };

vi.mock('../../store/usePlanStore', () => ({
    usePlanStore: { getState: () => planState },
}));
vi.mock('../../store/useAuthStore', () => ({
    useAuthStore: { getState: () => authState },
}));
vi.mock('../../store/useMitigationStore', () => ({
    useMitigationStore: { getState: () => ({ getSnapshot: () => ({ snap: true }) }) },
}));
const showToastMock = vi.fn();
vi.mock('../../components/Toast', () => ({ showToast: (...a: unknown[]) => showToastMock(...a) }));
const decompressMock = vi.fn();
vi.mock('../../utils/compression', () => ({ decompressPlanData: (...a: unknown[]) => decompressMock(...a) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { usePlanMultiSelect } from '../usePlanMultiSelect';

beforeEach(() => {
    vi.clearAllMocks();
    planState.currentPlanId = 'cur';
    planState.plans = [];
    authState.user = null;
});

describe('usePlanMultiSelect', () => {
    it('同じモードを 2 回押すと解除、別モードへは選択を空にして切替', () => {
        const { result } = renderHook(() => usePlanMultiSelect());
        act(() => result.current.toggleMode('share'));
        expect(result.current.multiSelect).toEqual({ isEnabled: true, selectedIds: [], mode: 'share' });
        act(() => result.current.toggleId('a'));
        expect(result.current.multiSelect.selectedIds).toEqual(['a']);
        act(() => result.current.toggleMode('delete'));
        expect(result.current.multiSelect).toEqual({ isEnabled: true, selectedIds: [], mode: 'delete' });
        act(() => result.current.toggleMode('delete'));
        expect(result.current.multiSelect).toEqual({ isEnabled: false, selectedIds: [], mode: 'share' });
    });

    it('共有モードは 10 件まで、削除モードは無制限', () => {
        const { result } = renderHook(() => usePlanMultiSelect());
        act(() => result.current.toggleMode('share'));
        for (let i = 0; i < 12; i++) act(() => result.current.toggleId(`s${i}`));
        expect(result.current.multiSelect.selectedIds).toHaveLength(10);
        act(() => result.current.toggleMode('delete'));
        for (let i = 0; i < 12; i++) act(() => result.current.toggleId(`d${i}`));
        expect(result.current.multiSelect.selectedIds).toHaveLength(12);
    });

    it('選んだ ID だけを、ログイン時は deleteFromFirestore、未ログイン時は deletePlan で消し、終わると解除', async () => {
        planState.plans = [
            { id: 'a', contentId: 'c1' }, { id: 'b', contentId: null }, { id: 'z', contentId: 'c9' },
        ];
        // 未ログイン
        const r1 = renderHook(() => usePlanMultiSelect());
        act(() => r1.result.current.toggleMode('delete'));
        act(() => r1.result.current.toggleId('a'));
        act(() => r1.result.current.toggleId('b'));
        await act(async () => { await r1.result.current.deleteSelected(); });
        expect(planState.deletePlan.mock.calls).toEqual([['a'], ['b']]);
        expect(planState.deleteFromFirestore).not.toHaveBeenCalled();
        expect(r1.result.current.multiSelect).toEqual({ isEnabled: false, selectedIds: [], mode: 'share' });

        // ログイン
        vi.clearAllMocks();
        authState.user = { uid: 'U' };
        const r2 = renderHook(() => usePlanMultiSelect());
        act(() => r2.result.current.toggleMode('delete'));
        act(() => r2.result.current.toggleId('a'));
        act(() => r2.result.current.toggleId('b'));
        await act(async () => { await r2.result.current.deleteSelected(); });
        expect(planState.deleteFromFirestore.mock.calls).toEqual([['a', 'U', 'c1'], ['b', 'U', null]]);
        expect(planState.deletePlan).not.toHaveBeenCalled();
        expect(r2.result.current.multiSelect.isEnabled).toBe(false);
    });

    it('まとめて共有: 現在プランを保存し、解凍に失敗したプランを除いてモーダルを開く', async () => {
        planState.plans = [
            { id: 'ok', contentId: 'c1', title: 'T1', data: { x: 1 } },
            { id: 'zip', contentId: 'c2', title: 'T2', data: {}, compressedData: 'Z' },
            { id: 'bad', contentId: 'c3', title: 'T3', data: {}, compressedData: 'B' },
        ];
        decompressMock.mockImplementation(async (c: string) => {
            if (c === 'Z') return { unz: 1 };
            throw new Error('fail');
        });
        const { result } = renderHook(() => usePlanMultiSelect());
        act(() => result.current.toggleMode('share'));
        for (const id of ['ok', 'zip', 'bad', 'none']) act(() => result.current.toggleId(id));
        await act(async () => { await result.current.openBundleShare(); });
        expect(planState.updatePlan).toHaveBeenCalledWith('cur', { data: { snap: true } });
        expect(result.current.bundleOpen).toBe(true);
        expect(result.current.bundlePlans).toEqual([
            { contentId: 'c1', title: 'T1', planData: { x: 1 } },
            { contentId: 'c2', title: 'T2', planData: { unz: 1 } },
        ]);
        act(() => result.current.closeBundleShare());
        expect(result.current.bundleOpen).toBe(false);
        expect(result.current.multiSelect.isEnabled).toBe(false);
        expect(result.current.multiSelect.selectedIds).toEqual([]);
    });

    it('まとめて共有: 1 件も残らなければトーストを出してモーダルを開かない', async () => {
        planState.plans = [{ id: 'bad', contentId: 'c3', title: 'T3', data: {}, compressedData: 'B' }];
        decompressMock.mockRejectedValue(new Error('fail'));
        const { result } = renderHook(() => usePlanMultiSelect());
        act(() => result.current.toggleMode('share'));
        act(() => result.current.toggleId('bad'));
        await act(async () => { await result.current.openBundleShare(); });
        expect(showToastMock).toHaveBeenCalledWith('app.share_no_plans');
        expect(result.current.bundleOpen).toBe(false);
    });
});
