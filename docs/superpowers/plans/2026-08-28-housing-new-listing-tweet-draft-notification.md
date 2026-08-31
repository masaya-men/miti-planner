# 新着ハウジングのワンクリックツイート下書き通知 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新しいハウジングが登録されるたびに、masaya 専用 Discord チャンネルへ「事前入力ツイート作成リンク付き」の通知を送り、あわせて物件詳細ページの OGP カード画像を家の写真にする。

**Architecture:** 物件登録 API (`api/housing/_registerListingHandler.ts`) のトランザクション成功後、既存の `duplicate_alert` 通知と同じ best-effort パターンで Discord webhook を 1 回叩く。ツイート文面と Discord メッセージの組み立ては純関数 (`src/lib/housing/newListingTweet.ts`) に隔離して単体テストする。OGP 画像修正は代表画像解決ロジック (`listingRepresentativeImages`) を共有モジュールへ切り出し、`api/share/_listingPageHandler.ts` から使う。

**Tech Stack:** TypeScript / Vercel Serverless Functions (Node) / Firebase Admin SDK / Vitest / Discord Incoming Webhook / X (Twitter) Web Intent

**Spec:** `docs/superpowers/specs/2026-08-28-housing-new-listing-tweet-draft-notification-design.md`

## Global Constraints

- 会話・コメント・ドキュメントは常に日本語。
- パブリックリポジトリ。シークレット実値をコミットしない。環境変数名・プレースホルダーのみ可。
- i18n: UI テキストは i18n キー経由。ただし OGP ハンドラー群・サーバー生成文字列は
  静的日本語直書きが既存方針 (`_listingPageHandler.ts` / `_housingerPageHandler.ts` に前例)。
  本機能のツイート文面・Discord 文面も静的日本語直書きでよい。
- ハッシュタグは **`#FF14ハウジング #FFXIVHousing` の 2 個固定**。物件の地域によらず変えない。
- ツイート本文リードは **`新しいハウジングが投稿されました🏠` (日本語固定)**。
- サイトドメインは本番固定 `https://lopoly.app`。
- Vercel Hobby: 新規 Serverless Function を作らない (12 関数上限)。新エンドポイントは
  既存ルーター (`api/housing/index.ts`) の `?action=` に畳むか、既存ハンドラー内に足す。
- Discord メッセージ内の Web Intent URL は `<...>` で囲みリンクプレビューを抑制する。
- 公開 API のキャッシュヘッダーを変更する場合は `.claude/rules/api-caching.md` を確認
  (本プランでは `_listingPageHandler.ts` の `Cache-Control` は**変更しない**)。
- push 前ゲート: `npm run build` (tsc -b 厳密・未使用変数で落ちる) + `npm run test` フル。
  開発中は変更ファイル周辺のみ実行。
- テストは `__tests__/` 配下必須。`api/` が `src/` を import するときは `.js` 拡張子必須。

---

## File Structure

### 新規ファイル

| パス | 責務 |
|------|------|
| `src/lib/housing/newListingTweet.ts` | 純関数。登録情報 → Discord メッセージ本文 (Web Intent URL・リプ用テキスト込み) を組み立てる。Firebase 非依存。 |
| `src/lib/housing/__tests__/newListingTweet.test.ts` | 上記の単体テスト。 |
| `api/share/_listingImages.ts` | `listingRepresentativeImages()` を `_housingerPageHandler.ts` から切り出した共有モジュール。 |
| `api/share/__tests__/_listingImages.test.ts` | `listingRepresentativeImages()` の単体テスト (移設)。 |

### 変更ファイル

| パス | 変更内容 |
|------|----------|
| `api/share/_housingerPageHandler.ts` | ローカルの `listingRepresentativeImages` 定義を削除し `./_listingImages.js` から re-export。 |
| `api/share/__tests__/_housingerPageHandler.test.ts` | `describe('listingRepresentativeImages')` ブロックを削除 (新ファイルへ移設)。 |
| `api/share/_listingPageHandler.ts` | 公開物件の代表画像を解決し `og:image` / `twitter:image` に使う。 |
| `src/lib/discordWebhook.ts` | `sendHousingNewListingNotification(content: string)` を追加 (新 webhook 変数 `DISCORD_HOUSING_NEW_WEBHOOK_URL`)。 |
| `api/housing/_registerListingHandler.ts` | トランザクション後の best-effort ブロックで、条件を満たすとき新着通知を送る。 |
| `docs/ADMIN_SETUP.md` | 新環境変数 `DISCORD_HOUSING_NEW_WEBHOOK_URL` のセットアップ手順を追記。 |
| `docs/TODO.md` | 完了移動 (実装後)。 |

### 依存する既存モジュール (変更しない)

- `src/lib/housing/housingerProfile.ts` — `buildHousingerShortSlug(displayName, uid)`, `stripHashedPrefix(uid)`, `normalizeHousingerUid(uid)`
- `src/lib/housing/formatHousingAddress.ts` — `formatFullHousingAddress(addr, lang)`
- `src/data/housing/dcServerMap.ts` — `regionForDC(dc): Region | null`
- `src/lib/housing/publicListingProjection.ts` — `projectPublicListing(id, raw)`
- `api/housing/_imageArrayLogic.ts` — `toPngSiblingPath(path)`
- `src/lib/housing/youtubeUrl.ts` — `buildYoutubeThumbnailUrlFallback(videoId)`

---

