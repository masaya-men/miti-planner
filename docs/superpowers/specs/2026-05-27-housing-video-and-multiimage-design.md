# ハウジング動画再生 + 外部 URL 直接表示拡張 設計書

- 日付: 2026-05-27
- 対象: `/housing` の動画再生方式 (Twitter / YouTube) と外部 URL 直接表示の延長
- ステータス: ドラフト (ユーザーレビュー待ち)
- 関連: [2026-05-21 画像ライフサイクル設計](./2026-05-21-housing-sns-image-lifecycle-design.md) (継承)、 [2026-05-26 Twitter フレーム抽出移植プラン](../../.private/2026-05-26-twitter-video-frames-migration.md) (本設計で**撤回**)

---

## 1. 背景

### 1-1. 現状

- 旧経路 (2026-05-26 実装): Twitter 動画 → `extractVideoFrames` で 3 フレーム抽出 → `upload-thumbnail` で Firebase Storage に jpeg 保存 → `thumbnailPaths[]` 切替表示
- YouTube: サムネ 1 枚 (`maxres → hq → mq → default` の 4 段階画質フォールバック)、 動画再生機能なし
- 画像経路: 2026-05-21 設計書 §6.2 の方針で「外部 URL 直接表示」 化済 (housingsnap / studio-xiv / thonhart / housing-collection-ff14 の OGP 経路)。 最大保存数は `MAX_SOURCE_IMAGE_URLS = 4`

### 1-2. 解決したい問題

- **方針逸脱**: 旧 Twitter 動画経路は「LoPo の倉庫に jpeg を保存する」 という点で、 2026-05-21 設計書 §6.2「外部 URL 直接表示」 原則に反する
- **静的すぎる UX**: カード一覧では画像 1 枚ずつ静止表示。 Allmarks 流の「生きたカード」 体験 (= cap=1 動画 hero + 各カード ambient slideshow) を取り入れたい
- **不必要な制限**: 4 枚保存上限。 LoPo 帯域消費ゼロ (URL 直接表示) + Firestore doc 1MB から見て十二分なのに、 housingsnap で 12 枚撮れている物件を捨てている

### 1-3. 確定方針

外部 URL 直接表示原則を **動画にも拡張**:
- Twitter 動画: mp4 URL を Firestore に保存、 表示時に `/api/tweet-video?url=...` proxy 経由で `<video>` 再生
- YouTube: `youtubeVideoId` だけ保存、 表示時に `youtube-nocookie.com` iframe 埋め込み
- 自前抽出 + Storage 保存 (`extractVideoFrames` 経路) は**完全撤廃**

Allmarks 流の「画面内 1 本だけ動画 hero + 各カード ambient slideshow」 体験を実装:
- 動画は画面内 cap=1、 15 秒で順次入れ替え (ランダム)、 スクロール中停止
- 各カードは独立して静止画を 2.6-6 秒間隔ランダムでクロスフェード
- カードの空気感は静止画レイヤーが担う (= 動画は省力)

画像枚数制限 4 → 10 枚に緩和 (実用上の必要性 + 防御的サニティ上限の両立)。

---

## 2. スコープ

### 含む

- (A) Twitter 動画再生: 一覧 cap=1 hero (controls なし、 muted autoplay loop) + 詳細モーダル (controls あり)
- (B) YouTube iframe 再生: 一覧 cap=1 hero (controls なし、 mute=1 autoplay loop) + 詳細モーダル (controls あり)
- (C) ambient slideshow: 各カード独立、 ランダム desync で静止画クロスフェード
- (D) 旧フレーム抽出経路の完全撤廃 (Storage 保存も含む)
- (E) `MAX_SOURCE_IMAGE_URLS` を 4 → 10 に緩和、 `tweetId + sourceImageUrls` 同居許可
- (F) CSP `media-src` / `frame-src` 変更
- (G) `prefers-reduced-motion` / Lightbox 開放中 / スクロール中の全停止
- (H) i18n キーの動画関連表記整理

### 含まない (別タスク / 将来)

- 既存 Twitter 動画リスティング (旧 `thumbnail` 経路で Storage に jpeg 保存済) の**マイグレーション**: TODO.md「既存テスト物件一掃 + コールドスタート」 で一掃する前提
- 動画 hero での音声 unmute: 一覧では一律 muted (= autoplay 条件)、 unmute は詳細モーダルでのみ
- 動画再生のシーク / 一時停止: 一覧では不可、 詳細モーダルでのみ controls 経由で可
- Vimeo / TikTok 等の追加プラットフォーム
- 既存 jpeg `thumbnailPaths` のクリーンアップ cron (= 旧データが残っていたら別タスクで Storage gc を検討)

