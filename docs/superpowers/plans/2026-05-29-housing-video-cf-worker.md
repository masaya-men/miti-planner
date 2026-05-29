# ハウジング動画プロキシ Cloudflare Worker 移設 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twitter 動画 (`video.twimg.com`) のプロキシを Vercel Edge Function から Cloudflare Worker (`media.lopoly.app`) に移設し、動画バイトが Vercel の Fast Origin Transfer を消費しないようにする。

**Architecture:** クライアントの `<video src>` を単一ヘルパー経由にし、env で参照先を切替可能化（既定=現状の Vercel `/api/tweet-video`、env セット時=CF Worker）。Worker は現行 `api/tweet-video.ts` の忠実な移植。LoPo 本体 (`lopoly.app`) は Vercel・DNS only のまま無変更。env を外せば即ロールバック。

**Tech Stack:** TypeScript / React 19 / Vite / Vitest (happy-dom, pool=vmThreads) / Cloudflare Workers (wrangler 4)

**設計書:** `docs/superpowers/specs/2026-05-29-housing-video-cf-worker-design.md`

**実行上の注意 (memory 由来):**
- vitest はハングしやすい。**特定ファイルだけ** `npx vitest run <path>` で実行し、**出力をパイプしない** (`reference_vitest_vmthreads_hang`)。
- push 前に `npm run build` (Vercel は `tsc -b` 厳密、未使用変数/型不足で落ちる ─ `feedback_vercel_tsc_strict`)。
- main への push は Vercel 自動デプロイ + 月100ビルド制限。コミットはまとめる (`feedback_vercel_builds` / `reference_vercel_git_autodeploy`)。

---

## Task 1: クライアント側プロキシ URL ヘルパー (env 切替 + 安全な既定)

**Files:**
- Create: `src/lib/housing/tweetVideoProxy.ts`
- Test: `src/lib/housing/__tests__/tweetVideoProxy.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/lib/housing/__tests__/tweetVideoProxy.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildTweetVideoProxyUrl } from '../tweetVideoProxy';

describe('buildTweetVideoProxyUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('既定では同一 origin の Vercel プロキシ path を返す', () => {
    const url = buildTweetVideoProxyUrl('https://video.twimg.com/x.mp4');
    expect(url).toBe(
      '/api/tweet-video?url=' + encodeURIComponent('https://video.twimg.com/x.mp4'),
    );
  });

  it('VITE_MEDIA_PROXY_BASE_URL がセットされていればそれを base に使う (Worker 切替)', () => {
    vi.stubEnv('VITE_MEDIA_PROXY_BASE_URL', 'https://media.lopoly.app');
    const url = buildTweetVideoProxyUrl('https://video.twimg.com/x.mp4');
    expect(url).toBe(
      'https://media.lopoly.app?url=' + encodeURIComponent('https://video.twimg.com/x.mp4'),
    );
  });

  it('空文字の env は無視して既定にフォールバックする', () => {
    vi.stubEnv('VITE_MEDIA_PROXY_BASE_URL', '');
    const url = buildTweetVideoProxyUrl('https://video.twimg.com/x.mp4');
    expect(url).toBe(
      '/api/tweet-video?url=' + encodeURIComponent('https://video.twimg.com/x.mp4'),
    );
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/housing/__tests__/tweetVideoProxy.test.ts`
Expected: FAIL（`tweetVideoProxy` モジュールが存在しない / `buildTweetVideoProxyUrl` 未定義）

- [ ] **Step 3: ヘルパーを実装**

Create `src/lib/housing/tweetVideoProxy.ts`:

