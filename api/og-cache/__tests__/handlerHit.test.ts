import { describe, it, expect, vi, beforeEach } from 'vitest';

// og-cache の HIT 経路: getMetadata 1 往復で「有るか」と前回の lastAccessedAt を取り、
// 24 時間未満なら setMetadata(書き込み)しない。
const file = {
  exists: vi.fn(),
  getMetadata: vi.fn(),
  download: vi.fn(),
  setMetadata: vi.fn(),
  save: vi.fn(),
};
const metaGet = vi.fn();

vi.mock('../../../src/lib/adminAuth.js', () => ({ initAdmin: () => {} }));
vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({ bucket: () => ({ file: () => file }) }),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: () => ({ doc: () => ({ get: metaGet }) }) }),
}));

import handler from '../index.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

function createRes() {
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
    send(payload: any) { this.body = payload; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
    end() { return this; },
  };
  return res;
}

const req: any = { method: 'GET', headers: { host: 'lopoly.app' }, query: { h: '0123456789abcdef' } };

describe('og-cache HIT', () => {
  beforeEach(() => {
    for (const fn of Object.values(file)) fn.mockReset();
    metaGet.mockReset();
    file.download.mockResolvedValue([JPEG]);
    file.setMetadata.mockResolvedValue([{}]);
  });

  it('lastAccessedAt が新しい HIT は setMetadata しない', async () => {
    file.getMetadata.mockResolvedValue([{ metadata: { lastAccessedAt: String(Date.now() - 60_000) } }]);
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['X-OG-Cache']).toBe('HIT');
    expect(res.headers['Content-Type']).toBe('image/jpeg');
    expect(file.setMetadata).toHaveBeenCalledTimes(0);
    expect(file.exists).not.toHaveBeenCalled();
  });

  it('古い HIT は setMetadata する', async () => {
    file.getMetadata.mockResolvedValue([{ metadata: { lastAccessedAt: String(Date.now() - 25 * 60 * 60 * 1000) } }]);
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(file.setMetadata).toHaveBeenCalledTimes(1);
  });

  it('getMetadata が 404 なら MISS 経路へ進む', async () => {
    file.getMetadata.mockRejectedValue(Object.assign(new Error('No such object'), { code: 404 }));
    metaGet.mockResolvedValue({ exists: false });
    const res = createRes();
    await handler(req, res);
    expect(metaGet).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('getMetadata が 404 以外で失敗したら 500', async () => {
    file.getMetadata.mockRejectedValue(Object.assign(new Error('boom'), { code: 503 }));
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(metaGet).not.toHaveBeenCalled();
  });
});
