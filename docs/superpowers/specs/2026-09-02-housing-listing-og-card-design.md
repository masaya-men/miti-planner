# ハウジング物件ページ OGP 画像を「自ドメイン再ホスト方式」にする 設計書

- 日付: 2026-09-02
- 分類: architectural（既存の共有 OGP 生成インフラに `type=listing` を追加 + `_listingPageHandler` の og:image 選定を差し替え）
- 前提タスク: `docs/TODO.md`「次の作業順」1番（致命バグ・単独で先にリリース）
- ステータス: masaya 承認済み（見た目=おすすめ案 / 印なし / 設計書レビューは masaya 免除、実装まで進めてよい）

---

## 1. 背景と問題

物件詳細ページ `/housing/listing/:id` の OGP は `api/share/_listingPageHandler.ts` が生成する。
現状、`og:image` / `twitter:image` にはその物件の**代表写真 1 枚の URL をそのまま**入れている
（`listingRepresentativeImages(projected)[0]`）。

X 投稿由来の物件（`imageMode:'sns'`）の場合、その URL は `pbs.twimg.com/...`
（Twitter の画像 CDN）になる。

- **Discord / Slack / Facebook**: `pbs.twimg.com` を素直に取得して表示する → 写真が出る
- **X (Twitter)**: 他サイトのリンクカード画像として自社 CDN (`pbs.twimg.com`) の画像を出さない
  → **画像なしカード**になる

結果、誰かが物件 URL だけを X に貼ると、写真のないカードが表示される（致命的：シェアの主目的が果たせない）。

### 根因

og:image が**うちのドメイン以外（特に pbs.twimg.com）を指している**こと。
X はうちのドメイン (`lopoly.app`) の画像なら普通に表示する（フォールバックの `/api/og` カード、
ハウジンガーカード、ツアー招待カードは全て X で表示できている＝実証済み）。

---

## 2. 解決方針（確定）

**カードを「デザイン」しない。物件の代表写真を、うちのドメインから配り直すだけ。**

1. `_listingPageHandler` は、代表写真があればその URL から**内容ハッシュ**を作り、
   `og_image_meta/{hash}` にメタを保存、`og:image` を `${origin}/og/{hash}.png` にする。
2. `/og/{hash}.png` は既存の rewrite で `/api/og-cache?h={hash}` に落ちる。
3. `/api/og-cache` は Storage に無ければ `/api/og?type=listing&img=<写真URL>&sig=<HMAC>` を叩き、
   返ってきた PNG を `og-images/{hash}.png` に保存して配信（以降は Storage HIT）。
4. `/api/og?type=listing` は写真 URL をサーバー側で fetch し、**1200×630 に整形**した PNG を返す。
   - 整形方式: 背景に同じ写真を `cover`（はみ出しトリミング）でぼかして敷き、
     その上に写真全体を `contain`（切らずに収める）で重ねる（Instagram の縦長投稿の見え方）。
   - **タイトル・枠・ブランド印は焼き込まない**（masaya 指示）。タイトル・住所は `og:title` /
     `og:description` から各 SNS が自前でカード文字部分に出すので画像には不要。
   - **例外: © SQUARE ENIX 表記のみ焼き込む**（masaya 2026-09-02 決定）。下端中央に極小 1 行
     `© SQUARE ENIX CO., LTD. All Rights Reserved.`（`_housingerCard.ts` の `COPYRIGHT_TEXT` /
     `ja.json footer.copyright` と同一文言）。写真の上でも読める強シャドウ。この 1 行のためだけに
     写真カード経路でもフォント（Inter）を読み込む。

### この方式が「デザインしたカード生成」より優れている点

- 実装が軽い（satori のレイアウトはぼかし背景 + 写真 1 枚だけ。ツアー招待カードとほぼ同型）
- 写真が主役（物件シェアの目的そのもの）
- 恒常コスト ≒ 0（§6）
- 既存インフラ（`/api/og` + `/api/og-cache` + `og_image_meta` + 週次クリーンアップ cron）を丸ごと再利用

### de-risking（調査済みの事実）

- `api/og/_housingerCard.ts` は既に外部 SNS 画像（`sourceImageUrls` = pbs.twimg.com を含む）を
  サーバー側 fetch → base64 化 → satori 合成しており、**本番で稼働中**。
  → Edge Function から `pbs.twimg.com` を fetch できることは実証済み。
- `satori` (`@vercel/og`) は WebP/AVIF 非対応。`_housingerCard.ts` の `sniffSupportedImageMime`
  がマジックナンバーで判定して弾く（弾いたら「写真なし」扱い）。物件写真の実データは
  PNG（thumbnail の `.png` 兄弟）/ JPG（Twitter・YouTube）が大多数なので実害は小さい。
  WebP しか無い物件はフォールバックのブランドカード（§4.3）になる。