## Task 1: `listingRepresentativeImages` を共有モジュールへ切り出す

**Files:**
- Create: `api/share/_listingImages.ts`
- Create: `api/share/__tests__/_listingImages.test.ts`
- Modify: `api/share/_housingerPageHandler.ts` (ローカル定義削除 + re-export)
- Modify: `api/share/__tests__/_housingerPageHandler.test.ts` (該当 describe 削除)

**Interfaces:**
- Produces: `listingRepresentativeImages(listing: { imageMode?: unknown; thumbnailPath?: unknown; thumbnailPaths?: unknown; ogImageUrl?: unknown; sourceImageUrls?: unknown; videoPosterUrl?: unknown; youtubeVideoId?: unknown; }): string[]`
  - 純関数。優先順: `thumbnail` (thumbnailPaths→thumbnailPath、いずれも `toPngSiblingPath` 適用) → `youtubeVideoId` (`buildYoutubeThumbnailUrlFallback` 1 枚) → `sns` (sourceImageUrls → ogImageUrl) → `videoPosterUrl` → `[]`。
  - **現行 `_housingerPageHandler.ts` の実装 (2026-08 時点) と挙動を 1 bit も変えない。** ロジックは移設のみ。

- [ ] **Step 1: 新モジュールを作成**

`api/share/_listingImages.ts` に、現行 `api/share/_housingerPageHandler.ts` の
`listingRepresentativeImages` 関数本体 (JSDoc コメント含む) をそのまま移す。
import は現行と同じ相対パスで書く:

```ts
/**
 * 公開 listing 1 件分から代表画像 URL を「複数」解決する共有ロジック。
 * (旧: api/share/_housingerPageHandler.ts。2026-08-28 に _listingPageHandler.ts と
 *  共有するため切り出し。挙動は変更なし)
 *
 * 優先順: thumbnail(複数可・.png 兄弟) → YouTube サムネ(1枚) →
 *   sns(sourceImageUrls 優先・複数可、無ければ ogImageUrl 1枚) → 動画 videoPosterUrl(1枚) → なし。
 * 戻り値の先頭 = 「この物件の代表1枚」。
 */
import { toPngSiblingPath } from '../housing/_imageArrayLogic.js';
import { buildYoutubeThumbnailUrlFallback } from '../../src/lib/housing/youtubeUrl.js';

export function listingRepresentativeImages(listing: {
  imageMode?: unknown;
  thumbnailPath?: unknown;
  thumbnailPaths?: unknown;
  ogImageUrl?: unknown;
  sourceImageUrls?: unknown;
  videoPosterUrl?: unknown;
  youtubeVideoId?: unknown;
}): string[] {
  if (listing.imageMode === 'thumbnail') {
    if (Array.isArray(listing.thumbnailPaths) && listing.thumbnailPaths.length > 0) {
      return listing.thumbnailPaths
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .map((p) => toPngSiblingPath(p));
    }
    if (typeof listing.thumbnailPath === 'string' && listing.thumbnailPath) {
      return [toPngSiblingPath(listing.thumbnailPath)];
    }
  }
  if (typeof listing.youtubeVideoId === 'string' && listing.youtubeVideoId) {
    return [buildYoutubeThumbnailUrlFallback(listing.youtubeVideoId)];
  }
  if (listing.imageMode === 'sns') {
    if (Array.isArray(listing.sourceImageUrls) && listing.sourceImageUrls.length > 0) {
      return listing.sourceImageUrls.filter((u): u is string => typeof u === 'string' && u.length > 0);
    }
    if (typeof listing.ogImageUrl === 'string' && listing.ogImageUrl) {
      return [listing.ogImageUrl];
    }
  }
  if (typeof listing.videoPosterUrl === 'string' && listing.videoPosterUrl) {
    return [listing.videoPosterUrl];
  }
  return [];
}
```

> 実装前に現行 `_housingerPageHandler.ts` の同関数を再読し、差異があれば**現行に合わせる**
> (このプランのコピーが古い可能性を排除する)。

- [ ] **Step 2: テストを移設**

`api/share/__tests__/_listingImages.test.ts` を作成。`_housingerPageHandler.test.ts` の
`describe('listingRepresentativeImages', ...)` ブロックをそのまま移す。冒頭に必要な mock:

```ts
import { describe, it, expect } from 'vitest';
import { listingRepresentativeImages } from '../_listingImages.js';

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
```

- [ ] **Step 3: `_housingerPageHandler.ts` を re-export に置き換え**

`_housingerPageHandler.ts` から `listingRepresentativeImages` の関数定義を削除し、
`toPngSiblingPath` / `buildYoutubeThumbnailUrlFallback` の import が他で使われていなければ削除。
ファイル冒頭付近の import 群に追加:

```ts
import { listingRepresentativeImages } from './_listingImages.js';
```

同ファイルは既存テストが `listingRepresentativeImages` を `_housingerPageHandler.js` から
import しているため、後方互換の re-export を 1 行残す (他の import 元がある可能性も考慮):

```ts
export { listingRepresentativeImages } from './_listingImages.js';
```

> `import { listingRepresentativeImages } ...` と `export { listingRepresentativeImages } ...` の
> 二重は TS でエラーになる。**どちらか一方**にする: ハンドラー内で使うので
> `import { listingRepresentativeImages } from './_listingImages.js';` にしたうえで、
> 末尾に `export { listingRepresentativeImages };` を書く形にする。

