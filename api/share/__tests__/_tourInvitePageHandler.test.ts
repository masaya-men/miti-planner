import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firebase Admin のモック（Firestore 取得失敗をシミュレート）
let mockGetFn: any = vi.fn();

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  cert: vi.fn((config) => config),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGetFn,
      })),
    })),
  })),
}));

vi.mock('../../src/lib/ogpPageShell.js', () => ({
  escapeHtml: (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  injectSeoSnapshot: vi.fn((html: string) => html),
}));

vi.mock('../../src/lib/ogpTourInviteCard.js', () => ({
  buildTourInviteOgCardParams: vi.fn(() => ({})),
}));

vi.mock('../../src/lib/ogpImageHash.js', () => ({
  computeOgCardImageHash: vi.fn(() => 'test-hash'),
}));

import { buildTourInviteSeoSnapshotHtml } from '../_tourInvitePageHandler.js';
import handler from '../_tourInvitePageHandler.js';

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

describe('buildTourInviteSeoSnapshotHtml', () => {
  it('ツアー名からスナップショットHTMLを組み立てる', () => {
    const html = buildTourInviteSeoSnapshotHtml('ミストお茶会ツアー');
    expect(html).toBe('<h1>ミストお茶会ツアー</h1><p>FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。</p>');
  });

  it('ツアー名が空なら既定タイトルにフォールバックする', () => {
    const html = buildTourInviteSeoSnapshotHtml('');
    expect(html).toBe('<h1>LoPo Housing Tour</h1><p>FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。</p>');
  });

  it('HTML特殊文字をエスケープする', () => {
    const html = buildTourInviteSeoSnapshotHtml('<b>x</b>');
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt;</h1><p>FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。</p>');
  });
});

describe('_tourInvitePageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Firestore取得失敗時は404を強制せず200を返す（transient エラー対策）', async () => {
    const { req, res } = makeReqRes({ query: { token: 'test-token' } });

    // Firestore.get() を意図的に失敗させる
    mockGetFn.mockRejectedValueOnce(new Error('Firestore connection failed'));

    // fetch をモック（index.html は取得できないと仮定）
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    await handler(req, res);

    // Firestore 取得失敗でも HTTP 200 を返す（graceful degradation）
    expect(res.statusCode).toBe(200);
  });

  it('ツアートークンが存在しない場合は404を返す', async () => {
    const { req, res } = makeReqRes({ query: { token: 'nonexistent-token' } });

    // Firestore.get() が成功するが、ドキュメントが存在しない
    mockGetFn.mockResolvedValueOnce({ exists: false });

    // fetch をモック（index.html は取得できないと仮定）
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    await handler(req, res);

    // ドキュメントが存在しないため HTTP 404 を返す
    expect(res.statusCode).toBe(404);
  });
});