---

## 3. データモデル変更

### 3-1. `HousingListing` 追加フィールド (Twitter 動画専用)

| フィールド | 型 | 用途 |
|---|---|---|
| `videoUrl` | `string?` | mp4 URL の生 (例: `https://video.twimg.com/ext_tw_video/.../vid/avc1/1280x720/xxx.mp4`)。 表示時に `/api/tweet-video?url=<encoded>` で proxy 経由 |
| `videoPosterUrl` | `string?` | poster 画像 URL (`pbs.twimg.com/...`)。 video の `<video poster>` 属性 + Lightbox 動画下のフォールバック |
| `videoAspectRatio` | `number?` | `width / height` (例: 1.78 = 16:9)。 一覧でのカードレイアウト確保用 |

3 フィールドとも `imageMode==='sns' && tweetId` のときのみ存在。 YouTube リスティング (`youtubeVideoId`) には不要 (iframe + storyboard は ID から都度生成)。

### 3-2. 既存フィールドの活用と拡張

| フィールド | 用途 |
|---|---|
| `tweetId` | (変更なし) 削除検出 cron + syndication 再 fetch のキー |
| `youtubeVideoId` | (変更なし) 11 文字。 iframe URL (`https://www.youtube-nocookie.com/embed/{id}?...`) + storyboard URL (`https://i.ytimg.com/vi/{id}/hq1.jpg` 等) を都度生成 |
| `sourceImageUrls[]` | **拡張**: OGP 経路に加え、 **Twitter 静止画ツイート** (`photos.length > 0`) でも複数画像 URL リストとして使用。 **保存上限 4 → 10 に緩和** |
| `ogImageUrl` | カバー画像 (= `sourceImageUrls[0]` と一致、 後方互換) |

### 3-3. validation 拡張 (排他制約の緩和)

`src/utils/housingValidation.ts` の `validateImage`:

**現状の排他制約** (L233-241): `hasTweet` / `hasYoutube` / `hasSourceUrls` の 3 つで `sourceCount > 1` ならエラー (= Twitter リスティングは `tweetId + ogImageUrl` 1 枚のみ、 sourceImageUrls は OGP 専用)

**拡張後**: `tweetId` と `sourceImageUrls` の**同居を許可** (= Twitter 静止画ツイート 1-4 枚は sourceImageUrls に詰める)。 YouTube と sourceImageUrls の同居は引き続き禁止 (= YouTube リスティングは storyboard を都度生成、 静止画 URL を保存しない)。

排他マトリクス:

| | tweetId | youtubeVideoId | sourceImageUrls |
|---|---|---|---|
| **tweetId** | — | ✕ | **✓ (新)** |
| **youtubeVideoId** | ✕ | — | ✕ |
| **sourceImageUrls** | **✓ (新)** | ✕ | — |

ホスト allowlist:
- `tweetId + sourceImageUrls` のとき、 各 URL は `pbs.twimg.com` 限定 (任意 URL 注入防止)
- OGP 経路の `sourceImageUrls` は引き続き OGP allowlist の hostname に制限

### 3-3. 撤廃 / 削減

- `MAX_SOURCE_IMAGE_URLS = 4` → `MAX_SOURCE_IMAGE_URLS = 10` (`src/utils/housingValidation.ts:206`、 `HousingRegisterSourceImageUrlsField.tsx` の `DEFAULT_MAX_IMAGES`、 `HousingRegisterForm.tsx` handleSubmit の `slice(0, 4)`、 OGP 取得側のコメント `useOgpFetch.ts:18` を 10 に更新)
- 旧 Twitter 動画用 `imageMode==='thumbnail'` + `thumbnailPaths` 経路は読み取りコードを残しつつ書き込み経路を撤廃 (= 旧データの一覧表示は残るが、 新規登録では生まれない)。 既存テスト物件一掃で完全消滅

---

## 4. コンポーネント / データフロー

### 4-1. 登録経路 (簡素化)

