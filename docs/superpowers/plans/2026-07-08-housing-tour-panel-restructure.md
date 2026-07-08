# ハウジングツアー 左右パネル構造刷新（Project B・ローカル版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアー中ページの左パネルを表示専用ショーケースに、右パネルを進行＋操作の司令塔にし、moving↔viewing フェーズと見学タイマー（ローカル版）を追加する。

**Architecture:** 表示専用コンポーネント群（左=ショーケース/右=進行）と純粋関数の分離を維持。フェーズ・見学開始時刻は zustand ストア（`useHousingTourStore`）に素の JSON で持たせ、将来の共有ツアー同期へ差し替えるだけで乗る形にする。経過時間は開始時刻から表示側（`useElapsed`）で毎秒算出し、ストアには秒を持たない。

**Tech Stack:** React 18 + TypeScript（strict / erasableSyntaxOnly / tsc -b）、zustand、react-i18next（ja/en/ko/zh parity）、vitest（happy-dom・vmThreads）、housing.css の `--housing-*` トークン。

## Global Constraints

- **ハウジング独自トンマナ**: 白黒のみ等の LoPo ルールは非適用。`--housing-*` トークン経由。**色/影/フォントサイズのハードコード禁止**（`rgb(`/`rgba(`/`#hex`/`px` の literal は housing.css 内のみ許容）。
- **i18n 4言語 parity 厳守**（ja/en/ko/zh）。文字列は必ずキー経由。locale JSON は**該当ブロックのみ textual 編集**（全体 parse→stringify 禁止）。
- **backdrop-filter リテラル禁止**（今回は使わない想定）。
- **TDD**: 各タスクは失敗するテスト→最小実装→緑→コミット。
- **push 前に `npm run build`（tsc -b 厳密・未使用変数/型エラーが罠）＋ `vitest run` 必須**。
- **vitest 実行はパイプ禁止**（App Check teardown 由来のハング回避・vmThreads）。
- **タイマー/経過はローカル版**（同期しない）。ストアの `currentIndex`/`phase`/`viewStartAt` は素の JSON（forward-compat）。
- コミットは `rtk git`、日本語メッセージ、末尾に `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- **🐛家と道の枠線問題は本プランの対象外**（全タスク完了後に別途）。

---

## File Structure

**新規:**
- `src/lib/housing/useElapsed.ts` — 開始時刻(epoch ms)→経過秒を毎秒返す hook＋`formatElapsed`/`formatClock` 純関数。
- `src/components/housing/tour/TourLivingMedia.tsx` — 生きたカードの「メディア部分」（img+ambient+動画overlay+playback配線）を再利用可能に抽出。現在カードと次カードで共用。
- `src/components/housing/tour/TourPhaseZone.tsx` — 右パネルのフェーズ枠（moving=行き方 / viewing=タイマー）。

**変更:**
- `src/store/useHousingTourStore.ts` — `phase`/`viewStartAt`/`startViewing` 追加、`next`/`prev`/`start`/`reset` を moving リセットに拡張。
- `src/components/housing/tour/TourShowcasePanel.tsx` — 表示専用化。props から操作系を除去し `nextStep` 追加。
- `src/components/housing/tour/TourProgressPanel.tsx` — リング+軒数横並び、フェーズ枠、操作3ボタン、props 拡張。
- `src/components/housing/tour/TourRouteSteps.tsx` — 縦ステッパー（青丸+伸びる青線）へ視覚刷新。
- `src/components/housing/pages/TourNavPage.tsx` — 新 props 配線。
- `src/styles/housing.css` — 左右パネル新レイアウト（トークン経由）。
- `src/locales/{ja,en,ko,zh}.json` — 紹介文リネーム＋新規キー。
- 各 `__tests__/`（Showcase/Progress/RouteSteps/NavPage）＋新規（store/useElapsed/PhaseZone/LivingMedia）。

---

### Task 1: ストアに phase / viewStartAt / startViewing を追加

**Files:**
- Modify: `src/store/useHousingTourStore.ts`
- Test: `src/store/__tests__/useHousingTourStore.test.ts` (Create)

**Interfaces:**
- Produces: `useHousingTourStore` state に `phase: 'moving' | 'viewing'`, `viewStartAt: number | null`, `startViewing(): void`。`next()`/`prev()`/`start()`/`reset()` は実行後に `phase==='moving'` かつ `viewStartAt===null` を保証。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/store/__tests__/useHousingTourStore.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useHousingTourStore } from '../useHousingTourStore';

describe('useHousingTourStore — フェーズ/見学タイマー', () => {
  beforeEach(() => {
    useHousingTourStore.getState().reset();
    useHousingTourStore.getState().setListings(['a', 'b', 'c']);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T14:32:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('初期状態は moving / viewStartAt=null', () => {
    const s = useHousingTourStore.getState();
    expect(s.phase).toBe('moving');
    expect(s.viewStartAt).toBeNull();
  });

  it('startViewing で viewing + 開始時刻が入る', () => {
    useHousingTourStore.getState().startViewing();
    const s = useHousingTourStore.getState();
    expect(s.phase).toBe('viewing');
    expect(s.viewStartAt).toBe(new Date('2026-07-08T14:32:00').getTime());
  });

  it('next で moving に戻り viewStartAt=null', () => {
    useHousingTourStore.getState().startViewing();
    useHousingTourStore.getState().next();
    const s = useHousingTourStore.getState();
    expect(s.phase).toBe('moving');
    expect(s.viewStartAt).toBeNull();
    expect(s.currentIndex).toBe(1);
  });

  it('prev でも moving に戻る', () => {
    useHousingTourStore.getState().next();
    useHousingTourStore.getState().startViewing();
    useHousingTourStore.getState().prev();
    const s = useHousingTourStore.getState();
    expect(s.phase).toBe('moving');
    expect(s.viewStartAt).toBeNull();
    expect(s.currentIndex).toBe(0);
  });

  it('start / reset も moving + viewStartAt=null', () => {
    useHousingTourStore.getState().startViewing();
    useHousingTourStore.getState().start();
    expect(useHousingTourStore.getState().phase).toBe('moving');
    expect(useHousingTourStore.getState().viewStartAt).toBeNull();
    useHousingTourStore.getState().startViewing();
    useHousingTourStore.getState().reset();
    expect(useHousingTourStore.getState().phase).toBe('moving');
    expect(useHousingTourStore.getState().viewStartAt).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/store/__tests__/useHousingTourStore.test.ts`
Expected: FAIL（`phase` / `startViewing` が存在しない）

- [ ] **Step 3: ストアを実装**

`src/store/useHousingTourStore.ts` を全面差し替え:

