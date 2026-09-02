# ハウジング物件OGP画像 自ドメイン再ホスト方式 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** X 投稿由来の物件ページを X にシェアしても写真付きカードが出るようにする(og:image を pbs.twimg.com 直リンクから自ドメインの整形済み画像に変える)。

**Architecture:** 物件の代表写真 URL から内容ハッシュを作り、既存の `/api/og` + `/api/og-cache` + `og_image_meta` + 週次クリーンアップ cron に乗せる。`/api/og?type=listing` は写真をサーバー側 fetch → satori で 1200×630 に整形(ぼかし背景 + 写真を切らずに contain)して PNG を返す。文字・枠・ブランド印は焼き込まない。

**Tech Stack:** Vercel Edge Function (`@vercel/og` / satori)、Vercel Node Function (firebase-admin)、Firebase Storage、HMAC-SHA256 署名 (Web Crypto)、vitest。

**Spec:** `docs/superpowers/specs/2026-09-02-housing-listing-og-card-design.md`

## Global Constraints

- 言語: コメント・ドキュメント・commit メッセージは日本語。
- `@vercel/og` (satori) は **WebP/AVIF 非対応**。渡すと空 PNG が返る。マジックナンバーで PNG/JPEG/GIF のみ通す。
- satori は `inset: 0` 省略記法を描画できない。全面レイヤーは `top/right/bottom/left` を個別指定。
- 署名は Web Crypto (`crypto.subtle`) のみ。`node:crypto` は使わない(Edge 互換 + Node テストランナーで通すため)。
- カード寸法は常に **1200×630**。`CARD_VERSION = '1'`。署名 hex は先頭 **24 桁**。
- 新規 Serverless/Edge Function を増やさない(Vercel Hobby 12 関数上限)。`/api/og` 内の分岐で完結させる。
- Firestore/Storage バケット名: `lopo-7793e.firebasestorage.app`。og_image_meta コレクション: `og_image_meta`。
- コミットは 1 タスク 1 コミット。`rtk git add ...` / `rtk git commit ...` を使う。commit メッセージ末尾に:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- テスト実行はフルスイートを流し込まない。対象ファイルに絞って実行し、要約だけ取り込む。
- **テスト/型チェックは `npx vitest run <file>` / `npx tsc ...`(`rtk` は付けない — この環境で `rtk npx` は壊れる)。git だけ `rtk` を付ける。**

---

## ファイル構成

| ファイル | 責務 | タスク |
|---|---|---|
| `src/lib/ogpListingCard.ts` | `type=listing` カードの URL 組み立て + HMAC 署名/検証。パラメータは `img` 1 個 | 1 |
| `src/lib/__tests__/ogpListingCard.test.ts` | 署名往復・改ざん検出のテスト | 1 |
| `api/og/_fetchOgImage.ts` | 画像 URL を fetch → satori が扱える形式か判定 → base64 data URI 化。`_housingerCard.ts` から抽出 | 2 |
| `api/og/__tests__/_fetchOgImage.test.ts` | 形式判定・失敗時 null のテスト | 2 |
| `api/og/_housingerCard.ts` | 抽出した関数を `_fetchOgImage.ts` から import(挙動不変) | 2 |
| `api/og/_listingCard.ts` | satori 要素ツリー(写真カード / ブランドフォールバック) + `handleListingCardRequest` | 3 |
| `api/og/__tests__/_listingCard.test.ts` | 要素ツリー形状のテスト | 3 |
| `api/og/index.ts` | `type === 'listing'` 分岐を追加 | 3 |
| `api/og-cache/_ogCacheLogic.ts` | `OgImageMeta.imageUrl` 追加 + `buildInternalOgUrl` の `listing` 分岐 | 4 |
| `api/og-cache/__tests__/_ogCacheLogic.test.ts` | `listing` 分岐のテストを追記 | 4 |
| `api/share/_listingPageHandler.ts` | og:image 選定を再ホスト方式に差し替え。width/height 削除ブランチ撤去 | 5 |
| `api/share/__tests__/_listingPageHandler.test.ts` | 既存テスト 2 件を新仕様に更新 + mock 拡張 | 5 |
| `scripts/preview-listing-og-card.mjs` | ローカルで 3 比率の見た目を PNG 出力(使い捨て) | 6 |
| `docs/TODO.md` | タスク 1 番を完了状態に更新 | 7 |

---

## Task 1: `ogpListingCard.ts` — 署名付き URL 組み立て

**Files:**
- Create: `src/lib/ogpListingCard.ts`
- Test: `src/lib/__tests__/ogpListingCard.test.ts`

**Interfaces:**
- Consumes: なし(自己完結)
- Produces:
  - `buildListingOgCardParams(input: { img: string }): URLSearchParams` — `type=listing` / `ver=1` / `img=<url>` を挿入順で set した params(`sig` は含まない)
  - `signListingOgCardParams(params: URLSearchParams, secret: string): Promise<string>` — hex 24 桁
  - `buildListingOgCardUrl(origin: string, input: { img: string }, secret: string): Promise<string>` — `${origin}/api/og?type=listing&ver=1&img=...&sig=...`
  - `verifyListingOgCardSig(searchParams: URLSearchParams, secret: string): Promise<boolean>`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/ogpListingCard.test.ts`:

```ts
import { buildListingOgCardParams, buildListingOgCardUrl, verifyListingOgCardSig } from '../ogpListingCard';

describe('buildListingOgCardParams', () => {
  it('type/ver/img を挿入順で含む', () => {
    const params = buildListingOgCardParams({ img: 'https://pbs.twimg.com/media/abc.jpg' });
    expect(params.get('type')).toBe('listing');
    expect(params.get('ver')).toBe('1');
    expect(params.get('img')).toBe('https://pbs.twimg.com/media/abc.jpg');
    expect(params.toString()).toBe('type=listing&ver=1&img=https%3A%2F%2Fpbs.twimg.com%2Fmedia%2Fabc.jpg');
  });
});