```
HousingRegisterSnsUrlField (URL 入力)
  → useTweetFetch → /api/tweet-meta → TweetData { photos, video: TweetVideoPayload, ... }
  → HousingRegisterForm.handleSubmit:
      - tweetData.photos.length > 0 → photos 全部 (最大 4 枚、 Twitter 仕様) を sourceImageUrls に詰める、 ogImageUrl=photos[0] (Twitter 静止画ツイート)
      - tweetData.video.url 存在 → videoUrl / videoPosterUrl / videoAspectRatio を draft に詰める、 sourceImageUrls は空 (poster は resolveSlideshowFrames で videoPosterUrl から参照、 重複保存しない) (Twitter 動画ツイート)
      - photos も video も無し → ogImageUrl のみ (= テキストツイート、 旧仕様維持)
  → registerListing (POST /api/housing?action=register-listing)
  → _registerListingHandler: imageMode='sns' + tweetId + (sourceImageUrls or videoUrl) + 各 meta を Firestore に保存
```

撤廃する箇所:
- `HousingRegisterForm.tsx:185-224` の `videoExtracting` / `videoExtractFailed` / `extractedVideoUrlRef` + useEffect
- 同ファイル import の `extractVideoFrames` / `dataUrlToCompressedImage`
- 同ファイル handleSubmit の `localImages` 動画フレーム流入路

### 4-2. カード一覧での再生制御 (Allmarks 流移植)

**新規ファイル (`src/lib/housing/` に追加):**

| ファイル | 内容 | 移植元 |
|---|---|---|
| `spotlightRotation.ts` | 純関数 `reconcileSpotlight` / `rotateSpotlight` + `EMPTY_SPOTLIGHT` 定数 | `c:/Users/masay/Desktop/マイコラージュ/lib/board/spotlight-rotation.ts` |
| `useSpotlightRotation.ts` | React hook、 cap + intervalMs (default 15000) でランダム促進 | 同 `use-spotlight-rotation.ts` |
| `slideshowCycle.ts` + `useSlideshowCycle.ts` | 各カード独立、 2.6-6 秒ランダム間隔でフレームインデックスを進める | 同 `use-slideshow-cycle.ts` |
| `slideshowFrames.ts` | `resolveSlideshowFrames(listing)` 純関数 (LoPo 用に書き直し) | 同 `slideshow-frames.ts` の発想 |
| `viewportPlaybackPool.ts` + `useViewportPlaybackPool.ts` | 各カードの visibility ratio → cap 件の候補 Set | 同 `viewport-playback-pool.ts` |
| `useIsScrolling.ts` | window.scroll + 150ms debounce で `isScrolling: boolean` を返す | LoPo 新規 |

**`resolveSlideshowFrames(listing)` の LoPo 用ロジック:**

