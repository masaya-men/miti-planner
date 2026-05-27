# ハウジング動画再生 + 外部 URL 直接表示拡張 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング `/housing` で旧 Twitter 動画フレーム抽出 + Storage 保存経路を完全撤廃し、 Allmarks 流の「カード一覧 cap=1 動画 hero (15 秒ランダム順次切替) + 各カード ambient 静止画 slideshow + 詳細モーダル controls あり再生」 を実装する。 画像枚数上限 4→10、 `tweetId + sourceImageUrls` 排他緩和 (Twitter 静止画ツイートも複数枚化) を同梱。

**Architecture:** 純関数 (`spotlightRotation` / `viewportPlaybackPool` / `slideshowFrames`) + React hooks (`useSpotlightRotation` / `useSlideshowCycle` / `useViewportPlaybackPool` / `useIsScrolling`) + 既存 `useReducedMotion` を組み合わせ、 `HousingWorkspace` でオーケストレーション。 各カードに 2 つのオーバーレイ (ambient slideshow / 動画) を追加し、 視野内 1 枚だけが動画 live メンバーになる。 Twitter は `<video>` + proxy、 YouTube は `<iframe youtube-nocookie>` で表示。

**Tech Stack:** React 19 + TypeScript 5.9 + Vite 7 + Vitest 4 (vmThreads pool 厳守、 memory `reference_vitest_pool_firebase`) + Firebase 12 + Tailwind v4 + LoPo `housing.css` token system。 Spec: [docs/superpowers/specs/2026-05-27-housing-video-and-multiimage-design.md](../specs/2026-05-27-housing-video-and-multiimage-design.md)

**Pre-flight (1 回のみ、 タスク着手前に):**
- `rtk git pull` で main を最新化
- `npm run build` と `npm test` がクリーンに通ること確認
- LoPo memory を確認: `feedback_one_fix_one_verify` (1 件ずつ実機検証), `feedback_vercel_tsc_strict` (push 前必ず build+test), `reference_vitest_pool_firebase` (vmThreads 厳守)

**コミット規約:**
- 各 commit は `<type>(housing): #60 <要約> — <詳細>` 形式
- 各タスクグループの最後で実機検証 → 問題なければ push (= Vercel 自動 deploy)
- Hobby プラン月 100 ビルド制限あり、 関連 commit はまとめて push

---

## File Structure

### 新規ファイル (8)

| パス | 責務 |
|---|---|
| `src/lib/housing/spotlightRotation.ts` | 純関数: `reconcileSpotlight` / `rotateSpotlight` / `EMPTY_SPOTLIGHT` |
| `src/lib/housing/__tests__/spotlightRotation.test.ts` | 純関数テスト |
| `src/lib/housing/useSpotlightRotation.ts` | React hook: candidates Set + cap + intervalMs (15s) でランダム促進 |
| `src/lib/housing/__tests__/useSpotlightRotation.test.tsx` | hook テスト (fake timer + 注入乱数) |
| `src/lib/housing/slideshowFrames.ts` | 純関数: `resolveSlideshowFrames(listing)` でカード用静止画リスト構築 |
| `src/lib/housing/__tests__/slideshowFrames.test.ts` | 純関数テスト |
| `src/lib/housing/slideshowCycle.ts` | 純関数: `pickNextStepMs(rng)` (= 2.6-6s ランダム) |
| `src/lib/housing/useSlideshowCycle.ts` | React hook: frameCount → 表示中 index |
| `src/lib/housing/__tests__/useSlideshowCycle.test.tsx` | hook テスト |
| `src/lib/housing/viewportPlaybackPool.ts` | 純関数: `selectActivePlayers(ratios, cap, minRatio)` |
| `src/lib/housing/__tests__/viewportPlaybackPool.test.ts` | 純関数テスト |
| `src/lib/housing/useViewportPlaybackPool.ts` | React hook: ref Map + IntersectionObserver → ratio Map |
| `src/lib/housing/__tests__/useViewportPlaybackPool.test.tsx` | hook テスト |
| `src/lib/housing/useIsScrolling.ts` | React hook: window scroll + 150ms debounce |
| `src/lib/housing/__tests__/useIsScrolling.test.tsx` | hook テスト |
| `src/components/housing/workspace/HousingCardAmbientSlideshow.tsx` | 静止画クロスフェードレイヤー |
| `src/components/housing/workspace/HousingCardVideoOverlay.tsx` | 動画再生レイヤー (Twitter `<video>` or YouTube `<iframe>`) |

### 変更ファイル (主要)

| パス | 変更内容 |
|---|---|
| `src/types/housing.ts` | `HousingListing` に `videoUrl?` / `videoPosterUrl?` / `videoAspectRatio?` 追加 |
| `src/utils/housingValidation.ts` | `MAX_SOURCE_IMAGE_URLS = 10`、 `validateImage` 排他緩和 + 動画 URL 検証、 `buildListingImageFields` 動画フィールド対応 |
| `src/components/housing/register/HousingRegisterForm.tsx` | 動画フレーム抽出 useEffect 撤去、 動画 URL を draft に詰める |
| `src/components/housing/register/HousingRegisterSourceImageUrlsField.tsx` | `DEFAULT_MAX_IMAGES = 10` |
| `src/lib/housing/useOgpFetch.ts` | コメント更新 (4→10) |
| `src/components/housing/listing/HousingPhotoGallery.tsx` | 動画再生対応 + 全枚数表示 (上限解除) |
| `src/components/housing/listing/HousingDetailModalRoute.tsx` | `lightboxOpen` フラグ propagation |
| `src/components/housing/workspace/HousingWorkspace.tsx` (など workspace ルート) | hook オーケストレーション、 `playing` Set を子に prop drilling or context |
| `src/components/housing/workspace/HousingCard.tsx` | ambient slideshow + 動画オーバーレイの組込み |
| `src/components/housing/workspace/RightPanelListItem.tsx` | 同上 |
| `src/components/housing/workspace/MapBubbleCard.tsx` | 同上 (マップ pin の bubble) |
| `src/components/housing/workspace/FavoriteCard.tsx` | 同上 (お気に入りカード) |
| `src/styles/housing.css` | ambient slideshow / 動画オーバーレイ用 token + class |
| `vercel.json` | CSP `media-src` / `frame-src` 追加 |
| `src/locales/{ja,en,ko,zh-CN,zh-TW}/housing.json` | `video_extracting` / `video_extract_failed` キー削除、 動画関連新キー追加 |
| `api/housing/_registerListingHandler.ts` | draft の動画フィールド受領 |

### 撤去ファイル (4)

- `src/lib/housing/extractVideoFrames.ts`
- `src/lib/housing/__tests__/extractVideoFrames.test.ts`
- `src/lib/housing/dataUrlToCompressedImage.ts`
- `src/lib/housing/__tests__/dataUrlToCompressedImage.test.ts`

---

## Task Group 1: 旧フレーム抽出経路の撤去

**目的:** 「外部 URL 直接表示」 原則と矛盾する 3 フレーム抽出 + Storage 保存経路を完全削除する。 削除のみで機能変更は最小に留め、 既存テスト物件は新規登録できないだけで、 既に Storage 保存済の旧データの**表示**は引き続き動く (= `thumbnailPath` / `thumbnailPaths` 経路は残す)。

### Task 1.1: extractVideoFrames + dataUrlToCompressedImage を撤去

**Files:**
- Delete: `src/lib/housing/extractVideoFrames.ts`
- Delete: `src/lib/housing/__tests__/extractVideoFrames.test.ts`
- Delete: `src/lib/housing/dataUrlToCompressedImage.ts`
- Delete: `src/lib/housing/__tests__/dataUrlToCompressedImage.test.ts`

- [ ] **Step 1: 利用箇所の最終確認 (撤去で壊れる import がないか)**

Run: `rtk grep "extractVideoFrames\|dataUrlToCompressedImage" --type ts --type tsx`

Expected: `src/components/housing/register/HousingRegisterForm.tsx` で import している箇所 (L30-31) のみ。 `api/tweet-video.ts` はコメント言及のみで import なし。 撤去先 4 ファイル以外で実利用がないことを確認。

- [ ] **Step 2: 4 ファイルを削除**

```bash
rm src/lib/housing/extractVideoFrames.ts
rm src/lib/housing/__tests__/extractVideoFrames.test.ts
rm src/lib/housing/dataUrlToCompressedImage.ts
rm src/lib/housing/__tests__/dataUrlToCompressedImage.test.ts
```

- [ ] **Step 3: build 確認 (= TS エラーで残された import を検出)**

Run: `npm run build`

Expected: `src/components/housing/register/HousingRegisterForm.tsx` の import 2 行で `Cannot find module` エラー。 これは Task 1.2 で解消する。

- [ ] **Step 4: commit はせず Task 1.2 へ進む** (build エラーが残っている状態でのコミットは避ける)

### Task 1.2: HousingRegisterForm の動画フレーム経路を撤去

**Files:**
- Modify: `src/components/housing/register/HousingRegisterForm.tsx`

- [ ] **Step 1: import 行 (L30-31) を削除**

ファイル冒頭の以下 2 行を削除:

```ts
import { extractVideoFrames } from '../../../lib/housing/extractVideoFrames';
import { dataUrlToCompressedImage } from '../../../lib/housing/dataUrlToCompressedImage';
```

- [ ] **Step 2: state を削除 (L108-112)**

以下 3 行を削除:

```ts
const [videoExtracting, setVideoExtracting] = useState(false);
const [videoExtractFailed, setVideoExtractFailed] = useState(false);
const extractedVideoUrlRef = useRef<string | null>(null);
```

`useRef` import の他用途を確認: 同ファイル内で他に `useRef` を使っていなければ import 行から `useRef` も削除する (build エラー警告で確認)。

- [ ] **Step 3: useEffect (動画フレーム抽出) を削除 (L186-224 付近)**

```ts
useEffect(() => {
  const videoUrl = tweetData?.video?.url;
  if (!videoUrl) {
    extractedVideoUrlRef.current = null;
    setVideoExtracting(false);
    setVideoExtractFailed(false);
    return;
  }
  // ... 全体削除
}, [tweetData?.video?.url]);
```

- [ ] **Step 4: JSX 内の進捗 / エラー表示を削除 (L331-341 付近)**

```tsx
{videoExtracting && (
  <div className="housing-fetch-indicator">
    <span className="housing-spinner" aria-hidden />
    <span>{t('housing.register.snsUrl.video_extracting')}</span>
  </div>
)}
{videoExtractFailed && (
  <p className="housing-error-text">
    {t('housing.register.snsUrl.video_extract_failed')}
  </p>
)}
```

- [ ] **Step 5: handleSubmit 内の動画 poster fallback コメントを更新 (L261-262)**

旧:

```ts
// 動画ツイート + 抽出失敗のときは posterUrl を photo として救済 (2026-05-26 D)
const photo = tweetData?.photos?.[0] ?? tweetData?.video?.posterUrl;
```

新 (動画 URL は Task Group 2 で別途扱うため、 ここでは photos のみ):

```ts
// 静止画ツイートは photos[0]、 動画ツイートは Task Group 2 で videoUrl 系を別経路で保存する
const photo = tweetData?.photos?.[0];
```

- [ ] **Step 6: build 確認**

Run: `npm run build`

Expected: クリーンに pass

- [ ] **Step 7: vitest 確認**

Run: `npm test`

Expected: `extractVideoFrames` / `dataUrlToCompressedImage` 関連テストが撤去されているので、 全体は pass。 `HousingRegisterForm` 関連テストで動画フレーム前提の assertion が残っていたら、 それは Task 1.3 で対処。

- [ ] **Step 8: commit (Task 1.3 と Task 1.4 もまとめて push するので、 ここは commit のみ)**

