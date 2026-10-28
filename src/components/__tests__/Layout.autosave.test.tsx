// @vitest-environment happy-dom
/**
 * Layout の自動保存(作業ストア → 持ち主のプランへ保存)の動きを固定する。
 * 画面の子部品は空の代役にし、実ストアで「いつ・どのプランへ保存するか」だけを見る。
 */
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// t は本物と同じく毎回同じ関数(変わると自動保存の仕掛けが張り直されてしまう)
const { i18nValue } = vi.hoisted(() => ({ i18nValue: { t: (k: string) => k, i18n: { language: 'ja' } } }));
vi.mock('react-i18next', () => ({ useTranslation: () => i18nValue }));
const { Empty } = vi.hoisted(() => ({ Empty: () => null }));
vi.mock('../Sidebar', () => ({ Sidebar: Empty }));
vi.mock('../LocalDataSafetyAutoPrompt', () => ({ LocalDataSafetyAutoPrompt: Empty }));
vi.mock('../ConsolidatedHeader', () => ({ ConsolidatedHeader: Empty }));
vi.mock('../MobileBottomNav', () => ({ MobileBottomNav: Empty }));
vi.mock('../MobileBottomSheet', () => ({ MobileBottomSheet: Empty }));
vi.mock('../collab/MobileShareController', () => ({ MobileShareController: Empty }));
vi.mock('../ui/transitionOverlayContext', () => ({ useTransitionOverlay: () => ({ runTransition: (fn: () => void) => fn() }) }));
vi.mock('../AppFooter', () => ({ AppFooter: Empty }));
vi.mock('../LoginModal', () => ({ LoginModal: Empty }));
vi.mock('../RenderPendingIndicator', () => ({ RenderPendingIndicator: Empty }));
vi.mock('../SyncButton', () => ({ SyncButton: Empty }));
vi.mock('../toastBus', () => ({ showToast: vi.fn() }));
vi.mock('../WelcomeSetup', () => ({ WelcomeSetup: Empty }));
vi.mock('../MobileHeader', () => ({ MobileHeader: Empty }));
vi.mock('../MobileFab', () => ({ MobileFAB: Empty }));
vi.mock('../GridOverlay', () => ({ GridOverlay: Empty }));
vi.mock('../MobilePartySettings', () => ({ MobilePartyWithTabs: Empty, MobileAccountMenu: Empty }));
vi.mock('../AetherflowChainPromptModal', () => ({ AetherflowChainPromptModal: Empty }));
vi.mock('../AstrologianDrawChainPromptModal', () => ({ AstrologianDrawChainPromptModal: Empty }));
vi.mock('../LocalImportDialog', () => ({ LocalImportDialog: Empty }));
vi.mock('../ShareImportSheet', () => ({ ShareImportSheet: Empty }));
vi.mock('../LimitResolutionSheet', () => ({ LimitResolutionSheet: Empty }));
vi.mock('../dev/MilspecTunePanel', () => ({ MilspecTunePanel: Empty }));
vi.mock('../../lib/collab/collabLifecycle', () => ({ reconcileCollabForPlan: vi.fn() }));
vi.mock('../../hooks/useIOSViewportFix', () => ({ useIOSViewportFix: vi.fn() }));

import { Layout } from '../Layout';
import { usePlanStore } from '../../store/usePlanStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useAuthStore } from '../../store/useAuthStore';

const basePlan = { ownerId: 'local', ownerDisplayName: 'u', title: 't', contentId: null, isPublic: false, createdAt: 1, updatedAt: 1, _createdLoggedIn: true };

describe('Layout の自動保存', () => {
    let updatePlan: ReturnType<typeof vi.fn>;
    let hidden = false;

    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        hidden = false;
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        const data = useMitigationStore.getState().getSnapshot();
        updatePlan = vi.fn();
        usePlanStore.setState({
            plans: [{ ...basePlan, id: 'p1', data }, { ...basePlan, id: 'p2', data }] as never,
            currentPlanId: 'p1',
            updatePlan,
            _saveStatus: 'idle',
        } as never);
        useMitigationStore.setState({ _loadedPlanId: 'p1', _collabActive: false });
        useAuthStore.setState({ user: null, loading: false, isNewUser: false } as never);
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        updatePlan.mockClear();
    });
    afterEach(() => { vi.useRealTimers(); });

    const editMitigation = () => act(() => { useMitigationStore.setState({ timelineMitigations: [] }); });

    it('作業ストアの変更から 500ms 後に持ち主のプランへ保存する', () => {
        editMitigation();
        expect(usePlanStore.getState()._saveStatus).toBe('saving');
        act(() => { vi.advanceTimersByTime(499); });
        expect(updatePlan).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(1); });
        expect(updatePlan).toHaveBeenCalledTimes(1);
        expect(updatePlan.mock.calls[0][0]).toBe('p1');
        expect(usePlanStore.getState()._saveStatus).toBe('saved');
    });

    it('500ms 以内にプランを切り替えたら、遅れて旧プランへ保存しない', () => {
        editMitigation();
        act(() => { usePlanStore.setState({ currentPlanId: 'p2' }); });
        // 切替の瞬間に旧プラン(持ち主 p1)を 1 回だけ保存する
        expect(updatePlan).toHaveBeenCalledTimes(1);
        expect(updatePlan.mock.calls[0][0]).toBe('p1');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(updatePlan).toHaveBeenCalledTimes(1);
    });

    it('共同編集中のプラン切替では保存しない', () => {
        useMitigationStore.setState({ _collabActive: true });
        act(() => { usePlanStore.setState({ currentPlanId: 'p2' }); });
        act(() => { vi.advanceTimersByTime(1000); });
        expect(updatePlan).not.toHaveBeenCalled();
    });

    it('タブが隠れたら待たずに保存して saved になる', () => {
        editMitigation();
        hidden = true;
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(updatePlan).toHaveBeenCalledTimes(1);
        expect(updatePlan.mock.calls[0][0]).toBe('p1');
        expect(usePlanStore.getState()._saveStatus).toBe('saved');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(updatePlan).toHaveBeenCalledTimes(1);
    });
});

describe('Layout の起動時復旧', () => {
    beforeEach(() => {
        localStorage.clear();
        useAuthStore.setState({ user: null, loading: false, isNewUser: false } as never);
    });

    it('持ち主の札が無ければ、開いているプランを持ち主として記録する(無いと初回保存がスキップされる)', () => {
        const data = useMitigationStore.getState().getSnapshot();
        usePlanStore.setState({ plans: [{ ...basePlan, id: 'p1', data }] as never, currentPlanId: 'p1' });
        useMitigationStore.setState({ _loadedPlanId: null });
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        expect(useMitigationStore.getState()._loadedPlanId).toBe('p1');
    });

    it('札が別のプランを指していたら、開いているプランの中身で作業ストアを読み直す', () => {
        const data = useMitigationStore.getState().getSnapshot();
        usePlanStore.setState({ plans: [{ ...basePlan, id: 'p1', data }] as never, currentPlanId: 'p1' });
        useMitigationStore.setState({ _loadedPlanId: 'other' });
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        expect(useMitigationStore.getState()._loadedPlanId).toBe('p1');
    });
});
