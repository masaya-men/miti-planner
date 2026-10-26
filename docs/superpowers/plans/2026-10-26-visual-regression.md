# 全画面の自動見た目比較(visual-regress)段階 1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** リファクタの前後で全画面(ログイン不要分)を同じ時間帯に撮り、差が出た画面だけを報告し、Claude が仕分けられる道具を `scripts/visual-regress/` に作る。

**Architecture:** Playwright(chromium)で dev サーバーを撮る。決定性の層(通信の遮断・見本 JSON・時刻と乱数の固定・動きの停止)の上に、宣言的な画面カタログを展開して撮影する。A/B 方式では、base コミットを OS 一時フォルダの worktree で別ポートの dev サーバーとして立て、続けて撮る。比較は既存 `shots.mjs` のブロック方式。報告はローカル HTML。

**Tech Stack:** Node ESM(`.mjs`)、Playwright 1.60(`playwright` パッケージの chromium)、sharp、vitest(`scripts/**/__tests__/**/*.test.ts` から `.mjs` を import)。

**Spec:** `docs/superpowers/specs/2026-10-26-visual-regression-design.md`(§3.5 使い分け・§5 決定性・§6 カタログ・§7 報告・§8 決まり・§10 細部の決定)

## Global Constraints

- 本番・Firestore に一切つながない。通信は**許可リスト方式**(dev サーバー自身の JS/CSS/同梱アセット以外は遮断か差し替え)。
- 見本 JSON・見本画像は人工データのみ(公開リポ。実ユーザーの名前・画像・ID を入れない)。
- 撮った写真・報告・キャッシュは git に入れない: `scripts/visual-regress/.out/` と `.cache/` を `.gitignore` に追加。
- 撮影条件: 1489×679 DSR 2.58 / 1920×1080 DSR 2 / 390×844 DSR 3(スマホ。`isMobile: true, hasTouch: true`)。
- 比較の数値は `shots.mjs` と同じ: ブロック 8×8、平均色差 > 6 で「違うブロック」、許容 = 3 回撮った最大差 × 1.5、下限 0.05% かつ 10 ブロック。
- 固定時刻 `2026-10-01T12:00:00+09:00`、乱数の種 `20261026`。
- 初回窓の抑止: `tutorial-storage`={state:{hasCompleted:true,hasVisitedShare:true,isActive:false},version:0}・`lopo_mobile_guide_completed`='true'・`lopo.popularDisplayConsent`='1'。
- 終了コード: 0 = 差なし / 1 = 差あり / 2 = 撮影失敗あり(混在は 2)。
- base 側の worktree は `.claude/worktrees/` の外(`os.tmpdir()/lopo-vr-base-<短いハッシュ>`)に作り、`.env.local` をコピー、`node_modules` は junction。実行後に必ず削除(失敗時も `finally`)。
- コメント・ログ・報告は日本語(リポジトリの既存スクリプトに合わせる)。
- アプリ本体(`src/`)の変更はこの計画では**しない**。例外は Task 6 の `data-testid` 追加で、それは独立コミットにする(設計書 §10)。

## Review Focus

1. 遮断した通信が「撮影成功」に化ける: 見本の無い `/api` 呼び出しや未知ホストへの通信があった画面は、撮れても `unmocked` として撮影失敗(exit 2)にする(Task 2 のテストで固定)。
2. base 側のサーバーが起動しない・古くて画面が無い: その画面は「base 側の撮影失敗」として報告に出し、全体は exit 2(Task 5 のテスト)。
3. 窓が開かないまま撮る: `ready` が出ないときはタイムアウト 15 秒で撮影失敗。開いた窓の数が 0 のまま「窓だけ切り抜き」をしない(Task 4)。
4. 途中で落ちたときに一時 worktree と dev サーバーが残る: `finally` で必ず止めて消す。次の起動時に前回の残骸(`lopo-vr-base-*`)を見つけたら消してから始める(Task 5)。
5. 写真の大きさが前後で違う(スクロール高さが変わった等): 差 100% として「差あり」に出す(黙って比べない)。報告に「大きさが違う」と書く(Task 3)。

---

## ファイル構成

