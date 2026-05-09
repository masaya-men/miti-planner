// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firebase をモック (usePlanStore の副作用で初期化されるのを防ぐ)
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
  auth: { currentUser: null },
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

vi.mock('../../store/usePlanStore');

import { executeShareImport } from '../executeShareImport';
import { usePlanStore } from '../../store/usePlanStore';
import type { ShareImportItem } from '../shareImportTypes';
vi.useFakeTimers();

const sampleItem = (id: string, contentId: string): ShareImportItem => ({
  sourceShareId: 'share1',
  contentId,
  title: `Item ${id}`,
  planData: {} as any,
  sourcePlanId: id,
});

describe('executeShareImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports a single item successfully when limit is OK', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: [],
      addPlan,
      syncToFirestore,
    } as any);

    const onProgress = vi.fn();
    const onLimitHit = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('success');
    expect(addPlan).toHaveBeenCalledTimes(1);
    expect(syncToFirestore).toHaveBeenCalledTimes(1);
    // Positional 呼び出し: (uid, displayName, force, onlyPlanIds)
    const callArgs = syncToFirestore.mock.calls[0];
    expect(callArgs[0]).toBe('testUid');
    expect(callArgs[1]).toBe('TestUser');
    expect(callArgs[2]).toBe(true); // force
    expect(Array.isArray(callArgs[3])).toBe(true);
    expect(callArgs[3]).toHaveLength(1);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'check', status: 'success' }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'local', status: 'success' }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'server', status: 'success' }),
    );
    expect(onLimitHit).not.toHaveBeenCalled();
  });

  it('triggers onLimitHit when content limit is reached', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: Array.from({ length: 5 }, (_, i) => ({
        id: `existing${i}`,
        ownerId: 'testUid',
        contentId: 'fru',
      })) as any,
      addPlan,
      syncToFirestore,
    } as any);

    const onLimitHit = vi.fn().mockResolvedValue('cancelled');
    const onProgress = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(onLimitHit).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: 'fru',
        neededCount: 1,
        planId: 'p1',
      }),
    );
    expect(results[0].status).toBe('cancelled');
    expect(addPlan).not.toHaveBeenCalled();
  });

  it('resumes import after onLimitHit resolves', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn().mockResolvedValue(undefined);
    let callCount = 0;
    vi.mocked(usePlanStore.getState).mockImplementation(() => {
      callCount++;
      // 初回 5 件、 2 回目 (resolve 後) 4 件
      const plans = callCount === 1
        ? Array.from({ length: 5 }, (_, i) => ({
            id: `existing${i}`,
            ownerId: 'testUid',
            contentId: 'fru',
          }))
        : Array.from({ length: 4 }, (_, i) => ({
            id: `existing${i}`,
            ownerId: 'testUid',
            contentId: 'fru',
          }));
      return { plans, addPlan, syncToFirestore } as any;
    });

    const onLimitHit = vi.fn().mockResolvedValue('resolved');
    const onProgress = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(onLimitHit).toHaveBeenCalledTimes(1);
    expect(addPlan).toHaveBeenCalledTimes(1);
    expect(results[0].status).toBe('success');
  });

  it('processes multiple items independently (one fails server, others succeed)', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn()
      .mockResolvedValueOnce(undefined) // p1 OK
      .mockRejectedValueOnce(new Error('network')) // p2 fail
      .mockResolvedValueOnce(undefined); // p3 OK
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: [],
      addPlan,
      syncToFirestore,
    } as any);

    const onProgress = vi.fn();
    const onLimitHit = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru'), sampleItem('p2', 'tea'), sampleItem('p3', 'tea')],
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('success');
    expect(results[1].status).toBe('success'); // ローカルは保存できているので success
    expect(results[2].status).toBe('success');
    // p2 の server stage は failed
    const p2ServerEvents = onProgress.mock.calls
      .map(c => c[0])
      .filter(e => e.planId === 'p2' && e.stage === 'server');
    expect(p2ServerEvents.some(e => e.status === 'failed')).toBe(true);
  });

  it('skips server save when uid is null (anonymous)', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn();
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: [],
      addPlan,
      syncToFirestore,
    } as any);

    const onProgress = vi.fn();
    const onLimitHit = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      null, // anonymous
      '',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(addPlan).toHaveBeenCalledTimes(1);
    expect(syncToFirestore).not.toHaveBeenCalled();
    expect(results[0].status).toBe('success');
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'server', status: 'skipped' }),
    );
  });

  it('respects minimum delays between stages', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: [],
      addPlan,
      syncToFirestore,
    } as any);

    const onProgress = vi.fn();
    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      'testUid',
      'TestUser',
      onProgress,
      vi.fn(),
    );

    // check stage in_progress 直後、 success 前は 400ms 経たない
    await vi.advanceTimersByTimeAsync(0);
    let calls = onProgress.mock.calls.map(c => c[0]);
    expect(calls.find(e => e.stage === 'check' && e.status === 'in_progress')).toBeTruthy();
    expect(calls.find(e => e.stage === 'check' && e.status === 'success')).toBeFalsy();

    // 400ms 経過後、 check success
    await vi.advanceTimersByTimeAsync(400);
    calls = onProgress.mock.calls.map(c => c[0]);
    expect(calls.find(e => e.stage === 'check' && e.status === 'success')).toBeTruthy();

    await vi.runAllTimersAsync();
    await promise;
  });
});
