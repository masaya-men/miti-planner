// @vitest-environment happy-dom
/**
 * リグレッションテスト: executeLocalImport の「既にある成功扱い」
 *
 * 背景:
 * 自動 sync (syncDirtyPlans) が既に plan を Firestore に作成済みなのに、 ローカルの
 * `ownerId='local'` マーカーが消えていないケース (タイミング / persist race) がある。
 * その状態でユーザーが「取り込む」 ボタンを押すと、 createPlan が呼ばれて Firestore
 * Rules の version 上書き禁止に抵触し permission-denied で失敗していた。
 *
 * 修正: createPlan を呼ぶ前に `checkPlanExists` で Firestore 上の存在を確認し、
 * 既にあれば createPlan をスキップして「成功扱い」 にする (ownerId を uid に書き換える)。
 *
 * 安全性: checkPlanExists が true の場合のみスキップする = Firestore に確かにある
 * 場合のみ「あなたのプラン扱い」 に書き換える。 ローカル削除等の破壊的操作は一切しない。
 * checkPlanExists が失敗 (ネットワーク等) しても fall through で通常 createPlan に進む。
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
    ensureAppCheck: () => null,
    getActiveAppCheck: () => null,
}));

vi.mock('../../lib/appCheck', () => ({
    createLazyAppCheck: () => ({ ensureAppCheck: () => null, getActiveAppCheck: () => null }),
}));

// vi.hoisted: vi.mock factory が hoist 適用される前に mock fn を確実に定義しておく。
// 単なる const 宣言だと hoist 順序問題で undefined が mock に注入されるリスクがある。
// 引数を受け取る implementation を mockImplementation で差し替えるため、
// 型を `vi.fn<(...args: any[]) => Promise<...>>()` で広めに宣言する。
const { mockCreatePlan, mockCheckPlanExists } = vi.hoisted(() => ({
    mockCreatePlan: vi.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
    mockCheckPlanExists: vi.fn<(...args: any[]) => Promise<boolean>>().mockResolvedValue(false),
}));
vi.mock('../../lib/planService', () => ({
    planService: {
        createPlan: mockCreatePlan,
        updatePlan: vi.fn(async () => undefined),
        deletePlan: vi.fn(async () => undefined),
        fetchUserPlans: vi.fn(async () => []),
        checkPlanExists: mockCheckPlanExists,
        syncDirtyPlans: vi.fn(async () => ({ deletedRemotely: [], conflicted: [] })),
    },
}));

import { usePlanStore } from '../usePlanStore';
import type { SavedPlan } from '../../types';

const UID = 'uid_test';
const DISPLAY = 'TestUser';

function makePlan(overrides: Partial<SavedPlan>): SavedPlan {
    return {
        id: 'p_test_' + Math.random().toString(36).slice(2),
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: 'fru',
        title: 'Test',
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

describe('executeLocalImport: 既に Firestore にあるなら成功扱い (createPlan スキップ)', () => {
    beforeEach(() => {
        usePlanStore.setState({
            plans: [],
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        mockCreatePlan.mockClear();
        mockCheckPlanExists.mockClear();
        mockCheckPlanExists.mockResolvedValue(false);
    });

    it('checkPlanExists=true → createPlan を呼ばずに成功扱い・ownerId=uid に書換', async () => {
        usePlanStore.setState({
            plans: [makePlan({ id: 'p_exists', ownerId: 'local' })],
        });
        mockCheckPlanExists.mockResolvedValue(true);

        const results = await usePlanStore.getState().executeLocalImport(
            UID, DISPLAY, ['p_exists'],
        );

        // createPlan は呼ばれない (重要: 二重作成回避)
        expect(mockCreatePlan).not.toHaveBeenCalled();
        // checkPlanExists は呼ばれている
        expect(mockCheckPlanExists).toHaveBeenCalledWith('p_exists');
        // 成功扱い
        expect(results).toEqual([{ id: 'p_exists', status: 'success' }]);
        // ownerId が uid に書換 + displayName 反映
        const stored = usePlanStore.getState().plans.find(p => p.id === 'p_exists');
        expect(stored?.ownerId).toBe(UID);
        expect(stored?.ownerDisplayName).toBe(DISPLAY);
    });

    it('checkPlanExists=false → 通常通り createPlan を呼ぶ', async () => {
        usePlanStore.setState({
            plans: [makePlan({ id: 'p_new', ownerId: 'local' })],
        });
        mockCheckPlanExists.mockResolvedValue(false);

        const results = await usePlanStore.getState().executeLocalImport(
            UID, DISPLAY, ['p_new'],
        );

        expect(mockCreatePlan).toHaveBeenCalledTimes(1);
        expect(results).toEqual([{ id: 'p_new', status: 'success' }]);
        const stored = usePlanStore.getState().plans.find(p => p.id === 'p_new');
        expect(stored?.ownerId).toBe(UID);
    });

    it('checkPlanExists がエラー throw → fall through で通常 createPlan に進む', async () => {
        usePlanStore.setState({
            plans: [makePlan({ id: 'p_check_err', ownerId: 'local' })],
        });
        mockCheckPlanExists.mockRejectedValue(new Error('network'));

        const results = await usePlanStore.getState().executeLocalImport(
            UID, DISPLAY, ['p_check_err'],
        );

        // checkPlanExists 失敗でも createPlan に進む
        expect(mockCreatePlan).toHaveBeenCalledTimes(1);
        expect(results).toEqual([{ id: 'p_check_err', status: 'success' }]);
    });

    it('checkPlanExists=true → ローカルから plan が削除されない (データ消失防止)', async () => {
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'p_keep1', ownerId: 'local', title: 'Keep1' }),
                makePlan({ id: 'p_keep2', ownerId: 'local', title: 'Keep2' }),
            ],
        });
        mockCheckPlanExists.mockResolvedValue(true);

        await usePlanStore.getState().executeLocalImport(
            UID, DISPLAY, ['p_keep1'],
        );

        // 取り込み対象の p_keep1 は ownerId 書換のみで残る
        const stored1 = usePlanStore.getState().plans.find(p => p.id === 'p_keep1');
        expect(stored1).toBeDefined();
        expect(stored1?.title).toBe('Keep1');
        expect(stored1?.ownerId).toBe(UID);
        // 取り込み対象外の p_keep2 は何も変更されない
        const stored2 = usePlanStore.getState().plans.find(p => p.id === 'p_keep2');
        expect(stored2).toBeDefined();
        expect(stored2?.title).toBe('Keep2');
        expect(stored2?.ownerId).toBe('local');
    });

    it('createPlan が失敗 → ownerId=local のまま残し、 failed を返す (リトライ可能)', async () => {
        usePlanStore.setState({
            plans: [makePlan({ id: 'p_fail', ownerId: 'local' })],
        });
        mockCheckPlanExists.mockResolvedValue(false);
        mockCreatePlan.mockRejectedValue(new Error('permission-denied'));

        const results = await usePlanStore.getState().executeLocalImport(
            UID, DISPLAY, ['p_fail'],
        );

        // 失敗扱い、 ローカルからは消えない
        expect(results[0].status).toBe('failed');
        const stored = usePlanStore.getState().plans.find(p => p.id === 'p_fail');
        expect(stored).toBeDefined();
        expect(stored?.ownerId).toBe('local'); // 失敗時は ownerId 触らない
    });

    it('複数 plan の取り込み → 各々独立に成否判定', async () => {
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'p_a', ownerId: 'local' }),
                makePlan({ id: 'p_b', ownerId: 'local' }),
                makePlan({ id: 'p_c', ownerId: 'local' }),
            ],
        });
        // p_a は既存、 p_b は新規、 p_c は createPlan 失敗
        mockCheckPlanExists.mockImplementation(async (id: string) => id === 'p_a');
        mockCreatePlan.mockImplementation(async (plan: any) => {
            if (plan.id === 'p_c') throw new Error('quota-exceeded');
        });

        const results = await usePlanStore.getState().executeLocalImport(
            UID, DISPLAY, ['p_a', 'p_b', 'p_c'],
        );

        expect(results.find(r => r.id === 'p_a')?.status).toBe('success');
        expect(results.find(r => r.id === 'p_b')?.status).toBe('success');
        expect(results.find(r => r.id === 'p_c')?.status).toBe('failed');

        // a / b は uid 化、 c は local のまま
        const plans = usePlanStore.getState().plans;
        expect(plans.find(p => p.id === 'p_a')?.ownerId).toBe(UID);
        expect(plans.find(p => p.id === 'p_b')?.ownerId).toBe(UID);
        expect(plans.find(p => p.id === 'p_c')?.ownerId).toBe('local');
    });
});