```
scripts/visual-regress/
  README.md                 使い方(Task 8)
  run.mjs                   入口: 引数解釈・A/B・保存基準モード・終了コード(Task 5)
  lib/
    diff.mjs                ブロック比較・許容(Task 1。shots.mjs から移す)
    freeze.mjs              動きを止める(Task 1。shots.mjs から移す)
    determinism.mjs         通信の振り分け・時刻と乱数の固定(Task 2)
    catalog.mjs             カタログ項目の型の検査と組み合わせの展開(Task 4)
    shoot.mjs               1 条件を撮る(Task 4)
    servers.mjs             base worktree の作成・dev サーバー起動と後片付け(Task 5)
    report.mjs              報告 HTML・切り出し・仕分けの反映(Task 7)
  fixtures/
    api/*.json              /api の見本(Task 3)
    images/                 見本画像(Task 3 の生成スクリプトが作る。生成物もコミットする)
    make-images.mjs         見本画像の生成(Task 3)
    storage.mjs             localStorage の見本(軽減表は shots.mjs の buildStorage を移す)(Task 3)
  catalog/
    site.mjs  miti.mjs  miti-milspec.mjs  miti-mobile.mjs  housing.mjs  _later.mjs   (Task 6)
  __tests__/
    diff.test.ts determinism.test.ts catalog.test.ts report.test.ts servers.test.ts coverage.test.ts
.claude/rules/visual-regress.md   (Task 8)
```

`scripts/sticky-scroll/shots.mjs` は Task 1 で `lib/diff.mjs` `lib/freeze.mjs` を import する形に変える(挙動は不変)。

---

### Task 1: 比較と動き止めを共通部品に移す

**Files:**
- Create: `scripts/visual-regress/lib/diff.mjs`, `scripts/visual-regress/lib/freeze.mjs`
- Modify: `scripts/sticky-scroll/shots.mjs:125-144`(freeze)・`:248-267`(diffPng)を import に置き換え
- Modify: `.gitignore`(`scripts/visual-regress/.out/` `scripts/visual-regress/.cache/`)
- Test: `scripts/visual-regress/__tests__/diff.test.ts`

**Interfaces:**
- Produces:
  - `diffPng(a: Buffer, b: Buffer): Promise<{ blocks: number, total: number, ratio: number, sizeMismatch?: string, mask: Uint8Array, bw: number, bh: number }>`(`mask` は違うブロックを 1 にした bw×bh 配列。報告の色塗りと切り出しに使う)
  - `toleranceFrom(ratios: number[], total: number): number`(最大 × 1.5 と下限 max(0.0005, 10/total) の大きい方)
  - `BLOCK = 8`, `BLOCK_MEAN = 6`
  - `freeze(page, { injectCss?: string, hideSelectors?: string[] }): Promise<void>`(shots.mjs の処理+`document.fonts.ready` を待つ)

- [ ] **Step 1: 失敗するテストを書く** — `diff.test.ts`(sharp で 64×64 の単色 PNG を作って使う)
  - `同じ画像は blocks=0`
  - `1 ブロック(8×8)だけ色差 7 にすると blocks=1・mask の該当位置だけ 1`
  - `色差 6 ちょうどは数えない`
  - `大きさが違うと ratio=1 と sizeMismatch='64x64 vs 64x72'`
  - `toleranceFrom([0.001,0.002,0.0015], 1000) は 0.01`(10/1000 が勝つ)・`toleranceFrom([0.02], 100000) は 0.03`
- [ ] **Step 2: 実行して失敗を確認** — `npx vitest run scripts/visual-regress/__tests__/diff.test.ts` → モジュールが無くて FAIL
- [ ] **Step 3: `lib/diff.mjs` と `lib/freeze.mjs` を実装** — shots.mjs の `diffPng` / `freeze` を移し、上の形の戻り値に広げる。shots.mjs は移した関数を import する(戻り値のキーが `pixels` → `blocks` に変わるので shots.mjs の参照も直す。`INJECT_CSS` は `freeze` の引数で渡す。`.milspec-drums,.milspec-dtg-txt` を隠す指定は shots.mjs 側から `hideSelectors` で渡す)
- [ ] **Step 4: テストが通ることを確認** — 同じコマンドで PASS。shots.mjs が壊れていないことは `node scripts/sticky-scroll/shots.mjs --list` が条件一覧を出すことで確認
- [ ] **Step 5: コミット** — `refactor(visual-regress): 画素比較と動き止めを共通部品に移す`

