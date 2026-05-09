// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    appCheck: {},
}));

vi.mock('../../lib/appCheck', () => ({
    initAppCheck: vi.fn(() => null),
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

const TEST_UID = 'testUid';
const TEST_DISPLAY_NAME = 'Test User';

function makePlan(id: string, contentId: string) {
    return {
        id,
        ownerId: 'local' as const,
        ownerDisplayName: 'Guest',
        contentId,
        title: `title_${id}`,
        data: {} as any,
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        createdAt: 0,
        updatedAt: 0,
    };
}

describe('syncToFirestore({ onlyPlanIds })', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        usePlanStore.setState({
            plans: [],
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
            _lastSyncAt: 0,
            _isSyncing: false,
            _cloudStatus: 'synced',
        } as any);
    });

    it('指定した planId のみを syncDirtyPlans に渡す (onlyPlanIds=[p1])', async () => {
        usePlanStore.setState({
            plans: [makePlan('p1', 'c1'), makePlan('p2', 'c2'), makePlan('p3', 'c3')],
            _dirtyPlanIds: new Set(['p1', 'p2', 'p3']),
        } as any);

        const syncSpy = vi.mocked(planService.syncDirtyPlans);

        await usePlanStore.getState().syncToFirestore(TEST_UID, TEST_DISPLAY_NAME, true, ['p1']);

        expect(syncSpy).toHaveBeenCalledTimes(1);
        const passedSet: Set<string> = syncSpy.mock.calls[0][0];
        expect(passedSet.size).toBe(1);
        expect(passedSet.has('p1')).toBe(true);
        expect(passedSet.has('p2')).toBe(false);
        expect(passedSet.has('p3')).toBe(false);
    });

    it('onlyPlanIds 未指定のとき全 dirty プランを処理する (後方互換)', async () => {
        usePlanStore.setState({
            plans: [makePlan('p1', 'c1'), makePlan('p2', 'c2')],
            _dirtyPlanIds: new Set(['p1', 'p2']),
        } as any);

        const syncSpy = vi.mocked(planService.syncDirtyPlans);

        await usePlanStore.getState().syncToFirestore(TEST_UID, TEST_DISPLAY_NAME, true);

        expect(syncSpy).toHaveBeenCalledTimes(1);
        const passedSet: Set<string> = syncSpy.mock.calls[0][0];
        expect(passedSet.size).toBe(2);
        expect(passedSet.has('p1')).toBe(true);
        expect(passedSet.has('p2')).toBe(true);
    });

    it('onlyPlanIds=[] のとき何も処理しない (空配列)', async () => {
        usePlanStore.setState({
            plans: [makePlan('p1', 'c1')],
            _dirtyPlanIds: new Set(['p1']),
        } as any);

        const syncSpy = vi.mocked(planService.syncDirtyPlans);

        await usePlanStore.getState().syncToFirestore(TEST_UID, TEST_DISPLAY_NAME, true, []);

        // syncingDirtyIds が空 → syncDirtyPlans の内部で即 return するか、
        // または呼ばれても Set サイズ 0 で何もしない。
        // いずれにせよ実際の書き込みは 0 件であることを確認する。
        if (syncSpy.mock.calls.length > 0) {
            const passedSet: Set<string> = syncSpy.mock.calls[0][0];
            expect(passedSet.size).toBe(0);
        } else {
            expect(syncSpy).not.toHaveBeenCalled();
        }
    });
});
