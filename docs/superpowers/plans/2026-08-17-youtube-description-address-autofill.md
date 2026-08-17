# YouTube概要欄からの住所自動入力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks depend on each other in order (Task2 needs Task1's endpoint; Task3/5 need Task2's hook; Task4 needs Task3's type change) — execute sequentially, not in parallel.

**Goal:** When a user pastes a YouTube URL into the housing registration page or the ephemeral tour quick-add panel, fetch the video's description via a new backend proxy and auto-fill the address fields using the existing text-extraction logic already used for Twitter/OGP.

**Architecture:** A new standalone Edge Function (`api/youtube-meta.ts`, modeled on the existing `api/tweet-meta.ts`) proxies YouTube Data API v3 and always returns `{ description: string | null }` regardless of upstream failure. A new client hook (`useYoutubeFetch`) calls it. The shared `HousingRegisterSnsUrlField` component's YouTube case becomes async (matching Twitter/OGP's existing loading→success pattern) and now carries `description` in its payload. `RegisterPage` (create mode only) and `EphemeralAddPanel` feed that description into the existing `parseHousingFromText` pipeline — no new parsing logic. Both places gain a unified "couldn't read the address" message that now also covers Twitter/OGP failures where previously there was silence. The edit page (`HousingEditSourcePanel`) is untouched: it never touched addresses before and won't now.

**Tech Stack:** React + TypeScript, Vitest + Testing Library (`happy-dom`), Vercel Edge Functions, YouTube Data API v3, i18next (5 locales: ja/en/ko/zh/zh-Hant).

**Spec:** `docs/superpowers/specs/2026-08-17-youtube-description-address-autofill-design.md`

## Global Constraints

