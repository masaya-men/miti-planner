# ハウジング「生きたカード」全面配線（段階2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新シェル世代（探す/お気に入り/ツアー）の静止画カードを、旧 workspace にある完成済みの「生きたカード」機構（画像クロスフェード + 動画スポットライト cap1）へ全面配線する。

**Architecture:** `HousingPlaybackProvider` を `HousingShell` の `<Outlet/>` に載せ（＝新世代全ページを一撃で対象化）、各カードを旧 `HousingCard.tsx` と同型の hook（`useHousingCardPlayback` → `useHousingCardFrames` → `HousingCardAmbientSlideshow`〔+ `HousingCardVideoOverlay`〕）で配線する。再発明ゼロ。Provider 外は `NOOP_CONTEXT` で静止するため既存テストは非破壊。

**Tech Stack:** React 18 + TypeScript（strict, `tsc -b`）、Vitest（happy-dom）、`react-i18next`、CSS 変数（`--housing-*` トークン）。

**設計書（正典）:** `docs/superpowers/specs/2026-07-08-housing-living-card-rollout-design.md`

## Global Constraints

- **ハウジング独自トンマナ**（`.claude/rules/housing-design.md`）。色・寸法・影は `--housing-*` トークン経由、**ハードコード禁止**（`aspect-*` 等の純ユーティリティのみ例外）。新規 CSS は `src/styles/housing.css` に追加。
- **i18n**: 文字列は i18n キー経由。本 plan は**新規 UI 文字列を追加しない**。
- **旧 workspace 世代（`src/components/housing/workspace/**`）は一切変更しない**（現役の参照実装として温存）。共有 primitive（`HousingCardAmbientSlideshow` / `HousingCardVideoOverlay` / `HousingPlaybackContext` / `useHousingCardFrames`）は**読み取り専用で再利用**（改変しない）。
- **reduced-motion 尊重**は Provider 内蔵（`HousingPlaybackContext.tsx:93`）。維持する。
- **既定 = 全面アニメ ON**。mute（面ごとに静止）は将来プロパティで倒す想定だが、本 plan では既定 ON のまま配線する（mute は実装後にユーザーが実画面で判断）。
- **完了ゲート**: `npm run build`（tsc -b 厳密）EXIT0 + `npx vitest run`（既知 legacy 5 fail = `TopBar`(4) + `HousingWorkspace`(1) 以外の新規 fail ゼロ）。見た目・mute する面は実画面ゲート（ユーザー・CSS1489/DPR2.58）。
- **既知の実機確認事項（ブロッカーではない）**: `useIsScrolling.ts:21` は **window scroll** 前提。`HousingShell.tsx:42` が `document.body` を `overflow:hidden` にするため、シェル内スクロールでは `isScrolling` が立たず「スクロール中停止」が発火しない可能性。→ Task 5 で実機確認し、必要なら別 follow-up（本 plan のコアは window 前提で進める）。

---

## File Structure

| ファイル | 役割 | 変更 |
|---|---|---|
| `src/components/housing/shell/HousingShell.tsx` | 全ページ共通シェル | `<Outlet/>` を `<HousingPlaybackProvider>` で包む（Task 1） |
| `src/components/housing/browse/ListingCard.tsx` | 探す/お気に入り 共通グリッドカード | 生きたカード配線（画像+動画）。ベース img は残す（Task 2） |
| `src/components/housing/browse/FavoritesPreviewStrip.tsx` | 探す右カラム お気に入りプレビュー | 各サムネを小コンポーネント `FavPreviewThumb` に抽出し画像スライドショー配線（Task 3） |
| `src/components/housing/tour/TourShowcasePanel.tsx` | ツアー目的地ショーケース（表示専用） | hero 画像を生きたカード化（画像+動画）。構造刷新は別 project B（Task 4） |
| `src/styles/housing.css` | スタイル | 生きたカード用の position:relative コンテナ規則を追加（Task 2/3/4 で最小限） |
| 各 `__tests__` | テスト | Provider 有/無での挙動テスト追加・既存テスト非破壊確認 |

**共有 primitive（再利用・不変）**: `workspace/HousingCardAmbientSlideshow.tsx` / `workspace/HousingCardVideoOverlay.tsx` / `lib/housing/HousingPlaybackContext.tsx`（`HousingPlaybackProvider` / `useHousingCardPlayback`）/ `lib/housing/useHousingCardFrames.ts`。