```ts
/**
 * Twitter 動画プロキシの URL ビルダー (2026-05-29 新設)。
 *
 * 既定は同一 origin の Vercel Edge Function (`/api/tweet-video`)。
 * env `VITE_MEDIA_PROXY_BASE_URL` をセットすると Cloudflare Worker 等の
 * 別 origin に切替わる (= egress 無料化のための前段移設)。env を外す/空にする
 * だけで即 Vercel に戻せる (ロールバック)。
 *
 * base は `?url=<encoded>` を後置して使う前置き文字列:
 *   既定 : "/api/tweet-video"
 *   Worker: "https://media.lopoly.app"
 */
const DEFAULT_PROXY_BASE = '/api/tweet-video';

function proxyBase(): string {
  const fromEnv = import.meta.env.VITE_MEDIA_PROXY_BASE_URL;
  return typeof fromEnv === 'string' && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_PROXY_BASE;
}

export function buildTweetVideoProxyUrl(videoUrl: string): string {
  return `${proxyBase()}?url=${encodeURIComponent(videoUrl)}`;
}
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `npx vitest run src/lib/housing/__tests__/tweetVideoProxy.test.ts`
Expected: PASS（3 件）

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/tweetVideoProxy.ts src/lib/housing/__tests__/tweetVideoProxy.test.ts
git commit -m "feat(housing): 動画プロキシ URL ヘルパー追加 (env で Vercel↔CF Worker 切替)"
```

---

## Task 2: 3 つの呼び出し箇所をヘルパー経由に差し替え

**Files:**
- Modify: `src/components/housing/workspace/HousingCardVideoOverlay.tsx:22`
- Modify: `src/components/housing/listing/HousingPhotoGallery.tsx:110`
- Modify: `src/lib/housing/useTweetVideoFrames.ts:76`
- 既存テスト（変更不要、通過確認用）: `src/__tests__/housing/HousingCardVideoOverlay.test.tsx` / `src/lib/housing/__tests__/useTweetVideoFrames.test.tsx`

> 既存テストは `/api/tweet-video?url=...` 文字列を assert している。env 未設定時のヘルパー既定値が完全一致するため**テストは無改修で通る**。差し替え後に実行して確認する。

- [ ] **Step 1: HousingCardVideoOverlay を差し替え**

`src/components/housing/workspace/HousingCardVideoOverlay.tsx` の冒頭に import を追加:

```ts
import { buildTweetVideoProxyUrl } from '../../../lib/housing/tweetVideoProxy';
```

`:22` の行を置換:

```ts
// 置換前
    const proxied = `/api/tweet-video?url=${encodeURIComponent(props.videoUrl)}`;
// 置換後
    const proxied = buildTweetVideoProxyUrl(props.videoUrl);
```

- [ ] **Step 2: HousingPhotoGallery を差し替え**

`src/components/housing/listing/HousingPhotoGallery.tsx` の import 群に追加:

```ts
import { buildTweetVideoProxyUrl } from '../../../lib/housing/tweetVideoProxy';
```

`:110` の `src` を置換:

```tsx
// 置換前
              src={`/api/tweet-video?url=${encodeURIComponent(listing.videoUrl)}`}
// 置換後
              src={buildTweetVideoProxyUrl(listing.videoUrl)}
```

- [ ] **Step 3: useTweetVideoFrames を差し替え**

`src/lib/housing/useTweetVideoFrames.ts` の import に追加:

```ts
import { buildTweetVideoProxyUrl } from './tweetVideoProxy';
```

`:76` の行を置換:

```ts
// 置換前
    const proxied = `/api/tweet-video?url=${encodeURIComponent(videoUrl)}`;
// 置換後
    const proxied = buildTweetVideoProxyUrl(videoUrl);
```

- [ ] **Step 4: 関連テストを実行して通過を確認**

Run: `npx vitest run src/__tests__/housing/HousingCardVideoOverlay.test.tsx src/lib/housing/__tests__/useTweetVideoFrames.test.tsx src/lib/housing/__tests__/tweetVideoProxy.test.ts`
Expected: PASS（既定 env のためすべて `/api/tweet-video?url=...` で一致）

- [ ] **Step 5: 型チェック / ビルド**

Run: `npm run build`
Expected: 成功（`tsc -b` で未使用 import / 型エラーが無いこと。出力はパイプしない）

- [ ] **Step 6: コミット**

```bash
git add src/components/housing/workspace/HousingCardVideoOverlay.tsx src/components/housing/listing/HousingPhotoGallery.tsx src/lib/housing/useTweetVideoFrames.ts
git commit -m "refactor(housing): Twitter 動画 src を buildTweetVideoProxyUrl 経由に統一"
```

---

## Task 3: Cloudflare Worker プロジェクト作成 (`workers/media-proxy/`)

> `tsconfig.app.json` の include は `["src"]` のため、`workers/` は main ビルド (`tsc -b`) の対象外。Worker は独自 tsconfig / package.json を持つ独立プロジェクト。