```ts
import { create } from 'zustand';

interface HousingTourState {
    listingIds: string[];
    running: boolean;
    currentIndex: number;
    /** moving=移動中(行き方表示) / viewing=見学中(タイマー表示)。将来の共有ツアー同期でそのまま共有する素の状態。 */
    phase: 'moving' | 'viewing';
    /** 見学開始の epoch ms。moving では null。経過時間は表示側(useElapsed)が算出する。 */
    viewStartAt: number | null;
    setListings: (ids: string[]) => void;
    start: () => void;
    stop: () => void;
    next: () => void;
    prev: () => void;
    /** 現在の目的地の見学を開始(=viewing へ)。開始時刻を今に記録。 */
    startViewing: () => void;
    reset: () => void;
}

export const useHousingTourStore = create<HousingTourState>((set) => ({
    listingIds: [],
    running: false,
    currentIndex: 0,
    phase: 'moving',
    viewStartAt: null,
    setListings: (listingIds) => set({ listingIds }),
    start: () => set({ running: true, currentIndex: 0, phase: 'moving', viewStartAt: null }),
    stop: () => set({ running: false }),
    next: () => set((s) => ({
        currentIndex: Math.min(s.listingIds.length - 1, s.currentIndex + 1),
        phase: 'moving',
        viewStartAt: null,
    })),
    prev: () => set((s) => ({
        currentIndex: Math.max(0, s.currentIndex - 1),
        phase: 'moving',
        viewStartAt: null,
    })),
    startViewing: () => set({ phase: 'viewing', viewStartAt: Date.now() }),
    reset: () => set({ listingIds: [], running: false, currentIndex: 0, phase: 'moving', viewStartAt: null }),
}));
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/store/__tests__/useHousingTourStore.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/store/useHousingTourStore.ts src/store/__tests__/useHousingTourStore.test.ts
rtk git commit -m "feat(housing): ツアーストアに phase/viewStartAt/startViewing を追加"
```

---

### Task 2: useElapsed hook ＋ formatElapsed / formatClock

**Files:**
- Create: `src/lib/housing/useElapsed.ts`
- Test: `src/lib/housing/__tests__/useElapsed.test.ts` (Create)

**Interfaces:**
- Produces:
  - `useElapsed(startAt: number | null): number` — startAt からの経過秒(0以上)。null なら 0。1秒ごとに再レンダー。
  - `formatElapsed(seconds: number): string` — `M:SS`（60分以上は `H:MM:SS`）。
  - `formatClock(epochMs: number): string` — 24時間 `H:MM`（ローカル時刻）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/useElapsed.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useElapsed, formatElapsed, formatClock } from '../useElapsed';

describe('formatElapsed', () => {
  it('分:秒 (ゼロ詰め秒)', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(5)).toBe('0:05');
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(600)).toBe('10:00');
  });
  it('60分以上は 時:分:秒', () => {
    expect(formatElapsed(3661)).toBe('1:01:01');
  });
});

describe('formatClock', () => {
  it('24時間 H:MM', () => {
    expect(formatClock(new Date('2026-07-08T14:32:00').getTime())).toBe('14:32');
    expect(formatClock(new Date('2026-07-08T09:05:00').getTime())).toBe('9:05');
  });
});

describe('useElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T14:32:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('null なら 0', () => {
    const { result } = renderHook(() => useElapsed(null));
    expect(result.current).toBe(0);
  });

  it('3秒進めると 3 を返す', () => {
    const start = Date.now();
    const { result } = renderHook(() => useElapsed(start));
    expect(result.current).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(result.current).toBe(3);
  });
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/lib/housing/__tests__/useElapsed.test.ts`
Expected: FAIL（モジュール未定義）

- [ ] **Step 3: 実装**

```ts
// src/lib/housing/useElapsed.ts
import { useEffect, useState } from 'react';

/** startAt(epoch ms) からの経過秒。null なら 0。1秒ごとに再レンダーする。 */
export function useElapsed(startAt: number | null): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (startAt == null) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startAt]);
  if (startAt == null) return 0;
  return Math.max(0, Math.floor((Date.now() - startAt) / 1000));
}

/** 経過秒 → M:SS（60分以上は H:MM:SS）。 */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** epoch ms → 24時間表記 H:MM（ローカル時刻）。 */
export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/lib/housing/__tests__/useElapsed.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/useElapsed.ts src/lib/housing/__tests__/useElapsed.test.ts
rtk git commit -m "feat(housing): 見学経過時間の useElapsed/formatElapsed/formatClock を追加"
```

---

### Task 3: i18n — 紹介文リネーム＋新規キー（4言語）

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`（各 `housing.tour.nav` ブロックのみ textual 編集）

**Interfaces:**
- Produces: 以下のキーが4言語で存在:
  - `housing.tour.nav.dest.memo`（登録の「紹介文」に統一）/ `housing.tour.nav.dest.no_memo`
  - `housing.tour.nav.actions.view`（見学ボタン）/ `housing.tour.nav.actions.next`（次へ）
  - `housing.tour.nav.viewing.started_at`（{{time}}）/ `housing.tour.nav.viewing.elapsed`（{{elapsed}}）
  - 既存 `housing.tour.nav.actions.prev` / `housing.tour.nav.actions.complete` は流用。

- [ ] **Step 1: 各言語の `dest.memo` / `dest.no_memo` を書き換え**

ja: `"memo": "ひとことメモ"` → `"memo": "紹介文"` ／ `"no_memo": "メモはありません"` → `"no_memo": "紹介文はありません"`
en: `"memo": "Note"` → `"memo": "Description"` ／ `"no_memo": "No note"` → `"no_memo": "No description"`
ko: `"memo": "한 줄 메모"` → `"memo": "소개글"` ／ `"no_memo": "메모가 없습니다"` → `"no_memo": "소개글이 없습니다"`
zh: `"memo": "一句备注"` → `"memo": "介绍"` ／ `"no_memo": "没有备注"` → `"no_memo": "暂无介绍"`

- [ ] **Step 2: `actions` に `view` と `next` を追加**（各 `actions` ブロック内・既存 `prev`/`arrive_next`/`complete` は残す）

ja: `"view": "見学", "next": "次へ"`
en: `"view": "View", "next": "Next"`
ko: `"view": "견학", "next": "다음"`
zh: `"view": "参观", "next": "下一处"`

- [ ] **Step 3: `housing.tour.nav` 直下に `viewing` ブロックを追加**

