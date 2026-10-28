// @vitest-environment happy-dom
/**
 * 本番消失調査の 3 位: 固まったタブを閉じる/リロードすると、0.5 秒待ちの表への保存が走らないまま終わり、
 * 次の起動でログイン取り込みの読み直しが表の古い内容で上書きして、置いた軽減が消える。
 * 「閉じる瞬間にサーバーへ送る」は間に合わない前提で、手元に残して次の起動で表へ書き戻し・送る印を付けることを確かめる。
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
vi.mock('../ui/TransitionOverlay', () => ({ useTransitionOverlay: () => ({ runTransition: (fn: () => void) => fn() }) }));
vi.mock('../AppFooter', () => ({ AppFooter: Empty }));
vi.mock('../LoginModal', () => ({ LoginModal: Empty }));
vi.mock('../RenderPendingIndicator', () => ({ RenderPendingIndicator: Empty }));
vi.mock('../SyncButton', () => ({ SyncButton: Empty }));
vi.mock('../Toast', () => ({ showToast: vi.fn() }));
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

describe('0.5 秒待ちの保存が走らないまま閉じた後の次の起動(経路 3)', () => {
    it('置いた軽減が表へ書き戻され、ログイン取り込みの後も残り、サーバーへ書き戻される', async () => {
        // 1 回目の起動: 軽減を置いた直後に固まって閉じた(0.5 秒待ちの保存も離脱時の保存も走らない)
        const first = render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        placeMitigation('m-new');
        first.unmount();
        expect(workingIds()).toEqual(['m-new']); // 作業ストア(mitigation-storage)には残っている
        expect(planIds()).toEqual([]);           // 表(plan-storage)には入っていない

        // 2 回目の起動 → ログイン取り込み。本物と同じく「手元の方が新しい表は手元を採ってサーバーへ書き戻す」、
        // 「サーバーの方が新しい(または同じ)表はサーバーの物(軽減なし)を採る」
        const migrate = deferred<void>();
        vi.mocked(planService.migrateLocalPlansToFirestore).mockImplementation((local) => migrate.promise.then(() => ({
            merged: local.map((p) => (p.updatedAt > startPlan.updatedAt ? p : startPlan)), dirtyIds: [],
        })));
        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        login();
        migrate.resolve();
        await flush();
        act(() => { vi.advanceTimersByTime(1000); });

        expect(workingIds()).toEqual(['m-new']);
        expect(planIds()).toEqual(['m-new']);
        // 取り込みに渡した手元の表に軽減が入っていて、サーバーより新しい = サーバーへ書き戻される
        const sentLocal = vi.mocked(planService.migrateLocalPlansToFirestore).mock.calls[0][0].find((p) => p.id === 'p1')!;
        expect(sentLocal.data.timelineMitigations.map((m) => m.id)).toEqual(['m-new']);
        expect(sentLocal.updatedAt).toBeGreaterThan(startPlan.updatedAt);
    });

    it('前回きちんと保存してから閉じていれば、次の起動で何も書き戻さない', async () => {
        const first = render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        placeMitigation('m-new');
        act(() => { vi.advanceTimersByTime(500); });
        first.unmount();
        const before = usePlanStore.getState().plans.find((p) => p.id === 'p1');

        render(<MemoryRouter><Layout><div /></Layout></MemoryRouter>);
        expect(usePlanStore.getState().plans.find((p) => p.id === 'p1')).toBe(before);
    });
});