```ts
function resolveSlideshowFrames(listing: HousingListing): readonly SlideshowFrame[] {
  // sourceImageUrls (OGP / Twitter 静止画ツイート) があれば全部使う
  if (listing.sourceImageUrls && listing.sourceImageUrls.length > 0) {
    return listing.sourceImageUrls.map((src) => ({ src }));
  }
  // YouTube: poster + hq1 + hq2 の 3 枚 storyboard (Allmarks 流、 抽出不要)
  if (listing.youtubeVideoId) {
    const base = `https://i.ytimg.com/vi/${listing.youtubeVideoId}`;
    return [
      { src: `${base}/hqdefault.jpg` },
      { src: `${base}/hq1.jpg`, fallback: `${base}/1.jpg` },
      { src: `${base}/hq2.jpg`, fallback: `${base}/2.jpg` },
    ];
  }
  // Twitter 動画 only (photos なし): poster 1 枚 (静止)
  if (listing.videoPosterUrl) return [{ src: listing.videoPosterUrl }];
  // 旧データ (thumbnail 経路): thumbnailPath / thumbnailPaths
  if (listing.thumbnailPaths?.length) return listing.thumbnailPaths.map((src) => ({ src }));
  if (listing.thumbnailPath) return [{ src: listing.thumbnailPath }];
  // 後方互換: ogImageUrl 1 枚
  if (listing.ogImageUrl) return [{ src: listing.ogImageUrl }];
  return [];
}
```

**カード layer 改修 (`HousingCard.tsx` / `RightPanelListItem.tsx` / `MapBubbleCard.tsx`):**

各カードに 2 つのレイヤーを追加:
- **ambient slideshow オーバーレイ**: `useSlideshowCycle(frames.length)` で進むインデックスに応じてフェード in/out。 `pointer-events: none`。 そのカードが in-view (= IntersectionObserver で観測中) のときだけ動かす
- **動画オーバーレイ**: そのカードの id が `spotlightRotation` の live メンバーに含まれているときのみ表示
  - Twitter: `<video src="/api/tweet-video?url=<encoded videoUrl>" muted playsInline autoplay loop preload="metadata" poster={videoPosterUrl} />`
  - YouTube: `<iframe src="https://www.youtube-nocookie.com/embed/{id}?autoplay=1&mute=1&loop=1&playlist={id}&controls=0&modestbranding=1&rel=0&playsinline=1" allow="autoplay; encrypted-media" />`
  - `pointer-events: none`、 クリックスルーで Lightbox を開く

**親 (`HousingWorkspace` 等の表示エリア) で:**

```ts
const visibility = useViewportPlaybackPool(cardIds);        // Map<id, ratio>
const candidates = useMemo(
  () => new Set(selectActivePlayers(visibility, /* cap */ 1, /* minRatio */ 0.25)),
  [visibility],
);
const reduced = useReducedMotion();
const isScrolling = useIsScrolling(150);
const lightboxOpen = useLightboxOpenFlag();  // 既存 detail modal の state
const ambientOn = !reduced && !isScrolling && !lightboxOpen;
const spotlightCap = ambientOn ? 1 : 0;
const playing = useSpotlightRotation(candidates, spotlightCap, 15000);
```

`playing` Set を子カードに props で渡し、 各カード側で `playing.has(listing.id)` のときだけ動画オーバーレイを mount する。 `ambientOn` も渡して ambient slideshow の有効/無効を制御。

### 4-3. 詳細モーダル (Lightbox)

`HousingDetailModalRoute` + `HousingPhotoGallery` 改修:

- **動画が存在するリスティング** (`videoUrl` または `youtubeVideoId` あり):
  - ギャラリー最上段に動画再生領域 (画像と同じ aspect-ratio 枠を確保)
  - Twitter: `<video src="/api/tweet-video?url=..." controls muted playsInline autoplay loop poster={videoPosterUrl} />` — `controls` で unmute / シーク / フルスクリーン可
  - YouTube: `<iframe src="https://www.youtube-nocookie.com/embed/{id}?autoplay=1&mute=1&playsinline=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen />` — iframe 自体の controls (= YouTube プレイヤー UI)
- **画像ギャラリー**: `resolveSources(listing)` で得た全枚数を表示 (= 上限なし)。 既存 visibleSources 経路に手を入れない (= 元から枚数依存ではない、 配列を返すだけ)。 上限緩和は backend 側 (`MAX_SOURCE_IMAGE_URLS = 10`) のみ
- **一覧との連携**: モーダル開で workspace の `lightboxOpen` フラグが true → `ambientOn=false` → 一覧の spotlight rotation と ambient slideshow が全停止。 モーダル閉で再開

### 4-4. CSP 変更 (`vercel.json`)

| ディレクティブ | 変更前 | 変更後 |
|---|---|---|
| `media-src` | 未定義 (= `'self'` を継承する default-src 依存) | `media-src 'self' blob:` を明示 (Twitter mp4 は `/api/tweet-video` proxy 経由 = 同一 origin。 blob: は将来用) |
| `frame-src` | 未定義 | `frame-src https://www.youtube-nocookie.com` (YouTube iframe 用) |
| `img-src` | 既存 (hotfix28 で OGP allowlist 4 サイト + pbs.twimg.com + i.ytimg.com 追加済) | 変更なし |

---

## 5. 撤去ファイル一覧

| ファイル | 撤去理由 |
|---|---|
| `src/lib/housing/extractVideoFrames.ts` | 旧 3 フレーム抽出経路。 完全廃止 |
| `src/lib/housing/__tests__/extractVideoFrames.test.ts` | 同上 |
| `src/lib/housing/dataUrlToCompressedImage.ts` | `extractVideoFrames` 専用 (grep で確認済)。 一緒に撤去 |
| `src/lib/housing/__tests__/dataUrlToCompressedImage.test.ts` | 同上 |

