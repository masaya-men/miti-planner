# ハウジング詳細ギャラリー「大メイン写真＋縦サムネイル列（スクロールフェード）」実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 物件詳細のギャラリーを「左＝大きなメイン写真（絶対に切り抜かない）／右＝縦スクロールのサムネイル列（バー無し・端でフェード）」に作り直し、複数の写真・動画すべてに到達でき、写真が一切見切れないようにする。

**Architecture:** 変更は実質2ファイルのみ。(1) `HousingPhotoGallery.tsx` を「メインステージ＋縦サムネイル列」の横並び構造に全面書き換え（全メディア＝動画＋画像を1本の配列に統合し、`activeIndex` で選択、サムネクリックでメインが入れ替わるだけ／拡大なし）。(2) `housing.css` のギャラリー系 CSS を差し替え（メインは `object-fit:contain` で単独の箱に置き＝旧グリッドはみ出しクリップを解消、縦サムネ列は `overflow-y:auto`＋スクロールバー非表示＋上下フェード pseudo-element を scroll 位置でトグル）。`HousingDetailContent.tsx` は変更不要（既存の `.housing-detail-gallery > HousingPhotoGallery` をそのまま使う）。

**Tech Stack:** React 18 + TypeScript + vitest + @testing-library/react（happy-dom）+ i18next。ハウジング独自トンマナ（`src/styles/housing.css` の `--housing-*` トークン）。

## Global Constraints

- **メディア絶対保護（最重要）**: メイン写真・動画は**必ず全体表示**（`object-fit: contain`。四角の角も SE 著作権表記も、上下左右すべて見える）。**いかなる場合も見切れ／切り抜きを発生させない**。
- **パネル無スクロール**: 詳細パネル全体は縦スクロールしない（既存の md+ レイアウトを維持）。スクロールするのは**縦サムネイル列の内部のみ**。
- **サムネ列**: スクロールバーは出さない（`scrollbar-width:none` ＋ `::-webkit-scrollbar{display:none}`）。スクロール可能な端に**強めのフェード**をかけ、その端までスクロールしきったら**フェードがスムーズに消える**（`opacity` transition）。
- **操作**: サムネクリック → 左メインが入れ替わるだけ。**拡大/ライトボックスは作らない**。
- **トンマナ（ハウジング独自）**: 白黒のみ等の LoPo ルールは適用外。色/影/角丸は `--housing-*` トークン経由（hex/rgba リテラル禁止。構造的な px＝gap/幅/高さ/border-width は可）。アクティブなサムネの枠は **青＝選択**（`--housing-aether`）を使う（2アクセント体系）。
- **i18n**: 文字列は i18n キー経由。新規文言は増やさない（既存 `housing.gallery.*` キーを流用）。
- **push 前ゲート**: `npm run build`（Vercel は tsc -b 厳密・未使用 import で落ちる）＋ `npx vitest run`。
- **vitest 安全実行**: `npx vitest run <path>`。出力をパイプしない。`vmThreads` 設定は触らない。
- **コミット末尾（verbatim）**: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 作業ディレクトリ: `c:\Users\masay\Desktop\FF14Sim`。

---

## File Structure

- **Modify（全面書き換え）**: `src/components/housing/listing/HousingPhotoGallery.tsx`
  - 責務: listing のメディア（動画＋画像）を1本の配列に統合し、メインステージ（選択中を全体表示）＋縦サムネイル列（全項目・スクロールフェード）を描画。サムネクリックで `activeIndex` を更新するだけ。
  - **唯一の利用元は `HousingDetailContent.tsx`**（他に import 無し・確認済み）。外部インターフェース `{ listing: HousingListing }` は不変。
- **Create（テスト）**: `src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx`
  - 責務: 複数画像が全部サムネ化されること／サムネクリックでメインが入れ替わること／1枚時はサムネ列を出さないこと／画像なしで空表示になること。