### Task 2: 決定性の層(通信・時刻・乱数)

**Files:**
- Create: `scripts/visual-regress/lib/determinism.mjs`
- Test: `scripts/visual-regress/__tests__/determinism.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `classifyRequest(url: string, appOrigin: string): 'app' | 'api' | 'block' | 'image' | 'font' | 'unknown'`
    - `app`: appOrigin の `/api/` 以外(Vite のモジュール・同梱アセット・`/housing/*.webp` など)
    - `api`: appOrigin の `/api/`
    - `image`: `lopoly.app/housing-media`・`pbs.twimg.com`・`i.ytimg.com`・`img.youtube.com`・`firebasestorage.googleapis.com`・`media.lopoly.app`
    - `font`: `fonts.googleapis.com`・`fonts.gstatic.com`
    - `block`: `*.googleapis.com`(上記以外)・`*.firebaseio.com`・`*.firebaseapp.com`・`www.google.com/recaptcha`・`www.googletagmanager.com`・`google-analytics.com`・`youtube-nocookie.com`・`youtube.com`・`*.workers.dev`
    - それ以外は `unknown`(遮断し、`unmocked` に記録)
  - `apiFixtureKey(url: string): string`(例 `/api/housing/public?action=gallery&v=123` → `housing-public.gallery`。`/api/template?action=public-template&id=X` → `template.public-template.X`。クエリの `v` や時刻系は無視)
  - `installDeterminism(context, { appOrigin, fixturesDir, fontCacheDir, now, seed }): Promise<{ unmocked: string[] }>`
    - `context.route('**/*')` で上の振り分け。`api` は `fixtures/api/<key>.json` を返し、無ければ 404 を返して `unmocked` に積む。`image` は URL のハッシュで `fixtures/images/` の見本を決定的に選んで返す。`font` は `.cache/fonts/` にあれば返し、無ければ 1 回だけ取得して保存(取得は実ネットワーク=唯一の例外)。WebSocket は `context.routeWebSocket` で閉じる
    - `context.clock.install({ time: now })` の後 `clock.resume()`(時刻は固定値から進むが、毎回同じ起点)
    - addInitScript で `Math.random` を種 `seed` の mulberry32 に置き換え

- [ ] **Step 1: 失敗するテストを書く** — `determinism.test.ts`
  - `classifyRequest` を表駆動で: `http://localhost:5182/src/main.tsx`→app、`http://localhost:5182/api/housing/public?action=gallery`→api、`https://firestore.googleapis.com/...`→block、`https://fonts.gstatic.com/s/x.woff2`→font、`https://pbs.twimg.com/media/a.jpg`→image、`https://example.com/x`→unknown、`wss://lopo-collab.x.workers.dev`→block
  - `apiFixtureKey`: 上の 2 例+`/api/template?action=public-notifications`→`template.public-notifications`+`/api/housing/public?action=listing&id=vr-l1&v=9`→`housing-public.listing.vr-l1`
  - `mulberry32(20261026)` の最初の 3 値が 2 回生成して一致(関数は `determinism.mjs` から export)
- [ ] **Step 2: 失敗を確認** — `npx vitest run scripts/visual-regress/__tests__/determinism.test.ts` → FAIL
- [ ] **Step 3: 実装** — 上の Interfaces どおり
- [ ] **Step 4: 通ることを確認** — 同じコマンドで PASS
- [ ] **Step 5: 実ブラウザでの遮断確認(使い捨て)** — dev サーバーを立て、`installDeterminism` を入れた context で `/miti` を開き、30 秒以内に `[data-time-row]` が出ることと、`unmocked` に何が積まれたかを表示する小さな確認を `node -e` かスクラッチのスクリプトで 1 回だけ実行する。**Firestore 遮断から静的データでの描画までにかかった秒数を記録**する(Task 4 の待ち方の根拠)。3 秒を超えたら台帳に書いて親に報告する
- [ ] **Step 6: コミット** — `feat(visual-regress): 通信の振り分けと時刻・乱数の固定`

