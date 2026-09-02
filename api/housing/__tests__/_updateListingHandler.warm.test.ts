import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Task 4: 物件編集時の OGカード事前生成。
 * tx.update 成功後、更新後 doc を読み直して代表画像があれば warmListingOgCard を await する。
 * warm 失敗 (meta 書き込み / fetch) が編集を 500 にしないこと、画像の無い物件では走らないことを確認する。
 *
 * mock 方針は _thumbnailHandlers.coverThumbHash.test.ts と同型 (module 境界で差し替え・
 * firebase-admin の内部は触らない・src/utils/housingValidation.js は REAL)。
 */

const h = vi.hoisted(() => {
  const txUpdateSpy = vi.fn();
  const ogMetaSetSpy = vi.fn(async () => {});
  const state = {
    // tx.get() が返す既存 doc
    txData: { ownerUid: 'hashed:user1', imageMode: 'sns' } as Record<string, unknown>,
    // 更新後に listingRef.get() が返す doc (warm 判定に使う)
    freshData: undefined as Record<string, unknown> | undefined,
  };
  const listingRef = {
    id: 'listing1',
    get: vi.fn(async () => ({ exists: true, data: () => state.freshData })),
  };
  const fakeDb = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn(() => (name === 'og_image_meta' ? { set: ogMetaSetSpy } : listingRef)),
    })),
    runTransaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        get: vi.fn(async () => ({ exists: true, data: () => state.txData })),
        set: vi.fn(),
        update: txUpdateSpy,
      }),
    ),
  };
  return { txUpdateSpy, ogMetaSetSpy, state, listingRef, fakeDb };
});

vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: vi.fn(),
  getAdminFirestore: vi.fn(() => h.fakeDb),
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: vi.fn(async () => ({ uid: 'hashed:user1' })) })),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { delete: () => '__DELETE__', increment: () => '__INCREMENT__' },
}));
vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      deleteFiles: vi.fn(async () => {}),
      file: vi.fn(() => ({ delete: vi.fn(async () => {}) })),
    })),
  })),
}));
vi.mock('../_publicVersion.js', () => ({
  bumpPublicVersionTx: vi.fn(),
  bumpPublicVersionBatch: vi.fn(),
  bumpPublicVersionDirect: vi.fn(async () => {}),
}));

import updateHandler from '../_updateListingHandler.js';

const fetchMock = vi.fn(async (_url?: unknown, _init?: unknown) => ({ ok: true }) as Response);

function makeReqRes(body: unknown) {
  const req: any = {
    method: 'POST',
    headers: { authorization: 'Bearer t', origin: 'https://lopoly.app' },
    body,
  };
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    setHeader() {},
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: any) {
      this.body = b;
      return this;
    },
    end() {
      return this;
    },
  };
  return { req, res };
}

// plot 12 / Mist = 区画サイズ 'S'。X 静止画ツイート経路 (代表画像 = ogImageUrl)。
const snsUpdateBody = {
  listingId: 'listing1',
  dc: 'Elemental',
  server: 'Carbuncle',
  area: 'Mist',
  ward: 5,
  plot: 12,
  buildingType: 'house',
  size: 'S',
  tags: [],
  visibility: 'public',
  imageMode: 'sns',
  postUrl: 'https://x.com/user/status/1234567890123',
  ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
  tweetId: '1234567890123',
};

// 画像を持たないテキストのみの編集 (説明文だけ変える等)。
const textOnlyUpdateBody = {
  listingId: 'listing1',
  dc: 'Elemental',
  server: 'Carbuncle',
  area: 'Mist',
  ward: 5,
  plot: 12,
  buildingType: 'house',
  size: 'S',
  tags: [],
  visibility: 'public',
};

beforeEach(() => {
  vi.clearAllMocks();
  h.state.txData = { ownerUid: 'hashed:user1', imageMode: 'sns' };
  h.state.freshData = undefined;
  h.ogMetaSetSpy.mockImplementation(() => Promise.resolve());
  fetchMock.mockImplementation(async () => ({ ok: true }) as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('_updateListingHandler: 編集時の OGカード事前生成 (Task 4)', () => {
  it('更新後 doc に代表画像があれば meta 書き込み + warm-up fetch (/og/<hash>.png) が走り、200 を返す', async () => {
    h.state.freshData = { imageMode: 'sns', ogImageUrl: 'https://pbs.twimg.com/media/DEF.jpg' };
    const { req, res } = makeReqRes(snsUpdateBody);
    await updateHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(h.txUpdateSpy).toHaveBeenCalledTimes(1);
    expect(h.ogMetaSetSpy).toHaveBeenCalledTimes(1);
    const ogFetch = fetchMock.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('/og/'),
    );
    expect(ogFetch?.[0]).toMatch(/^https:\/\/lopoly\.app\/og\/[a-f0-9]{16}\.png$/);
  });

  it('更新後 doc に代表画像が無ければ事前生成は走らない', async () => {
    h.state.freshData = { imageMode: 'sns', tweetId: '123' }; // テキストのみツイート = 画像なし
    const { req, res } = makeReqRes(textOnlyUpdateBody);
    await updateHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(h.ogMetaSetSpy).not.toHaveBeenCalled();
    const ogFetch = fetchMock.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('/og/'),
    );
    expect(ogFetch).toBeUndefined();
  });

  it('事前生成 (meta 書き込み) が失敗しても編集は 200 のまま (500 にしない)', async () => {
    h.state.freshData = { imageMode: 'sns', ogImageUrl: 'https://pbs.twimg.com/media/DEF.jpg' };
    h.ogMetaSetSpy.mockRejectedValueOnce(new Error('firestore down'));
    const { req, res } = makeReqRes(snsUpdateBody);
    await updateHandler(req, res);

    expect(res.statusCode).toBe(200);
  });
});
