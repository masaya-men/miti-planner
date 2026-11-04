import { describe, it, expect, vi } from 'vitest';

// _publicNotificationsHandler は Admin SDK (adminAuth.js 経由) に依存する。
// where().orderBy().limit().get() が空の snapshot を返す最小スタブに差し替える。
vi.mock('../../../src/lib/adminAuth.js', () => {
  const chain: any = {
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    get: async () => ({ docs: [] }),
  };
  return {
    initAdmin: () => {},
    getAdminFirestore: () => ({ collection: () => chain }),
  };
});
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: async () => true }));
vi.mock('../../../src/lib/publicApiGuard.js', () => ({ rejectIfPublicApiDisabled: () => false }));

import handler from '../_publicNotificationsHandler.js';

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

describe('public-notifications ハンドラー', () => {
  it('Cache-Control は public, max-age=3600', async () => {
    const req: any = { method: 'GET', headers: {}, query: {} };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('public, max-age=3600');
  });
});