### Task 3: 見本データ(API・画像・localStorage)

**Files:**
- Create: `scripts/visual-regress/fixtures/api/*.json`, `fixtures/make-images.mjs`, `fixtures/images/*.png`(生成物), `fixtures/storage.mjs`
- Modify: `scripts/sticky-scroll/shots.mjs:78-97`(buildStorage を `fixtures/storage.mjs` から import)
- Test: `scripts/visual-regress/__tests__/fixtures.test.ts`

**Interfaces:**
- Consumes: `apiFixtureKey`(Task 2)
- Produces:
  - `fixtures/api/` のキー(最低限): `housing-public.version` / `housing-public.gallery` / `housing-public.listing.<id>`(gallery の全件分)/ `housing-public.housinger.<uid>`(2 人分)/ `template.public-notifications` / `template.public-template.<contentId>`(軽減表の見本が使う contentId)
  - 応答の形は**実装の型に合わせる**(`src/lib/housing/publicHousingWindow.ts`・`src/hooks/useMasterData.ts:196` 付近・`useSystemNotifications.ts:33` を読んで、その型の値を作る)
  - gallery は 24 件。NEW 対象 3 件(固定時刻 2026-10-01 から 3 日以内の createdAt)、動画つき 2 件、YouTube 2 件、文字の長い名前 2 件、5 言語の名前が混ざる。画像 URL は `https://lopoly.app/housing-media/vr/<n>.webp` の形(Task 2 の image で見本に差し替わる)
  - 見本画像: 12 枚。1200×800、色相を 30° ずつずらした単色+中央に大きく番号(sharp の SVG 合成で生成。**SVG 読込はアプリ側の制約で、生成スクリプトでは使ってよい**)。アバター用 256×256 を 4 枚
  - `storage.mjs`: `mitiStorage({ view, party, theme, lang })`(shots.mjs の buildStorage を移したもの+`theme-storage` の `contentLanguage` を lang に)・`baseStorage()`(初回窓の抑止 3 キー)・`housingStorage({ theme, favorites })`
- [ ] **Step 1: 失敗するテストを書く** — `fixtures.test.ts`
  - `gallery の各 id に listing 見本がある`
  - `housinger 見本が参照する listing id は全部 gallery にある`
  - `全 JSON に実在の lopoly ユーザーらしき値が無い`(文字列に `@` を含まない・uid は `vr-` で始まる)
  - `mitiStorage({view:'sheet',party:4,theme:{mode:'dark',style:'standard'},lang:'en'}) の theme-storage.state.contentLanguage は 'en'`
- [ ] **Step 2: 失敗を確認** → FAIL
- [ ] **Step 3: 実装** — 型を読んで JSON を作る・画像生成スクリプトを書いて 1 回実行し、生成物をコミット対象にする
- [ ] **Step 4: 通ることを確認** → PASS。`node scripts/sticky-scroll/shots.mjs --list` が変わらず動く
- [ ] **Step 5: コミット** — `feat(visual-regress): 人工の見本データ(API・画像・localStorage)`

### Task 4: カタログの形と 1 条件の撮影

**Files:**
- Create: `scripts/visual-regress/lib/catalog.mjs`, `scripts/visual-regress/lib/shoot.mjs`
- Test: `scripts/visual-regress/__tests__/catalog.test.ts`

