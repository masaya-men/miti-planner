# Vercel CPU ダイエット Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本番 Vercel の Fluid Active CPU(無料枠 4h/月の 75%)を、既存機能を変えずに減らす。

**Architecture:** (1) 運営通知の取得をブラウザ内 1 か所に集約し再取得を 5 分に 1 回へ、(2) collab worker で ID トークン確認結果を短時間記憶して Vercel の verify 呼び出しを減らす、(3) sharp を使う action の中でだけ読み込みコールドスタートを軽くする、(4) og-cache の HIT 時の Storage 書き込みを 1 日 1 回に間引く、(5) /api/share の JSON GET のキャッシュ可否を判断する。

**Tech Stack:** React 19 + zustand 5(既存)/ Vercel Node Functions(TypeScript・api/ は strictNullChecks:false)/ Cloudflare Workers(workers/collab・partyserver)/ firebase-admin / sharp / vitest(root=vmThreads、workers/collab=@cloudflare/vitest-pool-workers)

**Spec:** 親エージェントの指示(2026-11-04 の会話・本書冒頭の Goal と各 Task の「決定」)。調査は 7c81233e(origin/main)で実施。行番号は全部このブランチで確認済み。

## Global Constraints

- Node の Vercel 関数を増やさない(12 個上限・記憶 reference_vercel_hobby_function_limit)。新規ファイルは必ず `_` 始まり or `api/_lib/` 配下 or `src/` 配下にする。
- api/ は strictNullChecks:false(`tsconfig.api.json:13`)。`!` や null 絞り込みに頼らない書き方でよい。
- テストは `__tests__/` 配下(root vitest の include = `api/**/__tests__/**/*.test.ts` ほか)。workers/collab は既存どおり `src/*.test.ts` に同居(そのパッケージの流儀)。
- 1 ファイル 1 仕事。ファイル名 = その仕事の名前。1 ファイル 500 行以下。
- Vercel は `s-maxage` をクライアント応答から除去する → Cloudflare/ブラウザに効く TTL は `max-age`(記憶 reference_vercel_cf_window_caching・`.claude/rules/api-caching.md` §1)。
- 検証コマンド: 対象テスト `rtk node node_modules/vitest/vitest.mjs run <対象>` / 型 `rtk npx tsc -b` / push 前のみ `npm run test:gate`。worker は `cd workers/collab && rtk npx vitest run <対象>` と `npm run typecheck`。
- worktree に `node_modules` が無い場合は親リポの node_modules への junction を作ってから実行(後片付けは記憶 reference_worktree_remove_junction_wipes_node_modules の手順)。
- commit は Task ごとに 1 つ(日本語メッセージ・末尾に Co-Authored-By 行)。並行実行時はエージェントに commit させず親が検収して commit。push/デプロイはまとめて 1 回(Vercel Hobby build 枠)。

## Review Focus

1. 運営通知: 取得が失敗したあと(オフライン復帰)に、5 分待たずに次の前面復帰で取り直せること → Task 1 の「失敗時は時刻を進めない」テスト。
2. 運営通知: 3 部品が同時にマウントされても fetch は 1 回、片方がアンマウントしても残りは更新を受け取ること → Task 1 のテスト。
3. collab: 期限切れ・壊れたトークン(exp 読めない)をキャッシュから通さないこと → Task 2 のテスト。
4. sharp: SVG 読み込みの無効化(GHSA-wq5f-xc86-pv6w)が遅延読み込み後も必ず効くこと → Task 3 で既存テスト `_imageFormatConvert.test.ts:73-78` を維持+og-cache 経路も同じ loader を通す。
5. og-cache: 画像が無い時(404)は従来どおり MISS で生成に進み、404 以外の Storage エラーは 500 のまま → Task 4 のテスト。

---

### Task 1: 運営通知の取得を 1 か所にまとめる + max-age を延ばす

