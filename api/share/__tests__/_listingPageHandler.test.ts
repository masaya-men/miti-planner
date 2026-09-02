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
        // ハンドラーは og_image_meta/{hash} へ内容ハッシュを書き込む(再ホストカードのメタ)。
        set: vi.fn(async () => undefined),
      })),
    })),
  })),
}));

// firebase-admin/storage: OGP カードが既にキャッシュ済みかの exists() 判定に使う。
// [true] を返しておくと warm-up の fetch がスキップされ、fetch モックは index.html 専用のままで済む。
vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        exists: vi.fn(async () => [true]),
        // exists === true 経路で参照時刻(lastAccessedAt)を更新する。og-cache の HIT と同じ。
        setMetadata: vi.fn(async () => undefined),
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
import { formatFullHousingAddress } from '../../../src/lib/housing/formatHousingAddress.js';
import { regionForDC } from '../../../src/data/housing/dcServerMap.js';

const DEFAULT_OG_TITLE = 'LoPo | FF14 軽減プランナー';

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

  // 最終レビュー指摘1: タイトル未入力の物件が全て同じ汎用タイトル(DEFAULT_OG_TITLE)になり
  // SEO上の重複コンテンツを生んでいたバグの回帰テスト。ListingCard.tsx / HousingDetailContent.tsx
  // と同じ「タイトル未入力なら住所にフォールバック」規約に揃える。
  it('タイトル未入力・住所公開(public)の物件は、汎用タイトルではなく住所にフォールバックする', async () => {
    const { req, res } = makeReqRes({ query: { id: 'no-title-listing' } });

    mockGetFn.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        visibility: 'public',
        isHidden: false,
        deletedAt: null,
        title: '',
        description: '',
        area: 'Mist',
        ward: 5,
        plot: 12,
        buildingType: 'house',
        dc: 'Elemental',
        server: 'Carbuncle',
      }),
    });
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    await handler(req, res);

    const expectedAddress = formatFullHousingAddress(
      { area: 'Mist', ward: 5, buildingType: 'house', plot: 12, region: regionForDC('Elemental'), dc: 'Elemental', server: 'Carbuncle' },
      'ja',
    );
    expect(res.body as string).toContain(expectedAddress);
    expect(res.body as string).not.toContain(DEFAULT_OG_TITLE);
  });

  it('空白のみのタイトルは未入力扱いになり住所にフォールバックする(.trim())', async () => {
    const { req, res } = makeReqRes({ query: { id: 'whitespace-title-listing' } });

    mockGetFn.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        visibility: 'public',
        isHidden: false,
        deletedAt: null,
        title: '   ',
        description: '',
        area: 'Mist',
        ward: 5,
        plot: 12,
        buildingType: 'house',
        dc: 'Elemental',
        server: 'Carbuncle',
      }),
    });
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    await handler(req, res);

    const expectedAddress = formatFullHousingAddress(
      { area: 'Mist', ward: 5, buildingType: 'house', plot: 12, region: regionForDC('Elemental'), dc: 'Elemental', server: 'Carbuncle' },
      'ja',
    );
    expect(res.body as string).toContain(expectedAddress);
    expect(res.body as string).not.toContain(DEFAULT_OG_TITLE);
    expect(res.body as string).not.toContain('<h1>   </h1>');
  });

  it('タイトル未入力・住所非公開(unlisted)の物件は「住所は非公開です」にフォールバックする(汎用タイトルにはしない)', async () => {
    const { req, res } = makeReqRes({ query: { id: 'unlisted-no-title-listing' } });

    mockGetFn.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        visibility: 'unlisted',
        isHidden: false,
        deletedAt: null,
        title: '',
        description: '',
        area: 'Mist',
        ward: 5,
        plot: 12,
        buildingType: 'house',
        dc: 'Elemental',
        server: 'Carbuncle',
      }),
    });
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    await handler(req, res);

    expect(res.body as string).toContain('<h1>住所は非公開です</h1>');
    expect(res.body as string).not.toContain(DEFAULT_OG_TITLE);
  });

  it('thumbnail物件はog:imageに自ドメインの生成カードURL(/og/<hash>.png)を使う', async () => {
    const { req, res } = makeReqRes({ query: { id: 'thumb-listing' } });
    mockGetFn.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        visibility: 'public', isHidden: false, deletedAt: null,
        title: '海の見える家', description: '',
        area: 'Mist', ward: 5, plot: 12, buildingType: 'house',
        dc: 'Elemental', server: 'Carbuncle',
        imageMode: 'thumbnail',
        thumbnailPaths: ['https://lopoly.app/housing-media/thumb-listing/a.webp'],
      }),
    });
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;

    await handler(req, res);

    expect(res.body as string).toMatch(/og:image" content="https:\/\/lopoly\.app\/og\/[a-f0-9]{16}\.png"/);
    expect(res.body as string).toMatch(/twitter:image" content="https:\/\/lopoly\.app\/og\/[a-f0-9]{16}\.png"/);
  });

  it('画像の無い物件(テキストツイート等)はog:imageがDEFAULT_OG_IMAGEのまま', async () => {
    const { req, res } = makeReqRes({ query: { id: 'no-image-listing' } });
    mockGetFn.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        visibility: 'public', isHidden: false, deletedAt: null,
        title: 'テキストのみ', description: '',
        area: 'Mist', ward: 5, plot: 12, buildingType: 'house',
        dc: 'Elemental', server: 'Carbuncle',
        imageMode: 'sns', tweetId: '123',
      }),
    });
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    await handler(req, res);

    expect(res.body as string).toContain('og:image" content="https://lopoly.app/api/og"');
  });

  // og:image は写真経路でもフォールバック経路でも常に 1200x630 の生成 PNG(自ドメイン再ホスト
  // カード /og/<hash>.png、または /api/og)になったため、index.html が固定宣言する
  // og:image:width/height (1200x630) は常に正しい。どちらの経路でも寸法 meta は残す。
  const INDEX_HTML_WITH_DIMS =
    '<html><head><title>x</title>'
    + '<meta property="og:title" content="x" /><meta property="og:description" content="x" />'
    + '<meta property="og:url" content="x" /><meta property="og:image" content="x" />'
    + '<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />'
    + '<meta name="twitter:title" content="x" /><meta name="twitter:description" content="x" />'
    + '<meta name="twitter:image" content="x" /></head><body></body></html>';

  it('生成カードは常に1200x630なので固定のog:image:width/heightを残す', async () => {
    const { req, res } = makeReqRes({ query: { id: 'thumb-dim-listing' } });
    mockGetFn.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        visibility: 'public', isHidden: false, deletedAt: null,
        title: '海の見える家', description: '',
        area: 'Mist', ward: 5, plot: 12, buildingType: 'house',
        dc: 'Elemental', server: 'Carbuncle',
        imageMode: 'thumbnail',
        thumbnailPaths: ['https://lopoly.app/housing-media/thumb-dim-listing/a.webp'],
      }),
    });
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(INDEX_HTML_WITH_DIMS) }),
    ) as unknown as typeof fetch;

    await handler(req, res);

    expect(res.body as string).toContain('og:image:width" content="1200"');
    expect(res.body as string).toContain('og:image:height" content="630"');
  });

  it('画像の無い物件(フォールバック)は固定のog:image:width(1200)を残す', async () => {
    const { req, res } = makeReqRes({ query: { id: 'no-image-dim-listing' } });
    mockGetFn.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        visibility: 'public', isHidden: false, deletedAt: null,
        title: 'テキストのみ', description: '',
        area: 'Mist', ward: 5, plot: 12, buildingType: 'house',
        dc: 'Elemental', server: 'Carbuncle',
        imageMode: 'sns', tweetId: '123',
      }),
    });
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(INDEX_HTML_WITH_DIMS) }),
    ) as unknown as typeof fetch;

    await handler(req, res);

    expect(res.body as string).toContain('og:image:width" content="1200"');
  });

  it('Cache-Controlはブラウザ側max-ageを60秒に抑える(s-maxageはCDN意図のまま長期)', async () => {
    const { req, res } = makeReqRes({ query: { id: 'cache-header-listing' } });

    mockGetFn.mockResolvedValueOnce({
      exists: true,
      data: () => ({ visibility: 'public', isHidden: false, deletedAt: null, title: 'テスト物件' }),
    });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<html><head><title>x</title><meta property="og:title" content="x" /><meta property="og:description" content="x" /><meta property="og:url" content="x" /><meta property="og:image" content="x" /><meta name="twitter:title" content="x" /><meta name="twitter:description" content="x" /><meta name="twitter:image" content="x" /></head><body></body></html>'),
      }),
    ) as unknown as typeof fetch;

    await handler(req, res);

    expect(res.headers['Cache-Control']).toBe('public, s-maxage=86400, max-age=60');
  });
});
