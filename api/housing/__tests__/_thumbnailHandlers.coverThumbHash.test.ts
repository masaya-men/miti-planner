import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
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

// plot 12 / Mist は区画サイズ 'S'。thumbnail→sns 切替に必要な最小の有効 body。
const snsSwitchBody = {
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

beforeEach(() => {
  vi.clearAllMocks();
  h.state.storedData = { ownerUid: 'hashed:user1', imageMode: 'thumbnail' };
  // warmListingCard 経由の実ネットワーク fetch を防ぐ (storedData に代表画像が無いので
  // 実際には呼ばれないが、保険として stub しておく)。
  global.fetch = vi.fn(async () => ({ ok: true }) as Response) as unknown as typeof fetch;
});

describe('_updateListingHandler: thumbnail→sns 切替で coverThumbHash を失効', () => {
  it('切替成功時、tx.update の payload に coverThumbHash = delete sentinel が入る', async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', imageMode: 'thumbnail' };
    const { req, res } = makeReqRes(snsSwitchBody);
    await updateHandler(req, res);

    expect(res.statusCode).toBe(200);
    const payload = h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.coverThumbHash).toBe('__DELETE__');
    // 既存挙動 (thumbnailPaths / thumbnailPath も delete) が保たれていること
    expect(payload.thumbnailPaths).toBe('__DELETE__');
    expect(payload.thumbnailPath).toBe('__DELETE__');
  });
});

describe('_deleteThumbnailHandler: 代表画像が変わったときだけ coverThumbHash を失効', () => {
  it("index 0 (['a','b','c']) を削除 → coverThumbHash = delete sentinel", async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', thumbnailPaths: ['a', 'b', 'c'] };
    const { req, res } = makeReqRes({ listingId: 'listing1', index: 0 });
    await deleteHandler(req, res);

    expect(res.statusCode).toBe(200);
    const payload = h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.coverThumbHash).toBe('__DELETE__');
    expect(payload.thumbnailPaths).toEqual(['b', 'c']);
  });

  it("index 1 (['a','b','c']) を削除 → coverThumbHash には触れない", async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', thumbnailPaths: ['a', 'b', 'c'] };
    const { req, res } = makeReqRes({ listingId: 'listing1', index: 1 });
    await deleteHandler(req, res);

    expect(res.statusCode).toBe(200);
    const payload = h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
    expect('coverThumbHash' in payload).toBe(false);
    expect(payload.thumbnailPaths).toEqual(['a', 'c']);
  });
});

describe('_reorderThumbnailsHandler: 先頭 URL が変わったときだけ coverThumbHash を失効', () => {
  it("['a','b','c'] → ['b','a','c'] (先頭が変わる) → coverThumbHash = delete sentinel", async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', thumbnailPaths: ['a', 'b', 'c'] };
    const { req, res } = makeReqRes({ listingId: 'listing1', newOrder: ['b', 'a', 'c'] });
    await reorderHandler(req, res);

    expect(res.statusCode).toBe(200);
    const payload = h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.coverThumbHash).toBe('__DELETE__');
    expect(payload.thumbnailPaths).toEqual(['b', 'a', 'c']);
  });

  it("['a','b','c'] → ['a','c','b'] (先頭を保つ) → coverThumbHash には触れない", async () => {
    h.state.storedData = { ownerUid: 'hashed:user1', thumbnailPaths: ['a', 'b', 'c'] };
    const { req, res } = makeReqRes({ listingId: 'listing1', newOrder: ['a', 'c', 'b'] });
    await reorderHandler(req, res);

    expect(res.statusCode).toBe(200);
    const payload = h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
    expect('coverThumbHash' in payload).toBe(false);
    expect(payload.thumbnailPaths).toEqual(['a', 'c', 'b']);
  });
});

describe('画像ミューテーション後の OGカード事前生成 (warmListingCard の配線)', () => {
  const thumbListing = {
    ownerUid: 'hashed:user1',
    imageMode: 'thumbnail',
    thumbnailPaths: [
      'https://lopoly.app/housing-media/listing1/a.png',
      'https://lopoly.app/housing-media/listing1/b.png',
    ],
  };

  it('delete-thumbnail 後、更新後 doc に代表画像があれば og_image_meta.set + /og/<hash>.png fetch が走り 200', async () => {
    h.state.storedData = { ...thumbListing };
    const { req, res } = makeReqRes({ listingId: 'listing1', index: 1 });
    await deleteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(h.ogMetaSetSpy).toHaveBeenCalledTimes(1);
    const ogFetch = (global.fetch as any).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('/og/'),
    );
    expect(ogFetch?.[0]).toMatch(/^https:\/\/lopoly\.app\/og\/[a-f0-9]{16}\.png$/);
  });

  it('reorder-thumbnails 後も同様に warm が走り 200', async () => {
    h.state.storedData = { ...thumbListing };
    const { req, res } = makeReqRes({
      listingId: 'listing1',
      newOrder: [
        'https://lopoly.app/housing-media/listing1/b.png',
        'https://lopoly.app/housing-media/listing1/a.png',
      ],
    });
    await reorderHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(h.ogMetaSetSpy).toHaveBeenCalledTimes(1);
  });

  it('warm (og_image_meta.set) が失敗しても delete-thumbnail は 200 のまま', async () => {
    h.state.storedData = { ...thumbListing };
    h.ogMetaSetSpy.mockRejectedValueOnce(new Error('firestore down'));
    const { req, res } = makeReqRes({ listingId: 'listing1', index: 1 });
    await deleteHandler(req, res);

    expect(res.statusCode).toBe(200);
  });
});
