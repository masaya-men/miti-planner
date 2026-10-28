// @vitest-environment happy-dom
/**
 * 敵対レビュー(2026-10-28) Critical 1 の再現と回帰防止。
 * 読み直し(ログイン取り込み・タブ復帰の取り直し・手動同期)の最中に表を切り替えただけでは、
 * 別端末の新しい編集を古い手元の内容で上書きしない。本当に編集していてサーバーも変わっていたら両方を残す。
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

const remoteP1 = () => ({
    ...startPlan,
    data: { ...startPlan.data, timelineMitigations: [{ id: 'm-remote' } as never] },
    updatedAt: Date.now() + 60_000,
}) as SavedPlan;
const p2 = () => ({ ...startPlan, id: 'p2', title: 't2' }) as SavedPlan;
/** サイドバーで表を切り替える(切り替える前の表を保存 → 切替先を読み込む)。中身は何も変えない */
const switchTo = (id: string) => act(() => {
    const ps = usePlanStore.getState();
    const miti = useMitigationStore.getState();
    ps.updatePlan(ps.currentPlanId!, { data: miti.getSnapshot() });
    miti.loadSnapshot(usePlanStore.getState().plans.find((p) => p.id === id)!.data, id);
    usePlanStore.setState({ currentPlanId: id });
});
/** 手元の古い p1(軽減なし)がサーバーへ送られたか */
const sentOldP1 = () => vi.mocked(planService.syncDirtyPlans).mock.calls.some(([ids, plans]) =>
    ids.has('p1') && (plans.find((p) => p.id === 'p1')?.data.timelineMitigations ?? []).length === 0);
const p1Ids = () => planIds();
const conflictCopies = () => usePlanStore.getState().plans.filter((p) => p.id.endsWith('_conflict'));
const renderLoggedIn = async () => {
    vi.mocked(planService.migrateLocalPlansToFirestore).mockImplementation(async (local) => ({ merged: local, dirtyIds: [] }));
    useAuthStore.setState({ user: { uid: UID } } as never);
    render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
    await flush();
    await flush();
};
const settle = async () => { await flush(); act(() => { vi.advanceTimersByTime(1000); }); await flush(); };

describe('読み直しの最中に表を切り替えただけ(Critical 1)', () => {
    beforeEach(() => { usePlanStore.setState({ plans: [startPlan, p2()] } as never); });

    it('取り込みの最中に表を切り替えただけでは、別端末の新しい編集を上書きしない', async () => {
        const migrate = deferred<{ merged: SavedPlan[]; dirtyIds: string[] }>();
        vi.mocked(planService.migrateLocalPlansToFirestore).mockReturnValue(migrate.promise);
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        login();
        switchTo('p2');
        act(() => { vi.advanceTimersByTime(500); });
        migrate.resolve({ merged: [remoteP1(), p2()], dirtyIds: [] });
        await settle();

        expect(p1Ids()).toEqual(['m-remote']);
        expect(sentOldP1()).toBe(false);
        expect(usePlanStore.getState()._dirtyPlanIds.has('p1')).toBe(false);
    });

    it('タブ復帰の取り直しの最中に表を切り替えただけでは、別端末の新しい編集を上書きしない', async () => {
        await renderLoggedIn();
        const pull = deferred<{ merged: SavedPlan[]; changed: boolean }>();
        vi.mocked(planService.fetchAndMerge).mockReturnValue(pull.promise);
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        switchTo('p2');
        act(() => { vi.advanceTimersByTime(500); });
        pull.resolve({ merged: [remoteP1(), p2()], changed: true });
        await settle();

        expect(p1Ids()).toEqual(['m-remote']);
        expect(sentOldP1()).toBe(false);
    });

    it('手動同期の最中に表を切り替えただけでは、別端末の新しい編集を上書きしない', async () => {
        await renderLoggedIn();
        const pull = deferred<{ merged: SavedPlan[]; changed: boolean }>();
        vi.mocked(planService.fetchAndMerge).mockReturnValue(pull.promise);
        let done!: Promise<void>;
        act(() => { done = usePlanStore.getState().manualSync(UID, 'u'); });
        await flush();
        switchTo('p2');
        act(() => { vi.advanceTimersByTime(500); });
        pull.resolve({ merged: [remoteP1(), p2()], changed: true });
        await act(async () => { await done; });
        await settle();

        expect(p1Ids()).toEqual(['m-remote']);
        expect(sentOldP1()).toBe(false);
    });
});

describe('読み直しの最中に本当に編集し、サーバーも変わっていた(本当の競合)', () => {
    it('取り込みの最中に本当に編集し、サーバーも新しい時は両方が残る', async () => {
        const migrate = deferred<{ merged: SavedPlan[]; dirtyIds: string[] }>();
        vi.mocked(planService.migrateLocalPlansToFirestore).mockReturnValue(migrate.promise);
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        login();
        placeMitigation('m-new');
        act(() => { vi.advanceTimersByTime(500); });
        migrate.resolve({ merged: [remoteP1()], dirtyIds: [] });
        await settle();

        // サーバーの編集は表に、手元の編集は競合コピーに残る
        expect(p1Ids()).toEqual(['m-remote']);
        expect(workingIds()).toEqual(['m-remote']);
        expect(sentOldP1()).toBe(false);
        expect(sentOrPending('m-new')).toBe(false);
        const copies = conflictCopies();
        expect(copies).toHaveLength(1);
        expect(copies[0].data.timelineMitigations.map((m) => m.id)).toEqual(['m-new']);
    });

    it('0.5 秒待ちの保存の前に取り込みが終わっても、両方が残る', async () => {
        const migrate = deferred<{ merged: SavedPlan[]; dirtyIds: string[] }>();
        vi.mocked(planService.migrateLocalPlansToFirestore).mockReturnValue(migrate.promise);
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        login();
        placeMitigation('m-new');
        migrate.resolve({ merged: [remoteP1()], dirtyIds: [] });
        await settle();

        expect(p1Ids()).toEqual(['m-remote']);
        expect(workingIds()).toEqual(['m-remote']);
        const copies = conflictCopies();
        expect(copies).toHaveLength(1);
        expect(copies[0].data.timelineMitigations.map((m) => m.id)).toEqual(['m-new']);
    });
});
