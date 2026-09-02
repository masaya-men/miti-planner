# 物件OGPカード follow-up: 事前生成 + ページ即応答 + © 削除 + sourcePostUrls

> 2026-09-02 デプロイ後に発覚した cold-start 不具合 + レビュー指摘 + masaya 判断の反映。
> 元 spec/plan: `docs/superpowers/{specs,plans}/2026-09-02-housing-listing-og-card*`。

**Goal:** 新規登録した物件を初回シェアしても X に写真カードが出る + カードから © を外す + X ボタンの複数URL対応。

**Branch:** `fix/housing-listing-og-card-warm-and-cleanup`

## 背景(確定事実)

- デプロイ後実測: 物件ページの**初回クロールが 4〜9 秒**(`_listingPageHandler` がカード生成を同期 await)。2 回目以降 0.4 秒。X は数秒でタイムアウト → 「画像なし」を URL 単位でキャッシュ → 新規物件の初回シェアが死ぬ。
- 既存 237 物件は手動 warm 済(scratchpad の一時スクリプトで全ページを 1 回踏んだ)。
- LoPo 物件ページは `HousingShell` → `StatusBar` に `footer.copyright`(= © SQUARE ENIX CO., LTD. All Rights Reserved.)を常時表示 = FFXIV Materials Usage License の「各ウェブページに 1 回」を**ページ側が満たしている**。カードは preview 画像であって別 webpage ではない → カードの © は不要(masaya 判断)。
- `HousingActionBar` の X シェアは `sourceUrl={listing.postUrl ?? null}` を渡す = 元URL(tweet/YouTube/housingsnap/studio-xiv)があればそれを共有。複数URL登録の新フィールド `sourcePostUrls` は見ていない。

## Global Constraints

- コメント日本語。api の相対 import は `.js` 必須。tsc strict。
- テスト/型チェックは `npx vitest run <file>` / `npx tsc -p tsconfig.api.json --noEmit` + `npx tsc -b`(`rtk` は付けない)。git は `rtk git`。
- 1 タスク 1 コミット。trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- カード寸法 1200×630。署名 24 hex。
- **`CARD_VERSION` を `'1'` → `'2'` に上げる**(© を外した新カードを既存キャッシュと別ハッシュにして再生成させるため)。

## ファイル構成

| ファイル | 変更 | Task |
|---|---|---|
| `src/lib/ogpListingCard.ts` | `CARD_VERSION` `'1'`→`'2'` | 1 |
| `api/og/_listingCard.ts` | `buildCopyrightLine` / `COPYRIGHT_TEXT` 削除。photo card = [blur,scrim,img] のみ。fallback = 「LoPo Housing」のみ。`handleListingCardRequest` のフォント読み込み簡素化(photo は fonts 不要、fallback は M PLUS 1 のみ) | 1 |
| `api/og/__tests__/_listingCard.test.ts` | © アサーション削除、children 数を戻す | 1 |
| `src/lib/housing/listingOgCardWarm.ts` (新規) | `computeListingOgCardHash(photoUrl)` + `warmListingOgCard({ db, origin, photoUrl })`(meta 書き込み + `/og/{hash}.png` fetch)の共有ヘルパー | 2 |
| `src/lib/housing/__tests__/listingOgCardWarm.test.ts` (新規) | 純関数部分のテスト | 2 |
| `api/share/_listingPageHandler.ts` | 代表画像ブロックを共有ヘルパー利用に。**`if (!exists) await fetch(warmup)` の同期ブロックを撤去**(page は生成を待たない)。`exists===true` の `lastAccessedAt` touch は維持 | 3 |
| `api/share/__tests__/_listingPageHandler.test.ts` | warm-up fetch 期待の削除、ヘルパーmock | 3 |
| `api/housing/_registerListingHandler.ts` | listing 作成後に `warmListingOgCard` を await(登録処理内なのでクローラーは待たない) | 4 |
| `api/housing/_updateListingHandler.ts` | 画像が変わる更新後に `warmListingOgCard` を await | 4 |
| `api/housing/__tests__/` 該当 | warm 呼び出しの mock | 4 |
| `src/components/housing/listing/HousingActionBar.tsx` | `sourceUrl={listing.sourcePostUrls?.[0] ?? listing.postUrl ?? null}` | 5 |
| `src/components/housing/listing/__tests__/HousingActionBar.test.tsx` | sourcePostUrls 優先のケース | 5 |
| spec `2026-09-02-housing-listing-og-card-design.md` | §2(© 削除)/§4.1(warm 方式)/§6/§7 更新 | 6 |
| `docs/TODO.md` | follow-up 完了に更新 | 6 |