```bash
rtk git add -A
rtk git commit -m "$(cat <<'EOF'
chore(housing): #60 旧 Twitter 動画フレーム抽出経路を撤去

外部 URL 直接表示原則 (設計書 §6.2) と矛盾する 3 フレーム抽出 +
Storage 保存経路を完全削除。 extractVideoFrames / dataUrlToCompressedImage
の 2 ファイル + テストを削除、 HousingRegisterForm の useEffect / state /
進捗 UI も撤去。 動画ツイートは Task Group 2 で videoUrl 系フィールドで扱う。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.3: HousingRegisterForm 関連テストで動画フレーム前提を撤去

**Files:**
- Modify: `src/__tests__/housing/HousingRegisterTweetPreview.test.tsx` (該当があれば)
- Modify: `src/__tests__/housing/HousingRegisterFormModal.test.tsx` (該当があれば)

- [ ] **Step 1: 関連テストを grep**

Run: `rtk grep "video_extracting\|video_extract_failed\|videoExtracting\|extractVideoFrames" --type tsx --type ts`

Expected: 撤去済 import 以外で残っている assertion を列挙

- [ ] **Step 2: 残った assertion を削除**

各テストファイルで該当 `it()` ブロックを削除。 削除前後で `describe()` 構造が壊れないことを確認。

- [ ] **Step 3: vitest 確認**

Run: `npm test`

Expected: 全 pass

- [ ] **Step 4: commit**

```bash
rtk git add -A
rtk git commit -m "test(housing): #60 動画フレーム抽出テスト残骸を撤去"
```

### Task 1.4: i18n キー削除 (`video_extracting` / `video_extract_failed`)

**Files:**
- Modify: `src/locales/ja/housing.json`
- Modify: `src/locales/en/housing.json`
- Modify: `src/locales/ko/housing.json`
- Modify: `src/locales/zh-CN/housing.json`
- Modify: `src/locales/zh-TW/housing.json`

- [ ] **Step 1: 各言語ファイルで `register.snsUrl.video_extracting` / `register.snsUrl.video_extract_failed` を削除**

Run: `rtk grep "video_extracting\|video_extract_failed" --type json`

該当キー (各言語 2 つずつ、 計 10 行程度) を削除。 親 object `register.snsUrl` の他キーは残す。 JSON 構文 (末尾カンマ等) に注意。

- [ ] **Step 2: build + vitest 確認**

Run: `npm run build && npm test`

Expected: 両方 pass

- [ ] **Step 3: commit**

```bash
rtk git add -A
rtk git commit -m "i18n(housing): #60 動画フレーム抽出関連の翻訳キーを削除 (ja/en/ko/zh-CN/zh-TW)"
```

### Task 1.5: Task Group 1 push + 実機確認

- [ ] **Step 1: 直近 commit を確認**

Run: `rtk git log --oneline -5`

Expected: Task 1.2 / 1.3 / 1.4 の 3 commit + spec commit

- [ ] **Step 2: push (Vercel 自動 deploy)**

Run: `rtk git push`

- [ ] **Step 3: Vercel deploy 完了を待ち (= 1-2 分)、 実機で動画ツイート登録を試す**

- 動画ツイート URL を貼り付け
- **期待**: 「動画から 3 フレーム取得中」 進捗 UI が**出なくなっている**
- **期待**: 登録ボタンは押せるが、 動画ツイートの場合は image が無い状態で登録される (poster 単体表示)。 これは Task Group 2 で `videoUrl` / `videoPosterUrl` を追加して解消する一時的状態

---

## Task Group 2: データモデル + validation 拡張

**目的:** `HousingListing` に動画用 3 フィールドを追加し、 `MAX_SOURCE_IMAGE_URLS` を 4→10、 `tweetId + sourceImageUrls` 同居許可、 動画 URL のホスト allowlist 検証を実装。 登録経路で動画フィールドを Firestore まで通す。

### Task 2.1: HousingListing 型に動画フィールドを追加

**Files:**
- Modify: `src/types/housing.ts`

- [ ] **Step 1: `HousingListing` 型定義箇所を読む**

Run: `rtk read src/types/housing.ts`

L116 前後の `HousingListing` interface を確認

- [ ] **Step 2: 3 フィールド追加**

`HousingListing` interface の sns 関連フィールド (tweetId / youtubeVideoId / sourceImageUrls 等) の隣に以下を追加:

```ts
  /**
   * 2026-05-27: Twitter 動画ツイートの mp4 URL。
   * 元: `https://video.twimg.com/ext_tw_video/.../mp4`。
   * 表示時は `/api/tweet-video?url=<encoded>` で proxy 経由。
   * imageMode==='sns' && tweetId 時に存在。
   */
  videoUrl?: string;
  /**
   * 2026-05-27: Twitter 動画ツイートの poster 画像 URL (`pbs.twimg.com`)。
   * `<video poster>` 属性 + Lightbox 表示前のフォールバック。
   */
  videoPosterUrl?: string;
  /**
   * 2026-05-27: 動画アスペクト比 (width/height、 例 1.78=16:9)。
   * 一覧カードの aspect-ratio 確保に使用。
   */
  videoAspectRatio?: number;