- [ ] **Step 4: `_housingerPageHandler.test.ts` から移設済みブロックを削除**

`describe('listingRepresentativeImages', () => { ... });` ブロック全体を削除。
`import { listingRepresentativeImages, ... }` の行から `listingRepresentativeImages` だけ外す
(他の `collectImagesFromListings` 等は残す)。

- [ ] **Step 5: テスト実行**

Run: `npx vitest run api/share/__tests__/_listingImages.test.ts api/share/__tests__/_housingerPageHandler.test.ts`
Expected: 両方 PASS (新ファイル 6 件 + housinger 側は既存の残りが緑)。

- [ ] **Step 6: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし (未使用 import が残っていると落ちる)。

- [ ] **Step 7: Commit**

```bash
git add api/share/_listingImages.ts api/share/__tests__/_listingImages.test.ts api/share/_housingerPageHandler.ts api/share/__tests__/_housingerPageHandler.test.ts
git commit -m "refactor(housing): listingRepresentativeImages を共有モジュールに切り出し"
```

---

## Task 2: 物件詳細ページの OGP 画像を家の写真にする

**Files:**
- Modify: `api/share/_listingPageHandler.ts`
- Modify: `api/share/__tests__/_listingPageHandler.test.ts`

**Interfaces:**
- Consumes: `listingRepresentativeImages` (Task 1) from `./_listingImages.js`
- Produces: なし (ハンドラーの出力メタタグが変わるだけ)

**背景:** 現行 `_listingPageHandler.ts` は `ogImageUrl` を `DEFAULT_OG_IMAGE = '/api/og'`
(汎用ロゴ) に固定し、家の写真をカードに出していない。公開判定を通った物件について
代表画像 1 枚を解決して使う。解決できなければ従来どおり `DEFAULT_OG_IMAGE`。

- [ ] **Step 1: 失敗するテストを書く**

`_listingPageHandler.test.ts` の `describe('_listingPageHandler', ...)` 内に追加:

```ts
it('thumbnail物件はog:imageに家の写真(.png兄弟の絶対URL)を使う', async () => {
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
  global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

  await handler(req, res);

  expect(res.body as string).toContain('og:image" content="https://lopoly.app/housing-media/thumb-listing/a.png"');
  expect(res.body as string).toContain('twitter:image" content="https://lopoly.app/housing-media/thumb-listing/a.png"');
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run api/share/__tests__/_listingPageHandler.test.ts -t "og:image"`
Expected: FAIL (1 件目は `/api/og` のまま、期待と不一致)。

- [ ] **Step 3: 実装**

`api/share/_listingPageHandler.ts`:

import に追加:
```ts
import { listingRepresentativeImages } from './_listingImages.js';
```

`if (snap.exists && isPubliclyViewable(...))` ブロック内、`seoSnapshotHtml = buildListingSeoSnapshotHtml(...)` の直後あたりに追加:

```ts
// OGP 画像: この家の代表写真 1 枚 (thumbnail は .png 兄弟)。無ければ DEFAULT_OG_IMAGE のまま。
// X (Twitter) は og:image の WebP を安定サポートしないため、thumbnail 経路は必ず .png を指す
// (listingRepresentativeImages が toPngSiblingPath 済みを返す)。
const repImages = listingRepresentativeImages(projected as Record<string, unknown>);
if (repImages[0]) {
  ogImageUrl = /^https?:\/\//.test(repImages[0]) ? repImages[0] : `${origin}${repImages[0]}`;
}
```

`projected` は `projectPublicListing(listingId, snap.data()!)` の戻り値で、
`imageMode` / `thumbnailPath(s)` / `ogImageUrl` / `sourceImageUrls` / `youtubeVideoId` /
`videoPosterUrl` を通す (SAFE_FIELDS 済み)。

