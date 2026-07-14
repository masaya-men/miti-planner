import { describe, it, expect, vi } from 'vitest';

// _publicTemplateHandler は Admin SDK (adminAuth.js 経由) に依存する。
// 404 分岐 (未知 id) の検証のため、db.collection().doc().get() が exists:false を返す
// 最小スタブに差し替える。initAdmin は no-op。
vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: () => {},
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false }),
      }),
    }),
  }),
}));

import handler, { CONTENT_ID_RE } from '../_publicTemplateHandler.js';

function createRes() {
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    end() {
      return this;
    },
  };
  return res;
}

describe('CONTENT_ID_RE', () => {
  it('英数字・アンダースコア・ハイフンの1〜40文字を許可する', () => {
    expect(CONTENT_ID_RE.test('m9s')).toBe(true);
    expect(CONTENT_ID_RE.test('my_content-01')).toBe(true);
  });

  it('空文字・不正な記号・41文字以上は拒否する', () => {
    expect(CONTENT_ID_RE.test('')).toBe(false);
    expect(CONTENT_ID_RE.test('../../etc/passwd')).toBe(false);
    expect(CONTENT_ID_RE.test('a'.repeat(41))).toBe(false);
  });
});

describe('public-template ハンドラー', () => {
  it('不正な id は 400', async () => {
    const req: any = { method: 'GET', headers: {}, query: { id: '不正id!!' } };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid id' });
  });

  it('id 未指定も 400', async () => {
    const req: any = { method: 'GET', headers: {}, query: {} };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid id' });
  });

  it('未知の id は 404 (Admin SDK get が exists:false)', async () => {
    const req: any = { method: 'GET', headers: {}, query: { id: 'unknown-content' } };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('OPTIONS は 200 で終了する', async () => {
    const req: any = { method: 'OPTIONS', headers: {}, query: {} };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('GET 以外 (POST) は 405', async () => {
    const req: any = { method: 'POST', headers: {}, query: {} };
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
