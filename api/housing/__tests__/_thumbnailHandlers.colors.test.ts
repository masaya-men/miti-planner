import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * (色で探す 2026-11-12: 同じ作りで colorFamilies / colorRule の失効を確かめる)
 * Issue A の回帰テスト: coverThumbHash (ThumbHash ブラー placeholder) のライフサイクルを
 * 「代表画像 (thumbnailPaths[0]) を変える 3 経路」で維持できているか。
 *
 * - _updateListingHandler: thumbnail→sns 切替時は無条件で coverThumbHash を delete。
 * - _deleteThumbnailHandler / _reorderThumbnailsHandler: 先頭 URL が変わったときだけ delete。
 *
 * mock 方針は _uploadThumbnailHandler.derivatives.test.ts と同型 (module 境界で差し替え、
 * firebase-admin の内部は触らない)。FieldValue.delete() は単純なセンチネル。
 */

const h = vi.hoisted(() => {
  const txUpdateSpy = vi.fn();
  const deleteFilesSpy = vi.fn(async () => {});
  const fileDeleteSpy = vi.fn(async () => {});
  const ogMetaSetSpy = vi.fn(async () => {});
  const state = { storedData: {} as Record<string, unknown> };
  // warmListingCard が更新後に `(await listingRef.get()).data()` を読むため get() を持たせる
  // (このテストの storedData には代表画像が無いので warm は早期 return = 実効 no-op)。
  const listingRef = {
    id: 'listing1',
    get: vi.fn(async () => ({ exists: true, data: () => state.storedData })),
  };
  const fakeDb = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn(() => (name === 'og_image_meta' ? { set: ogMetaSetSpy } : listingRef)),
    })),
    doc: vi.fn(() => ({})),
    runTransaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        get: vi.fn(async () => ({ exists: true, data: () => state.storedData })),
        set: vi.fn(),
        update: txUpdateSpy,
      }),
    ),
  };
  return { txUpdateSpy, deleteFilesSpy, fileDeleteSpy, ogMetaSetSpy, state, listingRef, fakeDb };
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
vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      deleteFiles: h.deleteFilesSpy,
      file: vi.fn(() => ({ delete: h.fileDeleteSpy })),
    })),
  })),
}));
// FieldValue.delete() は識別できれば十分 (ハンドラは値の同一性しか見ない)。
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { delete: () => '__DELETE__', increment: () => '__INCREMENT__' },
}));
vi.mock('../_publicFeedStore.js', () => ({ recordPublicListingChange: vi.fn(async () => {}), requestGalleryRotation: vi.fn(async () => {}) }));
vi.mock('../_publicVersion.js', () => ({
  bumpPublicVersionTx: vi.fn(),
  bumpPublicVersionBatch: vi.fn(),
  bumpPublicVersionDirect: vi.fn(async () => {}),
}));
// ../_imageArrayLogic.js (computeArrayDeletion / computeArrayReorder / parseStoragePathFromPublicUrl)
// は純関数なので REAL のまま。src/utils/housingValidation.js も REAL (register テストと同様)。

import updateHandler from '../_updateListingHandler.js';
import deleteHandler from '../_deleteThumbnailHandler.js';
import reorderHandler from '../_reorderThumbnailsHandler.js';
import deleteSourceHandler from '../_deleteSourceImageHandler.js';
import reorderSourceHandler from '../_reorderSourceImagesHandler.js';

function makeReqRes(body: unknown) {
  const req: any = { method: 'POST', headers: { authorization: 'Bearer t', origin: 'https://lopoly.app' }, body };
  const res: any = {
    statusCode: 0, body: undefined as any, setHeader() {},
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
    end() { return this; },
  };
  return { req, res };
}