**撤去せず残すもの:**
- `api/tweet-video.ts` — Twitter mp4 proxy。 再生時に必須 (Referer gate 回避)
- `src/lib/housing/tweetMetaExtract.ts` の `TweetVideoPayload` + `pickBestMp4` — 登録時の動画 URL 抽出に使う

**部分修正:**
- `HousingRegisterForm.tsx` L185-224 の video 抽出 useEffect ブロックを削除、 import を整理
- i18n キー `housing.register.snsUrl.video_extracting` / `video_extract_failed` を削除 (5 言語 ja/en/ko/zh/zh-tw)

---

## 6. アクセシビリティ / パフォーマンス

### 6-1. `prefers-reduced-motion`

- 既存 `useReducedMotion()` を流用。 `reduced === true` で `ambientOn = false` → spotlight rotation + ambient slideshow 全停止
- 詳細モーダル動画も `reduced` なら `autoplay` を外す (ユーザーが controls から手動再生)

### 6-2. スクロール中の停止

- `useIsScrolling(debounceMs=150)` 新規。 window scroll listener + setTimeout 150ms で「動いた → 止まって 150ms 経過 → false」 を返す
- スクロール中は `ambientOn = false` で全停止。 スクロール完了 (debounce 満了) で再開

### 6-3. 視覚的アクセシビリティ

- 動画オーバーレイは `aria-hidden="true"` (ambient、 メイン情報ではない)
- ambient slideshow も `aria-hidden="true"` + 画像は `alt=""` (装飾扱い)
- 詳細モーダルの動画は `<video aria-label="物件動画">` 等 i18n キー経由

### 6-4. パフォーマンス予算

- `cap = 1` で GPU 合成コスト固定 (画面内に動画 100 本あっても再生は 1 本)
- 動画オーバーレイは `<video preload="metadata">` (= 0.5-2MB の moov box のみ初期 fetch、 本体 mp4 は再生開始時)
- ambient slideshow 画像は `<img loading="lazy">` で viewport 接近時のみ fetch
- `useViewportPlaybackPool` は IntersectionObserver 1 個で全カード監視 (= getBoundingClientRect 連発回避)

---

## 7. テスト方針

### 純関数 (vitest)

- `reconcileSpotlight` / `rotateSpotlight` — Allmarks のテストをほぼコピー
- `selectActivePlayers` — visibility ratio Map → 上位 cap 件、 tie-break
- `resolveSlideshowFrames(listing)` — Twitter (photos あり / video only) / YouTube / OGP / 旧データ / 後方互換 の 5+ ケース
- `validateImage` — Twitter (videoUrl 追加), YouTube, OGP (10 枚上限) の各種境界

### Hook (vitest + RTL)

- `useSpotlightRotation` — Math.random 注入で deterministic にテスト
- `useSlideshowCycle` — vi.useFakeTimers でランダム間隔の境界
- `useIsScrolling` — scroll event dispatch + debounce 境界
- `useViewportPlaybackPool` — IntersectionObserver mock + ratio 注入

### コンポーネント

- `HousingCard` — `playing.has(id)` で動画オーバーレイ表示、 `ambientOn=false` で ambient slideshow 停止
- `HousingPhotoGallery` — 動画あり listing で `<video>` / `<iframe>` 描画、 画像ギャラリー全枚数表示
- `HousingRegisterForm` — submit に `videoUrl` / `videoPosterUrl` / `videoAspectRatio` が同梱される (動画ツイート時)

### 実機 (1 件ずつ、 deploy 前)

1. 一覧で動画 1 本だけ再生、 15 秒で別カードに移動
2. スクロール中は動画停止、 停止後 150ms で再開
3. 詳細モーダル開で一覧の動画停止、 モーダル内で動画再生 (controls あり)
4. 詳細モーダル閉で一覧の動画再開
5. YouTube リスティングと Twitter 動画リスティングが混在しても挙動同じ
6. 画像 5 枚以上のリスティングで全部見える
7. `prefers-reduced-motion: reduce` ユーザーで動画 / ambient slideshow 共に静止

---

## 8. 実装順序