- `YOUTUBE_API_KEY` env var is server-side only, no `VITE_` prefix. Already present in `.env.local` for local dev; Vercel production value is added later by the user, not part of this plan.
- `api/youtube-meta.ts` must be `export const config = { runtime: 'edge' }` (matches `api/tweet-meta.ts`) — it must NOT go into the `api/housing` Node router (App Check requirement there would block the anonymous `EphemeralAddPanel` use case).
- `/api/youtube-meta` must always respond `200` with `{ description: string | null }`. Never propagate upstream HTTP error codes to the client — any failure (missing key, non-2xx from YouTube, timeout, malformed JSON) collapses to `description: null`.
- Cache header only on success (`description !== null`): `Cache-Control: s-maxage=3600, max-age=3600, stale-while-revalidate=86400` (both `s-maxage` and `max-age` per `.claude/rules/api-caching.md`). Failure responses get no cache header (must not cache a transient failure for an hour).
- `useYoutubeFetch`'s `status` only ever transitions `idle → loading → success` — it must never expose an `'error'` state to callers (deliberate simplification per spec's "失敗時の扱い"; differs from `useTweetFetch`/`useOgpFetch`).
- No dedicated unit test files for `api/youtube-meta.ts` or `useYoutubeFetch.ts` — this mirrors the existing, established precedent (`api/tweet-meta.ts` and `useTweetFetch.ts` have no dedicated tests either; coverage comes from the consuming component tests, which mock the hook).
- Housing UI text follows `.claude/rules/housing-design.md` (no colored alert boxes; reuse the existing `housing-error-text` class, don't invent new styling).
- i18n: every new user-facing string needs real translations in all 5 locale files (ja/en/ko/zh/zh-Hant), not placeholders.

---

### Task 1: Backend proxy `api/youtube-meta.ts`

**Files:**
- Create: `api/youtube-meta.ts`

**Interfaces:**
- Consumes: `applyRateLimitWeb` from `../src/lib/rateLimit.js`, `rejectIfPublicApiDisabledWeb` from `../src/lib/publicApiGuard.js` (both already exist, used verbatim as in `api/tweet-meta.ts`).
- Produces: `GET /api/youtube-meta?videoId=<11-char id>` → `200 { description: string | null }` (always 200; `400` only for a malformed/missing `videoId` param, matching `tweet-meta.ts`'s `id` validation).

- [ ] **Step 1: Write the file**

```ts
// api/youtube-meta.ts
// Vercel Edge Function — YouTube Data API v3 プロキシ
//
// YouTube 動画 ID を受け取り、概要欄テキスト (snippet.description) だけを返す。
// LoPo の housing 登録ページ/一時ツアー追加パネルの SNS URL → 自動入力機能が使う。
// tweet-meta.ts と同じ理由 (App Check 不要な匿名アクセス窓口が必要・Vercel Hobby の
// Node関数12個上限を避ける) で独立 Edge Function にする。
//
// 概要欄取得はベストエフォート: 動画が存在しない/非公開/APIキー未設定/クォータ超過/
// タイムアウトのいずれでも常に 200 + { description: null } を返す (呼び出し元はサムネイル
// 添付を続行するため、エラーを伝播させる必要がない)。

import { applyRateLimitWeb } from '../src/lib/rateLimit.js';
import { rejectIfPublicApiDisabledWeb } from '../src/lib/publicApiGuard.js';

export const config = { runtime: 'edge' };

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const TIMEOUT_MS = 10_000;

export default async function handler(req: Request): Promise<Response> {
  const disabled = rejectIfPublicApiDisabledWeb();
  if (disabled) return disabled;
  const limited = await applyRateLimitWeb(req, 60, 60_000, { scope: 'youtube-meta', globalMax: 600 });
  if (limited) return limited;

  const url = new URL(req.url);
  const videoId = url.searchParams.get('videoId');
  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return Response.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({ description: null });
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${apiKey}`;

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      return Response.json({ description: null });
    }
    const json = (await res.json()) as { items?: Array<{ snippet?: { description?: string } }> };
    const description = json.items?.[0]?.snippet?.description;
    if (!description) {
      return Response.json({ description: null });
    }
    return Response.json(
      { description },
      { headers: { 'Cache-Control': 's-maxage=3600, max-age=3600, stale-while-revalidate=86400' } },
    );
  } catch {
    return Response.json({ description: null });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors from the new file.

- [ ] **Step 3: Manual verification against the real YouTube API**

Run (uses the key already in `.env.local`, replace `YOUR_KEY` with its value, and `VIDEO_ID` with any real public YouTube video's 11-char ID):

```bash
node -e "
const key = 'YOUR_KEY';
fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=VIDEO_ID&key=' + key)
  .then(r => r.json())
  .then(j => console.log(j.items?.[0]?.snippet?.description ?? 'NO DESCRIPTION'));
"
```

Expected: prints the video's actual description text (confirms the key works and the response shape assumed in Step 1 is correct before wiring the rest of the feature on top of it).

- [ ] **Step 4: Commit**

```bash
git add api/youtube-meta.ts
git commit -m "feat(housing): add YouTube description proxy endpoint"
```

---

### Task 2: Client hook `useYoutubeFetch`

**Files:**
- Create: `src/lib/housing/useYoutubeFetch.ts`

**Interfaces:**
- Consumes: `/api/youtube-meta?videoId=...` (Task 1).
- Produces: `useYoutubeFetch()` → `{ status: 'idle' | 'loading' | 'success', data: { description: string | null } | null, fetchYoutubeMeta: (videoId: string) => void, cancel: () => void, reset: () => void }`. Exported type `YoutubeMetaData = { description: string | null }`.

- [ ] **Step 1: Write the file**

```ts
// src/lib/housing/useYoutubeFetch.ts
import { useState, useCallback, useRef } from 'react';

export interface YoutubeMetaData {
    description: string | null;
}

export type YoutubeFetchStatus = 'idle' | 'loading' | 'success';

/**
 * YouTube 概要欄取得 hook (useTweetFetch/useOgpFetch と同系統)。
 *
 * 概要欄取得はベストエフォートの補助機能 (サムネイル添付はこれに依存しない) のため、
 * useTweetFetch/useOgpFetch と違い status='error' を一切公開しない。API 呼び出しが
 * 何らかの理由で失敗しても description:null の success として扱い、呼び出し元
 * (RegisterPage/EphemeralAddPanel) は「description があるかないか」だけを見ればよい
 * (設計書 2026-08-17「失敗時の扱い」参照)。
 */
export function useYoutubeFetch() {
    const [status, setStatus] = useState<YoutubeFetchStatus>('idle');
    const [data, setData] = useState<YoutubeMetaData | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        setStatus('idle');
    }, []);

    const fetchYoutubeMeta = useCallback(async (videoId: string) => {
        controllerRef.current?.abort();
        const ctrl = new AbortController();
        controllerRef.current = ctrl;
        setStatus('loading');
        setData(null);
        try {
            const res = await fetch(`/api/youtube-meta?videoId=${encodeURIComponent(videoId)}`, {
                signal: ctrl.signal,
            });
            if (ctrl.signal.aborted) return;
            if (!res.ok) {
                setData({ description: null });
                setStatus('success');
                return;
            }
            const json = (await res.json()) as YoutubeMetaData;
            setData({ description: json.description ?? null });
            setStatus('success');
        } catch (e: unknown) {
            const err = e as { name?: string };
            if (err?.name === 'AbortError') return;
            setData({ description: null });
            setStatus('success');
        }
    }, []);

    const reset = useCallback(() => {
        cancel();
        setData(null);
        setStatus('idle');
    }, [cancel]);

    return { status, data, fetchYoutubeMeta, cancel, reset };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/housing/useYoutubeFetch.ts
git commit -m "feat(housing): add useYoutubeFetch hook"
```

---

### Task 3: `HousingRegisterSnsUrlField.tsx` — async YouTube fetch + loading indicator

**Files:**
- Modify: `src/components/housing/register/HousingRegisterSnsUrlField.tsx`
- Test: `src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx`
- i18n: `src/locales/ja.json`, `en.json`, `ko.json`, `zh.json`, `zh-Hant.json`

**Interfaces:**
- Consumes: `useYoutubeFetch` (Task 2).
- Produces: `YoutubeFetchedData` gains a `description: string | null` field. `onYoutubeFetched` is now called once, after the async fetch resolves, instead of synchronously.

- [ ] **Step 1: Add the i18n loading-text key (5 locales)**

In each locale file, inside `housing.register.snsUrl`, add a new key `youtube_fetching` right after the existing `"ogp_fetching"` line (keep trailing comma consistent with surrounding JSON).

`src/locales/ja.json` (near line 2211, after `"ogp_fetching": "ページ情報を取得中…",`):
```json
                "youtube_fetching": "動画情報を読み取り中…",
```

`src/locales/en.json` (near line 2190, after `"ogp_fetching": "Fetching page info…",`):
```json
                "youtube_fetching": "Fetching video info…",
```

`src/locales/ko.json` (near line 2155, after the `"ogp_fetching"` line):
```json
                "youtube_fetching": "동영상 정보를 가져오는 중…",
```

`src/locales/zh.json` (near line 2155, after the `"ogp_fetching"` line):
```json
                "youtube_fetching": "正在获取视频信息…",
```

`src/locales/zh-Hant.json` (near line 2155, after `"ogp_fetching": "正在取得頁面資訊…",`):
```json
                "youtube_fetching": "正在取得影片資訊…",
```

- [ ] **Step 2: Update the failing/changed test expectations first**

In `src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx`, add a `useYoutubeFetch` mock mirroring the existing `useTweetFetch` mock (lines 10-24), and rewrite the two YouTube tests (lines 68-90) to reflect async resolution:

```ts
const mockFetchYoutubeMeta = vi.fn();
const mockCancelYoutube = vi.fn();
const mockResetYoutube = vi.fn();
let youtubeState: any = {
    status: 'idle',
    data: null,
    fetchYoutubeMeta: mockFetchYoutubeMeta,
    cancel: mockCancelYoutube,
    reset: mockResetYoutube,
};
vi.mock('../../lib/housing/useYoutubeFetch', () => ({
    useYoutubeFetch: () => youtubeState,
}));
```

Add this block right after the existing `vi.mock('../../lib/housing/useTweetFetch', ...)` block (after line 24). In the `beforeEach` (lines 29-41), reset it too:

```ts
        mockFetchYoutubeMeta.mockClear();
        mockCancelYoutube.mockClear();
        mockResetYoutube.mockClear();
        youtubeState = {
            status: 'idle',
            data: null,
            fetchYoutubeMeta: mockFetchYoutubeMeta,
            cancel: mockCancelYoutube,
            reset: mockResetYoutube,
        };
```

Replace the two existing tests (lines 68-90, `'detects YouTube URL (youtu.be 形式)...'` and `'detects YouTube URL (watch?v= 形式)...'`) with:

```ts
    it('detects YouTube URL (youtu.be 形式) and calls fetchYoutubeMeta with the video id', () => {
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={() => {}} onOgpFetched={() => {}} />);
        const input = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(input, { target: { value: 'https://youtu.be/Ypg8w7Dmq9o?si=6-QZYvd0_Qqrk0pJ' } });
        expect(mockFetchYoutubeMeta).toHaveBeenCalledWith('Ypg8w7Dmq9o');
        // Twitter fetch は呼ばれない (YouTube に切替たため)
        expect(mockFetchTweet).not.toHaveBeenCalled();
    });

    it('YouTube概要欄取得成功後、onYoutubeFetchedがdescription込みで1回だけ呼ばれる', () => {
        const ytSpy = vi.fn();
        const { rerender } = render(
            <HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={ytSpy} onOgpFetched={() => {}} />,
        );
        const input = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
        expect(ytSpy).not.toHaveBeenCalled();

        youtubeState = { ...youtubeState, status: 'success', data: { description: 'Mist 3-15' } };
        rerender(
            <HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={ytSpy} onOgpFetched={() => {}} />,
        );

        expect(ytSpy).toHaveBeenCalledTimes(1);
        expect(ytSpy).toHaveBeenCalledWith({
            postUrl: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o',
            ogImageUrl: 'https://img.youtube.com/vi/Ypg8w7Dmq9o/hqdefault.jpg',
            videoId: 'Ypg8w7Dmq9o',
            description: 'Mist 3-15',
        });

        // 同じ data オブジェクトのままの再レンダリングでは再ディスパッチしない
        rerender(
            <HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={ytSpy} onOgpFetched={() => {}} />,
        );
        expect(ytSpy).toHaveBeenCalledTimes(1);
    });
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx`
Expected: FAIL — `mockFetchYoutubeMeta` not called (component still uses the old synchronous path), module `../../lib/housing/useYoutubeFetch` doesn't exist yet is fine since Task 2 already created it, but the component doesn't call it yet.

- [ ] **Step 4: Modify `HousingRegisterSnsUrlField.tsx`**

Update the `YoutubeFetchedData` interface (lines 8-12):

```ts
export interface YoutubeFetchedData {
    postUrl: string;
    ogImageUrl: string;
    videoId: string;
    description: string | null;
}
```

Add the import (near the other hook imports, line 4-5):

```ts
import { useYoutubeFetch, type YoutubeMetaData } from '../../../lib/housing/useYoutubeFetch';
```

Replace the vestigial local state (line 80, `const [, setYoutubeData] = useState<YoutubeFetchedData | null>(null);`) and add the hook + refs (near lines 79-93):

```ts
    const { status: youtubeStatus, data: youtubeData, fetchYoutubeMeta, reset: resetYoutube } = useYoutubeFetch();
    const { status, data, errorCode, fetchTweet, cancel, reset } = useTweetFetch();
    const {
        status: ogpStatus,
        data: ogpData,
        errorCode: ogpErrorCode,
        fetchOgp,
        reset: resetOgp,
    } = useOgpFetch();
    const dispatchedDataRef = useRef<TweetData | null>(null);
    const dispatchedOgpRef = useRef<OgpData | null>(null);
    const dispatchedYoutubeRef = useRef<YoutubeMetaData | null>(null);
    const youtubeRouteRef = useRef<{ postUrl: string; ogImageUrl: string; videoId: string } | null>(null);
```

(Remove the old `const [, setYoutubeData] = useState<YoutubeFetchedData | null>(null);` line entirely — it was write-only and unused for reading.)

Add a new effect, alongside the existing tweet/ogp dispatch effects (after the OGP effect, around line 112):

```ts
    // YouTube 概要欄取得成功時に親へ通知 (Twitter/OGP と同じ「1 result = 1 dispatch」ガード)。
    useEffect(() => {
        if (youtubeStatus !== 'success' || !youtubeData) return;
        if (dispatchedYoutubeRef.current === youtubeData) return;
        dispatchedYoutubeRef.current = youtubeData;
        const route = youtubeRouteRef.current;
        if (!route) return;
        onYoutubeFetched({ ...route, description: youtubeData.description });
    }, [youtubeStatus, youtubeData, onYoutubeFetched]);
```

Update the loading-status aggregation (line 124):

```ts
    const loading = status === 'loading' || ogpStatus === 'loading' || youtubeStatus === 'loading';
```

Update the `handleChange` switch (lines 133-186): replace `setYoutubeData(null)` with `resetYoutube()` in the `'empty'` and `'invalid'` cases, add `resetYoutube()` to the `'tweet'` and `'ogp'` cases, and rewrite the `'youtube'` case:

```ts
            case 'empty':
                setInvalidUrl(false);
                reset();
                resetOgp();
                resetYoutube();
                onYoutubeFetched(null);
                onOgpFetched(null);
                return;
            case 'youtube': {
                setInvalidUrl(false);
                reset();
                resetOgp();
                onOgpFetched(null);
                youtubeRouteRef.current = { postUrl: route.postUrl, ogImageUrl: route.ogImageUrl, videoId: route.videoId };
                dispatchedYoutubeRef.current = null;
                fetchYoutubeMeta(route.videoId);
                return;
            }
            case 'tweet':
                setInvalidUrl(false);
                resetYoutube();
                onYoutubeFetched(null);
                resetOgp();
                onOgpFetched(null);
                fetchTweet(route.tweetId);
                return;
            case 'ogp':
                setInvalidUrl(false);
                reset();
                resetYoutube();
                onYoutubeFetched(null);
                dispatchedOgpRef.current = null;
                fetchOgp(route.postUrl);
                return;
            case 'invalid':
                setInvalidUrl(true);
                resetYoutube();
                onYoutubeFetched(null);
                resetOgp();
                onOgpFetched(null);
```

Update the `useCallback` dependency array for `handleChange` (line 186) to include the new functions:

```ts
    }, [fetchTweet, reset, fetchOgp, resetOgp, resetYoutube, fetchYoutubeMeta, onYoutubeFetched, onOgpFetched]);
```

Add the loading indicator JSX, right after the existing `ogpStatus === 'loading'` block (after line 266):

```tsx
            {!suppressInlineFetchStatus && youtubeStatus === 'loading' && (
                <div className="housing-fetch-indicator">
                    <span className="housing-spinner" aria-hidden />
                    <span>{t('housing.register.snsUrl.youtube_fetching')}</span>
                </div>
            )}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx`
Expected: PASS (all tests, including the two rewritten YouTube ones).

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: no errors (this will also surface any other file that still constructs a literal `YoutubeFetchedData` without `description` — none are expected per the design doc's file survey, but fix any that appear).

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/register/HousingRegisterSnsUrlField.tsx src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json
git commit -m "feat(housing): fetch YouTube description asynchronously in the SNS URL field"
```

---

### Task 4: `RegisterPage.tsx` — wire description into address extraction + unified failure message

**Files:**
- Modify: `src/components/housing/pages/RegisterPage.tsx`
- Test: `src/components/housing/pages/__tests__/RegisterPage.test.tsx`
- i18n: `src/locales/ja.json`, `en.json`, `ko.json`, `zh.json`, `zh-Hant.json`

**Interfaces:**
- Consumes: `YoutubeFetchedData.description` (Task 3).
- Produces: new `addressExtractFailed` boolean surfaced as a `housing-error-text` paragraph before the address section, for `mode='create'` only (edit mode never triggers it, since it goes through a different code path — see Task scope note below).

- [ ] **Step 1: Add the i18n failure-message key (5 locales)**

Add a new key `address_extract_failed` as a sibling of `address_verify_note` in `housing.register`.

`src/locales/ja.json` (line 2083, right after `"address_verify_note": "自動入力された住所も、登録前に必ず確認してください",`):
```json
            "address_extract_failed": "住所を読み取れませんでした。下の欄で選択してください",
```

`src/locales/en.json` (find the `address_verify_note` line in `housing.register` and add right after):
```json
            "address_extract_failed": "Couldn't read the address. Please pick the fields below",
```

`src/locales/ko.json`:
```json
            "address_extract_failed": "주소를 읽지 못했습니다. 아래에서 선택해 주세요",
```

`src/locales/zh.json`:
```json
            "address_extract_failed": "无法读取地址。请在下方选择",
```

`src/locales/zh-Hant.json`:
```json
            "address_extract_failed": "無法讀取地址。請在下方選擇",
```

(Wording intentionally matches `housing.ephemeral.parse_error` verbatim per the design doc, just relocated under `housing.register`.)

- [ ] **Step 2: Write the failing tests first**

In `src/components/housing/pages/__tests__/RegisterPage.test.tsx`, add the `useYoutubeFetch` mock alongside the existing `tweetState`/`ogpState` mocks (after the `useOgpFetch` mock block, around line 90, before `import { RegisterPage } from '../RegisterPage';`):

```ts
const mockFetchYoutubeMeta = vi.fn();
const mockCancelYoutube = vi.fn();
const mockResetYoutube = vi.fn();
let youtubeState: any = {
  status: 'idle',
  data: null,
  fetchYoutubeMeta: mockFetchYoutubeMeta,
  cancel: mockCancelYoutube,
  reset: mockResetYoutube,
};
vi.mock('../../../../lib/housing/useYoutubeFetch', () => ({
  useYoutubeFetch: () => youtubeState,
}));
```

Add the matching reset into the top-level `beforeEach` (after the existing `ogpState = {...}` assignment around line 205):

```ts
    mockFetchYoutubeMeta.mockClear();
    mockCancelYoutube.mockClear();
    mockResetYoutube.mockClear();
    youtubeState = {
      status: 'idle',
      data: null,
      fetchYoutubeMeta: mockFetchYoutubeMeta,
      cancel: mockCancelYoutube,
      reset: mockResetYoutube,
    };
```

Now fix the pre-existing race-condition test that this change breaks: `'ツイートURL貼付(fetch pending)の直後にYouTube URLへ書き換えて代表が確定し、後から遅れてツイートの写真fetchが届いてもvideo_limitで拒否される'` (currently at line 1583). Immediately after the line `fireEvent.change(input, { target: { value: YOUTUBE_URL } });` (currently line 1621), insert the YouTube fetch's simulated resolution and a `rerender` so the "YouTube representative established" state exists before the late tweet fetch is simulated:

```ts
      // ユーザーが (低速回線で) 待たずに YouTube URL に書き換える → YouTube が代表として確定する。
      fireEvent.change(input, { target: { value: YOUTUBE_URL } });

      // YouTube の概要欄取得が (この URL については) 先に解決し、代表が確定する。
      youtubeState = {
        ...youtubeState,
        status: 'success',
        data: { description: null },
      };
      rerender(createTree());
```

(This replaces the immediately-following `rerender(createTree())` call that already exists after the `tweetState = {...}` assignment — leave that second `rerender(createTree())` in place as-is; it's what flushes the late tweet fetch. Just add the new block shown above between the `fireEvent.change` line and the existing `tweetState = {...}` assignment.)

Add two new tests in the same `describe` block as the race-condition test (reusing its local `createTree()` helper), right after it:

```ts
    it('YouTube URL貼付→概要欄取得成功で住所が自動入力される', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
      youtubeState = {
        ...youtubeState,
        status: 'success',
        data: { description: 'Mana / Adamantoise / Mist 3-15' },
      };
      rerender(createTree());

      await waitFor(() =>
        expect((screen.getByLabelText('データセンター') as HTMLSelectElement).value).toBe('Mana'),
      );
      expect((screen.getByLabelText('サーバー') as HTMLSelectElement).value).toBe('Adamantoise');
    });

    it('YouTube URL貼付→概要欄に住所が無いと失敗案内が表示される (Twitterでも同じ経路)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { rerender } = render(createTree());
      const input = screen.getByLabelText(jaTranslations.housing.register.snsUrl.label);

      fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
      youtubeState = {
        ...youtubeState,
        status: 'success',
        data: { description: 'よろしくお願いします' },
      };
      rerender(createTree());

      expect(
        await screen.findByTestId('housing-register-address-extract-failed'),
      ).toBeInTheDocument();
    });
```

Note: `rerender` needs to be captured from `render(createTree())` in the first new test too — use `const { rerender } = render(createTree());`.

- [ ] **Step 3: Run the tests to see the new ones fail**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx -t "YouTube"`
Expected: FAIL — `housing-register-address-extract-failed` testid doesn't exist yet, address fields aren't filled from YouTube yet.

- [ ] **Step 4: Modify `RegisterPage.tsx`**

Add the new state right after `addressConfirmed` (line 406):

```ts
  const [addressExtractFailed, setAddressExtractFailed] = useState(false);
```

In `handleAddressChange` (lines 466-474), reset the flag on manual edit:

```ts
  const handleAddressChange = (name: string, value: unknown) => {
    // ユーザーが住所を手編集したら、以降の SNS 再取得は復元 guard を外す
    // (通常の URL 貼付は全フィールド上書きに戻す)。
    restoreRefetchGuardRef.current = false;
    setAddress((prev) => ({ ...prev, [name]: value }));
    fieldState.userEdit(name, value);
    // 住所確認ゲート: 手編集は「住所が変わった」とみなし確認を解除する。
    setAddressConfirmed(false);
    setAddressExtractFailed(false);
  };
```

In `applyExtractedResult` (line 656, the `if (fills.length === 0) return;` line), change to:

```ts
      if (fills.length === 0) {
        setAddressExtractFailed(true);
        return;
      }
      setAddressExtractFailed(false);
      addressAppliedRef.current = true;
```

(This is the ONLY change needed to unify Twitter/OGP/YouTube failure messaging, since `handleTweetFetched` and `handleOgpFetched` already funnel through `applyExtractedAddress`/`applyExtractedResult`.)

In `handleYoutubeFetched` (lines 788-810), pass the description through and add the dependency:

```ts
  const handleYoutubeFetched = useCallback(
    (data: YoutubeFetchedData | null) => {
      if (!data) {
        setSnsCapture((prev) => (prev.youtube ? { ...prev, youtube: null } : prev));
        return;
      }
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      applyExtractedAddress(data.description ?? '');
      // YouTube は静止画リストと排他 (既存 validateImage の conflict_sources 制約は不変)。
      if (capturedVideoRef.current || sourceImageUrls.length > 0) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }
      capturedVideoRef.current = true;
      setSnsCapture({ tweetData: null, tweetSource: null, youtube: data, ogp: null });
      setSourcePostUrls((prev) => [...prev, data.postUrl]);
      setPostUrl((prev) => prev || data.postUrl);
    },
    [applyExtractedAddress, sourcePostUrls, sourceImageUrls.length, t],
  );
```

In the JSX (lines 1827-1833), add the failure message before `<RegisterSectionAddress>`:

```tsx
            <div ref={(el) => { sectionRefs.current.address = el; }} data-step-id="address">
              {addressExtractFailed && (
                <p className="housing-error-text" data-testid="housing-register-address-extract-failed">
                  {t('housing.register.address_extract_failed')}
                </p>
              )}
              <RegisterSectionAddress
                fieldState={fieldState}
                values={address}
                onChange={handleAddressChange}
              />
            </div>
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: PASS (full file — this also re-validates the fixed race-condition test and the whole existing suite for regressions).

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/pages/RegisterPage.tsx src/components/housing/pages/__tests__/RegisterPage.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json
git commit -m "feat(housing): auto-fill address from YouTube description on the register page, unify failure message across sources"
```

---

### Task 5: `EphemeralAddPanel.tsx` — replace the hardcoded YouTube stub with real extraction

**Files:**
- Modify: `src/components/housing/browse/EphemeralAddPanel.tsx`
- Test: `src/__tests__/housing/EphemeralAddPanel.test.tsx`

**Interfaces:**
- Consumes: `useYoutubeFetch` (Task 2).
- Produces: no new public interface — internal behavior change only (YouTube now goes through the same `applyParse` path as Twitter/OGP instead of always setting `parseError=true`).

- [ ] **Step 1: Write the failing tests first**

Add near the top of `src/__tests__/housing/EphemeralAddPanel.test.tsx` (after the existing imports, before `beforeAll`):

```ts
const mockFetchYoutubeMeta = vi.fn();
let youtubeState: any = {
  status: 'idle',
  data: null,
  fetchYoutubeMeta: mockFetchYoutubeMeta,
  cancel: vi.fn(),
  reset: vi.fn(),
};
vi.mock('../../lib/housing/useYoutubeFetch', () => ({
  useYoutubeFetch: () => youtubeState,
}));
```

Add a `beforeEach` reset (or extend the existing one at line 39-41):

```ts
  beforeEach(() => {
    useEphemeralListingsStore.getState().clear();
    mockFetchYoutubeMeta.mockClear();
    youtubeState = { status: 'idle', data: null, fetchYoutubeMeta: mockFetchYoutubeMeta, cancel: vi.fn(), reset: vi.fn() };
  });
```

Add two new tests at the end of the `describe('EphemeralAddPanel', ...)` block:

```ts
  it('⑥ YouTube URL貼付→概要欄取得成功で住所が自動入力される', () => {
    const { rerender } = wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    const urlInput = screen.getByLabelText('SNSのURLから');
    fireEvent.change(urlInput, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
    expect(mockFetchYoutubeMeta).toHaveBeenCalledWith('Ypg8w7Dmq9o');

    youtubeState = { ...youtubeState, status: 'success', data: { description: 'Mist 3-15' } };
    rerender(<I18nextProvider i18n={i18n}><EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} /></I18nextProvider>);

    expect((screen.getByLabelText('区') as HTMLInputElement).value).toBe('3');
    expect((screen.getByLabelText('番地') as HTMLInputElement).value).toBe('15');
  });

  it('⑦ YouTube URL貼付→概要欄に住所が無いとparse_error表示', () => {
    const { rerender } = wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    const urlInput = screen.getByLabelText('SNSのURLから');
    fireEvent.change(urlInput, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });

    youtubeState = { ...youtubeState, status: 'success', data: { description: null } };
    rerender(<I18nextProvider i18n={i18n}><EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} /></I18nextProvider>);

    expect(screen.getByText('住所を読み取れませんでした。下の欄で選択してください')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/__tests__/housing/EphemeralAddPanel.test.tsx -t "YouTube"`
Expected: FAIL — `mockFetchYoutubeMeta` never called (component still hardcodes `setParseError(true)`), address fields stay empty.

- [ ] **Step 3: Modify `EphemeralAddPanel.tsx`**

Add the import (near the other hook imports, line 7-8):

```ts
import { useYoutubeFetch, type YoutubeMetaData } from '../../../lib/housing/useYoutubeFetch';
```

Add the hook call and refs (near lines 67-74):

```ts
  const { status: tweetStatus, data: tweetData, fetchTweet, reset: resetTweet } = useTweetFetch();
  const { status: ogpStatus, data: ogpData, fetchOgp, reset: resetOgp } = useOgpFetch();
  const { status: youtubeStatus, data: youtubeData, fetchYoutubeMeta, reset: resetYoutube } = useYoutubeFetch();

  const dispatchedTweetRef = useRef<unknown>(null);
  const dispatchedOgpRef = useRef<unknown>(null);
  const dispatchedYoutubeRef = useRef<YoutubeMetaData | null>(null);
  const youtubeRouteRef = useRef<{ postUrl: string; ogImageUrl: string } | null>(null);
  const urlRef = useRef('');
```

Add a new effect, alongside the existing tweet/ogp effects (after the OGP effect, around line 148):

```ts
  // YouTube 取得成功 → 概要欄テキストを parse (tweet/ogp と同じ applyParse 経路)。
  useEffect(() => {
    if (youtubeStatus !== 'success' || !youtubeData) return;
    if (dispatchedYoutubeRef.current === youtubeData) return;
    dispatchedYoutubeRef.current = youtubeData;
    const route = youtubeRouteRef.current;
    if (route) {
      setSource({ postUrl: route.postUrl, ogImageUrl: route.ogImageUrl });
    }
    const result = parseHousingFromText(youtubeData.description ?? '');
    applyParse(result);
  }, [youtubeStatus, youtubeData, applyParse]);
```

Rewrite `handleUrlChange`'s switch cases (lines 156-187):

```ts
    switch (route.kind) {
      case 'empty':
        resetTweet();
        resetOgp();
        resetYoutube();
        setSource(null);
        setParseError(false);
        break;
      case 'youtube':
        resetTweet();
        resetOgp();
        youtubeRouteRef.current = { postUrl: route.postUrl, ogImageUrl: route.ogImageUrl };
        dispatchedYoutubeRef.current = null;
        fetchYoutubeMeta(route.videoId);
        break;
      case 'tweet':
        resetOgp();
        resetYoutube();
        dispatchedTweetRef.current = null;
        fetchTweet(route.tweetId);
        break;
      case 'ogp':
        resetTweet();
        resetYoutube();
        dispatchedOgpRef.current = null;
        fetchOgp(route.postUrl);
        break;
      case 'invalid':
        resetTweet();
        resetOgp();
        resetYoutube();
        setSource(null);
        setUrlInvalid(true);
        break;
    }
```

Update the doc comment above `applyParse` (lines 76-80) and the one above the URL field (line 45) to mention YouTube instead of describing it as text-less — replace:

```ts
   * - 上段 URL 欄: `classifySnsUrl` で種別ルーティング → ツイート本文 `parseHousingFromText` /
   *   OGP `extractHousingAddressFromPage`。取れた住所は下の構造化フォームへ自動入力 (🟡)。
```

with:

```ts
   * - 上段 URL 欄: `classifySnsUrl` で種別ルーティング → ツイート本文/YouTube概要欄
   *   `parseHousingFromText` / OGP `extractHousingAddressFromPage`。取れた住所は下の
   *   構造化フォームへ自動入力 (🟡)。
```

Update `handleAdd`'s success-reset block (lines 259-271) to also reset YouTube state:

```ts
    onAdd(listing.id);
    // 連続追加: 入力だけクリアしてモーダルは開いたまま (spec §4.1-5)。
    setUrl('');
    urlRef.current = '';
    setAddress({});
    fieldState.reset();
    setParseError(false);
    setUrlInvalid(false);
    setSource(null);
    resetTweet();
    resetOgp();
    resetYoutube();
    setLimitReached(false);
    setAdded(true);
```

Update the `fetching` derived variable (line 273):

```ts
  const fetching = tweetStatus === 'loading' || ogpStatus === 'loading' || youtubeStatus === 'loading';
```

Update the loading-text selection in the JSX (lines 307-318):

```tsx
          {fetching && (
            <div className="housing-fetch-indicator">
              <span className="housing-spinner" aria-hidden />
              <span>
                {t(
                  tweetStatus === 'loading'
                    ? 'housing.register.snsUrl.fetching'
                    : youtubeStatus === 'loading'
                      ? 'housing.register.snsUrl.youtube_fetching'
                      : 'housing.register.snsUrl.ogp_fetching',
                )}
              </span>
            </div>
          )}
```

(`fetchFailed` at line 274 stays unchanged — `useYoutubeFetch` never exposes `'error'` by design, so YouTube failures already surface through `parseError`, not `fetchFailed`.)

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/__tests__/housing/EphemeralAddPanel.test.tsx`
Expected: PASS (full file).

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/browse/EphemeralAddPanel.tsx src/__tests__/housing/EphemeralAddPanel.test.tsx
git commit -m "feat(housing): auto-fill address from YouTube description in the ephemeral add panel"
```

---

### Task 6: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: exits 0 (this runs `tsc -b` + `vite build`; catches any type/JSON-syntax issue across the 5 locale file edits made across Tasks 3-4).

- [ ] **Step 2: Targeted test run across everything touched**

Run: `npx vitest run src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx src/__tests__/housing/EphemeralAddPanel.test.tsx src/components/housing/pages/__tests__/RegisterPage.test.tsx src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx`
Expected: all PASS. The `HousingEditSourcePanel.test.tsx` run confirms the edit page truly regressed nothing (per the plan's scope decision, it should need zero code changes).

- [ ] **Step 3: Manual local verification (dev server)**

This cannot be automated — hand off to the user:
1. `npm run dev`, open the housing registration page while logged in.
2. Paste a real YouTube URL whose description contains a recognizable FF14 address (e.g. `DC / server / area ward-plot`) — confirm the "動画情報を読み取り中…" indicator appears briefly, then the address fields auto-fill.
3. Paste a YouTube URL with no address in its description — confirm the "住所を読み取れませんでした。下の欄で選択してください" message appears and no fields change.
4. Repeat both cases in the "住所からツアーに追加" (ephemeral) panel from the 探す/お気に入り page.
5. Confirm the edit page's YouTube URL field still only swaps the thumbnail/photo, with no change to address fields, and no new console errors.

- [ ] **Step 4: No commit needed for this task** (verification only; if Step 3 surfaces a bug, fix it as a new small commit before proceeding).
