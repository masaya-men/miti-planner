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
    syncDirtyPlans: vi.fn(async () => ({ deletedRemotely: [], conflicted: [], syncedIds: [] })),
    fetchAndMerge: vi.fn(async () => ({ merged: [], changed: false })),
    checkPlanLimits: vi.fn(async () => undefined),
    checkPlanExists: vi.fn(async () => false),
    ensurePlanCounts: vi.fn(async () => undefined),
    repairPlanCounts: vi.fn(async () => undefined),
    migrateLocalPlansToFirestore: vi.fn(async () => ({ merged: [], dirtyIds: [] })),
  },
}));

vi.mock('../../store/usePlanStore');

// useShareImportFlow は setRedFlag / clearRedFlag だけ呼ばれるので
// 純粋な state 操作のスタブで十分 (apiFetch を経由しない)。
const mockSetRedFlag = vi.fn();
const mockClearRedFlag = vi.fn();
vi.mock('../../store/useShareImportFlow', () => ({
  useShareImportFlow: {
    getState: () => ({
      setRedFlag: mockSetRedFlag,
      clearRedFlag: mockClearRedFlag,
    }),
  },
}));

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
    // 初回 5 件、 onLimitHit が呼ばれたら 4 件に減る (削除イベントを模擬)
    let limitHitCalled = false;
    vi.mocked(usePlanStore.getState).mockImplementation(() => {
      const length = limitHitCalled ? 4 : 5;
      const plans = Array.from({ length }, (_, i) => ({
        id: `existing${i}`,
        ownerId: 'testUid',
        contentId: 'fru',
      }));
      return { plans, addPlan, syncToFirestore } as any;
    });

    const onLimitHit = vi.fn().mockImplementation(async () => {
      limitHitCalled = true;
      return 'resolved';
    });
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

  describe('総上限 (max_total) 事前判定 (#7)', () => {
    it('existing 49 + import 2 = 51 > 50 のとき max_total reason で onLimitHit が呼ばれる', async () => {
      const addPlan = vi.fn();
      const syncToFirestore = vi.fn().mockResolvedValue(undefined);
      // 初回 49 件 (m10s)、 onLimitHit (max_total) 解決後は 48 件まで縮める
      let limitHitCalled = false;
      vi.mocked(usePlanStore.getState).mockImplementation(() => {
        const length = limitHitCalled ? 48 : 49;
        return {
          plans: Array.from({ length }, (_, i) => ({
            id: `existing-${i}`,
            ownerId: 'local',
            contentId: 'm10s',
          })),
          addPlan,
          syncToFirestore,
        } as any;
      });

      // 最初の onLimitHit 呼び出し (max_total) で resolved を返す
      const onLimitHit = vi.fn().mockImplementation(async () => {
        limitHitCalled = true;
        return 'resolved';
      });
      const onProgress = vi.fn();

      const items: ShareImportItem[] = [
        { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm11s', title: 't1', planData: {} as any },
        { sourceShareId: 's2', sourcePlanId: 's2', contentId: 'm11s', title: 't2', planData: {} as any },
      ];

      const promise = executeShareImport(items, null, '', onProgress, onLimitHit);
      await vi.runAllTimersAsync();
      await promise;

      // 最初の呼び出しが max_total
      expect(onLimitHit).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'max_total',
          contentId: null,
          planId: null,
          neededCount: 1,
        }),
      );
    });

    it('総上限事前判定で cancelled なら何も import されない', async () => {
      const addPlan = vi.fn();
      const syncToFirestore = vi.fn();
      vi.mocked(usePlanStore.getState).mockReturnValue({
        plans: Array.from({ length: 49 }, (_, i) => ({
          id: `existing-${i}`,
          ownerId: 'local',
          contentId: 'm10s',
        })) as any,
        addPlan,
        syncToFirestore,
      } as any);

      const onLimitHit = vi.fn().mockResolvedValue('cancelled');
      const onProgress = vi.fn();

      const items: ShareImportItem[] = [
        { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm11s', title: 't1', planData: {} as any },
        { sourceShareId: 's2', sourcePlanId: 's2', contentId: 'm11s', title: 't2', planData: {} as any },
      ];

      const promise = executeShareImport(items, null, '', onProgress, onLimitHit);
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(results).toHaveLength(2);
      expect(results.every(r => r.status === 'cancelled')).toBe(true);
      expect(addPlan).not.toHaveBeenCalled();
      // local stage の progress は出さない (= 個別ループに入っていない)
      expect(onProgress).not.toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'local' }),
      );
    });

    it('existing 49 + import 1 = 50 (== 上限) のときは事前判定を発火しない', async () => {
      const addPlan = vi.fn();
      const syncToFirestore = vi.fn().mockResolvedValue(undefined);
      vi.mocked(usePlanStore.getState).mockReturnValue({
        plans: Array.from({ length: 49 }, (_, i) => ({
          id: `existing-${i}`,
          ownerId: 'local',
          contentId: 'm10s',
        })) as any,
        addPlan,
        syncToFirestore,
      } as any);

      const onLimitHit = vi.fn();
      const onProgress = vi.fn();

      const items: ShareImportItem[] = [
        { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm11s', title: 't1', planData: {} as any },
      ];

      const promise = executeShareImport(items, null, '', onProgress, onLimitHit);
      await vi.runAllTimersAsync();
      await promise;

      const totalCalls = onLimitHit.mock.calls.filter(
        ([params]) => params.reason === 'max_total',
      );
      expect(totalCalls.length).toBe(0);
    });
  });

  describe('per_content 上限ヒット時の赤背景シーケンス (#4)', () => {
    it('per_content limit hit 時、 setRedFlag → onLimitHit (max_per_content + planId) → clearRedFlag の順で呼ばれる', async () => {
      const addPlan = vi.fn();
      const syncToFirestore = vi.fn().mockResolvedValue(undefined);
      // m10s に 5 件 (上限) → onLimitHit 呼び出し後は 4 件に減る
      let limitHitCalled = false;
      vi.mocked(usePlanStore.getState).mockImplementation(() => {
        const length = limitHitCalled ? 4 : 5;
        return {
          plans: Array.from({ length }, (_, i) => ({
            id: `m10s-${i}`,
            ownerId: 'local',
            contentId: 'm10s',
          })),
          addPlan,
          syncToFirestore,
        } as any;
      });

      const onLimitHit = vi.fn().mockImplementation(async () => {
        limitHitCalled = true;
        return 'resolved';
      });
      const onProgress = vi.fn();

      const items: ShareImportItem[] = [
        { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm10s', title: 't1', planData: {} as any },
      ];

      const promise = executeShareImport(items, null, '', onProgress, onLimitHit);
      await vi.runAllTimersAsync();
      await promise;

      expect(onLimitHit).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'max_per_content',
          contentId: 'm10s',
          planId: 's1',
          neededCount: 1,
        }),
      );
      // 赤背景マークがヒット時に立てられて、 解決後に外される
      expect(mockSetRedFlag).toHaveBeenCalledWith('s1');
      expect(mockClearRedFlag).toHaveBeenCalledWith('s1');
      // 順序: setRedFlag が onLimitHit より前、 clearRedFlag が後
      const setOrder = mockSetRedFlag.mock.invocationCallOrder[0];
      const limitOrder = onLimitHit.mock.invocationCallOrder[0];
      const clearOrder = mockClearRedFlag.mock.invocationCallOrder[0];
      expect(setOrder).toBeLessThan(limitOrder);
      expect(limitOrder).toBeLessThan(clearOrder);
    });
  });

  it('emits failed and skips server when local addPlan throws', async () => {
    const addPlan = vi.fn().mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
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
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toContain('quota exceeded');
    // server stage は呼ばれない
    expect(syncToFirestore).not.toHaveBeenCalled();
    // onProgress に local: failed が含まれる
    const localFailedEvent = onProgress.mock.calls
      .map(c => c[0])
      .find(e => e.stage === 'local' && e.status === 'failed');
    expect(localFailedEvent).toBeTruthy();
    expect(localFailedEvent.error).toContain('quota exceeded');
  });
});