ja: `"viewing": { "started_at": "{{time}} から見学中", "elapsed": "{{elapsed}} 経過" }`
en: `"viewing": { "started_at": "Viewing since {{time}}", "elapsed": "{{elapsed}} elapsed" }`
ko: `"viewing": { "started_at": "{{time}}부터 견학 중", "elapsed": "{{elapsed}} 경과" }`
zh: `"viewing": { "started_at": "{{time}} 起参观中", "elapsed": "已过 {{elapsed}}" }`

- [ ] **Step 4: parity 確認（4言語で同一キー構造）**

Run: `node -e "for(const l of ['ja','en','ko','zh']){const n=require('./src/locales/'+l+'.json').housing.tour.nav; console.log(l, !!n.viewing?.started_at, !!n.actions.view, !!n.actions.next, JSON.stringify(n.dest.memo));}"`
Expected: 各言語 `true true true "<紹介文訳>"`

- [ ] **Step 5: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "i18n(housing): ツアー紹介文リネーム+見学ボタン/タイマー文言を4言語追加"
```

---

### Task 4: TourLivingMedia（生きたカードのメディア部分を抽出・共用）

**Files:**
- Create: `src/components/housing/tour/TourLivingMedia.tsx`
- Test: `src/components/housing/tour/__tests__/TourLivingMedia.test.tsx` (Create)

**Interfaces:**
- Consumes: `useHousingCardPlayback`, `useHousingCardFrames`, `HousingCardAmbientSlideshow`, `HousingCardVideoOverlay`, `representativeImage`（既存・現行 TourShowcasePanel と同一）。
- Produces: `TourLivingMedia: React.FC<{ listing: MockListing; className?: string }>`。ルート `div.housing-tour-living-media`（+ 任意 className）に ref を張り、`img.housing-tour-living-media-img` + ambient slideshow + 動画 overlay を描画。

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/components/housing/tour/__tests__/TourLivingMedia.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
import { TourLivingMedia } from '../TourLivingMedia';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('TourLivingMedia', () => {
  it('画像とラッパーを描画し、複数画像で ambient slideshow が出る', () => {
    const multi = { ...MOCK_LISTINGS[0], imageMode: 'sns' as const, sourceImageUrls: ['https://x/a.jpg', 'https://x/b.jpg'] };
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <TourLivingMedia listing={multi} />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-living-media')).not.toBeNull();
    expect(container.querySelector('.housing-tour-living-media-img')).not.toBeNull();
    expect(container.querySelector('.housing-card-ambient-slideshow')).not.toBeNull();
  });

  it('className を付与できる', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <TourLivingMedia listing={MOCK_LISTINGS[0]} className="is-next" />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-living-media.is-next')).not.toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourLivingMedia.test.tsx`
Expected: FAIL（モジュール未定義）

- [ ] **Step 3: 実装**（現行 TourShowcasePanel のメディア部分をそのまま移設）

```tsx
// src/components/housing/tour/TourLivingMedia.tsx
import { useEffect, useRef } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { useHousingCardPlayback } from '../../../lib/housing/HousingPlaybackContext';
import { useHousingCardFrames } from '../../../lib/housing/useHousingCardFrames';
import { HousingCardAmbientSlideshow } from '../workspace/HousingCardAmbientSlideshow';
import { HousingCardVideoOverlay } from '../workspace/HousingCardVideoOverlay';

export interface TourLivingMediaProps {
  listing: MockListing;
  className?: string;
}

/**
 * 生きたカードの「メディア部分」(画像クロスフェード + 動画 spotlight)。
 * ツアー左パネルの現在カード(大)と次の目的地カード(小)で共用する。
 * 再生制御は HousingPlaybackProvider(cap1) 配下で行う想定。
 */
export const TourLivingMedia: React.FC<TourLivingMediaProps> = ({ listing, className }) => {
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

  return (
    <div className={`housing-tour-living-media${className ? ` ${className}` : ''}`} ref={mediaRef}>
      <img
        className="housing-tour-living-media-img"
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
  );
};
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourLivingMedia.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/tour/TourLivingMedia.tsx src/components/housing/tour/__tests__/TourLivingMedia.test.tsx
rtk git commit -m "refactor(housing): 生きたカードのメディア部を TourLivingMedia に抽出"
```

---

### Task 5: TourShowcasePanel を表示専用に刷新

**Files:**
- Modify: `src/components/housing/tour/TourShowcasePanel.tsx`（全面書き換え）
- Test: `src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx`（書き換え）

**Interfaces:**
- Consumes: `TourLivingMedia`（Task4）、`formatHousingAddress`、`useTranslation`、`TourStep`（`{ id, listing }`）。
- Produces: `TourShowcasePanel: React.FC<{ currentStep: TourStep | null; nextStep: TourStep | null; onOpenReport: () => void; }>`。
  - 操作系 props（currentIndex/isLast/onPrev/onPrimary）は**削除**。行き方・住所/サイズ/ワールドの個別 dl 行も削除。

- [ ] **Step 1: テストを書き換える**（失敗する状態にする）

```tsx
// src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourStep } from '../../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../../lib/housing/formatHousingAddress';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
import { TourShowcasePanel } from '../TourShowcasePanel';

const cur = MOCK_LISTINGS[0];   // Shirogane / size M / description あり
const nxt = MOCK_LISTINGS[1];
const curStep: TourStep = { id: cur.id, listing: cur };
const nextStep: TourStep = { id: nxt.id, listing: nxt };

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList);
  }
});

function renderPanel(props: Partial<Parameters<typeof TourShowcasePanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <HousingPlaybackProvider>
        <TourShowcasePanel currentStep={curStep} nextStep={nextStep} onOpenReport={() => {}} {...props} />
      </HousingPlaybackProvider>
    </I18nextProvider>,
  );
}

describe('TourShowcasePanel — 表示専用ショーケース', () => {
  it('住所＋サイズが1行に集約されて出る', () => {
    const { container } = renderPanel();
    const line = container.querySelector('.housing-tour-dest-addrsize')!;
    expect(line.textContent).toContain(formatHousingAddress(cur, 'ja'));
    expect(line.textContent).toContain(cur.size!);
  });

  it('DC/サーバーが1回だけ出る', () => {
    const { container } = renderPanel();
    expect(container.querySelectorAll('.housing-tour-dest-world')).toHaveLength(1);
  });

  it('紹介文ラベルが「紹介文」で本文が出る', () => {
    renderPanel();
    expect(screen.getByText('紹介文')).toBeInTheDocument();
    expect(screen.getByText(cur.description!)).toBeInTheDocument();
  });

  it('紹介文が空なら no_memo（紹介文はありません）', () => {
    const empty = { ...cur, description: undefined };
    renderPanel({ currentStep: { id: empty.id, listing: empty } });
    expect(screen.getByText('紹介文はありません')).toBeInTheDocument();
  });

  it('次の目的地カード(生きたメディア)が出る', () => {
    const { container } = renderPanel();
    const nextCard = container.querySelector('.housing-tour-dest-nextcard');
    expect(nextCard).not.toBeNull();
    expect(nextCard!.querySelector('.housing-tour-living-media')).not.toBeNull();
  });

  it('nextStep=null（最後の目的地）では次の目的地カードが出ない', () => {
    const { container } = renderPanel({ nextStep: null });
    expect(container.querySelector('.housing-tour-dest-nextcard')).toBeNull();
  });

  it('操作ボタン(前へ/次へ)と行き方は左パネルに無い', () => {
    const { container } = renderPanel();
    expect(screen.queryByRole('button', { name: '前へ' })).toBeNull();
    expect(container.querySelector('.housing-tour-dest-route')).toBeNull();
    expect(container.querySelector('.housing-tour-dest-actions')).toBeNull();
  });

  it('報告ボタンで onOpenReport が呼ばれる', () => {
    const onOpenReport = vi.fn();
    renderPanel({ onOpenReport });
    screen.getByRole('button', { name: '情報が違う・報告する' }).click();
    expect(onOpenReport).toHaveBeenCalledTimes(1);
  });

  it('currentStep=null でもクラッシュせず報告ボタンは出る', () => {
    const { container } = renderPanel({ currentStep: null });
    expect(screen.getByRole('button', { name: '情報が違う・報告する' })).toBeInTheDocument();
    expect(container.querySelector('.housing-tour-dest-card')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx`