---

## Task 1: カードから © を削除 + CARD_VERSION 2

**Files:** `src/lib/ogpListingCard.ts`, `api/og/_listingCard.ts`, `api/og/__tests__/_listingCard.test.ts`

- [ ] **Step 1: テストを新仕様に(© アサーション削除で RED)**
  - `_listingCard.test.ts`: `'SQUARE ENIX 著作権表記を必ず含む'` と `'SQUARE ENIX 著作権表記を含む'` の 2 テストを削除。
  - `'写真を img ノードとして 1 つ描画する'` は不変。`buildListingPhotoCard` の children が [blur, scrim, img] の 3 個になるので、もし個数を assert しているテストがあれば 4→3 に。`'タイトル/住所/ブランド印は含まない'`(`findByText(..., 'LoPo')` が false)は不変。
  - `buildListingBrandFallbackCard`: `'「LoPo Housing」テキストを含む'` 不変、`'img ノードを含まない'` 不変。
- [ ] **Step 2:** `npx vitest run api/og/__tests__/_listingCard.test.ts` → 削除したテストが無いこと・既存が RED(まだ © あり)なら該当なし、GREEN でも可(構造次第)。実際は「© を含む」テストを消すので RED にはならない → Step 3 実装後に構造テストが通ることを確認する形。
- [ ] **Step 3: 実装**
  - `src/lib/ogpListingCard.ts`: `const CARD_VERSION = '1';` → `'2';`。JSDoc に「v2: カードから © を削除(ページフッターが Materials Usage License を満たすため不要・2026-09-02 masaya)」を追記。
  - `api/og/_listingCard.ts`:
    - `COPYRIGHT_TEXT` 定数と `buildCopyrightLine()` 関数を削除。
    - `buildListingPhotoCard`: children から `buildCopyrightLine()` を削除 → `[blur-bg, scrim, img]` の 3 個。
    - `buildListingBrandFallbackCard`: `children` を配列から単一の「LoPo Housing」div に戻す(© 削除)。`position: relative` は不要なら削除。
    - `handleListingCardRequest`: `loadFonts` ヘルパーを削除。photo card 経路は `fonts` 無し(文字ノードゼロ)。fallback card 経路のみ `const fonts = await loadMPlus1Fonts('LoPo Housing').catch(() => []);`。`loadInterFonts` の import を削除(未使用)。
      ```ts
      try {
        const photoDataUri = imgUrl ? await fetchAsDataUri(imgUrl) : null;
        if (photoDataUri) {
          return new ImageResponse(buildListingPhotoCard(photoDataUri) as any, {
            width: CARD_WIDTH, height: CARD_HEIGHT, headers: CACHE_HEADERS,
          });
        }
        const fonts = await loadMPlus1Fonts('LoPo Housing').catch(() => []);
        return new ImageResponse(buildListingBrandFallbackCard() as any, {
          width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS,
        });
      } catch (err) {
        console.error('Listing OG card error:', err);
        try {
          const fonts = await loadMPlus1Fonts('LoPo Housing').catch(() => []);
          return new ImageResponse(buildListingBrandFallbackCard() as any, {
            width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS,
          });
        } catch (fallbackErr) {
          console.error('Listing OG card fallback error:', fallbackErr);
          return new Response('OG image generation failed', { status: 500 });
        }
      }
      ```
- [ ] **Step 4:** `npx vitest run api/og/__tests__/_listingCard.test.ts src/lib/__tests__/ogpListingCard.test.ts` 全 GREEN。
- [ ] **Step 5:** `npx tsc -p tsconfig.api.json --noEmit` + `npx tsc -b` → exit 0(`loadInterFonts` 未使用 import 残りに注意)。
- [ ] **Step 6:** commit `refactor(og): 物件カードから©削除(ページフッターがライセンス充足)+CARD_VERSION 2`