**依存順**: Task 1（Provider mount）が前提。Task 2/3/4 は各テストで自前に `<HousingPlaybackProvider>` を wrap するため**相互に独立＝並列実装可**。Task 5/6 は任意・末尾。

---

### Task 1: `HousingShell` に `HousingPlaybackProvider` を載せる

新世代全ページ（探す/お気に入り/ツアー/登録）を生きたカード対象化する前提。Provider を `<Outlet/>` に被せるだけ。props は全て既定（`spotlightCap=1` / `poolCap=999` / `intervalMs=15000` / `minRatio=0.25` / `lightboxOpen=false`）。

**Files:**
- Modify: `src/components/housing/shell/HousingShell.tsx`（import 追加 + `:54-56` の `<Outlet/>` を包む）
- Test: `src/__tests__/housing/HousingShellPlayback.test.tsx`（新規・Provider が子へ `ambientOn` を配ることを最小consumerで検証）

**Interfaces:**
- Consumes: `HousingPlaybackProvider`（`../../../lib/housing/HousingPlaybackContext`。props 全任意）、`useHousingPlayback()`（同）。
- Produces: 新世代ページの子孫で `useHousingPlayback().ambientOn` が Provider 由来（reduced-motion 非時に `true`）になる。

- [ ] **Step 1: 失敗するテストを書く**

新規 `src/__tests__/housing/HousingShellPlayback.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useHousingPlayback } from '../../lib/housing/HousingPlaybackContext';
import { HousingShell } from '../../components/housing/shell/HousingShell';

// matchMedia (prefers-reduced-motion) を happy-dom に用意（未定義だと useReducedMotion が落ちる）
beforeAll(() => {
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      } as unknown as MediaQueryList);
  }
});

function AmbientProbe() {
  const { ambientOn } = useHousingPlayback();
  return <span data-testid="ambient-probe">{ambientOn ? 'on' : 'off'}</span>;
}

describe('HousingShell — 生きたカード Provider mount', () => {
  it('子ルートで useHousingPlayback().ambientOn が Provider 由来 (reduced-motion 非時 on) になる', () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/housing']}>
        <Routes>
          <Route path="/housing" element={<HousingShell />}>
            <Route index element={<AmbientProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(getByTestId('ambient-probe').textContent).toBe('on');
  });
});
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/__tests__/housing/HousingShellPlayback.test.tsx`
Expected: FAIL（現状 `HousingShell` は Provider を mount していないため `NOOP_CONTEXT` の `ambientOn:false` → `'off'`）

- [ ] **Step 3: Provider を mount**

`src/components/housing/shell/HousingShell.tsx` の import 群（`:9` 付近）へ追加:
```tsx
import { HousingPlaybackProvider } from '../../../lib/housing/HousingPlaybackContext';
```

`:54-56` の `<Outlet/>` ブロックを差し替え（`.housing-shell-body` はそのまま、中身を Provider で包む）:
```tsx
        <div className="housing-shell-body">
          <HousingPlaybackProvider>
            <Outlet />
          </HousingPlaybackProvider>
        </div>
```

- [ ] **Step 4: テスト実行して緑を確認**

Run: `npx vitest run src/__tests__/housing/HousingShellPlayback.test.tsx`
Expected: PASS（`'on'`）

- [ ] **Step 5: 全体ビルド + 全テスト（非破壊確認）**

Run: `npm run build`
Expected: EXIT0

Run: `npx vitest run`
Expected: 既知 legacy 5 fail（`TopBar`4 + `HousingWorkspace`1）以外の新規 fail ゼロ

- [ ] **Step 6: コミット**

```bash
git add src/components/housing/shell/HousingShell.tsx src/__tests__/housing/HousingShellPlayback.test.tsx
git commit -m "feat(housing): HousingShell に HousingPlaybackProvider を mount (生きたカード段階2の前提)"
```

---

### Task 2: `ListingCard`（探す/お気に入り 共通カード）を生きたカード化

最大効果。旧 `HousingCard.tsx:41-93` と同型で配線する。**ベース `<img className="housing-listing-card-img">` は残す**（既存テストの assert 対象・YouTube フォールバック機構の受け皿）。その上へ `HousingCardAmbientSlideshow` と条件付き `HousingCardVideoOverlay` を重ねる。IntersectionObserver 登録用 ref を `.housing-listing-card-media` に付ける。