- **Modify（CSS）**: `src/styles/housing.css`
  - ギャラリー系セレクタ（`.housing-gallery` 〜 `.housing-gallery-thumb img`）を差し替え、`.housing-detail-gallery` の高さ指定を調整、新トークン1つを追加。
- **変更しない**: `HousingDetailContent.tsx`（JSX 不変）。`HousingDetailMap`/`HousingDetailPage`/情報レール/地図の CSS（今回のスコープ外）。

---

### Task 1: `HousingPhotoGallery` を「メインステージ＋縦サムネイル列」へ全面書き換え

**Files:**
- Modify（全面上書き）: `src/components/housing/listing/HousingPhotoGallery.tsx`
- Create（テスト）: `src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx`

**Interfaces:**
- Consumes: `HousingListing`（`src/types/housing.ts`。使うフィールド: `imageMode`, `thumbnailPaths`, `thumbnailPath`, `sourceImageUrls`, `ogImageUrl`, `videoUrl`, `youtubeVideoId`, `videoPosterUrl`, `videoAspectRatio`）。`handleYoutubeThumbnailError`/`handleYoutubeThumbnailLoad`（`src/lib/housing/youtubeImgFallback`）。`buildTweetVideoProxyUrl`（`src/lib/housing/tweetVideoProxy`）。
- Produces: `HousingPhotoGallery: React.FC<{ listing: HousingListing }>`。DOM 契約（テスト＆CSS が依存）: ルート `.housing-gallery`／メイン画像 `img.housing-gallery-main`／メイン動画 `.housing-gallery-video`／サムネ列ラッパ `.housing-detail-thumbrail-wrap`（`data-at-top`/`data-at-bottom` 属性つき）／スクロールする `ul.housing-detail-thumbrail`／各サムネ `button.housing-detail-thumb[role="tab"]`（`data-active` つき）。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx` を新規作成し、以下を**そのまま**書く:

```tsx
// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { HousingPhotoGallery } from '../HousingPhotoGallery';
import type { HousingListing } from '../../../../types/housing';

// i18n はキー/デフォルト値をそのまま返す薄いモック
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
  }),
}));

function makeListing(over: Partial<HousingListing> = {}): HousingListing {
  return {
    id: 'l1',
    imageMode: 'sns',
    sourceImageUrls: [
      'https://x/a.jpg',
      'https://x/b.jpg',
      'https://x/c.jpg',
    ],
    ...over,
  } as unknown as HousingListing;
}

it('複数画像: すべてサムネイルに並び、 サムネクリックでメイン画像が入れ替わる', () => {
  const { container } = render(<HousingPhotoGallery listing={makeListing()} />);
  const mainSrc = () =>
    (container.querySelector('.housing-gallery-main') as HTMLImageElement | null)?.getAttribute('src');
  expect(mainSrc()).toContain('a.jpg');
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(3);
  fireEvent.click(tabs[1]);
  expect(mainSrc()).toContain('b.jpg');
});

it('画像1枚: サムネイル列は出さない (rail なし)', () => {
  const { container } = render(
    <HousingPhotoGallery listing={makeListing({ sourceImageUrls: ['https://x/only.jpg'] })} />,
  );
  expect(
    (container.querySelector('.housing-gallery-main') as HTMLImageElement | null)?.getAttribute('src'),
  ).toContain('only.jpg');
  expect(container.querySelector('.housing-detail-thumbrail')).toBeNull();
});

