import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAdmin, mockInitAdmin, mockGetAdminFirestore } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockInitAdmin: vi.fn(),
  mockGetAdminFirestore: vi.fn(),
}));

vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: mockInitAdmin,
  verifyAdmin: mockVerifyAdmin,
  getAdminFirestore: mockGetAdminFirestore,
}));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));

import handler from '../_housingerReportsHandler.js';

type Row = Record<string, any>;

function createFakeAdminFirestore(seed: { housing_profiles?: Record<string, Row> }) {
  const store = { housing_profiles: new Map(Object.entries(seed.housing_profiles ?? {})) };
  function makeDocRef(id: string) { return { __kind: 'doc', id }; }
  function readDoc(ref: any) {
    const data = store.housing_profiles.get(ref.id);
    return { exists: data !== undefined, id: ref.id, data: () => (data ? { ...data } : undefined) };
  }
  const tx = {
    get(ref: any) { return Promise.resolve(readDoc(ref)); },
    update(ref: any, data: Row) {
      const prev = store.housing_profiles.get(ref.id);
      if (prev === undefined) throw new Error(`no doc ${ref.id}`);
      store.housing_profiles.set(ref.id, { ...prev, ...data });
    },
  };
  return {
    collection() {
      return { doc: (id: string) => makeDocRef(id), where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) };
    },
    async runTransaction(fn: (tx: any) => Promise<any>) { return fn(tx); },
    __getDoc(id: string) { return store.housing_profiles.get(id); },
  };
}

function makeReq(overrides: Row = {}): any {
  return { method: 'PATCH', headers: {}, query: {}, ...overrides };
}
function makeRes(): any {
  const res: any = { statusCode: 200, body: undefined };
  res.setHeader = vi.fn();
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((p: any) => { res.body = p; return res; });
  res.end = vi.fn(() => res);
  return res;
}

describe('_housingerReportsHandler PATCH hide/restore', () => {
  beforeEach(() => {
    mockVerifyAdmin.mockReset();
    mockVerifyAdmin.mockResolvedValue('admin-uid-1');
    mockInitAdmin.mockReset();
    mockGetAdminFirestore.mockReset();
  });

  it('hide で isModerationHidden=true になる', async () => {
    const uid = 'hashed:abc123';
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'Taro', isPublished: true, isModerationHidden: false, reportCount: 0 } },
    });
    mockGetAdminFirestore.mockReturnValue(db);
    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'hide', uid } }), res);
    expect(res.statusCode).toBe(200);
    expect(db.__getDoc(uid)?.isModerationHidden).toBe(true);
  });

  it('restore で isModerationHidden=false になる', async () => {
    const uid = 'hashed:abc123';
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'Taro', isPublished: true, isModerationHidden: true, reportCount: 0 } },
    });
    mockGetAdminFirestore.mockReturnValue(db);
    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'restore', uid } }), res);
    expect(res.statusCode).toBe(200);
    expect(db.__getDoc(uid)?.isModerationHidden).toBe(false);
  });

  it('存在しない uid は 404', async () => {
    const db = createFakeAdminFirestore({ housing_profiles: {} });
    mockGetAdminFirestore.mockReturnValue(db);
    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'hide', uid: 'hashed:nope' } }), res);
    expect(res.statusCode).toBe(404);
  });
});