**Interfaces:**
- Consumes: `installDeterminism`(Task 2)、`freeze`(Task 1)、`fixtures/storage.mjs`(Task 3)
- Produces:
  - カタログ項目(各 catalog ファイルが `export default [...]`):
    ```
    { id: string,                       // 'miti/party-settings'
      route: string,                    // '/miti'
      storage: (cond) => Record<string, unknown>,
      open?: (page, cond) => Promise<void>,   // 窓を開く手順
      ready: string,                    // 撮ってよい合図のセレクタ
      clip?: 'page' | 'ready',          // 'ready' = ready 要素の外接矩形だけ
      axes: { vp: ('1489'|'1920'|'390')[], theme: string[], lang: ('ja'|'en')[] },
      covers?: string[],                // この項目が撮る部品名(Task 9 の漏れ検査が使う)
      hide?: string[],                  // 揺れて隠す領域(理由はコメント必須)
      mask?: { selector: string, reason: string }[] }
    ```
    `theme` の値: `standard-dark` `standard-light` `military-dark` `military-light` `housing-dark` `housing-light` `site-dark` `site-light`
  - `validateCatalog(entries): string[]`(エラー文の配列。id 重複・必須欠け・未知の axes 値・`clip:'ready'` なのに `ready` が無い)
  - `expandConditions(entries, { only?: string }): Cond[]`(`Cond = { key: string, entry, vp, theme, lang }`、`key` = `<id>@<vp>-<theme>-<lang>`。`only` は key に含まれる文字で絞る)
  - `shootCondition(browser, baseUrl, cond, outFile): Promise<{ ok: true, file } | { ok: false, error: string, unmocked: string[] }>`
    - 新しい context(viewport・DSR・`reducedMotion:'reduce'`・390 は isMobile/hasTouch)→ `installDeterminism` → addInitScript で storage → goto → `open` → `ready` を 15 秒待つ → **落ち着き待ち**(500ms 間ネットワーク要求ゼロ+`document.fonts.ready`。Task 2 Step 5 の実測秒数を下限にする)→ `freeze` → 撮影(`page` は viewport 全体、`ready` は要素の矩形)
    - `unmocked` が 1 件でもあれば `ok:false`(Review Focus 1)
- [ ] **Step 1: 失敗するテストを書く** — `catalog.test.ts`
  - `id 重複を検出`・`axes に未知のテーマがあると検出`・`clip:'ready' で ready 無しを検出`
  - `expandConditions は vp×theme×lang の直積を作り key が一意`
  - `only='390' で 390 の条件だけ残る`
  - `本物のカタログ(catalog/*.mjs をすべて読み込む)が validateCatalog でエラー 0`(Task 6 までは空配列で通る)
- [ ] **Step 2: 失敗を確認** → FAIL
- [ ] **Step 3: 実装** — `catalog.mjs` は純関数。`shoot.mjs` は上の手順
- [ ] **Step 4: 通ることを確認** → PASS。加えて `catalog/site.mjs` に LP 1 項目だけ仮置きし、dev サーバーに対して `shootCondition` を 1 回呼ぶ使い捨て実行で PNG ができることを確認(この仮置きは Task 6 で正式な形にする)
- [ ] **Step 5: コミット** — `feat(visual-regress): カタログの形と 1 条件の撮影`

### Task 5: A/B 実行の入口とサーバー管理

**Files:**
- Create: `scripts/visual-regress/run.mjs`, `scripts/visual-regress/lib/servers.mjs`
- Test: `scripts/visual-regress/__tests__/servers.test.ts`

**Interfaces:**
- Consumes: Task 1・4 の全部
- Produces:
  - `run.mjs` の引数: `--base=<rev>`(既定 `HEAD`=コミット済みの状態と作業ツリーの比較)・`--only=<文字>`・`--jobs=N`(既定 3)・`--name=<実行名>`(既定 日時)・`--save-as=<名前>` / `--compare=<名前>`(保存基準モード。A/B をしない)・`--inject-css=<file>`(head 側だけに足す=検出力の確認用)・`--calibrate`(同じ側を 3 回撮って許容を `.out/tolerance.json` に保存)・`--list`
  - 出力: `.out/<name>/base/<key>.png` `.out/<name>/head/<key>.png` `.out/<name>/result.json`(`{ key: { status: 'same'|'diff'|'fail-base'|'fail-head', ratio, tol, sizeMismatch?, error? } }`)
  - `servers.mjs`:
    - `planBaseWorktree(rev, tmpRoot): { dir: string, name: string }`(`lopo-vr-base-<rev の短いハッシュ>`)
    - `staleBaseDirs(tmpRoot): string[]`(前回の残骸)
    - `packageJsonDiffers(repoRoot, rev): boolean`
    - `startDevServer(dir, port): Promise<{ url, stop() }>`(`npx vite --port <port> --strictPort`。`http://localhost:<port>/` が 200 を返すまで最大 90 秒待つ)
    - `createBaseWorktree(rev)` / `removeBaseWorktree(dir)`(`git worktree add --detach` → `.env.local` コピー → `mklink /J node_modules`。削除は `git worktree remove --force` → フォルダ削除)
  - ポート: base 5181・head 5182
