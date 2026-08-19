import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firebase Admin のモック (listingCount 専用クエリ経由の回帰テスト用・_listingPageHandler.test.ts と同じ手法)。
let mockProfileExists = true;
let mockProfileData: any = null;
const mockQueryResults: any[] = [];

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  cert: vi.fn((config) => config),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldPath: { documentId: vi.fn(() => '__name__') },
  getFirestore: vi.fn(() => ({
    collection: vi.fn((name: string) => {
      if (name === 'housing_profiles') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ exists: mockProfileExists, data: () => mockProfileData })),
          })),
        };
      }
      // housing_listings / og_image_meta: where/select/orderBy/limit チェーン + doc().get()/set()。
      const chain: any = {
        where: vi.fn(() => chain),
        select: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        get: vi.fn(() => Promise.resolve(mockQueryResults.shift() ?? { docs: [] })),
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ exists: false })),
          set: vi.fn(() => Promise.resolve()),
        })),
      };
      return chain;
    }),
  })),
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        exists: vi.fn(() => Promise.resolve([true])), // 既にキャッシュ済み扱い→warm-up fetch を発生させない
      })),
    })),
  })),
}));

vi.mock('../../src/lib/ogpPageShell.js', () => ({
  escapeHtml: (s: string) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  injectSeoSnapshot: vi.fn((html: string) => html),
}));

import {
  listingRepresentativeImages,
  collectImagesFromListings,
  reorderListingImageArraysByBackgroundId,
  buildHousingerSeoSnapshotHtml,
  resolveHousingerUid,
} from '../_housingerPageHandler.js';
import handler from '../_housingerPageHandler.js';

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