**Files:**
- Modify: `src/components/housing/browse/ListingCard.tsx`
- Modify: `src/styles/housing.css`（`.housing-listing-card-media` に `position: relative` が無ければ追加）
- Test: `src/components/housing/browse/__tests__/ListingCard.test.tsx`（Provider 有で slideshow が出る新テスト + 既存テスト非破壊）

**Interfaces:**
- Consumes: `useHousingCardPlayback(listingId: string, isVideo: boolean): { isPlaying: boolean; ambientOn: boolean; register: (el: Element | null) => void }`（`../../../lib/housing/HousingPlaybackContext`）、`useHousingCardFrames(listing, enabled: boolean)`（`../../../lib/housing/useHousingCardFrames`）、`HousingCardAmbientSlideshow`（`../workspace/HousingCardAmbientSlideshow`）、`HousingCardVideoOverlay`（`../workspace/HousingCardVideoOverlay`）。
- Produces: Provider 配下で `.housing-card-ambient-slideshow` が `.housing-listing-card-media` 内に描画される。Provider 外（NOOP）では `enabled=false` で静止。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/browse/__tests__/ListingCard.test.tsx` の import に Provider を追加（`:14` の `import { ListingCard }` の直前）:
```tsx
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
```

`beforeAll`（`:22-29` の i18n init 内、`i18n.use(...).init(...)` の後）に matchMedia スタブを追加（Provider の `useReducedMotion` 用）:
```tsx
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      } as unknown as MediaQueryList);
  }
