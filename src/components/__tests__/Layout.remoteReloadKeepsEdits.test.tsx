// @vitest-environment happy-dom
/**
 * 本番の「置いた軽減が、何もしていない間に消えた」(2026-10-28) の再現と回帰防止。
 *
 * サーバーから読み直す処理(ログイン直後の取り込み / 取り直し)が終わるのを遅らせ、
 * その間に軽減を置く。終わった後も、置いた軽減が画面(作業ストア)と表一覧に残り、
 * サーバーへ送る印(未保存一覧)も残っていることを確かめる。
 * 画面の子部品は空の代役。ストアは本物、サーバーとの通信(planService)だけ代役。
 */
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
vi.mock('firebase/app-check', () => ({ getToken: vi.fn(async () => ({ token: 't' })) }));
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})), onAuthStateChanged: vi.fn(() => () => undefined),
    signOut: vi.fn(async () => undefined), signInWithCustomToken: vi.fn(),
}));
vi.mock('../../lib/firebase', () => ({
    auth: { currentUser: null }, db: {}, storage: {},
    ensureAppCheck: () => null, getActiveAppCheck: () => null,
}));
vi.mock('../../lib/planService', () => ({
    planService: {
        createPlan: vi.fn(async () => undefined),
        updatePlan: vi.fn(async () => undefined),
        deletePlan: vi.fn(async () => undefined),
        fetchUserPlans: vi.fn(async () => []),
        syncDirtyPlans: vi.fn(async () => ({ deletedRemotely: [], conflicted: [] })),
        fetchAndMerge: vi.fn(),
        checkPlanLimits: vi.fn(async () => undefined),
        checkPlanExists: vi.fn(async () => false),
        ensurePlanCounts: vi.fn(async () => undefined),
        repairPlanCounts: vi.fn(async () => undefined),
        migrateLocalPlansToFirestore: vi.fn(),
    },
}));

import { Layout } from '../Layout';
import { usePlanStore } from '../../store/usePlanStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { planService } from '../../lib/planService';
import type { SavedPlan } from '../../types';

const UID = 'u1';

function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
}

/** 軽減を 1 つ置く(作業ストアの軽減一覧が新しい配列になる=画面の操作と同じ) */
const placeMitigation = (id: string) => act(() => {
    const cur = useMitigationStore.getState().timelineMitigations;
    useMitigationStore.setState({ timelineMitigations: [...cur, { id } as never] });
});
const workingIds = () => useMitigationStore.getState().timelineMitigations.map((m) => m.id);
const planIds = () => (usePlanStore.getState().plans.find((p) => p.id === 'p1')?.data.timelineMitigations ?? []).map((m) => m.id);
/** 置いた軽減がサーバーへ送られた、またはまだ送る印(未保存一覧)が付いている = どこにも消えていない */
const sentOrPending = (mitId: string) => {
    if (usePlanStore.getState()._dirtyPlanIds.has('p1')) return true;
    return vi.mocked(planService.syncDirtyPlans).mock.calls.some(([ids, plans]) =>
        ids.has('p1') && (plans.find((p) => p.id === 'p1')?.data.timelineMitigations ?? []).some((m) => m.id === mitId));
};
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

let startPlan: SavedPlan;

beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(planService.migrateLocalPlansToFirestore).mockReset();
    vi.mocked(planService.fetchAndMerge).mockReset();
    vi.mocked(planService.syncDirtyPlans).mockClear();
    vi.mocked(planService.fetchAndMerge).mockImplementation(async (local) => ({ merged: local, changed: false }));
    localStorage.clear();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    useMitigationStore.setState({ _collabActive: false, timelineMitigations: [] });
    const data = useMitigationStore.getState().getSnapshot();
    startPlan = {
        id: 'p1', ownerId: UID, ownerDisplayName: 'u', title: 't', contentId: null, isPublic: false,
        copyCount: 0, useCount: 0, createdAt: 1, updatedAt: 1, data,
    } as SavedPlan;
    usePlanStore.setState({
        plans: [startPlan], currentPlanId: 'p1', _dirtyPlanIds: new Set(), _deletedPlanIds: new Set(),
        _isSyncing: false, _lastSyncAt: 0, _cloudStatus: 'idle',
    } as never);
    useMitigationStore.getState().loadSnapshot(data, 'p1');
    useAuthStore.setState({ user: null, loading: false, isNewUser: false } as never);
});
afterEach(() => { vi.useRealTimers(); });

const login = () => act(() => { useAuthStore.setState({ user: { uid: UID } } as never); });