---

## 3. 変更対象ファイル

### 新規

| ファイル | 役割 |
|---|---|
| `src/lib/ogpListingCard.ts` | URL 組み立て + HMAC 署名/検証（`ogpTourInviteCard.ts` と同型・パラメータは `img` 1 個） |
| `api/og/_listingCard.ts` | satori 要素ツリー + `handleListingCardRequest(searchParams)` |
| `api/og/_fetchOgImage.ts` | `_housingerCard.ts` 内の private `fetchAsDataUri` / `sniffSupportedImageMime` / `arrayBufferToBase64` を共有モジュールに抽出（`_housingerCard.ts` / `_listingCard.ts` の両方から import） |
| `src/lib/__tests__/ogpListingCard.test.ts` | 署名往復・パラメータ順のテスト |
| `api/og/__tests__/_listingCard.test.ts` | 写真あり/fetch 失敗時の要素ツリー形状のテスト（fetch をモック） |
| `api/og-cache/__tests__/_ogCacheLogic.test.ts` | `listing` 分岐のテスト（無ければ新規、あれば追記） |

### 変更

| ファイル | 変更内容 |
|---|---|
| `api/og/index.ts` | housinger/tour の分岐の隣に `if (type === 'listing') return handleListingCardRequest(searchParams);` |
| `api/og-cache/_ogCacheLogic.ts` | `OgImageMeta` に `imageUrl?: string`。`buildInternalOgUrl` に `listing` 分岐（`buildListingOgCardUrl(origin, { img: meta.imageUrl ?? '' }, cronSecret)`） |
| `api/og/_housingerCard.ts` | `fetchAsDataUri` 等を `_fetchOgImage.ts` からの import に置き換え（挙動は 1 bit も変えない） |
| `api/share/_listingPageHandler.ts` | og:image 選定ロジックを差し替え（§4.1）。`usedListingPhoto` による width/height 削除ブランチを撤去（§4.2） |
| `api/share/__tests__/_listingPageHandler.test.ts` | 既存テスト 2 件を新仕様に更新（§5） |
| `vercel.json` | （任意・低優先）`/og/*` の Cloudflare Cache Rule はコードでなくダッシュボード作業。§6 の運用メモに記載 |

---

## 4. 詳細設計

### 4.1 `_listingPageHandler` の og:image 選定

現状（撤去する）:

```ts
const repImages = listingRepresentativeImages(projected as Record<string, unknown>);
if (repImages[0]) {
  ogImageUrl = /^https?:\/\//.test(repImages[0]) ? repImages[0] : `${origin}${repImages[0]}`;
  usedListingPhoto = true;
}
```

新（`_housingerPageHandler.ts` の card-hash / meta 書き込み / warm-up パターンを踏襲）:

```ts
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
    const url = `${origin}/og/${hash}.png`;
    try {
      const bucket = getStorage().bucket(OG_STORAGE_BUCKET);
      const [exists] = await bucket.file(`og-images/${hash}.png`).exists();
      if (!exists) {
        await fetch(url, { headers: { 'User-Agent': 'LoPo-ListingWarmup/1.0' } });
      }
    } catch (warmErr) {
      console.error('Listing OG card warm-up error:', warmErr);
    }
    ogImageUrl = url;
  } catch (err) {
    console.error('Listing OG card hash/meta error:', err);
    // 失敗時は従来どおり生 URL にフォールバック（Discord では出る・X では出ないが、
    // 少なくとも現状維持。ここが失敗するのは Firestore/Storage 障害時のみ）
    ogImageUrl = photoUrl;
  }
}
// rawPhoto が無ければ ogImageUrl は DEFAULT_OG_IMAGE（'/api/og'）のまま = 現状維持
```

`getStorage` / `OG_STORAGE_BUCKET` は `_housingerPageHandler.ts` と同じものを import する。

### 4.2 og:image:width/height 宣言

`index.html` は `og:image:width=1200` / `og:image:height=630` を固定宣言している。
現状は「任意アスペクト比の生写真を og:image にしたとき宣言が虚偽になる」ため
`usedListingPhoto` のときだけ削除していた。

新方式では og:image は**常に 1200×630 の生成 PNG**（生写真 URL を直接使うのは §4.1 の
try/catch 失敗時のみ＝Firestore/Storage 障害時の degraded パス）。
→ **width/height 削除ブランチを撤去し、宣言は常に残す**。`usedListingPhoto` 変数も削除。

（degraded パスで生写真になったケースだけ宣言が不正確になるが、それは Firestore/Storage
障害時の一過性かつ Discord 等ではもともと写真が出る。X ではどのみち出ない。許容。）

### 4.3 `api/og/_listingCard.ts`

