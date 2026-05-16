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

// useAuthStore は addPlan 内で getState() のみ使われる。
// 直接 mock し、user / profileDisplayName をテストごとに上書きできるようにする。
const mockAuthState = vi.hoisted(() => ({
    user: null as { uid: string } | null,
    profileDisplayName: '' as string,
}));
vi.mock('../useAuthStore', () => ({
    useAuthStore: {
        getState: () => mockAuthState,
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
        // 未ログイン状態を既定 (旧仕様のテストはログインなし前提)
        mockAuthState.user = null;
        mockAuthState.profileDisplayName = '';
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

/**
 * リグレッションテスト: 「ログイン中の addPlan は最初から uid で作成」
 *
 * 背景: 旧仕様では addPlan で ownerId='local' で作成し、自動 sync 成功後に
 * uid へ書換える設計。しかし自動 sync は useMitigationStore 変更にのみ subscribe
 * しており addPlan 単独では発火しないため、リロードまでに sync が間に合わず
 * ownerId='local' のまま persist → 次回ログイン後 LocalImportDialog 誤発火 の
 * バグが発生していた。
 *
 * 新仕様: ログイン中なら addPlan の入口で最初から uid に置換する (race-free)。
 * 未ログインは従来通り 'local' で作成 (sign-in 時に LocalImportDialog で取込)。
 */
describe("usePlanStore.addPlan: ログイン中は最初から uid で作成 (LocalImportDialog 誤発火防止)", () => {
    beforeEach(() => {
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        mockAuthState.user = null;
        mockAuthState.profileDisplayName = '';
    });

    it("ログイン中 + ownerId='local' → uid と profileDisplayName に置換される", () => {
        mockAuthState.user = { uid: 'uid_logged_in' };
        mockAuthState.profileDisplayName = 'LoggedInUser';

        const plan = makePlan({ id: 'p_login', ownerId: 'local', ownerDisplayName: 'Guest' });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored.ownerId).toBe('uid_logged_in');
        expect(stored.ownerDisplayName).toBe('LoggedInUser');
    });

    it("ログイン中 + profileDisplayName 空 → 元の ownerDisplayName を維持", () => {
        mockAuthState.user = { uid: 'uid_no_name' };
        mockAuthState.profileDisplayName = '';

        const plan = makePlan({ id: 'p_no_name', ownerId: 'local', ownerDisplayName: 'OriginalName' });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored.ownerId).toBe('uid_no_name');
        expect(stored.ownerDisplayName).toBe('OriginalName');
    });

    it("ログイン中 + ownerId='' → 'local' 正規化 → uid 置換 (両ガード連携)", () => {
        mockAuthState.user = { uid: 'uid_both_guards' };
        mockAuthState.profileDisplayName = 'User';

        const plan = makePlan({ id: 'p_both', ownerId: '' });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored.ownerId).toBe('uid_both_guards');
    });

    it("ログイン中 + 既に uid で渡された → 上書きしない (副作用なし)", () => {
        mockAuthState.user = { uid: 'uid_current' };
        mockAuthState.profileDisplayName = 'Current';

        const plan = makePlan({ id: 'p_existing_uid', ownerId: 'uid_other', ownerDisplayName: 'Other' });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored.ownerId).toBe('uid_other');
        expect(stored.ownerDisplayName).toBe('Other');
    });

    it("未ログイン + ownerId='local' → 'local' のまま (旧挙動維持: sign-in 時に取込)", () => {
        mockAuthState.user = null;

        const plan = makePlan({ id: 'p_anon', ownerId: 'local' });
        usePlanStore.getState().addPlan(plan);

        expect(usePlanStore.getState().plans[0].ownerId).toBe('local');
    });
});
