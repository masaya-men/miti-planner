# ハウジング カード画像の最適化 Phase 1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カード画像を表示サイズに見合った WebP 派生に差し替え、iOS Safari のデコード画像メモリ超過による「壊れ画像 glyph」とロード遅延を解消する。

**Architecture:** 直接アップロード画像に 480/960/1440px の WebP 派生をアップロード時 + バックフィルで作り置きし、`srcset` で端末が最適サイズを選ぶ。X 画像は URL に `?name=small` を付けるだけ(保存しない)。直接アップロード分に ThumbHash のぼかしプレースホルダ。ambient スライドショーは全フレーム常時マウント → 3 枚窓へ。派生 URL は文字列加工で導出し Firestore スキーマは `coverThumbHash?: string` の追加のみ。リリースは「サーバー先行 → バックフィル全件成功を検証 → 表示側」の 3 段階。

**Tech Stack:** TypeScript / React / Vite / Firebase Admin SDK / `sharp`(既存)/ `thumbhash`(新規)/ Vercel Serverless Functions(api、NodeNext モジュール)/ vitest。

**Spec:** `docs/superpowers/specs/2026-08-31-housing-card-image-optimization-phase1-design.md`

## Global Constraints

- **派生フォーマット: WebP のみ**(AVIF は作らない)。品質 `quality: 78`。
- **派生幅: `480 / 960 / 1440` の 3 種**(定数 `HOUSING_CARD_DERIVATIVE_WIDTHS`)。原本(≤1920px)はカードの `srcSet` には入れず、詳細メインステージ用にのみ `1920w` 候補として使う。
- **派生ファイル命名**: 元 Storage パス `housing/listings/{id}/{uuid}.{ext}` → 兄弟 `{uuid}-{width}.webp`。元 URL `https://lopoly.app/housing-media/{id}/{uuid}.{ext}` → `.../{uuid}-{width}.webp`。生成側(`api/housing/_imageArrayLogic.ts`)と表示側(`src/lib/housing/housingMediaUrl.ts`)で**同一規則・パリティテストで担保**(既存の `toPngSiblingPath` / `buildHousingMediaUrl` と同じ流儀)。
- **派生 + `.png` 兄弟の生成は必須**(失敗したらアップロードを 500 で失敗させる)。表示側が `srcSet` で参照するため 1 枚でも欠けると壊れ画像になる。現状 best-effort の `.png` 兄弟もここで必須化する。
- **ThumbHash は `imageMode='thumbnail'` の代表画像 1 枚のみ**。X / YouTube / 生成失敗分は従来どおり背景色。`coverThumbHash` は base64 文字列(約 40 文字)。
- **Firestore スキーマ変更は `coverThumbHash?: string` の 1 フィールドのみ**。`thumbnailPaths` はいじらない。
- **ハウジング配下は独自トンマナ**: CSS は `src/styles/housing.css` の `--housing-*` トークン経由(ハードコード禁止)。文字列は i18n キー経由(本タスクにユーザー可視文字列の新規追加は無い想定)。
- **push 前ゲート**: `npm run build`(tsc -b + tsc api + vite build)+ 変更ファイルに絞った `npm test -- <files>`。フルスイートは既知のハングのため回さない。
- **rtk プレフィックス**: すべてのコマンドを `rtk` で始める(`rtk npm test -- ...` 等)。
- **リリース 3 段階(順序厳守)**:
  1. サーバー先行(Task 5,6,7 → デプロイ)。表示側はまだ原本参照 = 挙動不変。
  2. バックフィル `--apply`(Task 8)。全 74 件・失敗 0 を確認。
  3. 表示側(Task 9〜12 → デプロイ)。

---

## ファイル構成

**新規(純関数・lib)**
- `src/lib/housing/twitterImageVariant.ts` — X 画像 URL の `?name=` 加工
- `src/lib/housing/slideshowWindow.ts` — スライドショーの表示 index 窓
- `src/lib/housing/cardImageAttrs.ts` — `<img>` の `src`/`srcSet`/`sizes` 組み立て + `smallHousingImageUrl` + `CARD_IMAGE_SIZES`
- `api/housing/_coverThumbHash.ts` — 画像 Buffer → ThumbHash base64
- `scripts/backfill-listing-card-derivatives.ts` — 既存 74 件の派生 + `.png` + `coverThumbHash` バックフィル

**変更(サーバー/API)**
- `api/housing/_imageArrayLogic.ts` — `HOUSING_CARD_DERIVATIVE_WIDTHS` / `toDerivativePath()` 追加
- `api/housing/_imageFormatConvert.ts` — `resizeToWebp()` 追加
- `api/housing/_uploadThumbnailHandler.ts` — 派生生成(必須)+ `.png` 必須化 + `coverThumbHash` 保存
- `api/housing/_publicWindow.ts` — `SELECT_FIELDS` に `coverThumbHash`

**変更(クライアント lib / 型)**
- `src/lib/housing/housingMediaUrl.ts` — `housingImageVariant()` 追加
- `src/lib/housing/publicListingProjection.ts` — `SAFE_FIELDS` に `coverThumbHash`
- `src/lib/housing/galleryAdapter.ts` — `coverThumbHash` pass-through(2 箇所)
- `src/types/housing.ts` — `HousingListing.coverThumbHash?: string`
- `src/data/housing/mockListings.ts` — `MockListing.coverThumbHash?: string`

**変更(コンポーネント/CSS)**
- `src/components/housing/browse/ListingCard.tsx` — メイン `<img>` に `cardImageAttrs` / `decoding` / ThumbHash ぼかしレイヤー / `onLoad` フェード
- `src/components/housing/workspace/HousingCardAmbientSlideshow.tsx` — 3 枚窓 + 各フレームに `cardImageAttrs` / `decoding`
- `src/components/housing/listing/HousingPhotoGallery.tsx` — サムネ 480w / メインステージ 960+1440(+原本)
- `src/styles/housing.css` — `.housing-listing-card-blur` + トークン `--housing-card-blur-fade`

**依存追加**
- `thumbhash`(npm・MIT・zero-deps・約 2KB)

---

## Task 1: 派生 URL 導出ヘルパー(サーバー + クライアント + パリティ)

**Files:**
- Modify: `api/housing/_imageArrayLogic.ts`(`toPngSiblingPath` の下に追記)
- Modify: `src/lib/housing/housingMediaUrl.ts`(`buildHousingMediaUrl` の下に追記)
- Test: `src/lib/housing/__tests__/housingMediaUrl.test.ts`(パリティ describe を追記)

**Interfaces:**
- Produces:
  - `HOUSING_CARD_DERIVATIVE_WIDTHS: readonly [480, 960, 1440]`(`_imageArrayLogic.ts`)
  - `toDerivativePath(path: string, width: 480 | 960 | 1440): string`(`_imageArrayLogic.ts`)
  - `housingImageVariant(url: string, width: 480 | 960 | 1440): string`(`housingMediaUrl.ts`)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/housingMediaUrl.test.ts` の末尾に追記:

```ts
import { housingImageVariant } from '../housingMediaUrl';
import { toDerivativePath, HOUSING_CARD_DERIVATIVE_WIDTHS } from '../../../../api/housing/_imageArrayLogic.js';

describe('housingImageVariant', () => {
  it('housing-media の webp を派生 URL に差し替える', () => {
    expect(
      housingImageVariant('https://lopoly.app/housing-media/L1/uuid-abc.webp', 480),
    ).toBe('https://lopoly.app/housing-media/L1/uuid-abc-480.webp');
    expect(
      housingImageVariant('https://lopoly.app/housing-media/L1/uuid-abc.webp', 1440),
    ).toBe('https://lopoly.app/housing-media/L1/uuid-abc-1440.webp');
  });

  it('jpg/png 元でも派生は -{w}.webp になる', () => {
    expect(
      housingImageVariant('https://lopoly.app/housing-media/L1/uuid-abc.jpg', 960),
    ).toBe('https://lopoly.app/housing-media/L1/uuid-abc-960.webp');
  });

  it('クエリ付き URL でも拡張子だけ差し替える', () => {
    expect(
      housingImageVariant('https://lopoly.app/housing-media/L1/u.webp?v=2', 480),
    ).toBe('https://lopoly.app/housing-media/L1/u-480.webp?v=2');
  });

  it('housing-media 以外(X 画像・旧 firebasestorage・pngパス)は素通し', () => {
    for (const u of [
      'https://pbs.twimg.com/media/ABC.jpg',
      'https://firebasestorage.googleapis.com/v0/b/x/o/housing%2Flistings%2FL1%2Fu.webp?alt=media',
      'https://lopoly.app/housing-media/L1/u.png',
      'not-a-url',
    ]) {
      expect(housingImageVariant(u, 480)).toBe(u);
    }
  });
});