```
handleListingCardRequest(searchParams):
  1. CRON_SECRET 未設定 → 400（fail-closed、housinger と同じ）
  2. verifyListingOgCardSig 失敗 → 400
  3. imgUrl = searchParams.get('img')
  4. photoDataUri = await fetchAsDataUri(imgUrl)   // _fetchOgImage.ts、4秒 timeout / 8MB 上限 / WebP 弾き
  5. fonts = loadMPlus1Fonts('LoPo Housing') + loadInterFonts(© 文字)   // © 行のため写真経路でも読む
  6a. photoDataUri あり → ImageResponse(buildListingPhotoCard(photoDataUri), 1200x630, fonts, CACHE_HEADERS)
  6b. photoDataUri なし（fetch 失敗・WebP・timeout・404）
      → ImageResponse(buildListingBrandFallbackCard(), 1200x630, fonts, CACHE_HEADERS)
  7. try 全体が投げたら buildListingBrandFallbackCard() で 200 を返す（500 を返さない）
```

`buildListingPhotoCard(photoDataUri)`（写真 + © 1 行のみ・タイトル/住所なし）:

```
div  1200x630 relative flex  backgroundColor: '#111725'（葉書外の下地。ハウジング BG 色）
  ├─ div  FULL_BLEED_ABSOLUTE  backgroundImage: url(photo)  backgroundSize: cover
  │       backgroundPosition: center  filter: blur(24px)  transform: scale(1.15)
  ├─ div  FULL_BLEED_ABSOLUTE  backgroundColor: 'rgba(10,14,24,0.28)'（ぼかし帯を軽く沈める）
  ├─ img  src: photo  width: 1200  height: 630  style: { objectFit: 'contain' }
  └─ buildCopyrightLine()  下端中央 11px  © SQUARE ENIX ...  強シャドウ
```

- `FULL_BLEED_ABSOLUTE` は `_housingerCard.ts` と同じ「4 辺個別指定」（satori の `inset:0` バグ回避）。各ファイルで定義。
- `buildCopyrightLine()` は `_housingerCard.ts` の同名関数と同じスタイル方針（absolute bottom / 11px / Inter / 強 textShadow）。
- `objectFit: 'contain'` が satori で期待通り動くことを**ローカルプレビュースクリプトで確認**（§7）。
  想定外なら「img を flex 中央の div でラップし maxWidth/maxHeight」に代替。

`buildListingBrandFallbackCard()`（写真が取れないテキストツイート由来など）:

- `#111725` 背景中央に「LoPo Housing」の文字（M PLUS 1）+ 下端に `buildCopyrightLine()`。
- `api/og/_tourInviteCard.ts` の `buildTourInviteFallbackCard` に © 行を足したもの。
- **注意**: `_listingPageHandler` は代表写真がある物件でしか `type=listing` を呼ばない
  （写真ゼロなら `DEFAULT_OG_IMAGE` のまま）。このフォールバックが使われるのは
  「代表写真の URL はあるが取得に失敗した」ケースのみ。

`CACHE_HEADERS` = `{ 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' }`（housinger と同一）。

### 4.4 `src/lib/ogpListingCard.ts`

`ogpTourInviteCard.ts` をコピーして最小改変（パラメータが `name` → `img` になるだけ）:

- `CARD_VERSION = '1'`
- `buildListingOgCardParams({ img })`: `type=listing` / `ver=1` / `img=<url>` を安定順で set
- `signListingOgCardParams` / `buildListingOgCardUrl` / `verifyListingOgCardSig`: HMAC-SHA256(CRON_SECRET) の先頭 24 hex。`ogpTourInviteCard.ts` と同一実装
- Web Crypto (`crypto.subtle`) のみ使用（Edge/Node 両対応・Node テストランナーでそのまま通る）

### 4.5 `api/og-cache/_ogCacheLogic.ts`

```ts
export interface OgImageMeta {
  type?: string;
  shareId?: string; showLogo?: boolean; logoHash?: string | null; lang?: string;
  pattern?: string; name?: string; bio?: string | null; avatarUrl?: string | null; imageUrls?: string[];
  imageUrl?: string;   // ← 追加（type='listing' 用）
}

// buildInternalOgUrl 内、housinger 分岐の隣:
if (meta.type === 'listing') {
  if (!cronSecret) throw new Error('CRON_SECRET not configured');
  return buildListingOgCardUrl(origin, { img: meta.imageUrl ?? '' }, cronSecret);
}
```

`isValidOgImageMeta` は現状「`type` が無い/`page` のときだけ `shareId` 必須、その他は無条件 true」
なので `listing` はそのまま通る。厳密化するなら `if (meta.type === 'listing') return typeof meta.imageUrl === 'string';` を足す（任意）。

---

## 5. 既存テストの更新（`_listingPageHandler.test.ts`）