**Files:**
- Create: `workers/media-proxy/wrangler.toml`
- Create: `workers/media-proxy/package.json`
- Create: `workers/media-proxy/tsconfig.json`
- Create: `workers/media-proxy/src/index.ts`

- [ ] **Step 1: wrangler.toml**

Create `workers/media-proxy/wrangler.toml`:

```toml
name = "lopo-media-proxy"
main = "src/index.ts"
compatibility_date = "2026-05-29"

# media.lopoly.app を Worker のカスタムドメインとして割り当てる。
# lopoly.app zone が同一 Cloudflare アカウントにある前提 (DNS only で載っていれば OK)。
# apex lopoly.app には影響しない (別 hostname の proxied レコードが作られるだけ)。
[[routes]]
pattern = "media.lopoly.app"
custom_domain = true
```

- [ ] **Step 2: package.json**

Create `workers/media-proxy/package.json`:

```json
{
  "name": "lopo-media-proxy",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4",
    "typescript": "~5.9.3",
    "wrangler": "^4"
  }
}
```

- [ ] **Step 3: tsconfig.json**

Create `workers/media-proxy/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Worker 本体 (api/tweet-video.ts の忠実移植)**

Create `workers/media-proxy/src/index.ts`:

```ts
/**
 * Cloudflare Worker — Twitter 動画 CDN プロキシ (2026-05-29 新設)。
 * LoPo の Vercel Edge Function `api/tweet-video.ts` を CF に移設したもの。
 *
 * 目的: 動画バイトを Vercel ではなく Cloudflare 経由で配り、Vercel の
 * Fast Origin Transfer (従量課金) を消費しないようにする (CF egress は無料)。
 *
 * - allowlist: video.twimg.com のみ (open proxy 化防止)
 * - UA 偽装: 独自 UA だと video.twimg.com が Range を無視し ~18KB しか返さない
 * - Range 透過 + 206/Content-Range 中継 (HTML5 video の seek 用)
 * - CORS: ACAO:* を全レスポンスで常時返す (frame 抽出 video.crossOrigin='anonymous'
 *   への対応 + 「CORS ヘッダ無しで HTTP cache に乗った応答が後続 CORS 要求を弾く」
 *   gotcha の回避)
 * - Cache-Control: s-maxage=86400 (CF エッジキャッシュ。egress 無料なので主目的は
 *   Twitter への取得回数削減と低レイテンシ)
 */
const ALLOWED_HOSTS = new Set<string>(['video.twimg.com']);
const TIMEOUT_MS = 30_000;

