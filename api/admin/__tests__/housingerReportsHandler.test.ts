import { describe, it, expect, vi, beforeEach } from 'vitest';
import { personalTagIdForUid } from '../../../src/lib/housing/housingerProfile.js';

/**
 * PATCH hide/restore の個人タグ解決テスト (レビュー指摘の再発防止)。
 *
 * `api/housing/_upsertHousingerProfileHandler.ts` と同様、 実際の Firestore Admin SDK を
 * トランザクション込みで最小限モックした「フェイク Firestore」 を使い、
 * `db.collection('personal_tags').doc(personalTagIdForUid(uid))` の直接参照では
 * legacy slug ID (旧 create-personal-tag 経路) のタグを取りこぼすことを検証する。
 */

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

vi.mock('../../../src/lib/rateLimit.js', () => ({
  applyRateLimit: vi.fn(async () => true),
}));

vi.mock('../../../src/lib/appCheckVerify.js', () => ({
  verifyAppCheck: vi.fn(async () => true),
}));

import handler from '../_housingerReportsHandler.js';

type Row = Record<string, any>;

/** `db.collection(name).doc(id)` / `.where(...).limit(n)` / `runTransaction` のみを実装した最小フェイク。 */
function createFakeAdminFirestore(seed: {
  housing_profiles?: Record<string, Row>;
  personal_tags?: Record<string, Row>;
}) {
  const store: Record<string, Map<string, Row>> = {
    housing_profiles: new Map(Object.entries(seed.housing_profiles ?? {})),
    personal_tags: new Map(Object.entries(seed.personal_tags ?? {})),
  };

  function ensureCollection(name: string) {
    if (!store[name]) store[name] = new Map();
    return store[name];
  }

  function makeDocRef(collectionName: string, id: string): any {
    return { __kind: 'doc', collectionName, id };
  }

  function makeQueryRef(collectionName: string, filters: [string, string, any][], limitN?: number): any {
    return {
      __kind: 'query',
      collectionName,
      filters,
      limitN,
      limit(n: number) {
        return makeQueryRef(collectionName, filters, n);
      },
    };
  }

  function makeCollectionRef(name: string): any {
    return {
      doc(id: string) {
        return makeDocRef(name, id);
      },
      where(field: string, op: string, value: any) {
        return makeQueryRef(name, [[field, op, value]]);
      },
    };
  }

  function readDoc(ref: any) {
    const col = ensureCollection(ref.collectionName);
    const data = col.get(ref.id);
    return {
      exists: data !== undefined,
      id: ref.id,
      ref,
      data: () => (data ? { ...data } : undefined),
    };
  }

  function readQuery(ref: any) {
    const col = ensureCollection(ref.collectionName);
    let entries = [...col.entries()];
    for (const [field, op, value] of ref.filters) {
      if (op !== '==') throw new Error(`fake firestore: unsupported op ${op}`);
      entries = entries.filter(([, data]) => data[field] === value);
    }
    if (typeof ref.limitN === 'number') entries = entries.slice(0, ref.limitN);
    const docs = entries.map(([id, data]) => ({
      id,
      data: () => ({ ...data }),
      ref: makeDocRef(ref.collectionName, id),
    }));
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  const tx = {
    get(ref: any) {
      if (ref.__kind === 'query') return Promise.resolve(readQuery(ref));
      return Promise.resolve(readDoc(ref));
    },
    update(ref: any, data: Row) {
      const col = ensureCollection(ref.collectionName);
      const prev = col.get(ref.id);
      // 実際の Firestore と同様、 存在しないドキュメントへの update は例外にする
      // (「タグドキュメントが無ければ何も起きない」 のガードが崩れていないかをテストで検出できるように)。
      if (prev === undefined) {
        throw new Error(`fake firestore: cannot update non-existent doc ${ref.collectionName}/${ref.id}`);
      }
      col.set(ref.id, { ...prev, ...data });
    },
  };

  return {
    collection(name: string) {
      return makeCollectionRef(name);
    },
    async runTransaction(fn: (tx: any) => Promise<any>) {
      return fn(tx);
    },
    __getDoc(collectionName: string, id: string) {
      return store[collectionName]?.get(id);
    },
  };
}

function makeReq(overrides: Row = {}): any {
  return { method: 'PATCH', headers: {}, query: {}, ...overrides };
}

function makeRes(): any {
  const res: any = { statusCode: 200, body: undefined };
  res.setHeader = vi.fn();
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  res.end = vi.fn(() => res);
  return res;
}

describe('_housingerReportsHandler PATCH hide/restore: 個人タグの解決', () => {
  beforeEach(() => {
    mockVerifyAdmin.mockReset();
    mockVerifyAdmin.mockResolvedValue('admin-uid-1');
    mockInitAdmin.mockReset();
    mockGetAdminFirestore.mockReset();
  });

  it('canonical ID のタグは強制非公開で isHidden=true になる', async () => {
    const uid = 'hashed:abc123';
    const canonicalTagId = personalTagIdForUid(uid);
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'Taro', isPublished: true, isModerationHidden: false, reportCount: 0 } },
      personal_tags: { [canonicalTagId]: { id: canonicalTagId, ownerUid: uid, isHidden: false } },
    });
    mockGetAdminFirestore.mockReturnValue(db);

    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'hide', uid } }), res);

    expect(res.statusCode).toBe(200);
    expect(db.__getDoc('housing_profiles', uid)?.isModerationHidden).toBe(true);
    expect(db.__getDoc('personal_tags', canonicalTagId)?.isHidden).toBe(true);
  });

  it('canonical ID のタグは復帰で isPublished に応じて isHidden が再計算される', async () => {
    const uid = 'hashed:abc123';
    const canonicalTagId = personalTagIdForUid(uid);
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'Taro', isPublished: true, isModerationHidden: true, reportCount: 0 } },
      personal_tags: { [canonicalTagId]: { id: canonicalTagId, ownerUid: uid, isHidden: true } },
    });
    mockGetAdminFirestore.mockReturnValue(db);

    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'restore', uid } }), res);

    expect(res.statusCode).toBe(200);
    expect(db.__getDoc('housing_profiles', uid)?.isModerationHidden).toBe(false);
    expect(db.__getDoc('personal_tags', canonicalTagId)?.isHidden).toBe(false);
  });

  it('legacy slug ID のタグ (ownerUid は一致するが doc ID が canonical と異なる) も強制非公開で isHidden=true になる (レビュー指摘の再発防止)', async () => {
    const uid = 'hashed:legacy001';
    const legacyTagId = 'personal_yuura_ab12cd';
    expect(legacyTagId).not.toBe(personalTagIdForUid(uid));
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'Yuura', isPublished: true, isModerationHidden: false, reportCount: 3 } },
      personal_tags: { [legacyTagId]: { id: legacyTagId, ownerUid: uid, isHidden: false } },
    });
    mockGetAdminFirestore.mockReturnValue(db);

    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'hide', uid } }), res);

    expect(res.statusCode).toBe(200);
    expect(db.__getDoc('housing_profiles', uid)?.isModerationHidden).toBe(true);
    expect(db.__getDoc('personal_tags', legacyTagId)?.isHidden).toBe(true);
  });

  it('legacy slug ID のタグは復帰でも isPublished に応じて isHidden が再計算される (レビュー指摘の再発防止)', async () => {
    const uid = 'hashed:legacy001';
    const legacyTagId = 'personal_yuura_ab12cd';
    // isPublished=true の状態で強制非公開されていた想定 (isHidden は hide 時に true になっている)。
    // 復帰後は isModerationHidden=false かつ isPublished=true なので isHidden は false に戻るべき
    // (バグったコードは tagSnap.exists=false で no-op になり isHidden=true のまま残ってしまう)。
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'Yuura', isPublished: true, isModerationHidden: true, reportCount: 3 } },
      personal_tags: { [legacyTagId]: { id: legacyTagId, ownerUid: uid, isHidden: true } },
    });
    mockGetAdminFirestore.mockReturnValue(db);

    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'restore', uid } }), res);

    expect(res.statusCode).toBe(200);
    expect(db.__getDoc('housing_profiles', uid)?.isModerationHidden).toBe(false);
    expect(db.__getDoc('personal_tags', legacyTagId)?.isHidden).toBe(false);
  });

  it('personal_tags ドキュメントが存在しない uid の強制非公開は 404 にならず、 タグ更新なしで成功する (admin 経路はタグを新規作成しない)', async () => {
    const uid = 'hashed:notag001';
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'NoTag', isPublished: false, isModerationHidden: false, reportCount: 1 } },
      personal_tags: {},
    });
    mockGetAdminFirestore.mockReturnValue(db);

    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'hide', uid } }), res);

    expect(res.statusCode).toBe(200);
    expect(db.__getDoc('housing_profiles', uid)?.isModerationHidden).toBe(true);
    expect(db.__getDoc('personal_tags', personalTagIdForUid(uid))).toBeUndefined();
  });
});
