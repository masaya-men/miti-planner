// @vitest-environment happy-dom
/**
 * データ安全(2026-08-08、最終レビュー指摘 Finding 3 の修正):
 * プランを複製する経路(duplicatePlan / 同期の競合コピー2箇所)は、いずれも
 * structuredClone で元プランを丸ごと複製したあと必要なフィールドだけ上書きしているが、
 * `activeCollabRoomToken`/`collabMaxParticipants` の上書きが漏れていた。
 * これが漏れると、複製先が元プランと同じ共同編集ルームの「持ち主」を名乗ってしまい、
 * reseed信頼境界ガード(canTrustLocalDataForRoom)が誤って複製先のデータを
 * 元のルームへ書き込めるものとして信頼してしまう。
 * 3経路すべてで、複製結果がこの2フィールドを引き継がないことを検証する。
 *
 * 既存テスト(usePlanStore.syncToFirestore.test.ts)の mock パターンを踏襲。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const TEST_UID = 'testUid';
const TEST_DISPLAY_NAME = 'Test User';

function makeCollabPlan(id: string) {
    return {
        id,
        ownerId: 'local' as const,
        ownerDisplayName: 'Guest',
        contentId: null,
        title: `title_${id}`,
        data: { timelineMitigations: [{ id: 'm1' }] } as any,
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        createdAt: 0,
        updatedAt: 0,
        // このプランは共同編集ルームに繋がっている状態。
        activeCollabRoomToken: 'room-abc',
        collabMaxParticipants: 8,
    };
}

describe('プラン複製は共同編集ルームの持ち主を引き継がない', () => {
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

    it('duplicatePlan: 複製結果は activeCollabRoomToken / collabMaxParticipants を持たない', async () => {
        usePlanStore.setState({ plans: [makeCollabPlan('p1')] } as any);

        const copy = await usePlanStore.getState().duplicatePlan('p1');

        expect(copy).not.toBeNull();
        expect(copy!.activeCollabRoomToken).toBeUndefined();
        expect(copy!.collabMaxParticipants).toBeUndefined();
        // 元プラン自身は引き続きルームに繋がったまま(複製時に壊されない)。
        expect(usePlanStore.getState().plans.find(p => p.id === 'p1')?.activeCollabRoomToken).toBe('room-abc');
    });

    it('syncToFirestore の競合コピー: 複製結果は activeCollabRoomToken / collabMaxParticipants を持たない', async () => {
        const original = makeCollabPlan('p1');
        usePlanStore.setState({
            plans: [original],
            _dirtyPlanIds: new Set(['p1']),
        } as any);
        vi.mocked(planService.syncDirtyPlans).mockResolvedValueOnce({
            deletedRemotely: [],
            conflicted: [original as any],
        });

        await usePlanStore.getState().syncToFirestore(TEST_UID, TEST_DISPLAY_NAME, true);

        const copies = usePlanStore.getState().plans.filter(p => p.id !== 'p1');
        expect(copies).toHaveLength(1);
        expect(copies[0].activeCollabRoomToken).toBeUndefined();
        expect(copies[0].collabMaxParticipants).toBeUndefined();
    });

    it('manualSync の競合コピー: 複製結果は activeCollabRoomToken / collabMaxParticipants を持たない', async () => {
        const original = makeCollabPlan('p1');
        usePlanStore.setState({
            plans: [original],
            _dirtyPlanIds: new Set(['p1']),
        } as any);
        vi.mocked(planService.syncDirtyPlans).mockResolvedValueOnce({
            deletedRemotely: [],
            conflicted: [original as any],
        });

        await usePlanStore.getState().manualSync(TEST_UID, TEST_DISPLAY_NAME);

        const copies = usePlanStore.getState().plans.filter(p => p.id !== 'p1');
        expect(copies).toHaveLength(1);
        expect(copies[0].activeCollabRoomToken).toBeUndefined();
        expect(copies[0].collabMaxParticipants).toBeUndefined();
    });
});