it('画像なし: 空プレースホルダを出す', () => {
  const { container } = render(
    <HousingPhotoGallery listing={makeListing({ imageMode: 'none', sourceImageUrls: [] })} />,
  );
  expect(container.querySelector('.housing-gallery-empty')).not.toBeNull();
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx`
Expected: FAIL（現行 `HousingPhotoGallery` にはメインが横並び/縦サムネ列が無く、`.housing-detail-thumbrail` セレクタや click で src が入れ替わる挙動が無いため、複数画像テストと 1枚テストの少なくとも一部が赤）。

- [ ] **Step 3: `HousingPhotoGallery.tsx` を以下で全面上書き**

`src/components/housing/listing/HousingPhotoGallery.tsx` の**中身をすべて消して**、以下を**そのまま**書く:

```tsx
/**
 * 物件詳細のメディアギャラリー（2026-07-09 再設計: 大メイン＋縦サムネイル列）
 *
 * - 動画＋画像を 1 本の配列 (mediaItems) に統合。 activeIndex がメインステージに映る項目。
 * - 左: メインステージ（選択中を object-fit:contain で「絶対に切り抜かず」全体表示）。
 * - 右: 縦サムネイル列（全項目）。 内部だけ縦スクロールし、 スクロールバーは出さず、
 *   端に強めのフェード（scroll 位置で data-at-top/at-bottom をトグル → CSS で opacity）。
 * - サムネクリック → activeIndex 更新でメインが入れ替わるだけ（拡大/ライトボックスは無し）。
 * - 404 で読めない外部 URL は onError で markFailed → 表示から除外（元投稿削除の自然消失）。
 */
import { useState, useMemo, useCallback, useEffect, useRef, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';
import {
  handleYoutubeThumbnailError,
  handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { buildTweetVideoProxyUrl } from '../../../lib/housing/tweetVideoProxy';

export interface HousingPhotoGalleryProps {
  listing: HousingListing;
}

/**
 * listing から画像 URL の配列を取り出す（挙動は従来と同一）。
 * - imageMode==='thumbnail': thumbnailPaths を優先、 なければ thumbnailPath を 1 件
 * - imageMode==='sns': sourceImageUrls があれば配列、 なければ ogImageUrl 1 件
 * - その他: []
 */
function resolveSources(listing: HousingListing): string[] {
  if (listing.imageMode === 'thumbnail') {
    if (Array.isArray(listing.thumbnailPaths) && listing.thumbnailPaths.length > 0) {
      return listing.thumbnailPaths.filter((s) => typeof s === 'string' && s !== '');
    }
    if (listing.thumbnailPath) return [listing.thumbnailPath];
    return [];
  }
  if (listing.imageMode === 'sns') {
    if (Array.isArray(listing.sourceImageUrls) && listing.sourceImageUrls.length > 0) {
      return listing.sourceImageUrls.filter((s) => typeof s === 'string' && s !== '');
    }
    if (listing.ogImageUrl) return [listing.ogImageUrl];
    return [];
  }
  return [];
}

type MediaItem = { kind: 'video' } | { kind: 'image'; src: string };

export const HousingPhotoGallery: React.FC<HousingPhotoGalleryProps> = ({ listing }) => {
  const { t } = useTranslation();
  const sources = useMemo(() => resolveSources(listing), [listing]);
  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());

  const markFailed = useCallback((src: string) => {
    setFailedSources((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  // onError: まず YouTube サムネ段階 fallback、 それでも src が変わらなければ表示不可として除外。
  const handleImgError = useCallback(
    (originalSrc: string) => (e: SyntheticEvent<HTMLImageElement>) => {
      const before = e.currentTarget.src;
      handleYoutubeThumbnailError(e);
      if (e.currentTarget.src === before) markFailed(originalSrc);
    },
    [markFailed],
  );

  const visibleSources = useMemo(
    () => sources.filter((s) => !failedSources.has(s)),
    [sources, failedSources],
  );

  const hasVideo = !!(listing.videoUrl || listing.youtubeVideoId);
  const videoAspectStyle = listing.videoAspectRatio
    ? { aspectRatio: String(listing.videoAspectRatio) }
    : undefined;
  const videoThumb = listing.videoPosterUrl || listing.ogImageUrl || null;

  // 全メディアを 1 本に統合（動画があれば先頭）。
  const mediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = [];
    if (hasVideo) items.push({ kind: 'video' });
    for (const src of visibleSources) items.push({ kind: 'image', src });
    return items;
  }, [hasVideo, visibleSources]);

  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(0, mediaItems.length - 1));

  // 縦サムネ列のスクロールフェード: 端に達したらその端のフェードを消す。
  const railRef = useRef<HTMLUListElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const updateFade = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtTop(el.scrollTop <= 1);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);
  // マウント時・項目数変化時に初期フェード状態を確定（溢れていれば下フェードON）。
  useEffect(() => {
    updateFade();
  }, [mediaItems, updateFade]);

  if (mediaItems.length === 0) {
    return (
      <div className="housing-gallery-empty" aria-hidden="true">
        <span>{t('housing.gallery.no_image', { defaultValue: 'No image' })}</span>
      </div>
    );
  }

  const active = mediaItems[safeIndex];
  const showRail = mediaItems.length > 1;

  return (
    <div className="housing-gallery" data-has-rail={showRail}>
      <div className="housing-gallery-stage">
        {active.kind === 'video' ? (
          <div className="housing-gallery-video" style={videoAspectStyle}>
            {listing.videoUrl ? (
              <video
                src={buildTweetVideoProxyUrl(listing.videoUrl)}
                poster={listing.videoPosterUrl}
                controls
                muted
                autoPlay
                loop
                playsInline
                preload="metadata"
                aria-label={t('housing.gallery.video_iframe_title', {
                  defaultValue: 'Listing video',
                })}
              />
            ) : listing.youtubeVideoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${listing.youtubeVideoId}?autoplay=1&mute=1&playsinline=1&rel=0`}
                title={t('housing.gallery.video_iframe_title', {
                  defaultValue: 'Listing video',
                })}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            ) : null}
          </div>
        ) : (
          <img
            src={active.src}
            alt=""
            loading="lazy"
            className="housing-gallery-main"
            onError={handleImgError(active.src)}
            onLoad={handleYoutubeThumbnailLoad}
          />
        )}
      </div>

      {showRail && (
        <div
          className="housing-detail-thumbrail-wrap"
          data-at-top={atTop}
          data-at-bottom={atBottom}
        >
          <ul
            className="housing-detail-thumbrail"
            role="tablist"
            ref={railRef}
            onScroll={updateFade}
          >
            {mediaItems.map((item, i) => (
              <li key={item.kind === 'video' ? 'video' : `${i}-${item.src}`} role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  data-active={i === safeIndex}
                  className="housing-detail-thumb"
                  onClick={() => setActiveIndex(i)}
                  aria-label={t('housing.gallery.thumb_aria', {
                    index: i + 1,
                    total: mediaItems.length,
                    defaultValue: `Image ${i + 1} of ${mediaItems.length}`,
                  })}
                >
                  {item.kind === 'video' ? (
                    <>
                      {videoThumb ? (
                        <img src={videoThumb} alt="" loading="lazy" />
                      ) : (
                        <span className="housing-detail-thumb-videobg" aria-hidden="true" />
                      )}
                      <span className="housing-detail-thumb-play" aria-hidden="true">
                        ▶
                      </span>
                    </>
                  ) : (
                    <img
                      src={item.src}
                      alt=""
                      loading="lazy"
                      onError={handleImgError(item.src)}
                      onLoad={handleYoutubeThumbnailLoad}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx`
Expected: PASS（3件緑）。

- [ ] **Step 5: 型チェック（この時点で build は CSS 無しでも通る）**

Run: `npm run build`
Expected: 成功（型エラー0。未使用 import が無いこと）。もし `useEffect`/`useRef` 等の未使用警告が出たら、上のコードに全て使用箇所があるので誤記を疑う。

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/listing/HousingPhotoGallery.tsx src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx
git commit -m "feat(housing): 詳細ギャラリーを大メイン+縦サムネ列(統合メディア)へ書き換え

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: ギャラリー CSS（メインステージ＋縦サムネ列＋スクロールフェード）

**Files:**
- Modify: `src/styles/housing.css`

**Interfaces:**
- Consumes: Task 1 の DOM 契約（`.housing-gallery`, `.housing-gallery-stage`, `.housing-gallery-main`, `.housing-gallery-video`, `.housing-detail-thumbrail-wrap[data-at-top/at-bottom]`, `.housing-detail-thumbrail`, `.housing-detail-thumb[data-active]`, `.housing-detail-thumb-videobg`, `.housing-detail-thumb-play`）。
- Produces: メインは常に全体表示（`object-fit:contain`・単独の箱で見切れ無し）。縦サムネ列はバー無し＋端フェード。
- 使用する既存トークン（実在確認済み）: `--housing-card-thumb-bg`, `--housing-panel-bg`, `--housing-panel-bg-solid`, `--housing-overlay-strong`, `--housing-aether`, `--housing-candle`, `--housing-text`, `--housing-text-mute`, `--housing-text-sm`, `--housing-text-base`, `--housing-detail-empty-h`。

- [ ] **Step 1: 新トークンを追加**

`src/styles/housing.css` の以下の既存行（Task 2.4 で追加済みの詳細トークン群）を探す:

```css
  --housing-detail-map-h-mobile: 320px;   /* 単一カラム時のマップ高 (モバイル) */
```

その**直後**に1行追加する:

```css
  --housing-detail-thumbrail-w: 84px;     /* 縦サムネイル列の幅 (メインの右) */
```

- [ ] **Step 2: ギャラリー本体 CSS を差し替え**

`src/styles/housing.css` の**次のブロック全体**（`.housing-gallery {` から `.housing-gallery-thumb img { ... }` の閉じ `}` まで＝旧グリッド＋横並びサムネ一式）を探す:

```css
.housing-gallery {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 10px;
    place-items: center;
    background: var(--housing-card-thumb-bg);
    border-radius: 12px;
    padding: 8px;
}
.housing-gallery-main {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 12px;
}
/* 2026-05-27: 詳細モーダル動画再生領域 (Twitter <video> / YouTube iframe、 controls 付き) */
.housing-gallery-video {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--housing-card-thumb-bg);
    overflow: hidden;
    border-radius: 12px;
}
.housing-gallery-video > video,
.housing-gallery-video > iframe {
    width: 100%;
    height: 100%;
    display: block;
    border: none;
}
.housing-gallery-empty {
    width: 100%;
    height: var(--housing-detail-empty-h);
    display: grid;
    place-items: center;
    background: var(--housing-panel-bg);
    color: var(--housing-text-mute);
    border-radius: 12px;
    font-size: var(--housing-text-base);
}
/* 2026-05-26 multi-image: メイン画像の下に並べるサムネ列。 1 枚しかない時は非表示 */
.housing-gallery-thumbs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
}
.housing-gallery-thumb {
    padding: 0;
    border: 2px solid transparent;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 150ms ease, opacity 150ms ease;
    width: 64px;
    height: 36px;
    opacity: 0.65;
    overflow: hidden;
}
.housing-gallery-thumb:hover {
    opacity: 1;
}
.housing-gallery-thumb[data-active="true"] {
    border-color: var(--housing-honey-glow);
    opacity: 1;
}
.housing-gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
}
```

これを**丸ごと**以下で置き換える:

```css
/* 2026-07-09 再設計: 大メイン写真 + 縦サムネイル列。 ギャラリーは横並び (stage | rail)。 */
.housing-gallery {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: row;
    gap: 10px;
}
/* メインステージ: 選択中メディアを「絶対に切り抜かず」全体表示 (object-fit:contain)。
   単独の箱なので旧グリッドのはみ出しクリップ (下端/角の見切れ) は構造的に起きない。 */
.housing-gallery-stage {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--housing-card-thumb-bg);
    border-radius: 12px;
}
.housing-gallery-main {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
}
.housing-gallery-video {
    position: relative;
    width: 100%;
    max-height: 100%;
    aspect-ratio: 16 / 9;
    background: var(--housing-card-thumb-bg);
    overflow: hidden;
    border-radius: 8px;
}
.housing-gallery-video > video,
.housing-gallery-video > iframe {
    width: 100%;
    height: 100%;
    display: block;
    border: none;
    object-fit: contain;
}
.housing-gallery-empty {
    width: 100%;
    height: var(--housing-detail-empty-h);
    display: grid;
    place-items: center;
    background: var(--housing-panel-bg);
    color: var(--housing-text-mute);
    border-radius: 12px;
    font-size: var(--housing-text-base);
}
/* 縦サムネイル列。 wrap = 非スクロールのフェード枠 / 中の ul が内部縦スクロール。 */
.housing-detail-thumbrail-wrap {
    position: relative;
    flex: 0 0 var(--housing-detail-thumbrail-w);
    align-self: stretch;
    min-height: 0;
    overflow: hidden;
}
.housing-detail-thumbrail {
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 2px;
    margin: 0;
    list-style: none;
    scrollbar-width: none;            /* Firefox: スクロールバー非表示 */
}
.housing-detail-thumbrail::-webkit-scrollbar {
    display: none;                    /* WebKit: スクロールバー非表示 */
}
.housing-detail-thumb {
    position: relative;
    flex: 0 0 auto;
    width: 100%;
    aspect-ratio: 16 / 9;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 6px;
    background: var(--housing-card-thumb-bg);
    cursor: pointer;
    overflow: hidden;
    opacity: 0.6;
    transition: opacity 150ms ease, border-color 150ms ease;
}
.housing-detail-thumb:hover {
    opacity: 1;
}
.housing-detail-thumb[data-active="true"] {
    opacity: 1;
    border-color: var(--housing-aether);   /* 青 = 選択 */
}
.housing-detail-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;                /* サムネは cover でよい (小さい一覧・元画像は main で全体表示) */
    display: block;
}
.housing-detail-thumb-videobg {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--housing-panel-bg-solid);
}
.housing-detail-thumb-play {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--housing-overlay-strong);
    color: var(--housing-candle);
    font-size: var(--housing-text-sm);
    pointer-events: none;
}
/* スクロールフェード (強め・端で smooth に外れる)。 wrap は非スクロールなので端に留まる。
   scroll が端に達すると Task1 が data-at-top/at-bottom を true にし、 その端の opacity が 0 へ遷移。 */
.housing-detail-thumbrail-wrap::before,
.housing-detail-thumbrail-wrap::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 40px;
    pointer-events: none;
    z-index: 2;
    opacity: 1;
    transition: opacity 0.22s ease;
}
.housing-detail-thumbrail-wrap::before {
    top: 0;
    background: linear-gradient(to bottom, var(--housing-panel-bg-solid), transparent);
}
.housing-detail-thumbrail-wrap::after {
    bottom: 0;
    background: linear-gradient(to top, var(--housing-panel-bg-solid), transparent);
}
.housing-detail-thumbrail-wrap[data-at-top="true"]::before {
    opacity: 0;
}
.housing-detail-thumbrail-wrap[data-at-bottom="true"]::after {
    opacity: 0;
}
```

- [ ] **Step 3: `.housing-detail-gallery`（ギャラリーの高さ容器）を調整**

**3a. base ルール**を探す:

```css
.housing-detail-gallery {
    min-height: var(--housing-detail-empty-h);
    overflow: hidden;
    border-radius: 12px;
}
```

これを以下に置き換える（モバイルで確定高さを与え、 stage/rail が各自クリップするので wrapper の overflow/radius は不要）:

```css
.housing-detail-gallery {
    height: min(60vh, 420px);           /* モバイル: 縦フローで確定高さ (stage/rail の height:100% 用) */
    min-height: var(--housing-detail-empty-h);
}
```

**3b. md+ ルール**（`@media (min-width: 769px)` ブロック内）を探す:

```css
    .housing-detail-gallery {
        flex: 1 1 auto;
        min-height: 0;
    }
```

これを以下に置き換える（ワイドは flex 充填で高さを得るので base の固定高さを解除）:

```css
    .housing-detail-gallery {
        flex: 1 1 auto;
        height: auto;
        min-height: 0;
    }
```

- [ ] **Step 4: build + test**

Run: `npm run build`
Expected: 成功（tsc -b 厳密 + vite/Lightning CSS。 追加 CSS に hex/rgba リテラルが無いこと＝色は全てトークン経由）。
Run: `npx vitest run src/components/housing/listing`
Expected: PASS（Task1 の 3件 + 既存 `HousingDetailContent.test.tsx` 等が緑）。

- [ ] **Step 5: 自己チェック（ハードコード）**

Run: `git diff -- src/styles/housing.css | rg "^\+" | rg "#[0-9a-fA-F]{3,8}|rgba?\("`
Expected: **ヒット0**（追加行に色リテラルが無い＝全てトークン経由。`linear-gradient(... transparent)` の `transparent` はキーワードで OK）。もしヒットしたらトークンに置き換える。

- [ ] **Step 6: 実機確認（ユーザー・HMR）**

開発者の実画面（CSS 1489 / DPR 2.58）で `http://localhost:5173/housing` をハードリロード → 複数写真の物件を開いて目視（[[feedback_no_screenshots_local_verify]]）:
- メイン写真が**全体表示**（下端の SE 著作権表記・上下左右の角まで見える＝**見切れゼロ**）。写真の形が枠と違えば余白が入るだけ。
- 右の**縦サムネイル列**に全写真（＋動画があれば動画）が並ぶ。クリックでメインが入れ替わる。
- サムネが多い時、列の内部だけ縦スクロールし、**スクロールバーは出ず**、端に強めのフェード。端までスクロールするとその端のフェードが**スムーズに消える**。
- **パネル全体は縦スクロールしない**。
- 動画つき物件（あれば）: 動画がサムネ列の項目として並び、クリックでメインで再生。

- [ ] **Step 7: Commit**

```bash
git add src/styles/housing.css
git commit -m "feat(housing): ギャラリーCSSを大メイン(contain・見切れ無し)+縦サムネ列(バー無し・端フェード)に

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 最終チェック

- [ ] `npm run build` 全緑 / `npx vitest run` 全緑。
- [ ] `git diff -- src/styles/housing.css | rg "^\+" | rg "#[0-9a-fA-F]{3,8}|rgba?\("` がヒット0。
- [ ] 実機（ユーザー）: メイン写真が絶対に見切れない／複数写真・動画すべてに到達できる／サムネ列スクロールフェード／パネル無スクロール。
- [ ] `rg -n "housing-gallery-thumbs|housing-gallery-thumb\b" src` が**ヒット0**（旧横並びサムネ CSS/JSX の消し残し確認）。

## 実装メモ（安価モデル向け・ユーザー要望＝低コスト実装）

- Task 1（コンポーネント）→ Task 2（CSS）の**逐次**。Task 1 は TDD（RED→実装→GREEN）で挙動を担保、Task 2 は build + ハードコード自己チェック + ユーザー実機で担保。
- **共有ファイルは `HousingPhotoGallery.tsx`（全面上書き）と `housing.css`（3箇所）だけ**。`HousingDetailContent.tsx` は触らない。
- 迷ったら**メイン写真を絶対に切り抜かない**を最優先（`object-fit:contain` を崩さない／stage に `overflow:hidden` 以外の高さ強制を入れない）。