describe('toDerivativePath / housingImageVariant パリティ', () => {
  it('同じ論理入力に対して同じファイル名になる', () => {
    const storagePath = 'housing/listings/L1/uuid-abc.webp';
    const url = 'https://lopoly.app/housing-media/L1/uuid-abc.webp';
    for (const w of HOUSING_CARD_DERIVATIVE_WIDTHS) {
      const derivedStorageBasename = toDerivativePath(storagePath, w).split('/').pop();
      const derivedUrlBasename = housingImageVariant(url, w).split('/').pop();
      expect(derivedUrlBasename).toBe(derivedStorageBasename);
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/housingMediaUrl.test.ts`
Expected: FAIL(`toDerivativePath` / `housingImageVariant` が未定義)

- [ ] **Step 3: `_imageArrayLogic.ts` に追記**

`api/housing/_imageArrayLogic.ts` の `toPngSiblingPath` 関数の直後に:

```ts
/**
 * カード用の縮小 WebP 派生の対応幅。srcset の候補になる。原本(≤1920px)は含めない。
 * 表示側(src/lib/housing/housingMediaUrl.ts の housingImageVariant)と同一。
 */
export const HOUSING_CARD_DERIVATIVE_WIDTHS = [480, 960, 1440] as const;

/**
 * カード用の縮小 WebP 派生ファイルの Storage パスを組み立てる。
 * `{uuid}.{ext}` → `{uuid}-{width}.webp`(派生は常に webp・元形式に依らない)。
 * _uploadThumbnailHandler.ts(生成側)と housingImageVariant(表示側)で同一規則。
 */
export function toDerivativePath(
  path: string,
  width: (typeof HOUSING_CARD_DERIVATIVE_WIDTHS)[number],
): string {
  return path.replace(/\.(webp|avif|jpe?g|png)$/i, `-${width}.webp`);
}
```

- [ ] **Step 4: `housingMediaUrl.ts` に追記**

`src/lib/housing/housingMediaUrl.ts` の `buildHousingMediaUrl` の直後に:

```ts
/**
 * housing-media の画像 URL を、カード用の縮小 WebP 派生 URL に差し替える。
 * `https://lopoly.app/housing-media/{id}/{uuid}.{ext}` → `.../{uuid}-{width}.webp`。
 * housing-media ドメインの画像でなければ(X 画像・旧 firebasestorage URL・.png 兄弟)そのまま返す。
 * api/housing/_imageArrayLogic.ts の toDerivativePath と同一規則(パリティテストで担保)。
 */
export function housingImageVariant(url: string, width: 480 | 960 | 1440): string {
  try {
    const u = new URL(url);
    if (u.hostname !== 'lopoly.app' || !u.pathname.startsWith('/housing-media/')) return url;
    if (!/\.(webp|avif|jpe?g|png)(?:$|\?)/i.test(url)) return url;
    return url.replace(/\.(webp|avif|jpe?g|png)(?=$|\?)/i, `-${width}.webp`);
  } catch {
    return url;
  }
}
```

- [ ] **Step 5: テストを実行して通過を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/housingMediaUrl.test.ts`
Expected: PASS(既存 + 新規すべて)

- [ ] **Step 6: コミット**

```bash
rtk git add api/housing/_imageArrayLogic.ts src/lib/housing/housingMediaUrl.ts src/lib/housing/__tests__/housingMediaUrl.test.ts
rtk git commit -m "feat(housing): カード画像の派生URL導出ヘルパー(toDerivativePath / housingImageVariant)"
```

---

## Task 2: X 画像 URL の `?name=` 加工

**Files:**
- Create: `src/lib/housing/twitterImageVariant.ts`
- Test: `src/lib/housing/__tests__/twitterImageVariant.test.ts`

**Interfaces:**
- Produces:
  - `type TwitterImageName = 'thumb' | 'small' | 'medium' | 'large' | 'orig'`
  - `twitterImageVariant(url: string, name: TwitterImageName): string`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/twitterImageVariant.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { twitterImageVariant } from '../twitterImageVariant';

describe('twitterImageVariant', () => {
  it('pbs.twimg.com/media の .jpg に ?name= を付ける', () => {
    expect(twitterImageVariant('https://pbs.twimg.com/media/ABC.jpg', 'small')).toBe(
      'https://pbs.twimg.com/media/ABC.jpg?name=small',
    );
  });

  it('既存クエリがあればマージする', () => {
    expect(twitterImageVariant('https://pbs.twimg.com/media/ABC.jpg?format=jpg', 'small')).toBe(
      'https://pbs.twimg.com/media/ABC.jpg?format=jpg&name=small',
    );
  });

  it('既に name= があれば上書きする', () => {
    expect(twitterImageVariant('https://pbs.twimg.com/media/ABC.jpg?name=large', 'small')).toBe(
      'https://pbs.twimg.com/media/ABC.jpg?name=small',
    );
  });

  it('media 以外の pbs.twimg.com(amplify_video_thumb 等)は素通し', () => {
    const u = 'https://pbs.twimg.com/amplify_video_thumb/123/img/xyz.jpg';
    expect(twitterImageVariant(u, 'small')).toBe(u);
  });

  it('pbs.twimg.com 以外(YouTube・housing-media)は素通し', () => {
    for (const u of [
      'https://img.youtube.com/vi/ID/hqdefault.jpg',
      'https://lopoly.app/housing-media/L1/u.webp',
      'garbage',
    ]) {
      expect(twitterImageVariant(u, 'small')).toBe(u);
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/twitterImageVariant.test.ts`
Expected: FAIL(モジュール未作成)

- [ ] **Step 3: 実装**

`src/lib/housing/twitterImageVariant.ts`:

```ts
/**
 * X (Twitter) の画像 URL をサイズ指定付きに加工する純関数(保存はしない)。
 * `pbs.twimg.com/media/xxxxx.jpg` → `...jpg?name=small`(680px・実測約46KB)。
 * `/media/` 以外(amplify_video_thumb 等)や pbs.twimg.com 以外はそのまま返す。
 * カード / 詳細サムネで縮小版('small')を、詳細メインステージでは加工なし(原寸1200px)を使う。
 */
export type TwitterImageName = 'thumb' | 'small' | 'medium' | 'large' | 'orig';

export function twitterImageVariant(url: string, name: TwitterImageName): string {
  try {
    const u = new URL(url);
    if (u.hostname !== 'pbs.twimg.com' || !u.pathname.startsWith('/media/')) return url;
    u.searchParams.set('name', name);
    return u.toString();
  } catch {
    return url;
  }
}
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/twitterImageVariant.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/twitterImageVariant.ts src/lib/housing/__tests__/twitterImageVariant.test.ts
rtk git commit -m "feat(housing): X画像URLの ?name= 加工ヘルパー twitterImageVariant"
```

---

## Task 3: スライドショーの表示 index 窓

**Files:**
- Create: `src/lib/housing/slideshowWindow.ts`
- Test: `src/lib/housing/__tests__/slideshowWindow.test.ts`

**Interfaces:**
- Produces: `slideshowWindowIndices(n: number, index: number): number[]`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/slideshowWindow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slideshowWindowIndices } from '../slideshowWindow';

describe('slideshowWindowIndices', () => {
  it('n<=3 は全 index を返す', () => {
    expect(slideshowWindowIndices(1, 0)).toEqual([0]);
    expect(slideshowWindowIndices(2, 1)).toEqual([0, 1]);
    expect(slideshowWindowIndices(3, 2)).toEqual([0, 1, 2]);
  });

  it('n=4 は {prev, cur, next} の3枚', () => {
    expect(slideshowWindowIndices(4, 0)).toEqual([3, 0, 1]);
    expect(slideshowWindowIndices(4, 1)).toEqual([0, 1, 2]);
    expect(slideshowWindowIndices(4, 3)).toEqual([2, 3, 0]);
  });

  it('index が範囲外でも環状に正規化する', () => {
    expect(slideshowWindowIndices(4, 5)).toEqual([0, 1, 2]);
    expect(slideshowWindowIndices(4, -1)).toEqual([2, 3, 0]);
  });

  it('n<=0 は空配列', () => {
    expect(slideshowWindowIndices(0, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/slideshowWindow.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/lib/housing/slideshowWindow.ts`:

```ts
/**
 * スライドショーで実際に <img> をマウントすべきフレーム index の集合を返す(純関数)。
 * クロスフェードは「現在＋退場」の2枚で足りるが、退場フレームがフェードし切るまで1ステップ
 * 残すため {prev, cur, next} の3枚窓にする。フレーム総数が3以下なら全 index。
 * 返り値は 0..n-1(環状: index=0 の prev は n-1)。
 */
export function slideshowWindowIndices(n: number, index: number): number[] {
  if (n <= 0) return [];
  if (n <= 3) return Array.from({ length: n }, (_, i) => i);
  const i = ((index % n) + n) % n;
  return [(i - 1 + n) % n, i, (i + 1) % n];
}
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/slideshowWindow.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/slideshowWindow.ts src/lib/housing/__tests__/slideshowWindow.test.ts
rtk git commit -m "feat(housing): スライドショーの3枚窓 index 純関数 slideshowWindowIndices"
```

---

## Task 4: `<img>` 属性ビルダー `cardImageAttrs`

**Files:**
- Create: `src/lib/housing/cardImageAttrs.ts`
- Test: `src/lib/housing/__tests__/cardImageAttrs.test.ts`

**Interfaces:**
- Consumes: `housingImageVariant`(Task 1)、`twitterImageVariant` / `TwitterImageName`(Task 2)
- Produces:
  - `CARD_IMAGE_SIZES: string`(カード / スライドショー共通の `sizes`)
  - `interface CardImageAttrs { src: string; srcSet?: string; sizes?: string }`
  - `cardImageAttrs(url: string, opts?: CardImageAttrsOptions): CardImageAttrs`
  - `smallHousingImageUrl(url: string): string`(srcSet を使わない小サムネ用に、一番小さい実体 URL を返す)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/cardImageAttrs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardImageAttrs, smallHousingImageUrl, CARD_IMAGE_SIZES } from '../cardImageAttrs';

const HM = 'https://lopoly.app/housing-media/L1/u.webp';
const TW = 'https://pbs.twimg.com/media/ABC.jpg';
const YT = 'https://img.youtube.com/vi/ID/hqdefault.jpg';

describe('cardImageAttrs', () => {
  it('housing-media webp → 3幅の srcSet + 元 src + sizes', () => {
    const a = cardImageAttrs(HM, { sizes: CARD_IMAGE_SIZES });
    expect(a.src).toBe(HM);
    expect(a.srcSet).toBe(
      'https://lopoly.app/housing-media/L1/u-480.webp 480w, ' +
        'https://lopoly.app/housing-media/L1/u-960.webp 960w, ' +
        'https://lopoly.app/housing-media/L1/u-1440.webp 1440w',
    );
    expect(a.sizes).toBe(CARD_IMAGE_SIZES);
  });

  it('opts.widths と appendOriginal で詳細メイン用 srcSet', () => {
    const a = cardImageAttrs(HM, { widths: [960, 1440], appendOriginal: true });
    expect(a.srcSet).toBe(
      'https://lopoly.app/housing-media/L1/u-960.webp 960w, ' +
        'https://lopoly.app/housing-media/L1/u-1440.webp 1440w, ' +
        `${HM} 1920w`,
    );
  });

  it('X 画像 + twitterName → ?name= の src、srcSet なし', () => {
    const a = cardImageAttrs(TW, { twitterName: 'small' });
    expect(a.src).toBe('https://pbs.twimg.com/media/ABC.jpg?name=small');
    expect(a.srcSet).toBeUndefined();
  });

  it('X 画像 + twitterName 未指定 → 素の src', () => {
    expect(cardImageAttrs(TW).src).toBe(TW);
  });

  it('YouTube サムネ等 → 素の src のみ', () => {
    const a = cardImageAttrs(YT, { twitterName: 'small' });
    expect(a).toEqual({ src: YT });
  });
});

describe('smallHousingImageUrl', () => {
  it('housing-media は 480w 実体、X は ?name=small、他は素通し', () => {
    expect(smallHousingImageUrl(HM)).toBe('https://lopoly.app/housing-media/L1/u-480.webp');
    expect(smallHousingImageUrl(TW)).toBe('https://pbs.twimg.com/media/ABC.jpg?name=small');
    expect(smallHousingImageUrl(YT)).toBe(YT);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/cardImageAttrs.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/lib/housing/cardImageAttrs.ts`:

```ts
import { housingImageVariant } from './housingMediaUrl';
import { twitterImageVariant, type TwitterImageName } from './twitterImageVariant';

/**
 * カード / スライドショー用の <img sizes>。グリッドは minmax(198px, 1fr)。
 * よくある iPhone(390pt DPR3)は 1 カラム = ほぼ 100vw、2 カラムなら約 50vw、PC は約 240px。
 * .housing-listing-grid の左右 padding 4px を差し引く。実測で微調整可。
 */
export const CARD_IMAGE_SIZES =
  '(max-width: 419px) calc(100vw - 8px), (max-width: 767px) calc(50vw - 8px), 240px';

export interface CardImageAttrs {
  src: string;
  srcSet?: string;
  sizes?: string;
}

export interface CardImageAttrsOptions {
  /** srcSet に入れる派生幅(housing-media webp のときのみ)。既定 [480, 960, 1440]。 */
  widths?: readonly (480 | 960 | 1440)[];
  /** 原本を `{url} 1920w` として srcSet 末尾に足す(詳細メインステージ用)。 */
  appendOriginal?: boolean;
  /** <img sizes>。 */
  sizes?: string;
  /** X 画像を縮小するときの name。未指定なら X 画像は無加工。 */
  twitterName?: TwitterImageName;
}

const DEFAULT_WIDTHS = [480, 960, 1440] as const;

/** housing-media の派生対象画像か(= housingImageVariant が URL を書き換えるか)。 */
function isDerivableHousingImage(url: string): boolean {
  return housingImageVariant(url, 480) !== url;
}

/**
 * カード / ギャラリー用の <img> 属性(src / srcSet / sizes)を URL から組み立てる純関数。
 * - lopoly.app/housing-media/*.{webp,jpg,png}(直接アップロード)→ 派生 webp の srcSet
 * - pbs.twimg.com/media/*(X)→ twitterName 指定時のみ ?name= 付き src
 * - それ以外(YouTube サムネ、旧 URL 等)→ src=url のみ
 */
export function cardImageAttrs(url: string, opts: CardImageAttrsOptions = {}): CardImageAttrs {
  if (isDerivableHousingImage(url)) {
    const widths = opts.widths ?? DEFAULT_WIDTHS;
    const parts = widths.map((w) => `${housingImageVariant(url, w)} ${w}w`);
    if (opts.appendOriginal) parts.push(`${url} 1920w`);
    return { src: url, srcSet: parts.join(', '), sizes: opts.sizes };
  }
  if (opts.twitterName) {
    const t = twitterImageVariant(url, opts.twitterName);
    if (t !== url) return { src: t };
  }
  return { src: url };
}

/**
 * srcSet を使わない小さいサムネ用に、一番小さい実体 URL を返す。
 * housing-media → 480w 派生 / X → ?name=small / それ以外 → 素通し。
 */
export function smallHousingImageUrl(url: string): string {
  if (isDerivableHousingImage(url)) return housingImageVariant(url, 480);
  return twitterImageVariant(url, 'small');
}
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/cardImageAttrs.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/cardImageAttrs.ts src/lib/housing/__tests__/cardImageAttrs.test.ts
rtk git commit -m "feat(housing): <img> 属性ビルダー cardImageAttrs + smallHousingImageUrl"
```

---

## Task 5: サーバー側の画像処理ヘルパー(`resizeToWebp` / `computeCoverThumbHash`)

**Files:**
- Modify: `package.json`(`thumbhash` 依存追加)
- Modify: `api/housing/_imageFormatConvert.ts`(`resizeToWebp` 追加)
- Create: `api/housing/_coverThumbHash.ts`
- Test: `api/housing/__tests__/_coverThumbHash.test.ts`

**Interfaces:**
- Produces:
  - `resizeToWebp(buf: Buffer, width: number): Promise<Buffer>`(`_imageFormatConvert.ts`・失敗は throw)
  - `computeCoverThumbHash(buf: Buffer): Promise<string | null>`(`_coverThumbHash.ts`・失敗は null)

- [ ] **Step 1: `thumbhash` を依存追加**

```bash
rtk npm install thumbhash
```

`thumbhash` は MIT・zero-deps・約 2KB。ESM。**もし api(NodeNext)または Vite で import 解決に失敗する場合**は、`thumbhash` の単一ソースファイル(約 100 行)を `src/lib/vendor/thumbhash.ts` にコピーして、api と client の両方でそこから import する(fallback)。まずは npm 依存で進める。

- [ ] **Step 2: 失敗するテストを書く**

実画像を使う。テスト用に `sharp` で小さな PNG を生成する(fixture 不要):

`api/housing/__tests__/_coverThumbHash.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { computeCoverThumbHash } from '../_coverThumbHash.js';
import { resizeToWebp } from '../_imageFormatConvert.js';

async function makePng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 120, g: 80, b: 200 } },
  }).png().toBuffer();
}

describe('computeCoverThumbHash', () => {
  it('画像から base64 の ThumbHash を返す', async () => {
    const png = await makePng(800, 450);
    const hash = await computeCoverThumbHash(png);
    expect(typeof hash).toBe('string');
    expect(hash!.length).toBeGreaterThan(20);
    expect(hash!.length).toBeLessThan(80);
    // base64 として往復できる
    expect(Buffer.from(hash!, 'base64').length).toBeGreaterThan(0);
  });

  it('壊れた Buffer では null(非致命)', async () => {
    const hash = await computeCoverThumbHash(Buffer.from('not an image'));
    expect(hash).toBeNull();
  });
});

describe('resizeToWebp', () => {
  it('指定幅以下の webp を返す', async () => {
    const png = await makePng(2000, 1125);
    const out = await resizeToWebp(png, 480);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(480);
  });

  it('元より大きい幅を指定しても拡大しない', async () => {
    const png = await makePng(300, 200);
    const out = await resizeToWebp(png, 960);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(300);
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `rtk npm test -- api/housing/__tests__/_coverThumbHash.test.ts`
Expected: FAIL(`resizeToWebp` / `computeCoverThumbHash` 未定義)

- [ ] **Step 4: `_imageFormatConvert.ts` に `resizeToWebp` を追加**

`api/housing/_imageFormatConvert.ts` の末尾に:

```ts
/**
 * 画像 Buffer を指定幅の WebP に縮小する(カード用派生)。
 * 元より大きい幅を指定しても拡大しない。品質 78(写真のカード用途で十分・約85%削減)。
 * 変換失敗は throw する(呼び出し側で致命的に扱う。派生欠けは srcset の 404 を招くため)。
 */
export async function resizeToWebp(buf: Buffer, width: number): Promise<Buffer> {
  return sharp(buf)
    .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 78 })
    .toBuffer();
}
```

- [ ] **Step 5: `_coverThumbHash.ts` を作成**

`api/housing/_coverThumbHash.ts`:

```ts
/**
 * 画像 Buffer から ThumbHash(base64・約40文字)を計算する。
 * カードのぼかしプレースホルダ(直接アップロード物件の代表画像のみ)に使う。
 * ThumbHash は最大 100px の縮小画像で計算する。失敗は throw せず null(呼び出し側は
 * 「ハッシュ無し = 従来どおり背景色」で続行する)。
 */
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';

export async function computeCoverThumbHash(buf: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buf)
      .resize(100, 100, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const hash = rgbaToThumbHash(info.width, info.height, data);
    return Buffer.from(hash).toString('base64');
  } catch (e) {
    console.error('[housing/_coverThumbHash] failed (non-fatal):', e);
    return null;
  }
}
```

- [ ] **Step 6: テストを実行して通過を確認**

Run: `rtk npm test -- api/housing/__tests__/_coverThumbHash.test.ts`
Expected: PASS

もし `thumbhash` の import で失敗したら Step 1 の fallback(vendor コピー)に切り替え、`_coverThumbHash.ts` の import 先を `../../src/lib/vendor/thumbhash.js` にする。

- [ ] **Step 7: build 確認**

Run: `rtk npm run build`
Expected: tsc(api 含む)+ vite build がすべて通過

- [ ] **Step 8: コミット**

```bash
rtk git add package.json package-lock.json api/housing/_imageFormatConvert.ts api/housing/_coverThumbHash.ts api/housing/__tests__/_coverThumbHash.test.ts
rtk git commit -m "feat(housing): サーバー側の派生WebP生成(resizeToWebp)とThumbHash計算(computeCoverThumbHash)"
```

---

## Task 6: `coverThumbHash` の型定義・pass-through・公開窓口の許可リスト

**Files:**
- Modify: `src/types/housing.ts`
- Modify: `src/data/housing/mockListings.ts`
- Modify: `src/lib/housing/galleryAdapter.ts`(2 箇所)
- Modify: `src/lib/housing/publicListingProjection.ts`(`SAFE_FIELDS`)
- Modify: `api/housing/_publicWindow.ts`(`SELECT_FIELDS`)
- Test: `src/lib/housing/__tests__/publicListingProjection.test.ts`

**Interfaces:**
- Produces: `HousingListing.coverThumbHash?: string` / `MockListing.coverThumbHash?: string` が窓口レスポンス → `galleryAdapter` → カードまで伝播する。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/publicListingProjection.test.ts` に追記(既存の describe に合わせる):

```ts
it('coverThumbHash は public / unlisted 両方で射影に含まれる', () => {
  const pub = projectPublicListing('L1', { visibility: 'public', coverThumbHash: 'ABC123' });
  expect(pub.coverThumbHash).toBe('ABC123');
  const unl = projectPublicListing('L2', { visibility: 'unlisted', coverThumbHash: 'XYZ789' });
  expect(unl.coverThumbHash).toBe('XYZ789');
});

it('coverThumbHash が無ければ射影にキー自体を出さない', () => {
  const out = projectPublicListing('L3', { visibility: 'public' });
  expect('coverThumbHash' in out).toBe(false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/publicListingProjection.test.ts`
Expected: FAIL(`coverThumbHash` が `SAFE_FIELDS` に無く射影されない)

- [ ] **Step 3: 型定義に追加**

`src/types/housing.ts` の `HousingListing` interface、`thumbnailPaths?: string[];` の直後に:

```ts
  /**
   * 2026-08-31 追加: カードのぼかしプレースホルダ用 ThumbHash(base64・約40文字)。
   * imageMode==='thumbnail' の代表画像(thumbnailPaths[0])からアップロード時/バックフィルで計算。
   * X / YouTube / 生成失敗分は持たない(カードは従来どおり背景色)。
   */
  coverThumbHash?: string;
```

`src/data/housing/mockListings.ts` の `MockListing` interface、`thumbnailPaths?: string[];` の直後に:

```ts
  /** 2026-08-31: カードのぼかしプレースホルダ用 ThumbHash(base64)。 */
  coverThumbHash?: string;
```

- [ ] **Step 4: 公開窓口の許可リストに追加**

`src/lib/housing/publicListingProjection.ts` の `SAFE_FIELDS` 配列に `'coverThumbHash'` を追加
(`'thumbnailPaths',` の隣が読みやすい)。

`api/housing/_publicWindow.ts` の `SELECT_FIELDS` 配列に `'coverThumbHash'` を追加
(`'thumbnailPath', 'thumbnailPaths',` の隣)。

- [ ] **Step 5: galleryAdapter で pass-through**

`src/lib/housing/galleryAdapter.ts` の **unlisted 分岐の return** と **通常 return** の両方、
`thumbnailPaths: h.thumbnailPaths,` の直後に:

```ts
    coverThumbHash: h.coverThumbHash,
```

- [ ] **Step 6: テストを実行して通過を確認**

Run: `rtk npm test -- src/lib/housing/__tests__/publicListingProjection.test.ts src/lib/housing/__tests__`
Expected: PASS(projection の新規 + 既存の galleryAdapter 等も緑)

- [ ] **Step 7: build 確認**

Run: `rtk npm run build`
Expected: 通過(型追加が全消費側に伝播しても壊れない)

- [ ] **Step 8: コミット**

```bash
rtk git add src/types/housing.ts src/data/housing/mockListings.ts src/lib/housing/galleryAdapter.ts src/lib/housing/publicListingProjection.ts api/housing/_publicWindow.ts src/lib/housing/__tests__/publicListingProjection.test.ts
rtk git commit -m "feat(housing): coverThumbHash フィールドを型/窓口射影/galleryAdapter に配線"
```

---

## Task 7: アップロードハンドラに派生生成 + ThumbHash 保存を組み込む(サーバー先行リリースの本体)

**Files:**
- Modify: `api/housing/_uploadThumbnailHandler.ts`
- Test: `api/housing/__tests__/` の既存アップロードハンドラテスト(あれば拡張)、無ければ新規 `api/housing/__tests__/_uploadThumbnailHandler.derivatives.test.ts`

**Interfaces:**
- Consumes: `HOUSING_CARD_DERIVATIVE_WIDTHS` / `toDerivativePath`(Task 1)、`resizeToWebp`(Task 5)、`computeCoverThumbHash`(Task 5)
- Produces: アップロード成功時に Storage へ `{uuid}-480.webp` / `-960.webp` / `-1440.webp` と `.png` 兄弟が必ず存在する。`imageIndex===0` のとき Firestore doc に `coverThumbHash` が set(計算失敗時は既存値を delete)。

- [ ] **Step 1: 失敗するテストを書く**

既存の `_uploadThumbnailHandler` テストの構成に合わせる(`getStorage` / `getAdminFirestore` / `getAuth` のモック)。無ければ既存の他ハンドラーテスト(`api/housing/__tests__/*.test.ts`)のモックパターンを踏襲して新規作成。検証項目:

```ts
// 擬似コード的な検証ポイント(実際のモック構造は既存テストに合わせること)
it('アップロード成功で 480/960/1440 webp と png 兄弟が bucket.file().save() される', async () => {
  // ... handler を呼ぶ ...
  const savedPaths = saveSpy.mock.calls.map((c) => c[0]); // file(path) に渡した path
  expect(savedPaths).toEqual(expect.arrayContaining([
    expect.stringMatching(/-480\.webp$/),
    expect.stringMatching(/-960\.webp$/),
    expect.stringMatching(/-1440\.webp$/),
    expect.stringMatching(/\.png$/),
  ]));
});

it('派生生成が throw したらアップロードは 500 derivative_generation_failed', async () => {
  resizeToWebpMock.mockRejectedValueOnce(new Error('sharp boom'));
  const res = await callHandler(...);
  expect(res.statusCode).toBe(500);
  expect(res.body.error).toBe('derivative_generation_failed');
});

it('imageIndex=0 のとき Firestore update に coverThumbHash が入る', async () => {
  computeCoverThumbHashMock.mockResolvedValueOnce('HASH64');
  await callHandler({ index: 0 });
  expect(txUpdateArg.coverThumbHash).toBe('HASH64');
});

it('imageIndex=2 のとき coverThumbHash は touch しない', async () => {
  await callHandler({ index: 2 });
  expect('coverThumbHash' in txUpdateArg).toBe(false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- api/housing/__tests__/_uploadThumbnailHandler.derivatives.test.ts`
Expected: FAIL

- [ ] **Step 3: ハンドラを編集**

`api/housing/_uploadThumbnailHandler.ts`:

import に追加:

```ts
import { parseStoragePathFromPublicUrl, buildHousingImagePublicUrl, toPngSiblingPath, toDerivativePath, HOUSING_CARD_DERIVATIVE_WIDTHS } from './_imageArrayLogic.js';
import { convertToPngIfNeeded, LISTING_THUMBNAIL_PNG_MAX_DIMENSION, resizeToWebp } from './_imageFormatConvert.js';
import { computeCoverThumbHash } from './_coverThumbHash.js';
```

`await file.save(buf, {...})` の直後、現在の「png sibling(best-effort)」ブロック(`const pngBuf = ...` の if 節)を、以下の**必須ブロック**に置き換える:

```ts
    // カード用の縮小 WebP 派生(480/960/1440)+ OGP 用 PNG 兄弟を生成・保存する。
    // 表示側が srcset でこれらを参照するため、1 枚でも欠けると画像が壊れて見える。
    // → best-effort ではなく必須(失敗したらアップロード自体を 500 で失敗させる)。
    try {
      await Promise.all(
        HOUSING_CARD_DERIVATIVE_WIDTHS.map(async (w) => {
          const derived = await resizeToWebp(buf, w);
          await bucket.file(toDerivativePath(filePath, w)).save(derived, {
            contentType: 'image/webp',
            metadata: { cacheControl: 'public, max-age=31536000, immutable' },
          });
        }),
      );
      const pngBuf = await convertToPngIfNeeded(buf, mimeType, {
        maxDimension: LISTING_THUMBNAIL_PNG_MAX_DIMENSION,
      });
      if (pngBuf) {
        await bucket.file(toPngSiblingPath(filePath)).save(pngBuf, {
          contentType: 'image/png',
          metadata: { cacheControl: 'public, max-age=31536000, immutable' },
        });
      }
    } catch (e) {
      console.error('[housing/upload-thumbnail] derivative/png generation failed:', e);
      return res.status(500).json({ error: 'derivative_generation_failed' });
    }

    // 代表画像(index 0)のときは ThumbHash も計算する(非致命)。
    const coverThumbHash = imageIndex === 0 ? await computeCoverThumbHash(buf) : undefined;
```

トランザクション内の `update` オブジェクト構築(`const update: Record<string, unknown> = {...}` の後、`if (imageIndex === 0 || ...)` の並び)に追加:

```ts
      // 代表画像の差し替え時は ThumbHash も更新。計算に失敗したら古いハッシュを消す
      // (誤ったぼかしを出し続けない)。
      if (imageIndex === 0) {
        update.coverThumbHash = coverThumbHash ?? FieldValue.delete();
      }
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `rtk npm test -- api/housing/__tests__/`
Expected: PASS(新規 + 既存のアップロード関連が緑)

- [ ] **Step 5: build 確認**

Run: `rtk npm run build`
Expected: 通過

- [ ] **Step 6: コミット**

```bash
rtk git add api/housing/_uploadThumbnailHandler.ts api/housing/__tests__/_uploadThumbnailHandler.derivatives.test.ts
rtk git commit -m "feat(housing): アップロード時に派生WebP(必須)+PNG兄弟(必須化)+coverThumbHash を保存"
```

- [ ] **Step 7: 🚀 リリース第1段階(サーバー先行)**

Task 5・6・7 の変更を main にマージして本番へ。**表示側はまだ原本 URL を参照しているので挙動は変わらない。** 以降の新規アップロードは派生あり。

```bash
rtk git push origin main
```

Vercel 自動デプロイ完了を確認したら、テスト用の物件を 1 件アップロードして
`https://lopoly.app/housing-media/{listingId}/{uuid}-480.webp` 等が 200 で返ることを確認する。

---

## Task 8: 既存 74 件のバックフィル

**Files:**
- Create: `scripts/backfill-listing-card-derivatives.ts`
- (テストは手動 dry-run。スクリプトの純ロジックは Task 1/5 でカバー済み)

**Interfaces:**
- Consumes: `toDerivativePath` / `HOUSING_CARD_DERIVATIVE_WIDTHS`(Task 1)、`resizeToWebp`(Task 5)、`computeCoverThumbHash`(Task 5)、`convertToPngIfNeeded` / `parseStoragePathFromPublicUrl` / `toPngSiblingPath`(既存)、`bumpPublicVersionDirect`(既存 `api/housing/_publicVersion.js`)

- [ ] **Step 1: スクリプトを作成**

`scripts/backfill-listing-thumbnail-png.ts` を土台にする(env ロード・firebase-admin init は同一)。

`scripts/backfill-listing-card-derivatives.ts`:

```ts
/**
 * scripts/backfill-listing-card-derivatives.ts
 *
 * 既存の直接アップロード物件(imageMode='thumbnail')の画像に、カード用の縮小 WebP 派生
 * (480/960/1440)を作り置きする。同時に欠けている .png 兄弟を再生成し、代表画像の
 * coverThumbHash を計算して Firestore に保存する。
 *
 * 設計書: docs/superpowers/specs/2026-08-31-housing-card-image-optimization-phase1-design.md
 *
 * Firestore 変更: coverThumbHash の追加のみ(thumbnailPaths 等はいじらない)。
 * Storage 変更: {uuid}-{w}.webp / {uuid}.png の新規作成のみ(元ファイルは不変)。
 *
 * 使い方:
 *   npx tsx scripts/backfill-listing-card-derivatives.ts            # dry-run(既定・書き込みゼロ)
 *   npx tsx scripts/backfill-listing-card-derivatives.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  parseStoragePathFromPublicUrl,
  toPngSiblingPath,
  toDerivativePath,
  HOUSING_CARD_DERIVATIVE_WIDTHS,
} from '../api/housing/_imageArrayLogic.js';
import { convertToPngIfNeeded, LISTING_THUMBNAIL_PNG_MAX_DIMENSION, resizeToWebp } from '../api/housing/_imageFormatConvert.js';
import { computeCoverThumbHash } from '../api/housing/_coverThumbHash.js';
import { bumpPublicVersionDirect } from '../api/housing/_publicVersion.js';

const APPLY = process.argv.includes('--apply');
const LISTING_COLLECTION = 'housing_listings';

function loadEnv(filePath: string): Record<string, string> {
  const text = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY が必要');
  process.exit(1);
}

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  storageBucket: env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app',
});
const db = getFirestore();
const bucket = getStorage().bucket();

function mimeFromExt(path: string): string | null {
  if (/\.webp$/i.test(path)) return 'image/webp';
  if (/\.avif$/i.test(path)) return 'image/avif';
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  if (/\.png$/i.test(path)) return 'image/png';
  return null;
}

console.log(`=== カード画像派生バックフィル (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

async function main() {
  const snap = await db.collection(LISTING_COLLECTION).where('imageMode', '==', 'thumbnail').get();
  const docs = snap.docs.filter((d) => d.data().deletedAt == null);
  console.log(`対象: ${docs.length}件 (imageMode='thumbnail' / 未削除)\n`);

  let listings = 0;
  let derivativesMade = 0;
  let pngMade = 0;
  let hashesWritten = 0;
  let failed = 0;

  for (const doc of docs) {
    listings++;
    const listingId = doc.id;
    const data = doc.data();
    const urls: string[] = Array.isArray(data.thumbnailPaths)
      ? data.thumbnailPaths.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
      : typeof data.thumbnailPath === 'string' && data.thumbnailPath
        ? [data.thumbnailPath]
        : [];
    if (urls.length === 0) continue;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const srcPath = parseStoragePathFromPublicUrl(url);
      const mimeType = mimeFromExt(url);
      if (!srcPath || !mimeType) {
        console.error(`  ⚠ ${listingId}: URL 解析不能 (skip): ${url}`);
        continue;
      }

      // 派生 3 サイズ
      let srcBuf: Buffer | null = null;
      const ensureBuf = async (): Promise<Buffer | null> => {
        if (srcBuf) return srcBuf;
        const srcFile = bucket.file(srcPath);
        const [exists] = await srcFile.exists();
        if (!exists) {
          console.error(`  ⚠ ${listingId}: 元ファイル不在 (skip): ${srcPath}`);
          return null;
        }
        [srcBuf] = await srcFile.download();
        return srcBuf;
      };

      for (const w of HOUSING_CARD_DERIVATIVE_WIDTHS) {
        const dstPath = toDerivativePath(srcPath, w);
        try {
          const [exists] = await bucket.file(dstPath).exists();
          if (exists) continue;
          const buf = await ensureBuf();
          if (!buf) break;
          console.log(`  ${APPLY ? '✅' : '·'} ${listingId}: ${dstPath}`);
          if (APPLY) {
            const out = await resizeToWebp(buf, w);
            await bucket.file(dstPath).save(out, {
              contentType: 'image/webp',
              metadata: { cacheControl: 'public, max-age=31536000, immutable' },
            });
          }
          derivativesMade++;
        } catch (e) {
          console.error(`  ❌ ${listingId}: 派生 ${w}w 失敗: ${dstPath}`, e);
          failed++;
        }
      }

      // .png 兄弟(webp/avif 元のみ・欠けていれば)
      if (mimeType === 'image/webp' || mimeType === 'image/avif') {
        const pngPath = toPngSiblingPath(srcPath);
        try {
          const [exists] = await bucket.file(pngPath).exists();
          if (!exists) {
            const buf = await ensureBuf();
            if (buf) {
              const pngBuf = await convertToPngIfNeeded(buf, mimeType, {
                maxDimension: LISTING_THUMBNAIL_PNG_MAX_DIMENSION,
              });
              if (pngBuf) {
                console.log(`  ${APPLY ? '✅' : '·'} ${listingId}: ${pngPath} (png兄弟)`);
                if (APPLY) {
                  await bucket.file(pngPath).save(pngBuf, {
                    contentType: 'image/png',
                    metadata: { cacheControl: 'public, max-age=31536000, immutable' },
                  });
                }
                pngMade++;
              }
            }
          }
        } catch (e) {
          console.error(`  ❌ ${listingId}: png 兄弟失敗: ${pngPath}`, e);
          failed++;
        }
      }

      // coverThumbHash(代表画像 = i===0・未設定なら)
      if (i === 0 && !data.coverThumbHash) {
        try {
          const buf = await ensureBuf();
          if (buf) {
            const hash = await computeCoverThumbHash(buf);
            if (hash) {
              console.log(`  ${APPLY ? '✅' : '·'} ${listingId}: coverThumbHash`);
              if (APPLY) {
                await doc.ref.update({ coverThumbHash: hash, updatedAt: Date.now() });
              }
              hashesWritten++;
            }
          }
        } catch (e) {
          console.error(`  ❌ ${listingId}: coverThumbHash 失敗`, e);
          failed++;
        }
      }
    }
  }

  if (APPLY && hashesWritten > 0) {
    await bumpPublicVersionDirect(db);
    console.log('\n公開データ版番号を +1(古いギャラリーキャッシュを失効させる)');
  }

  console.log('\n=== 結果 ===');
  console.log(`対象物件: ${listings}件`);
  console.log(`派生 webp ${APPLY ? '生成' : '生成予定'}: ${derivativesMade}枚`);
  console.log(`png 兄弟 ${APPLY ? '生成' : '生成予定'}: ${pngMade}枚`);
  console.log(`coverThumbHash ${APPLY ? '保存' : '保存予定'}: ${hashesWritten}件`);
  console.log(`失敗: ${failed}件`);
  if (failed > 0) console.error('\n⚠ 失敗が 0 でない。表示側デプロイの前に原因を潰すこと。');
  if (!APPLY) console.log('\n🟢 DRY-RUN。問題なければ --apply で再実行。');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ 致命的エラー:', e);
  process.exit(1);
});
```

`api/housing/_publicVersion.js` に `bumpPublicVersionDirect` が export されているか確認する
(他ハンドラーで使われている)。無ければ既存の版更新関数名に合わせる。

- [ ] **Step 2: dry-run**

```bash
rtk proxy npx tsx scripts/backfill-listing-card-derivatives.ts
```

Expected: 対象 74 件前後・派生生成予定が `74 × 平均2.5枚 × 3幅 ≈ 550` 前後・失敗 0。出力を確認。

- [ ] **Step 3: コミット(スクリプトのみ・まだ apply しない)**

```bash
rtk git add scripts/backfill-listing-card-derivatives.ts
rtk git commit -m "chore(housing): カード画像派生のバックフィルスクリプト"
```

- [ ] **Step 4: 🚀 リリース第2段階(バックフィル apply)**

```bash
rtk proxy npx tsx scripts/backfill-listing-card-derivatives.ts --apply
```

**「失敗: 0件」を必ず確認する。** 失敗があれば原因を潰して再実行(冪等なので成功済みはスキップされる)。
全件成功するまで Task 9 以降(表示側)に進まない。

再度 dry-run して「派生生成予定: 0 / png: 0」になる(= 全部揃った)ことを確認する。

---

## Task 9: `ListingCard` メイン `<img>` を `cardImageAttrs` に切り替え

**Files:**
- Modify: `src/components/housing/browse/ListingCard.tsx`
- Test: `src/components/housing/browse/__tests__/ListingCard.test.tsx`

**Interfaces:**
- Consumes: `cardImageAttrs` / `CARD_IMAGE_SIZES`(Task 4)、`representativeImage`(既存)

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/browse/__tests__/ListingCard.test.tsx` に追記(既存の render ヘルパーに合わせる):

```ts
it('直接アップロード物件のメイン画像は派生 srcSet + decoding=async を持つ', () => {
  const listing = makeListing({
    imageMode: 'thumbnail',
    thumbnailPath: 'https://lopoly.app/housing-media/L1/u.webp',
    thumbnailPaths: ['https://lopoly.app/housing-media/L1/u.webp'],
  });
  const { container } = renderCard(listing);
  const img = container.querySelector('img.housing-listing-card-img') as HTMLImageElement;
  expect(img.getAttribute('srcset')).toContain('u-480.webp 480w');
  expect(img.getAttribute('srcset')).toContain('u-1440.webp 1440w');
  expect(img.getAttribute('srcset')).not.toContain('1920w'); // カードは原本を入れない
  expect(img.getAttribute('decoding')).toBe('async');
});

it('X 物件のメイン画像は ?name=small の src(srcSet なし)', () => {
  const listing = makeListing({
    imageMode: 'sns',
    ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
    sourceImageUrls: ['https://pbs.twimg.com/media/ABC.jpg'],
  });
  const { container } = renderCard(listing);
  const img = container.querySelector('img.housing-listing-card-img') as HTMLImageElement;
  expect(img.getAttribute('src')).toBe('https://pbs.twimg.com/media/ABC.jpg?name=small');
  expect(img.hasAttribute('srcset')).toBe(false);
});
```

(`makeListing` / `renderCard` は既存テストのヘルパーを流用。無ければ既存テスト冒頭のパターンを踏襲。)

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: FAIL

- [ ] **Step 3: `ListingCard.tsx` を編集**

import 追加:

```ts
import { cardImageAttrs, CARD_IMAGE_SIZES } from '../../../lib/housing/cardImageAttrs';
```

現在のメイン `<img>`(`className="housing-listing-card-img"`)を:

```tsx
        <img
          className="housing-listing-card-img"
          src={representativeImage(listing)}
          alt=""
          loading="lazy"
          onError={handleYoutubeThumbnailError}
          onLoad={handleYoutubeThumbnailLoad}
        />
```

から:

```tsx
        {(() => {
          const a = cardImageAttrs(representativeImage(listing), {
            sizes: CARD_IMAGE_SIZES,
            twitterName: 'small',
          });
          return (
            <img
              className="housing-listing-card-img"
              src={a.src}
              srcSet={a.srcSet}
              sizes={a.sizes}
              alt=""
              loading="lazy"
              decoding="async"
              onError={handleYoutubeThumbnailError}
              onLoad={handleYoutubeThumbnailLoad}
            />
          );
        })()}
```

へ。(`srcSet` / `sizes` が `undefined` の場合 React は属性を出さない。)

- [ ] **Step 4: テストを実行して通過を確認**

Run: `rtk npm test -- src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: PASS

- [ ] **Step 5: build 確認**

Run: `rtk npm run build`
Expected: 通過

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/housing/browse/ListingCard.tsx src/components/housing/browse/__tests__/ListingCard.test.tsx
rtk git commit -m "feat(housing): カードのメイン画像を派生srcSet/X縮小/decoding=async へ"
```

---

## Task 10: `HousingCardAmbientSlideshow` を 3 枚窓 + 派生 srcSet に

**Files:**
- Modify: `src/components/housing/workspace/HousingCardAmbientSlideshow.tsx`
- Test: `src/__tests__/housing/HousingCardAmbientSlideshow.test.tsx`

**Interfaces:**
- Consumes: `slideshowWindowIndices`(Task 3)、`cardImageAttrs` / `CARD_IMAGE_SIZES`(Task 4)

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/HousingCardAmbientSlideshow.test.tsx` に追記(既存の render パターンに合わせる):

```ts
it('フレーム4枚でも <img> は3枚だけマウントする', () => {
  const frames = [
    { src: 'https://lopoly.app/housing-media/L1/a.webp' },
    { src: 'https://lopoly.app/housing-media/L1/b.webp' },
    { src: 'https://lopoly.app/housing-media/L1/c.webp' },
    { src: 'https://lopoly.app/housing-media/L1/d.webp' },
  ];
  const { container } = render(<HousingCardAmbientSlideshow frames={frames} enabled={false} />);
  expect(container.querySelectorAll('img')).toHaveLength(3);
});

it('housing-media フレームは派生 srcSet を持つ', () => {
  const frames = [{ src: 'https://lopoly.app/housing-media/L1/a.webp' }, { src: 'https://lopoly.app/housing-media/L1/b.webp' }];
  const { container } = render(<HousingCardAmbientSlideshow frames={frames} enabled={false} />);
  const img = container.querySelector('img') as HTMLImageElement;
  expect(img.getAttribute('srcset')).toContain('a-480.webp 480w');
  expect(img.getAttribute('decoding')).toBe('async');
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/__tests__/housing/HousingCardAmbientSlideshow.test.tsx`
Expected: FAIL(4 枚とも描画されている)

- [ ] **Step 3: コンポーネントを編集**

`src/components/housing/workspace/HousingCardAmbientSlideshow.tsx`:

import 追加:

```ts
import { slideshowWindowIndices } from '../../../lib/housing/slideshowWindow';
import { cardImageAttrs, CARD_IMAGE_SIZES } from '../../../lib/housing/cardImageAttrs';
```

`if (frames.length === 0) return null;` の後、`return (...)` の直前に:

```ts
  const windowSet = new Set(slideshowWindowIndices(frames.length, index));
```

`frames.map((f, i) => (...))` の `<img>` を:

```tsx
      {frames.map((f, i) => {
        if (!windowSet.has(i)) return null;
        const a = cardImageAttrs(f.src, { sizes: CARD_IMAGE_SIZES, twitterName: 'small' });
        return (
          <img
            key={`${i}-${f.src}`}
            src={a.src}
            srcSet={a.srcSet}
            sizes={a.sizes}
            alt=""
            role="presentation"
            loading="lazy"
            decoding="async"
            data-active={i === index}
            onError={handleError(i)}
          />
        );
      })}
```

`handleError` を、fallback へ swap する際に srcset も消すよう修正:

```ts
  const handleError = useCallback(
    (i: number) =>
      (e: React.SyntheticEvent<HTMLImageElement>): void => {
        const fallback = frames[i]?.fallback;
        if (!fallback) return;
        if (swappedRef.current.has(i)) return;
        swappedRef.current.add(i);
        e.currentTarget.srcset = '';
        e.currentTarget.src = fallback;
      },
    [frames],
  );
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `rtk npm test -- src/__tests__/housing/HousingCardAmbientSlideshow.test.tsx`
Expected: PASS

- [ ] **Step 5: build 確認**

Run: `rtk npm run build`
Expected: 通過

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/housing/workspace/HousingCardAmbientSlideshow.tsx src/__tests__/housing/HousingCardAmbientSlideshow.test.tsx
rtk git commit -m "feat(housing): スライドショーを3枚窓+派生srcSet+decoding=async へ"
```

---

## Task 11: `ListingCard` に ThumbHash ぼかしレイヤー

**Files:**
- Modify: `src/components/housing/browse/ListingCard.tsx`
- Modify: `src/styles/housing.css`
- Test: `src/components/housing/browse/__tests__/ListingCard.test.tsx`

**Interfaces:**
- Consumes: `thumbHashToDataURL`(`thumbhash` npm・Task 5 で追加済み)、`listing.coverThumbHash`(Task 6)

- [ ] **Step 1: 失敗するテストを書く**

```ts
vi.mock('thumbhash', async (orig) => ({
  ...(await orig<typeof import('thumbhash')>()),
  thumbHashToDataURL: () => 'data:image/png;base64,BLURMOCK',
}));

it('coverThumbHash があればぼかしレイヤーを敷く', () => {
  const listing = makeListing({
    imageMode: 'thumbnail',
    thumbnailPath: 'https://lopoly.app/housing-media/L1/u.webp',
    thumbnailPaths: ['https://lopoly.app/housing-media/L1/u.webp'],
    coverThumbHash: btoa('fakehashbytes'),
  });
  const { container } = renderCard(listing);
  const blur = container.querySelector('.housing-listing-card-blur') as HTMLElement;
  expect(blur).toBeTruthy();
  expect(blur.style.backgroundImage).toContain('BLURMOCK');
});

it('coverThumbHash が無ければぼかしレイヤーは出さない', () => {
  const listing = makeListing({
    imageMode: 'sns',
    ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
  });
  const { container } = renderCard(listing);
  expect(container.querySelector('.housing-listing-card-blur')).toBeNull();
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: FAIL

- [ ] **Step 3: `ListingCard.tsx` を編集**

import 追加:

```ts
import { useState, useMemo } from 'react'; // 既存 import に merge
import { thumbHashToDataURL } from 'thumbhash';
```

コンポーネント本体に:

```ts
  const [imgLoaded, setImgLoaded] = useState(false);
  const blurDataUrl = useMemo(() => {
    if (!listing.coverThumbHash) return null;
    try {
      return thumbHashToDataURL(
        Uint8Array.from(atob(listing.coverThumbHash), (c) => c.charCodeAt(0)),
      );
    } catch {
      return null;
    }
  }, [listing.coverThumbHash]);
```

`<div className="housing-listing-card-media" ref={mediaRef}>` の直下(メイン `<img>` より前)に:

```tsx
        {blurDataUrl && (
          <div
            className="housing-listing-card-blur"
            style={{ backgroundImage: `url("${blurDataUrl}")` }}
            data-hidden={imgLoaded || undefined}
            aria-hidden="true"
          />
        )}
```

Task 9 で作ったメイン `<img>` の `onLoad` を:

```tsx
              onLoad={(e) => {
                handleYoutubeThumbnailLoad(e);
                setImgLoaded(true);
              }}
```

- [ ] **Step 4: `housing.css` に追記**

`src/styles/housing.css` の `.housing-workspace` トークンブロック(上部)に:

```css
  --housing-card-blur-fade: 400ms;
```

`.housing-listing-card-img` の定義の近くに:

```css
.housing-listing-card-blur {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: opacity var(--housing-card-blur-fade) ease;
}
.housing-listing-card-blur[data-hidden] {
  opacity: 0;
}
```

(ぼかし div はメイン `<img>` より DOM 上で前 = 背面に描かれる。ambient スライドショーは
`z-index: var(--housing-card-overlay-z-ambient)` で両方より前のまま。)

- [ ] **Step 5: テストを実行して通過を確認**

Run: `rtk npm test -- src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: PASS

- [ ] **Step 6: build 確認**

Run: `rtk npm run build`
Expected: 通過

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/housing/browse/ListingCard.tsx src/styles/housing.css src/components/housing/browse/__tests__/ListingCard.test.tsx
rtk git commit -m "feat(housing): カードに ThumbHash ぼかしプレースホルダを追加"
```

---

## Task 12: `HousingPhotoGallery` の画像サイズ最適化

**Files:**
- Modify: `src/components/housing/listing/HousingPhotoGallery.tsx`
- Test: `src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx`

**Interfaces:**
- Consumes: `cardImageAttrs`(Task 4)、`smallHousingImageUrl`(Task 4)

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx` に追記:

```ts
it('メインステージ画像は 960/1440/原本1920 の srcSet + decoding=async', () => {
  const listing = makeListing({
    imageMode: 'thumbnail',
    thumbnailPaths: [
      'https://lopoly.app/housing-media/L1/a.webp',
      'https://lopoly.app/housing-media/L1/b.webp',
    ],
  });
  const { container } = render(<HousingPhotoGallery listing={listing} />);
  const main = container.querySelector('.housing-gallery-main') as HTMLImageElement;
  expect(main.getAttribute('srcset')).toContain('a-960.webp 960w');
  expect(main.getAttribute('srcset')).toContain('a-1440.webp 1440w');
  expect(main.getAttribute('srcset')).toContain('a.webp 1920w');
  expect(main.getAttribute('decoding')).toBe('async');
});

it('サムネ列の画像は 480w 実体 URL', () => {
  const listing = makeListing({
    imageMode: 'thumbnail',
    thumbnailPaths: [
      'https://lopoly.app/housing-media/L1/a.webp',
      'https://lopoly.app/housing-media/L1/b.webp',
    ],
  });
  const { container } = render(<HousingPhotoGallery listing={listing} />);
  const thumbs = Array.from(container.querySelectorAll('.housing-detail-thumb img')) as HTMLImageElement[];
  expect(thumbs[0].getAttribute('src')).toBe('https://lopoly.app/housing-media/L1/a-480.webp');
});

it('X 画像のメインステージは原本(?name= なし)、サムネは ?name=small', () => {
  const listing = makeListing({
    imageMode: 'sns',
    sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg', 'https://pbs.twimg.com/media/B.jpg'],
  });
  const { container } = render(<HousingPhotoGallery listing={listing} />);
  const main = container.querySelector('.housing-gallery-main') as HTMLImageElement;
  expect(main.getAttribute('src')).toBe('https://pbs.twimg.com/media/A.jpg');
  const thumb = container.querySelector('.housing-detail-thumb img') as HTMLImageElement;
  expect(thumb.getAttribute('src')).toBe('https://pbs.twimg.com/media/A.jpg?name=small');
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk npm test -- src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx`
Expected: FAIL

- [ ] **Step 3: コンポーネントを編集**

import 追加:

```ts
import { cardImageAttrs, smallHousingImageUrl } from '../../../lib/housing/cardImageAttrs';
```

`sizes` 用の定数をファイル上部に:

```ts
// 詳細メインステージ(object-fit: contain)。PC で最大 ~800px 相当まで拡大しうる。
const GALLERY_MAIN_SIZES = '(max-width: 767px) 100vw, 800px';
```

メインステージの画像 `<img className="housing-gallery-main" ...>` を:

```tsx
          (() => {
            const a = cardImageAttrs(active.src, {
              widths: [960, 1440],
              appendOriginal: true,
              sizes: GALLERY_MAIN_SIZES,
            });
            return (
              <img
                src={a.src}
                srcSet={a.srcSet}
                sizes={a.sizes}
                alt=""
                loading="lazy"
                decoding="async"
                className="housing-gallery-main"
                onError={handleImgError(active.src)}
                onLoad={handleYoutubeThumbnailLoad}
              />
            );
          })()
```

サムネ列の画像(`<img src={item.src} ... />`)を:

```tsx
                    <img
                      src={smallHousingImageUrl(item.src)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={handleImgError(item.src)}
                      onLoad={handleYoutubeThumbnailLoad}
                    />
```

**重要**: `handleImgError` と `visibleSources` / `failedSources` の判定は**元 URL**(`item.src` /
`active.src`)のままにする。加工後 URL は `<img>` 属性でだけ使う(§6.4 の markFailed 追跡が
壊れないため)。`mediaItems` は元 URL を保持する(変更しない)。

- [ ] **Step 4: テストを実行して通過を確認**

Run: `rtk npm test -- src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx`
Expected: PASS

- [ ] **Step 5: build 確認 + 関連テスト一括**

Run: `rtk npm run build`
Run: `rtk npm test -- src/components/housing/ src/lib/housing/ src/__tests__/housing/`
Expected: すべて緑

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/housing/listing/HousingPhotoGallery.tsx src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx
rtk git commit -m "feat(housing): 詳細ギャラリーの画像を派生サイズへ(メイン960/1440・サムネ480)"
```

- [ ] **Step 7: 🚀 リリース第3段階(表示側)**

```bash
rtk git push origin main
```

Vercel 自動デプロイ完了後、実機確認(下記)を masaya に依頼する。

---

## リリース後の実機確認(masaya・自動テスト不可)

- [ ] iPhone Safari で `/housing` をスクロール → 青い「?」が出ないこと
- [ ] 直接アップロード物件のカードで、一瞬ぼかし → シャープに切り替わること
- [ ] PC でも一覧の初回ロードが軽くなっていること
- [ ] 詳細ページ:メイン画像・サムネ列・画像切替が正常
- [ ] 直接アップロードで新規登録 → カードが正しく表示される(派生 URL 参照)
- [ ] X 取り込み物件のカード・詳細が正常(`?name=small` / 原本)

---

## Self-Review（この計画を書いた後の確認）

**1. Spec coverage:**
- §4 派生生成 → Task 1(命名)/ Task 5(sharp)/ Task 7(アップロード配線)/ Task 8(バックフィル) ✓
- §4.5 必須化 → Task 7 Step 3(try/catch → 500)+ `.png` 必須化 ✓
- §5 ThumbHash → Task 5(計算)/ Task 6(フィールド配線)/ Task 7(保存)/ Task 8(バックフィル)/ Task 11(表示) ✓
- §6.1 派生 URL ヘルパー / cardImageAttrs → Task 1 / Task 4 ✓
- §6.2 X 加工 → Task 2 ✓
- §6.3 カード img + スライドショー窓 → Task 9 / Task 10 ✓
- §6.4 詳細ギャラリー(ライトボックス無し・markFailed は元 URL)→ Task 12 ✓
- §6.5 content-visibility 変更なし → タスク無し(正しい) ✓
- §7.3 3 段階リリース → Task 7 Step 7 / Task 8 Step 4 / Task 12 Step 7 ✓

**2. Placeholder scan:** 各コード steps に実コードあり。バックフィルの `bumpPublicVersionDirect` は
「無ければ既存の版更新関数名に合わせる」と条件付き(実行者が確認)— これは既存資産の名前確認であり
プレースホルダではない。

**3. Type consistency:**
- `HOUSING_CARD_DERIVATIVE_WIDTHS` は Task 1 で `[480, 960, 1440] as const`、Task 7/8 で消費 — 一致
- `cardImageAttrs` の戻り値 `{ src, srcSet?, sizes? }` は Task 4 定義、Task 9/10/12 で `a.src` / `a.srcSet` / `a.sizes` として消費 — 一致
- `smallHousingImageUrl` Task 4 定義、Task 12 で消費 — 一致
- `slideshowWindowIndices(n, index)` Task 3 定義、Task 10 で `slideshowWindowIndices(frames.length, index)` — 一致
- `computeCoverThumbHash` / `resizeToWebp` Task 5 定義、Task 7/8 で消費 — 一致
- `coverThumbHash` フィールド名は全タスクで統一