```

ファイル末尾（最後の `describe` の後）に新 describe を追加:
```tsx
describe('ListingCard — 生きたカード配線 (段階2)', () => {
  const multiImage = {
    ...mockListing,
    imageMode: 'sns' as const,
    sourceImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  };

  it('Provider 配下では ambient スライドショーが media 内に描画される (複数画像)', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <ListingCard listing={multiImage} onAddToTour={() => {}} />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    const media = container.querySelector('.housing-listing-card-media');
    expect(media?.querySelector('.housing-card-ambient-slideshow')).not.toBeNull();
    // フレーム数分の img (sourceImageUrls 2 枚)
    expect(media?.querySelectorAll('.housing-card-ambient-slideshow img')).toHaveLength(2);
  });

  it('ベース img (.housing-listing-card-img) は残る (静止フォールバック・非破壊)', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <ListingCard listing={multiImage} onAddToTour={() => {}} />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-listing-card-img')).not.toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: FAIL（現状 `ListingCard` は `.housing-card-ambient-slideshow` を描画しない）

- [ ] **Step 3: `ListingCard` を配線**

`src/components/housing/browse/ListingCard.tsx` の import 群（`:1-13`）を差し替え/追加:
```tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Check } from 'lucide-react';
import { HousingCardMarqueeLine } from './HousingCardMarqueeLine';
import { HousingFavHeart } from './HousingFavHeart';
import type { MockListing } from '../../../data/housing/mockListings';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEffectivelyPublic } from '../../../lib/housing/listingPublish';
import {
  handleYoutubeThumbnailError,
  handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from '../workspace/HousingCardVideoOverlay';
```

コンポーネント本体の先頭（`:54` の `const { t, i18n } = useTranslation();` 群の後、`const title = ...` の前）に配線を追加:
```tsx
  // 生きたカード (段階2): 動画種別 → spotlight 候補判定、frames 解決、IO 登録。旧 HousingCard と同型。
  const videoKind: 'twitter' | 'youtube' | null = listing.videoUrl
    ? 'twitter'
    : listing.youtubeVideoId
      ? 'youtube'
      : null;
  const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing.id, videoKind !== null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    register(mediaRef.current);
    return (): void => register(null);
  }, [register]);
  const frames = useHousingCardFrames(listing, ambientOn);
```

`.housing-listing-card-media` の `<div>`（`:84`）に `ref` を付与し、ベース img（`:85-95`）の直後に slideshow + 動画オーバーレイを挿入:
```tsx
      <div className="housing-listing-card-media" ref={mediaRef}>
        <img
          className="housing-listing-card-img"
          src={representativeImage(listing)}
          alt=""
          loading="lazy"
          onError={handleYoutubeThumbnailError}
          onLoad={handleYoutubeThumbnailLoad}
        />
        <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn} />
        {isPlaying && videoKind === 'twitter' && listing.videoUrl && (
          <HousingCardVideoOverlay
            kind="twitter"
            videoUrl={listing.videoUrl}
            posterUrl={listing.videoPosterUrl}
          />
        )}
        {isPlaying && videoKind === 'youtube' && listing.youtubeVideoId && (
          <HousingCardVideoOverlay kind="youtube" youtubeVideoId={listing.youtubeVideoId} />
        )}
```
（`.housing-listing-card-topleft` 以降は不変）

- [ ] **Step 4: media コンテナが position:relative か確認し、無ければ CSS 追加**

Run: `rtk grep "housing-listing-card-media" src/styles/housing.css`
`.housing-listing-card-media { ... position: relative ... }` が無い場合のみ、該当ルールへ `position: relative;` を追加（slideshow/overlay は `position:absolute; inset:0` で親基準に重なるため必須）。既に relative なら変更不要。

- [ ] **Step 5: テスト実行して緑を確認（新規 + 既存 非破壊）**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: PASS（新 2 テスト緑 + 既存 selectable/♡/遷移/YouTube フォールバック 全緑。ベース img を残したため `.housing-listing-card-img` 依存の既存テストは非破壊）

- [ ] **Step 6: 全体ビルド**

Run: `npm run build`
Expected: EXIT0

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/browse/ListingCard.tsx src/components/housing/browse/__tests__/ListingCard.test.tsx src/styles/housing.css
git commit -m "feat(housing): ListingCard を生きたカード化 (探す/お気に入り・画像スライドショー+動画spotlight)"
```

---

### Task 3: お気に入りプレビュー strip を生きたカード化（画像のみ）

`FavoritesPreviewStrip` の各サムネにスライドショーを配線する。各サムネで hook が必要なため、**小コンポーネント `FavPreviewThumb` を同ファイル内に抽出**する。仕様上 strip は**画像のみ**（動画スポットライトは載せない＝`isVideo=false` で候補に入れない・動画オーバーレイ無し）。

**Files:**
- Modify: `src/components/housing/browse/FavoritesPreviewStrip.tsx`（`FavPreviewThumb` 追加 + サムネ描画差し替え）
- Modify: `src/styles/housing.css`（`.housing-fav-strip-thumb` に `position: relative` が無ければ追加）
- Test: `src/components/housing/browse/__tests__/FavoritesPreviewStrip.test.tsx`（新規）

**Interfaces:**
- Consumes: `useHousingCardPlayback`（`isVideo=false` で呼ぶ → register no-op・ambientOn のみ利用）、`useHousingCardFrames`、`HousingCardAmbientSlideshow`。
- Produces: Provider 配下で各 `.housing-fav-strip-thumb` 内に `.housing-card-ambient-slideshow` が出る。動画オーバーレイは出さない。

- [ ] **Step 1: 失敗するテストを書く**

新規 `src/components/housing/browse/__tests__/FavoritesPreviewStrip.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';

import { vi } from 'vitest';
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { FavoritesPreviewStrip } from '../FavoritesPreviewStrip';

const listing = { ...MOCK_LISTINGS[0], imageMode: 'sns' as const, sourceImageUrls: ['https://x/a.jpg', 'https://x/b.jpg'] };

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList);
  }
});

beforeEach(() => {
  useHousingListingsStore.setState({ listings: [listing] });
  useHousingFavoritesStore.setState({ ids: [listing.id] });
});

describe('FavoritesPreviewStrip — 生きたカード (画像のみ)', () => {
  it('Provider 配下で各サムネに ambient スライドショーが出る', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <FavoritesPreviewStrip />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    const thumb = container.querySelector('.housing-fav-strip-thumb');
    expect(thumb?.querySelector('.housing-card-ambient-slideshow')).not.toBeNull();
  });
});
```
（注: `MOCK_LISTINGS[0]` に既に `sourceImageUrls` があればスプレッド不要だが、テストの自己完結のため明示上書き。`useHousingListingsStore`/`useHousingFavoritesStore` の setter 名は実 store に合わせる — `setState` は zustand 標準。）

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/components/housing/browse/__tests__/FavoritesPreviewStrip.test.tsx`
Expected: FAIL（現状 slideshow 未描画）

- [ ] **Step 3: `FavPreviewThumb` を抽出して配線**

`src/components/housing/browse/FavoritesPreviewStrip.tsx` の import（`:1-8`）に追加:
```tsx
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';
```