**現状(確認済み):**
- `src/store/useSystemNotifications.ts:28-46` — フックを呼んだ部品ごとに `fetch('/api/template?action=public-notifications')` と `visibilitychange` リスナーを持つ。
- 呼び出し元 3 か所: `src/components/SystemNotificationBar.tsx:22`・`src/components/SystemNotificationHandleButton.tsx:20`・`src/components/military/MilspecNotifBeacon.tsx:21`(マウント元 = `SidebarFooterBars.tsx:23`・`SidebarHandle.tsx:28`・`MilspecSidebar.tsx:299`。/miti ではサイドバー閉時に Bar と HandleButton が同時に居る=1 回の表示で 2 本・前面復帰ごとに 2 本)。
- `api/template/_publicNotificationsHandler.ts:35` — `public, s-maxage=60, max-age=30`(Vercel が s-maxage を落とすので CF/ブラウザには max-age=30 だけが届く)。コメント `:7` も同値。

**決定:**
- 取得は新ファイル `src/store/systemNotificationsFeed.ts`(仕事 = 運営通知の取得と共有)に集約。部品から見たフックの戻り値(`UseSystemNotificationsResult`)は変えない。既読管理(localStorage)はフック側に残す。
- 同時に走る取得は 1 本に束ねる(実行中の Promise を共有)。
- 最後に**成功した**取得から 5 分未満なら、マウント時も前面復帰時も取りに行かない。初回(成功記録なし)は必ず取る。失敗時は時刻を進めない。
- `visibilitychange` リスナーは購読者が 1 人以上いる間だけ 1 個。
- サーバー: `Cache-Control: public, s-maxage=300, max-age=300`(コメント `:7` も同じ値に更新)。
- **新しい通知が見えるまでの遅れの上限**: 開きっぱなしのタブ = 前回成功から 5 分経過後の次の前面復帰/マウント時(クライアントの間引き)。ブラウザ HTTP キャッシュ max-age=300 は前回取得が 5 分前なので期限切れ=重ならない。Cloudflare に public-notifications 向け Cache Rule が**ある場合**は CF の残り TTL(最大 300 秒)が加わり **最悪 約 10 分**。ルールが無ければ **最悪 約 5 分**(+前面復帰を待つ時間)。新しくページを開いた人は CF の残り TTL 分(最大 5 分)だけ。

**Files:**
- Create: `src/store/systemNotificationsFeed.ts`
- Modify: `src/store/useSystemNotifications.ts:8-46`(取得部分を feed 購読に置換・既読部分 `:48-65` はそのまま)
- Modify: `api/template/_publicNotificationsHandler.ts:7,35`
- Create: `src/store/__tests__/systemNotificationsFeed.test.ts`
- Modify: `src/store/__tests__/useSystemNotifications.test.ts:9-12`(beforeEach で feed をリセット)
- Create: `api/template/__tests__/publicNotificationsHandler.test.ts`(既存 `publicTemplateHandler.test.ts` のモック方式を写す)

**Interfaces:**
- Produces(`src/store/systemNotificationsFeed.ts`):
  - `export const NOTIFICATIONS_MIN_REFETCH_MS = 5 * 60_000;`
  - `export function getSystemNotificationsSnapshot(): SystemNotification[]`(同じ配列参照を返す=useSyncExternalStore 用)
  - `export function subscribeSystemNotifications(onChange: () => void): () => void`(最初の購読で visibilitychange 登録+`refreshSystemNotifications()`、最後の解除でリスナー削除)
  - `export function refreshSystemNotifications(): Promise<void>`(5 分ルール+実行中共有)
  - `export function __resetSystemNotificationsFeedForTest(): void`
- Consumes: なし。フックは `useSyncExternalStore(subscribeSystemNotifications, getSystemNotificationsSnapshot)` で items を得る。