```

- [ ] **Step 3: build 確認**

Run: `npm run build`

Expected: pass (新フィールドはオプショナルなので既存コードに影響なし)

- [ ] **Step 4: commit (このタスクは型追加のみ、 次タスクと一緒に push する想定なので個別 commit OK)**

```bash
rtk git add src/types/housing.ts
rtk git commit -m "types(housing): #60 HousingListing に videoUrl / videoPosterUrl / videoAspectRatio 追加"
```

### Task 2.2: validateImage の排他制約緩和 (TDD)

**Files:**
- Modify: `src/utils/housingValidation.ts`
- Modify: `src/__tests__/housing/housingValidation.test.ts`

- [ ] **Step 1: 失敗テストを追加**

`src/__tests__/housing/housingValidation.test.ts` の `validateImage` describe ブロックに以下を追加:

```ts
describe('validateImage tweetId + sourceImageUrls 同居 (2026-05-27 排他緩和)', () => {
  it('tweetId と sourceImageUrls が両方ある場合は ok (Twitter 静止画ツイート 1-4 枚)', () => {
    const result = validateImage({
      imageMode: 'sns',
      postUrl: 'https://twitter.com/foo/status/123',
      tweetId: '123',
      ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
      sourceImageUrls: [
        'https://pbs.twimg.com/media/A.jpg',
        'https://pbs.twimg.com/media/B.jpg',
        'https://pbs.twimg.com/media/C.jpg',
        'https://pbs.twimg.com/media/D.jpg',
      ],
      tags: [],
    } as any);
    expect(result.ok).toBe(true);
  });

  it('tweetId + sourceImageUrls で pbs.twimg.com 以外のホストは reject', () => {
    const result = validateImage({
      imageMode: 'sns',
      postUrl: 'https://twitter.com/foo/status/123',
      tweetId: '123',
      ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
      sourceImageUrls: ['https://evil.example.com/A.jpg'],
      tags: [],
    } as any);
    expect(result.ok).toBe(false);
    expect(result.errors.sourceImageUrls).toBeDefined();
  });

  it('youtubeVideoId と sourceImageUrls の同居は引き続き reject', () => {
    const result = validateImage({
      imageMode: 'sns',
      postUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      youtubeVideoId: 'abcdefghijk',
      ogImageUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
      sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg'],
      tags: [],
    } as any);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts -t '排他緩和'`

Expected: 1 番目のテストが FAIL (現状 `tweetId + sourceImageUrls` は conflict_sources エラー)

- [ ] **Step 3: 実装更新**

`src/utils/housingValidation.ts` の `validateImage` を修正:

```ts
export function validateImage(draft: RegistrationDraft): ValidationResult {
  if (draft.imageMode !== 'sns') return ok();
  const errors: ValidationErrors = {};
  if (!isHttpsUrl(draft.postUrl)) errors.postUrl = 'invalid';

  const hasTweet = !!draft.tweetId;
  const hasYoutube = !!draft.youtubeVideoId;
  const hasSourceUrls = Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0;

  // 2026-05-27 排他緩和: tweetId + sourceImageUrls の同居許可 (Twitter 静止画 1-4 枚)。
  // youtubeVideoId と sourceImageUrls は引き続き排他 (YouTube は storyboard 都度生成、 静止画 URL を保存しない)。
  if (hasYoutube && (hasTweet || hasSourceUrls)) {
    errors.imageMode = 'conflict_sources';
    return fail(errors);
  }
  if (!hasTweet && !hasYoutube && !hasSourceUrls) {
    errors.imageMode = 'source_required_for_sns';
    return fail(errors);
  }

  if (hasYoutube) {
    if (!isHttpsUrl(draft.ogImageUrl) || !isYoutubeThumbHost(draft.ogImageUrl)) {
      errors.ogImageUrl = 'invalid';
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(draft.youtubeVideoId!)) {
      errors.youtubeVideoId = 'invalid';
    }
  } else if (hasTweet) {
    if (!isHttpsUrl(draft.ogImageUrl) || !isPbsTwimgHost(draft.ogImageUrl)) {
      errors.ogImageUrl = 'invalid';
    }
    if (!/^\d{1,20}$/.test(draft.tweetId!)) errors.tweetId = 'invalid';
    // tweetId + sourceImageUrls 併用時、 全 URL が pbs.twimg.com 限定
    if (hasSourceUrls) {
      const urls = draft.sourceImageUrls!;
      if (urls.length > MAX_SOURCE_IMAGE_URLS) {
        errors.sourceImageUrls = 'too_many';
      } else if (urls.some((u) => typeof u !== 'string' || !isPbsTwimgHost(u))) {
        errors.sourceImageUrls = 'invalid_url';
      } else if (new Set(urls).size !== urls.length) {
        errors.sourceImageUrls = 'duplicate';
      } else if (draft.ogImageUrl !== urls[0]) {
        errors.ogImageUrl = 'must_match_first_source';
      }
    }
  } else {
    // OGP 経路 (= hasSourceUrls only)
    if (!isOgpUrlAllowed(draft.postUrl ?? '')) {
      errors.postUrl = 'not_in_ogp_allowlist';
    }
    const urls = draft.sourceImageUrls!;
    if (urls.length > MAX_SOURCE_IMAGE_URLS) {
      errors.sourceImageUrls = 'too_many';
    } else if (urls.some((u) => typeof u !== 'string' || !isExternalImageUrlSafe(u))) {
      errors.sourceImageUrls = 'invalid_url';
    } else if (new Set(urls).size !== urls.length) {
      errors.sourceImageUrls = 'duplicate';
    } else if (!isHttpsUrl(draft.ogImageUrl) || draft.ogImageUrl !== urls[0]) {
      errors.ogImageUrl = 'must_match_first_source';
    }
  }
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts`

Expected: 全 pass (排他緩和 3 テスト + 既存テスト)

- [ ] **Step 5: build 確認**

Run: `npm run build`

Expected: pass

- [ ] **Step 6: commit はせず Task 2.3 と一緒にまとめる**

### Task 2.3: MAX_SOURCE_IMAGE_URLS を 10 に拡大 + UI 反映

**Files:**
- Modify: `src/utils/housingValidation.ts` (定数のみ)
- Modify: `src/components/housing/register/HousingRegisterSourceImageUrlsField.tsx`
- Modify: `src/components/housing/register/HousingRegisterForm.tsx`
- Modify: `src/lib/housing/useOgpFetch.ts` (コメントのみ)
- Modify: `src/__tests__/housing/housingValidation.test.ts` (上限境界テスト)

- [ ] **Step 1: 上限境界テストを追加**

`housingValidation.test.ts` に追加:

```ts
it('sourceImageUrls 10 枚 (新上限) は ok', () => {
  const urls = Array.from({ length: 10 }, (_, i) => `https://pbs.twimg.com/media/${i}.jpg`);
  const result = validateImage({
    imageMode: 'sns',
    postUrl: 'https://twitter.com/foo/status/123',
    tweetId: '123',
    ogImageUrl: urls[0],
    sourceImageUrls: urls,
    tags: [],
  } as any);
  expect(result.ok).toBe(true);
});

it('sourceImageUrls 11 枚は too_many', () => {
  const urls = Array.from({ length: 11 }, (_, i) => `https://pbs.twimg.com/media/${i}.jpg`);
  const result = validateImage({
    imageMode: 'sns',
    postUrl: 'https://twitter.com/foo/status/123',
    tweetId: '123',
    ogImageUrl: urls[0],
    sourceImageUrls: urls,
    tags: [],
  } as any);
  expect(result.ok).toBe(false);
  expect(result.errors.sourceImageUrls).toBe('too_many');
});
```

- [ ] **Step 2: 失敗確認 (現状は 5 枚で too_many になる)**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts -t '10 枚'`

Expected: 1 番目が FAIL (`MAX_SOURCE_IMAGE_URLS = 4` のため 5 枚以上で fail)

- [ ] **Step 3: 定数を 10 に変更**

`src/utils/housingValidation.ts` の L206:

```ts
/** Firestore に保存する sourceImageUrls の最大件数 (一覧と詳細での性能配慮)。 */
const MAX_SOURCE_IMAGE_URLS = 10;
```

- [ ] **Step 4: UI 側の定数を 10 に変更**

`src/components/housing/register/HousingRegisterSourceImageUrlsField.tsx` の L42:

```ts
const DEFAULT_MAX_IMAGES = 10;
```

- [ ] **Step 5: HousingRegisterForm の slice / maxImages 引数を更新**

`src/components/housing/register/HousingRegisterForm.tsx` の handleSubmit 内 `trimmed = sourceImageUrls.slice(0, 4)` を `slice(0, 10)` に。 `<HousingRegisterSourceImageUrlsField maxImages={4} />` を `maxImages={10}` に。 `localImages.slice(0, 4)` も `slice(0, 10)` に統一 (アップロード経路もユーザー指示で揃える)。

該当箇所 (3 箇所、 計 3 行):

```ts
// L281 付近
const trimmed = sourceImageUrls.slice(0, 10);
```

```tsx
// L375 付近
<HousingRegisterSourceImageUrlsField
  value={sourceImageUrls}
  onChange={setSourceImageUrls}
  maxImages={10}
/>
```

```ts
// L297 付近
const localImagesToSubmit = localImages.slice(0, 10);
```

- [ ] **Step 6: useOgpFetch のコメント更新**

`src/lib/housing/useOgpFetch.ts` L18-19 のコメントを 4 → 10 に:

```ts
     * 全画像 URL (og:image + サイト別追加抽出)。 最大 12 件。
     * housingsnap.com / studio-xiv.com なら 1 物件 1-12 枚、 他のサイトは og:image の 1 枚のみ。
     * 登録時に先頭 10 件に絞る (HousingRegisterForm 側、 2026-05-27 4→10 に拡大)。
```

- [ ] **Step 7: vitest 全実行**

Run: `npm test`

Expected: 全 pass。 既存の「最大 4 件」 系のテストが壊れていれば、 期待値を 10 に修正

- [ ] **Step 8: build 確認**

Run: `npm run build`

Expected: pass

- [ ] **Step 9: commit (Task 2.2 と 2.3 をまとめる)**

```bash
rtk git add -A
rtk git commit -m "$(cat <<'EOF'
feat(housing): #60 sourceImageUrls 上限 4→10、 tweetId+sourceImageUrls 排他緩和

外部 URL 直接表示の延長で、 ハウジング画像枚数上限を 10 枚に拡大 (Firestore
doc 1MB から見て十二分、 LoPo 帯域消費もゼロ)。 Twitter 静止画ツイートも
sourceImageUrls 経路で複数枚保存できるよう排他制約を緩和、 同経路では各 URL を
pbs.twimg.com 限定でホスト allowlist 適用。 youtubeVideoId は引き続き
storyboard 都度生成のため sourceImageUrls とは排他。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.4: HousingRegisterFormValues に動画フィールド追加 + register form で draft に詰める

**Files:**
- Modify: `src/components/housing/register/HousingRegisterForm.tsx`
- Modify: `src/utils/housingValidation.ts` (RegistrationDraft 型に追加)
- Modify: `api/housing/_registerListingHandler.ts`

- [ ] **Step 1: `HousingRegisterFormValues` に追加 (L33-67)**

`src/components/housing/register/HousingRegisterForm.tsx` の型定義に以下を追加:

```ts
    /**
     * 2026-05-27: Twitter 動画ツイートの mp4 URL (元 video.twimg.com)。
     * 表示時に /api/tweet-video?url= proxy 経由で <video> 再生。
     */
    videoUrl?: string;
    /** 2026-05-27: Twitter 動画の poster URL (pbs.twimg.com)。 */
    videoPosterUrl?: string;
    /** 2026-05-27: 動画 aspect ratio (width/height)。 */
    videoAspectRatio?: number;
```

- [ ] **Step 2: handleSubmit で動画ツイートを判別して詰める**

`handleSubmit` の `if (!hasLocalImages) { ... if (tweetSource && photo) { ... } }` ブロックを以下に置き換え:

```ts
if (!hasLocalImages) {
  if (youtubeData) {
    snsImage = {
      postUrl: youtubeData.postUrl,
      ogImageUrl: youtubeData.ogImageUrl,
      youtubeVideoId: youtubeData.videoId,
    };
  } else if (tweetSource && tweetData) {
    // Twitter 経路: 静止画ツイート / 動画ツイート / テキストツイートの 3 分岐
    const photos = tweetData.photos ?? [];
    const video = tweetData.video;
    if (photos.length > 0) {
      // 静止画ツイート: photos 全部を sourceImageUrls に (Twitter は最大 4 枚)
      const trimmed = photos.slice(0, 10);
      snsImage = {
        postUrl: tweetSource.postUrl,
        ogImageUrl: trimmed[0],
        tweetId: tweetSource.tweetId,
        sourceImageUrls: trimmed,
      };
    } else if (video?.url) {
      // 動画ツイート: videoUrl / videoPosterUrl / videoAspectRatio
      snsImage = {
        postUrl: tweetSource.postUrl,
        ogImageUrl: video.posterUrl,
        tweetId: tweetSource.tweetId,
        videoUrl: video.url,
        videoPosterUrl: video.posterUrl,
        videoAspectRatio: video.aspectRatio ?? undefined,
      };
    }
    // テキストツイート (photos も video も無し): ogImageUrl 無し、 登録時に validation 側で
    // imageMode='none' フォールバックされる
  } else if (ogpResult && sourceImageUrls.length > 0) {
    const trimmed = sourceImageUrls.slice(0, 10);
    snsImage = {
      postUrl: ogpResult.postUrl,
      ogImageUrl: trimmed[0],
      sourceImageUrls: trimmed,
    };
  } else if (ogpResult && ogpResult.data.image) {
    snsImage = {
      postUrl: ogpResult.postUrl,
      ogImageUrl: ogpResult.data.image,
    };
  }
}
```

(`photo` 変数は不要になるので、 L262 の `const photo = ...` も削除)

- [ ] **Step 3: `RegistrationDraft` 型に動画フィールド追加**

`src/utils/housingValidation.ts` の `RegistrationDraft` interface (L47-64) に追加:

```ts
  /** 2026-05-27 追加: Twitter 動画ツイートの mp4 URL。 tweetId 必須。 */
  videoUrl?: string;
  /** 2026-05-27 追加: Twitter 動画の poster URL (pbs.twimg.com)。 */
  videoPosterUrl?: string;
  /** 2026-05-27 追加: 動画 aspect ratio。 */
  videoAspectRatio?: number;
```

- [ ] **Step 4: validateImage で videoUrl の host 検証を追加**

`validateImage` の `else if (hasTweet)` ブロック (Task 2.2 で追加した箇所) に動画フィールドの検証を追加:

```ts
  } else if (hasTweet) {
    // ... (既存の ogImageUrl / tweetId 検証)
    // 動画フィールドの検証
    if (draft.videoUrl !== undefined) {
      try {
        const u = new URL(draft.videoUrl);
        if (u.protocol !== 'https:' || u.hostname !== 'video.twimg.com') {
          errors.videoUrl = 'invalid_host';
        }
      } catch {
        errors.videoUrl = 'invalid_url';
      }
    }
    if (draft.videoPosterUrl !== undefined && !isPbsTwimgHost(draft.videoPosterUrl)) {
      errors.videoPosterUrl = 'invalid_host';
    }
    if (
      draft.videoAspectRatio !== undefined &&
      (typeof draft.videoAspectRatio !== 'number' ||
        !Number.isFinite(draft.videoAspectRatio) ||
        draft.videoAspectRatio <= 0)
    ) {
      errors.videoAspectRatio = 'invalid';
    }
    // ... (既存の hasSourceUrls 検証はその後)
  }
```

(注: `videoUrl` と `sourceImageUrls` は同居しないので、 動画ツイートでは sourceImageUrls 検証ブロックを通らない。 これは `if (hasSourceUrls)` の条件で自然に分岐される)

- [ ] **Step 5: validation 用テスト追加**

```ts
describe('validateImage 動画 URL 検証 (2026-05-27)', () => {
  it('videoUrl + videoPosterUrl + videoAspectRatio が正常な場合 ok', () => {
    const result = validateImage({
      imageMode: 'sns',
      postUrl: 'https://twitter.com/foo/status/123',
      tweetId: '123',
      ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
      videoUrl: 'https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/1280x720/xxx.mp4',
      videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
      videoAspectRatio: 1.78,
      tags: [],
    } as any);
    expect(result.ok).toBe(true);
  });

  it('videoUrl の host が video.twimg.com 以外なら reject', () => {
    const result = validateImage({
      imageMode: 'sns',
      postUrl: 'https://twitter.com/foo/status/123',
      tweetId: '123',
      ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
      videoUrl: 'https://evil.example.com/video.mp4',
      videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
      tags: [],
    } as any);
    expect(result.ok).toBe(false);
    expect(result.errors.videoUrl).toBe('invalid_host');
  });

  it('videoAspectRatio が負数の場合 reject', () => {
    const result = validateImage({
      imageMode: 'sns',
      postUrl: 'https://twitter.com/foo/status/123',
      tweetId: '123',
      ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
      videoUrl: 'https://video.twimg.com/x.mp4',
      videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
      videoAspectRatio: -1,
      tags: [],
    } as any);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 6: vitest 確認**

Run: `npm test`

Expected: 全 pass

- [ ] **Step 7: register handler で動画フィールドの保存対応**

`api/housing/_registerListingHandler.ts` を読んで、 `draft` から listing doc を構築する箇所を確認:

Run: `rtk read api/housing/_registerListingHandler.ts`

`buildListingImageFields` を使っているはずなので、 次に `buildListingImageFields` を拡張する (Task 2.5)。 ここでは handler 側は触らず Task 2.5 で済ます。

- [ ] **Step 8: build + commit はせず Task 2.5 とまとめる**

### Task 2.5: buildListingImageFields に動画フィールドの保存ロジック追加

**Files:**
- Modify: `src/utils/housingValidation.ts`
- Modify: `src/__tests__/housing/housingValidation.test.ts`

- [ ] **Step 1: `buildListingImageFields` の戻り型を拡張**

L287-323 を以下に置き換え:

```ts
export function buildListingImageFields(
  draft: RegistrationDraft,
  now: number,
):
  | {
      imageMode: 'sns';
      postUrl: string;
      ogImageUrl: string;
      tweetId: string;
      lastTweetCheckAt: number;
      sourceImageUrls?: string[];
      videoUrl?: string;
      videoPosterUrl?: string;
      videoAspectRatio?: number;
    }
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; youtubeVideoId: string }
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; sourceImageUrls: string[] }
  | { imageMode: 'none' } {
  if (draft.imageMode === 'sns' && draft.postUrl && draft.ogImageUrl) {
    if (draft.tweetId) {
      // Twitter 経路: 静止画 (sourceImageUrls) と 動画 (videoUrl 系) は排他
      const base = {
        imageMode: 'sns' as const,
        postUrl: draft.postUrl,
        ogImageUrl: draft.ogImageUrl,
        tweetId: draft.tweetId,
        lastTweetCheckAt: now,
      };
      if (draft.videoUrl) {
        return {
          ...base,
          videoUrl: draft.videoUrl,
          ...(draft.videoPosterUrl ? { videoPosterUrl: draft.videoPosterUrl } : {}),
          ...(draft.videoAspectRatio !== undefined
            ? { videoAspectRatio: draft.videoAspectRatio }
            : {}),
        };
      }
      if (Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0) {
        return {
          ...base,
          sourceImageUrls: draft.sourceImageUrls.slice(0, MAX_SOURCE_IMAGE_URLS),
        };
      }
      return base;
    }
    if (draft.youtubeVideoId) {
      return {
        imageMode: 'sns',
        postUrl: draft.postUrl,
        ogImageUrl: draft.ogImageUrl,
        youtubeVideoId: draft.youtubeVideoId,
      };
    }
    if (Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0) {
      return {
        imageMode: 'sns',
        postUrl: draft.postUrl,
        ogImageUrl: draft.ogImageUrl,
        sourceImageUrls: draft.sourceImageUrls.slice(0, MAX_SOURCE_IMAGE_URLS),
      };
    }
  }
  return { imageMode: 'none' };
}
```

- [ ] **Step 2: テスト追加**

```ts
describe('buildListingImageFields 動画ツイート (2026-05-27)', () => {
  it('Twitter 動画ツイートは videoUrl / videoPosterUrl / videoAspectRatio + tweetId を返す', () => {
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoAspectRatio: 1.78,
        tags: [],
      } as any,
      1700000000000,
    );
    expect(result).toMatchObject({
      imageMode: 'sns',
      tweetId: '123',
      videoUrl: 'https://video.twimg.com/x.mp4',
      videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
      videoAspectRatio: 1.78,
    });
    expect('sourceImageUrls' in result).toBe(false);
  });

  it('Twitter 静止画ツイートは tweetId + sourceImageUrls を返す (videoUrl 系なし)', () => {
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/B.jpg',
        ],
        tags: [],
      } as any,
      1700000000000,
    );
    expect(result).toMatchObject({
      imageMode: 'sns',
      tweetId: '123',
      sourceImageUrls: [
        'https://pbs.twimg.com/media/A.jpg',
        'https://pbs.twimg.com/media/B.jpg',
      ],
    });
    expect('videoUrl' in result).toBe(false);
  });
});
```

- [ ] **Step 3: vitest 確認**

Run: `npm test`

Expected: 全 pass

- [ ] **Step 4: register handler が新フィールドを Firestore に書き込むか確認**

`api/housing/_registerListingHandler.ts` で `buildListingImageFields` の戻り値を spread して listing doc を作っているはず。 `videoUrl` / `videoPosterUrl` / `videoAspectRatio` も自動で含まれる (新フィールドが optional)。 念のため目視確認。

- [ ] **Step 5: build + commit**

```bash
npm run build
rtk git add -A
rtk git commit -m "$(cat <<'EOF'
feat(housing): #60 動画ツイート登録経路 — videoUrl 系を Firestore に保存

HousingRegisterFormValues / RegistrationDraft / buildListingImageFields に
videoUrl / videoPosterUrl / videoAspectRatio を追加。 Twitter 動画ツイートは
tweetId + 動画 3 フィールドで保存、 静止画ツイートは tweetId + sourceImageUrls
(複数枚) で保存、 両者は排他。 validateImage で video.twimg.com / pbs.twimg.com
ホスト allowlist を検証。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.6: Task Group 2 push + 実機検証

- [ ] **Step 1: push**

Run: `rtk git push`

- [ ] **Step 2: Vercel deploy を待つ (1-2 分)**

- [ ] **Step 3: 実機で動画ツイートを登録**

- 動画ツイートの URL を貼り、 登録 → Firestore Console で listing doc を開く
- **期待**: `videoUrl` / `videoPosterUrl` / `videoAspectRatio` / `tweetId` の 4 フィールドが保存されている
- **期待**: `sourceImageUrls` は無い (動画ツイートのため)

- [ ] **Step 4: 静止画ツイート (4 枚画像) を登録**

- **期待**: `tweetId` + `sourceImageUrls` (4 枚) が保存されている、 `videoUrl` 系は無い

- [ ] **Step 5: housingsnap のリスティングを登録**

- **期待**: 5 枚以上の sourceImageUrls が保存できる (上限 10)

---

## Task Group 3: 純関数 + hook 移植 (Allmarks 流)

**目的:** 視野内 hero 動画 1 本と ambient 静止画 slideshow を駆動する基盤 hook 群を `src/lib/housing/` に追加する。 純関数 + テストから書き、 hook はそれを React で wrap する形。 Allmarks のテストをほぼコピーし、 ファイル名とパスを LoPo 規約に揃える (kebab → camel)。

### Task 3.1: spotlightRotation 純関数 + テスト (Allmarks コピー)

**Files:**
- Create: `src/lib/housing/spotlightRotation.ts`
- Create: `src/lib/housing/__tests__/spotlightRotation.test.ts`

- [ ] **Step 1: テストを先に作成 (失敗状態)**

`src/lib/housing/__tests__/spotlightRotation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reconcileSpotlight, rotateSpotlight, EMPTY_SPOTLIGHT } from '../spotlightRotation';

const set = (...ids: string[]): ReadonlySet<string> => new Set(ids);

describe('reconcileSpotlight', () => {
  it('fills empty live slots up to cap from the candidate set (most-visible first)', () => {
    const s = reconcileSpotlight(EMPTY_SPOTLIGHT, set('a', 'b', 'c', 'd', 'e'), 3);
    expect(s.live).toEqual(['a', 'b', 'c']);
    expect(s.waiting).toEqual(['d', 'e']);
  });

  it('plays everyone when candidates do not exceed cap', () => {
    const s = reconcileSpotlight(EMPTY_SPOTLIGHT, set('a', 'b'), 3);
    expect(s.live).toEqual(['a', 'b']);
    expect(s.waiting).toEqual([]);
  });

  it('drops a live card that left viewport and promotes the next waiting one', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d'] };
    const s = reconcileSpotlight(prev, set('a', 'c', 'd'), 3);
    expect(s.live).toEqual(['a', 'c', 'd']);
    expect(s.waiting).toEqual([]);
  });

  it('trims live down when cap drops to 0', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d'] };
    const s = reconcileSpotlight(prev, set('a', 'b', 'c', 'd'), 0);
    expect(s.live).toEqual([]);
    expect(new Set(s.waiting)).toEqual(set('a', 'b', 'c', 'd'));
  });

  it('keeps already-live cards live when candidates unchanged', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d', 'e'] };
    const s = reconcileSpotlight(prev, set('a', 'b', 'c', 'd', 'e'), 3);
    expect(s.live).toEqual(['a', 'b', 'c']);
  });
});

describe('rotateSpotlight', () => {
  it('retires the oldest live card and promotes the front of the queue', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d', 'e'] };
    const s = rotateSpotlight(prev, 3);
    expect(s.live).toEqual(['b', 'c', 'd']);
    expect(s.waiting).toEqual(['e', 'a']);
  });

  it('is a no-op when nobody is waiting', () => {
    const prev = { live: ['a', 'b'], waiting: [] };
    expect(rotateSpotlight(prev, 3)).toBe(prev);
  });

  it('is a no-op when cap is 0', () => {
    const prev = { live: [], waiting: ['a', 'b'] };
    expect(rotateSpotlight(prev, 0)).toBe(prev);
  });

  it('promotes the picked waiting index and never the just-retired card', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d', 'e', 'f'] };
    const s = rotateSpotlight(prev, 3, () => 2);
    expect(s.live).toEqual(['b', 'c', 'f']);
    expect(s.waiting).toEqual(['d', 'e', 'a']);
    expect(s.live).not.toContain('a');
  });

  it('clamps an out-of-range pick index safely', () => {
    const prev = { live: ['a', 'b'], waiting: ['c', 'd'] };
    const s = rotateSpotlight(prev, 2, () => 99);
    expect(s.live).toEqual(['b', 'd']);
  });

  it('cycles fairly over many turns', () => {
    let s = reconcileSpotlight(EMPTY_SPOTLIGHT, set('a', 'b', 'c', 'd', 'e'), 3);
    const seen = new Set<string>(s.live);
    for (let i = 0; i < 5; i++) {
      s = rotateSpotlight(s, 3);
      s.live.forEach((id) => seen.add(id));
    }
    expect(seen).toEqual(set('a', 'b', 'c', 'd', 'e'));
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/housing/__tests__/spotlightRotation.test.ts`

Expected: `Cannot find module '../spotlightRotation'`

- [ ] **Step 3: 実装作成**

`src/lib/housing/spotlightRotation.ts`:

```ts
/**
 * Rotating-spotlight playback state (2026-05-27 Allmarks 移植)。
 * 一覧で `cap` 個のカードだけが「再生中」 で、 残りは waiting キュー。 一定時間で
 * 1 枚を waiting にローテーションし、 全カードに順次出番が回る仕組み。 GPU の
 * compositing コストを `cap` 個に固定するための単一レバー。
 *
 * - live    : 再生中の id、 oldest-first (= front は次に retire)
 * - waiting : 候補キュー、 front は次に promote
 *
 * Allmarks 元: c:/Users/masay/Desktop/マイコラージュ/lib/board/spotlight-rotation.ts
 */
export type SpotlightState = {
  readonly live: readonly string[];
  readonly waiting: readonly string[];
};

export const EMPTY_SPOTLIGHT: SpotlightState = { live: [], waiting: [] };

/**
 * candidates の入替時 (= scroll / motion 切替 / 再生不能化) に呼ぶ。 候補から消えた
 * id を落とし、 新規 id は waiting 末尾へ、 cap 超過分は waiting 先頭に戻す、
 * cap 未満なら waiting 先頭から live を埋める。
 */
export function reconcileSpotlight(
  prev: SpotlightState,
  candidates: ReadonlySet<string>,
  cap: number,
): SpotlightState {
  const n = Math.max(0, Math.floor(cap));
  const live = prev.live.filter((id) => candidates.has(id));
  const waiting = prev.waiting.filter((id) => candidates.has(id) && !live.includes(id));
  for (const id of candidates) {
    if (!live.includes(id) && !waiting.includes(id)) waiting.push(id);
  }
  while (live.length > n) waiting.unshift(live.shift() as string);
  while (live.length < n && waiting.length > 0) live.push(waiting.shift() as string);
  return { live, waiting };
}

/**
 * タイマーで定期的に呼ぶ。 最古 live を retire し、 waiting から 1 つ promote する。
 * `pickIndex` で waiting 内の index を選ぶ (default 0 = 先頭、 テスト時に固定値を注入)。
 * hook 側ではランダム関数を注入して順番の予測不能性を持たせる。
 * 退役カードは waiting 末尾に追加 (= 即連続再生を防ぐ)。
 */
export function rotateSpotlight(
  prev: SpotlightState,
  cap: number,
  pickIndex: (waitingLength: number) => number = () => 0,
): SpotlightState {
  const n = Math.max(0, Math.floor(cap));
  if (prev.waiting.length === 0 || prev.live.length < n || n === 0) return prev;
  const live = prev.live.slice();
  const waiting = prev.waiting.slice();
  const retired = live.shift() as string;
  const i = Math.min(waiting.length - 1, Math.max(0, Math.floor(pickIndex(waiting.length))));
  const promoted = waiting.splice(i, 1)[0] as string;
  live.push(promoted);
  waiting.push(retired);
  return { live, waiting };
}
```

- [ ] **Step 4: テスト pass 確認**

Run: `npx vitest run src/lib/housing/__tests__/spotlightRotation.test.ts`

Expected: 全 11 件 pass

- [ ] **Step 5: commit**

```bash
rtk git add src/lib/housing/spotlightRotation.ts src/lib/housing/__tests__/spotlightRotation.test.ts
rtk git commit -m "feat(housing): #60 spotlightRotation 純関数を Allmarks から移植 — cap 個固定再生 + waiting キュー入替"
```

### Task 3.2: useSpotlightRotation hook

**Files:**
- Create: `src/lib/housing/useSpotlightRotation.ts`
- Create: `src/lib/housing/__tests__/useSpotlightRotation.test.tsx`

- [ ] **Step 1: テスト作成**

`src/lib/housing/__tests__/useSpotlightRotation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpotlightRotation } from '../useSpotlightRotation';

describe('useSpotlightRotation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty set when cap is 0', () => {
    const { result } = renderHook(() =>
      useSpotlightRotation(new Set(['a', 'b']), 0, 15000),
    );
    expect(result.current.size).toBe(0);
  });

  it('returns cap-sized live set from candidates', () => {
    const { result } = renderHook(() =>
      useSpotlightRotation(new Set(['a', 'b', 'c']), 1, 15000),
    );
    expect(result.current.size).toBe(1);
    expect(['a', 'b', 'c']).toContain([...result.current][0]);
  });

  it('rotates after intervalMs and a new id appears in live', () => {
    const { result } = renderHook(() =>
      useSpotlightRotation(new Set(['a', 'b', 'c']), 1, 15000),
    );
    const before = new Set(result.current);
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    const after = new Set(result.current);
    // live set が変化している (= ローテーションが起きた)
    const changed = [...before].some((id) => !after.has(id));
    expect(changed).toBe(true);
  });

  it('does not rotate when intervalMs is 0', () => {
    const { result } = renderHook(() =>
      useSpotlightRotation(new Set(['a', 'b']), 1, 0),
    );
    const before = new Set(result.current);
    act(() => {
      vi.advanceTimersByTime(100000);
    });
    expect(new Set(result.current)).toEqual(before);
  });

  it('reconciles immediately when candidates change', () => {
    const { result, rerender } = renderHook(
      ({ cands }) => useSpotlightRotation(cands, 1, 15000),
      { initialProps: { cands: new Set(['a']) } },
    );
    expect([...result.current]).toEqual(['a']);
    rerender({ cands: new Set(['b']) });
    expect([...result.current]).toEqual(['b']);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/housing/__tests__/useSpotlightRotation.test.tsx`

Expected: import error

- [ ] **Step 3: 実装作成**

`src/lib/housing/useSpotlightRotation.ts`:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  reconcileSpotlight,
  rotateSpotlight,
  EMPTY_SPOTLIGHT,
  type SpotlightState,
} from './spotlightRotation';

function sameIds(a: ReadonlySet<string>, b: readonly string[]): boolean {
  if (a.size !== b.length) return false;
  for (const id of b) if (!a.has(id)) return false;
  return true;
}

/**
 * candidates Set のうち、 cap 個だけが再生中。 intervalMs (default 15000=15s) ごとに
 * 1 個入れ替えてランダムに次の候補が再生される。 Allmarks `use-spotlight-rotation.ts` 移植。
 *
 * - candidates が変わった瞬間に reconcile (= scroll で in-view が変わったらすぐ反映)
 * - intervalMs<=0 か cap<=0 で rotation 停止 (= タイマー登録なし)
 */
export function useSpotlightRotation(
  candidates: ReadonlySet<string>,
  cap: number,
  intervalMs = 15000,
): ReadonlySet<string> {
  const stateRef = useRef<SpotlightState>(EMPTY_SPOTLIGHT);
  const [live, setLive] = useState<ReadonlySet<string>>(new Set());

  // 中身が同じなら再 reconcile しないための signature (Set は毎回新しい instance なので)
  const sig = useMemo(
    () => `${cap}#${[...candidates].sort().join('|')}`,
    [candidates, cap],
  );

  useEffect(() => {
    stateRef.current = reconcileSpotlight(stateRef.current, candidates, cap);
    setLive((prev) =>
      sameIds(prev, stateRef.current.live) ? prev : new Set(stateRef.current.live),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (cap <= 0 || intervalMs <= 0) return;
    const t = setInterval(() => {
      const next = rotateSpotlight(stateRef.current, cap, (len) =>
        Math.floor(Math.random() * len),
      );
      if (next === stateRef.current) return;
      stateRef.current = next;
      setLive((prev) => (sameIds(prev, next.live) ? prev : new Set(next.live)));
    }, intervalMs);
    return (): void => clearInterval(t);
  }, [cap, intervalMs]);

  return live;
}
```

- [ ] **Step 4: pass 確認**

Run: `npx vitest run src/lib/housing/__tests__/useSpotlightRotation.test.tsx`

Expected: 全 pass

- [ ] **Step 5: commit**

```bash
rtk git add src/lib/housing/useSpotlightRotation.ts src/lib/housing/__tests__/useSpotlightRotation.test.tsx
rtk git commit -m "feat(housing): #60 useSpotlightRotation hook — 15s ランダム順次入替 (Allmarks 流)"
```

### Task 3.3: viewportPlaybackPool 純関数 + テスト

**Files:**
- Create: `src/lib/housing/viewportPlaybackPool.ts`
- Create: `src/lib/housing/__tests__/viewportPlaybackPool.test.ts`

- [ ] **Step 1: テスト作成**

```ts
import { describe, expect, it } from 'vitest';
import { selectActivePlayers } from '../viewportPlaybackPool';

describe('selectActivePlayers', () => {
  const ratios = new Map<string, number>([
    ['a', 0.9],
    ['b', 0.5],
    ['c', 0.1],
    ['d', 0.7],
  ]);

  it('returns top-N by ratio (highest first)', () => {
    expect(selectActivePlayers(ratios, 2)).toEqual(['a', 'd']);
  });
  it('returns all when N > count', () => {
    expect(new Set(selectActivePlayers(ratios, 99))).toEqual(
      new Set(['a', 'b', 'c', 'd']),
    );
  });
  it('ignores ratio 0', () => {
    const m = new Map([
      ['a', 0],
      ['b', 0.4],
    ]);
    expect(selectActivePlayers(m, 3)).toEqual(['b']);
  });
  it('returns empty for cap 0', () => {
    expect(selectActivePlayers(ratios, 0)).toEqual([]);
  });
  it('breaks ties by id', () => {
    const m = new Map([
      ['y', 0.5],
      ['x', 0.5],
    ]);
    expect(selectActivePlayers(m, 1)).toEqual(['x']);
  });
  it('excludes cards below minRatio', () => {
    const m = new Map([
      ['a', 0.1],
      ['b', 0.4],
      ['c', 0.29],
    ]);
    expect(selectActivePlayers(m, 5, 0.3)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/housing/__tests__/viewportPlaybackPool.test.ts`

Expected: import error

- [ ] **Step 3: 実装作成**

`src/lib/housing/viewportPlaybackPool.ts`:

```ts
/**
 * Tier 1 viewport playback の候補選定 (2026-05-27 Allmarks 移植)。
 * 各カードの visibility ratio (0..1) と cap から、 再生候補 N 件を返す。
 * - ratio 0 は off-screen 扱いで除外
 * - ratio < minRatio (= 画面端のスライバー) も除外、 ユーザーが「動いているもの」 を
 *   見つけられない事態を防ぐ
 * - tie-break は id 昇順で安定化
 *
 * 純関数。 IntersectionObserver からの ratio 集計は `useViewportPlaybackPool` 側。
 */
export function selectActivePlayers(
  ratios: ReadonlyMap<string, number>,
  cap: number,
  minRatio = 0,
): string[] {
  if (cap <= 0) return [];
  return [...ratios.entries()]
    .filter(([, r]) => r > 0 && r >= minRatio)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, cap)
    .map(([id]) => id);
}
```

- [ ] **Step 4: pass 確認**

Run: `npx vitest run src/lib/housing/__tests__/viewportPlaybackPool.test.ts`

Expected: 全 6 件 pass

- [ ] **Step 5: commit**

```bash
rtk git add src/lib/housing/viewportPlaybackPool.ts src/lib/housing/__tests__/viewportPlaybackPool.test.ts
rtk git commit -m "feat(housing): #60 viewportPlaybackPool — visibility ratio で再生候補選定 (Allmarks 流)"
```

### Task 3.4: useViewportPlaybackPool hook

**Files:**
- Create: `src/lib/housing/useViewportPlaybackPool.ts`
- Create: `src/lib/housing/__tests__/useViewportPlaybackPool.test.tsx`

- [ ] **Step 1: テスト作成 (IntersectionObserver mock 使用)**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewportPlaybackPool } from '../useViewportPlaybackPool';

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  static observers: MockIntersectionObserver[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    MockIntersectionObserver.observers.push(this);
  }
  observe(_el: Element): void {}
  unobserve(_el: Element): void {}
  disconnect(): void {}
  trigger(entries: Array<{ target: Element; intersectionRatio: number }>): void {
    this.callback(
      entries.map((e) => ({
        target: e.target,
        intersectionRatio: e.intersectionRatio,
        isIntersecting: e.intersectionRatio > 0,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: 0,
      })),
      this as unknown as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  MockIntersectionObserver.observers = [];
  (global as any).IntersectionObserver = MockIntersectionObserver;
});

describe('useViewportPlaybackPool', () => {
  it('returns empty Map initially', () => {
    const { result } = renderHook(() => useViewportPlaybackPool());
    expect(result.current.visibility.size).toBe(0);
  });

  it('updates visibility when IntersectionObserver fires', () => {
    const { result } = renderHook(() => useViewportPlaybackPool());
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    act(() => {
      result.current.register('a', el1);
      result.current.register('b', el2);
    });
    act(() => {
      MockIntersectionObserver.observers[0]?.trigger([
        { target: el1, intersectionRatio: 0.8 },
        { target: el2, intersectionRatio: 0.3 },
      ]);
    });
    expect(result.current.visibility.get('a')).toBe(0.8);
    expect(result.current.visibility.get('b')).toBe(0.3);
  });

  it('removes id from visibility on unregister', () => {
    const { result } = renderHook(() => useViewportPlaybackPool());
    const el = document.createElement('div');
    act(() => {
      result.current.register('a', el);
    });
    act(() => {
      MockIntersectionObserver.observers[0]?.trigger([
        { target: el, intersectionRatio: 0.5 },
      ]);
    });
    expect(result.current.visibility.get('a')).toBe(0.5);
    act(() => {
      result.current.unregister('a');
    });
    expect(result.current.visibility.has('a')).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/housing/__tests__/useViewportPlaybackPool.test.tsx`

Expected: import error

- [ ] **Step 3: 実装作成**

`src/lib/housing/useViewportPlaybackPool.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 各カード ref の visibility ratio を IntersectionObserver で集計する。
 * register(id, el) / unregister(id) を子コンポーネント (HousingCard) から呼ぶ。
 * 1 個の observer で全カードを監視、 thresholds は 0..1 を 11 段階。
 *
 * 戻り値 visibility は Map<id, ratio> で、 各 entry は IO callback が更新する。
 */
export function useViewportPlaybackPool(): {
  visibility: ReadonlyMap<string, number>;
  register: (id: string, el: Element) => void;
  unregister: (id: string) => void;
} {
  const [visibility, setVisibility] = useState<ReadonlyMap<string, number>>(new Map());
  const elToId = useRef<Map<Element, string>>(new Map());
  const idToEl = useRef<Map<string, Element>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibility((prev) => {
          const next = new Map(prev);
          for (const entry of entries) {
            const id = elToId.current.get(entry.target);
            if (!id) continue;
            next.set(id, entry.intersectionRatio);
          }
          return next;
        });
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    observerRef.current = observer;
    // 既存登録分があれば observe (StrictMode の二重 mount 対策)
    for (const el of idToEl.current.values()) observer.observe(el);
    return (): void => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const register = useCallback((id: string, el: Element) => {
    const prevEl = idToEl.current.get(id);
    if (prevEl === el) return;
    if (prevEl) {
      elToId.current.delete(prevEl);
      observerRef.current?.unobserve(prevEl);
    }
    idToEl.current.set(id, el);
    elToId.current.set(el, id);
    observerRef.current?.observe(el);
  }, []);

  const unregister = useCallback((id: string) => {
    const el = idToEl.current.get(id);
    if (!el) return;
    elToId.current.delete(el);
    idToEl.current.delete(id);
    observerRef.current?.unobserve(el);
    setVisibility((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { visibility, register, unregister };
}
```

- [ ] **Step 4: pass 確認**

Run: `npx vitest run src/lib/housing/__tests__/useViewportPlaybackPool.test.tsx`

Expected: 全 pass

- [ ] **Step 5: commit**

```bash
rtk git add src/lib/housing/useViewportPlaybackPool.ts src/lib/housing/__tests__/useViewportPlaybackPool.test.tsx
rtk git commit -m "feat(housing): #60 useViewportPlaybackPool hook — IntersectionObserver で visibility ratio 集計"
```

### Task 3.5: useIsScrolling hook + slideshowCycle + useSlideshowCycle

**Files:**
- Create: `src/lib/housing/useIsScrolling.ts`
- Create: `src/lib/housing/__tests__/useIsScrolling.test.tsx`
- Create: `src/lib/housing/slideshowCycle.ts`
- Create: `src/lib/housing/useSlideshowCycle.ts`
- Create: `src/lib/housing/__tests__/useSlideshowCycle.test.tsx`

- [ ] **Step 1: useIsScrolling テスト**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsScrolling } from '../useIsScrolling';

describe('useIsScrolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false initially', () => {
    const { result } = renderHook(() => useIsScrolling(150));
    expect(result.current).toBe(false);
  });

  it('returns true on scroll, false after debounce', () => {
    const { result } = renderHook(() => useIsScrolling(150));
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(false);
  });

  it('extends timer when scroll fires again before debounce', () => {
    const { result } = renderHook(() => useIsScrolling(150));
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      vi.advanceTimersByTime(100);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: useIsScrolling 実装**

```ts
import { useEffect, useRef, useState } from 'react';

/**
 * window が直近 `debounceMs` 以内に scroll イベントを発火していれば true。
 * 一覧の hero / ambient slideshow をスクロール中だけ止めるためのフラグ。
 */
export function useIsScrolling(debounceMs = 150): boolean {
  const [scrolling, setScrolling] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (): void => {
      setScrolling(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setScrolling(false);
        timerRef.current = null;
      }, debounceMs);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return (): void => {
      window.removeEventListener('scroll', handler);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [debounceMs]);

  return scrolling;
}
```

- [ ] **Step 3: useIsScrolling pass 確認**

Run: `npx vitest run src/lib/housing/__tests__/useIsScrolling.test.tsx`

Expected: 全 pass

- [ ] **Step 4: slideshowCycle 純関数 + テスト**

`src/lib/housing/slideshowCycle.ts`:

```ts
/**
 * ambient slideshow の次ステップ秒数 (2.6-6 秒間のランダム値、 Allmarks 流)。
 * 純関数化することで vitest で deterministic にテスト可能。
 */
export const SLIDESHOW_MIN_STEP_MS = 2600;
export const SLIDESHOW_MAX_STEP_MS = 6000;

export function pickNextStepMs(rng: () => number = Math.random): number {
  return SLIDESHOW_MIN_STEP_MS + rng() * (SLIDESHOW_MAX_STEP_MS - SLIDESHOW_MIN_STEP_MS);
}
```

`src/lib/housing/__tests__/slideshowCycle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  pickNextStepMs,
  SLIDESHOW_MIN_STEP_MS,
  SLIDESHOW_MAX_STEP_MS,
} from '../slideshowCycle';

describe('pickNextStepMs', () => {
  it('returns MIN when rng() returns 0', () => {
    expect(pickNextStepMs(() => 0)).toBe(SLIDESHOW_MIN_STEP_MS);
  });
  it('returns near MAX when rng() returns close to 1', () => {
    expect(pickNextStepMs(() => 0.999)).toBeCloseTo(SLIDESHOW_MAX_STEP_MS, -1);
  });
  it('falls within [MIN, MAX]', () => {
    for (let i = 0; i < 100; i++) {
      const ms = pickNextStepMs();
      expect(ms).toBeGreaterThanOrEqual(SLIDESHOW_MIN_STEP_MS);
      expect(ms).toBeLessThan(SLIDESHOW_MAX_STEP_MS);
    }
  });
});
```

- [ ] **Step 5: useSlideshowCycle hook + テスト**

`src/lib/housing/useSlideshowCycle.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { pickNextStepMs, SLIDESHOW_MAX_STEP_MS } from './slideshowCycle';

/**
 * frameCount 枚の静止画をクロスフェードで切替えるための表示中 index を返す。
 * 各カード独立に 2.6-6 秒ランダム間隔で進む。 初期 index も初期 delay も
 * ランダムにすることで、 多数カードがあっても画面全体が同期せず波打つように desync する。
 * frameCount<2 のときは常に 0 (= 静止)。 Allmarks `use-slideshow-cycle.ts` 移植。
 */
export function useSlideshowCycle(frameCount: number, enabled = true): number {
  const [index, setIndex] = useState(() =>
    frameCount > 1 ? Math.floor(Math.random() * frameCount) : 0,
  );
  const countRef = useRef(frameCount);
  countRef.current = frameCount;

  useEffect(() => {
    if (!enabled || frameCount < 2) {
      setIndex(0);
      return;
    }
    let timer: number;
    const tick = (): void => {
      setIndex((i) => (i + 1) % countRef.current);
      timer = window.setTimeout(tick, pickNextStepMs());
    };
    timer = window.setTimeout(tick, Math.random() * SLIDESHOW_MAX_STEP_MS);
    return (): void => window.clearTimeout(timer);
  }, [frameCount, enabled]);

  return frameCount < 2 ? 0 : index;
}
```

`src/lib/housing/__tests__/useSlideshowCycle.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlideshowCycle } from '../useSlideshowCycle';

describe('useSlideshowCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 when frameCount < 2', () => {
    const { result } = renderHook(() => useSlideshowCycle(1));
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(0);
  });

  it('advances index over time when frameCount >= 2', () => {
    const { result } = renderHook(() => useSlideshowCycle(3));
    const initial = result.current;
    act(() => {
      vi.advanceTimersByTime(7000); // > MAX_STEP_MS なので初期 delay + 1 tick は必ず通る
    });
    expect(result.current).not.toBe(initial);
  });

  it('stops when disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useSlideshowCycle(3, enabled),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(0);
  });
});
```

- [ ] **Step 6: テスト + build 確認**

Run: `npm test && npm run build`

Expected: 全 pass

- [ ] **Step 7: commit**

```bash
rtk git add src/lib/housing/useIsScrolling.ts src/lib/housing/slideshowCycle.ts src/lib/housing/useSlideshowCycle.ts src/lib/housing/__tests__/useIsScrolling.test.tsx src/lib/housing/__tests__/slideshowCycle.test.ts src/lib/housing/__tests__/useSlideshowCycle.test.tsx
rtk git commit -m "feat(housing): #60 useIsScrolling + slideshowCycle + useSlideshowCycle hook 群"
```

### Task 3.6: slideshowFrames 純関数 (LoPo 専用ロジック)

**Files:**
- Create: `src/lib/housing/slideshowFrames.ts`
- Create: `src/lib/housing/__tests__/slideshowFrames.test.ts`

- [ ] **Step 1: テスト作成**

```ts
import { describe, it, expect } from 'vitest';
import { resolveSlideshowFrames } from '../slideshowFrames';
import type { HousingListing } from '../../../types/housing';

const baseListing = (): HousingListing =>
  ({ id: 'x', imageMode: 'sns' } as HousingListing);

describe('resolveSlideshowFrames', () => {
  it('returns sourceImageUrls when available (OGP / Twitter 静止画)', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      sourceImageUrls: [
        'https://pbs.twimg.com/media/A.jpg',
        'https://pbs.twimg.com/media/B.jpg',
      ],
    } as HousingListing);
    expect(frames.map((f) => f.src)).toEqual([
      'https://pbs.twimg.com/media/A.jpg',
      'https://pbs.twimg.com/media/B.jpg',
    ]);
  });

  it('returns YouTube storyboard 3 frames (poster + hq1 + hq2 with fallbacks)', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      youtubeVideoId: 'abcdefghijk',
    } as HousingListing);
    expect(frames).toEqual([
      { src: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' },
      {
        src: 'https://i.ytimg.com/vi/abcdefghijk/hq1.jpg',
        fallback: 'https://i.ytimg.com/vi/abcdefghijk/1.jpg',
      },
      {
        src: 'https://i.ytimg.com/vi/abcdefghijk/hq2.jpg',
        fallback: 'https://i.ytimg.com/vi/abcdefghijk/2.jpg',
      },
    ]);
  });

  it('returns videoPosterUrl 1 frame for Twitter 動画 only ツイート', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      videoPosterUrl: 'https://pbs.twimg.com/media/POSTER.jpg',
    } as HousingListing);
    expect(frames).toEqual([{ src: 'https://pbs.twimg.com/media/POSTER.jpg' }]);
  });

  it('returns thumbnailPaths for legacy data', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      imageMode: 'thumbnail',
      thumbnailPaths: ['/thumb1.webp', '/thumb2.webp'],
    } as HousingListing);
    expect(frames).toEqual([
      { src: '/thumb1.webp' },
      { src: '/thumb2.webp' },
    ]);
  });

  it('returns ogImageUrl 1 frame as final fallback', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      ogImageUrl: 'https://example.com/og.png',
    } as HousingListing);
    expect(frames).toEqual([{ src: 'https://example.com/og.png' }]);
  });

  it('returns empty array when nothing matches', () => {
    expect(resolveSlideshowFrames(baseListing())).toEqual([]);
  });

  it('prioritizes sourceImageUrls over youtubeVideoId', () => {
    const frames = resolveSlideshowFrames({
      ...baseListing(),
      sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg'],
      youtubeVideoId: 'abcdefghijk',
    } as HousingListing);
    expect(frames).toEqual([{ src: 'https://pbs.twimg.com/media/A.jpg' }]);
  });
});
```

- [ ] **Step 2: 実装**

```ts
import type { HousingListing } from '../../types/housing';

export type SlideshowFrame = {
  readonly src: string;
  readonly fallback?: string;
};

/**
 * カード ambient slideshow に使う静止画フレーム配列を listing から構築する。
 * 優先順位:
 *   1. sourceImageUrls (OGP / Twitter 静止画ツイート、 複数枚)
 *   2. youtubeVideoId (storyboard hqdefault + hq1 + hq2 の 3 枚、 fallback `1.jpg` / `2.jpg`)
 *   3. videoPosterUrl (Twitter 動画 only ツイート、 1 枚)
 *   4. thumbnailPaths (旧データ、 Storage 保存済)
 *   5. thumbnailPath (= 1 枚旧データ)
 *   6. ogImageUrl (テキストツイート等の最終 fallback、 1 枚)
 *   7. なし (= 空配列、 カードは "No image" 状態)
 */
export function resolveSlideshowFrames(
  listing: HousingListing,
): readonly SlideshowFrame[] {
  if (Array.isArray(listing.sourceImageUrls) && listing.sourceImageUrls.length > 0) {
    return listing.sourceImageUrls.map((src) => ({ src }));
  }
  if (listing.youtubeVideoId) {
    const base = `https://i.ytimg.com/vi/${listing.youtubeVideoId}`;
    return [
      { src: `${base}/hqdefault.jpg` },
      { src: `${base}/hq1.jpg`, fallback: `${base}/1.jpg` },
      { src: `${base}/hq2.jpg`, fallback: `${base}/2.jpg` },
    ];
  }
  if (listing.videoPosterUrl) {
    return [{ src: listing.videoPosterUrl }];
  }
  if (Array.isArray(listing.thumbnailPaths) && listing.thumbnailPaths.length > 0) {
    return listing.thumbnailPaths.map((src) => ({ src }));
  }
  if (listing.thumbnailPath) {
    return [{ src: listing.thumbnailPath }];
  }
  if (listing.ogImageUrl) {
    return [{ src: listing.ogImageUrl }];
  }
  return [];
}
```

- [ ] **Step 3: vitest + build**

Run: `npm test && npm run build`

Expected: 全 pass

- [ ] **Step 4: commit + push (Task Group 3 終了)**

```bash
rtk git add src/lib/housing/slideshowFrames.ts src/lib/housing/__tests__/slideshowFrames.test.ts
rtk git commit -m "feat(housing): #60 resolveSlideshowFrames — listing から ambient slideshow フレームを構築"
rtk git push
```

---

## Task Group 4: ambient slideshow + 動画オーバーレイ実装

**目的:** 一覧のカードに ambient slideshow レイヤーと動画オーバーレイレイヤーを組み込み、 workspace ルートで hook をオーケストレーションして cap=1 動画 hero を実現する。 既存 `HousingCard` 系の見た目を壊さず、 「z-index 上に重ねる」 形で安全に拡張する。

### Task 4.1: HousingCardAmbientSlideshow コンポーネント

**Files:**
- Create: `src/components/housing/workspace/HousingCardAmbientSlideshow.tsx`
- Create: `src/__tests__/housing/HousingCardAmbientSlideshow.test.tsx`
- Modify: `src/styles/housing.css` (token + class 追加)

- [ ] **Step 1: housing.css に token 追加 (`.housing-workspace` ブロック内)**

`src/styles/housing.css` の `.housing-workspace` token ブロックに追加:

```css
/* 2026-05-27 ambient slideshow / 動画オーバーレイ */
--housing-slideshow-fade-ms: 600ms;
--housing-slideshow-img-fit: cover;
```

同じファイルの末尾付近 (component スタイル領域) に class を追加:

```css
.housing-card-ambient-slideshow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.housing-card-ambient-slideshow img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: var(--housing-slideshow-img-fit);
  opacity: 0;
  transition: opacity var(--housing-slideshow-fade-ms) ease-in-out;
}

.housing-card-ambient-slideshow img[data-active='true'] {
  opacity: 1;
}
```

- [ ] **Step 2: テスト作成**

`src/__tests__/housing/HousingCardAmbientSlideshow.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HousingCardAmbientSlideshow } from '../../components/housing/workspace/HousingCardAmbientSlideshow';

describe('HousingCardAmbientSlideshow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when frames is empty', () => {
    const { container } = render(
      <HousingCardAmbientSlideshow frames={[]} enabled />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('renders one img per frame', () => {
    render(
      <HousingCardAmbientSlideshow
        frames={[{ src: '/a.jpg' }, { src: '/b.jpg' }, { src: '/c.jpg' }]}
        enabled
      />,
    );
    expect(screen.getAllByRole('presentation')).toHaveLength(3);
  });

  it('applies onError fallback when provided', async () => {
    const { container } = render(
      <HousingCardAmbientSlideshow
        frames={[{ src: '/a.jpg', fallback: '/a-fallback.jpg' }]}
        enabled
      />,
    );
    const img = container.querySelector('img');
    expect(img?.src).toContain('/a.jpg');
    // onError 発火を simulate
    img?.dispatchEvent(new Event('error'));
    expect(img?.src).toContain('/a-fallback.jpg');
  });
});
```

- [ ] **Step 3: 実装作成**

`src/components/housing/workspace/HousingCardAmbientSlideshow.tsx`:

```tsx
import { useCallback, useRef } from 'react';
import { useSlideshowCycle } from '../../../lib/housing/useSlideshowCycle';
import type { SlideshowFrame } from '../../../lib/housing/slideshowFrames';

export interface HousingCardAmbientSlideshowProps {
  /** 表示する静止画フレーム (resolveSlideshowFrames の戻り値)。 */
  frames: readonly SlideshowFrame[];
  /** false なら静止 (= スクロール中 / reduced-motion / lightbox open)。 */
  enabled: boolean;
}

/**
 * カードの上に重ねる静止画クロスフェードレイヤー。 各カード独立にランダム間隔で
 * 次のフレームへ。 1 枚しか無いカードは静止、 0 枚なら何も描画しない。
 * pointer-events: none で背後のカード操作 (クリック → Lightbox) を妨げない。
 */
export function HousingCardAmbientSlideshow({
  frames,
  enabled,
}: HousingCardAmbientSlideshowProps): JSX.Element | null {
  const index = useSlideshowCycle(frames.length, enabled);
  const swappedRef = useRef<Set<number>>(new Set());

  const handleError = useCallback(
    (i: number) =>
      (e: React.SyntheticEvent<HTMLImageElement>): void => {
        const fallback = frames[i]?.fallback;
        if (!fallback) return;
        if (swappedRef.current.has(i)) return;
        swappedRef.current.add(i);
        e.currentTarget.src = fallback;
      },
    [frames],
  );

  if (frames.length === 0) return null;

  return (
    <div className="housing-card-ambient-slideshow" aria-hidden="true">
      {frames.map((f, i) => (
        <img
          key={`${i}-${f.src}`}
          src={f.src}
          alt=""
          role="presentation"
          loading="lazy"
          data-active={i === index}
          onError={handleError(i)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: vitest 確認**

Run: `npx vitest run src/__tests__/housing/HousingCardAmbientSlideshow.test.tsx`

Expected: 全 pass

- [ ] **Step 5: build + commit**

```bash
npm run build
rtk git add -A
rtk git commit -m "feat(housing): #60 HousingCardAmbientSlideshow — 各カード独立 desync クロスフェード"
```

### Task 4.2: HousingCardVideoOverlay コンポーネント

**Files:**
- Create: `src/components/housing/workspace/HousingCardVideoOverlay.tsx`
- Create: `src/__tests__/housing/HousingCardVideoOverlay.test.tsx`
- Modify: `src/styles/housing.css`

- [ ] **Step 1: housing.css にスタイル追加**

末尾の component 領域に:

```css
.housing-card-video-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  overflow: hidden;
  border-radius: inherit;
}

.housing-card-video-overlay > video,
.housing-card-video-overlay > iframe {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: none;
  display: block;
}
```

- [ ] **Step 2: テスト作成**

`src/__tests__/housing/HousingCardVideoOverlay.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HousingCardVideoOverlay } from '../../components/housing/workspace/HousingCardVideoOverlay';

describe('HousingCardVideoOverlay', () => {
  it('renders <video> with proxy src for Twitter listing', () => {
    const { container } = render(
      <HousingCardVideoOverlay
        kind="twitter"
        videoUrl="https://video.twimg.com/x.mp4"
        posterUrl="https://pbs.twimg.com/poster.jpg"
      />,
    );
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toContain(
      '/api/tweet-video?url=' + encodeURIComponent('https://video.twimg.com/x.mp4'),
    );
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
  });

  it('renders <iframe> with youtube-nocookie src for YouTube listing', () => {
    const { container } = render(
      <HousingCardVideoOverlay kind="youtube" youtubeVideoId="abcdefghijk" />,
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toContain(
      'https://www.youtube-nocookie.com/embed/abcdefghijk',
    );
    expect(iframe?.getAttribute('src')).toContain('autoplay=1');
    expect(iframe?.getAttribute('src')).toContain('mute=1');
    expect(iframe?.getAttribute('src')).toContain('controls=0');
  });
});
```

- [ ] **Step 3: 実装**

`src/components/housing/workspace/HousingCardVideoOverlay.tsx`:

```tsx
export type HousingCardVideoOverlayProps =
  | {
      kind: 'twitter';
      videoUrl: string;
      posterUrl?: string;
    }
  | {
      kind: 'youtube';
      youtubeVideoId: string;
    };

/**
 * カードに重ねる動画オーバーレイ。 spotlight rotation の live メンバーのみ mount。
 * Twitter は `<video>` + proxy (Referer gate 回避)、 YouTube は youtube-nocookie iframe。
 * 一律 muted autoplay loop、 controls なし (= ambient)、 pointer-events: none で
 * 背後の onClick (= Lightbox 起動) を spare。
 */
export function HousingCardVideoOverlay(
  props: HousingCardVideoOverlayProps,
): JSX.Element {
  if (props.kind === 'twitter') {
    const proxied = `/api/tweet-video?url=${encodeURIComponent(props.videoUrl)}`;
    return (
      <div className="housing-card-video-overlay" aria-hidden="true">
        <video
          src={proxied}
          poster={props.posterUrl}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
        />
      </div>
    );
  }
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    loop: '1',
    playlist: props.youtubeVideoId,
    controls: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  });
  const src = `https://www.youtube-nocookie.com/embed/${props.youtubeVideoId}?${params.toString()}`;
  return (
    <div className="housing-card-video-overlay" aria-hidden="true">
      <iframe
        src={src}
        title=""
        allow="autoplay; encrypted-media"
        tabIndex={-1}
      />
    </div>
  );
}
```

- [ ] **Step 4: vitest 確認**

Run: `npx vitest run src/__tests__/housing/HousingCardVideoOverlay.test.tsx`

Expected: 全 pass

- [ ] **Step 5: commit**

```bash
rtk git add -A
rtk git commit -m "feat(housing): #60 HousingCardVideoOverlay — Twitter <video> + YouTube iframe ambient 再生"
```

### Task 4.3: HousingCard で ambient slideshow + 動画オーバーレイを組込み

**Files:**
- Modify: `src/components/housing/workspace/HousingCard.tsx`

- [ ] **Step 1: 現状を読む**

Run: `rtk read src/components/housing/workspace/HousingCard.tsx`

カード root 要素 (= IntersectionObserver の observe 対象) と既存サムネ表示箇所を把握。 たぶん `<div className="housing-card">` 直下に `<img>` がある。

- [ ] **Step 2: props 拡張 + ref 受け取り**

`HousingCard.tsx` の props 型に以下を追加 (既存 props は保持):

```ts
export interface HousingCardProps {
  // ... 既存 props
  /** spotlight rotation の live メンバーなら true (動画オーバーレイ表示)。 */
  isPlaying?: boolean;
  /** ambient slideshow を動かすか (= scroll/reduced/lightbox で false)。 */
  ambientOn?: boolean;
  /** viewport playback pool への登録用 callback。 */
  onRegister?: (id: string, el: Element) => void;
  onUnregister?: (id: string) => void;
}
```

- [ ] **Step 3: root 要素を IntersectionObserver 監視 + 2 オーバーレイ追加**

```tsx
import { useEffect, useRef } from 'react';
import { HousingCardAmbientSlideshow } from './HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from './HousingCardVideoOverlay';
import { resolveSlideshowFrames } from '../../../lib/housing/slideshowFrames';

// 関数本体内:
const rootRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  const el = rootRef.current;
  if (!el || !onRegister) return;
  onRegister(listing.id, el);
  return (): void => onUnregister?.(listing.id);
}, [listing.id, onRegister, onUnregister]);

const frames = useMemo(() => resolveSlideshowFrames(listing), [listing]);
const videoKind = listing.videoUrl
  ? 'twitter'
  : listing.youtubeVideoId
    ? 'youtube'
    : null;

// JSX root 要素 (既存 className を維持):
return (
  <div ref={rootRef} className="housing-card" /* ...既存 props */>
    {/* 既存サムネ画像 (= 静止表示用、 z-index: 0 想定) */}
    <img src={...} alt="" className="housing-card-thumb" />

    {/* ambient slideshow オーバーレイ (z-index: 1) */}
    <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn ?? false} />

    {/* 動画オーバーレイ (z-index: 2、 live メンバーのみ) */}
    {isPlaying && videoKind === 'twitter' && listing.videoUrl && (
      <HousingCardVideoOverlay
        kind="twitter"
        videoUrl={listing.videoUrl}
        posterUrl={listing.videoPosterUrl}
      />
    )}
    {isPlaying && videoKind === 'youtube' && listing.youtubeVideoId && (
      <HousingCardVideoOverlay
        kind="youtube"
        youtubeVideoId={listing.youtubeVideoId}
      />
    )}

    {/* 既存のテキスト要素 (= タグ・アドレス・タイトル等、 z-index: 3 で重畳の上に) */}
    {/* ... */}
  </div>
);
```

注: `housing-card` クラスは既に `position: relative` 想定。 z-index 順は ambient(1) → video(2) → text(3+) で重ねる。 既存テキスト UI は CSS で z-index を上げる必要がある:

`src/styles/housing.css` の `.housing-card` 関連:

```css
.housing-card {
  position: relative;
  /* ... 既存 */
}
.housing-card > :not(.housing-card-ambient-slideshow):not(.housing-card-video-overlay):not(.housing-card-thumb) {
  position: relative;
  z-index: 3;
}
```

(より明示的にしたければ、 既存テキストブロックに `.housing-card-content` class を導入してそちらに `z-index: 3` を当てる方が安全)

- [ ] **Step 4: build + vitest**

Run: `npm run build && npm test`

Expected: 全 pass。 既存 HousingCard テストで「サムネ画像が出る」 系は残るはず、 ambient/動画は条件次第なので falsy パスで通る。

- [ ] **Step 5: commit**

```bash
rtk git add -A
rtk git commit -m "feat(housing): #60 HousingCard に ambient slideshow + 動画オーバーレイ統合"
```

### Task 4.4: 他のカード variant (RightPanelListItem / MapBubbleCard / FavoriteCard) にも同じ統合

**Files:**
- Modify: `src/components/housing/workspace/RightPanelListItem.tsx`
- Modify: `src/components/housing/workspace/MapBubbleCard.tsx`
- Modify: `src/components/housing/workspace/FavoriteCard.tsx`

- [ ] **Step 1: 各ファイル現状読み込み**

Run: `rtk read src/components/housing/workspace/RightPanelListItem.tsx`
Run: `rtk read src/components/housing/workspace/MapBubbleCard.tsx`
Run: `rtk read src/components/housing/workspace/FavoriteCard.tsx`

- [ ] **Step 2: 各ファイルに Task 4.3 と同じ props 拡張 + 2 オーバーレイ追加**

(Task 4.3 のコード片を、 各ファイルの root 要素にあてはめる。 root 要素の className が違うだけで、 オーバーレイ自体は同じ。 重複コードだが LoPo 既存パターンに従う = 各 variant 独立)

- [ ] **Step 3: build + vitest**

Run: `npm run build && npm test`

Expected: 全 pass

- [ ] **Step 4: commit**

```bash
rtk git add -A
rtk git commit -m "feat(housing): #60 RightPanelListItem / MapBubbleCard / FavoriteCard にも overlay 統合"
```

### Task 4.5: HousingWorkspace で hook オーケストレーション

**Files:**
- Modify: 一覧表示のルート (`src/components/housing/workspace/HousingWorkspace.tsx` 等、 実ファイル名は読み込みで確認)

- [ ] **Step 1: workspace ルートを特定**

Run: `rtk grep "HousingCard" --type tsx -l`

`HousingCard` を子に持つ親コンポーネント (たぶん `HousingWorkspace` か `CardsGrid`) を特定。

- [ ] **Step 2: hook 群を import + 統合**

該当親で:

```tsx
import { useViewportPlaybackPool } from '../../../lib/housing/useViewportPlaybackPool';
import { useSpotlightRotation } from '../../../lib/housing/useSpotlightRotation';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import { useIsScrolling } from '../../../lib/housing/useIsScrolling';
import { selectActivePlayers } from '../../../lib/housing/viewportPlaybackPool';

// 関数本体内:
const { visibility, register, unregister } = useViewportPlaybackPool();
const reduced = useReducedMotion();
const isScrolling = useIsScrolling(150);
const lightboxOpen = /* 既存 detail modal の open 状態を取得、 Task 5 で詳述 */;
const ambientOn = !reduced && !isScrolling && !lightboxOpen;
const candidates = useMemo(() => {
  const ids = selectActivePlayers(visibility, /* cap */ 1, /* minRatio */ 0.25);
  return new Set(ids);
}, [visibility]);
const spotlightCap = ambientOn ? 1 : 0;
const playing = useSpotlightRotation(candidates, spotlightCap, 15000);
```

各 HousingCard 描画時に prop 渡し:

```tsx
{listings.map((listing) => (
  <HousingCard
    key={listing.id}
    listing={listing}
    isPlaying={playing.has(listing.id)}
    ambientOn={ambientOn}
    onRegister={register}
    onUnregister={unregister}
  />
))}
```

(`lightboxOpen` の取得方法は Task Group 5 で確定するため、 ここでは `false` 固定で進めて OK。 Task 5.3 で接続)

- [ ] **Step 3: build + vitest**

Run: `npm run build && npm test`

Expected: 全 pass

- [ ] **Step 4: commit + push (Task Group 4 終了)**

```bash
rtk git add -A
rtk git commit -m "feat(housing): #60 HousingWorkspace で cap=1 spotlight rotation オーケストレーション"
rtk git push
```

### Task 4.6: Task Group 4 実機検証

- [ ] **Step 1: Vercel deploy を待つ**

- [ ] **Step 2: 一覧で動画ツイートが入った物件を表示**

- **期待**: 画面に動画リスティング 1 件だけ動画再生、 他はサムネのみ
- **期待**: 動画リスティングが 2 件以上画面内にあっても、 同時再生は 1 本のみ
- **期待**: 15 秒経つと別の動画リスティングに切り替わる
- **期待**: スクロール開始すると動画が止まる、 停止して 150ms 後に再開
- **期待**: 静止画 4 枚ツイートで各カードが 2.6-6 秒間隔でクロスフェード (各カード desync)
- **期待**: YouTube リスティングは hqdefault / hq1 / hq2 の 3 枚クロスフェード

---

## Task Group 5: 詳細モーダル動画再生 + 全画像表示

**目的:** 詳細モーダルで動画を controls あり再生 + 画像ギャラリーを全枚数表示する。 lightboxOpen フラグを workspace に伝えて一覧の spotlight rotation を止める。

### Task 5.1: HousingPhotoGallery を動画再生対応に拡張

**Files:**
- Modify: `src/components/housing/listing/HousingPhotoGallery.tsx`
- Modify: `src/__tests__/housing/HousingPhotoGallery.test.tsx` (存在すれば、 なければ新規)
- Modify: `src/styles/housing.css`

- [ ] **Step 1: 動画あり判定 + 動画再生領域を追加**

`HousingPhotoGallery.tsx` の return JSX で、 既存 `<img className="housing-gallery-main">` の上 (前) に動画ブロックを差し込み:

```tsx
const hasVideo = listing.videoUrl || listing.youtubeVideoId;

return (
  <div className="housing-gallery">
    {hasVideo && (
      <div className="housing-gallery-video">
        {listing.videoUrl ? (
          <video
            src={`/api/tweet-video?url=${encodeURIComponent(listing.videoUrl)}`}
            poster={listing.videoPosterUrl}
            controls
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
          />
        ) : listing.youtubeVideoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${listing.youtubeVideoId}?autoplay=1&mute=1&playsinline=1&rel=0`}
            title={t('housing.gallery.video_iframe_title', { defaultValue: 'Video' })}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        ) : null}
      </div>
    )}
    {/* 既存 <img className="housing-gallery-main"> + サムネ列はそのまま */}
    {visibleSources.length > 0 && (
      <img src={mainSrc} ... />
    )}
    ...
  </div>
);
```

- [ ] **Step 2: housing.css に video 領域スタイル追加**

```css
.housing-gallery-video {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9; /* 動画 default、 listing.videoAspectRatio で上書きしたければ inline style で */
  background: var(--housing-bg-deep, #000);
  overflow: hidden;
  border-radius: var(--housing-radius-card, 12px);
}
.housing-gallery-video > video,
.housing-gallery-video > iframe {
  width: 100%;
  height: 100%;
  display: block;
  border: none;
}
```

(`videoAspectRatio` 反映は将来課題、 今回は 16:9 固定で進める。 listing 側で詳しい aspect が取れているので、 後で `style={{ aspectRatio: listing.videoAspectRatio }}` で差し替え可)

- [ ] **Step 3: 画像枚数の上限解除確認**

`HousingPhotoGallery.tsx` の `visibleSources` ロジック (現状 L82-85) は `sources` を `failedSources` でフィルタするだけで、 枚数上限はない。 ✓ 上限は backend `MAX_SOURCE_IMAGE_URLS = 10` で制御済 (= ここは何もしない)。

- [ ] **Step 4: i18n キー追加**

`src/locales/{ja,en,ko,zh-CN,zh-TW}/housing.json` に:

```json
"gallery": {
  ...,
  "video_iframe_title": "<各言語の翻訳>"
}
```

ja: `"video_iframe_title": "物件動画"`
en: `"video_iframe_title": "Listing video"`
ko: `"video_iframe_title": "주택 동영상"`
zh-CN: `"video_iframe_title": "房屋视频"`
zh-TW: `"video_iframe_title": "房屋影片"`

- [ ] **Step 5: build + vitest**

Run: `npm run build && npm test`

Expected: 全 pass

- [ ] **Step 6: commit**

```bash
rtk git add -A
rtk git commit -m "feat(housing): #60 HousingPhotoGallery — 詳細モーダルで動画 controls 再生 + 全画像表示"
```

### Task 5.2: HousingDetailModalRoute で lightboxOpen state を導入

**Files:**
- Modify: `src/components/housing/listing/HousingDetailModalRoute.tsx`
- 検討: workspace 側で参照する手段 (context / store / event)

- [ ] **Step 1: 現状を読む**

Run: `rtk read src/components/housing/listing/HousingDetailModalRoute.tsx`

modal の open 判定は URL (= route param) か、 親 state か確認。 おそらく URL に `listingId` がある場合は open とみなせる。

- [ ] **Step 2: lightboxOpen 取得経路を決める**

選択肢:
- (A) Zustand store に `housingLightboxOpen: boolean` 追加。 modal mount/unmount で set。 workspace から参照
- (B) React context (`LightboxOpenContext`) で provider を上位、 modal が setter、 workspace が consumer
- (C) URL から推論 (= `useLocation` で `/housing/{id}` パスマッチ)

LoPo は既に Zustand を使っているので **(A) が一貫している**。 既存 `useHousingListingsStore` (memory `feedback_housing_admin_complete` で言及) に近い場所に追加するか、 新規 store を切る。

- [ ] **Step 3: 既存 store を確認**

Run: `rtk grep "useHousingListingsStore\|create.*housing" --type ts`

該当 store が `src/stores/` or `src/lib/housing/` にあるか確認。

- [ ] **Step 4: lightboxOpen state を store に追加**

既存 store が見つかった場合は、 そのファイルに以下追加:

```ts
interface State {
  // ... 既存
  lightboxOpen: boolean;
  setLightboxOpen: (open: boolean) => void;
}

// create() 内:
lightboxOpen: false,
setLightboxOpen: (open) => set({ lightboxOpen: open }),
```

(既存 store が無ければ `src/lib/housing/useHousingUiStore.ts` を新規作成して、 そこに lightboxOpen を置く)

- [ ] **Step 5: HousingDetailModalRoute で mount/unmount 時に set**

```tsx
import { useEffect } from 'react';
import { useHousingListingsStore } from '...'; // 実パスは Step 3 の結果

export function HousingDetailModalRoute(...) {
  const setLightboxOpen = useHousingListingsStore((s) => s.setLightboxOpen);
  useEffect(() => {
    setLightboxOpen(true);
    return (): void => setLightboxOpen(false);
  }, [setLightboxOpen]);
  // ... 既存実装
}
```

- [ ] **Step 6: workspace 側で consume**

Task 4.5 で TODO にした `lightboxOpen` を実値に差し替え:

```tsx
const lightboxOpen = useHousingListingsStore((s) => s.lightboxOpen);
const ambientOn = !reduced && !isScrolling && !lightboxOpen;
```

- [ ] **Step 7: vitest 確認 (store のテストが既存にあれば lightboxOpen 追加分のみテスト)**

Run: `npm test`

Expected: 全 pass

- [ ] **Step 8: commit**

```bash
rtk git add -A
rtk git commit -m "feat(housing): #60 lightboxOpen フラグで詳細モーダル開閉時に一覧 spotlight を制御"
```

### Task 5.3: Task Group 5 push + 実機検証

- [ ] **Step 1: push**

Run: `rtk git push`

- [ ] **Step 2: 実機検証**

- 動画ツイート物件の詳細モーダルを開く
- **期待**: モーダルにビデオが controls 付きで表示、 mute されてるがクリックで unmute 可
- **期待**: モーダル開いた瞬間、 一覧の動画 hero が停止
- **期待**: モーダル閉じると一覧の動画 hero が再開
- 静止画 4 枚ツイート物件の詳細
- **期待**: 動画ブロックなし、 ギャラリーに 4 枚画像が表示 + サムネ列で切替可
- housingsnap 8 枚物件の詳細
- **期待**: ギャラリーに 8 枚画像が表示 (上限 10 の余裕内)

---

## Task Group 6: CSP + 最終 E2E

**目的:** Vercel CSP を更新し、 全 E2E シナリオを実機で通す。

### Task 6.1: vercel.json の CSP 更新

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: 現状の CSP を読む**

Run: `rtk read vercel.json`

`headers` の中で `Content-Security-Policy` を含む header を探す。

- [ ] **Step 2: media-src / frame-src 追加**

該当 CSP 文字列に以下を追加 (順序は他のディレクティブとアルファベット順 or 既存規則に合わせる):

```
media-src 'self' blob:;
frame-src https://www.youtube-nocookie.com;
```

(既に `media-src` / `frame-src` が定義済なら、 値を upsert)

- [ ] **Step 3: 既存 img-src を確認**

`img-src` に `https://i.ytimg.com` / `https://pbs.twimg.com` / `https://img.youtube.com` 等が含まれていることを再確認 (hotfix28 で追加済のはず)。 不足があれば追加。

- [ ] **Step 4: build + Vercel deploy preview で挙動確認**

Run: `npm run build`
Push せず、 ローカル `vercel dev` で CSP メタタグが正しく出るか確認 (省略可、 実機で代用)。

- [ ] **Step 5: commit + push**

```bash
rtk git add vercel.json
rtk git commit -m "fix(housing): #60 CSP — media-src / frame-src 追加 (Twitter video + YouTube iframe)"
rtk git push
```

### Task 6.2: 最終 E2E 実機検証 (7 シナリオ)

- [ ] **Step 1: Vercel deploy 完了を待つ**

- [ ] **Step 2: シナリオ実行 (各 ✓/✗ を記録)**

1. **一覧で動画 1 本だけ再生**: 動画リスティング 2-3 件が画面内にあるとき、 同時に動くのは 1 本だけ → ✓
2. **15 秒で別カードに移動**: 15 秒経つと別の動画リスティングが live になる → ✓
3. **スクロール中停止**: スクロール開始で動画が止まる、 停止後 150ms で再開 → ✓
4. **詳細モーダル連動**: モーダル開で一覧の動画停止、 閉じで再開 → ✓
5. **詳細モーダル動画 controls**: モーダル内で動画 unmute / シーク / フルスクリーン可 → ✓
6. **画像 5 枚以上のリスティングで全部見える**: housingsnap 6+ 枚物件の詳細で全表示 → ✓
7. **`prefers-reduced-motion: reduce`**: OS 設定で reduce にすると動画 / ambient slideshow 共に静止 → ✓

- [ ] **Step 3: 問題があれば該当 Task に戻って修正 → 再 push → 再検証**

- [ ] **Step 4: 全 ✓ なら TODO.md 更新**

`docs/TODO.md` の「現在の状態」 セクションで動画系移行完了を反映、 「次セッション最優先」 を次のタスクへ更新。

- [ ] **Step 5: 完了 commit**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs(housing): #60 動画再生 + 外部 URL 直接表示拡張 完了 — TODO.md 更新"
rtk git push
```

---

## Notes for executing agent

- **Vitest 実行は `npm test` (= `vitest run`) のみ使う**。 `vitest watch` や stdout パイプは厳禁 (memory `reference_vitest_appcheck_teardown` / `reference_vitest_vmthreads_hang`)
- **Firebase mock 不要**: hooks は client-only、 Firebase は触らない。 既存テストの mock パターンを参考に
- **vmThreads pool 厳守**: vitest.config.ts は触らない (memory `reference_vitest_pool_firebase`)
- **既存 i18n キー削除時は 5 言語全部** (ja/en/ko/zh-CN/zh-TW)
- **push をまとめる**: Hobby プラン月 100 ビルド制限 (memory `feedback_vercel_builds`)。 Task Group 1/2/3/4/5/6 の末尾でまとめて push、 グループ内では commit のみ
- **1 件ずつ実機検証**: 各 Task Group の末尾で実機を 1 度確認 → 問題なければ次 Task Group へ (memory `feedback_one_fix_one_verify`)
- **build エラー時は --amend せず別 commit**: hook 失敗時に commit が完了していなかった可能性に注意 (system prompt の git 安全プロトコル)
- **housing 配下の独自トンマナルール**: `housing.css` の token 経由でハードコード禁止 (memory `feedback_housing_design_independent` / `.claude/rules/housing-design.md`)
