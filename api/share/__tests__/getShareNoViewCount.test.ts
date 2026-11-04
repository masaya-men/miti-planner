import { describe, it, expect, vi } from 'vitest';

// 共有の閲覧数の加算(viewers サブコレクションの get + batch 書き込み)は撤去済み(11-05 持ち主承認)。
// GET は共有本体を 1 回読むだけで、書き込みをしないことを守る。
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: async () => true }));
vi.mock('../../../src/lib/publicApiGuard.js', () => ({ rejectIfPublicApiDisabled: () => false }));

import { getShare } from '../_getShare.js';

function createRes() {
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
    end() { return this; },
  };
  return res;
}

function createDb() {
  const subCollection = vi.fn();
  const docGet = vi.fn().mockResolvedValue({ exists: true, data: () => ({ title: 't', viewCount: 3 }) });
  const batch = vi.fn();
  const db: any = {
    collection: () => ({ doc: () => ({ get: docGet, collection: subCollection }) }),
    batch,
  };
  return { db, docGet, subCollection, batch };
}

describe('GET /api/share は閲覧数を数えない', () => {
  it('viewers を読まず batch 書き込みもしない', async () => {
    const { db, docGet, subCollection, batch } = createDb();
    const req: any = { method: 'GET', headers: { 'x-forwarded-for': '203.0.113.1' }, query: { id: 'abc' } };
    const res = createRes();
    await getShare(req, res, db);
    expect(res.statusCode).toBe(200);
    expect(docGet).toHaveBeenCalledTimes(1);
    expect(subCollection).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  it('共有の応答にキャッシュは足さない(管理画面での非表示の反映を遅らせない)', async () => {
    const { db } = createDb();
    const req: any = { method: 'GET', headers: {}, query: { id: 'abc' } };
    const res = createRes();
    await getShare(req, res, db);
    expect(res.headers['Cache-Control']).toBeUndefined();
  });
});
