// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockAuth = vi.hoisted(() => ({
    currentUser: null as { uid: string } | null,
}));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn(() => () => undefined),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(() => ({})) }));
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
        set: vi.fn(), update: vi.fn(), delete: vi.fn(),
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
    db: {}, storage: {}, appCheck: {},
}));
vi.mock('../../lib/appCheck', () => ({ initAppCheck: vi.fn(() => null) }));
vi.mock('../../lib/planService', () => ({
    planService: {
        createPlan: vi.fn(async () => undefined),
        updatePlan: vi.fn(async () => undefined),
        deletePlan: vi.fn(async () => undefined),
        fetchUserPlans: vi.fn(async () => []),
    },
}));

import { usePlanStore } from '../usePlanStore';
import type { SavedPlan, PlanData } from '../../types';

function emptyData(): PlanData {
    return {
        currentLevel: 100,
        timelineEvents: [],
        timelineMitigations: [],
        phases: [],
        partyMembers: [],
        aaSettings: { damage: 0, type: 'physical', target: 'MT' },
        schAetherflowPatterns: {},
    } as PlanData;
}

function nonEmptyData(): PlanData {
    return {
        ...emptyData(),
        partyMembers: [{ id: 'm1', jobId: 'war' } as any],
        timelineMitigations: [{ id: 'mit1' } as any],
    } as PlanData;
}

function makePlan(overrides: Partial<SavedPlan>): SavedPlan {
    return {
        id: 'plan_' + Math.random().toString(36).slice(2),
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: 'fru',
        title: 'Test Plan',
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: nonEmptyData(),
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    } as SavedPlan;
}

/**
 * 致命バグ防止: 「空スナップショットが非空プランを上書き」を root で塞ぐ。
 *
 * 2026-06-12 実害: キャッシュ全消し desync で起動時に miti が空 → saveSilently /
 * プラン切替が空 data を updatePlan で書き込み → 非空の「固定」プランを破壊 →
 * Firestore まで伝播。業界標準(非空データを空で上書きしない / 内容ありチェック)で防ぐ。
 */
describe('usePlanStore.updatePlan: 空上書きガード (データ破壊防止)', () => {
    beforeEach(() => {
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
    });

    it('非空プランを空 data で上書きしようとしても data は維持される', () => {
        const plan = makePlan({ id: 'fixed', data: nonEmptyData() });
        usePlanStore.setState({ plans: [plan] });

        usePlanStore.getState().updatePlan('fixed', { data: emptyData() });

        const after = usePlanStore.getState().plans.find(p => p.id === 'fixed')!;
        expect(after.data.partyMembers).toHaveLength(1);
        expect(after.data.timelineMitigations).toHaveLength(1);
    });

    it('空上書きがブロックされたとき dirty 化されない (Firestore 伝播を防ぐ)', () => {
        const plan = makePlan({ id: 'fixed', data: nonEmptyData() });
        usePlanStore.setState({ plans: [plan] });

        usePlanStore.getState().updatePlan('fixed', { data: emptyData() });

        expect(usePlanStore.getState()._dirtyPlanIds.has('fixed')).toBe(false);
    });

    it('既存が空のプランへの空 data 書き込みは許可 (新規空プランは壊さない)', () => {
        const plan = makePlan({ id: 'newp', data: emptyData() });
        usePlanStore.setState({ plans: [plan] });

        usePlanStore.getState().updatePlan('newp', { data: emptyData() });

        const after = usePlanStore.getState().plans.find(p => p.id === 'newp')!;
        expect(after.data.partyMembers).toHaveLength(0);
    });

    it('非空 data での通常更新は許可される', () => {
        const plan = makePlan({ id: 'fixed', data: emptyData() });
        usePlanStore.setState({ plans: [plan] });

        usePlanStore.getState().updatePlan('fixed', { data: nonEmptyData() });

        const after = usePlanStore.getState().plans.find(p => p.id === 'fixed')!;
        expect(after.data.partyMembers).toHaveLength(1);
        expect(usePlanStore.getState()._dirtyPlanIds.has('fixed')).toBe(true);
    });

    it('非空プランへの data を含まない更新 (title 等) は通常どおり適用される', () => {
        const plan = makePlan({ id: 'fixed', data: nonEmptyData(), title: 'Old' });
        usePlanStore.setState({ plans: [plan] });

        usePlanStore.getState().updatePlan('fixed', { title: 'New' });

        const after = usePlanStore.getState().plans.find(p => p.id === 'fixed')!;
        expect(after.title).toBe('New');
        expect(after.data.partyMembers).toHaveLength(1);
    });

    it('空 data + 他フィールドの混在更新: data はブロック、他フィールドは適用', () => {
        const plan = makePlan({ id: 'fixed', data: nonEmptyData(), title: 'Old' });
        usePlanStore.setState({ plans: [plan] });

        usePlanStore.getState().updatePlan('fixed', { data: emptyData(), title: 'New' });

        const after = usePlanStore.getState().plans.find(p => p.id === 'fixed')!;
        expect(after.title).toBe('New');
        expect(after.data.partyMembers).toHaveLength(1);
    });
});
