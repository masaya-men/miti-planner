import { describe, it, expect, beforeEach, vi } from 'vitest';

// window / Event ポリフィル (node 環境では未定義)
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof (globalThis as any).window.dispatchEvent === 'undefined') {
  (globalThis as any).window.dispatchEvent = () => true;
}

// sessionStorage ポリフィル (vitest.setup.ts は localStorage のみ提供)
if (typeof (globalThis as any).sessionStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}

// Firebase 系を全 mock (Node 環境で document/indexedDB が無いため)
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn(() => () => undefined),
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  isSupported: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('../lib/appCheck', () => ({
  initAppCheck: vi.fn(() => null),
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
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn(async () => undefined),
  })),
  updateDoc: vi.fn(async () => undefined),
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

// useTutorialStore は startTutorial('main') 時に usePlanStore / useMitigationStore を触る。
// share チュートリアル時は触らないので、 本テストではメイン用に最小 mock。
vi.mock('../store/usePlanStore', () => ({
  usePlanStore: {
    getState: vi.fn(() => ({
      currentPlanId: null,
      plans: [],
      updatePlan: vi.fn(),
      setCurrentPlanId: vi.fn(),
      deletePlan: vi.fn(),
      getPlan: vi.fn(() => null),
    })),
  },
}));

vi.mock('../store/useMitigationStore', () => ({
  useMitigationStore: {
    getState: vi.fn(() => ({
      timelineEvents: [],
      timelineMitigations: [],
      phases: [],
      labels: [],
      partyMembers: [],
      myMemberId: null,
      myJobHighlight: null,
      hideEmptyRows: false,
      getSnapshot: vi.fn(() => ({})),
      resetForTutorial: vi.fn(),
      loadSnapshot: vi.fn(),
      restoreFromSnapshot: vi.fn(),
    })),
  },
}));

// mock 後にインポート (vi.mock は hoist されるため import 順は問わないが安全のため)
import { useTutorialStore } from '../store/useTutorialStore';

describe('useTutorialStore - share tutorial skip', () => {
  beforeEach(() => {
    useTutorialStore.getState().resetTutorial();
  });

  it('share チュートリアルをスキップしても completed=true になる', () => {
    useTutorialStore.getState().startTutorial('share');
    expect(useTutorialStore.getState().completed.share).toBe(false);

    useTutorialStore.getState().requestExit();
    useTutorialStore.getState().confirmExit();

    expect(useTutorialStore.getState().completed.share).toBe(true);
  });

  it('main チュートリアルのスキップでは completed=true にならない (既存挙動維持)', () => {
    useTutorialStore.getState().startTutorial('main');
    expect(useTutorialStore.getState().completed.main).toBe(false);

    useTutorialStore.getState().requestExit();
    useTutorialStore.getState().confirmExit();

    expect(useTutorialStore.getState().completed.main).toBe(false);
  });

  it('share チュートリアルを完走すると completed=true になる (既存挙動)', () => {
    useTutorialStore.getState().startTutorial('share');
    useTutorialStore.getState().completeEvent('share:tutorial-done');
    expect(useTutorialStore.getState().completed.share).toBe(true);
  });
});
