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

import { buildListingSeoSnapshotHtml } from '../_listingPageHandler.js';
import handler from '../_listingPageHandler.js';

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

describe('buildListingSeoSnapshotHtml', () => {
  it('タイトル・住所・説明からスナップショットHTMLを組み立てる', () => {
    const html = buildListingSeoSnapshotHtml({
      title: '海が見える家',
      addressText: 'ミスト・ヴィレッジ 23-6',
      description: '内装こだわってます',
    });
    expect(html).toBe('<h1>海が見える家</h1><p>ミスト・ヴィレッジ 23-6</p><p>内装こだわってます</p>');
  });

  it('addressTextがnull (unlisted) なら住所の<p>を出さない', () => {
    const html = buildListingSeoSnapshotHtml({ title: '海が見える家', addressText: null, description: '' });
    expect(html).toBe('<h1>海が見える家</h1>');
  });

  it('descriptionが140文字を超えたら140文字+…に切り詰める', () => {
    const longDesc = 'あ'.repeat(200);
    const html = buildListingSeoSnapshotHtml({ title: 'x', addressText: null, description: longDesc });
    expect(html).toBe(`<h1>x</h1><p>${'あ'.repeat(140)}…</p>`);
  });

  it('HTML特殊文字をエスケープする', () => {
    const html = buildListingSeoSnapshotHtml({ title: '<b>x</b>', addressText: '"a"', description: '' });
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt;</h1><p>&quot;a&quot;</p>');
  });
});

describe('_listingPageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Firestore取得失敗時は404を強制せず200を返す（transient エラー対策）', async () => {
    const { req, res } = makeReqRes({ query: { id: 'test-listing-id' } });

    // Firestore.get() を意図的に失敗させる（実在する物件でも一時的なエラーで404キャッシュされないことを確認）
    mockGetFn.mockRejectedValueOnce(new Error('Firestore connection failed'));

    // fetch をモック（index.html は取得できないと仮定）
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    await handler(req, res);

    // Firestore 取得失敗でも HTTP 200 を返す（graceful degradation、24時間キャッシュされる404を防ぐ）
    expect(res.statusCode).toBe(200);
  });

  it('物件IDが存在しない場合は404を返す', async () => {
    const { req, res } = makeReqRes({ query: { id: 'nonexistent-id' } });

    mockGetFn.mockResolvedValueOnce({ exists: false });

    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });
});