---

## Task 2: warm 共有ヘルパー

**Files:** `src/lib/housing/listingOgCardWarm.ts` (新規), `src/lib/housing/__tests__/listingOgCardWarm.test.ts` (新規)

**Interfaces / Produces:**
- `computeListingOgCardHash(photoUrl: string): string` — `buildListingOgCardParams({ img: photoUrl })` → `computeOgCardImageHash(...)`。16 hex。
- `async function warmListingOgCard(input: { origin: string; photoUrl: string; setMeta: (hash: string, meta: object) => Promise<void>; fetchImpl?: typeof fetch }): Promise<string | null>` — hash 計算 → `setMeta(hash, { type:'listing', imageUrl: photoUrl, createdAt, lastAccessedAt })` → `fetchImpl(${origin}/og/${hash}.png)` を await(失敗は握りつぶす)→ hash を返す。photoUrl が空なら null。
  - `setMeta` を注入にするのは、呼び出し側(api の Node handler)がそれぞれ `db.collection('og_image_meta').doc(hash).set(...)` を持つため。lib は firebase-admin に依存させない。

- [ ] **Step 1: テスト**
  ```ts
  import { computeListingOgCardHash, warmListingOgCard } from '../listingOgCardWarm';
  describe('computeListingOgCardHash', () => {
    it('16 hex を返す・同じ URL は同じ hash', () => {
      const h = computeListingOgCardHash('https://pbs.twimg.com/media/x.jpg');
      expect(h).toMatch(/^[a-f0-9]{16}$/);
      expect(computeListingOgCardHash('https://pbs.twimg.com/media/x.jpg')).toBe(h);
    });
  });
  describe('warmListingOgCard', () => {
    it('meta を書き warm-up fetch して hash を返す', async () => {
      const setMeta = vi.fn(async () => {});
      const fetchImpl = vi.fn(async () => ({ ok: true } as Response));
      const hash = await warmListingOgCard({ origin: 'https://lopoly.app', photoUrl: 'https://x.test/a.jpg', setMeta, fetchImpl });
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
      expect(setMeta).toHaveBeenCalledWith(hash, expect.objectContaining({ type: 'listing', imageUrl: 'https://x.test/a.jpg' }));
      expect(fetchImpl).toHaveBeenCalledWith(`https://lopoly.app/og/${hash}.png`, expect.anything());
    });
    it('photoUrl 空なら null・何もしない', async () => {
      const setMeta = vi.fn();
      expect(await warmListingOgCard({ origin: 'https://lopoly.app', photoUrl: '', setMeta })).toBeNull();
      expect(setMeta).not.toHaveBeenCalled();
    });
    it('fetch が投げても hash は返す(warm 失敗は非致命)', async () => {
      const hash = await warmListingOgCard({ origin: 'https://lopoly.app', photoUrl: 'https://x.test/a.jpg', setMeta: async () => {}, fetchImpl: async () => { throw new Error('net'); } });
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });
  ```
- [ ] **Step 2:** RED 確認。
- [ ] **Step 3: 実装**(`src/lib/` なので `node:crypto` 経由の `computeOgCardImageHash` を使う。`buildListingOgCardParams` は `src/lib/ogpListingCard.ts` から import — `.js` 不要、同 `src/lib`)。
- [ ] **Step 4:** GREEN + `npx tsc -b`。
- [ ] **Step 5:** commit `feat(housing): 物件OGカードの事前生成共有ヘルパー`

---

## Task 3: `_listingPageHandler` — ブロッキング撤去 + ヘルパー利用

**Files:** `api/share/_listingPageHandler.ts`, `api/share/__tests__/_listingPageHandler.test.ts`

- [ ] **Step 1: テスト更新(RED)**
  - `thumbnail物件はog:imageに自ドメインの生成カードURL(/og/<hash>.png)を使う`: 期待は不変(`/og/[a-f0-9]{16}\.png`)。ただし `global.fetch` の warm-up 呼び出し期待を削除(page はもう warm-up fetch しない)。
  - `生成カードは常に1200x630なので固定のog:image:width/heightを残す`: 不変。
  - storage mock: `exists` は残す(`lastAccessedAt` touch の分岐で使う)。`exists:[false]` のケースでも warm-up fetch されないことを確認するテストを 1 本追加してよい。
- [ ] **Step 2:** RED 確認。
- [ ] **Step 3: 実装**
  - 代表画像ブロック: `warmListingOgCard` は Node handler では使わず(fetch を await したくない)、`computeListingOgCardHash` + inline meta `.set` + `getStorage().exists()` + `lastAccessedAt` touch のみ。**`if (!exists)` の warm-up fetch を削除**。
  ```ts
  const repImages = listingRepresentativeImages(projected as Record<string, unknown>);
  const rawPhoto = repImages[0];
  if (rawPhoto) {
    const photoUrl = /^https?:\/\//.test(rawPhoto) ? rawPhoto : `${origin}${rawPhoto}`;
    try {
      const hash = computeListingOgCardHash(photoUrl);
      await db.collection('og_image_meta').doc(hash).set({
        type: 'listing', imageUrl: photoUrl, createdAt: Date.now(), lastAccessedAt: Date.now(),
      });
      const cardUrl = `${origin}/og/${hash}.png`;
      // 生成は待たない(初回クロールを 9 秒待たせて X がタイムアウトする不具合の修正)。
      // カードは登録・編集時に事前生成済み。未生成でも /og/{hash}.png への初回アクセスで
      // og-cache が生成する(専用関数・ページ描画とは別予算)。
      try {
        const bucket = getStorage().bucket(OG_STORAGE_BUCKET);
        const [exists] = await bucket.file(`og-images/${hash}.png`).exists();
        if (exists) {
          await bucket.file(`og-images/${hash}.png`).setMetadata({ metadata: { lastAccessedAt: String(Date.now()) } }).catch(() => {});
        }
      } catch (metaErr) {
        console.error('Listing OG card lastAccessed touch error:', metaErr);
      }
      ogImageUrl = cardUrl;
    } catch (err) {
      console.error('Listing OG card hash/meta error:', err);
      ogImageUrl = photoUrl;
    }
  }
  ```
  - import: `computeListingOgCardHash` を `../../src/lib/housing/listingOgCardWarm.js` から。`buildListingOgCardParams` の直接 import は不要になれば削除。
- [ ] **Step 4:** `npx vitest run api/share/__tests__/_listingPageHandler.test.ts` GREEN。
- [ ] **Step 5:** `npx tsc -p tsconfig.api.json --noEmit` + `tsc -b`。
- [ ] **Step 6:** commit `fix(housing): 物件ページの初回クロールを即応答に(カード生成を待たない)`

---

## Task 4: 登録・編集時にカード事前生成

**Files:** `api/housing/_registerListingHandler.ts`, `api/housing/_updateListingHandler.ts`, 該当テスト

事前に両ハンドラを読み、listing doc 作成/更新の**直後**、レスポンス返却の**前**に挿入する。
`origin` は他ハンドラ同様 host allowlist から算出(既にあるはず。無ければ `_listingPageHandler` の allowlist ロジックを小さくコピー)。

- [ ] **Step 1: 両ハンドラを読み、挿入点と origin 取得手段を確認**(brief に記録)。
- [ ] **Step 2: テスト**: 登録レスポンス 200 のまま + `og_image_meta.set` と warm fetch が呼ばれること(firebase-admin と global.fetch を mock)。画像ゼロ登録では呼ばれないこと。warm 失敗でも登録は成功すること。
- [ ] **Step 3: 実装**
  - `_registerListingHandler`: listing データから代表画像を出す。register は `buildListingImageFields` で imageMode 等を決めた後の listing データがあるはず — そこから `listingRepresentativeImages(...)` で先頭 URL。
  - `warmListingOgCard({ origin, photoUrl, setMeta: (hash, meta) => db.collection('og_image_meta').doc(hash).set(meta), fetchImpl: fetch })` を **await**(登録処理は元々数秒かかる・クローラーは待っていない)。ただし全体を try/catch で囲み、warm 失敗が登録を落とさないようにする。
  - `_updateListingHandler`: 画像関連フィールド(thumbnailPaths / sourceImageUrls / youtubeVideoId / ogImageUrl 等)が変わった更新のときのみ warm(毎更新で叩かない)。判定が面倒なら「更新後に必ず warm」でも可(コスト小・hash 同一なら Storage 側で no-op に近い)。→ **まず「更新後は必ず warm」で実装**、レビューで過剰なら絞る。
- [ ] **Step 4:** 該当テスト GREEN + tsc。
- [ ] **Step 5:** commit `feat(housing): 物件の登録・編集時にOGカードを事前生成(初回シェアを高速化)`

---

## Task 5: X シェアで sourcePostUrls を優先

**Files:** `src/components/housing/listing/HousingActionBar.tsx`, `src/components/housing/listing/__tests__/HousingActionBar.test.tsx`

- [ ] **Step 1: テスト**: `sourcePostUrls: ['https://youtu.be/abc']` かつ `postUrl: null` の listing で、X ボタンの intent URL に `youtu.be/abc` が入ること。`sourcePostUrls` 空・`postUrl` あり なら従来どおり。両方無ければ LoPo URL。
- [ ] **Step 2:** RED。
- [ ] **Step 3:** line ~169 を
  `sourceUrl={listing.sourcePostUrls?.[0] ?? listing.postUrl ?? null}` に。
  `HousingListing` 型に `sourcePostUrls?: string[]` があること確認(`HousingDetailContent.tsx:141` で使用済みなのであるはず)。
- [ ] **Step 4:** `npx vitest run src/components/housing/listing/__tests__/HousingActionBar.test.tsx` GREEN。
- [ ] **Step 5:** commit `fix(housing): 物件詳細のXシェアで複数投稿URL(sourcePostUrls)を優先`

---

## Task 6: spec / TODO 更新 + ゲート

- [ ] spec `2026-09-02-housing-listing-og-card-design.md`: §2 の「© を焼き込む」→「© はページフッターが充足するためカードには入れない(v2)」に書き換え。§4.1 を warm 方式(登録時生成 + ページ即応答)に更新。§6 の 3 安全装置の「延命」を維持。§7 の cold TTFB Important 1 を「解消(登録時事前生成)」に。
- [ ] `docs/TODO.md`: 物件OGPカードを 🟢(follow-up 完了・デプロイ待ち)に。100 行維持。
- [ ] `npm run build` exit 0。
- [ ] `npx vitest run api/ src/lib/ src/components/housing/listing/__tests__/HousingActionBar.test.tsx` 全緑(フルスイートは既知ハングのため範囲限定・元 plan と同じ運用)。
- [ ] commit `docs: 物件OGPカード follow-up 完了`
- [ ] デプロイ後: `scripts/` に一時 warm-all スクリプトを作り直して全 237 物件を再 warm(v2 で hash が変わり全部再生成が要るため)。スクリプトは各物件について **(1) 物件ページ (`/housing/listing/:id`) を GET → (2) レスポンス HTML から `og:image` の URL(`${origin}/og/<hash>.png`)を parse → (3) その `/og/<hash>.png` URL を GET** する。v2 ではページを踏むだけでは `og_image_meta/{hash}` doc が書かれるだけで **PNG は生成されない**(生成は `/og/<hash>.png` = og-cache への初回アクセスで起きる)ので、(3) を必ず実行すること。masaya に「新規物件を1件登録 → すぐXに貼って画像が出るか」を依頼。

---

## Self-Review

- cold-start 不具合(背景)→ Task 3(ブロッキング撤去)+ Task 4(事前生成)で二重に対処。
- © 二重 → Task 1(カードから削除)。ページフッター © は既存 `StatusBar` で確認済。
- CARD_VERSION 2 → Task 1。既存 v1 キャッシュは 30 日 cron で自然消滅、デプロイ後 warm-all で v2 を即生成。
- sourcePostUrls → Task 5。
- 型: `computeListingOgCardHash` / `warmListingOgCard` は Task 2 で定義、Task 3(hash のみ)/ Task 4(warm 全体)で使用。`setMeta` 注入で lib を firebase-admin 非依存に保つ。
- `_updateListingHandler` の「毎回 warm」は Task 4 で暫定採用、レビューで判断。