describe('listingRepresentativeImages', () => {
  it('thumbnailPathsがあれば複数枚(.png兄弟パスに変換して)返す', () => {
    const imgs = listingRepresentativeImages({
      imageMode: 'thumbnail',
      thumbnailPaths: ['a.webp', 'b.webp', 'c.png'],
    });
    expect(imgs).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it('thumbnailPathsが無ければthumbnailPath1枚にフォールバックする', () => {
    const imgs = listingRepresentativeImages({ imageMode: 'thumbnail', thumbnailPath: 'x.webp' });
    expect(imgs).toEqual(['x.png']);
  });

  it('youtubeVideoIdはthumbnailより優先度は下だが1枚だけ返す', () => {
    const imgs = listingRepresentativeImages({ youtubeVideoId: 'abc12345678' });
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toContain('abc12345678');
  });

  it('sns + sourceImageUrlsがあれば複数枚そのまま返す', () => {
    const imgs = listingRepresentativeImages({
      imageMode: 'sns',
      sourceImageUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    });
    expect(imgs).toEqual(['https://example.com/1.jpg', 'https://example.com/2.jpg']);
  });

  it('sns + sourceImageUrls無しはogImageUrl1枚にフォールバックする', () => {
    const imgs = listingRepresentativeImages({ imageMode: 'sns', ogImageUrl: 'https://example.com/og.jpg' });
    expect(imgs).toEqual(['https://example.com/og.jpg']);
  });

  it('何も無ければ空配列', () => {
    expect(listingRepresentativeImages({})).toEqual([]);
  });
});

describe('collectImagesFromListings', () => {
  it('各listingの代表1枚ずつを先に集める(足りていれば2枚目以降は見ない)', () => {
    const result = collectImagesFromListings([
      ['1a', '1b', '1c'],
      ['2a', '2b'],
      ['3a'],
    ], 3);
    expect(result).toEqual(['1a', '2a', '3a']);
  });

  it('代表1枚ずつだけでは目標に届かない場合、各listingの2枚目以降を追加で埋める', () => {
    const result = collectImagesFromListings([
      ['1a', '1b', '1c'],
      ['2a'],
    ], 5);
    // phase1: 1a, 2a (2枚) → phase2: 1b, 1c (listing1の残り) で計4枚、listing2に残りが無いのでそこで打ち止め
    expect(result).toEqual(['1a', '2a', '1b', '1c']);
  });

  it('全listingを合計しても目標に届かない場合はあるだけ返す(巡回コピーはしない)', () => {
    const result = collectImagesFromListings([['1a'], ['2a']], 10);
    expect(result).toEqual(['1a', '2a']);
  });

  it('listingが0件なら空配列', () => {
    expect(collectImagesFromListings([], 10)).toEqual([]);
  });

  it('空のlisting(画像0枚)が混ざっていても無視して続行する', () => {
    const result = collectImagesFromListings([['1a'], [], ['3a', '3b']], 10);
    expect(result).toEqual(['1a', '3a', '3b']);
  });
});

describe('reorderListingImageArraysByBackgroundId', () => {
  it('backgroundListingIdが一致する要素を先頭へ移動する', () => {
    const entries = [
      { id: 'l-1', images: ['1a'] },
      { id: 'l-2', images: ['2a'] },
      { id: 'l-3', images: ['3a'] },
    ];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-3');
    expect(result.map((e) => e.id)).toEqual(['l-3', 'l-1', 'l-2']);
    expect(result.map((e) => e.images)).toEqual([['3a'], ['1a'], ['2a']]);
  });

  it('一致する要素が無ければ並び順をそのまま返す', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-999');
    expect(result.map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('未指定(null/undefined)ならそのまま返す', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    expect(reorderListingImageArraysByBackgroundId(entries, null).map((e) => e.id)).toEqual(['l-1', 'l-2']);
    expect(reorderListingImageArraysByBackgroundId(entries, undefined).map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('既に先頭にある場合は並び替えしない', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-1');
    expect(result.map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('空配列はそのまま空配列', () => {
    expect(reorderListingImageArraysByBackgroundId([], 'l-1')).toEqual([]);
  });
});

describe('buildHousingerSeoSnapshotHtml', () => {
  it('displayName・bio・件数からスナップショットHTMLを組み立てる', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: 'ミスト太郎', bio: '内装こだわってます', listingCount: 3 });
    expect(html).toBe('<h1>ミスト太郎 のハウジング</h1><p>内装こだわってます</p><p>3件のハウジングを公開中</p>');
  });

  it('bioが空なら<p>を出さない', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: 'ミスト太郎', bio: '', listingCount: 0 });
    expect(html).toBe('<h1>ミスト太郎 のハウジング</h1><p>0件のハウジングを公開中</p>');
  });

  it('displayNameが空なら「ハウジンガー」にフォールバックする', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: '', bio: '', listingCount: 1 });
    expect(html).toBe('<h1>ハウジンガー のハウジング</h1><p>1件のハウジングを公開中</p>');
  });

  it('displayName・bioのHTML特殊文字をエスケープする', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: '<b>x</b>', bio: '"quote"', listingCount: 0 });
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt; のハウジング</h1><p>&quot;quote&quot;</p><p>0件のハウジングを公開中</p>');
  });
});