describe('buildListingOgCardUrl / verifyListingOgCardSig', () => {
  const secret = 'test-secret-value';

  it('組み立てた URL の署名が検証を通る', async () => {
    const url = await buildListingOgCardUrl('https://lopoly.app', { img: 'https://x.test/a.jpg' }, secret);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/api/og');
    expect(parsed.searchParams.get('type')).toBe('listing');
    expect(await verifyListingOgCardSig(parsed.searchParams, secret)).toBe(true);
  });

  it('img 改ざんで署名検証が失敗する', async () => {
    const url = await buildListingOgCardUrl('https://lopoly.app', { img: 'https://x.test/a.jpg' }, secret);
    const parsed = new URL(url);
    parsed.searchParams.set('img', 'https://evil.test/b.jpg');
    expect(await verifyListingOgCardSig(parsed.searchParams, secret)).toBe(false);
  });

  it('secret が違えば検証は失敗する', async () => {
    const url = await buildListingOgCardUrl('https://lopoly.app', { img: 'https://x.test/a.jpg' }, secret);
    const parsed = new URL(url);
    expect(await verifyListingOgCardSig(parsed.searchParams, 'different-secret')).toBe(false);
  });

  it('sig が無ければ検証は失敗する', async () => {
    const params = buildListingOgCardParams({ img: 'https://x.test/a.jpg' });
    expect(await verifyListingOgCardSig(params, secret)).toBe(false);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/__tests__/ogpListingCard.test.ts`
Expected: FAIL(モジュールが存在しない)

- [ ] **Step 3: 実装**

`src/lib/ogpListingCard.ts`(`src/lib/ogpTourInviteCard.ts` をベースに `name` → `img` に置換):

```ts
/**
 * ハウジング物件ページ (/housing/listing/:id) 専用 OGP カード — URL 組み立て + 署名ヘルパー
 *
 * カード画像は `/api/og?type=listing&img=<写真URL>&sig=<HMAC>`(既存 Edge Function `/api/og` の
 * 拡張分岐、api/og/_listingCard.ts が担当)で生成する。新規 Serverless/Edge Function は増やさない。
 *
 * 設計・署名方式は src/lib/ogpTourInviteCard.ts / src/lib/ogpHousingerCard.ts と同型
 * (HMAC-SHA256(secret=process.env.CRON_SECRET) の先頭 24 hex・パラメータ順固定)。
 * Web Crypto (`crypto.subtle`) のみ使用(Node 18+/Edge 双方で動作・単体テストも Node で通る)。
 *
 * パラメータ順序(固定・sig を除く): type → ver → img。
 */

const SIG_PARAM = 'sig';
const CARD_VERSION = '1';
const SIG_HEX_LENGTH = 24;

export interface ListingOgCardInput {
  /** 物件の代表写真 URL(絶対 URL)。 */
  img: string;
}

export function buildListingOgCardParams(input: ListingOgCardInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('type', 'listing');
  params.set('ver', CARD_VERSION);
  params.set('img', input.img || '');
  return params;
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(sigBuf);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signListingOgCardParams(params: URLSearchParams, secret: string): Promise<string> {
  const fullHex = await hmacSha256Hex(secret, params.toString());
  return fullHex.slice(0, SIG_HEX_LENGTH);
}

export async function buildListingOgCardUrl(
  origin: string,
  input: ListingOgCardInput,
  secret: string,
): Promise<string> {
  const params = buildListingOgCardParams(input);
  const sig = await signListingOgCardParams(params, secret);
  params.set(SIG_PARAM, sig);
  return `${origin}/api/og?${params.toString()}`;
}

export async function verifyListingOgCardSig(searchParams: URLSearchParams, secret: string): Promise<boolean> {
  const sig = searchParams.get(SIG_PARAM);
  if (!sig) return false;
  const withoutSig = new URLSearchParams(searchParams);
  withoutSig.delete(SIG_PARAM);
  const expected = await signListingOgCardParams(withoutSig, secret);
  return timingSafeEqualHex(expected, sig);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/ogpListingCard.test.ts`
Expected: PASS(4 件)

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/ogpListingCard.ts src/lib/__tests__/ogpListingCard.test.ts
rtk git commit -m "feat(og): 物件OGPカードの署名付きURL組み立てヘルパー"
```

---

## Task 2: `_fetchOgImage.ts` — 画像 fetch ヘルパーを共有モジュールに抽出

`api/og/_housingerCard.ts` 内の private 関数を切り出し、`_housingerCard.ts` と `_listingCard.ts`(Task 3)の両方から使えるようにする。**挙動は 1 bit も変えない。**

**Files:**
- Create: `api/og/_fetchOgImage.ts`
- Create: `api/og/__tests__/_fetchOgImage.test.ts`
- Modify: `api/og/_housingerCard.ts`(関数定義を削除し import に置換)

**Interfaces:**
- Consumes: なし
- Produces:
  - `sniffSupportedImageMime(buf: ArrayBuffer): string | null` — 先頭バイトから `'image/png'` / `'image/jpeg'` / `'image/gif'`、それ以外は `null`
  - `arrayBufferToBase64(buf: ArrayBuffer): string`
  - `fetchAsDataUri(url: string): Promise<string | null>` — 失敗(非 2xx / 非対応形式 / タイムアウト / サイズ超過 / 空)は `null`
  - 定数 `IMAGE_FETCH_TIMEOUT_MS = 4000` / `IMAGE_MAX_BYTES = 8 * 1024 * 1024`

- [ ] **Step 1: 失敗するテストを書く**

`api/og/__tests__/_fetchOgImage.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { sniffSupportedImageMime, fetchAsDataUri } from '../_fetchOgImage.js';

function bytes(...b: number[]): ArrayBuffer {
  return new Uint8Array(b).buffer;
}

describe('sniffSupportedImageMime', () => {
  it('PNG マジックナンバーを png と判定', () => {
    expect(sniffSupportedImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0))).toBe('image/png');
  });
  it('JPEG マジックナンバーを jpeg と判定', () => {
    expect(sniffSupportedImageMime(bytes(0xff, 0xd8, 0xff, 0))).toBe('image/jpeg');
  });
  it('WebP (RIFF....WEBP) は null(satori 非対応)', () => {
    expect(sniffSupportedImageMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBeNull();
  });
});

describe('fetchAsDataUri', () => {
  afterEach(() => vi.restoreAllMocks());

  it('PNG を data URI 化して返す', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => png.buffer })));
    const result = await fetchAsDataUri('https://x.test/a.png');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('非 2xx は null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await fetchAsDataUri('https://x.test/404.png')).toBeNull();
  });

  it('WebP は null(satori 非対応)', async () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => webp.buffer })));
    expect(await fetchAsDataUri('https://x.test/a.webp')).toBeNull();
  });

  it('fetch が投げたら null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await fetchAsDataUri('https://x.test/a.png')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run api/og/__tests__/_fetchOgImage.test.ts`
Expected: FAIL(モジュールが存在しない)

- [ ] **Step 3: `_fetchOgImage.ts` を作成**

`api/og/_housingerCard.ts` の以下をそのまま移設(コメントも維持):
- 定数 `IMAGE_FETCH_TIMEOUT_MS`(4000)、`IMAGE_MAX_BYTES`(8MB)
- `arrayBufferToBase64`(現行 459-468 行)
- `sniffSupportedImageMime`(現行 477-483 行)
- `fetchAsDataUri`(現行 490-506 行)

すべて `export` を付ける。ファイル冒頭にモジュール説明コメント:

```ts
/**
 * OGP カード生成で外部画像 URL を安全に取り込む共有ヘルパー。
 * api/og/_housingerCard.ts / api/og/_listingCard.ts の両方から使う。
 *
 * satori (@vercel/og) は WebP/AVIF 非対応で、渡すとレンダリングが空 PNG になる実バグがあるため
 * (2026-07-17 実測)、先頭バイトのマジックナンバーで PNG/JPEG/GIF のみ通す。
 * content-type は CDN によって不正確なことがあるため実バイトで判定する。
 *
 * レンダリング中の画像 fetch 失敗は ImageResponse 生成後の非同期ストリーム内で起きて
 * try/catch で捕捉できないため、要素ツリーに渡す前に必ずここで data URI 化しておくこと。
 */
```

- [ ] **Step 4: `_housingerCard.ts` を import に置換**

`api/og/_housingerCard.ts` から移設した 4 つの定義を削除し、冒頭の import 群に追加:

```ts
import { fetchAsDataUri } from './_fetchOgImage.js';
```

(`sniffSupportedImageMime` / `arrayBufferToBase64` / 定数は `_housingerCard.ts` 内で直接使われていない場合は import しない。使用箇所を grep して確認: `rtk git grep -n "sniffSupportedImageMime\|arrayBufferToBase64\|IMAGE_FETCH_TIMEOUT_MS\|IMAGE_MAX_BYTES" api/og/_housingerCard.ts`)

- [ ] **Step 5: 既存テスト + 新テストが通ることを確認**

Run: `npx vitest run api/og/__tests__/_fetchOgImage.test.ts api/og/__tests__/_housingerCard.test.ts`
Expected: 両方 PASS(`_housingerCard.test.ts` は挙動不変なので全件緑のまま)

- [ ] **Step 6: 型チェック**

Run: `npx tsc -p tsconfig.json --noEmit`(または該当ファイルのみ確認できる方法)
Expected: エラーなし(未使用 import に注意 — [[feedback_vercel_tsc_strict]])

- [ ] **Step 7: コミット**

```bash
rtk git add api/og/_fetchOgImage.ts api/og/__tests__/_fetchOgImage.test.ts api/og/_housingerCard.ts
rtk git commit -m "refactor(og): 画像fetchヘルパーを_fetchOgImage.tsに抽出(挙動不変)"
```

---

## Task 3: `_listingCard.ts` — satori カード + `/api/og` 分岐

**Files:**
- Create: `api/og/_listingCard.ts`
- Create: `api/og/__tests__/_listingCard.test.ts`
- Modify: `api/og/index.ts`(`type === 'listing'` 分岐を追加)

**Interfaces:**
- Consumes:
  - `verifyListingOgCardSig` from `../../src/lib/ogpListingCard.js`(Task 1)
  - `fetchAsDataUri` from `./_fetchOgImage.js`(Task 2)
  - `loadMPlus1Fonts(uniqueChars: string)` / `loadInterFonts(uniqueChars: string)` from `./_fonts.js`(既存)
- Produces:
  - `buildListingPhotoCard(photoDataUri: string): object` — 要素ツリー。子 = [ぼかし背景 div, 暗幕 div, `objectFit:'contain'` の img, 著作権表記 div]。タイトル/住所/ブランド印は無い(© 1 行のみ)
  - `buildListingBrandFallbackCard(): object` — `#111725` 背景中央に「LoPo Housing」+ 下端に © 表記
  - `handleListingCardRequest(searchParams: URLSearchParams): Promise<Response>`

**© 表記(masaya 2026-09-02 決定「入れる・短縮形」)**: 全カード下端中央に極小 1 行 **`© SQUARE ENIX`**。FFXIV Materials Usage License が「`© SQUARE ENIX` か、ゲーム内表示どおりのフル形のどちらでも可」と明記(2026-09-02 確認・出典は spec §2)。カードは短い方を採用。11px・写真の上でも読める強シャドウ。文言を焼き込む以上フォントが要るので写真カード経路でもフォントを読み込む。サイト他所(footer / LegalPage / `_housingerCard.ts` / `_tourInviteCard.ts`)のフル表記は今回触らない。

- [ ] **Step 1: 失敗するテストを書く**

`api/og/__tests__/_listingCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildListingPhotoCard, buildListingBrandFallbackCard } from '../_listingCard.js';

function countImgNodes(node: any): number {
  if (node == null) return 0;
  if (Array.isArray(node)) return node.reduce((s, n) => s + countImgNodes(n), 0);
  if (typeof node !== 'object') return 0;
  let c = node.type === 'img' ? 1 : 0;
  if (node.props?.children != null) c += countImgNodes(node.props.children);
  return c;
}
function findByText(node: any, text: string): boolean {
  if (node == null) return false;
  if (typeof node === 'string') return node === text;
  if (Array.isArray(node)) return node.some((n) => findByText(n, text));
  if (node.props?.children != null) return findByText(node.props.children, text);
  return false;
}

describe('buildListingPhotoCard', () => {
  const uri = 'data:image/jpeg;base64,AAA';

  it('写真を img ノードとして 1 つ描画する', () => {
    expect(countImgNodes(buildListingPhotoCard(uri))).toBe(1);
  });

  it('ぼかし背景レイヤーの backgroundImage が同じ写真を指す(配線ミス検知)', () => {
    const tree = buildListingPhotoCard(uri) as any;
    const bg = tree.props.children[0];
    expect(bg.props.style.backgroundImage).toContain(uri);
  });

  it('img の objectFit は contain(切らずに収める)', () => {
    const tree = buildListingPhotoCard(uri) as any;
    const img = tree.props.children[2];
    expect(img.type).toBe('img');
    expect(img.props.style.objectFit).toBe('contain');
  });

  it('タイトル/住所/ブランド印は含まない(「LoPo」文字が無い)', () => {
    expect(findByText(buildListingPhotoCard(uri), 'LoPo')).toBe(false);
  });

  it('SQUARE ENIX 著作権表記を必ず含む', () => {
    expect(findByText(buildListingPhotoCard(uri), '© SQUARE ENIX')).toBe(true);
  });

  it('全面レイヤーは inset:0 省略記法を使わず 4 辺個別指定(satori バグ回避)', () => {
    const tree = buildListingPhotoCard(uri) as any;
    const bg = tree.props.children[0].props.style;
    expect(bg.top).toBe(0);
    expect(bg.right).toBe(0);
    expect(bg.bottom).toBe(0);
    expect(bg.left).toBe(0);
    expect(bg.inset).toBeUndefined();
  });
});

describe('buildListingBrandFallbackCard', () => {
  it('「LoPo Housing」テキストを含む', () => {
    expect(findByText(buildListingBrandFallbackCard(), 'LoPo Housing')).toBe(true);
  });
  it('SQUARE ENIX 著作権表記を含む', () => {
    expect(findByText(buildListingBrandFallbackCard(), '© SQUARE ENIX')).toBe(true);
  });
  it('img ノードを含まない', () => {
    expect(countImgNodes(buildListingBrandFallbackCard())).toBe(0);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run api/og/__tests__/_listingCard.test.ts`
Expected: FAIL(モジュールが存在しない)

- [ ] **Step 3: `_listingCard.ts` を実装**

```ts
/**
 * `type=listing` カード用の要素ツリー + リクエストハンドラ。
 * api/og/index.ts の `type=listing` 分岐から呼ばれる(新規 Edge Function は作らない)。
 *
 * 目的: X 投稿由来の物件を X にシェアしても写真付きカードが出るようにする。
 * X は他サイトのカード画像として pbs.twimg.com(Twitter 自社 CDN)の画像を描画しないため、
 * 物件の代表写真をサーバー側で fetch し、1200×630 に整形した PNG を自ドメインから配る。
 *
 * 整形方式: 背景に同じ写真を cover(はみ出しトリミング)でぼかして敷き、その上に写真全体を
 * contain(切らずに収める)で重ねる。文字・枠・ブランド印は焼き込まない(masaya 指示)。
 * タイトル・住所は og:title / og:description から各 SNS が自前でカード文字部分に出す。
 *
 * satori の要素ツリーは実 JSX ではなくプレーンなオブジェクトリテラルで組み立てる
 * (既存 api/og/index.ts / _housingerCard.ts と同じ流儀)。
 */

import { ImageResponse } from '@vercel/og';
import { loadMPlus1Fonts, loadInterFonts } from './_fonts.js';
import { fetchAsDataUri } from './_fetchOgImage.js';
import { verifyListingOgCardSig } from '../../src/lib/ogpListingCard.js';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
/** ハウジングの背景色(正典 docs/.private/housing-tour-mockup 系統)。葉書外の下地に使う。 */
const BG_COLOR = '#111725';
/** ファンサイトポリシー対応の著作権表記。_housingerCard.ts / ja.json footer.copyright と同一文言。 */
const COPYRIGHT_TEXT = '© SQUARE ENIX';
const CACHE_HEADERS = {
  // URL に content-derived な sig が入るため、内容が変われば URL 自体が変わる = 実質 immutable。
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

/** satori は `inset: 0` 省略記法を描画できない(空描画になる)。全面レイヤーは 4 辺個別指定。 */
const FULL_BLEED_ABSOLUTE = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

/**
 * 著作権表記(全カード共通・下端中央)。写真の上に乗っても読めるよう強めのシャドウで縁取る。
 * _housingerCard.ts の buildCopyrightLine と同じスタイル方針(11px / Inter / 強シャドウ)。
 */
function buildCopyrightLine() {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: 14, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.9)',
            fontFamily: '"Inter"', letterSpacing: 0.2,
            textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)',
            display: 'flex',
          },
          children: COPYRIGHT_TEXT,
        },
      },
    },
  };
}

/**
 * 写真カード: ぼかし背景(cover)+ 軽い暗幕 + 写真本体(contain)+ 下端の © 表記。
 * タイトル・住所・ブランド印は焼き込まない(og:title / og:description が各 SNS のカード文字部分に出る)。
 */
export function buildListingPhotoCard(photoDataUri: string) {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        backgroundColor: BG_COLOR,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              ...FULL_BLEED_ABSOLUTE, display: 'flex',
              backgroundImage: `url(${photoDataUri})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'blur(24px)', transform: 'scale(1.15)',
            },
          },
        },
        {
          type: 'div',
          props: { style: { ...FULL_BLEED_ABSOLUTE, display: 'flex', backgroundColor: 'rgba(10,14,24,0.28)' } },
        },
        {
          type: 'img',
          props: {
            src: photoDataUri, width: CARD_WIDTH, height: CARD_HEIGHT,
            style: { position: 'relative', width: CARD_WIDTH, height: CARD_HEIGHT, objectFit: 'contain' },
          },
        },
        buildCopyrightLine(),
      ],
    },
  };
}

