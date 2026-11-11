import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PALETTE_RULE } from '../../../src/lib/housing/color/housingExtractPalette.js';

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
  const ogMetaSetSpy = vi.fn(async () => {});
  // beforeEach で差し替える per-test 状態
  const state = { listingData: {} as Record<string, unknown> };
  const listingRef = {
    get: vi.fn(async () => ({ exists: true, data: () => state.listingData })),
  };
  const fakeDb = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn(() => (name === 'og_image_meta' ? { set: ogMetaSetSpy } : listingRef)),
    })),
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
    ogMetaSetSpy,
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
  CONVERTIBLE_MIME: new Set(['image/webp', 'image/avif']),
}));
vi.mock('../_coverThumbHash.js', () => ({
  computeCoverThumbHash: h.computeCoverThumbHashMock,
}));
// ../_imageArrayLogic.js は純関数なので REAL のまま
// (toDerivativePath / toPngSiblingPath / buildHousingImagePublicUrl / HOUSING_CARD_DERIVATIVE_WIDTHS)。

import handler from '../_uploadThumbnailHandler.js';

// 先頭バイトが WebP (RIFF....WEBP) の最小フィクスチャ (中身検査を通すため)
const B64 = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPpretend')]).toString('base64');

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

const fetchMock = vi.fn<(url?: unknown, init?: unknown) => Promise<Response>>(async () => ({ ok: true }) as Response);

beforeEach(() => {
  vi.clearAllMocks();
  h.filePaths.length = 0;
  h.state.listingData = { ownerUid: 'hashed:user1', thumbnailPaths: [], imageMode: 'thumbnail' };
  h.resizeToWebpMock.mockReset().mockImplementation(async (_b: unknown, w: number) => Buffer.from(`webp-${w}`));
  h.convertToPngIfNeededMock.mockReset().mockImplementation(async () => Buffer.from('png-sibling'));
  h.computeCoverThumbHashMock.mockReset().mockImplementation(async () => 'HASH64');
  h.ogMetaSetSpy.mockReset().mockImplementation(() => Promise.resolve());
  fetchMock.mockReset().mockImplementation(async () => ({ ok: true }) as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
});


const payloadOf = () => h.txUpdateSpy.mock.calls[0][1] as Record<string, unknown>;
const colors = { colorFamilies: ['green', 'beige'], colorRule: PALETTE_RULE };

describe('upload-thumbnail: 代表(index 0)の差し替えで色が入れ替わる(色で探す)', () => {
  it('index 0 に正しい色が同梱されたら、その色を保存する', async () => {
    const { req, res } = makeReqRes({ ...makeBody(0), ...colors });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(payloadOf().colorFamilies).toEqual(['green', 'beige']);
    expect(payloadOf().colorRule).toBe(PALETTE_RULE);
  });
  it('index 0 で色が同梱されない/不正なら、古い色を失効する', async () => {
    for (const extra of [{}, { colorFamilies: ['magenta'], colorRule: PALETTE_RULE }, { colorFamilies: ['red'], colorRule: PALETTE_RULE - 1 }]) {
      h.txUpdateSpy.mockClear();
      const { req, res } = makeReqRes({ ...makeBody(0), ...extra });
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(payloadOf().colorFamilies).toBe('__DELETE__');
      expect(payloadOf().colorRule).toBe('__DELETE__');
    }
  });
  it('index 1 以降は色に触れない(同梱されていても無視)', async () => {
    h.state.listingData = { ownerUid: 'hashed:user1', thumbnailPaths: ['https://lopoly.app/housing-media/listing1/a.webp'], imageMode: 'thumbnail' };
    const { req, res } = makeReqRes({ ...makeBody(1), ...colors });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect('colorFamilies' in payloadOf()).toBe(false);
    expect('colorRule' in payloadOf()).toBe(false);
  });
});