- [ ] **Step 1: 失敗するテストを書く** — `servers.test.ts`(純関数だけ)
  - `planBaseWorktree('abc1234...', 'C:/tmp') の dir は C:/tmp/lopo-vr-base-abc1234 で .claude/worktrees を含まない`
  - `staleBaseDirs は lopo-vr-base- で始まるフォルダだけ返す`(一時フォルダに作って確認)
  - `result の集計: diff と fail が混在すると終了コード 2・diff だけなら 1・全部 same なら 0`(`exitCodeOf(result)` を `run.mjs` から export して検査)
- [ ] **Step 2: 失敗を確認** → FAIL
- [ ] **Step 3: 実装** — `run.mjs` は「残骸の掃除 → package.json の差を確認(差があれば理由を出して exit 2)→ base worktree 作成 → 2 サーバー起動 → 条件ごとに base・head を同じ並列枠で続けて撮る → 比較 → result.json → 報告(Task 7 ができるまでは result.json のみ)→ finally で両サーバー停止と worktree 削除」。許容は `.out/tolerance.json` に key があればそれ、無ければ下限
- [ ] **Step 4: 通ることを確認** → PASS。`node scripts/visual-regress/run.mjs --only=site` が LP の仮置き 1 項目で `same` になり exit 0、実行後に `lopo-vr-base-*` が残っていないこと
- [ ] **Step 5: コミット** — `feat(visual-regress): A/B 実行(base worktree と 2 サーバー)`

### Task 6: 段階 1 のカタログを埋める

**Files:**
- Create: `scripts/visual-regress/catalog/site.mjs`, `miti.mjs`, `miti-milspec.mjs`, `miti-mobile.mjs`, `housing.mjs`, `_later.mjs`
- Modify(必要な場合のみ・独立コミット): 窓を開くボタンへの `data-testid` 追加(`src/` 側)

**Interfaces:**
- Consumes: カタログ項目の形(Task 4)、見本データ(Task 3)
- Produces: 段階 1 の項目一式と `_later.mjs`(`export default [{ component: string, stage: 2|3, reason: string }]`)

範囲(設計書 §6.1・§6.2 段階 1。窓の開き方は 2026-10-26 の調査結果を使う。調査結果は計画の付録 A に要点を写す):
- `site.mjs`: `/`・`/about`・`/privacy`・`/terms`・`/stgy` の各ページ(vp 1489/390・site-dark/light・ja/en)
- `miti.mjs`(標準シェル・PC): ページ(1489/1920 × standard 2 × lanes/sheet × ja/en)と、ログイン不要の窓(1489 × standard-dark/light・military-dark × ja。文字の多い窓=PartySettings・FFLogsImport・SpreadsheetGridImport・NewPlan・BackupExport/Restore・Event・BoundaryEdit は en も)
- `miti-milspec.mjs`: MIL-SPEC シェルのページ(1489/1920 × military 2 × lanes/sheet × ja/en)と MIL-SPEC 専用の窓・ポップ
- `miti-mobile.mjs`: スマホのページとシート類(390 × standard 2 × ja/en)
- `housing.mjs`: 探す(一覧・ハウジンガー表示・地図)・お気に入り(空/あり)・ツアー(空/トレイあり)・詳細・ハウジンガーページ・`/h/:slug` と、ログイン不要の窓(1489/390 × housing 2 × ja/en)
- `_later.mjs`: ログイン必須・管理画面・共同編集の窓すべて(理由つき)