- [ ] **Step 1: 失敗するテストを書く**(`src/store/__tests__/systemNotificationsFeed.test.ts`、`// @vitest-environment happy-dom`、`vi.useFakeTimers()`+`vi.setSystemTime`、beforeEach で `__resetSystemNotificationsFeedForTest()`)
  - `'3 部品が同時にマウントしても fetch は 1 回'`: `renderHook(() => useSystemNotifications())` を 3 つ → `expect(fetch).toHaveBeenCalledTimes(1)`、3 つとも `items.length === 2`。
  - `'前面復帰が前回成功から 5 分未満なら取りに行かない'`: 初回取得後 `setSystemTime(+4分59秒)` → `document.dispatchEvent(new Event('visibilitychange'))`(visibilityState='visible' に stub)→ `toHaveBeenCalledTimes(1)`。
  - `'5 分以上たった前面復帰では取り直す'`: `+5分` → `toHaveBeenCalledTimes(2)`。
  - `'失敗した取得は時刻を進めない'`: 1 回目 reject → 直後の visibilitychange で 2 回目が走る。
  - `'1 部品がアンマウントしても残りは更新を受け取る'`: 2 つマウント → 1 つ unmount → 5 分後の前面復帰で新しい items が残り 1 つに届く。
  - `'購読者が 0 になったら visibilitychange を外す'`: 全 unmount 後の dispatch で fetch が増えない。
  - API 側 `publicNotificationsHandler.test.ts`: `'Cache-Control は max-age=300'` → `expect(headers['Cache-Control']).toBe('public, s-maxage=300, max-age=300')`。
- [ ] **Step 2: 失敗を確認** — `rtk node node_modules/vitest/vitest.mjs run src/store/__tests__/systemNotificationsFeed.test.ts api/template/__tests__/publicNotificationsHandler.test.ts` → FAIL(モジュール無し / 値 `max-age=30`)。
- [ ] **Step 3: 実装** — feed 作成・フック置換・ハンドラの値変更。
- [ ] **Step 4: 通過を確認** — 上の 2 ファイル+`src/store/__tests__/useSystemNotifications.test.ts`+`src/components/__tests__/SystemNotificationBar.test.tsx`+`src/components/military/__tests__/MilspecNotifBeacon.test.tsx` が PASS、`rtk npx tsc -b` exit 0。
- [ ] **Step 5: Commit** — `perf(notifications): 運営通知の取得を 1 か所にまとめ 5 分に 1 回へ・max-age=300`

**効果の見積もり:** /api/template 14 CPU 秒/12h(272 回)のうち通知分。通知の本数が 1/2〜1/4 になる想定で **約 5〜9 秒/12h 減**(public-template との内訳は未計測なので幅を持たせた)。
**本番の確かめ方:** デプロイ後 12h の Vercel Observability → Functions → `/api/template` の Invocations と CPU が前の 12h(272 回/14 秒)から減っているか。DevTools の Network で /miti を開き `public-notifications` が 1 本だけ・タブ切替で増えないこと。

---

### Task 2: collab worker で ID トークン確認結果を短時間覚える

**現状(確認済み):**
- `workers/collab/src/index.ts:53-58` — WebSocket upgrade のたび(つなぎ直し含む)に `verifyToken(env.APP_API_BASE, env.COLLAB_SHARED_SECRET, t)` → Vercel `POST /api/collab/verify`。
- `workers/collab/src/collabAuth.ts:16-34`(verifyToken)/ `:47-54`(authorizeConnection は `VerifyFn` を受け取る=差し込み口がある)。
- `api/collab/_verifyHandler.ts:20` — `getAuth().verifyIdToken(token)`(**checkRevoked なし**)。
- 編集権 = 「正規ログインの uid がある」だけ(`workers/collab/src/server.ts:143-148`)。部屋の失効は DO 内 `server.ts:138-141` で接続ごとに判定(キャッシュの影響を受けない)。
- クライアントは `user.getIdToken()`(強制更新なし・`src/lib/collab/collabProvider.ts:76`)=つなぎ直しでも同じトークンが来る=キャッシュが当たる。

