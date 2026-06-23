// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Firebase はモック (store 読込で初期化されるため)。commitNewPlan.test.ts と同型。
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
vi.mock('../../firebase', () => ({ get auth() { return { currentUser: null }; }, db: {}, storage: {}, appCheck: {} }));
vi.mock('../../appCheck', () => ({ initAppCheck: vi.fn(() => null) }));
vi.mock('../../planService', () => ({ planService: { createPlan: vi.fn(async () => undefined), updatePlan: vi.fn(async () => undefined), deletePlan: vi.fn(async () => undefined), fetchUserPlans: vi.fn(async () => []) } }));

import { commitImportedPlan } from '../commitImportedPlan';
import { usePlanStore } from '../../../store/usePlanStore';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';
import type { SheetImportResult } from '../buildPlanFromSheets';
import type { SavedPlan } from '../../../types';

// 取り込み結果 (前の表とは別物)。後半(time=200)にもイベントを持たせ「後半欠け」を検出できるように。
function makeImportResult(): SheetImportResult {
  return {
    timelineEvents: [
      { id: 'imp1', time: 10, name: { ja: 'インポA', en: 'ImpA' }, damageType: 'magical' },
      { id: 'imp2', time: 200, name: { ja: 'インポB', en: 'ImpB' }, damageType: 'magical' },
    ],
    timelineMitigations: [],
    phases: [{ id: 'php1', name: { ja: 'P1', en: 'P1' }, startTime: 10, endTime: 201 }],
    labels: [],
    party: [],
    skipped: [],
  };
}

// 「それまで作っていた表」(= 取込前に開いていた前プラン)。
function makeOldPlan(): SavedPlan {
  return {
    id: 'plan-old', ownerId: 'local', ownerDisplayName: 'Guest', contentId: 'fru', title: '前の表',
    isPublic: false, copyCount: 0, useCount: 0,
    data: {
      currentLevel: 100,
      timelineEvents: [{ id: 'old1', time: 5, name: { ja: '前の表', en: 'OLD' }, damageType: 'magical' }] as any,
      timelineMitigations: [], phases: [], labels: [],
      partyMembers: [], aaSettings: { damage: 10000, type: 'physical', target: 'MT' }, schAetherflowPatterns: {},
    } as any,
    createdAt: 0, updatedAt: 0,
  } as SavedPlan;
}

function setOldWorkingStore() {
  // 作業ストア = 前の表の中身 (取込前に開いていた状態を再現)
  useMitigationStore.setState({
    currentLevel: 100,
    timelineEvents: [{ id: 'old1', time: 5, name: { ja: '前の表', en: 'OLD' }, damageType: 'magical' }] as any,
    timelineMitigations: [], phases: [], labels: [], partyMembers: [],
    aaSettings: { damage: 10000, type: 'physical', target: 'MT' }, schAetherflowPatterns: {},
    _loadedPlanId: 'plan-old',
  });
}

describe('commitImportedPlan: 取り込みは共同編集中でも「取込データ」で新規プランを作る (Bug① 止血)', () => {
  beforeEach(() => {
    usePlanStore.setState({ plans: [makeOldPlan()], currentPlanId: 'plan-old', lastActivePlanId: null, _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() });
    useMitigationStore.setState({ _collabActive: false, _collabHandlers: null, _collabReadonly: false, _loadedPlanId: null });
    useCollabSessionStore.setState({ active: false, session: null, roomToken: null, collabPlanId: null });
    setOldWorkingStore();
  });

  it('★collab-ONオーナー状態で取込 → 新プランは取込データ(前の表ではない)・collab は切断される', () => {
    // 前提: collab-ON の表のオーナーが開いている = ライブセッションが生きている
    useMitigationStore.setState({ _collabActive: true, _collabHandlers: {} as any });
    // 実 collabProvider と同契約: session.disconnect() は同期で exitCollabMode() を呼ぶ
    useCollabSessionStore.setState({
      active: true,
      session: { disconnect: () => useMitigationStore.getState().exitCollabMode() } as any,
    });

    const newId = commitImportedPlan(makeImportResult(), { contentId: 'fru', title: 'スプシ取込' });

    const newPlan = usePlanStore.getState().plans.find((p) => p.id === newId)!;
    expect(newPlan).toBeDefined();
    // 新プランの中身は取込データ。前の表(old1)が混入していない＝後半(imp2)も含む全件。
    expect(newPlan.data.timelineEvents.map((e) => e.id)).toEqual(['imp1', 'imp2']);
    // collab は切断され作業ストアにも取込データが反映されている
    expect(useMitigationStore.getState()._collabActive).toBe(false);
    expect(useMitigationStore.getState().timelineEvents.map((e) => e.id)).toEqual(['imp1', 'imp2']);
  });

  it('★防御: _collabActive が立っているがセッションが無い(disconnectで切れない)異常系でも取込データになる', () => {
    // disconnect() が空振りするケース。フラグだけ true（実機でフラグだけ注入して検証する状況と同じ）。
    useMitigationStore.setState({ _collabActive: true, _collabHandlers: {} as any });
    useCollabSessionStore.setState({ active: false, session: null });

    const newId = commitImportedPlan(makeImportResult(), { contentId: 'fru', title: 'スプシ取込' });

    const newPlan = usePlanStore.getState().plans.find((p) => p.id === newId)!;
    expect(newPlan.data.timelineEvents.map((e) => e.id)).toEqual(['imp1', 'imp2']);
    expect(useMitigationStore.getState()._collabActive).toBe(false);
  });

  it('前に開いていた表(plan-old)は破壊されない', () => {
    useMitigationStore.setState({ _collabActive: true, _collabHandlers: {} as any });
    useCollabSessionStore.setState({
      active: true,
      session: { disconnect: () => useMitigationStore.getState().exitCollabMode() } as any,
    });

    commitImportedPlan(makeImportResult(), { contentId: 'fru', title: 'スプシ取込' });

    const old = usePlanStore.getState().plans.find((p) => p.id === 'plan-old')!;
    expect(old.data.timelineEvents.map((e) => e.id)).toEqual(['old1']);
  });

  it('ソロ(非collab)でも取込データで新規プランが作られる (回帰)', () => {
    const newId = commitImportedPlan(makeImportResult(), { contentId: 'fru', title: 'スプシ取込' });
    const newPlan = usePlanStore.getState().plans.find((p) => p.id === newId)!;
    expect(newPlan.data.timelineEvents.map((e) => e.id)).toEqual(['imp1', 'imp2']);
    expect(usePlanStore.getState().currentPlanId).toBe(newId);
  });
});
