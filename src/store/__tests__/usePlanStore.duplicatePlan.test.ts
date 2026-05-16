// @vitest-environment happy-dom
/**
 * リグレッションテスト: duplicatePlan の ownerId='local' 誤発火バグ防止
 *
 * 背景 (バグ履歴):
 * commit 68555db ("sync 成功後に書換") → 失敗
 * commit 05dfa64 ("addPlan 入口で uid 置換") → 失敗
 * 原因: duplicatePlan は addPlan を経由せず直接 set している経路だったため、
 * addPlan 内の uid 置換ロジックが走らなかった (ユーザー実機検証で発覚)。
 *
 * 修正: applyOwnerIdIfLoggedIn helper を addPlan と duplicatePlan の両方で使用し、
 * ログイン中なら最初から uid で plan を生成する設計に統一。
 *
 * このテストは duplicatePlan で uid 置換が走ることを保証する。
 * 将来「直接 set で plan を作る別経路」を追加してこの helper を呼び忘れたら、
 * 同じ症状 (LocalImportDialog 誤発火) が再発するので注意。
 */
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

// テンプレート取得は duplicatePlan 内で呼ばれるが、 本テストの focus は ownerId なので
// テンプレートが見つからない (null) として早期 return する mock にする
vi.mock('../../data/templateLoader', () => ({
    getTemplate: vi.fn(async () => null),
}));

// useAuthStore は applyOwnerIdIfLoggedIn helper 内で getState() のみ使われる。
// 直接 mock し、 user / profileDisplayName をテストごとに上書きできるようにする。
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
        id: 'plan_source_' + Math.random().toString(36).slice(2),
        ownerId: 'uid_owner',
        ownerDisplayName: 'Owner',
        contentId: 'fru',
        title: 'Source Plan',
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

describe("usePlanStore.duplicatePlan: ログイン中は ownerId が uid になる (誤発火防止)", () => {
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

    it("ログイン中に既存プランを複製 → 新プランの ownerId は uid", async () => {
        mockAuthState.user = { uid: 'uid_logged_in' };
        mockAuthState.profileDisplayName = 'LoggedInUser';

        const source = makePlan({ id: 'plan_src_login', title: 'FRU Plan' });
        usePlanStore.setState({ plans: [source] });

        const dup = await usePlanStore.getState().duplicatePlan('plan_src_login');

        expect(dup).not.toBeNull();
        expect(dup!.ownerId).toBe('uid_logged_in');
        expect(dup!.ownerDisplayName).toBe('LoggedInUser');

        // state にも反映されているか
        const stored = usePlanStore.getState().plans.find(p => p.id === dup!.id);
        expect(stored?.ownerId).toBe('uid_logged_in');
    });

    it("未ログイン中に複製 → 新プランの ownerId='local' のまま (旧挙動維持)", async () => {
        mockAuthState.user = null;

        const source = makePlan({ id: 'plan_src_anon' });
        usePlanStore.setState({ plans: [source] });

        const dup = await usePlanStore.getState().duplicatePlan('plan_src_anon');

        expect(dup).not.toBeNull();
        expect(dup!.ownerId).toBe('local');
    });

    it("ログイン中 + profileDisplayName 空 → 'Guest' (元 newPlan の値) を維持", async () => {
        mockAuthState.user = { uid: 'uid_no_name' };
        mockAuthState.profileDisplayName = '';

        const source = makePlan({ id: 'plan_src_no_name' });
        usePlanStore.setState({ plans: [source] });

        const dup = await usePlanStore.getState().duplicatePlan('plan_src_no_name');

        expect(dup!.ownerId).toBe('uid_no_name');
        // duplicatePlan は newPlan を 'Guest' 固定で作るので、 helper はそれを保持
        expect(dup!.ownerDisplayName).toBe('Guest');
    });

    it("複製プランは _dirtyPlanIds に登録される (uid 置換後も同期対象)", async () => {
        mockAuthState.user = { uid: 'uid_dirty_check' };

        const source = makePlan({ id: 'plan_src_dirty' });
        usePlanStore.setState({ plans: [source] });

        const dup = await usePlanStore.getState().duplicatePlan('plan_src_dirty');

        expect(usePlanStore.getState()._dirtyPlanIds.has(dup!.id)).toBe(true);
    });

    it("複製プランはソースプランの直後に挿入される (順序保持の UX 要件)", async () => {
        mockAuthState.user = { uid: 'uid_order' };

        const p1 = makePlan({ id: 'plan_a' });
        const p2 = makePlan({ id: 'plan_b' });
        const p3 = makePlan({ id: 'plan_c' });
        usePlanStore.setState({ plans: [p1, p2, p3] });

        const dup = await usePlanStore.getState().duplicatePlan('plan_b');

        const ids = usePlanStore.getState().plans.map(p => p.id);
        // [plan_a, plan_b, <duplicated>, plan_c]
        expect(ids).toEqual(['plan_a', 'plan_b', dup!.id, 'plan_c']);
    });

    it("ソースプランが見つからない → null を返す (副作用なし)", async () => {
        mockAuthState.user = { uid: 'uid_404' };

        const source = makePlan({ id: 'plan_exists' });
        usePlanStore.setState({ plans: [source] });

        const result = await usePlanStore.getState().duplicatePlan('plan_does_not_exist');

        expect(result).toBeNull();
        expect(usePlanStore.getState().plans).toHaveLength(1);
    });
});