describe('ログイン直後の取り込み(経路 1)の最中に置いた軽減', () => {
    it('保存(0.5 秒)が済んだ後に取り込みが終わっても、軽減と保存待ちの印が残る', async () => {
        const migrate = deferred<{ merged: SavedPlan[]; dirtyIds: string[] }>();
        vi.mocked(planService.migrateLocalPlansToFirestore).mockReturnValue(migrate.promise);
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        login();
        placeMitigation('m-new');
        act(() => { vi.advanceTimersByTime(500); });
        expect(planIds()).toEqual(['m-new']);

        // 取り込みが終わる: サーバーには取り込み開始時点(軽減なし)の表がある
        migrate.resolve({ merged: [startPlan], dirtyIds: [] });
        await flush();

        expect(workingIds()).toEqual(['m-new']);
        expect(planIds()).toEqual(['m-new']);
        expect(sentOrPending('m-new')).toBe(true);
    });

    it('0.5 秒待ちの保存より先に取り込みが終わっても、軽減が残り、その後に保存される', async () => {
        const migrate = deferred<{ merged: SavedPlan[]; dirtyIds: string[] }>();
        vi.mocked(planService.migrateLocalPlansToFirestore).mockReturnValue(migrate.promise);
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        login();
        placeMitigation('m-new');

        migrate.resolve({ merged: [startPlan], dirtyIds: [] });
        await flush();
        expect(workingIds()).toEqual(['m-new']);

        act(() => { vi.advanceTimersByTime(500); });
        expect(planIds()).toEqual(['m-new']);
        expect(sentOrPending('m-new')).toBe(true);
    });
});

describe('取り直し(経路 2・タブを戻した時)の最中に置いた軽減', () => {
    const renderLoggedIn = async () => {
        vi.mocked(planService.migrateLocalPlansToFirestore).mockImplementation(async (local) => ({ merged: local, dirtyIds: [] }));
        useAuthStore.setState({ user: { uid: UID } } as never);
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        await flush();
        await flush();
    };
    const tabBack = () => act(() => { document.dispatchEvent(new Event('visibilitychange')); });

    it('サーバー側の方が新しいと判定されても、置いた軽減と保存待ちの印が残る', async () => {
        await renderLoggedIn();
        const pull = deferred<{ merged: SavedPlan[]; changed: boolean }>();
        vi.mocked(planService.fetchAndMerge).mockReturnValue(pull.promise);
        tabBack();
        placeMitigation('m-new');
        act(() => { vi.advanceTimersByTime(500); });

        // サーバーの表は軽減なし・updatedAt だけ新しい(一度保存すると毎回こうなる作り)
        pull.resolve({ merged: [{ ...startPlan, updatedAt: Date.now() + 60_000 }], changed: true });
        await flush();

        expect(workingIds()).toEqual(['m-new']);
        expect(planIds()).toEqual(['m-new']);
        expect(sentOrPending('m-new')).toBe(true);
    });

    it('手元で何も変えていなければ、サーバー側の新しい内容を今まで通り読み直す', async () => {
        await renderLoggedIn();
        const pull = deferred<{ merged: SavedPlan[]; changed: boolean }>();
        vi.mocked(planService.fetchAndMerge).mockReturnValue(pull.promise);
        tabBack();
        const remoteData = { ...startPlan.data, timelineMitigations: [{ id: 'm-remote' } as never] };
        pull.resolve({ merged: [{ ...startPlan, data: remoteData, updatedAt: Date.now() + 60_000 }], changed: true });
        await flush();

        expect(workingIds()).toEqual(['m-remote']);
        expect(planIds()).toEqual(['m-remote']);
    });
});

describe('手動同期ボタンの取り直しの最中に置いた軽減', () => {
    it('サーバー側の方が新しいと判定されても、置いた軽減が残る', async () => {
        vi.mocked(planService.migrateLocalPlansToFirestore).mockImplementation(async (local) => ({ merged: local, dirtyIds: [] }));
        useAuthStore.setState({ user: { uid: UID } } as never);
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        await flush();
        await flush();
        const pull = deferred<{ merged: SavedPlan[]; changed: boolean }>();
        vi.mocked(planService.fetchAndMerge).mockReturnValue(pull.promise);
        let done!: Promise<void>;
        act(() => { done = usePlanStore.getState().manualSync(UID, 'u'); });
        await flush();
        placeMitigation('m-new');
        act(() => { vi.advanceTimersByTime(500); });

        pull.resolve({ merged: [{ ...startPlan, updatedAt: Date.now() + 60_000 }], changed: true });
        await act(async () => { await done; });

        expect(workingIds()).toEqual(['m-new']);
        expect(planIds()).toEqual(['m-new']);
    });
});