`representativeImage`（`:12-16`）の後に小コンポーネントを追加:
```tsx
/**
 * プレビュー strip の 1 サムネ (画像のみの生きたカード)。
 * isVideo=false で呼ぶ = spotlight 動画候補に入れない (strip は画像クロスフェードのみ)。
 * ambientOn は Provider 由来 (Provider 外なら NOOP で静止)。
 */
const FavPreviewThumb: React.FC<{ listing: MockListing }> = ({ listing }) => {
  const { ambientOn } = useHousingCardPlayback(listing.id, false);
  const frames = useHousingCardFrames(listing, ambientOn);
  return (
    <>
      <img src={representativeImage(listing)} alt="" loading="lazy" />
      <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn} />
    </>
  );
};
```

サムネ描画（`:83-90` の `<button>` 内の `<img>`）を `FavPreviewThumb` に差し替え:
```tsx
              <button
                type="button"
                className="housing-fav-strip-thumb"
                aria-label={formatHousingAddress(l, i18n.language)}
                onClick={() => navigate(`/housing/listing/${l.id}`)}
              >
                <FavPreviewThumb listing={l} />
              </button>
```

- [ ] **Step 4: `.housing-fav-strip-thumb` の position を確認**

Run: `rtk grep "housing-fav-strip-thumb" src/styles/housing.css`
`position: relative` が無ければ該当ルールへ追加（slideshow の絶対配置が thumb 基準になるよう）。

- [ ] **Step 5: テスト実行して緑を確認**

Run: `npx vitest run src/components/housing/browse/__tests__/FavoritesPreviewStrip.test.tsx`
Expected: PASS

- [ ] **Step 6: 全体ビルド**

Run: `npm run build`
Expected: EXIT0

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/browse/FavoritesPreviewStrip.tsx src/components/housing/browse/__tests__/FavoritesPreviewStrip.test.tsx src/styles/housing.css
git commit -m "feat(housing): お気に入りプレビュー strip を生きたカード化 (画像スライドショーのみ)"
```

---

### Task 4: ツアー目的地の hero 画像を生きたカード化（画像+動画）

`TourShowcasePanel` の静止 hero 画像を生きたカード化する。**構造刷新（住所集約/メモ/ステッパー等）は project B の別 plan**。ここでは画像機構だけを配線し、`.housing-tour-dest-thumb` の img はラッパー内に残す。

**Files:**
- Modify: `src/components/housing/tour/TourShowcasePanel.tsx`
- Modify: `src/styles/housing.css`（`.housing-tour-dest-thumb-wrap` を追加）
- Test: `src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx`（Provider 有で slideshow が出る新テスト + 既存非破壊）

**Interfaces:**
- Consumes: `useHousingCardPlayback` / `useHousingCardFrames` / `HousingCardAmbientSlideshow` / `HousingCardVideoOverlay`。`currentStep.listing`（`TourStep`）。
- Produces: Provider 配下で `.housing-tour-dest-thumb-wrap` 内に `.housing-card-ambient-slideshow` が出る。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx` の import に追加:
```tsx
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
```
`beforeAll` に matchMedia スタブが無ければ追加（他テストと同じスニペット）。ファイル末尾に新 describe:
```tsx
describe('TourShowcasePanel — 生きたカード hero (段階2)', () => {
  it('Provider 配下で目的地画像に ambient スライドショーが出る (複数画像)', () => {
    const multi = { ...currentListing, imageMode: 'sns' as const, sourceImageUrls: ['https://x/a.jpg', 'https://x/b.jpg'] };
    const step = { id: multi.id, listing: multi };
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <TourShowcasePanel
            currentStep={step}
            currentIndex={0}
            isLast={false}
            onPrev={() => {}}
            onPrimary={() => {}}
            onOpenReport={() => {}}
          />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    const wrap = container.querySelector('.housing-tour-dest-thumb-wrap');
    expect(wrap?.querySelector('.housing-card-ambient-slideshow')).not.toBeNull();
    expect(container.querySelector('.housing-tour-dest-thumb')).not.toBeNull(); // ベース img 残存
  });
});
```
（`currentListing` は既存テストが定義している定数を流用。無ければ `MOCK_LISTINGS[0]` を `currentListing` として用意。）

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: `TourShowcasePanel` を配線**