/**
 * 代表写真の URL はあるが取得に失敗した場合のフォールバック(「LoPo Housing」+ © 表記)。
 * _listingPageHandler は写真ゼロの物件では type=listing を呼ばない(DEFAULT_OG_IMAGE のまま)ため、
 * これが使われるのは「URL はあるが dead / WebP / timeout」のケースのみ。
 */
export function buildListingBrandFallbackCard() {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 64, fontWeight: 900, color: '#ffffff', letterSpacing: -1, display: 'flex' },
            children: 'LoPo Housing',
          },
        },
        buildCopyrightLine(),
      ],
    },
  };
}

/**
 * `type=listing` リクエストの本体。api/og/index.ts から委譲される。
 * 署名検証 → 写真の事前フェッチ(base64 化) → satori レンダリング。
 * 写真が取れない / レンダリング失敗時はブランドフォールバックカードで 200 を返す(500 を返さない)。
 * © 表記を焼き込むため写真カード経路でもフォントを読み込む(Inter=© 行 / M PLUS 1=フォールバックの見出し。
 * _housingerCard.ts の handleHousingerCardRequest と同じ二種読み込み)。
 */
export async function handleListingCardRequest(searchParams: URLSearchParams): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // 署名検証用の秘密鍵が未設定 = fail-closed(誰でも任意 URL で画像生成できることを防ぐ)。
    return new Response('OGP card unavailable', { status: 400 });
  }
  const validSig = await verifyListingOgCardSig(searchParams, cronSecret);
  if (!validSig) {
    return new Response('Invalid signature', { status: 400 });
  }

  const imgUrl = searchParams.get('img') || '';

  const loadFonts = async () => {
    const [mplus1, inter] = await Promise.all([
      loadMPlus1Fonts('LoPo Housing').catch(() => []),
      loadInterFonts([...new Set(COPYRIGHT_TEXT)].join('')).catch(() => []),
    ]);
    return [...mplus1, ...inter];
  };

  try {
    const photoDataUri = imgUrl ? await fetchAsDataUri(imgUrl) : null;
    const fonts = await loadFonts();
    const element = photoDataUri ? buildListingPhotoCard(photoDataUri) : buildListingBrandFallbackCard();
    return new ImageResponse(element as any, {
      width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS,
    });
  } catch (err) {
    console.error('Listing OG card error:', err);
    try {
      const fonts = await loadFonts();
      return new ImageResponse(buildListingBrandFallbackCard() as any, {
        width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS,
      });
    } catch (fallbackErr) {
      console.error('Listing OG card fallback error:', fallbackErr);
      return new Response('OG image generation failed', { status: 500 });
    }
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/og/__tests__/_listingCard.test.ts`
Expected: PASS(9 件)

- [ ] **Step 5: `api/og/index.ts` に分岐を追加**

`api/og/index.ts` の import 群に追加:

```ts
import { handleListingCardRequest } from './_listingCard.js';
```

`handleTourInviteCardRequest` の分岐(現行 47-49 行)の直後に追加:

```ts
        // 物件詳細ページ専用カード(署名付き URL のみ受理)。
        if (searchParams.get('type') === 'listing') {
            return handleListingCardRequest(searchParams);
        }
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
rtk git add api/og/_listingCard.ts api/og/__tests__/_listingCard.test.ts api/og/index.ts
rtk git commit -m "feat(og): type=listing カード(写真をぼかし背景+contain で1200x630整形)"
```

---

## Task 4: `_ogCacheLogic.ts` — `listing` 分岐

**Files:**
- Modify: `api/og-cache/_ogCacheLogic.ts`
- Modify: `api/og-cache/__tests__/_ogCacheLogic.test.ts`

**Interfaces:**
- Consumes: `buildListingOgCardUrl` from `../../src/lib/ogpListingCard.js`(Task 1)
- Produces: `OgImageMeta.imageUrl?: string`。`buildInternalOgUrl` が `meta.type === 'listing'` で署名付き URL を返す

- [ ] **Step 1: 失敗するテストを追記**

`api/og-cache/__tests__/_ogCacheLogic.test.ts` の `describe('buildInternalOgUrl', ...)` 内に追加:

```ts
  it('type=listing は secret 必須で署名付き URL を組み立てる', async () => {
    const url = await buildInternalOgUrl(
      'https://lopoly.app',
      { type: 'listing', imageUrl: 'https://pbs.twimg.com/media/abc.jpg' },
      'test-secret',
    );
    expect(url).toMatch(
      /^https:\/\/lopoly\.app\/api\/og\?type=listing&ver=1&img=https%3A%2F%2Fpbs\.twimg\.com%2Fmedia%2Fabc\.jpg&sig=[a-f0-9]{24}$/,
    );
  });

  it('type=listing で secret 未設定なら例外', async () => {
    await expect(
      buildInternalOgUrl('https://lopoly.app', { type: 'listing', imageUrl: 'https://x.test/a.jpg' }, undefined),
    ).rejects.toThrow();
  });
```

`describe('isValidOgImageMeta', ...)` 内に追加:

```ts
  it('type=listing は shareId 不要', () => {
    expect(isValidOgImageMeta({ type: 'listing', imageUrl: 'https://x.test/a.jpg' })).toBe(true);
  });
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run api/og-cache/__tests__/_ogCacheLogic.test.ts`
Expected: FAIL(`type=listing` の 2 件 — 現状は housinger/tour 用 URL ビルダーが無いので `buildInternalOgUrl` が page 型フォールバックに落ちて `img=` を含まない URL を返す)

- [ ] **Step 3: 実装**

`api/og-cache/_ogCacheLogic.ts`:

import 追加:

```ts
import { buildListingOgCardUrl } from '../../src/lib/ogpListingCard.js';
```

`OgImageMeta` インターフェースに 1 行追加:

```ts
export interface OgImageMeta {
  type?: string;
  shareId?: string; showLogo?: boolean; logoHash?: string | null; lang?: string;
  pattern?: string; name?: string; bio?: string | null; avatarUrl?: string | null; imageUrls?: string[];
  /** type='listing' 用: 物件の代表写真 URL。 */
  imageUrl?: string;
}
```

`buildInternalOgUrl` の `meta.type === 'tour'` 分岐(現行 35-38 行)の直後に追加:

```ts
  if (meta.type === 'listing') {
    if (!cronSecret) throw new Error('CRON_SECRET not configured');
    return buildListingOgCardUrl(origin, { img: meta.imageUrl ?? '' }, cronSecret);
  }
```

（`isValidOgImageMeta` は現状「`type` 有りは無条件 true」なので `listing` はそのまま通る。変更不要。上の isValid テストは現行ロジックで既に緑になる — 回帰防止として残す。）

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/og-cache/__tests__/_ogCacheLogic.test.ts`
Expected: PASS(既存 + 追加 3 件)

- [ ] **Step 5: コミット**

```bash
rtk git add api/og-cache/_ogCacheLogic.ts api/og-cache/__tests__/_ogCacheLogic.test.ts
rtk git commit -m "feat(og-cache): og_image_meta の type=listing 分岐"
```

---

## Task 5: `_listingPageHandler.ts` — og:image を再ホスト方式に差し替え

**Files:**
- Modify: `api/share/_listingPageHandler.ts`
- Modify: `api/share/__tests__/_listingPageHandler.test.ts`

**Interfaces:**
- Consumes:
  - `buildListingOgCardParams` from `../../src/lib/ogpListingCard.js`(Task 1)
  - `computeOgCardImageHash` from `../../src/lib/ogpImageHash.js`(既存)
  - `getStorage` from `firebase-admin/storage`(既存 firebase-admin)

- [ ] **Step 1: 既存テストを新仕様に更新(失敗させる)**

`api/share/__tests__/_listingPageHandler.test.ts`:

1. `firebase-admin/firestore` モック(現行 12-20 行)を、`og_image_meta` への `.set` に対応させる:

```ts
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGetFn,
        set: vi.fn(async () => undefined),
      })),
    })),
  })),
}));
```

2. `firebase-admin/storage` モックを新規追加(ファイル冒頭のモック群に):

```ts
vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({ exists: vi.fn(async () => [true]) })),
    })),
  })),
}));
```

(`exists → [true]` にしておくと warm-up fetch がスキップされ、テストの fetch モックが index.html 専用のままで済む)

3. `thumbnail物件はog:imageに家の写真(.png兄弟の絶対URL)を使う` を書き換え:

```ts
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
```

4. `家の写真をog:imageに採用したときは固定のog:image:width/height(1200x630)を削除する` を反転:

```ts
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
```

5. `画像の無い物件(テキストツイート等)はog:imageがDEFAULT_OG_IMAGEのまま` と `画像の無い物件(フォールバック)は固定のog:image:width(1200)を残す` は**変更不要**(写真ゼロ経路は不変)。

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run api/share/__tests__/_listingPageHandler.test.ts`
Expected: 書き換えた 2 件が FAIL(まだハンドラーが旧仕様)

- [ ] **Step 3: `_listingPageHandler.ts` を実装**

import 追加(現行 10-16 行の import 群に):

```ts
import { getStorage } from 'firebase-admin/storage';
import { buildListingOgCardParams } from '../../src/lib/ogpListingCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';
```

定数追加(`DEFAULT_OG_IMAGE` の近くに):

```ts
/** api/og-cache/index.ts と同じバケット(OGP カードの永続キャッシュ先)。 */
const OG_STORAGE_BUCKET = 'lopo-7793e.firebasestorage.app';
```

`usedListingPhoto` 変数を削除(現行 50-52 行のコメント + `let usedListingPhoto = false;`)。

代表画像ブロック(現行 108-115 行)を差し替え:

```ts
        // OGP 画像: この家の代表写真を「自ドメインの整形済みカード」として配る。
        // X は他サイトのカード画像として pbs.twimg.com(Twitter 自社 CDN)を描画しないため、
        // 写真 URL をそのまま og:image にすると X 投稿由来の物件が画像なしカードになる
        // (Discord 等は出る)。写真 URL から内容ハッシュを作り、既存の安全なキャッシュ経路
        // (/og/{hash}.png・Storage + 長期キャッシュ・週次クリーンアップ cron)に乗せる。
        // _housingerPageHandler.ts の card-hash / meta / warm-up パターンと同型。
        const repImages = listingRepresentativeImages(projected as Record<string, unknown>);
        const rawPhoto = repImages[0];
        if (rawPhoto) {
          const photoUrl = /^https?:\/\//.test(rawPhoto) ? rawPhoto : `${origin}${rawPhoto}`;
          try {
            const params = buildListingOgCardParams({ img: photoUrl });
            const hash = computeOgCardImageHash(params);
            await db.collection('og_image_meta').doc(hash).set({
              type: 'listing',
              imageUrl: photoUrl,
              createdAt: Date.now(),
              lastAccessedAt: Date.now(),
            });
            const cardUrl = `${origin}/og/${hash}.png`;
            try {
              const bucket = getStorage().bucket(OG_STORAGE_BUCKET);
              const [exists] = await bucket.file(`og-images/${hash}.png`).exists();
              if (!exists) {
                // 未キャッシュ = このリクエストが初回。ここで生成させておけば後続の
                // クローラーが生成待ちにならない。失敗は握りつぶす(次リクエストで再試行)。
                await fetch(cardUrl, { headers: { 'User-Agent': 'LoPo-ListingWarmup/1.0' } });
              }
            } catch (warmErr) {
              console.error('Listing OG card warm-up error:', warmErr);
            }
            ogImageUrl = cardUrl;
          } catch (err) {
            // Firestore/Storage 障害時の degraded パス: 従来どおり生 URL(Discord では出る)。
            console.error('Listing OG card hash/meta error:', err);
            ogImageUrl = photoUrl;
          }
        }
        // rawPhoto が無ければ ogImageUrl は DEFAULT_OG_IMAGE('/api/og')のまま = 現状維持。
```

width/height 削除ブランチ(現行 143-151 行の `if (usedListingPhoto) { ... }` とそのコメント)を丸ごと削除。
`seoSnapshotHtml` の inject(現行 152 行)以降はそのまま。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/share/__tests__/_listingPageHandler.test.ts`
Expected: PASS(全件 — 書き換えた 2 件 + 不変の既存件)

- [ ] **Step 5: 型チェック**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: エラーなし(`usedListingPhoto` の削除漏れ・未使用 import に注意)

- [ ] **Step 6: コミット**

```bash
rtk git add api/share/_listingPageHandler.ts api/share/__tests__/_listingPageHandler.test.ts
rtk git commit -m "fix(housing): 物件OGP画像を自ドメイン再ホスト方式に(X投稿由来の画像なしカード致命バグ)"
```

---

## Task 6: ローカルプレビュー — `objectFit: contain` の見た目を確認

satori の `object-fit: contain` が期待どおり(縦長/横長/正方形を切らずに 1200×630 に収める)動くかを、デプロイ前にローカルで目視確認する。**これは検証タスク。** ここで破綻が見つかったら `buildListingPhotoCard`(Task 3)を直して再コミットする。

**Files:**
- Create: `scripts/preview-listing-og-card.mjs`(使い捨て)

- [ ] **Step 1: プレビュースクリプトを書く**

`scripts/preview-listing-og-card.mjs`:

**ラスタライズ手段**: `@resvg/resvg-js` はこの環境に**無い**。`sharp`(あり)で SVG→PNG する。
`satori` はあり。`buildListingPhotoCard` は `.ts` なので `.mjs` から直接 import できない →
スクリプト内に同等のツリー生成をインラインコピーする(使い捨てなので可)。

```js
// 使い捨て: buildListingPhotoCard 相当の見た目をローカルで PNG 出力する。
// 実行: node scripts/preview-listing-og-card.mjs
// 出力: scripts/_preview-listing-{wide,tall,square}.png
import satori from 'satori';
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

// api/og/_listingCard.ts の buildListingPhotoCard と同じツリー(© 行含む)をインラインで再現。
// _listingCard.ts を編集したらここも合わせること(このスクリプトは確認用の使い捨て)。
const FULL_BLEED = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };
function buildListingPhotoCard(photoDataUri) {
  return { type: 'div', props: { style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: '#111725' }, children: [
    { type: 'div', props: { style: { ...FULL_BLEED, display: 'flex', backgroundImage: `url(${photoDataUri})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(24px)', transform: 'scale(1.15)' } } },
    { type: 'div', props: { style: { ...FULL_BLEED, display: 'flex', backgroundColor: 'rgba(10,14,24,0.28)' } } },
    { type: 'img', props: { src: photoDataUri, width: 1200, height: 630, style: { position: 'relative', width: 1200, height: 630, objectFit: 'contain' } } },
    { type: 'div', props: { style: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center' }, children: { type: 'div', props: { style: { fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.9)', fontFamily: '"Inter"', letterSpacing: 0.2, textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)', display: 'flex' }, children: '© SQUARE ENIX' } } } },
  ] } };
}

