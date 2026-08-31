import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- 依存の mock (module 境界で差し替える。firebase-admin の内部は触らない) ---
// vi.mock ファクトリから参照するスパイ/状態は vi.hoisted に集約する
// (vitest 4 の巻き上げ規則に対して最も堅牢)。
const h = vi.hoisted(() => {
  const saveSpy = vi.fn(async () => {});
  const deleteSpy = vi.fn(async () => {});
  const filePaths: string[] = [];
  const bucketMock = {
    file: vi.fn((p: string) => {
      filePaths.push(p);
      return { save: saveSpy, delete: deleteSpy, exists: vi.fn(async () => [false] as [boolean]) };
    }),
  };
  const resizeToWebpMock = vi.fn(async (_buf: unknown, w: number) => Buffer.from(`webp-${w}`));
  const convertToPngIfNeededMock = vi.fn(async () => Buffer.from('png-sibling'));
  const computeCoverThumbHashMock = vi.fn(async () => 'HASH64' as string | null);
  const txUpdateSpy = vi.fn();
  const bumpPublicVersionTxMock = vi.fn();
  // beforeEach で差し替える per-test 状態
  const state = { listingData: {} as Record<string, unknown> };
  const listingRef = {
    get: vi.fn(async () => ({ exists: true, data: () => state.listingData })),
  };
  const fakeDb = {
    collection: vi.fn(() => ({ doc: vi.fn(() => listingRef) })),
    doc: vi.fn(() => ({})),
    runTransaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        get: vi.fn(async () => ({ exists: true, data: () => state.listingData })),
        set: vi.fn(),
        update: txUpdateSpy,
      }),
    ),
  };
  return {
    saveSpy,
    deleteSpy,
    filePaths,
    bucketMock,
    resizeToWebpMock,
    convertToPngIfNeededMock,
    computeCoverThumbHashMock,
    txUpdateSpy,
    bumpPublicVersionTxMock,
    state,
    fakeDb,
  };
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
  getStorage: vi.fn(() => ({ bucket: vi.fn(() => h.bucketMock) })),
}));
// FieldValue.delete() は単純なセンチネルで十分 (ハンドラは値の識別だけする)。
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { delete: () => '__DELETE__', increment: () => '__INCREMENT__' },
}));
vi.mock('../_publicVersion.js', () => ({
  bumpPublicVersionTx: h.bumpPublicVersionTxMock,
  bumpPublicVersionBatch: vi.fn(),
  bumpPublicVersionDirect: vi.fn(async () => {}),
}));
// Task 5 の派生生成ヘルパー: resizeToWebp を制御可能な vi.fn にする。
vi.mock('../_imageFormatConvert.js', () => ({
  resizeToWebp: h.resizeToWebpMock,
  convertToPngIfNeeded: h.convertToPngIfNeededMock,
  LISTING_THUMBNAIL_PNG_MAX_DIMENSION: 480,
}));
vi.mock('../_coverThumbHash.js', () => ({
  computeCoverThumbHash: h.computeCoverThumbHashMock,
}));
// ../_imageArrayLogic.js は純関数なので REAL のまま
// (toDerivativePath / toPngSiblingPath / buildHousingImagePublicUrl / HOUSING_CARD_DERIVATIVE_WIDTHS)。

import handler from '../_uploadThumbnailHandler.js';

const B64 = Buffer.from('pretend-image-bytes').toString('base64');

function makeBody(index?: number) {
  return {
    listingId: 'listing1',
    base64: B64,
    mimeType: 'image/webp',
    ...(index === undefined ? {} : { index }),
  };
}

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

beforeEach(() => {
  vi.clearAllMocks();
  h.filePaths.length = 0;
  h.state.listingData = { ownerUid: 'hashed:user1', thumbnailPaths: [], imageMode: 'thumbnail' };
  h.resizeToWebpMock.mockReset().mockImplementation(async (_b: unknown, w: number) => Buffer.from(`webp-${w}`));
  h.convertToPngIfNeededMock.mockReset().mockImplementation(async () => Buffer.from('png-sibling'));
  h.computeCoverThumbHashMock.mockReset().mockImplementation(async () => 'HASH64');
});

describe('_uploadThumbnailHandler の派生生成 + coverThumbHash 保存', () => {
  it('アップロード成功で 480/960/1440 webp と png 兄弟が Storage に save される', async () => {
    const { req, res } = makeReqRes(makeBody(0));
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const paths = h.bucketMock.file.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/-480\.webp$/),
        expect.stringMatching(/-960\.webp$/),
        expect.stringMatching(/-1440\.webp$/),
        expect.stringMatching(/\.png$/),
      ]),
    );
  });

  it('派生生成 (resizeToWebp) が throw したらアップロードは 500 derivative_generation_failed', async () => {
    h.resizeToWebpMock.mockRejectedValueOnce(new Error('sharp boom'));
    const { req, res } = makeReqRes(makeBody(0));
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('derivative_generation_failed');
  });

  it('imageIndex=0 のとき Firestore の tx.update に coverThumbHash が入る', async () => {
    h.computeCoverThumbHashMock.mockResolvedValueOnce('HASH64');
    const { req, res } = makeReqRes(makeBody(0));
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updateArg = h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(updateArg.coverThumbHash).toBe('HASH64');
  });

  it('imageIndex=0 で ThumbHash 計算が null を返したら coverThumbHash を delete する', async () => {
    h.computeCoverThumbHashMock.mockResolvedValueOnce(null);
    const { req, res } = makeReqRes(makeBody(0));
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updateArg = h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(updateArg.coverThumbHash).toBe('__DELETE__');
  });

  it('imageIndex=2 のとき coverThumbHash は touch しない', async () => {
    const { req, res } = makeReqRes(makeBody(2));
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updateArg = h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
    expect('coverThumbHash' in updateArg).toBe(false);
    expect(h.computeCoverThumbHashMock).not.toHaveBeenCalled();
  });
});
