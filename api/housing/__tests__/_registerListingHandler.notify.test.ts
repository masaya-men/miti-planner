import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- 依存の mock (module 境界で差し替える。firebase-admin の内部は触らない) ---
const sendNotifyMock = vi.fn((_content: string) => Promise.resolve());
vi.mock('../../../src/lib/discordWebhook.js', () => ({
  sendHousingNewListingNotification: (c: string) => sendNotifyMock(c),
  sendDiscordNotification: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../_publicVersion.js', () => ({
  bumpPublicVersionTx: vi.fn(),
  bumpPublicVersionBatch: vi.fn(),
  bumpPublicVersionDirect: vi.fn(() => Promise.resolve()),
}));

let decodedToken: any = { uid: 'hashed:user1', role: undefined };
vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: vi.fn(() => Promise.resolve(decodedToken)) })),
}));

// best-effort read で返す listing doc / profile doc / 重複クエリ結果を制御する。
let listingDocData: any = {
  title: 'テストハウス', visibility: 'public',
  dc: 'Elemental', server: 'Carbuncle', area: 'Mist', ward: 5, plot: 12,
  buildingType: 'house', ownerUid: 'hashed:user1',
};
let profileSnap: any = { exists: false, data: () => null };
let dupDocs: any[] = [];

function makeChain(name: string): any {
  const chain: any = {
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    select: vi.fn(() => chain),
    get: vi.fn(async () => ({ docs: name === 'housing_listings' ? dupDocs : [], size: 0, empty: true })),
    doc: vi.fn((id?: string) => ({
      id: id ?? 'new-listing-id',
      get: vi.fn(async () => {
        if (name === 'housing_listings') return { exists: true, data: () => listingDocData };
        if (name === 'housing_profiles') return profileSnap;
        return { exists: false, data: () => null };
      }),
    })),
  };
  return chain;
}
const fakeDb: any = {
  collection: vi.fn((name: string) => makeChain(name)),
  doc: vi.fn(() => ({})),
  batch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn(async () => {}) })),
  runTransaction: vi.fn(async (cb: any) => cb({
    get: vi.fn(async () => ({ exists: false, data: () => null })),
    set: vi.fn(),
    update: vi.fn(),
  })),
};
vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: vi.fn(),
  getAdminFirestore: vi.fn(() => fakeDb),
}));

import handler from '../_registerListingHandler.js';

function makeReqRes(body: any) {
  const req: any = { method: 'POST', headers: { authorization: 'Bearer t', origin: 'https://lopoly.app' }, body };
  const res: any = {
    statusCode: 0,
    _json: undefined as any,
    setHeader() {},
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this._json = b; return this; },
    end() { return this; },
  };
  return { req, res };
}

// plot 12 / Mist は区画サイズ 'S' (getPlotSize)。size を一致させないと
// validateRegistrationDraft が mismatch_with_plot で 400 を返す。
const validBody = {
  dc: 'Elemental', server: 'Carbuncle', area: 'Mist', ward: 5, plot: 12,
  buildingType: 'house', size: 'S', tags: [], visibility: 'public',
};

beforeEach(() => {
  sendNotifyMock.mockClear();
  sendNotifyMock.mockImplementation(() => Promise.resolve());
  decodedToken = { uid: 'hashed:user1', role: undefined };
  listingDocData = {
    title: 'テストハウス', visibility: 'public',
    dc: 'Elemental', server: 'Carbuncle', area: 'Mist', ward: 5, plot: 12,
    buildingType: 'house', ownerUid: 'hashed:user1',
  };
  profileSnap = { exists: false, data: () => null };
  dupDocs = [];
});

describe('register-listing の新着通知', () => {
  it('一般ユーザーの public 登録で通知が送られる', async () => {
    const { req, res } = makeReqRes(validBody);
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(sendNotifyMock).toHaveBeenCalledTimes(1);
    expect(sendNotifyMock.mock.calls[0][0]).toContain('🏠 新着ハウジング');
  });

  it('admin の登録では通知が送られない', async () => {
    decodedToken = { uid: 'hashed:admin1', role: 'admin' };
    const { req, res } = makeReqRes(validBody);
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(sendNotifyMock).not.toHaveBeenCalled();
  });

  it('visibility=private では通知が送られない', async () => {
    const { req, res } = makeReqRes({ ...validBody, visibility: 'private' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(sendNotifyMock).not.toHaveBeenCalled();
  });

  it('通知送信が reject してもレスポンスは 200', async () => {
    sendNotifyMock.mockRejectedValueOnce(new Error('discord down'));
    const { req, res } = makeReqRes(validBody);
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('プロフィール公開時は通知本文にリプ用リードが入る', async () => {
    profileSnap = { exists: true, data: () => ({ displayName: 'ハウジンガー太郎', isPublished: true, isModerationHidden: false }) };
    const { req, res } = makeReqRes(validBody);
    await handler(req, res);
    expect(sendNotifyMock).toHaveBeenCalledTimes(1);
    expect(sendNotifyMock.mock.calls[0][0]).toContain('ハウジンガー太郎さんの他のハウジングはこちら👇');
  });
});