| テスト | 現状の期待 | 新しい期待 |
|---|---|---|
| `thumbnail物件はog:imageに家の写真(.png兄弟の絶対URL)を使う` | `og:image` = `https://lopoly.app/housing-media/.../a.png` | `og:image` = `https://lopoly.app/og/<16hex>.png`（正規表現マッチ）。meta 書き込み・warm-up fetch はモック |
| `家の写真をog:imageに採用したときは固定のog:image:width/height(1200x630)を削除する` | width/height が**消える** | width/height が**残る**（アサーション反転、テスト名も変更） |
| `画像の無い物件(テキストツイート等)はog:imageがDEFAULT_OG_IMAGEのまま` | `/api/og` | 変更なし（写真ゼロは従来どおり） |
| `画像の無い物件(フォールバック)は固定のog:image:width(1200)を残す` | 残る | 変更なし |
| `Firestore取得失敗時は404を強制せず200` / `物件ID不在→404` / タイトルフォールバック 3 件 | — | 変更なし |

テスト内の `global.fetch` モックは、`index.html` 取得に加えて warm-up の `${origin}/og/<hash>.png`
呼び出しも受ける必要がある（URL で分岐させて適当な 200 を返す）。
`getStorage().bucket().file().exists()` は firebase-admin モックに `exists: () => [false]` 相当を追加。

新規テスト（`ogpListingCard.test.ts` / `_listingCard.test.ts` / `_ogCacheLogic.test.ts`）は §3 参照。

---

## 6. コストと運用

### 保存されるもの

- 代表写真がある物件 1 件につき、1200×630 PNG 1 枚を `og-images/{hash}.png` に保存
- `@vercel/og` の出力は PNG。写真の PNG は 1〜2MB 程度
- Google が全物件ページをインデックスするので、実質「クロールされた全物件 × 1 枚」

### 3 つの安全装置

1. **内容ハッシュで一生 1 回**: 同じ写真 URL なら同じ hash＝同じ 1 ファイル。再シェアで作り直しは起きない
2. **`immutable` 長期キャッシュ**: `/api/og-cache` は `public, max-age=31536000, immutable` を返す。
   X / Discord / Google は初回のみ取得、以降は各自のキャッシュ
3. **30 日で自動削除**: `api/cron/cleanup-og-images`（週次・日曜 03:00 UTC）が
   `lastAccessedAt` 30 日超の `og-images/*` と `og_image_meta/{hash}` を削除。
   誰もシェアせず Google も来なくなった物件の画像は自然に消える＝貯まり続けない

### 試算

- 物件 5,000 件が全部インデックスされても 約 5〜10GB
- Firebase Storage $0.026/GB/月 → **月 $0.13〜0.26**
- 配信 egress はキャッシュが効くのでほぼゼロ
- この機構は housinger（1 人 2 枚）/ tour / 共有プランで既に本番稼働、storage 起因の問題は出ていない

### 運用メモ（任意・低優先）

- Cloudflare の Cache Rule に `/og/*` が入っているか未確認。無ければダッシュボードで追加すると、
  X がカードを定期再検証する際の Vercel Function + Storage 往復が減る。コスト影響は小さいので後回し可
- 既存の X 投稿に貼られた物件 URL の「画像なしカード」は X 側キャッシュが数日〜数週間残る（TODO で許容済み）。
  新しくシェアされたものから正しく出る

---

## 7. 実装中の検証

- **ローカルプレビュー**: `scripts/` に一時スクリプト（satori 直呼び出し → sharp → PNG）を作り、
  `objectFit: 'contain'` の見え方・ぼかし背景・縦長/横長/正方形の 3 比率を目視確認
  （`docs/.private/2026-08-01-ogp-card-design-mockups.md` の手法）。役目を終えたら削除
- **push 前ゲート**: `npm run build`（tsc -b 厳密）+ `npx vitest run`（EphemeralAddPanel 既知 7 件除く）
- **デプロイ後**: 実際の物件 URL を X / Discord のカードバリデータ（またはツイート）で確認。
  X 投稿由来の物件（`imageMode:'sns'`）で写真が出ることを最優先で確認
- **デプロイ後**: `og-images/*` に `listing` 分の hash が生成されているか Storage で確認

---

## 8. スコープ外（今回やらない）

- カードへのタイトル・住所・ブランド印の焼き込み（masaya 指示。© 1 行だけは §2 のとおり入れる）
- 写真ゼロの物件の OGP を housing ブランドカードにする（今は汎用 `/api/og`。別タスク）
- 中国語・韓国語・繁体字対応（この経路は i18n を通らず静的日本語。他ハンドラーと同じ方針）
- `/og/*` の Cloudflare Cache Rule 追加（§6 運用メモ）

## 9. 確定済み（旧・未確定事項）

1. © SQUARE ENIX 表記 → **masaya 2026-09-02「入れる」**。§2 に反映済み。全カード下端中央に 11px 1 行。
