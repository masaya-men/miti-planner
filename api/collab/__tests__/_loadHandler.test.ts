import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApplyRateLimit, mockAuthorizeCollab, mockGetDb } = vi.hoisted(() => ({
  mockApplyRateLimit: vi.fn(async (..._args: any[]) => true),
  mockAuthorizeCollab: vi.fn((..._args: any[]) => true),
  mockGetDb: vi.fn(),
}));

vi.mock('../../../src/lib/rateLimit.js', () => ({
  applyRateLimit: mockApplyRateLimit,
}));

vi.mock('../_handlerShared.js', () => ({
  authorizeCollab: mockAuthorizeCollab,
  getDb: mockGetDb,
}));

import handler from '../_loadHandler.js';

function makeReqRes(overrides: Partial<{ method: string; headers: Record<string, string>; query: Record<string, string> }> = {}) {
  const req: any = { method: 'GET', headers: {}, query: {}, ...overrides };
  const res: any = { statusCode: 0, body: undefined, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return { req, res };
}

describe('_loadHandler レート制限', () => {
  beforeEach(() => {
    mockApplyRateLimit.mockClear();
    mockApplyRateLimit.mockResolvedValue(true);
    mockAuthorizeCollab.mockClear();
  });

  it('applyRateLimit が false を返したら 429 で即終了し、authorizeCollab を呼ばない', async () => {
    mockApplyRateLimit.mockImplementationOnce(async (_req, res) => {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return false;
    });
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(mockAuthorizeCollab).not.toHaveBeenCalled();
  });

  it('applyRateLimit が true なら従来どおり authorizeCollab のチェックへ進む(secret無しで401)', async () => {
    mockAuthorizeCollab.mockReturnValueOnce(false);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(mockApplyRateLimit).toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