`src/components/housing/tour/TourShowcasePanel.tsx` の import（`:1-5`）に追加:
```tsx
import { useEffect, useRef } from 'react';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from '../workspace/HousingCardVideoOverlay';
```

本体先頭（`:33-36` の `const listing = ...` 群の後）に配線を追加:
```tsx
  const videoKind: 'twitter' | 'youtube' | null = listing?.videoUrl
    ? 'twitter'
    : listing?.youtubeVideoId
      ? 'youtube'
      : null;
  const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing?.id ?? '', videoKind !== null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    register(mediaRef.current);
    return (): void => register(null);
  }, [register]);
  const frames = useHousingCardFrames(
    listing ?? ({ id: '' } as Parameters<typeof useHousingCardFrames>[0]),
    ambientOn,
  );
```
（`listing` は `null` を取り得る表示専用 props。hook は常に呼ぶ必要があるため、`listing` が null のときは空 id + 空 frames で無害に回す。`resolveSlideshowFrames` は該当フィールド無しなら `[]` を返す＝slideshow は `null` 描画。）

hero 画像（`:42-47`）をラッパーで包む:
```tsx
          <div className="housing-tour-dest-thumb-wrap" ref={mediaRef}>
            <img
              className="housing-tour-dest-thumb"
              src={representativeImage(listing)}
              alt=""
              loading="lazy"
            />
            <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn} />
            {isPlaying && videoKind === 'twitter' && listing.videoUrl && (
              <HousingCardVideoOverlay
                kind="twitter"
                videoUrl={listing.videoUrl}
                posterUrl={listing.videoPosterUrl}
              />
            )}
            {isPlaying && videoKind === 'youtube' && listing.youtubeVideoId && (
              <HousingCardVideoOverlay kind="youtube" youtubeVideoId={listing.youtubeVideoId} />
            )}
          </div>
```
（この JSX は `{listing && ( ... )}` ブロック内なので `listing` は非 null 確定。`representativeImage(listing)` は既存の lib 呼び出しを維持。）

- [ ] **Step 4: CSS ラッパー規則を追加**

`src/styles/housing.css` の `.housing-tour-dest-thumb` 規則の直後に追加:
```css
/* 生きたカード段階2: hero 画像に slideshow/動画を重ねるための基準ボックス。 */
.housing-tour-dest-thumb-wrap { position: relative; }
```
（既存 `.housing-tour-dest-thumb`（img）の寸法・角丸は不変。slideshow/overlay は `inset:0` でこのラッパーに重なる。）

- [ ] **Step 5: テスト実行して緑を確認（新規 + 既存 非破壊）**

Run: `npx vitest run src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx`
Expected: PASS（新テスト + 既存の詳細/操作/報告/防御テスト全緑。img に `.housing-tour-dest-thumb` を残したため非破壊）

- [ ] **Step 6: 全体ビルド + 全テスト**

Run: `npm run build`
Expected: EXIT0

