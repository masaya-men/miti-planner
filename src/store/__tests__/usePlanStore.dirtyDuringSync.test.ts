// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 既存テスト (usePlanStore.addPlanGuard.test.ts) の mock パターンを踏襲

vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn(() => () => undefined),
}));

vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(() => ({})),
}));

vi.mock('firebase/analytics', () => ({
    getAnalytics: vi.fn(() => ({})),
    isSupported: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('firebase/firestore', () => ({
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({ id: 'mock-doc' })),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
    deleteDoc: vi.fn(async () => undefined),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn(async () => undefined),
    })),
}));

vi.mock('firebase/app-check', () => ({
    initializeAppCheck: vi.fn(() => ({})),
    ReCaptchaEnterpriseProvider: vi.fn(),
    getToken: vi.fn(async () => ({ token: 'mock-token' })),
}));

vi.mock('../../lib/firebase', () => ({
    auth: { currentUser: { uid: 'testUid' } },
    db: {},
    storage: {},
    ensureAppCheck: () => null,
    getActiveAppCheck: () => null,
}));

vi.mock('../../lib/appCheck', () => ({
    createLazyAppCheck: () => ({ ensureAppCheck: () => null, getActiveAppCheck: () => null }),
}));

vi.mock('../../lib/planService', () => ({
    planService: {
        createPlan: vi.fn(async () => undefined),
        updatePlan: vi.fn(async () => undefined),
        deletePlan: vi.fn(async () => undefined),
        fetchUserPlans: vi.fn(async () => []),
        syncDirtyPlans: vi.fn(async () => ({ deletedRemotely: [], conflicted: [] })),
        fetchAndMerge: vi.fn(async () => ({ merged: [], changed: false })),
        checkPlanLimits: vi.fn(async () => undefined),
        checkPlanExists: vi.fn(async () => false),
        ensurePlanCounts: vi.fn(async () => undefined),
        repairPlanCounts: vi.fn(async () => undefined),
        migrateLocalPlansToFirestore: vi.fn(async () => ({ merged: [], dirtyIds: [] })),
    },
}));

import { usePlanStore } from '../usePlanStore';
import { planService } from '../../lib/planService';

/**
 * 保存(Firestore への送信)の最中に来た 2 回目の編集の「保存待ちの印」が、
 * 1 回目の保存完了で外されて、2 回目がサーバーへ届かなくなる穴 (2026-10-28 消失調査) の再現と回帰防止。
 */
const UID = 'testUid';
const NAME = 'Test User';

function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
}
const syncResult = { deletedRemotely: [] as string[], conflicted: [] as never[] };
const plan = { id: 'p1', ownerId: UID, ownerDisplayName: 'u', contentId: 'c1', title: 'before', data: {} as never, isPublic: false, copyCount: 0, useCount: 0, createdAt: 1, updatedAt: 1 };
/** syncDirtyPlans の n 回目の呼び出しで送られた p1 の題名 */
const sentTitle = (n: number) => vi.mocked(planService.syncDirtyPlans).mock.calls[n]?.[1].find((p) => p.id === 'p1')?.title;

beforeEach(() => {
    // 時刻だけ止めて進める(送り始めた後の編集が、時刻の上でも「後」になるように)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    vi.clearAllMocks();
    vi.mocked(planService.syncDirtyPlans).mockReset();
    vi.mocked(planService.fetchAndMerge).mockImplementation(async (local) => ({ merged: local, changed: false }));
    usePlanStore.setState({
        plans: [plan], currentPlanId: null, _dirtyPlanIds: new Set(['p1']), _deletedPlanIds: new Set(),
        _lastSyncAt: 0, _isSyncing: false, _cloudStatus: 'idle',
    } as never);
});

afterEach(() => { vi.useRealTimers(); });

describe('保存の最中に来た 2 回目の編集', () => {
    it('自動の保存(syncToFirestore): 完了後も印が残り、次の保存で 2 回目がサーバーへ届く', async () => {
        const first = deferred<typeof syncResult>();
        vi.mocked(planService.syncDirtyPlans).mockReturnValueOnce(first.promise).mockResolvedValue(syncResult);
        const p = usePlanStore.getState().syncToFirestore(UID, NAME, true);
        vi.setSystemTime(1_000_010);
        usePlanStore.getState().updatePlan('p1', { title: 'after' });
        first.resolve(syncResult);
        await p;

        expect(sentTitle(0)).toBe('before');
        expect(usePlanStore.getState()._dirtyPlanIds.has('p1')).toBe(true);
        // 次の保存(間引きのかかる普段の保存)で 2 回目の編集が届く
        await usePlanStore.getState().syncToFirestore(UID, NAME);
        expect(sentTitle(1)).toBe('after');
    });

    it('自動の保存: 保存の間に何も変えていなければ、今まで通り印は外れる', async () => {
        vi.mocked(planService.syncDirtyPlans).mockResolvedValue(syncResult);
        await usePlanStore.getState().syncToFirestore(UID, NAME, true);
        expect(usePlanStore.getState()._dirtyPlanIds.size).toBe(0);
    });

    it('手動同期(manualSync): 送信の間の編集の印が残る', async () => {
        const first = deferred<typeof syncResult>();
        vi.mocked(planService.syncDirtyPlans).mockReturnValueOnce(first.promise).mockResolvedValue(syncResult);
        const p = usePlanStore.getState().manualSync(UID, NAME);
        await Promise.resolve();
        vi.setSystemTime(1_000_010);
        usePlanStore.getState().updatePlan('p1', { title: 'after' });
        first.resolve(syncResult);
        await p;

        expect(sentTitle(0)).toBe('before');
        expect(usePlanStore.getState()._dirtyPlanIds.has('p1')).toBe(true);
        await usePlanStore.getState().syncToFirestore(UID, NAME);
        expect(sentTitle(1)).toBe('after');
    });

    it('手動同期: 送信の間に消した表の削除待ちは残る', async () => {
        const first = deferred<typeof syncResult>();
        vi.mocked(planService.syncDirtyPlans).mockReturnValueOnce(first.promise).mockResolvedValue(syncResult);
        usePlanStore.setState({ plans: [plan, { ...plan, id: 'p2' }] } as never);
        const p = usePlanStore.getState().manualSync(UID, NAME);
        await Promise.resolve();
        usePlanStore.getState().deletePlan('p2');
        first.resolve(syncResult);
        await p;
        expect(usePlanStore.getState()._deletedPlanIds.has('p2')).toBe(true);
    });
});
