import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAdmin, mockGetAdminFirestore, mockBump, DELETE } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockGetAdminFirestore: vi.fn(),
  mockBump: vi.fn(),
  DELETE: { __delete: true },
}));

vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: vi.fn(),
  verifyAdmin: mockVerifyAdmin,
  getAdminFirestore: mockGetAdminFirestore,
}));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => DELETE } }));
vi.mock('../../housing/_publicVersion.js', () => ({
  bumpPublicVersionDirect: mockBump,
  bumpPublicVersionTx: vi.fn(),
}));

import housingerHandler from '../_housingerReportsHandler.js';
import housingHandler from '../_housingReportsHandler.js';

type Row = Record<string, any>;

/** コレクション名 -> id -> doc を持つ最小のフェイク Firestore。 */
function createFakeDb(seed: Record<string, Record<string, Row>>) {
  const store: Record<string, Map<string, Row>> = {};
  for (const [c, docs] of Object.entries(seed)) store[c] = new Map(Object.entries(docs));
  function apply(name: string, id: string, data: Row) {
    const prev = store[name].get(id);
    if (!prev) throw new Error(`no doc ${name}/${id}`);
    const next = { ...prev };
    for (const [k, v] of Object.entries(data)) {
      if (v === DELETE) delete next[k];
      else next[k] = v;
    }
    store[name].set(id, next);
  }
  const ref = (name: string, id: string): any => ({
    id,
    __name: name,
    get: async () => ({ exists: store[name].has(id), id, data: () => ({ ...store[name].get(id) }) }),
    update: async (d: Row) => apply(name, id, d),
  });
  const db: any = {
    collection(name: string) {
      store[name] ??= new Map();
      return {
        doc: (id: string) => ref(name, id),
        where: (field: string, _op: string, value: unknown) => ({
          get: async () => ({
            docs: [...store[name].entries()]
              .filter(([, v]) => v[field] === value)
              .map(([id, v]) => ({ id, ref: ref(name, id), data: () => ({ ...v }) })),
          }),
        }),
      };
    },
    batch() {
      const ops: Array<() => void> = [];
      return {
        update: (r: any, d: Row) => ops.push(() => apply(r.__name, r.id, d)),
        commit: async () => ops.forEach((o) => o()),
      };
    },
    __doc: (c: string, id: string) => store[c].get(id),
  };
  return db;
}

function req(query: Row): any {
  return { method: 'PATCH', headers: {}, query };
}
function res(): any {
  const r: any = { statusCode: 200, body: undefined };
  r.setHeader = vi.fn();
  r.status = vi.fn((c: number) => { r.statusCode = c; return r; });
  r.json = vi.fn((p: any) => { r.body = p; return r; });
  r.end = vi.fn(() => r);
  return r;
}

