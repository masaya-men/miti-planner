import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PALETTE_RULE } from '../../../src/lib/housing/color/housingExtractPalette.js';

// --- 依存の mock (module 境界で差し替える。firebase-admin の内部は触らない) ---
const txSetSpy = vi.fn();
const sendNotifyMock = vi.fn<(content: string) => Promise<void>>(() => Promise.resolve());
vi.mock('../../../src/lib/discordWebhook.js', () => ({
  sendHousingNewListingNotification: (c: string) => sendNotifyMock(c),
  sendDiscordNotification: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../_publicFeedStore.js', () => ({ recordPublicListingChange: vi.fn(async () => {}), requestGalleryRotation: vi.fn(async () => {}) }));
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

// OGカード事前生成 (Task 4): og_image_meta/{hash}.set() の spy と warm-up fetch の spy。
const ogImageMetaSetMock = vi.fn<(hash?: string, meta?: unknown) => Promise<void>>(async () => {});
const fetchMock = vi.fn<(url?: unknown, init?: unknown) => Promise<Response>>(async () => ({ ok: true }) as Response);

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
      set: (hash: string, meta: unknown) => ogImageMetaSetMock(hash, meta),
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
    set: txSetSpy,
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
  ogImageMetaSetMock.mockClear();
  ogImageMetaSetMock.mockImplementation(() => Promise.resolve());
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => ({ ok: true }) as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
  decodedToken = { uid: 'hashed:user1', role: undefined };
  listingDocData = {
    title: 'テストハウス', visibility: 'public',
    dc: 'Elemental', server: 'Carbuncle', area: 'Mist', ward: 5, plot: 12,
    buildingType: 'house', ownerUid: 'hashed:user1',
  };
  profileSnap = { exists: false, data: () => null };
  dupDocs = [];
});


const snsBody = {
  ...validBody,
  imageMode: 'sns',
  postUrl: 'https://x.com/user/status/1234567890123',
  ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
  tweetId: '1234567890123',
};
const savedListing = () => txSetSpy.mock.calls.map((c) => c[1] as Record<string, unknown>).find((d) => 'addressKey' in d) as Record<string, unknown>;

describe('register-listing: 同梱された色の保存(色で探す)', () => {
  beforeEach(() => txSetSpy.mockClear());

  it('sns の家に正しい色が同梱されたら保存される', async () => {
    const { req, res } = makeReqRes({ ...snsBody, colorFamilies: ['blue', 'white'], colorRule: PALETTE_RULE });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(savedListing().imageMode).toBe('sns');
    expect(savedListing().colorFamilies).toEqual(['blue', 'white']);
    expect(savedListing().colorRule).toBe(PALETTE_RULE);
  });
  it('不正な値(許可外・4件・重複・古い決まり)は捨てられ、登録は成功する', async () => {
    for (const bad of [
      { colorFamilies: ['magenta'], colorRule: PALETTE_RULE },
      { colorFamilies: ['red', 'blue', 'green', 'pink'], colorRule: PALETTE_RULE },
      { colorFamilies: ['red', 'red'], colorRule: PALETTE_RULE },
      { colorFamilies: ['red'], colorRule: PALETTE_RULE - 1 },
    ]) {
      txSetSpy.mockClear();
      const { req, res } = makeReqRes({ ...snsBody, ...bad });
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect('colorFamilies' in savedListing()).toBe(false);
      expect('colorRule' in savedListing()).toBe(false);
    }
  });
  it('色が無い登録も今までどおり(欄は付かない)', async () => {
    const { req, res } = makeReqRes(snsBody);
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect('colorFamilies' in savedListing()).toBe(false);
  });
  it('直接アップロードの家(sns でない)には、登録時に同梱されても色を付けない(色は画像送信時に付く)', async () => {
    const { req, res } = makeReqRes({ ...validBody, colorFamilies: ['red'], colorRule: PALETTE_RULE });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect('colorFamilies' in savedListing()).toBe(false);
  });
});