**決定:**
- 新ファイル `workers/collab/src/verifyCache.ts`(仕事 = verify 結果の短期記憶)。isolate のモジュール変数の Map に保持(isolate が入れ替われば消える=ベストエフォート)。
- 鍵 = `crypto.subtle.digest('SHA-256', token)` の hex。**生のトークンは鍵にも値にも持たない**(値は uid と期限だけ)。
- 覚えるのは**成功(uid が返った)だけ**。null(不正・期限切れ・障害)は覚えない=障害が直れば次の接続で通る。
- 期限 = `min(トークンの exp × 1000, 今 + 10 分)`。exp はトークン中身(payload)の base64url を読むだけ(署名確認は Vercel 側が済ませた後にしか覚えないので安全・鍵がトークン全体の hash なので別トークンに流用されない)。exp が読めない/既に過ぎている → 覚えない。
- 上限 500 件。超えたら最も古い挿入から捨てる(Map の挿入順)。読む時に期限切れなら消して inner を呼ぶ。

**安全性(計画として確定):**
- 取り消したトークン・ログアウト・アカウント無効化: 今の verify は checkRevoked なし → **今でもトークンの exp(発行から最大 60 分)まで通る**。キャッシュは exp を超えて覚えないので、通る時間の上限は**今と同じ(最大 60 分)・広がらない**。
- 権限の変更: 編集権は「ログインしているか」だけで、部屋ごとの権限や失効は DO が接続ごとに見る → キャッシュで遅れる権限は無い。
- 将来 verify に `checkRevoked: true` を足した場合は、取り消しの反映が最大 10 分遅れる → その時は `VERIFY_CACHE_MAX_MS` を見直す(`verifyCache.ts` 冒頭コメントに明記する)。

**Files:**
- Create: `workers/collab/src/verifyCache.ts`
- Create: `workers/collab/src/verifyCache.test.ts`
- Modify: `workers/collab/src/index.ts:3,53-58`(モジュール変数 `const verifyCache = createVerifyCache();` を作り、`authorizeConnection(req, (t) => verifyCache.verify(t, (tt) => verifyToken(env.APP_API_BASE, env.COLLAB_SHARED_SECRET, tt)))`)

**Interfaces:**
- Consumes: `VerifyFn`(`collabAuth.ts:37`)
- Produces:
  - `export const VERIFY_CACHE_MAX_MS = 10 * 60_000;` / `export const VERIFY_CACHE_MAX_ENTRIES = 500;`
  - `export function readJwtExpMs(token: string): number | null`
  - `export async function tokenCacheKey(token: string): Promise<string>`(SHA-256 hex)
  - `export function createVerifyCache(now?: () => number): { verify(token: string, inner: VerifyFn): Promise<string | null>; size(): number }`

- [ ] **Step 1: 失敗するテストを書く**(`verifyCache.test.ts`、inner は `vi.fn()`、トークンは `header.<base64url({exp, uid})>.sig` を組み立てる小関数、`now` を差し込む)
  - `'同じトークンの 2 回目は inner を呼ばない'`: inner 呼び出し 1 回・両方 `'user-1'`。
  - `'10 分たったら inner を呼び直す'`: exp=今+60 分、now を +10 分 → 2 回。
  - `'exp が 10 分より近ければ exp で切れる'`: exp=今+2 分、+2 分で 2 回。
  - `'null は覚えない'`: inner が null → 2 回目も inner を呼ぶ。
  - `'exp が読めないトークンは覚えない'`: `'not-a-jwt'` → 2 回とも inner。
  - `'期限切れ exp のトークンは覚えない'`: exp=今-1 秒 → 2 回とも inner。
  - `'上限 500 件を超えたら古いものから捨てる'`: 501 種類 → `size() === 500`、1 件目は inner を呼び直す。
  - `'鍵は SHA-256 の hex で生のトークンを含まない'`: `await tokenCacheKey('abc')` が `/^[0-9a-f]{64}$/` に一致し `'abc'` と等しくない。キャッシュ内部は必ず `tokenCacheKey` の戻り値を鍵にする(レビューで確認)。
