// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockAuth = vi.hoisted(() => ({
    currentUser: null as { uid: string } | null,
}));

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
    get auth() { return mockAuth; },
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
    },
}));

import { usePlanStore } from '../usePlanStore';
import type { SavedPlan } from '../../types';

function makePlan(overrides: Partial<SavedPlan>): SavedPlan {
    return {
        id: 'plan_test_' + Math.random().toString(36).slice(2),
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: 'fru',
        title: 'Test Plan',
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: {
            currentLevel: 100,
            timelineEvents: [],
            timelineMitigations: [],
            phases: [],
            partyMembers: [],
            aaSettings: { damage: 0, type: 'physical', target: 'MT' },
            schAetherflowPatterns: {},
        } as any,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    } as SavedPlan;
}

/**
 * リグレッションテスト: 致命バグ「ownerId='' で localStorage から消滅」防止
 *
 * 背景: 過去 (commit 2c2fc76 など、 計4回) に SharePage 等の経路で
 * `ownerId: ''` (空文字) のままプランが addPlan されてしまい、
 * 後続の fetchAndMerge / migrateOnLogin が「別端末で削除された」と
 * 誤判定 → localStorage から消える事故が起きた。
 *
 * 防御: addPlan の入口で ownerId='' を 'local' に矯正。
 * このテストはその矯正ロジックが将来削除/破壊されないことを保証する。
 */
describe("usePlanStore.addPlan: ownerId='' 正規化ガード (致命バグ防止)", () => {
    beforeEach(() => {
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
    });

    it("ownerId='' で addPlan されたら state 内では 'local' に矯正される", () => {
        const plan = makePlan({ ownerId: '' });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored).toBeDefined();
        expect(stored.ownerId).toBe('local');
        // 元オブジェクトは変更されていない (immutable な扱い)
        expect(plan.ownerId).toBe('');
    });

    it("ownerId='local' はそのまま保持される", () => {
        const plan = makePlan({ ownerId: 'local' });
        usePlanStore.getState().addPlan(plan);

        expect(usePlanStore.getState().plans[0].ownerId).toBe('local');
    });

    it("実ユーザー uid (例: 'uid_abc123') は矯正されず保持される", () => {
        const plan = makePlan({ ownerId: 'uid_abc123' });
        usePlanStore.getState().addPlan(plan);

        expect(usePlanStore.getState().plans[0].ownerId).toBe('uid_abc123');
    });

    it("ownerId='' を矯正しても他のフィールド (title / contentId / data) は失われない", () => {
        const plan = makePlan({
            ownerId: '',
            title: 'Critical Plan',
            contentId: 'm9s',
        });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored.ownerId).toBe('local');
        expect(stored.title).toBe('Critical Plan');
        expect(stored.contentId).toBe('m9s');
        expect(stored.data).toBeDefined();
    });

    it("ownerId='' で複数追加しても全て 'local' に矯正される (連続呼び出しでガードが消えない)", () => {
        usePlanStore.getState().addPlan(makePlan({ id: 'p1', ownerId: '' }));
        usePlanStore.getState().addPlan(makePlan({ id: 'p2', ownerId: '' }));
        usePlanStore.getState().addPlan(makePlan({ id: 'p3', ownerId: '' }));

        const all = usePlanStore.getState().plans;
        expect(all).toHaveLength(3);
        expect(all.every(p => p.ownerId === 'local')).toBe(true);
    });

    it("追加されたプランは _dirtyPlanIds に登録される (矯正後も同期対象になる)", () => {
        const plan = makePlan({ id: 'plan_dirty_check', ownerId: '' });
        usePlanStore.getState().addPlan(plan);

        expect(usePlanStore.getState()._dirtyPlanIds.has('plan_dirty_check')).toBe(true);
    });
});