Run: `npx vitest run`
Expected: 既知 legacy 5 fail 以外の新規 fail ゼロ

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/tour/TourShowcasePanel.tsx src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx src/styles/housing.css
git commit -m "feat(housing): ツアー目的地 hero を生きたカード化 (画像+動画・構造刷新はproject B)"
```

---

### Task 5: 実機ゲート（ユーザー）+ mute 判断 + isScrolling 検証

コード配線後の**見た目確定**。実装エージェントは実施せず、ユーザーが実画面（CSS1489/DPR2.58）で確認する。

- [ ] **Step 1: 実画面確認（ユーザー）**

`/housing`（探す）・`/housing/favorites`・`/housing/tour` を**ハードリロード**して:
- 探す/お気に入りグリッドのカードが「生きて」動く（複数画像はクロスフェード、動画ありは常時1本だけ再生が順送り）
- お気に入りプレビュー strip が画像クロスフェード
- ツアー目的地 hero が動く
- **うるさい面があれば申告** → 該当面に「mute（静止）」を後追いで入れる（`enabled={ambientOn && false}` 相当のプロパティ化 or 単純に slideshow を外す）。本 plan では既定 ON のまま。

- [ ] **Step 2: `isScrolling`（スクロール中停止）の実効性を確認**

探す/お気に入りページでスクロールしながら、スクロール中にアニメが止まるか目視。`HousingShell` は body overflow:hidden のためシェル内スクロールでは `useIsScrolling`（window 前提）が発火しない可能性が高い。
- 発火しない＝スクロール中もアニメ継続。クロスフェードは軽いので許容だが、気になる/動画でチラつくなら follow-up（`useIsScrolling` を実スクロールコンテナ対応にする or `useViewportPlaybackPool` ベースの in-view ゲートを画像にも入れる）を別 issue 化。
- 本 plan の完了条件には含めない（コアは動くこと）。

---

### Task 6（任意）: 詳細ページ「他の登録」mini を生きたカード化

`HousingDuplicatePeersSection` は詳細ページ（`/housing/listing/:id` = `HousingDetailPage`・シェル外）にあるため、Provider が別途要る。**任意ステップ**（コア完了条件外）。ユーザーが「詳細の他登録も動かしたい」と言った場合のみ着手。

**Files:**
- Modify: `src/components/housing/listing/HousingDetailPage.tsx`（`HousingPlaybackProvider` で内容を包む・`lightboxOpen` は詳細内モーダル state があれば渡す、無ければ既定 false）
- Modify: `src/components/housing/listing/HousingDuplicatePeersSection.tsx`（peer サムネを Task 3 と同型の画像スライドショー小コンポーネントに）
- Test: 対応 `__tests__`（Provider 有で slideshow）

- [ ] **Step 1**: `HousingDetailPage` のルート要素を `<HousingPlaybackProvider>` で包む（Task 1 と同型・`lightboxOpen` は詳細のギャラリー lightbox 開閉があればそれを渡す）。
- [ ] **Step 2**: `HousingDuplicatePeersSection` の peer サムネ（`:40` の `<img>`）を Task 3 の `FavPreviewThumb` 相当（画像のみ）に置換。`peer.sourceImageUrls[0] ?? peer.videoPosterUrl` の単発 src ではなく `useHousingCardFrames(peer, ambientOn)` へ。
- [ ] **Step 3**: build + test + コミット。

---

## Self-Review

**1. Spec coverage（設計書 §Scope に対応）**:
- Provider mount（設計書 A-1 / ブロッカー）= Task 1 ✅
- `ListingCard`（探す+お気に入り・画像+動画）= Task 2 ✅
- `FavoritesPreviewStrip`（画像のみ）= Task 3 ✅
- `TourShowcasePanel` hero（画像+動画・構造は B）= Task 4 ✅
- reduced-motion 尊重 = Provider 内蔵（全 Task で維持・NOOP/Provider 経由）✅
- 動画 cap1 スポットライト = Provider 既定 spotlightCap=1 を上書きしない（Task 1）✅
- 画像 in-view ゲート非採用 = 明示的に入れない（Task 5 Step2 で実機判断・follow-up 化）✅
- 詳細 peers（任意）= Task 6 ✅
- `representativeImage` 重複撤去 = **設計書 A-4 の cleanup を本 plan では独立 Task 化していない**。理由: ベース img の静止 src と YouTube フォールバックは単発 string 前提で、frames 化と絡めると回帰リスク。配線（Task 2-4）はローカル `representativeImage` を維持したまま成立する。**dedupe は别 follow-up**（低優先・リリース最短のため本 plan スコープ外に降格）→ 設計書にもその旨追記済み。

**2. Placeholder scan**: 各 Step に実コード/実コマンド/期待値を明記。TBD なし。Task 4 の `listing` null 分岐、Task 3 の store setter は zustand `setState` で具体化。

**3. Type consistency**:
- `useHousingCardPlayback(listingId: string, isVideo: boolean): { isPlaying; ambientOn; register: (el: Element|null)=>void }` を Task 2/3/4 で一致使用（`HousingPlaybackContext.tsx:131` の実シグネチャに一致）。
- `useHousingCardFrames(listing, enabled)` を Task 2/3/4 で一致。
- `HousingCardVideoOverlay` の判別 union（`kind:'twitter'|{videoUrl,posterUrl?}` / `kind:'youtube'|{youtubeVideoId}`）を Task 2/4 で正しく分岐（`HousingCardVideoOverlay.tsx:3-12` に一致）。
- `videoKind` 導出は旧 `HousingCard.tsx:41-45` と同一式。

**4. 非破壊**: ベース img のクラス（`.housing-listing-card-img` / `.housing-tour-dest-thumb`）を残し、既存テストの assert を保持。Provider 外は NOOP で静止 → Provider 無しでレンダーする既存テストは緑のまま。旧 workspace は不変。