既存の `if (!/^https?:\/\//.test(ogImageUrl)) ogImageUrl = ...` 行はそのまま残す
(DEFAULT_OG_IMAGE フォールバック時の絶対 URL 化用)。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run api/share/__tests__/_listingPageHandler.test.ts`
Expected: 全 PASS (新規 2 件 + 既存の title/cache テストは画像フィールドを持たないので `/api/og` のまま緑)。

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし。

- [ ] **Step 6: Commit**

```bash
git add api/share/_listingPageHandler.ts api/share/__tests__/_listingPageHandler.test.ts
git commit -m "feat(housing): 物件詳細ページのOGP画像を家の写真にする"
```

---

## Task 3: ツイート下書き通知の文面組み立て (純関数)

**Files:**
- Create: `src/lib/housing/newListingTweet.ts`
- Create: `src/lib/housing/__tests__/newListingTweet.test.ts`

**Interfaces:**
- Consumes: `buildHousingerShortSlug` from `../housingerProfile`, `formatFullHousingAddress` from `./formatHousingAddress`, `regionForDC` from `../../data/housing/dcServerMap`
- Produces:
  ```ts
  export interface NewListingNotificationInput {
    listingId: string;
    title?: string | null;
    visibility: 'public' | 'unlisted' | 'private';
    // 住所 (タイトル未入力時のフォールバック表示用・全て任意)
    dc?: string; server?: string; area?: string; ward?: number;
    buildingType?: 'house' | 'apartment';
    plot?: number; apartmentBuilding?: 1 | 2; roomNumber?: number;
    // 投稿元 URL (listing.postUrl または sourcePostUrls[0]。無ければ null)
    postUrl?: string | null;
    // ハウジンガープロフィール
    housingerUid: string;          // 'hashed:<hex>' 形式 (内部 uid)
    housingerName: string | null;  // profiles.displayName ('' / null は名無しフォールバック)
    housingerProfilePublished: boolean;
  }
  export function buildNewListingNotification(input: NewListingNotificationInput): { discordContent: string };
  ```

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/newListingTweet.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildNewListingNotification } from '../newListingTweet';

const base = {
  listingId: 'AbC123',
  visibility: 'public' as const,
  housingerUid: 'hashed:d34d9c12abcdef00',
  housingerName: 'ミコッテ太郎',
  housingerProfilePublished: true,
};

describe('buildNewListingNotification', () => {
  it('本文ツイートリンクに固定リード+2ハッシュタグ+物件URLが入る', () => {
    const { discordContent } = buildNewListingNotification({ ...base, title: 'サンドリア風の隠れ家' });
    // intent URL は text= に全部入る (url= は使わない)
    const m = discordContent.match(/<https:\/\/twitter\.com\/intent\/tweet\?text=([^>]+)>/);
    expect(m).toBeTruthy();
    const decoded = decodeURIComponent(m![1]);
    expect(decoded).toContain('新しいハウジングが投稿されました🏠');
    expect(decoded).toContain('#FF14ハウジング #FFXIVHousing');
    expect(decoded).toContain('https://lopoly.app/housing/listing/AbC123');
  });

  it('投稿元URLがあれば本文の最後の行に付く (物件URLより後)', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://x.com/mikotetaro/status/1234567890',
    });
    const decoded = decodeURIComponent(
      discordContent.match(/intent\/tweet\?text=([^>]+)>/)![1],
    );
    const listingIdx = decoded.indexOf('https://lopoly.app/housing/listing/AbC123');
    const srcIdx = decoded.indexOf('https://x.com/mikotetaro/status/1234567890');
    expect(listingIdx).toBeGreaterThan(-1);
    expect(srcIdx).toBeGreaterThan(listingIdx);
  });

  it('投稿元URLが無ければ本文に物件URLだけ', () => {
    const { discordContent } = buildNewListingNotification({ ...base, title: 'x', postUrl: null });
    const decoded = decodeURIComponent(
      discordContent.match(/intent\/tweet\?text=([^>]+)>/)![1],
    );
    expect(decoded).not.toContain('x.com/');
  });

  it('プロフィール公開時はリプ用コードブロック (リード + /h/ 短縮URL) を出す', () => {
    const { discordContent } = buildNewListingNotification({ ...base, title: 'x' });
    expect(discordContent).toContain('ミコッテ太郎さんの他のハウジングはこちら👇');
    expect(discordContent).toMatch(/https:\/\/lopoly\.app\/h\/[^\s`]*d34d9c12/);
    expect(discordContent).toContain('```'); // コードブロック
  });

  it('プロフィール未公開ならリプ用ブロックを出さず「未公開」と明記', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', housingerProfilePublished: false,
    });
    expect(discordContent).toContain('※ハウジンガーページ未公開のためリプはスキップ');
    expect(discordContent).not.toContain('他のハウジングはこちら');
  });

  it('登録者名が空なら「名無しさん」にフォールバック', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', housingerName: '', housingerProfilePublished: false,
    });
    expect(discordContent).toContain('登録者: 名無しさん');
  });

  it('タイトル未入力なら見出しに住所を出す (public)', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: '   ',
      dc: 'Elemental', server: 'Carbuncle', area: 'Mist', ward: 5, plot: 12, buildingType: 'house',
    });
    expect(discordContent).toContain('🏠 新着ハウジング: ');
    expect(discordContent).not.toContain('🏠 新着ハウジング: \n');
  });

  it('unlisted は見出しに「（住所非公開）」を付ける', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: '白基調のアパルトメント', visibility: 'unlisted',
    });
    expect(discordContent).toContain('白基調のアパルトメント（住所非公開）');
  });

  it('確認用の物件ページURLを必ず含める / 投稿元があれば併記', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://x.com/a/status/1',
    });
    expect(discordContent).toContain('https://lopoly.app/housing/listing/AbC123');
    expect(discordContent).toContain('https://x.com/a/status/1');
  });

  it('生成されるツイート本文は280文字以内', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://x.com/verylongusername/status/1234567890123456789',
    });
    const decoded = decodeURIComponent(
      discordContent.match(/intent\/tweet\?text=([^>]+)>/)![1],
    );
    // URL は t.co 換算 23 だが、ここでは素の長さでも十分余裕がある想定
    expect(decoded.length).toBeLessThanOrEqual(280);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/housing/__tests__/newListingTweet.test.ts`
Expected: FAIL ("buildNewListingNotification is not a function" 等)。

- [ ] **Step 3: 実装**

`src/lib/housing/newListingTweet.ts`:

```ts
/**
 * 新着ハウジングの「ワンクリックツイート下書き」Discord 通知の本文を組み立てる純関数。
 * Firebase 非依存。文面はすべて日本語固定 (設計書 §5)。
 * 設計書: docs/superpowers/specs/2026-08-28-housing-new-listing-tweet-draft-notification-design.md
 */
import { buildHousingerShortSlug } from './housingerProfile.js';
import { formatFullHousingAddress } from './formatHousingAddress.js';
import { regionForDC } from '../../data/housing/dcServerMap.js';
import type { HousingArea } from '../../types/housing.js';

