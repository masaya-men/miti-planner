// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({})), onAuthStateChanged: vi.fn(() => () => undefined) }));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', () => ({ getAnalytics: vi.fn(() => ({})), isSupported: vi.fn(() => Promise.resolve(false)) }));
vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})), persistentLocalCache: vi.fn(() => ({})), persistentMultipleTabManager: vi.fn(() => ({})),
  getFirestore: vi.fn(() => ({})), collection: vi.fn(() => ({})), doc: vi.fn(() => ({ id: 'm' })),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })), getDocs: vi.fn(async () => ({ docs: [] })),
  setDoc: vi.fn(async () => undefined), updateDoc: vi.fn(async () => undefined), deleteDoc: vi.fn(async () => undefined),
  query: vi.fn(() => ({})), where: vi.fn(() => ({})), writeBatch: vi.fn(() => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => undefined) })),
}));
vi.mock('firebase/app-check', () => ({ initializeAppCheck: vi.fn(() => ({})), ReCaptchaEnterpriseProvider: vi.fn(), getToken: vi.fn(async () => ({ token: 't' })) }));
vi.mock('../firebase', () => ({ get auth() { return { currentUser: null }; }, db: {}, storage: {}, ensureAppCheck: () => null, getActiveAppCheck: () => null }));
vi.mock('../appCheck', () => ({
  createLazyAppCheck: () => ({ ensureAppCheck: () => null, getActiveAppCheck: () => null }),
}));
vi.mock('../planService', () => ({ planService: { createPlan: vi.fn(async () => undefined), updatePlan: vi.fn(async () => undefined), deletePlan: vi.fn(async () => undefined), fetchUserPlans: vi.fn(async () => []) } }));

import { commitNewPlan } from '../commitNewPlan';
import { usePlanStore } from '../../store/usePlanStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { persistWorkingStore } from '../persistWorkingStore';
import type { SavedPlan } from '../../types';

function makePlan(id: string, mit: number): SavedPlan {
  return {
    id, ownerId: 'local', ownerDisplayName: 'Guest', contentId: 'fru', title: id,
    isPublic: false, copyCount: 0, useCount: 0,
    data: {
      currentLevel: 100, timelineEvents: [], phases: [], labels: [], aaSettings: { damage: 0, type: 'physical', target: 'MT' }, schAetherflowPatterns: {},
      partyMembers: [{ id: 'm1', jobId: 'war' } as any],
      timelineMitigations: Array.from({ length: mit }, (_, i) => ({ id: `mit${i}` } as any)),
    } as any,
    createdAt: 0, updatedAt: 0,
  } as SavedPlan;
}

/**
 * C-1 回帰: 新規プラン作成時、setCurrentPlanId が同期発火させる自動保存(plan-switch subscribe)が
 * 「直前に開いていた表」を新規プランの空データで上書きして壊してはならない。
 * commitNewPlan は「持ち主ID(_loadedPlanId)を currentPlanId より先に確定する」ことでこれを防ぐ。
 */
describe('commitNewPlan: 新規作成で直前プランを壊さない (C-1 回帰)', () => {
  beforeEach(() => {
    usePlanStore.setState({ plans: [], currentPlanId: null, lastActivePlanId: null, _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() });
    useMitigationStore.setState({ _collabActive: false, _loadedPlanId: null });
  });

  it('直前プラン(P_prev・軽減あり)を開いた状態で新規作成しても P_prev の軽減が壊れない', () => {
    // P_prev: 軽減 3 個、現在開いている
    const pPrev = makePlan('P_prev', 3);
    usePlanStore.setState({ plans: [pPrev], currentPlanId: 'P_prev' });
    // 作業ストアの持ち主は P_prev、中身は「新規プランの内容(party は残り・軽減/イベント空)」に差し替え済み
    useMitigationStore.setState({
      _loadedPlanId: 'P_prev',
      partyMembers: [{ id: 'm1', jobId: null } as any],
      timelineMitigations: [], timelineEvents: [], phases: [], labels: [],
    });

    // Layout と同型の plan-switch subscribe(切替で saveSilently=persistWorkingStore)
    let prevId = usePlanStore.getState().currentPlanId;
    const unsub = usePlanStore.subscribe((s) => {
      const newId = s.currentPlanId, oldId = prevId; prevId = newId;
      if (oldId && oldId !== newId && !useMitigationStore.getState()._collabActive) {
        persistWorkingStore({
          loadedPlanId: useMitigationStore.getState()._loadedPlanId,
          getSnapshot: () => useMitigationStore.getState().getSnapshot(),
          updatePlan: (id, patch) => usePlanStore.getState().updatePlan(id, patch),
        });
      }
    });

    // 新規プランを確定(addPlan + 持ち主確定 + currentPlanId 切替)
    commitNewPlan(makePlan('P_new', 0));
    unsub();

    // P_prev は破壊されていない
    const after = usePlanStore.getState().plans.find((p) => p.id === 'P_prev')!;
    expect(after.data.timelineMitigations).toHaveLength(3);
    // 新規プランは current
    expect(usePlanStore.getState().currentPlanId).toBe('P_new');
    expect(useMitigationStore.getState()._loadedPlanId).toBe('P_new');
  });
});
