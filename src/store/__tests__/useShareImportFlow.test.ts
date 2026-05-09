// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Firebase をモック (apiClient → ./firebase の副作用初期化を防ぐ)
// 既存テスト executeShareImport.test.ts のパターンを踏襲
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

// apiFetch は src/lib/apiClient.ts で named export されている
vi.mock('../../lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { useShareImportFlow } from '../useShareImportFlow';

describe('useShareImportFlow', () => {
  beforeEach(() => {
    useShareImportFlow.setState({
      status: 'idle',
      shareId: null,
      sharedData: null,
      importItems: [],
      selectedItemIds: new Set(),
      progressMap: new Map(),
      deleteProgressMap: new Map(),
      limitContext: null,
      errorMessage: null,
    });
  });

  it('starts in idle state', () => {
    expect(useShareImportFlow.getState().status).toBe('idle');
  });

  it('start() sets loading status and shareId', async () => {
    const { apiFetch } = await import('../../lib/apiClient');
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          shareId: 'abc',
          contentId: 'fru',
          title: 'Test',
          planData: { events: [], mitigations: [] },
          createdAt: 0,
          updatedAt: 0,
        }),
    } as any);

    await useShareImportFlow.getState().start('abc');

    const state = useShareImportFlow.getState();
    expect(state.shareId).toBe('abc');
    expect(state.status).toBe('preview');
    expect(state.importItems).toHaveLength(1);
    // デフォルトは全件選択 (1件中1件選択されている)
    expect(state.selectedItemIds.size).toBe(1);
  });

  it('start() sets error status when fetch fails', async () => {
    const { apiFetch } = await import('../../lib/apiClient');
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    await useShareImportFlow.getState().start('abc');

    expect(useShareImportFlow.getState().status).toBe('error');
  });

  it('toggleSelect() flips item selection', () => {
    useShareImportFlow.setState({
      importItems: [
        {
          sourceShareId: 'abc',
          contentId: 'fru',
          title: 't1',
          planData: {} as any,
          sourcePlanId: 'p1',
        },
        {
          sourceShareId: 'abc',
          contentId: 'fru',
          title: 't2',
          planData: {} as any,
          sourcePlanId: 'p2',
        },
      ],
      selectedItemIds: new Set(['p1', 'p2']),
    });

    useShareImportFlow.getState().toggleSelect('p1');

    expect(useShareImportFlow.getState().selectedItemIds.has('p1')).toBe(false);
    expect(useShareImportFlow.getState().selectedItemIds.has('p2')).toBe(true);
  });

  it('resolveLimitHit() invokes resolve callback and transitions to importing', () => {
    const resolve = vi.fn();
    useShareImportFlow.setState({
      status: 'limit_hit',
      limitContext: {
        reason: 'max_per_content',
        contentId: 'fru',
        neededCount: 1,
        planId: 'p1',
        resolve,
      },
    });

    useShareImportFlow.getState().resolveLimitHit('resolved');

    expect(resolve).toHaveBeenCalledWith('resolved');
    expect(useShareImportFlow.getState().limitContext).toBeNull();
    expect(useShareImportFlow.getState().status).toBe('importing');
  });

  it('resolveLimitHit() with cancelled passes through to callback', () => {
    const resolve = vi.fn();
    useShareImportFlow.setState({
      status: 'limit_hit',
      limitContext: { reason: 'max_per_content', contentId: 'fru', neededCount: 1, planId: 'p1', resolve },
    });

    useShareImportFlow.getState().resolveLimitHit('cancelled');

    expect(resolve).toHaveBeenCalledWith('cancelled');
  });

  it('close() resets to idle', () => {
    useShareImportFlow.setState({
      status: 'preview',
      shareId: 'abc',
      sharedData: { foo: 'bar' } as any,
    });

    useShareImportFlow.getState().close();

    const state = useShareImportFlow.getState();
    expect(state.status).toBe('idle');
    expect(state.shareId).toBe(null);
    expect(state.sharedData).toBe(null);
  });

  it('close() resolves pending limitContext with cancelled', () => {
    // limit_hit 状態のままシートを閉じると executeShareImport が
    // limitContext.resolve を待ち続けて止まる (= stuck Promise) ため、
    // close 時に未解決の Promise を 'cancelled' で resolve することを保証する。
    const resolve = vi.fn();
    useShareImportFlow.setState({
      status: 'limit_hit',
      limitContext: {
        reason: 'max_per_content',
        contentId: 'fru',
        neededCount: 1,
        planId: 'p1',
        resolve,
      },
    });

    useShareImportFlow.getState().close();

    expect(resolve).toHaveBeenCalledWith('cancelled');
    expect(useShareImportFlow.getState().limitContext).toBeNull();
  });
});