- [ ] **Step 1: 項目を書くごとに単独で撮る** — `node scripts/visual-regress/run.mjs --save-as=probe --only=<その id>` で撮影成功を確認し、PNG を 1 枚だけ目視(Claude が Read で開く。縮小版で十分)して、窓が開いた状態であることを確かめる。**全部の PNG は見ない**(トークン節約・設計書 §3.5)
- [ ] **Step 2: `data-testid` が必要になったら** — その追加だけを独立コミット `chore: visual-regress 用に窓のボタンへ data-testid を足す` にする(設計書 §10。アプリの見た目は変えない)
- [ ] **Step 3: 全体で検査** — `npx vitest run scripts/visual-regress/__tests__/catalog.test.ts` が PASS(本物のカタログの検査でエラー 0)
- [ ] **Step 4: コミット** — ファイルごとに `feat(visual-regress): <範囲> のカタログ`

### Task 7: 報告ページと仕分け

**Files:**
- Create: `scripts/visual-regress/lib/report.mjs`
- Modify: `scripts/visual-regress/run.mjs`(比較後に報告を作る・`--report-only=<name>` で verdicts を反映して作り直す)
- Test: `scripts/visual-regress/__tests__/report.test.ts`

**Interfaces:**
- Consumes: `diffPng` の `mask`(Task 1)、`result.json`(Task 5)
- Produces:
  - `.out/<name>/report.html`(相対パスで PNG を参照。ブラウザで直接開ける)
  - `.out/<name>/crops/<key>.png`: 差のブロックの外接矩形+余白 48px を base / head / 色塗りで横に並べ、長辺 1200px 以下に縮小(Claude が仕分けで読む用)
  - `.out/<name>/verdicts.json`: `{ [key]: { verdict: 'intended'|'broken'|'unsure', reason: string } }`(Claude が書く)
  - `sortForReport(rows, verdicts): rows` — 並び順 = 撮影失敗 → broken → unsure → 未仕分け → intended、同順位は ratio の大きい順
  - `bboxOfMask(mask, bw, bh): { x, y, w, h } | null`(ブロック単位 → 画素は ×8)
- [ ] **Step 1: 失敗するテストを書く** — `report.test.ts`
  - `sortForReport` の並び(上の順)
  - `bboxOfMask` が 2 つ離れたブロックを含む最小矩形を返す・空なら null
  - `報告 HTML に fail と sizeMismatch の行が必ず出る`(生成した文字列を検査)
  - `mask で隠した領域の一覧が報告に出る`
- [ ] **Step 2: 失敗を確認** → FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認** → PASS
- [ ] **Step 5: コミット** — `feat(visual-regress): 差ありだけの報告ページと仕分け`

### Task 8: 合格条件の確認・ルール・README

**Files:**
- Create: `scripts/visual-regress/README.md`, `.claude/rules/visual-regress.md`
- Modify: `docs/TODO.md`(次の最優先を更新)

- [ ] **Step 1: 誤報ゼロの確認(設計書 §5 合格条件 1)** — `node scripts/visual-regress/run.mjs --name=noop1`(作業ツリーに変更なし)を 3 回。3 回とも exit 0。差が出た項目は原因を潰す(乱数・時刻・待ち不足)。どうしても揺れるものだけ `mask` に理由つきで入れる。所要時間を記録し、15 分を超えたら設計書 §10 の順で axes を削る
- [ ] **Step 2: 見逃さないことの確認(合格条件 2)** — `--inject-css` で 3 通り: `.housing-panel{padding-top:calc(var(--x,0px) + 3px)}` 相当のずらし(実在のセレクタで)・`:root{--app-text:#eee}` のような色 1 段・窓の見出し `display:none`。3 回とも exit 1 になり、報告に該当画面が出ること
- [ ] **Step 3: ルールを書く** — `.claude/rules/visual-regress.md`(frontmatter の `paths` は `src/**/*.tsx` `src/**/*.css` `src/styles/**`)。内容: 見た目の整理は前後で `run.mjs` を回し、仕分け済みの報告を添えて完了報告すること / 中身の整理は先に動きのテストを足すこと / 新しい窓・画面はカタログに足すこと(漏れは Task 9 のテストが落とす)/ 作業中は `--only`、全体は区切りの最後に 1 回
- [ ] **Step 4: README** — 使い方・終了コード・仕分けの手順(verdicts.json の書き方)・トークン節約(crops だけ見る)
- [ ] **Step 5: コミット** — `docs(visual-regress): 使い方とリファクタ時の決まり`

### Task 9: カタログ漏れの検査