const snsSwitchBody = {
  listingId: 'listing1', dc: 'Elemental', server: 'Carbuncle', area: 'Mist', ward: 5, plot: 12,
  buildingType: 'house', size: 'S', tags: [], visibility: 'public', imageMode: 'sns',
  postUrl: 'https://x.com/user/status/1234567890123', ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
  tweetId: '1234567890123',
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(async () => ({ ok: true }) as Response) as unknown as typeof fetch;
});

const payloadOf = () => h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
const expectColorsDropped = () => {
  expect(payloadOf().colorFamilies).toBe('__DELETE__');
  expect(payloadOf().colorRule).toBe('__DELETE__');
};
const expectColorsUntouched = () => {
  expect('colorFamilies' in payloadOf()).toBe(false);
  expect('colorRule' in payloadOf()).toBe(false);
};

describe('代表の写真が変わる処理で、古い色(colorFamilies / colorRule)を失効する', () => {
  it('update-listing: thumbnail から sns への切替', async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', imageMode: 'thumbnail' };
    const { req, res } = makeReqRes(snsSwitchBody);
    await updateHandler(req, res);
    expect(res.statusCode).toBe(200);
    expectColorsDropped();
  });
  it('update-listing: sns の中で取り込み元の画像が変わる', async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', imageMode: 'sns', ogImageUrl: 'https://pbs.twimg.com/media/OLD.jpg' };
    const { req, res } = makeReqRes(snsSwitchBody);
    await updateHandler(req, res);
    expect(res.statusCode).toBe(200);
    expectColorsDropped();
  });
  it('update-listing: sns で画像が同じなら色に触れない', async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', imageMode: 'sns', ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg' };
    const { req, res } = makeReqRes(snsSwitchBody);
    await updateHandler(req, res);
    expect(res.statusCode).toBe(200);
    expectColorsUntouched();
  });
  it('delete-thumbnail: 先頭を削除すると失効、2枚目なら触れない', async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', thumbnailPaths: ['a', 'b', 'c'] };
    await deleteHandler(makeReqRes({ listingId: 'listing1', index: 0 }).req, makeReqRes({}).res);
    expectColorsDropped();
    h.txUpdateSpy.mockClear();
    await deleteHandler(makeReqRes({ listingId: 'listing1', index: 1 }).req, makeReqRes({}).res);
    expectColorsUntouched();
  });
  it('reorder-thumbnails: 先頭が変わると失効、保つなら触れない', async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', thumbnailPaths: ['a', 'b', 'c'] };
    await reorderHandler(makeReqRes({ listingId: 'listing1', newOrder: ['b', 'a', 'c'] }).req, makeReqRes({}).res);
    expectColorsDropped();
    h.txUpdateSpy.mockClear();
    await reorderHandler(makeReqRes({ listingId: 'listing1', newOrder: ['a', 'c', 'b'] }).req, makeReqRes({}).res);
    expectColorsUntouched();
  });
  it('delete-source-image: 先頭を削除すると失効、2枚目なら触れない', async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', imageMode: 'sns', sourceImageUrls: ['a', 'b', 'c'] };
    await deleteSourceHandler(makeReqRes({ listingId: 'listing1', index: 0 }).req, makeReqRes({}).res);
    expectColorsDropped();
    h.txUpdateSpy.mockClear();
    await deleteSourceHandler(makeReqRes({ listingId: 'listing1', index: 1 }).req, makeReqRes({}).res);
    expectColorsUntouched();
  });
  it('reorder-source-images: 先頭が変わると失効、保つなら触れない', async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', imageMode: 'sns', sourceImageUrls: ['a', 'b', 'c'] };
    await reorderSourceHandler(makeReqRes({ listingId: 'listing1', newOrder: ['b', 'a', 'c'] }).req, makeReqRes({}).res);
    expectColorsDropped();
    h.txUpdateSpy.mockClear();
    await reorderSourceHandler(makeReqRes({ listingId: 'listing1', newOrder: ['a', 'c', 'b'] }).req, makeReqRes({}).res);
    expectColorsUntouched();
  });
});
