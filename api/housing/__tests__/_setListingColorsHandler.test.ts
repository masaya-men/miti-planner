import { describe, it, expect, vi, beforeEach } from 'vitest';

// 色で探す: set-listing-colors(家主のみ・検証して保存・版を進める・差分に積む)
const h = vi.hoisted(() => {
  const txUpdateSpy = vi.fn();
  const state = { stored: null as Record<string, unknown> | null };
  const fakeDb = {
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ id: 'listing1' })) })),
    doc: vi.fn(() => ({})),
    runTransaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        get: vi.fn(async () => ({ exists: state.stored !== null, data: () => state.stored })),
        update: txUpdateSpy,
      }),
    ),
  };
  return { txUpdateSpy, state, fakeDb, bump: vi.fn(), record: vi.fn(async () => {}) };
});

vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('../../../src/lib/adminAuth.js', () => ({ initAdmin: vi.fn(), getAdminFirestore: vi.fn(() => h.fakeDb) }));
vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: vi.fn(async () => ({ uid: 'hashed:user1' })) })),
}));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => '__DELETE__' } }));
vi.mock('../_publicVersion.js', () => ({ bumpPublicVersionTx: h.bump }));

import handler from '../_setListingColorsHandler.js';
import { PALETTE_RULE } from '../../../src/lib/housing/color/housingExtractPalette.js';

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
const ok = { listingId: 'listing1', colorFamilies: ['red', 'white'], colorRule: PALETTE_RULE };

beforeEach(() => {
  vi.clearAllMocks();
  h.state.stored = { ownerUid: 'hashed:user1' };
});

describe('set-listing-colors', () => {
  it('家主なら保存し、版を進めて差分に積む', async () => {
    const { req, res } = makeReqRes(ok);
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(h.txUpdateSpy.mock.calls[0][1]).toMatchObject({ colorFamilies: ['red', 'white'], colorRule: PALETTE_RULE });
    expect(h.bump).toHaveBeenCalledTimes(1);
  });
  it('空配列(どの色にも当てはまらない)も保存できる', async () => {
    const { req, res } = makeReqRes({ ...ok, colorFamilies: [] });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
  it('家主以外は 403', async () => {
    h.state.stored = { ownerUid: 'hashed:other' };
    const { req, res } = makeReqRes(ok);
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(h.txUpdateSpy).not.toHaveBeenCalled();
  });
  it('削除済み・存在しない家は 404', async () => {
    h.state.stored = { ownerUid: 'hashed:user1', deletedAt: 1 };
    const a = makeReqRes(ok);
    await handler(a.req, a.res);
    expect(a.res.statusCode).toBe(404);
    h.state.stored = null;
    const b = makeReqRes(ok);
    await handler(b.req, b.res);
    expect(b.res.statusCode).toBe(404);
  });
  it('許可外の値は 400 で保存しない', async () => {
    for (const bad of [
      { ...ok, colorFamilies: ['magenta'] },
      { ...ok, colorFamilies: ['red', 'blue', 'green', 'pink'] },
      { ...ok, colorFamilies: ['red', 'red'] },
      { ...ok, colorRule: PALETTE_RULE + 1 },
      { listingId: 'listing1' },
    ]) {
      const { req, res } = makeReqRes(bad);
      await handler(req, res);
      expect(res.statusCode).toBe(400);
    }
    expect(h.txUpdateSpy).not.toHaveBeenCalled();
  });
  it('listingId が無ければ 400', async () => {
    const { req, res } = makeReqRes({ colorFamilies: [], colorRule: PALETTE_RULE });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