describe('運営非表示 (adminHiddenScope) 管理 API', () => {
  beforeEach(() => {
    mockVerifyAdmin.mockReset().mockResolvedValue('admin');
    mockBump.mockReset();
  });

  it('hide-listings: 自分の未削除・未運営非表示の家だけ owner で隠し、profile に印を付ける', async () => {
    const db = createFakeDb({
      housing_profiles: { u1: { reportCount: 0 } },
      housing_listings: {
        a: { ownerUid: 'u1', isHidden: false, deletedAt: null },
        b: { ownerUid: 'u1', isHidden: true, adminHiddenScope: 'listing', deletedAt: null },
        c: { ownerUid: 'u1', isHidden: false, deletedAt: 123 },
        d: { ownerUid: 'u2', isHidden: false, deletedAt: null },
      },
    });
    mockGetAdminFirestore.mockReturnValue(db);
    const r = res();
    await housingerHandler(req({ resource: 'housinger_reports', action: 'hide-listings', uid: 'u1' }), r);
    expect(r.body).toEqual({ success: true, affected: 1 });
    expect(db.__doc('housing_listings', 'a')).toMatchObject({ isHidden: true, adminHiddenScope: 'owner' });
    expect(db.__doc('housing_listings', 'b').adminHiddenScope).toBe('listing');
    expect(db.__doc('housing_listings', 'c').adminHiddenScope).toBeUndefined();
    expect(db.__doc('housing_listings', 'd').adminHiddenScope).toBeUndefined();
    expect(db.__doc('housing_profiles', 'u1').listingsModerationHidden).toBe(true);
    expect(mockBump).toHaveBeenCalled();
  });

  it('restore-listings: owner の家だけ戻し、閾値以上の通報がある家は隠れたまま。listing の家は触らない', async () => {
    const db = createFakeDb({
      housing_profiles: { u1: { listingsModerationHidden: true } },
      housing_listings: {
        a: { ownerUid: 'u1', isHidden: true, adminHiddenScope: 'owner', reportCount: 0, deletedAt: null },
        b: { ownerUid: 'u1', isHidden: true, adminHiddenScope: 'owner', reportCount: 3, deletedAt: null },
        c: { ownerUid: 'u1', isHidden: true, adminHiddenScope: 'listing', reportCount: 0, deletedAt: null },
      },
    });
    mockGetAdminFirestore.mockReturnValue(db);
    const r = res();
    await housingerHandler(req({ resource: 'housinger_reports', action: 'restore-listings', uid: 'u1' }), r);
    expect(r.body).toEqual({ success: true, affected: 2 });
    expect(db.__doc('housing_listings', 'a').isHidden).toBe(false);
    expect(db.__doc('housing_listings', 'a').adminHiddenScope).toBeUndefined();
    expect(db.__doc('housing_listings', 'b').isHidden).toBe(true);
    expect(db.__doc('housing_listings', 'b').adminHiddenScope).toBeUndefined();
    expect(db.__doc('housing_listings', 'c')).toMatchObject({ isHidden: true, adminHiddenScope: 'listing' });
    expect(db.__doc('housing_profiles', 'u1').listingsModerationHidden).toBe(false);
  });

  it('listing hide は adminHiddenScope=listing を付け、restore は外して通報数で isHidden を再判定', async () => {
    const db = createFakeDb({
      housing_listings: { a: { ownerUid: 'u1', isHidden: false, reportCount: 1 } },
    });
    mockGetAdminFirestore.mockReturnValue(db);
    await housingHandler(req({ resource: 'housing_reports', action: 'hide', listingId: 'a' }), res());
    expect(db.__doc('housing_listings', 'a')).toMatchObject({ isHidden: true, adminHiddenScope: 'listing' });
    await housingHandler(req({ resource: 'housing_reports', action: 'restore', listingId: 'a' }), res());
    expect(db.__doc('housing_listings', 'a').isHidden).toBe(false);
    expect(db.__doc('housing_listings', 'a').adminHiddenScope).toBeUndefined();
    expect(mockBump).toHaveBeenCalledTimes(2);
  });

  it('dismiss-one は運営非表示の家の isHidden を戻さない (件数減算は従来通り)', async () => {
    const listing: Row = { ownerUid: 'u1', isHidden: true, adminHiddenScope: 'listing', reportCount: 1 };
    const updates: Row[] = [];
    const reportRef = { id: 'r1' };
    const listingRef: any = {
      get: async () => ({ exists: true, data: () => listing }),
      collection: () => ({ doc: () => reportRef }),
    };
    const db: any = {
      collection: (n: string) => (n === 'housing_listings'
        ? { doc: () => listingRef }
        : { doc: () => ({ collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) }) }) }) }),
      runTransaction: async (fn: any) => fn({
        get: async (r: any) => (r === listingRef ? { exists: true, data: () => listing } : { exists: true }),
        delete: vi.fn(),
        update: (_r: any, d: Row) => updates.push(d),
      }),
    };
    mockGetAdminFirestore.mockReturnValue(db);
    const r = res();
    await housingHandler(req({ resource: 'housing_reports', action: 'dismiss-one', listingId: 'a', reportId: 'r1' }), r);
    expect(r.statusCode).toBe(200);
    expect(updates[0].reportCount).toBe(0);
    expect('isHidden' in updates[0]).toBe(false);
  });
});
