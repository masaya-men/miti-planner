import { describe, it, expect, vi, beforeEach } from 'vitest';

// 色の取り直し(管理画面): 管理者のみ・まとめて書く・final:false では版を進めない・final:true で 1 回だけ進める
const h = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  bump: vi.fn(async () => {}),
  rotate: vi.fn(async () => {}),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(async () => {}),
  docs: {} as Record<string, Record<string, unknown> | null>,
}));

const fakeDb = {
  collection: () => ({ doc: (id: string) => ({ id }) }),
  getAll: async (...refs: { id: string }[]) =>
    refs.map((r) => ({ id: r.id, exists: !!h.docs[r.id], data: () => h.docs[r.id] })),
  batch: () => ({ update: h.batchUpdate, commit: h.batchCommit }),
};

vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: vi.fn(),
  verifyAdmin: h.verifyAdmin,
  getAdminFirestore: () => fakeDb,
}));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));
vi.mock('../../housing/_publicVersion.js', () => ({ bumpPublicVersionDirect: h.bump }));

import handler from '../_housingColorsHandler.js';
import { PALETTE_RULE } from '../../../src/lib/housing/color/housingExtractPalette.js';

function call(body: unknown, method = 'PATCH') {
  const req: any = { method, headers: { origin: 'https://lopoly.app' }, query: { resource: 'housing_colors' }, body };
  const res: any = {
    statusCode: 0, body: undefined as any, setHeader() {},
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
    end() { return this; },
  };
  return handler(req, res).then(() => res);
}
const item = (id: string, fam: string[] = ['red']) => ({ id, colorFamilies: fam, colorRule: PALETTE_RULE });

beforeEach(() => {
  vi.clearAllMocks();
  h.verifyAdmin.mockResolvedValue('admin1');
  h.docs = { a: { ownerUid: 'u' }, b: { ownerUid: 'u' }, gone: { deletedAt: 1 }, missing: null };
});

describe('PATCH housing_colors', () => {
  it('管理者以外は 401 で何も書かない', async () => {
    h.verifyAdmin.mockResolvedValue(null);
    const res = await call({ items: [item('a')], final: false });
    expect(res.statusCode).toBe(401);
    expect(h.batchUpdate).not.toHaveBeenCalled();
  });
  it('PATCH 以外は 405', async () => {
    expect((await call({}, 'GET')).statusCode).toBe(405);
  });
  it('final:false は書くだけで、版を進めない', async () => {
    const res = await call({ items: [item('a'), item('b', [])], final: false });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ written: 2, rejected: [] });
    expect(h.batchUpdate).toHaveBeenCalledTimes(2);
    expect(h.batchCommit).toHaveBeenCalledTimes(1);
    expect(h.bump).not.toHaveBeenCalled();
  });
  it('final:true は版と全件作り直しを 1 回だけ', async () => {
    const res = await call({ items: [item('a')], final: true });
    expect(res.statusCode).toBe(200);
    expect(h.bump).toHaveBeenCalledTimes(1);
  });
  it('items 無しの final:true だけでも版が進む(最後の「反映する」)', async () => {
    const res = await call({ items: [], final: true });
    expect(res.statusCode).toBe(200);
    expect(h.batchUpdate).not.toHaveBeenCalled();
    expect(h.bump).toHaveBeenCalledTimes(1);
  });
  it('不正な値・存在しない家・削除済みの家は書かずに rejected に出す', async () => {
    const res = await call({
      items: [item('a'), item('b', ['magenta']), item('gone'), item('missing'), { id: 'a', colorFamilies: ['red'], colorRule: PALETTE_RULE - 1 }],
      final: false,
    });
    expect(res.body.written).toBe(1);
    expect(res.body.rejected.map((r: { id: string }) => r.id).sort()).toEqual(['a', 'b', 'gone', 'missing']);
    expect(h.batchUpdate).toHaveBeenCalledTimes(1);
  });
  it('1 回に多すぎる件数は 400', async () => {
    const items = Array.from({ length: 101 }, (_, i) => item(`x${i}`));
    expect((await call({ items, final: false })).statusCode).toBe(400);
  });
  it('本文の形が違えば 400', async () => {
    expect((await call({ items: 'x', final: false })).statusCode).toBe(400);
    expect((await call(undefined)).statusCode).toBe(400);
  });
});