describe('resolveHousingerUid (2026-08-19 短縮URL /h/:slug のサーバー側解決)', () => {
  function fakeDb(result: { empty: boolean; docs: { id: string }[] }) {
    const where = vi.fn(() => chain);
    const limit = vi.fn(() => chain);
    const get = vi.fn(() => Promise.resolve(result));
    const chain: any = { where, limit, get };
    return { collection: vi.fn(() => chain), _chain: chain };
  }

  it('rawUid があればクエリを一切叩かずそのまま返す (通常の /housing/housinger/:uid 経路は不変)', async () => {
    const db = fakeDb({ empty: true, docs: [] });
    const uid = await resolveHousingerUid(db, 'raw-uid-1', '');
    expect(uid).toBe('raw-uid-1');
    expect(db.collection).not.toHaveBeenCalled();
  });

  it('slug から識別コードを解決できれば uid (hashed: prefix 剥がし済み) を返す', async () => {
    const db = fakeDb({ empty: false, docs: [{ id: 'hashed:d34d9c12abcdef' }] });
    const uid = await resolveHousingerUid(db, '', 'たかし-d34d9c12');
    expect(uid).toBe('d34d9c12abcdef');
    expect(db._chain.where).toHaveBeenCalledWith('isPublished', '==', true);
    expect(db._chain.where).toHaveBeenCalledWith('isModerationHidden', '==', false);
  });

  it('slug が不正な形式 (識別コード無し) なら空文字 (クエリを叩かない)', async () => {
    const db = fakeDb({ empty: true, docs: [] });
    const uid = await resolveHousingerUid(db, '', 'たかし');
    expect(uid).toBe('');
    expect(db.collection).not.toHaveBeenCalled();
  });

  it('該当プロフィールが無ければ空文字', async () => {
    const db = fakeDb({ empty: true, docs: [] });
    const uid = await resolveHousingerUid(db, '', 'たかし-deadbeef');
    expect(uid).toBe('');
  });

  it('rawUid・rawSlug どちらも無ければクエリを叩かず空文字', async () => {
    const db = fakeDb({ empty: true, docs: [] });
    const uid = await resolveHousingerUid(db, '', '');
    expect(uid).toBe('');
    expect(db.collection).not.toHaveBeenCalled();
  });
});

// 最終レビュー指摘2の回帰テスト: listingCount は OGP代表画像選定クエリ(最大10件・isEligibleForOgRepresentative
// でvisibility==='public'限定=unlistedを除外)の副産物ではなく、専用クエリ(ownerUid + visibility in
// ['public','unlisted'] + isHidden===false)の真の件数を反映すること。旧実装なら本テストの画像選定クエリは
// 0件を返すため listingCount も 0 になっていたはず(= listingImageEntries.length を使っていた証拠)。
describe('_housingerPageHandler の listingCount (専用クエリ経由)', () => {
  beforeEach(() => {
    mockQueryResults.length = 0;
    mockProfileExists = true;
    mockProfileData = null;
  });

  it('画像選定クエリの結果(0件)ではなく、専用クエリの真の件数(deletedAt済みは除外・未設定は除外しない)を使う', async () => {
    mockProfileData = {
      isPublished: true,
      isModerationHidden: false,
      displayName: 'テストハウジンガー',
      bio: '',
      avatarUrl: null,
      avatarPngUrl: null,
      // ogRepresentativeListingIds 未設定 → フォールバック(新着上位10件自動採用)分岐へ進む
    };

    // 1回目の get(): listingCount 専用クエリ。15件中、soft-delete 2件を除外して13件が正解。
    // deletedAt フィールド自体が無い(旧データ)1件は「削除済みではない」扱いのまま含める
    // (where('deletedAt','==',null) がフィールド未定義docにマッチしない既知の罠を踏まないため、
    // ハンドラーはこのクエリにdeletedAt条件を含めずJS側フィルタで判定する実装になっている)。
    const countDocs = [
      ...Array.from({ length: 12 }, () => ({ data: () => ({ deletedAt: null }) })),
      ...Array.from({ length: 2 }, () => ({ data: () => ({ deletedAt: Date.now() }) })),
      { data: () => ({}) },
    ];
    mockQueryResults.push({ docs: countDocs });
    // 2回目の get(): OGP代表画像選定用フォールバッククエリ。0件でもlistingCountには影響しないはず。
    mockQueryResults.push({ docs: [] });

    const { req, res } = makeReqRes({ query: { uid: 'testuser1' } });
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))); // index.html取得失敗→手組みHTMLフォールバックへ

    await handler(req, res);

    expect(res.body as string).toContain('13件のハウジングを公開中');
    expect(res.body as string).not.toContain('0件のハウジングを公開中');
  });
});