// 手元の適当な画像 3 枚(横長/縦長/正方形)。無ければ下記の単色 SVG data URI 生成で代用する。
// FF14 スクショが手元にあれば置き換える(pbs.twimg / YouTube サムネの URL 文字列でも可 = fetch する)。
const samples = {
  wide: solidSvgDataUri(1600, 900, '#3b6ea5'),
  tall: solidSvgDataUri(900, 1600, '#a5623b'),
  square: solidSvgDataUri(1200, 1200, '#3ba56e'),
};

function solidSvgDataUri(w, h, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" fill="#fff" font-size="80" text-anchor="middle">${w}x${h}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function toDataUri(srcOrUri) {
  if (srcOrUri.startsWith('data:')) return srcOrUri;
  if (/^https?:\/\//.test(srcOrUri)) {
    const buf = Buffer.from(await (await fetch(srcOrUri)).arrayBuffer());
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  const buf = readFileSync(srcOrUri);
  const mime = srcOrUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// © 行のフォント(Inter)を Google Fonts から取得。_fonts.ts の loadInterFonts と同じ手法。
const cssUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@500&text=' +
  encodeURIComponent('© SQUARE ENIX');
const css = await (await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)[1];
const fontData = await (await fetch(fontUrl)).arrayBuffer();
const fonts = [{ name: 'Inter', data: fontData, style: 'normal', weight: 500 }];

for (const [label, src] of Object.entries(samples)) {
  const tree = buildListingPhotoCard(await toDataUri(src));
  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(`scripts/_preview-listing-${label}.png`, png);
  console.log(`wrote scripts/_preview-listing-${label}.png`);
}
```

(`satori` と `sharp` はこの環境にある。`@resvg/resvg-js` は**無い**ので sharp で SVG→PNG する。
`_listingCard.ts` は `.ts` で `.mjs` から直接 import できないため `buildListingPhotoCard` 相当を
インラインコピー済み — 使い捨てスクリプトなので可。`_listingCard.ts` を編集したらこのインラインも合わせる)

- [ ] **Step 2: 実行して 3 枚の PNG を目視**

Run: `node scripts/preview-listing-og-card.mjs`
確認:
- 横長(16:9): 写真がほぼ全面、上下にわずかにぼかし帯 → OK
- 縦長(9:16): 写真が中央に立ち、左右がぼかし帯 → OK(切れていないこと)
- 正方形: 写真が中央、左右がぼかし帯 → OK

**破綻していたら**(`objectFit` が効かず引き伸ばし/切れ)、`api/og/_listingCard.ts` の
`buildListingPhotoCard` の img を調整(スクリプトのインラインも同じに合わせる):
- 代替案: img を `div`(`display:flex`, `alignItems/justifyContent:center`)でラップし、
  img 側を `style: { maxWidth: 1200, maxHeight: 630 }` にする。
- 直したら `npx vitest run api/og/__tests__/_listingCard.test.ts`(children[2] が img で maxWidth 持ち等、
  テストの該当アサーションも直す)→ `npx tsc -p tsconfig.api.json --noEmit` → このタスクのコミットに含める
  (`fix(og): 物件カードの写真フィットを調整`)。

- [ ] **Step 3: masaya に 3 枚を見せて確認**

`SendUserFile` で `scripts/_preview-listing-{wide,tall,square}.png` を送り、見た目 OK かひとこともらう。
(NG なら調整して再送。OK なら次へ)

- [ ] **Step 4: 使い捨てスクリプトを削除してコミット**

```bash
rtk git rm scripts/preview-listing-og-card.mjs
rm -f scripts/_preview-listing-*.png
rtk git commit -m "chore: 物件OGPカードのプレビュースクリプトを削除(確認済み)"
```

(スクリプトを次セッションの微調整用に残す判断もあり。その場合は `_preview-*.png` だけ `.gitignore` 済みか確認して未コミットのまま放置)

---

## Task 7: push 前フルゲート + TODO 更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: exit 0(tsc -b 厳密・未使用変数が罠 [[feedback_vercel_tsc_strict]])

- [ ] **Step 2: 関連テストをまとめて実行**

Run:
```
npx vitest run src/lib/__tests__/ogpListingCard.test.ts api/og/__tests__/_fetchOgImage.test.ts api/og/__tests__/_listingCard.test.ts api/og/__tests__/_housingerCard.test.ts api/og-cache/__tests__/_ogCacheLogic.test.ts api/share/__tests__/_listingPageHandler.test.ts
```
Expected: 全 PASS

- [ ] **Step 3: フルスイート(push 前ゲート・要約のみ取り込む)**

Run: `npx vitest run 2>&1 | tail -30`
Expected: 既知の失敗(EphemeralAddPanel 7 件・TopBar4 + HousingWorkspace1)以外は緑。
ハングしたら早期 kill([[feedback_test_run_cost_discipline]])。

- [ ] **Step 4: `docs/TODO.md` を更新**

「次の作業順」1 番を完了に。「現在の状態」の 🔴 行を更新:
- 1 番の項目本文を「= 実装・全テスト緑・**デプロイ待ち**(masaya が X 実機確認 → 完了なら TODO_COMPLETED へ)」に置換
- 「次の作業順」は 2 番(MIL-SPEC)が先頭に繰り上がる形に番号を振り直す
- 100 行以内を維持(`wc -l docs/TODO.md`)

- [ ] **Step 5: コミット**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs: 物件OGPカード実装完了・デプロイ待ちに更新"
```

- [ ] **Step 6: masaya に報告**

- 変更ファイル一覧
- 「push 前ゲート緑」の証拠(build exit 0 / 関連テスト件数)
- 次アクション: デプロイ → X で実物確認(§下記)
- 見た目承認は Task 6 で取得済(© は短縮形 `© SQUARE ENIX`・masaya 2026-09-02)

---

## デプロイ後の検証(masaya 依頼)

1. X 投稿由来の物件(`imageMode:'sns'`)の URL を X の投稿 or [Card Validator] に貼り、**写真付きカード**が出ることを確認(最優先)
2. 直接アップロード物件・YouTube 物件の URL も同様に確認
3. Discord に貼って従来どおり写真が出ることを確認(退行なし)
4. Firebase Storage `og-images/` に `listing` 由来の hash ファイルが増えているか確認
5. 縦長写真の物件があれば、カードで切れずに収まっているか確認

---

## Self-Review(この計画を書いた後のチェック結果)

**Spec coverage:**
- §2 解決方針(再ホスト・ぼかし背景 + contain・タイトル/住所/ブランド印なし・© 1 行のみ)→ Task 3 `buildListingPhotoCard`
- §3 新規/変更ファイル → Task 1〜5 で全カバー
- §4.1 `_listingPageHandler` の選定ロジック → Task 5 Step 3
- §4.2 width/height 宣言を残す → Task 5 Step 3(削除ブランチ撤去)+ Task 5 Step 1 のテスト反転
- §4.3 `_listingCard.ts` フォールバック挙動 → Task 3
- §4.4 署名ヘルパー → Task 1
- §4.5 og-cache 分岐 → Task 4
- §5 既存テスト更新 → Task 5 Step 1
- §6 コスト(ハッシュ dedup / immutable / 30 日 cron)→ 実装は既存機構の再利用、Task 5 で meta に `lastAccessedAt` を書く
- §7 ローカルプレビュー + push 前ゲート → Task 6 / Task 7
- §9 → **masaya 2026-09-02 決定「入れる」**。Task 3 で全カード下端に © 1 行を焼き込む(`buildCopyrightLine` / Inter / 11px)。写真カード経路もフォント読み込みが必要になった。

**Placeholder scan:** コード無しステップなし。全ステップに実コード or 実コマンド。`scripts/preview-listing-og-card.mjs` はサンプル画像を単色 SVG data URI で自動生成(手元に FF14 スクショがあれば置換可)= プレースホルダなし。

**Type consistency:**
- `buildListingOgCardParams({ img })` — Task 1 で定義、Task 4 / Task 5 で同じシグネチャで使用 ✓
- `buildListingOgCardUrl(origin, { img }, secret)` — Task 1 定義、Task 4 使用 ✓
- `fetchAsDataUri(url): Promise<string | null>` — Task 2 定義、Task 3 使用 ✓
- `buildListingPhotoCard(photoDataUri)` / `buildListingBrandFallbackCard()` — Task 3 で定義・テスト・使用 ✓
- `computeOgCardImageHash(params: URLSearchParams)` — 既存(`src/lib/ogpImageHash.ts`)、Task 5 使用 ✓
- `OgImageMeta.imageUrl` — Task 4 で追加、Task 5 が書く meta の形と一致(`{ type:'listing', imageUrl, createdAt, lastAccessedAt }`)✓
