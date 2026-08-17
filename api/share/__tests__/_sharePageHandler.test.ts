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

vi.mock('../../src/lib/ogpHelpers.js', () => ({
  getContentName: vi.fn(() => null),
  buildOgImageUrl: vi.fn(() => '/api/og'),
}));

vi.mock('../../src/lib/ogpPageShell.js', () => ({
  escapeHtml: (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  injectSeoSnapshot: vi.fn((html: string) => html),
}));

import { buildSharePageSeoSnapshotHtml } from '../_sharePageHandler.js';
import handler from '../_sharePageHandler.js';

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

describe('buildSharePageSeoSnapshotHtml', () => {
  it('タイトルと説明からスナップショットHTMLを組み立てる', () => {
    const html = buildSharePageSeoSnapshotHtml('アルカディア零式 - LoPo', '4層の軽減プラン');
    expect(html).toBe('<h1>アルカディア零式 - LoPo</h1><p>4層の軽減プラン</p>');
  });

  it('HTML特殊文字をエスケープする', () => {
    const html = buildSharePageSeoSnapshotHtml('<b>x</b>', '"quote"');
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt;</h1><p>&quot;quote&quot;</p>');
  });
});

describe('_sharePageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Firestore取得失敗時は404を強制せず200を返す（既存プランの誤404防止）', async () => {
    const { req, res } = makeReqRes({ query: { id: 'test-share-id' } });

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

  it('共有IDが存在しない場合は404を返す', async () => {
    const { req, res } = makeReqRes({ query: { id: 'nonexistent-id' } });

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