const SITE_ORIGIN = 'https://lopoly.app';
/** 設計書 §5 で確定。ここだけ書き換えれば全ツイートに反映される。 */
const HASHTAGS = '#FF14ハウジング #FFXIVHousing';
const BODY_LEAD = '新しいハウジングが投稿されました🏠';
const NAME_FALLBACK = '名無しさん';
const replyLead = (name: string) => `${name}さんの他のハウジングはこちら👇`;

export interface NewListingNotificationInput {
  listingId: string;
  title?: string | null;
  visibility: 'public' | 'unlisted' | 'private';
  dc?: string;
  server?: string;
  area?: string;
  ward?: number;
  buildingType?: 'house' | 'apartment';
  plot?: number;
  apartmentBuilding?: 1 | 2;
  roomNumber?: number;
  postUrl?: string | null;
  housingerUid: string;
  housingerName: string | null;
  housingerProfilePublished: boolean;
}

/** タイトル未入力時のフォールバック住所文字列 (出せなければ null)。 */
function addressText(input: NewListingNotificationInput): string | null {
  if (
    typeof input.area === 'string'
    && typeof input.ward === 'number'
    && typeof input.dc === 'string'
    && typeof input.server === 'string'
  ) {
    return formatFullHousingAddress(
      {
        area: input.area as HousingArea,
        ward: input.ward,
        buildingType: input.buildingType,
        plot: input.plot,
        apartmentBuilding: input.apartmentBuilding,
        roomNumber: input.roomNumber,
        region: regionForDC(input.dc),
        dc: input.dc,
        server: input.server,
      },
      'ja',
    );
  }
  return null;
}

export function buildNewListingNotification(input: NewListingNotificationInput): { discordContent: string } {
  const listingUrl = `${SITE_ORIGIN}/housing/listing/${input.listingId}`;

  // --- 本文ツイート (Web Intent。URL はすべて text= に入れる) ---
  const bodyLines = [`${BODY_LEAD} ${HASHTAGS}`, listingUrl];
  if (input.postUrl) bodyLines.push(input.postUrl);
  const bodyText = bodyLines.join('\n');
  const bodyIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(bodyText)}`;

  // --- 見出し ---
  const trimmedTitle = (input.title ?? '').trim();
  let heading = trimmedTitle || addressText(input) || '(タイトル・住所なし)';
  if (input.visibility === 'unlisted') heading += '（住所非公開）';

  // --- 登録者名 / リプ ---
  const rawName = input.housingerName ?? '';
  const name = rawName.trim() || NAME_FALLBACK;

  let replyBlock = '';
  let registrantNote = '';
  if (input.housingerProfilePublished) {
    const slug = buildHousingerShortSlug(rawName, input.housingerUid);
    const housingerUrl = `${SITE_ORIGIN}/h/${slug}`;
    replyBlock =
      '\n▶ リプ用 (本文を投稿したあと、自分のツイートに「返信」して貼り付け):\n'
      + '```\n'
      + `${replyLead(name)}\n${housingerUrl}\n`
      + '```\n';
  } else {
    registrantNote = ' ※ハウジンガーページ未公開のためリプはスキップ';
  }

  // --- 確認用 ---
  const confirmLines = [`物件ページ  ${listingUrl}`];
  if (input.postUrl) confirmLines.push(`投稿元      ${input.postUrl}`);

  const discordContent =
    `🏠 新着ハウジング: ${heading}\n`
    + `登録者: ${name}${registrantNote}\n`
    + `\n▶ 本文ツイートを作成 (クリックで投稿画面):\n`
    + `<${bodyIntentUrl}>\n`
    + replyBlock
    + `\n確認用:\n`
    + confirmLines.join('\n');

  return { discordContent };
}
```

> `formatFullHousingAddress` の第1引数の型は `FullAddressViewModel`
> (`area: HousingArea` 必須)。`input.area as HousingArea` のキャストで通す
> (実データは常に正しい area 文字列。フォールバック関数なので厳密検証は不要)。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/newListingTweet.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし。

- [ ] **Step 6: Commit**

```bash
git add src/lib/housing/newListingTweet.ts src/lib/housing/__tests__/newListingTweet.test.ts
git commit -m "feat(housing): 新着ツイート下書き通知の文面組み立て純関数"
```

---

## Task 4: Discord 送信ヘルパーに新 webhook 用関数を追加

**Files:**
- Modify: `src/lib/discordWebhook.ts`
- Create: `src/lib/__tests__/discordWebhook.test.ts`

**Interfaces:**
- Produces: `sendHousingNewListingNotification(content: string): Promise<void>`
  - `DISCORD_HOUSING_NEW_WEBHOOK_URL` へプレーンテキスト (`{ content }`) を POST。
  - 未設定なら `console.warn` して即 return。失敗は `console.error` のみ (throw しない)。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/discordWebhook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sendHousingNewListingNotification', () => {
  const OLD_ENV = process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL;
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => {
    process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('環境変数が設定されていれば content を JSON で POST する', async () => {
    process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL = 'https://discord.test/webhook/xyz';
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 204, statusText: 'No Content' }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendHousingNewListingNotification } = await import('../discordWebhook');

    await sendHousingNewListingNotification('こんにちは');

    expect(fetchMock).toHaveBeenCalledWith('https://discord.test/webhook/xyz', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'こんにちは' }),
    }));
  });

  it('環境変数が未設定なら fetch を呼ばず warn だけ', async () => {
    delete process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendHousingNewListingNotification } = await import('../discordWebhook');

    await sendHousingNewListingNotification('x');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('fetch が reject しても throw しない', async () => {
    process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL = 'https://discord.test/webhook/xyz';
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendHousingNewListingNotification } = await import('../discordWebhook');

    await expect(sendHousingNewListingNotification('x')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/__tests__/discordWebhook.test.ts`