- [ ] **Step 2: 失敗を確認** — `cd workers/collab && rtk npx vitest run src/verifyCache.test.ts` → FAIL(モジュール無し)。
- [ ] **Step 3: 実装** — verifyCache.ts 作成・index.ts 配線。
- [ ] **Step 4: 通過を確認** — `cd workers/collab && rtk npx vitest run` 全 PASS(既存 `collabAuth.test.ts`・`server.test.ts` 含む)、`npm run typecheck` exit 0。
- [ ] **Step 5: Commit** — `perf(collab): worker で ID トークン確認結果を最大 10 分覚え Vercel verify を減らす`

**worker のデプロイ手順(Vercel とは別・持ち主の GO 後に 1 回):**
1. `cd workers/collab && rtk npx vitest run && npm run typecheck`
2. `npx wrangler deploy`(wrangler.jsonc の vars は変えない。シークレット `COLLAB_SHARED_SECRET` は投入済みなので触らない)
3. 2 タブで共同編集の部屋に入り、編集が相互に反映されること・未ログインのタブは閲覧のみであることを確認(記憶 reference_collab_two_client_version_skew = 両タブ再読込してから)。
4. 戻す時は `npx wrangler rollback`。

**効果の見積もり:** /api/collab 32 CPU 秒/12h(309 回)。verify の割合は未計測(load/save/room/gc と同じ関数)。verify が 1/3・ヒット率 50% と置いて **約 3〜8 秒/12h 減**。
**本番の確かめ方:** Vercel のログで `/api/collab?action=verify`(rewrite 後)の件数をデプロイ前後 12h で比較。Observability の `/api/collab` Invocations と CPU の減り。

---

### Task 3: sharp を使う action の中でだけ読み込む

**現状(確認済み):**
- 静的 import: `api/housing/_coverThumbHash.ts:7,11`・`api/housing/_imageFormatConvert.ts:11,14`・`api/og-cache/index.ts:22,27`(それぞれモジュール読み込み時に `sharp.block({ operation: ['VipsForeignLoadSvg'] })`)。
- `api/housing/index.ts:31-58` が全ハンドラを静的 import → `_uploadThumbnailHandler.ts:43-44` 経由で、公開窓口(`index.ts:63,69-71` の version/gallery/housinger/listing)の起動でも sharp が読まれる。
- `api/share/index.ts:13-22` とその先は sharp に届かない(確認: share 配下の import 一覧に sharp・_imageFormatConvert・_coverThumbHash 無し。`../housing/_publicWindow.js`・`../housing/_imageArrayLogic.js` も sharp 無し)。→ share は**回帰防止の試験だけ**付ける。
- `scripts/backfill-listing-thumbnail-png.ts` が `convertToPngIfNeeded` を使う(関数は元から async なので影響なし)。

**決定:**
- 新ファイル `api/_lib/loadSharp.ts`(仕事 = sharp の遅延読み込みと SVG 無効化を 1 回だけ)。`_lib` は関数にならない。
- 3 ファイルの静的 import と `sharp.block` を削除し、各関数の中で `const sharp = await loadSharp();`。`import type` で型だけ使うのは可。
- 試験は**静的 import のグラフを辿る fs テスト**(vi.mock('sharp') は vmThreads でモック汚染の恐れ = `vitest.config.ts:14-24` の注記・実 sharp を使う `_coverThumbHash.test.ts` を壊しうるので使わない)。

**Files:**
- Create: `api/_lib/loadSharp.ts`
- Modify: `api/housing/_coverThumbHash.ts:7-11,15`・`api/housing/_imageFormatConvert.ts:11-14,49,66`・`api/og-cache/index.ts:22-27,53`
- Create: `api/__tests__/_staticImportGraph.ts`(テスト用ヘルパー・仕事 = 静的 import の到達集合を返す)
- Create: `api/__tests__/noStaticSharpImport.test.ts`
- Create: `api/__tests__/loadSharp.test.ts`