Expected: FAIL（新 props/クラス未実装）

- [ ] **Step 3: TourShowcasePanel を実装**（全面差し替え）

```tsx
// src/components/housing/tour/TourShowcasePanel.tsx
import { useTranslation } from 'react-i18next';
import type { TourStep } from '../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { TourLivingMedia } from './TourLivingMedia';

export interface TourShowcasePanelProps {
  currentStep: TourStep | null;
  /** 次の目的地(生きたカードのメディアのみ)。最後の目的地では null。 */
  nextStep: TourStep | null;
  onOpenReport: () => void;
}

/**
 * 左カラム: 目的地ショーケース (表示専用)。
 * 見ている家の紹介に専念: 生きたカード画像 → タイトル → 住所+サイズ(1行) → DC/サーバー →
 * 紹介文(固定高スクロール) → 次の目的地カード(動く・情報なし) → 報告。
 * 操作(前へ/見学/次へ)と行き方は右パネル(TourProgressPanel)へ移設した。
 */
export const TourShowcasePanel: React.FC<TourShowcasePanelProps> = ({
  currentStep,
  nextStep,
  onOpenReport,
}) => {
  const { t, i18n } = useTranslation();
  const listing = currentStep?.listing ?? null;
  const isApartment = listing?.buildingType === 'apartment';

  return (
    <div className="housing-tour-dest">
      {listing && (
        <div className="housing-tour-dest-card">
          <TourLivingMedia listing={listing} />

          <div className="housing-tour-dest-head">
            <h2 className="housing-tour-dest-title">
              {listing.title?.trim() || formatHousingAddress(listing, i18n.language)}
            </h2>
            <p className="housing-tour-dest-addrsize">
              {formatHousingAddress(listing, i18n.language)}
              {!isApartment && listing.size ? ` ・ ${listing.size}` : ''}
            </p>
            <span className="housing-tour-dest-world">
              {listing.dc} / {listing.server}
            </span>
          </div>

          <div className="housing-tour-dest-intro">
            <span className="housing-tour-dest-intro-label">{t('housing.tour.nav.dest.memo')}</span>
            <div className="housing-tour-dest-intro-body">
              {listing.description?.trim()
                ? listing.description
                : t('housing.tour.nav.dest.no_memo')}
            </div>
          </div>

          {nextStep?.listing && (
            <div className="housing-tour-dest-nextcard">
              <TourLivingMedia listing={nextStep.listing} className="is-next" />
            </div>
          )}
        </div>
      )}

      <button type="button" className="housing-tour-dest-report" onClick={onOpenReport}>
        {t('housing.tour.nav.report_button')}
      </button>
    </div>
  );
};
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/tour/TourShowcasePanel.tsx src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx
rtk git commit -m "feat(housing): ツアー左パネルを表示専用ショーケースへ刷新(住所+サイズ1行/紹介文スクロール/次カード)"
```

---

### Task 6: TourRouteSteps を縦ステッパー（青丸＋伸びる青線）へ

**Files:**
- Modify: `src/components/housing/tour/TourRouteSteps.tsx`
- Test: `src/components/housing/tour/__tests__/TourRouteSteps.test.tsx`（更新）

**Interfaces:**
- Consumes: `stepStatus`, `isTourPlaceable`, `TourStep`, `formatHousingAddress`（変更なし）。
- Produces: props は現状維持（`{ steps: TourStep[]; currentIndex: number }`）。各 `li.housing-tour-steps-item--{status}` 内に `span.housing-tour-steps-dot`（青丸）を追加。連結線は CSS `::before`。既存の index 番号は撤去し dot に置換。

- [ ] **Step 1: 既存テストを確認し、更新テストを書く**

まず現行 `TourRouteSteps.test.tsx` を読み、status クラス検証は残す。dot 要素の存在と、index 数字表示の撤去を追加:

```tsx
// 追記/更新する主な assert（既存の describe に合わせて統合）
it('各ステップに青丸(dot)が付き、状態クラスが付与される', () => {
  // render(<TourRouteSteps steps={steps} currentIndex={1} />)
  // arrived / current / upcoming が steps の index に応じて付く
  // container.querySelectorAll('.housing-tour-steps-dot').length === steps.length
});
it('旧 index 数字(.housing-tour-steps-index)は撤去', () => {
  // container.querySelector('.housing-tour-steps-index') === null
});
```

（既存テストの render ヘルパ・import はそのまま流用。`.housing-tour-steps-item` の件数・status データ属性チェックは維持する。）

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourRouteSteps.test.tsx`
Expected: FAIL（dot 未実装 / index まだ存在）

- [ ] **Step 3: 実装**（`housing-tour-steps-index` を dot に置換）

`TourRouteSteps.tsx` の `<li>` 内、先頭の
```tsx
<span className="housing-tour-steps-index" aria-hidden="true">{index + 1}</span>
```
を
```tsx
<span className="housing-tour-steps-dot" aria-hidden="true" />
```
に置換。他（body/addr/note/status）は現状維持。連結線・色は CSS（Task10）で表現。

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourRouteSteps.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/tour/TourRouteSteps.tsx src/components/housing/tour/__tests__/TourRouteSteps.test.tsx
rtk git commit -m "feat(housing): ルートのステップを縦ステッパー(青丸)へ・index数字を撤去"
```