Expected: FAIL ("sendHousingNewListingNotification is not exported")。

- [ ] **Step 3: 実装**

`src/lib/discordWebhook.ts` の末尾に追加 (既存 `sendDiscordNotification` は変更しない):

```ts
/**
 * ハウジング新着通知 (masaya 専用チャンネル) — プレーンテキストを送る。
 * embed ではなく content を使う理由: リプ用テキストをコードブロックで送り、
 * タップ長押しでコピーできるようにするため (設計書 §4)。
 */
export async function sendHousingNewListingNotification(content: string): Promise<void> {
  const url = process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL;
  if (!url) {
    console.warn('[Discord] DISCORD_HOUSING_NEW_WEBHOOK_URL が未設定。新着通知をスキップ');
    return;
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!resp.ok) {
      console.error(`[Discord:HOUSING_NEW] Webhook送信失敗: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('[Discord:HOUSING_NEW] Webhook送信エラー:', err);
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run src/lib/__tests__/discordWebhook.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし。

- [ ] **Step 6: Commit**

```bash
git add src/lib/discordWebhook.ts src/lib/__tests__/discordWebhook.test.ts
git commit -m "feat(housing): Discord新着通知の送信ヘルパー (専用webhook)"
```

---

## Task 5: 登録ハンドラーに新着通知ブロックを配線

**Files:**
- Modify: `api/housing/_registerListingHandler.ts`
- Modify: `docs/ADMIN_SETUP.md`

**Interfaces:**
- Consumes:
  - `buildNewListingNotification` from `../../src/lib/housing/newListingTweet.js` (Task 3)
  - `sendHousingNewListingNotification` from `../../src/lib/discordWebhook.js` (Task 4)
- Produces: なし

**動作:** トランザクション後、既存の `duplicate_alert` best-effort ブロックの**直後**に新ブロックを足す。

発火条件 (すべて満たすときだけ送る):
1. `draft.visibility !== 'private'`。
2. （通知内容の組み立てには、作成済み listing doc を 1 read + `housing_profiles/{uid}` を 1 read）

> **2026-08-31 変更**: 当初は条件に `!isAdmin` も入れていたが、masaya 自身も
> ハウジング製作者で自分の家も宣伝したいため撤回。ガードは `draft.visibility !== 'private' && createdId` のみ。
> 実装済みコード (`api/housing/_registerListingHandler.ts`) とテスト
> (`_registerListingHandler.notify.test.ts` の「admin でも通知が送られる」ケース) は本変更を反映済み。

- [ ] **Step 1: 失敗するテストを書く**

`api/housing/__tests__/_registerListingHandler.notify.test.ts` を作成。
Firebase Admin と rate limit / appcheck / auth を mock し、通知の発火有無を検証する。
既存 `api/housing/__tests__/*.ts` の mock 手法に合わせる (`vi.mock('firebase-admin/...')` 等)。

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- 依存の mock ---
const sendNotifyMock = vi.fn(() => Promise.resolve());
vi.mock('../../../src/lib/discordWebhook.js', () => ({
  sendHousingNewListingNotification: (c: string) => sendNotifyMock(c),
  sendDiscordNotification: vi.fn(),
}));

vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(() => Promise.resolve(true)) }));

let decodedToken: any = { uid: 'hashed:user1', role: undefined };
vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: vi.fn(() => Promise.resolve(decodedToken)) })),
}));

// Firestore: runTransaction は成功させ、後続の best-effort read を制御する。
// (詳細な chain mock は他の api/housing テストを参照して合わせること)
// ...

import handler from '../_registerListingHandler.js';

function makeReqRes(body: any) {
  const req: any = { method: 'POST', headers: { authorization: 'Bearer t', origin: 'https://lopoly.app' }, body };
  const res: any = {
    statusCode: 0, _json: undefined,
    setHeader() {}, status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this._json = b; return this; }, end() { return this; },
  };
  return { req, res };
}

const validBody = {
  dc: 'Elemental', server: 'Carbuncle', area: 'Mist', ward: 5, plot: 12,
  buildingType: 'house', size: 'M', tags: [], visibility: 'public',
};

beforeEach(() => {
  sendNotifyMock.mockClear();
  decodedToken = { uid: 'hashed:user1', role: undefined };
});