**Interfaces:**
- Produces:
  - `api/_lib/loadSharp.ts`: `export async function loadSharp(): Promise<typeof import('sharp')['default']>`(初回だけ `await import('sharp')`+`block`、以降は同じ Promise を返す)
  - `api/__tests__/_staticImportGraph.ts`: `export function collectStaticImports(entryAbsPath: string): { files: Set<string>; bareSpecifiers: Set<string> }`(`import ... from '...'` と `export ... from '...'` を辿る。`import type` / `export type` と `import('...')` は除外。相対の `.js` は `.ts` に読み替え)

- [ ] **Step 1: 失敗するテストを書く**
  - `noStaticSharpImport.test.ts`: 入口 `api/housing/index.ts`・`api/share/index.ts`・`api/template/index.ts`・`api/collab/index.ts`・`api/og-cache/index.ts` それぞれ `it('<入口> の起動で sharp を静的に読まない')` → `expect(bareSpecifiers.has('sharp')).toBe(false)`。加えてヘルパー自体の確認 `it('ヘルパーは静的 import の sharp を検出できる')`: 入口 `api/_lib/loadSharp.ts` では false、テスト用の一時ファイルではなく既存の `api/housing/__tests__/_coverThumbHash.test.ts`(先頭で `import sharp from 'sharp'`)を入口にして true。
  - `loadSharp.test.ts`: `'2 回呼んでも同じものを返す'`(`toBe`)、`'SVG は読めない'`: `const sharp = await loadSharp(); await expect(sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>')).png().toBuffer()).rejects.toThrow()`。
- [ ] **Step 2: 失敗を確認** — `rtk node node_modules/vitest/vitest.mjs run api/__tests__/` → housing と og-cache が FAIL、loadSharp はモジュール無しで FAIL。
- [ ] **Step 3: 実装** — loadSharp 作成・3 ファイルを置換。
- [ ] **Step 4: 通過を確認** — `api/__tests__/`・`api/housing/__tests__/_coverThumbHash.test.ts`・`_imageFormatConvert.test.ts`(`:73-78` の SVG ブロック含む)・`_uploadThumbnailHandler.derivatives.test.ts`・`_thumbnailHandlers.coverThumbHash.test.ts`・`routerNoStore.test.ts` が PASS、`rtk npx tsc -b` exit 0。
- [ ] **Step 5: Commit** — `perf(api): sharp を使う処理の中でだけ読み込み、公開読みの起動を軽くする`

**効果の見積もり:** コールドスタート 20% × (housing 96 + og-cache 28) ≈ 25 回/12h。sharp(ネイティブ libvips)の読み込みを 1 回 100〜250ms と置いて **約 2.5〜6 秒/12h 減**(og-cache は HIT 時に sharp 不要)。
**本番の確かめ方:** `/api/housing` と `/api/og-cache` の CPU/呼び出し(=1 回あたり CPU)がデプロイ前(housing 167ms・og-cache 164ms)より下がるか。画像アップロード 1 回と OG 画像の MISS 1 回が正常に出ることを実機で確認(MISS は管理画面の操作で作れない場合は持ち主に依頼)。

---

### Task 4: og-cache の HIT 時の書き込みを 1 日 1 回に間引く

**現状(確認済み):**
- `api/og-cache/index.ts:95` `file.exists()` → `:99` `download()` → `:105-107` **毎回** `setMetadata({ metadata: { lastAccessedAt } })`。
- 目的 = 週 1 の cron `api/cron/cleanup-og-images/index.ts:30,61-66` が「`lastAccessedAt`(無ければ updated)が 30 日より前」を削除(LRU)。

**決定:**
- `exists()` を `getMetadata()` に置き換える(1 往復で「有るか」と「前回の lastAccessedAt」が取れる)。404 は MISS へ、404 以外の例外は従来どおり外側 catch で 500。
- `lastAccessedAt` が数字の文字列で、今から 24 時間未満なら書かない。無い/壊れている/24 時間以上前なら書く。cron の 30 日に対し誤差は最大 1 日 = LRU は壊れない。
- 判定は純関数として `api/og-cache/_ogCacheLogic.ts`(og-cache の判断ロジック置き場)へ。