---

### Task 7: TourPhaseZone（移動中=行き方 / 見学中=タイマー）

**Files:**
- Create: `src/components/housing/tour/TourPhaseZone.tsx`
- Test: `src/components/housing/tour/__tests__/TourPhaseZone.test.tsx` (Create)

**Interfaces:**
- Consumes: `useElapsed`/`formatElapsed`/`formatClock`（Task2）、`PlotDirections`（`{ aetheryte, directions }`）、`useTranslation`。
- Produces: `TourPhaseZone: React.FC<{ phase: 'moving' | 'viewing'; directions: PlotDirections | null; viewStartAt: number | null; }>`。
  - moving: `directions` があれば `.housing-tour-phasezone-route`（テレポ＋徒歩）。無ければ何も出さない（枠だけ）。
  - viewing: `.housing-tour-phasezone-timer` に `started_at`（formatClock）＋ `elapsed`（formatElapsed）。

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/components/housing/tour/__tests__/TourPhaseZone.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { TourPhaseZone } from '../TourPhaseZone';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});
afterEach(() => vi.useRealTimers());

describe('TourPhaseZone', () => {
  it('moving: 行き方(テレポ+徒歩)を出す', () => {
    const { container, getByText } = render(
      <I18nextProvider i18n={i18n}>
        <TourPhaseZone phase="moving" directions={{ aetheryte: 'ゴブレットビュート', directions: '西へ少し' }} viewStartAt={null} />
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-phasezone-route')).not.toBeNull();
    expect(getByText(/ゴブレットビュート/)).toBeInTheDocument();
    expect(getByText('西へ少し')).toBeInTheDocument();
    expect(container.querySelector('.housing-tour-phasezone-timer')).toBeNull();
  });

  it('moving + directions=null: タイマーも行き方も出さない', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TourPhaseZone phase="moving" directions={null} viewStartAt={null} />
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-phasezone-route')).toBeNull();
    expect(container.querySelector('.housing-tour-phasezone-timer')).toBeNull();
  });

  it('viewing: 開始時刻(14:32)と経過(0:00)を出す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T14:32:00'));
    const start = Date.now();
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TourPhaseZone phase="viewing" directions={null} viewStartAt={start} />
      </I18nextProvider>,
    );
    const timer = container.querySelector('.housing-tour-phasezone-timer')!;
    expect(timer.textContent).toContain('14:32');
    expect(timer.textContent).toContain('0:00');
  });
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourPhaseZone.test.tsx`
Expected: FAIL（モジュール未定義）

- [ ] **Step 3: 実装**

```tsx
// src/components/housing/tour/TourPhaseZone.tsx
import { useTranslation } from 'react-i18next';
import type { PlotDirections } from '../../../lib/housing/wardDirections';
import { useElapsed, formatElapsed, formatClock } from '../../../lib/housing/useElapsed';

export interface TourPhaseZoneProps {
  phase: 'moving' | 'viewing';
  /** 移動中に出す行き方。無ければ枠のみ。 */
  directions: PlotDirections | null;
  /** 見学開始の epoch ms（viewing のとき非 null 想定）。 */
  viewStartAt: number | null;
}

/**
 * 右パネルのフェーズ枠。ボタンのすぐ上で、フェーズにより中身が入れ替わる。
 * 移動中 = 行き方(テレポ+徒歩) / 見学中 = 見学タイマー(開始時刻+経過)。
 */
export const TourPhaseZone: React.FC<TourPhaseZoneProps> = ({ phase, directions, viewStartAt }) => {
  const { t } = useTranslation();
  const elapsed = useElapsed(phase === 'viewing' ? viewStartAt : null);

  if (phase === 'viewing' && viewStartAt != null) {
    return (
      <div className="housing-tour-phasezone housing-tour-phasezone-timer" data-testid="tour-phase-timer">
        <span className="housing-tour-phasezone-timer-started">
          {t('housing.tour.nav.viewing.started_at', { time: formatClock(viewStartAt) })}
        </span>
        <span className="housing-tour-phasezone-timer-elapsed">
          {t('housing.tour.nav.viewing.elapsed', { elapsed: formatElapsed(elapsed) })}
        </span>
      </div>
    );
  }

  if (!directions) {
    return <div className="housing-tour-phasezone housing-tour-phasezone-empty" aria-hidden="true" />;
  }

  return (
    <div className="housing-tour-phasezone housing-tour-phasezone-route">
      <span className="housing-tour-phasezone-route-label">{t('housing.tour.nav.dest.directions')}</span>
      <p className="housing-tour-phasezone-route-teleport">
        {t('housing.tour.nav.dest.teleport_to', { aetheryte: directions.aetheryte })}
      </p>
      {directions.directions && (
        <p className="housing-tour-phasezone-route-walk">{directions.directions}</p>
      )}
    </div>
  );
};
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourPhaseZone.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/tour/TourPhaseZone.tsx src/components/housing/tour/__tests__/TourPhaseZone.test.tsx
rtk git commit -m "feat(housing): フェーズ枠 TourPhaseZone(移動中=行き方/見学中=タイマー)"
```

---

### Task 8: TourProgressPanel を司令塔に刷新（リング横並び＋フェーズ枠＋操作3ボタン）

**Files:**
- Modify: `src/components/housing/tour/TourProgressPanel.tsx`（全面書き換え）
- Test: `src/components/housing/tour/__tests__/TourProgressPanel.test.tsx`（書き換え）

**Interfaces:**
- Consumes: `ProgressRing`, `TourRouteSteps`, `TourPhaseZone`（Task7）, `TourProgress`, `TourStep`, `PlotDirections`。
- Produces: `TourProgressPanel: React.FC<{ progress; steps; currentIndex; phase; viewStartAt; directions; canView; isLast; onPrev; onViewStart; onNext; onFinish; }>`。
  - `phase: 'moving' | 'viewing'`, `viewStartAt: number | null`, `directions: PlotDirections | null`, `canView: boolean`, `isLast: boolean`, `onPrev/onViewStart/onNext/onFinish: () => void`。

- [ ] **Step 1: テストを書き換える**

```tsx
// src/components/housing/tour/__tests__/TourProgressPanel.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourProgress, TourStep } from '../../../../lib/housing/tourNav';
import { TourProgressPanel } from '../TourProgressPanel';