1. **撤去 PR**: `extractVideoFrames` + `dataUrlToCompressedImage` 削除、 `HousingRegisterForm.tsx` の動画フレーム経路撤廃、 i18n キー削除。 ビルドが通り、 既存テストが (扱う機能の縮退分以外は) 通ることを確認
2. **データモデル + validation**: `HousingListing` に `videoUrl` / `videoPosterUrl` / `videoAspectRatio` 追加、 `validateImage` 更新、 `MAX_SOURCE_IMAGE_URLS = 10` に変更、 `buildListingImageFields` 更新、 register handler 更新
3. **登録経路**: `HousingRegisterForm.handleSubmit` で動画フィールドを draft に詰める。 動画ツイートを登録 → Firestore に `videoUrl` 等が保存されることを実機確認
4. **純関数 + hook 移植**: `spotlightRotation` / `slideshowCycle` / `viewportPlaybackPool` / `useIsScrolling` / `slideshowFrames` をテスト付きで追加
5. **ambient slideshow オーバーレイ**: `HousingCard` 等に画像クロスフェードレイヤー追加。 動画なし状態でも、 画像複数枚あれば各カードが切り替わることを確認
6. **動画オーバーレイ**: spotlight rotation の live カードで `<video>` / `<iframe>` を mount。 cap=1 動作確認
7. **詳細モーダル**: 動画再生領域 + 全画像ギャラリー、 lightboxOpen フラグで一覧停止連動
8. **CSP 変更** (`vercel.json`): `media-src` / `frame-src` 追加、 deploy preview で動画 / iframe 再生確認
9. **E2E 実機検証**: §7 の 7 シナリオ全部

---

## 9. 確定した設計判断

| 論点 | 決定 | 理由 |
|---|---|---|
| 動画再生の場面 | カード一覧 (cap=1) + 詳細モーダル の両方 | 「生きたカード」 体験は Allmarks 知見 (`reference_allmarks_mycollage`)、 詳細はメインの再生体験 |
| 一覧での同時再生本数 | cap=1 (固定) | Allmarks `HERO_CAP=1` を踏襲。 cap>1 は将来検討 (`feedback_one_fix_one_verify`) |
| hero 切替間隔 | 15 秒 (Allmarks `HERO_PER_CARD_MS=15000`) | 短すぎる切替は注意散漫、 長すぎると順次感が薄れる |
| 切替順 | `Math.random()` でランダム促進 | 予測可能な巡回より自然 |
| 一覧の音声 | 一律 muted (= autoplay 条件) | iOS Safari + ブラウザ規約 |
| 詳細モーダルの音声 | controls あり、 unmute 可能 | ユーザー意図発で音声を出す UX |
| YouTube embed ドメイン | `youtube-nocookie.com` | Cookie 非送出、 プライバシー優先 |
| 画像枚数上限 | 10 枚 (旧 4 枚) | 安全側、 housingsnap 12 枚撮影物件も実用 (10 枚で十分)、 サニティ防御兼ねる |
| Twitter 静止画ツイートのデータ表現 | `tweetId + sourceImageUrls[]` (排他緩和) | 「外部 URL 直接表示」 原則を Twitter にも一貫適用、 1 ツイート 4 枚画像をフル活用 |
| 既存マイグレーション | しない | テスト物件一掃 + コールドスタートで自然消滅 (`project_housing_phase_status`) |
| 撤去ファイル | `extractVideoFrames` + `dataUrlToCompressedImage` 完全削除 | 外部 URL 直接表示原則の延長 (`feedback_housing_external_url_direct`) |
| `api/tweet-video.ts` | 残す | 再生時に必須 (Referer gate 回避)、 旧経路と用途が違うだけ |

---

## 10. リスクと緩和

| リスク | 緩和策 |
|---|---|
| YouTube iframe が遅延ロード | `cap=1` なので画面内 1 個のみ、 iframe 自体は ~500KB-1MB の JS だが 1 回限り |
| Twitter mp4 proxy 経由のレイテンシ | 既存 `api/tweet-video.ts` Edge runtime + Range 透過、 ハウジング α 期間中の利用規模では実用十分 |
| ambient slideshow で大量 fetch | `<img loading="lazy">` + IntersectionObserver gating でカード入域時のみ |
| 旧 thumbnail データ + 新 sourceImageUrls の混在 | `resolveSlideshowFrames` で優先順位明示 (sourceImageUrls → YouTube storyboard → poster → 旧 thumbnailPaths → ogImageUrl) |
| `prefers-reduced-motion` で完全静止になり寂しい | カードは元から表示されている (= 動かなくても情報は伝わる)、 reduced ユーザーの意図優先 |

---

## 11. 確認事項 (レビューで埋めるもの)

なし。 §9 で全論点を確定。
