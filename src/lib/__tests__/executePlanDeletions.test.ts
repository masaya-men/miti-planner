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

import { executePlanDeletions } from '../executePlanDeletions';
import { usePlanStore } from '../../store/usePlanStore';
vi.useFakeTimers();

describe('executePlanDeletions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes plans for logged-in user via deleteFromFirestore', async () => {
    const deleteFromFirestore = vi.fn().mockResolvedValue(undefined);
    const deletePlan = vi.fn();
    vi.mocked(usePlanStore.getState).mockReturnValue({
      deleteFromFirestore,
      deletePlan,
    } as any);

    const onProgress = vi.fn();

    const promise = executePlanDeletions(
      ['p1', 'p2'],
      'testUid',
      'fru',
      onProgress,
    );
    await vi.runAllTimersAsync();
    await promise;

    expect(deleteFromFirestore).toHaveBeenCalledTimes(2);
    expect(deleteFromFirestore).toHaveBeenCalledWith('p1', 'testUid', 'fru');
    expect(deleteFromFirestore).toHaveBeenCalledWith('p2', 'testUid', 'fru');
    expect(deletePlan).not.toHaveBeenCalled();
  });

  it('uses local-only deletePlan when uid is null', async () => {
    const deleteFromFirestore = vi.fn();
    const deletePlan = vi.fn();
    vi.mocked(usePlanStore.getState).mockReturnValue({
      deleteFromFirestore,
      deletePlan,
    } as any);

    const onProgress = vi.fn();

    const promise = executePlanDeletions(['p1'], null, 'fru', onProgress);
    await vi.runAllTimersAsync();
    await promise;

    expect(deletePlan).toHaveBeenCalledWith('p1');
    expect(deleteFromFirestore).not.toHaveBeenCalled();
  });

  it('emits progress events in correct order', async () => {
    const deleteFromFirestore = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePlanStore.getState).mockReturnValue({
      deleteFromFirestore,
    } as any);

    const events: any[] = [];
    const onProgress = vi.fn(e => events.push(e));

    const promise = executePlanDeletions(['p1'], 'testUid', 'fru', onProgress);
    await vi.runAllTimersAsync();
    await promise;

    const stages = events.filter(e => e.planId === 'p1').map(e => `${e.stage}:${e.status}`);
    expect(stages).toEqual([
      'local_delete:in_progress',
      'local_delete:success',
      'server_delete:in_progress',
      'server_delete:success',
      'capacity_freed:success',
    ]);
  });

  it('throws when delete fails (so caller can show retry)', async () => {
    const deleteFromFirestore = vi.fn().mockRejectedValue(new Error('permission-denied'));
    vi.mocked(usePlanStore.getState).mockReturnValue({
      deleteFromFirestore,
    } as any);

    const onProgress = vi.fn();
    const promise = executePlanDeletions(['p1'], 'testUid', 'fru', onProgress);
    const [result] = await Promise.allSettled([
      promise,
      vi.runAllTimersAsync(),
    ]);

    expect(result.status).toBe('rejected');
    expect((result as PromiseRejectedResult).reason.message).toBe('permission-denied');
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'server_delete', status: 'failed' }),
    );
  });
});