const a = MOCK_LISTINGS[0];
const b = MOCK_LISTINGS[1];
const baseProgress: TourProgress = {
  total: 5, arrivedCount: 2, remainingCount: 3, percent: 40,
  currentStep: { id: a.id, listing: a }, recent: [{ id: b.id, listing: b }],
};
const steps: TourStep[] = [{ id: a.id, listing: a }, { id: b.id, listing: b }];

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPanel(props: Partial<Parameters<typeof TourProgressPanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourProgressPanel
        progress={baseProgress} steps={steps} currentIndex={0}
        phase="moving" viewStartAt={null}
        directions={{ aetheryte: 'ゴブレットビュート', directions: '西へ少し' }}
        canView={true} isLast={false}
        onPrev={() => {}} onViewStart={() => {}} onNext={() => {}} onFinish={() => {}}
        {...props}
      />
    </I18nextProvider>,
  );
}

describe('TourProgressPanel — 進捗＋操作', () => {
  it('percent と 済/残 が横並び行に出る', () => {
    const { container } = renderPanel();
    expect(screen.getByText('40% 完了')).toBeInTheDocument();
    expect(container.querySelector('.housing-tour-progress-summary')).not.toBeNull();
  });

  it('縦ステッパー(ルートのステップ)が steps 件数分出る', () => {
    const { container } = renderPanel();
    expect(container.querySelectorAll('.housing-tour-steps-item')).toHaveLength(steps.length);
  });

  it('moving では行き方、viewing ではタイマーがフェーズ枠に出る', () => {
    const { container, rerender } = renderPanel();
    expect(container.querySelector('.housing-tour-phasezone-route')).not.toBeNull();
    rerender(
      <I18nextProvider i18n={i18n}>
        <TourProgressPanel
          progress={baseProgress} steps={steps} currentIndex={0}
          phase="viewing" viewStartAt={new Date('2026-07-08T14:32:00').getTime()}
          directions={null} canView={true} isLast={false}
          onPrev={() => {}} onViewStart={() => {}} onNext={() => {}} onFinish={() => {}}
        />
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-phasezone-timer')).not.toBeNull();
  });

  it('前へ: currentIndex===0 で disabled、それ以外で onPrev', () => {
    const onPrev = vi.fn();
    renderPanel({ onPrev, currentIndex: 0 });
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled();
  });

  it('見学: canView=true で押せて onViewStart、canView=false で disabled', () => {
    const onViewStart = vi.fn();
    const { rerender } = renderPanel({ onViewStart, canView: true });
    screen.getByRole('button', { name: '見学' }).click();
    expect(onViewStart).toHaveBeenCalledTimes(1);
    rerender(
      <I18nextProvider i18n={i18n}>
        <TourProgressPanel
          progress={baseProgress} steps={steps} currentIndex={0}
          phase="moving" viewStartAt={null} directions={null}
          canView={false} isLast={false}
          onPrev={() => {}} onViewStart={onViewStart} onNext={() => {}} onFinish={() => {}}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('button', { name: '見学' })).toBeDisabled();
  });

  it('次へ: 通常は「次へ」ラベルで onNext、isLast では「ツアーを完了」', () => {
    const onNext = vi.fn();
    const { rerender } = renderPanel({ onNext, isLast: false });
    screen.getByRole('button', { name: '次へ' }).click();
    expect(onNext).toHaveBeenCalledTimes(1);
    rerender(
      <I18nextProvider i18n={i18n}>
        <TourProgressPanel
          progress={baseProgress} steps={steps} currentIndex={0}
          phase="moving" viewStartAt={null} directions={null}
          canView={true} isLast={true}
          onPrev={() => {}} onViewStart={() => {}} onNext={onNext} onFinish={() => {}}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('button', { name: 'ツアーを完了' })).toBeInTheDocument();
  });

  it('ツアーを終了で onFinish', () => {
    const onFinish = vi.fn();
    renderPanel({ onFinish });
    screen.getByRole('button', { name: 'ツアーを終了' }).click();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourProgressPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装**（全面差し替え）

```tsx
// src/components/housing/tour/TourProgressPanel.tsx
import { useTranslation } from 'react-i18next';
import { ProgressRing } from './ProgressRing';
import { TourRouteSteps } from './TourRouteSteps';
import { TourPhaseZone } from './TourPhaseZone';
import type { TourProgress, TourStep } from '../../../lib/housing/tourNav';
import type { PlotDirections } from '../../../lib/housing/wardDirections';

export interface TourProgressPanelProps {
  progress: TourProgress;
  steps: TourStep[];
  currentIndex: number;
  phase: 'moving' | 'viewing';
  viewStartAt: number | null;
  directions: PlotDirections | null;
  /** 見学ボタンを押せるか(=現在の家が表示できる)。 */
  canView: boolean;
  isLast: boolean;
  onPrev: () => void;
  onViewStart: () => void;
  onNext: () => void;
  onFinish: () => void;
}

/**
 * 右カラム: 進行状況＋操作の司令塔 (表示専用)。
 * リング＋軒数(横並び) → 縦ステッパー → フェーズ枠(移動中=行き方/見学中=タイマー) →
 * 操作3ボタン(前へ/見学/次へ) → ツアーを終了。
 */
export const TourProgressPanel: React.FC<TourProgressPanelProps> = ({
  progress, steps, currentIndex, phase, viewStartAt, directions,
  canView, isLast, onPrev, onViewStart, onNext, onFinish,
}) => {
  const { t } = useTranslation();
  const { total, arrivedCount, remainingCount, percent } = progress;

  return (
    <div className="housing-tour-progress">
      <div className="housing-tour-progress-head">
        <span className="housing-tour-progress-title">{t('housing.tour.nav.progress.label')}</span>
        <span className="housing-tour-progress-count">
          {t('housing.tour.nav.progress.done_of_total', { done: arrivedCount, total })}
        </span>
      </div>

      <div className="housing-tour-progress-summary">
        <ProgressRing percent={percent} />
        <div className="housing-tour-progress-stats">
          <div className="housing-tour-progress-stat">
            <span className="housing-tour-progress-stat-value">{arrivedCount}</span>
            <span className="housing-tour-progress-stat-label">{t('housing.tour.nav.progress.arrived')}</span>
          </div>
          <div className="housing-tour-progress-stat">
            <span className="housing-tour-progress-stat-value">{remainingCount}</span>
            <span className="housing-tour-progress-stat-label">{t('housing.tour.nav.progress.remaining')}</span>
          </div>
        </div>
      </div>

      <TourRouteSteps steps={steps} currentIndex={currentIndex} />

      <TourPhaseZone phase={phase} directions={directions} viewStartAt={viewStartAt} />

      <div className="housing-tour-progress-actions">
        <button
          type="button"
          className="housing-tour-progress-action housing-tour-progress-action--prev"
          onClick={onPrev}
          disabled={currentIndex === 0}
        >
          {t('housing.tour.nav.actions.prev')}
        </button>
        <button
          type="button"
          className="housing-tour-progress-action housing-tour-progress-action--view"
          onClick={onViewStart}
          disabled={!canView || phase === 'viewing'}
        >
          {t('housing.tour.nav.actions.view')}
        </button>
        <button
          type="button"
          className="housing-tour-progress-action housing-tour-progress-action--next"
          onClick={onNext}
        >
          {t(isLast ? 'housing.tour.nav.actions.complete' : 'housing.tour.nav.actions.next')}
        </button>
      </div>

      <button type="button" className="housing-tour-progress-finish" onClick={onFinish}>
        {t('housing.tour.nav.finish')}
      </button>
    </div>
  );
};
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourProgressPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/tour/TourProgressPanel.tsx src/components/housing/tour/__tests__/TourProgressPanel.test.tsx
rtk git commit -m "feat(housing): ツアー右パネルを司令塔化(リング横並び+フェーズ枠+操作3ボタン)"
```

---

### Task 9: TourNavPage の配線更新

**Files:**
- Modify: `src/components/housing/pages/TourNavPage.tsx`
- Test: `src/components/housing/pages/__tests__/TourNavPage.test.tsx`（更新）

**Interfaces:**
- Consumes: `useHousingTourStore`（`phase`/`viewStartAt`/`startViewing` 追加）、`getPlotDirections`、更新後の `TourShowcasePanel`/`TourProgressPanel`。
- Produces: 画面配線のみ（外部 API 変更なし）。

- [ ] **Step 1: 既存 NavPage テストを読み、更新点を洗い出す**

現行テストが旧 props（onPrimary 等）や旧 DOM を参照していれば、新配線に合わせて更新。最低限、以下を満たすテストにする:
- 見学ボタン押下 → `.housing-tour-phasezone-timer` が出る（viewing）。
- 次へ押下 → index 進行 & moving に戻る（行き方が再表示）。
- 最後の家で次へ → 完了画面（`housing.tour.nav.complete.title`）。

- [ ] **Step 2: 配線を実装**

`TourNavPage.tsx` を更新:

(a) store 購読に追加:
```tsx
const phase = useHousingTourStore((s) => s.phase);
const viewStartAt = useHousingTourStore((s) => s.viewStartAt);
const startViewing = useHousingTourStore((s) => s.startViewing);
```

(b) `getPlotDirections` を import し、行き方・次ステップ・見学可否を算出（`steps`/`currentListing` 既存を利用）:
```tsx
import { getPlotDirections } from '../../../lib/housing/wardDirections';
// ...
const nextStep = useMemo(
  () => (currentIndex + 1 < steps.length ? steps[currentIndex + 1] : null),
  [steps, currentIndex],
);
const directions = useMemo(
  () => getPlotDirections(currentListing?.area ?? '', currentListing?.plot),
  [currentListing],
);
const canView = currentListing != null;
```

(c) 左パネル配線を差し替え:
```tsx
<TourShowcasePanel
  currentStep={progress.currentStep}
  nextStep={nextStep}
  onOpenReport={onOpenReport}
/>
```

(d) 右パネル配線を差し替え:
```tsx
<TourProgressPanel
  progress={progress}
  steps={steps}
  currentIndex={currentIndex}
  phase={phase}
  viewStartAt={viewStartAt}
  directions={directions}
  canView={canView}
  isLast={isLast}
  onPrev={prev}
  onViewStart={startViewing}
  onNext={onPrimary}
  onFinish={onFinish}
/>
```

（`onPrimary` は既存のまま＝`isLast ? setCompleted(true) : next()`。`next()`/`prev()` はストア側で moving リセット済み。）

- [ ] **Step 3: テスト緑を確認**

Run: `npx vitest run src/components/housing/pages/__tests__/TourNavPage.test.tsx`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/housing/pages/TourNavPage.tsx src/components/housing/pages/__tests__/TourNavPage.test.tsx
rtk git commit -m "feat(housing): TourNavPage を新パネル配線(nextStep/phase/行き方/見学)へ更新"
```

---

### Task 10: CSS（housing.css）— 新レイアウトをトークン経由で

**Files:**
- Modify: `src/styles/housing.css`（ツアーパネルの該当ブロック周辺）

**Interfaces:**
- Consumes: 既存トークン `--housing-aether` / `--housing-aether-border` / `--housing-divider` / `--housing-text` / `--housing-text-mute` / `--housing-text-dim` / `--housing-panel-border` / `--housing-panel-inner` / `--housing-chip-bg` / `--housing-chip-bg-hover` / `--housing-text-sm|xs|lg`。
- Produces: 新クラスのスタイル。**色/影/フォントサイズは必ずトークン経由**。gap/radius 等の純レイアウト値は許容。

- [ ] **Step 1: 左パネル新クラスのCSSを追加**

- `.housing-tour-living-media`（`position:relative; overflow:hidden; border-radius:14px; aspect-ratio: 16/9;`）＋ `.housing-tour-living-media-img`（`width:100%;height:100%;object-fit:cover;`）。現行 `.housing-tour-dest-thumb-wrap`/`.housing-tour-dest-thumb` のスタイルを流用移植。
- `.housing-tour-dest-addrsize`（`font-size:var(--housing-text-sm); color:var(--housing-text-dim);`）。
- `.housing-tour-dest-intro`（縦積み）＋ `.housing-tour-dest-intro-label`（`font-size:var(--housing-text-xs); color:var(--housing-text-mute);`）＋ `.housing-tour-dest-intro-body`（**固定高スクロール**: `max-height: 96px; overflow-y:auto; font-size:var(--housing-text-sm); color:var(--housing-text); line-height:1.55;`）。
- `.housing-tour-dest-nextcard`（`.is-next` の `.housing-tour-living-media` を小さく: 例 `.housing-tour-dest-nextcard .housing-tour-living-media{ aspect-ratio: 16/7; }`）。区切りに `border-top:1px solid var(--housing-divider); padding-top:12px;`。
- `.housing-tour-dest` にコンテナ `gap`（例 `12px`）＝縦積みの余白リズム（0px 密着回避）。

- [ ] **Step 2: 右パネル新クラスのCSSを追加**

- `.housing-tour-progress-summary`（`display:flex; align-items:center; gap:14px;` ＝リングと済/残を横並び）。既存 `.housing-tour-progress-stats` は横並び内で `flex:1` に。
- 縦ステッパー: `.housing-tour-steps-list`（`position:relative`）、`.housing-tour-steps-item`（`position:relative; padding-left` でdot分の余白）、`.housing-tour-steps-dot`（`width/height:10px; border-radius:50%; background:var(--housing-divider);`）。連結線 `.housing-tour-steps-item:not(:last-child)::before`（dot 中心から下へ `1px` 縦線・`background:var(--housing-divider)`）。**到着済/現在は青**: `.housing-tour-steps-item--arrived .housing-tour-steps-dot`, `.housing-tour-steps-item--current .housing-tour-steps-dot { background:var(--housing-aether); }`、到着済の連結線 `--arrived::before{ background:var(--housing-aether); }` ＝「青線が下へ伸びる」。
- フェーズ枠: `.housing-tour-phasezone`（`min-height` で moving/viewing の高さブレを抑える、`border-top:1px solid var(--housing-divider); border-bottom:1px solid var(--housing-divider); padding:10px 0;`）。`.housing-tour-phasezone-timer`（縦積み、経過は `font-size:var(--housing-text-lg); font-variant-numeric:tabular-nums; color:var(--housing-text);`、開始時刻は `--housing-text-xs`/`--housing-text-mute`）。`.housing-tour-phasezone-route-*` は現行 `.housing-tour-dest-route-*` のスタイルを流用移植。
- 操作3ボタン: `.housing-tour-progress-actions`（`display:flex; gap:8px;`）＋ `.housing-tour-progress-action`（現行 `.housing-tour-dest-prev`/`.housing-tour-dest-primary` の見た目を流用。`--view` は主アクション寄り、`--next` は青=進行 `--housing-aether` 系、`--prev` は中立 `--housing-chip-bg`）。`:disabled{ opacity:.5; cursor:not-allowed; }`、`:active{ transform:scale(.98); }`。

- [ ] **Step 3: 旧クラスの不要 CSS を整理**

`TourShowcasePanel` から消えた `.housing-tour-dest-facts`/`-fact`/`-fact-label`/`-fact-value`/`-actions`/`-prev`/`-primary`/`-route*`（左側）・`.housing-tour-dest-thumb*` は、他で未使用なら削除。右へ移設した行き方は `.housing-tour-phasezone-route*` に集約。**grep で未使用確認してから削除**:
Run: `rtk grep "housing-tour-dest-facts\|housing-tour-dest-thumb\|housing-tour-dest-prev\|housing-tour-dest-primary" src/`

- [ ] **Step 4: ハードコード自己チェック**

Run: `rtk grep "rgb(\|rgba(\|#[0-9a-fA-F]\{3,8\}" src/components/housing/tour/`
Expected: コンポーネント側にリテラル色が無い（あれば housing.css のトークンへ）。CSS の literal は housing.css 内のみ許容。

- [ ] **Step 5: コミット**

```bash
rtk git add src/styles/housing.css
rtk git commit -m "style(housing): ツアー左右パネル新レイアウト(生きたメディア/紹介文スクロール/リング横並び/縦ステッパー/フェーズ枠/操作3ボタン)をトークン経由で"
```

---

### Task 11: 全体ビルド＋テスト緑の確認

**Files:** なし（検証のみ）

- [ ] **Step 1: 型＋ビルド**

Run: `npm run build`
Expected: EXIT 0（tsc -b で未使用 import/型エラーなし。削除した旧 props を参照している箇所が無いこと）

- [ ] **Step 2: 全テスト**

Run: `npx vitest run`
Expected: 新規/更新テスト緑。既知 legacy 失敗（TopBar4+HousingWorkspace1）以外の**新規 fail ゼロ**。

- [ ] **Step 3: ハウジングツアー関連のみ再確認**

Run: `npx vitest run src/components/housing/tour src/components/housing/pages/__tests__/TourNavPage.test.tsx src/store/__tests__/useHousingTourStore.test.ts src/lib/housing/__tests__/useElapsed.test.ts`
Expected: PASS

- [ ] **Step 4: 差分の最終レビュー（simplify/重複チェック）**

Run: `rtk git diff main --stat`
確認: TourLivingMedia 抽出で重複が減っているか、`representativeImage` 3重複が悪化していないか。

- [ ] **Step 5: ここで一旦停止 → ユーザーのローカル HMR 確認（新機能ゲート）**

ユーザーに `npm run dev` での目視確認を依頼（左パネル表示専用/右パネル司令塔/見学タイマー/縦ステッパー/フェーズ切替）。**DEV エディタの useEffect/リスナ変更のためハードリロード必須**を添える。OK を得てから main へ ff-merge + push（Vercel 自動デプロイ）。

---

## Self-Review

**1. Spec coverage（spec §3-§10 対応表）:**
- §3 左パネル（住所+サイズ1行/DC1回/紹介文スクロール/次カード/報告/操作・行き方撤去）→ Task5（＋Task4 メディア抽出）。✅
- §4 右パネル（リング横並び/縦ステッパー/フェーズ枠/操作3ボタン/終了）→ Task8（＋Task6 ステッパー、Task7 フェーズ枠）。✅
- §5 ストア（phase/viewStartAt/startViewing・next/prev/start/reset リセット）→ Task1。経過=表示側算出 → Task2。✅
- §6 用語（紹介文リネーム＋新規キー4言語）→ Task3。✅
- §7 触るファイル → Task1-10 で網羅。✅
- §8 テスト方針 → 各 Task の TDD ＋ Task11。✅
- §9 実装順 → Task 番号順（store→util→i18n→media→左→ステッパー→フェーズ枠→右→配線→CSS→検証）。✅
- §10 forward-compat → Task1 のストア設計（素の JSON）＋ Task2（経過は開始時刻から表示側算出）。✅
- 🐛枠線 → **対象外**（Global Constraints に明記）。✅

**2. Placeholder scan:** TBD/TODO なし。各コード step に実コード記載済み。CSS(Task10)は既存クラス流用の指示＋トークン列挙で具体化（新規リテラル色を作らない方針を明示）。

**3. Type consistency:** `phase: 'moving' | 'viewing'` / `viewStartAt: number | null` / `startViewing()` は Task1 定義、Task7/8/9 で同名同型使用。`TourShowcasePanelProps`（currentStep/nextStep/onOpenReport）Task5 定義＝Task9 使用一致。`TourProgressPanelProps`（progress/steps/currentIndex/phase/viewStartAt/directions/canView/isLast/onPrev/onViewStart/onNext/onFinish）Task8 定義＝Task9 使用一致。`useElapsed/formatElapsed/formatClock` Task2 定義＝Task7 使用一致。`PlotDirections`（aetheryte/directions）は既存型を Task7/8/9 で参照。i18n キー `actions.view`/`actions.next`/`viewing.started_at`/`viewing.elapsed`（Task3）＝Task7/8 使用一致。