describe('register-listing の新着通知', () => {
  it('一般ユーザーの public 登録で通知が送られる', async () => {
    const { req, res } = makeReqRes(validBody);
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(sendNotifyMock).toHaveBeenCalledTimes(1);
    expect(sendNotifyMock.mock.calls[0][0]).toContain('🏠 新着ハウジング');
  });

  it('admin の登録では通知が送られない', async () => {
    decodedToken = { uid: 'hashed:admin1', role: 'admin' };
    const { req, res } = makeReqRes(validBody);
    await handler(req, res);
    expect(sendNotifyMock).not.toHaveBeenCalled();
  });

  it('visibility=private では通知が送られない', async () => {
    const { req, res } = makeReqRes({ ...validBody, visibility: 'private' });
    await handler(req, res);
    expect(sendNotifyMock).not.toHaveBeenCalled();
  });

  it('通知送信が reject してもレスポンスは 200', async () => {
    sendNotifyMock.mockRejectedValueOnce(new Error('discord down'));
    const { req, res } = makeReqRes(validBody);
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});
```

> Firestore の chain mock は既存の `api/housing/__tests__/checkDuplicatePrivate.test.ts` /
> `_sharedTourCreateLogic.test.ts` 等の書き方に合わせる。`runTransaction(cb)` は
> `cb({ get: ..., set: ..., update: ... })` を呼んで成功させ、`createdId` が返るようにする。
> best-effort の `listingsCol.doc(id).get()` と `collection('housing_profiles').doc(uid).get()` は
> それぞれ最小限のデータを返すよう mock する。
> 難度が高ければ、この Task のテストは「発火条件 (admin / private / best-effort 分離)」の
> 検証に絞り、文面の中身は Task 3 のテストに委ねてよい。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run api/housing/__tests__/_registerListingHandler.notify.test.ts`
Expected: FAIL (通知呼び出しが 0 回)。

- [ ] **Step 3: 実装**

`api/housing/_registerListingHandler.ts`:

import 追加:
```ts
import { buildNewListingNotification } from '../../src/lib/housing/newListingTweet.js';
import { sendHousingNewListingNotification } from '../../src/lib/discordWebhook.js';
```

既存の `duplicate_alert` の `try { ... } catch (notifErr) { ... }` ブロックの直後、
`return res.status(200).json({ id: createdId, addressKey });` の直前に追加:

```ts
// 2026-08-28: 新着ハウジングの「ワンクリックツイート下書き」通知 (masaya 専用チャンネル)。
// best-effort。失敗しても登録レスポンスは 200 のまま。
// 設計書: docs/superpowers/specs/2026-08-28-housing-new-listing-tweet-draft-notification-design.md
if (!isAdmin && draft.visibility !== 'private' && createdId) {
  try {
    const listingSnap = await listingsCol.doc(createdId).get();
    const L = listingSnap.data() ?? {};
    const profileSnap = await adminDb.collection('housing_profiles').doc(uid).get();
    const P = profileSnap.exists ? profileSnap.data()! : null;

    const postUrl: string | null =
      (typeof L.postUrl === 'string' && L.postUrl)
        ? L.postUrl
        : (Array.isArray(L.sourcePostUrls) && typeof L.sourcePostUrls[0] === 'string'
            ? L.sourcePostUrls[0]
            : null);

    const { discordContent } = buildNewListingNotification({
      listingId: createdId,
      title: typeof L.title === 'string' ? L.title : null,
      visibility: (L.visibility === 'unlisted' || L.visibility === 'private') ? L.visibility : 'public',
      dc: typeof L.dc === 'string' ? L.dc : undefined,
      server: typeof L.server === 'string' ? L.server : undefined,
      area: typeof L.area === 'string' ? L.area : undefined,
      ward: typeof L.ward === 'number' ? L.ward : undefined,
      buildingType: L.buildingType === 'house' || L.buildingType === 'apartment' ? L.buildingType : undefined,
      plot: typeof L.plot === 'number' ? L.plot : undefined,
      apartmentBuilding: L.apartmentBuilding === 1 || L.apartmentBuilding === 2 ? L.apartmentBuilding : undefined,
      roomNumber: typeof L.roomNumber === 'number' ? L.roomNumber : undefined,
      postUrl,
      housingerUid: uid,
      housingerName: P && typeof P.displayName === 'string' ? P.displayName : null,
      housingerProfilePublished: !!(P && P.isPublished === true && P.isModerationHidden !== true),
    });

    await sendHousingNewListingNotification(discordContent);
  } catch (tweetNotifyErr) {
    console.error('[housing/register-listing] new-listing tweet notify failed:', tweetNotifyErr);
  }
}
```

> `uid` は `L.dc` 等が `unlisted` の doc でも address フィールドを保持している
> (射影前の生 doc を読むため)。Discord は masaya 専用なので住所表示は問題なし。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run api/housing/__tests__/_registerListingHandler.notify.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: ADMIN_SETUP.md に環境変数手順を追記**

`docs/ADMIN_SETUP.md` に節を追加:

```markdown
## 新着ハウジングのツイート下書き通知

- **環境変数 `DISCORD_HOUSING_NEW_WEBHOOK_URL`** — masaya 専用チャンネルの Incoming Webhook URL。
  - Discord: 対象チャンネル → 連携サービス → ウェブフック → 新規ウェブフック → URL をコピー。
  - Vercel: Settings → Environment Variables に Production / Preview / Development で追加。
  - 未設定でも登録機能は正常動作する (通知だけスキップ)。
  - 実値は `.env.local` / `ADMIN_REFERENCE.md` にのみ記載。
```

- [ ] **Step 6: フル build + テスト (push 前ゲート)**

Run: `npm run build`
Expected: exit 0。

Run: `npm run test`
Expected: 全 PASS (ハングしたら [[reference_vitest_vmthreads_hang]] の手順で切り分け、
変更ファイル周辺だけの実行に切り替えて判断)。

- [ ] **Step 7: Commit**

```bash
git add api/housing/_registerListingHandler.ts docs/ADMIN_SETUP.md
git commit -m "feat(housing): 新着ハウジングのツイート下書き通知をDiscordへ送る"
```

---

## Task 6: デプロイと本番検証

**Files:** なし (運用作業 + `docs/TODO.md` / `docs/TODO_COMPLETED.md` の整理)

- [ ] **Step 1: Vercel に環境変数を追加**

`DISCORD_HOUSING_NEW_WEBHOOK_URL` を Production / Preview / Development に設定
(実値は `ADMIN_REFERENCE.md` / `.env.local`)。

- [ ] **Step 2: 物件サムネイル PNG 兄弟のバックフィル状況を確認**

`scripts/backfill-listing-thumbnail-png.ts` が全既存物件に対して実行済みか確認する
(直接アップロード物件で `.png` 兄弟が無いと、X が壊れた og:image を掴む)。
未実行分があれば実行:

Run: `npx tsx scripts/backfill-listing-thumbnail-png.ts` (スクリプトの実際の実行方法に従う)

- [ ] **Step 3: push → デプロイ**

```bash
git push
```
Vercel 自動デプロイ完了を待つ。docs 未 push 分 (TODO.md 等) も同梱される。

- [ ] **Step 4: 本番動作確認**

1. 管理者**ではない**アカウントでテスト物件を 1 件登録する。
2. masaya 専用 Discord チャンネルに通知が届くことを確認。
3. 「本文ツイートを作成」リンクをクリック → X の投稿画面が
   「リード + `#FF14ハウジング #FFXIVHousing` + 物件 URL」入りで開くことを確認。
4. リプ用コードブロックがコピーでき、`/h/...` URL が正しいことを確認。
5. その物件の URL (`https://lopoly.app/housing/listing/<id>`) を
   [X Card Validator](https://cards-dev.twitter.com/validator) または実投稿プレビューで確認し、
   **家の写真**がカードに出ることを確認 (直接アップロード物件の場合)。
6. SNS 取り込み物件でも 1 件試し、本文ツイートに投稿元 URL が末尾に付く (＝引用表示になる) ことを確認。

- [ ] **Step 5: テスト物件を削除**

[[feedback_housing_data_disposable]]。/admin から削除。

- [ ] **Step 6: TODO.md を整理**

`docs/TODO.md` の当該項目を `docs/TODO_COMPLETED.md` へ移動。「現在の状態」セクション更新。
`wc -l docs/TODO.md` が 100 行以内を確認。

- [ ] **Step 7: Commit**

```bash
git add docs/TODO.md docs/TODO_COMPLETED.md
git commit -m "docs: 新着ツイート下書き通知 実装完了を反映"
git push
```

---

## Self-Review

### Spec coverage

| Spec セクション | 対応タスク |
|---|---|
| §3 A. 発火場所 (登録 API 相乗り・admin/private 除外・best-effort) | Task 5 |
| §3 コスト (新規関数なし・2 read) | Task 5 (設計どおり) |
| §4 B. Discord メッセージ (専用 webhook・プレーンテキスト・コードブロック・`<>` 抑制) | Task 3 (文面) + Task 4 (送信) |
| §4 タイトル / 登録者名の解決 (title→住所→フォールバック / displayName / 未公開注記) | Task 3 |
| §5 C. ハッシュタグ 2 個固定・本文リード日本語固定・定数化 | Task 3 (`HASHTAGS` / `BODY_LEAD` 定数) |
| §5 Web Intent URL (text= に全 URL・url= 不使用・投稿元を最後) | Task 3 |
| §5 リプライ (コピペ用・ハッシュタグなし・`/h/` 短縮 URL) | Task 3 |
| §6 E. 物件詳細ページ OGP 画像を家の写真に | Task 2 (+ Task 1 で共有化) |
| §6 既知のリスク (PNG 兄弟バックフィル) | Task 6 Step 2 |
| §7 D. リプ運用 (案 1・中継ページなし) | Task 3 (仕様として反映済み) |
| §9 エラー処理 (try/catch・未設定 warn・profile read 失敗継続) | Task 3 / Task 4 / Task 5 |
| §10 テスト | 各タスクの Step 1 |
| §11 環境変数・デプロイ手順 | Task 5 Step 5 + Task 6 |

ギャップなし。

### Placeholder scan

コードステップはすべて実コードを記載。「適切なエラー処理」等の曖昧表現なし。
Task 1 / Task 5 のテストに「既存テストの mock 手法に合わせる」という誘導があるが、
これは対象ファイルを明示しているため実行可能 (完全なコピペコードは Firestore chain mock の
分量が大きく、既存資産を参照する方が正確なため意図的にこの形にした)。

### Type consistency

- `listingRepresentativeImages(listing: {...}): string[]` — Task 1 で定義、Task 2 で consume。引数型一致。
- `buildNewListingNotification(input: NewListingNotificationInput): { discordContent: string }` —
  Task 3 で定義、Task 5 で consume。`housingerUid` / `housingerName` / `housingerProfilePublished` /
  `postUrl` / `visibility` のフィールド名は Task 5 の呼び出しと一致。
- `sendHousingNewListingNotification(content: string): Promise<void>` — Task 4 で定義、Task 5 で consume。一致。
- `buildHousingerShortSlug(displayName, uid)` — 既存シグネチャ (housingerProfile.ts) と一致。
- `formatFullHousingAddress(addr: FullAddressViewModel, lang)` — 既存シグネチャと一致
  (`region: Region | null` を `regionForDC` の戻りで渡す)。