**Files:**
- Modify: `api/og-cache/_ogCacheLogic.ts`(関数と定数を追加)
- Modify: `api/og-cache/index.ts:94-108`
- Modify: `api/og-cache/__tests__/_ogCacheLogic.test.ts`
- Create: `api/og-cache/__tests__/handlerHit.test.ts`(`../../../src/lib/adminAuth.js` と `firebase-admin/storage`・`firebase-admin/firestore` を vi.mock)

**Interfaces:**
- Produces: `export const LAST_ACCESSED_REFRESH_MS = 24 * 60 * 60 * 1000;` / `export function shouldRefreshLastAccessed(lastAccessedRaw: unknown, nowMs: number): boolean`

- [ ] **Step 1: 失敗するテストを書く**
  - `_ogCacheLogic.test.ts`: `'23 時間前なら false'`・`'24 時間ちょうどなら true'`・`'未設定 / 数字以外なら true'`(`undefined`・`'abc'`・`123`(数値型))。
  - `handlerHit.test.ts`: `'lastAccessedAt が新しい HIT は setMetadata しない'`(200・`X-OG-Cache: HIT`・`setMetadata` 0 回・`exists` を呼ばない)/ `'古い HIT は setMetadata する'`(1 回)/ `'getMetadata が 404 なら MISS 経路へ進む'`(Firestore の meta 無し → 404 `not found`)/ `'getMetadata が 404 以外で失敗したら 500'`。
- [ ] **Step 2: 失敗を確認** — `rtk node node_modules/vitest/vitest.mjs run api/og-cache/` → FAIL。
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通過を確認** — 同コマンド PASS、`rtk npx tsc -b` exit 0。
- [ ] **Step 5: Commit** — `perf(og-cache): 最終アクセス時刻の書き込みを 1 日 1 回に間引く`

**効果の見積もり:** og-cache 4.6 CPU 秒/12h。Active CPU は通信待ちを数えないので書き込み 1 回分の処理(SDK の組み立て・認証)だけ減る。**約 0.5〜1.5 秒/12h 減**(Storage の書き込み操作数も減る)。
**本番の確かめ方:** `/og/<hash>.png` を 2 回開き 200・画像表示・`X-OG-Cache: HIT`。Firebase Storage の対象ファイルの `lastAccessedAt` が 2 回目で変わらないこと。翌週の cron 応答(`deleted` 件数)が急増していないこと。

---

### Task 5: /api/share の JSON GET のキャッシュ判断(実装は親の決定待ち)

**現状(確認済み):**
- `api/share/_getShare.ts:12-55` — Cache-Control なし。読むたびに IP ごとの閲覧数 +1(`:27-44`、`preview=true` の時だけ飛ばすが、クライアントで `preview=true` を付ける所は無い)。
- 応答の中身が変わる経路: PUT ロゴ更新 `_updateShareLogo.ts:61-66,96`(logoBase64/logoHash/imageHash)・管理画面のロゴ削除 `api/admin/_ugcHandler.ts:69`・閲覧数 `viewCount` 自体。
- 認証なし・個人の状態(progress/memos)は `:46-52` で除去済み=応答に個人状態は混ざらない。
- 呼び出し元は取り込みの流れ `src/store/useShareImportFlow.ts:96` だけ(1 回の取り込みで 1 回)。

**判断(計画としての推奨):** **共有キャッシュ(public)には載せない**。理由: (a) Cloudflare/ブラウザ共有で返すと Vercel が呼ばれず**閲覧数が数えられなくなる**=既存機能が変わる、(b) 管理画面でロゴを消しても max-age の間は消したロゴが配られる(モデレーション遅れ)。`private, max-age=60` なら害は無いが、取り込みは 1 人 1 回なので**効果はほぼ 0**。→ 既定案 = 変更しない。親が「private, max-age=60 を付ける」を選んだ場合のみ下の手順。

