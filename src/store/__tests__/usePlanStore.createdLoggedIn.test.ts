// @vitest-environment happy-dom
/**
 * リグレッションテスト: `_createdLoggedIn` フィールド設定の全経路検証
 *
 * 背景 (Plan v4):
 * `ownerId='local'` マーカーが「Firestore に未アップロード」 と「ユーザー本人の意思で
 * アップしてない」 の 2 つの意味で兼用されていたため、 ログイン中に作成したプランでも
 * LocalImportDialog が誤発火していた。
 *
 * 修正: プラン作成経路すべてで `tagCreationIntent` helper を呼び、
 * 認証状態 (auth.currentUser?.uid の有無) に応じて `_createdLoggedIn` を設定する。
 *
 * このテストは「実際にプランを作る経路」 を呼んで、 結果プランに `_createdLoggedIn` が
 * 正しく設定されるかを end-to-end で検証する。 helper 単体ではなく経路ごと検証する
 * ことで、 将来「helper 呼び忘れの新規経路」 が追加されたら直ちに失敗する。
 *
 * 過去の失敗教訓:
 * - addPlan だけテストして、 duplicatePlan が helper を呼び忘れていたバグを 1 commit
 *   通してしまった (commit 05dfa64)。 経路ごと検証で防ぐ。
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

// firebase.ts は auth を named export していて、 tagCreationIntent が直接読む。
// mock で currentUser を切り替えられるようにする。
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
        checkPlanExists: vi.fn(async () => false),
    },
}));

// duplicatePlan 内で getTemplate が呼ばれるが、 stats フィールドは focus 外なので null mock
vi.mock('../../data/templateLoader', () => ({
    getTemplate: vi.fn(async () => null),
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

describe('_createdLoggedIn 設定: addPlan 経路', () => {
    beforeEach(() => {
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        mockAuth.currentUser = null;
    });

    it('ログイン中の addPlan → _createdLoggedIn=true がセットされる', () => {
        mockAuth.currentUser = { uid: 'uid_logged_in' };

        const plan = makePlan({ id: 'p_login', ownerId: 'local' });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored._createdLoggedIn).toBe(true);
        // ownerId は触らない (重要: 設計マーカー保持)
        expect(stored.ownerId).toBe('local');
    });

    it('未ログイン中の addPlan → _createdLoggedIn=false がセットされる', () => {
        mockAuth.currentUser = null;

        const plan = makePlan({ id: 'p_anon', ownerId: 'local' });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored._createdLoggedIn).toBe(false);
        expect(stored.ownerId).toBe('local');
    });

    it('既存 uid プランの addPlan → _createdLoggedIn は付与しない (既存プランは触らない)', () => {
        mockAuth.currentUser = { uid: 'uid_other' };

        const plan = makePlan({ id: 'p_uid', ownerId: 'uid_someone' });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored._createdLoggedIn).toBeUndefined();
        expect(stored.ownerId).toBe('uid_someone');
    });

    it('呼び出し元が明示的に _createdLoggedIn=true を指定 → 尊重する', () => {
        mockAuth.currentUser = null; // ログイン中でなくても

        const plan = makePlan({ id: 'p_explicit', ownerId: 'local', _createdLoggedIn: true });
        usePlanStore.getState().addPlan(plan);

        const stored = usePlanStore.getState().plans[0];
        expect(stored._createdLoggedIn).toBe(true);
    });
});

describe('_createdLoggedIn 設定: duplicatePlan 経路', () => {
    beforeEach(() => {
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        mockAuth.currentUser = null;
    });

    it('ログイン中の duplicatePlan → 複製プランに _createdLoggedIn=true がセットされる', async () => {
        mockAuth.currentUser = { uid: 'uid_dup_login' };

        // ソースは uid 持ち (既存プラン想定)
        const source = makePlan({ id: 'plan_src_login', ownerId: 'uid_dup_login', title: 'Source' });
        usePlanStore.setState({ plans: [source] });

        const dup = await usePlanStore.getState().duplicatePlan('plan_src_login');

        expect(dup).not.toBeNull();
        expect(dup!._createdLoggedIn).toBe(true);
        // 複製の ownerId は 'local' で作られる (既存設計通り)
        expect(dup!.ownerId).toBe('local');
    });

    it('未ログイン中の duplicatePlan → _createdLoggedIn=false', async () => {
        mockAuth.currentUser = null;

        const source = makePlan({ id: 'plan_src_anon', ownerId: 'local' });
        usePlanStore.setState({ plans: [source] });

        const dup = await usePlanStore.getState().duplicatePlan('plan_src_anon');

        expect(dup!._createdLoggedIn).toBe(false);
        expect(dup!.ownerId).toBe('local');
    });

    it('複製した plans は state にも _createdLoggedIn が反映される', async () => {
        mockAuth.currentUser = { uid: 'uid_state_check' };

        const source = makePlan({ id: 'plan_src_state', ownerId: 'local' });
        usePlanStore.setState({ plans: [source] });

        const dup = await usePlanStore.getState().duplicatePlan('plan_src_state');

        const storedDup = usePlanStore.getState().plans.find(p => p.id === dup!.id);
        expect(storedDup?._createdLoggedIn).toBe(true);
    });
});

describe('getLocalPlanIds: _createdLoggedIn=true は除外される', () => {
    beforeEach(() => {
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
    });

    it('ログイン中作成プランは getLocalPlanIds に含まれない (ダイアログ対象外)', () => {
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'p_logged_in', ownerId: 'local', _createdLoggedIn: true }),
                makePlan({ id: 'p_anon', ownerId: 'local', _createdLoggedIn: false }),
                makePlan({ id: 'p_legacy', ownerId: 'local' }), // 旧フィールド無し
                makePlan({ id: 'p_uid', ownerId: 'uid_xxx' }),
            ],
        });

        const ids = usePlanStore.getState().getLocalPlanIds();

        // _createdLoggedIn=true は除外、 false / undefined / uid は含む or 除外する
        expect(ids).toContain('p_anon');
        expect(ids).toContain('p_legacy'); // 旧プランは安全側でダイアログ対象
        expect(ids).not.toContain('p_logged_in'); // 重要: ログイン中作成は除外
        expect(ids).not.toContain('p_uid'); // 既に uid のは元から対象外
    });

    it('全部 ログイン中作成 → 空配列を返す (ダイアログ発火しない)', () => {
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'p1', ownerId: 'local', _createdLoggedIn: true }),
                makePlan({ id: 'p2', ownerId: 'local', _createdLoggedIn: true }),
            ],
        });

        expect(usePlanStore.getState().getLocalPlanIds()).toEqual([]);
    });
});

describe('複数回 addPlan しても _createdLoggedIn は安定 (二重適用しない)', () => {
    beforeEach(() => {
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        mockAuth.currentUser = { uid: 'uid_multi' };
    });

    it('同じ plan を 2 回 addPlan しても _createdLoggedIn=true で安定', () => {
        const plan = makePlan({ id: 'p_dup', ownerId: 'local' });
        usePlanStore.getState().addPlan(plan);
        usePlanStore.getState().addPlan(plan);

        const all = usePlanStore.getState().plans.filter(p => p.id === 'p_dup');
        expect(all).toHaveLength(2);
        expect(all[0]._createdLoggedIn).toBe(true);
        expect(all[1]._createdLoggedIn).toBe(true);
    });
});