**Files:**
- Test: `scripts/visual-regress/__tests__/coverage.test.ts`

**Interfaces:**
- Consumes: 全カタログの `covers` と `_later.mjs`

- [ ] **Step 1: テストを書く** — `coverage.test.ts`
  - `src/` 配下(`__tests__` を除く)で `ModalShell` / `HousingPanelModal` / `MobileBottomSheet` / `ConfirmDialog` を import して JSX で使う `.tsx` の部品名(ファイル名)を集める
  - 殻を使わない窓の手書き一覧(テスト内の定数。付録 A の「/miti の非 Shell ポップ」約 30 と、ハウジングの role=menu 類)を足す
  - `src/App.tsx` のルート定義からルート一覧を取る(dev 専用の `/housing/dev/*` と転送だけのルートは除外)
  - 期待: 全部が「どれかのカタログ項目の `covers`」か「`_later.mjs`」に入っている。入っていなければ `カタログに無い窓: X(scripts/visual-regress/catalog/ に足すか _later.mjs に理由つきで書く)` で落ちる
  - `_later.mjs` の各行に `reason` がある
  - 未使用の窓(SaveDialog・src/components/CsvImportModal・HousingOnboardingDialog・HousingToast)は除外一覧に入れる
- [ ] **Step 2: 実行** — `npx vitest run scripts/visual-regress/__tests__/coverage.test.ts` → PASS(Task 6 の covers が埋まっていれば通る。落ちたら Task 6 側に足す)
- [ ] **Step 3: 検出力の確認(使い捨て)** — 手書き一覧から 1 件消すと落ちることを確認して戻す
- [ ] **Step 4: 全体の確認とコミット** — `npm run test:gate` が失敗 0。`test(visual-regress): 新しい窓・画面のカタログ漏れを落とす`

---

## 付録 A: 窓の開き方の要点(2026-10-26 調査)

- 初回の自動窓: PC は 500ms 後にチュートリアル(`MitiPlannerPage.tsx:79`)、スマホは 600ms 後に MobileGuide(`:76`)。抑止キーは Global Constraints を参照。共有ボタンは share チュートリアル未完了だと自動開始(`collab/useShareFlow.tsx:41`)。
- ShareModal は開くと `/api/share` に POST する(`ShareModal.tsx:80-120`)→ 見本 JSON(`share.create` など)を用意する。
- CustomEvent で開けるもの: `timeline:import`(FFLogs)・`timeline:grid-import`(スプシ取込)・`timeline:party-settings` `{detail:{open:true}}`・`timeline:autoplan`・`mobile:phase-jump` / `mobile:label-jump` / `mobile:mechanic-search`・`mobile:open-cue-sheet`・`milspec:new-plan`。
- キー: `P`=フェーズ、`T`=時間入力、`L`=ギミック、`A`=攻撃検索(`Timeline.tsx:2692-2737`)。
- store を直接開けるもの(dev で `import('/src/store/xxx.ts')`): `useHousingModalStore.openLogin()`・`useLocalImportDialog.open()`・`useMitigationStore.setToolMode('memo')`・`aetherflowChainPrompt` の setState・`useShareImportFlow.start(id)`・`useTutorialStore.startTutorial('main')`。
- 目印: ModalShell 系は `[data-modal-shell]` と `role="dialog"`、ハウジングは `.housing-panel-modal-backdrop[role=dialog]` / `.housing-modal-backdrop`、MobileBottomSheet は `[data-no-pull-refresh]`、ハウジングのメニューは `role="menu"`。/miti のポップ(ImportMenu・HeaderToolsMenu・LanguageSwitcher・AASettings・ClearMitigations・PartyStatusPopover)は role が無い → 個別セレクタか `data-testid`。
- ボタンの特定: /miti は aria-label・`data-tutorial`(`party-comp` `share-copy-btn` `new-plan-btn`)・Tooltip の文言(ja.json の実際の文字列)。MIL-SPEC は `data-testid` が 0 なので aria-label で。
- 未使用の窓: `SaveDialog.tsx`・`src/components/CsvImportModal.tsx`・`HousingOnboardingDialog.tsx`・`HousingToast.tsx`。