**Files(選んだ場合のみ):** Modify `api/share/_getShare.ts:53` / Create `api/share/__tests__/getShareCacheControl.test.ts`
- [ ] **Step 1:** テスト `'GET の JSON は private, max-age=60'`(`public` を含まないことも assert)→ FAIL を確認
- [ ] **Step 2:** `res.setHeader('Cache-Control', 'private, max-age=60')` を 200 応答の直前に追加 → PASS、`rtk npx tsc -b` exit 0
- [ ] **Step 3: Commit** — `chore(share): 共有 JSON にブラウザ専用の短いキャッシュを付ける`

**効果の見積もり:** 0〜0.5 秒/12h。/api/share の 19 秒の本体は HTML ページ系(type=page/housinger/listing/tour)の可能性が高い(未計測)→「親に聞く事」へ。

---

## 仕上げ(全 Task 後・push 前ゲート)

- [ ] `npm run test:gate` exit 0 / `rtk npx tsc -b` exit 0 / `cd workers/collab && rtk npx vitest run && npm run typecheck`
- [ ] Node 関数数が増えていないこと: `find api -name "*.ts" -not -path "*__tests__*" -not -name "_*" -not -path "*/_lib/*" | sort` の一覧が 7c81233e と同じ(新規は `_` 付き・`_lib`・`__tests__` のみ)
- [ ] push(Vercel)と `wrangler deploy`(worker)は持ち主の GO 後にそれぞれ 1 回
- [ ] デプロイ 12h 後に Vercel Usage → Fluid Active CPU と Observability → Functions の 6 関数の数字を本書冒頭の基準(呼び出し 779・P75 210ms・関数別 CPU 秒)と比べて TODO.md に記録

## 効果の合計(見積もり)

基準 = 6 関数で約 93 CPU 秒/12h。Task 1: 5〜9 / Task 2: 3〜8 / Task 3: 2.5〜6 / Task 4: 0.5〜1.5 / Task 5: 0〜0.5 → **合計 約 11〜25 秒/12h(約 12〜27% 減)**。内訳が未計測の部分(template の通知割合・collab の verify 割合・share のページ系)が幅の原因。

## 親に聞く事

1. Cloudflare に `/api/template?action=public-notifications` を対象にした Cache Rule があるか(`miti-public-window-cache` の対象式に含まれるか)。無ければ追加するか(追加すると Vercel 呼び出しはさらに減るが、通知の遅れ上限が 5→10 分になる)。max-age=300 でよいか。
2. Task 5: 既定案「変更しない」でよいか、`private, max-age=60` を付けるか。
3. /api/share の CPU の本体(19 秒/56 回=1 回 340ms)は HTML ページ系の可能性が高い。type 別の件数を Vercel ログで取る別調査を出すか(本計画の範囲外)。
4. 運営通知の 5 分ルールを「アプリ内の画面移動でサイドバーが付け直された時」にも効かせる(=本計画の決定)。即時に見たい場面(管理者が投稿直後に確認する等)があれば、管理画面側だけ強制取得を足すか。

## 親の答え(11-05)
- **Q1**: Cloudflare の Cache Rule は足さない(今あるかは見るだけ・変えない)。サーバーは max-age=300。新しい通知の遅れの上限 = 約 5 分(ルールがあれば約 10 分)で可。
- **Q2(Task 5 の差し替え)**: 共有の閲覧数の加算(`api/share/_getShare.ts` の viewers の get と batch 書き込み)を**消す**。持ち主の承認済み(11-05「要らない」)・読む所が無い(`viewCount` は `_createShare.ts` の初期値だけ・人気の表は撤去済み)ことを grep で確かめてから。既に保存された `viewCount` と `viewers` は消さない(データは触らない)。共有の応答のキャッシュは足さない(管理画面での非表示の反映を遅らせないため)。
- **Q3**: share の type 別の調査は今は出さない。デプロイの後、ダッシュボードの数字で見る。
- **Q4**: 管理者が通知を投稿・編集した画面では、その場で取り直す(feed の再取得を 1 回呼ぶ)。ほかの人は最大 5 分遅れで可。
