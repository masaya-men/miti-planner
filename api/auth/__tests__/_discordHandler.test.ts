import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/appCheckVerify.js', () => ({
  verifyAppCheck: vi.fn(async () => true),
}));

import handler from '../_discordHandler.js';

function makeReqRes(overrides: Partial<{ query: Record<string, unknown>; headers: Record<string, string> }> = {}) {
  const headers: Record<string, string> = { host: 'lopoly.app', ...(overrides.headers ?? {}) };
  const req: any = { method: 'GET', query: overrides.query ?? {}, headers, body: {} };
  const res: any = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(key: string, value: string) { this.headers[key] = value; },
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
    send(b: unknown) { this.body = b; return this; },
    end() { return this; },
  };
  return { req, res };
}

// 実機指摘(2026-08-12): Discordのキャンセル/失敗時に生JSONがブラウザにそのまま表示され、
// SPAの元いた画面に戻らなかった不具合。GETコールバックの失敗パスはHTMLリダイレクトを返すべき。
describe('_discordHandler GETコールバック 失敗時の画面遷移', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('キャンセル(code無し)は生JSONではなくSPAへ戻すHTMLを返す', async () => {
    const { req, res } = makeReqRes({ query: {} });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/html');
    expect(typeof res.body).toBe('string');
    expect(res.body).toContain('lopo_auth_return_url');
    expect(res.body).toContain('window.location.href');
    // ログイン成立とは違う: 失敗時は lopo_auth_pending を書かない。
    expect(res.body).not.toContain('lopo_auth_pending');
  });

  it('キャンセル時もstate cookieを片付ける', async () => {
    const { req, res } = makeReqRes({ query: {} });
    await handler(req, res);
    expect(res.headers['Set-Cookie']).toContain('discord_oauth_state=;');
  });

  it('state不一致も生JSONではなくSPAへ戻すHTMLを返す', async () => {
    const { req, res } = makeReqRes({
      query: { code: 'dummy-code', state: 'wrong-state' },
      headers: { host: 'lopoly.app', cookie: 'discord_oauth_state=correct-state' },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('lopo_auth_return_url');
    expect(res.body).not.toContain('lopo_auth_pending');
  });
});