const CORS_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Max-Age': '86400',
} as const;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_PREFLIGHT_HEADERS });
    }

    const url = new URL(req.url).searchParams.get('url');
    if (!url) return jsonError('url query param is required', 400);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return jsonError('invalid url', 400);
    }
    if (parsed.protocol !== 'https:') {
      return jsonError('only https upstream allowed', 400);
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return jsonError('upstream host not allowed', 403);
    }

    const upstreamHeaders = new Headers();
    upstreamHeaders.set('User-Agent', 'Mozilla/5.0 (compatible; LoPo/1.0)');
    const range = req.headers.get('range');
    if (range) upstreamHeaders.set('Range', range);

    let upstream: Response;
    try {
      upstream = await fetch(parsed.toString(), {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'TimeoutError') return jsonError('Upstream timeout', 504);
      return jsonError('Internal error', 500);
    }

    if (!upstream.ok && upstream.status !== 206) {
      return jsonError(`upstream ${upstream.status}`, upstream.status === 404 ? 404 : 502);
    }

    const headers = new Headers();
    for (const h of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');

    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
```

- [ ] **Step 5: 依存インストール + 型チェック**

Run:
```bash
cd workers/media-proxy && npm install && npm run typecheck
```
Expected: install 成功、`tsc --noEmit` がエラー無しで完了

- [ ] **Step 6: `.gitignore` に Worker の node_modules を確認**

`workers/media-proxy/node_modules` がコミット対象に入らないこと（リポジトリ既存の `node_modules` 無視で大抵カバーされる。`git status` で確認し、入っていれば `workers/media-proxy/node_modules/` を `.gitignore` に追記）。

- [ ] **Step 7: コミット**

```bash
git add workers/media-proxy/wrangler.toml workers/media-proxy/package.json workers/media-proxy/tsconfig.json workers/media-proxy/src/index.ts workers/media-proxy/package-lock.json
git commit -m "feat(infra): Twitter 動画プロキシの Cloudflare Worker を新設 (media-proxy)"
```

---

## Task 4: デプロイ + Cloudflare 設定 + 本番切替 (一部ユーザー操作)

> このタスクは Cloudflare アカウントとブラウザ承認が必要。`[USER]` はユーザー操作、`[Claude]` は Claude がシェルで実行。

- [ ] **Step 1: [USER] Cloudflare 認証**

`cd workers/media-proxy && npx wrangler login` を実行するとブラウザが開く → 表示されたアカウント (lopoly.app zone を持つアカウント) で承認。

- [ ] **Step 2: [Claude] Worker をデプロイ**

Run: `cd workers/media-proxy && npx wrangler deploy`
Expected: デプロイ成功。`media.lopoly.app` のカスタムドメインが作成される（数分で有効化）。`https://<worker>.workers.dev` の URL も出力される。

- [ ] **Step 3: [Claude] workers.dev URL で疎通テスト**

Run（実在する短い video.twimg.com mp4 URL を 1 つ用意して `<URL>` に入れる。テスト listing から取得可）:
```bash
curl -sI "https://<worker>.workers.dev/?url=$(python -c "import urllib.parse;print(urllib.parse.quote('<URL>'))")"
```
Expected: `HTTP/2 200`、`content-type: video/mp4`、`access-control-allow-origin: *`、`cache-control: public, max-age=86400, s-maxage=86400`

- [ ] **Step 4: [Claude] Range と CF キャッシュを確認**

Run（同 URL に Range を付けて 2 回）:
```bash
curl -sI -H "Range: bytes=0-99" "https://media.lopoly.app/?url=$(python -c "import urllib.parse;print(urllib.parse.quote('<URL>'))")"
```
Expected: 1 回目 `HTTP/2 206` + `content-range: bytes 0-99/...`。2 回目で `cf-cache-status: HIT`（または `EXPIRED`→`HIT`）。**`cf-cache-status: BYPASS`/`DYNAMIC` のままならキャッシュが効いていない → Task 4 末尾「未達時の対処」へ。**

- [ ] **Step 5: [USER] Vercel に env を設定して本番切替**

Vercel ダッシュボード → lopo プロジェクト → Settings → Environment Variables:
- Name: `VITE_MEDIA_PROXY_BASE_URL`
- Value: `https://media.lopoly.app`
- Environments: Production（必要なら Preview も）
- （`feedback_vercel_env_sensitive`: 機密ではないので sensitive 化は不要だが、プロジェクト方針に合わせる）

設定後、main へ次に push される際のビルドで反映される（または Vercel で再デプロイ）。

- [ ] **Step 6: [Claude/USER] 本番実機検証（設計書 §8）**

`VITE_MEDIA_PROXY_BASE_URL` 反映後の本番 `lopoly.app/housing` で:
1. Twitter 動画 listing の詳細を開く → 再生・シーク（途中まで飛ばす）が正常（mp4 冒頭が壊れない）。
2. ブラウザ DevTools Network で `<video>` の src が `media.lopoly.app` を向き、`200/206` で返る。Vercel (`/api/tweet-video`) へのリクエストが**消えている**。
3. 同じ動画を別タブで再生 → `cf-cache-status: HIT`。
4. （後の Task 5 で ambient ON 後）カードのフレーム抽出サムネが生成される＝canvas が tainted で throw しない（Console に CORS error が出ない）。
5. Vercel ダッシュボード Usage で Fast Origin Transfer の増加が止まる（数時間〜1日で傾向確認）。

- [ ] **Step 7: 検証メモを記録**

検証結果（cf-cache-status・Vercel 転送傾向・必要なら Worker のリクエスト数）を設計書末尾か `docs/.private/` に追記。問題なければ Task 5 へ。

**未達時の対処（Range × キャッシュが壊れる / cf-cache-status が HIT しない場合）:**
- まず `cf-cache-status` を確認。`DYNAMIC` 等でキャッシュされない場合、CF ダッシュボードで `media.lopoly.app` に対する Cache Rule（"Eligible for cache" + "Edge TTL: respect origin"）を追加（`[USER]` 操作、Claude が手順提示）。
- Range で頭が壊れる（`video.error` / moov box 欠落）場合、Worker 側で Range 付きリクエストは `Cache-Control: no-store` にし、no-range の full 取得のみキャッシュする方針に変更（`reference_vercel_edge_range_cache` の知見）。この場合 Worker `index.ts` を修正し再デプロイ。
- いずれも egress 無料化（= Vercel 転送ゼロ化）の主目的は Worker 移設だけで達成済み。キャッシュは取得回数削減の最適化なので、最悪キャッシュ無しでも目的は満たす。

---

## Task 5: 止血スイッチを解除（ギャラリー ambient 復帰）

> 検証（Task 4 Step 6）が全項目 OK になってから実施。

**Files:**
- Modify: `src/lib/housing/HousingPlaybackContext.tsx`

- [ ] **Step 1: フラグを true に戻す**

`src/lib/housing/HousingPlaybackContext.tsx` 内の `const GALLERY_AMBIENT_ENABLED = false;` を `true;` に変更。止血コメント（2026-05-29）は「Cloudflare 移設完了で復帰」と更新。

- [ ] **Step 2: 関連テスト + ビルド**

Run: `npx vitest run src/__tests__/housing src/lib/housing/__tests__`
Run: `npm run build`
Expected: いずれも成功

- [ ] **Step 3: [USER/Claude] 本番でギャラリー ambient + フレーム抽出を最終確認**

ギャラリーのスポットライト自動再生とカードの 3 フレーム抽出サムネが復活し、かつ `media.lopoly.app` 経由で動いている（Vercel 転送が増えない）こと。

- [ ] **Step 4: コミット**

```bash
git add src/lib/housing/HousingPlaybackContext.tsx
git commit -m "feat(housing): Cloudflare 移設完了に伴いギャラリー ambient 自動再生を復帰"
```

- [ ] **Step 5: TODO / memory 更新**

- `docs/TODO.md`「現在の状態」の Cloudflare 項目を「完了」へ移し `TODO_COMPLETED.md` へ。
- memory `project_cloudflare_caching_priority` に最終結果（HIT 率 / Vercel 転送停止の実測 / 残課題）を反映。

---

## Self-Review（計画作成者による確認結果）

**1. Spec coverage（設計書 §との対応）:**
- §2 スコープ（Twitter のみ・YouTube 対象外）→ Task 2 は Twitter src のみ差し替え、YouTube iframe は無変更で担保 ✓
- §5.1 Worker → Task 3 ✓ / §5.2 クライアント差し替え（3 箇所 + ヘルパー）→ Task 1,2 ✓ / §5.3 CORS・frame 抽出 → Worker の ACAO 常時返却 (Task 3) + 検証 (Task 4 Step6-4) ✓ / §5.4 ロールバック → env 既定フォールバック (Task 1) ✓
- §6 役割分担 → Task 4 に `[USER]`/`[Claude]` 明示 ✓ / §7 コスト → 検証で Worker リクエスト数も記録 (Task 4 Step7) ✓ / §8 検証計画 → Task 4 Step6 ✓ / §9 未検証（Range×cache・別ドメイン抽出・wrangler 完結）→ Task 4 の「未達時の対処」+ Step1-2 ✓
- 止血復帰（設計書 §5.4 後段）→ Task 5 ✓

**2. Placeholder scan:** `<URL>`/`<worker>` は検証コマンドの実値差し込み箇所（実 mp4 URL・デプロイ出力 URL）で、計画段階で確定できない外部値のため明示のプレースホルダとして許容。それ以外に TBD/TODO なし。

**3. Type consistency:** ヘルパー名 `buildTweetVideoProxyUrl` は Task 1 定義・Task 2 の 3 箇所で一致。env 名 `VITE_MEDIA_PROXY_BASE_URL` は Task 1 / Task 4 Step5 で一致。Worker 名 `lopo-media-proxy` は wrangler.toml / package.json で一致。

---

## Execution Handoff

実装の進め方は 2 通り（実行に入るときユーザーに選んでもらう）:
1. **Subagent-Driven (推奨)** — タスクごとに新しいサブエージェントを立て、各タスク間でレビュー。
2. **Inline Execution** — このセッションでまとめて実行し、チェックポイントでレビュー。
