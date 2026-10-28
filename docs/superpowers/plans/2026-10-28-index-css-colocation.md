# index.css を部品の隣へ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/index.css`(1478 行)のうち部品専用の規則を持ち主の部品の隣の `<部品名>.css` へ機械で移し、 土台を `src/styles/base/` に意味の名前で分ける。 見た目は 1 画素も変えない。

**Architecture:** MIL-SPEC と同じ 2 段構え。 先に index.css を行範囲で「土台の共有ファイル」と「移す待ち」に機械的に切り(連結は元と一字一句同じ・入口は Tailwind の 3 行+`@import`)、 次に `scripts/css-colocation/colocate.mjs --scope=index` で移す待ちを持ち主へ配る。 `render()`(`planColocation.mjs:283`)は親の @ 規則を全部包み直すので `@layer` も保たれる(Task 3 でテストで確かめる)。

**Tech Stack:** Node 24 / PostCSS 8 / Vite 7 の `build()` / Tailwind v4(`@tailwindcss/vite`)/ vitest

**Spec:** `docs/superpowers/specs/2026-10-28-index-css-colocation-design.md`(前例: `docs/superpowers/plans/2026-10-28-military-css-colocation.md`・台帳 `.superpowers/sdd/2026-10-28-military-css-colocation/progress.md`)

## Global Constraints

- 見た目の変化ゼロ。 最後に visual-regress `--compare=dpr2` **全体 323 件一致**(基準 `scripts/visual-regress/.out/baselines/dpr2`)。
- 規則は消さない・直さない・二重にしない。 使われていない規則は `src/styles/base/unused/` へ元の段のまま移し、 入口から読む。
- 移した規則は元と同じ段(段の外 / `@layer base` / `@layer components`)に置く。
- 置き場所 = 持ち主 .tsx と同じフォルダ・同じ名前の `.css`。 部品が `import './<名前>.css';` する。 同名 CSS が既にあれば末尾に足す。
- 入口 `src/index.css` = `@import "tailwindcss";` `@source not "../docs/**";` `@custom-variant dark (...)`(+Task 1 の結果次第で `@theme`)と `@import` だけ。
- 詳細度を上げる書き換えは禁止。 順番の入れ替わりが出たら、 上書きされる側を共有に残す。
- 部品 CSS 同士の順番頼りの組は最後に 0。
- 1 ファイル 500 行以下(`src/architecture/__tests__/file-size.test.ts`)。 1 ファイル 1 仕事。
- `MitigationSheet.css`・`stgy.css`・housing・military の CSS は触らない(道具の直しで housing/military の結果が変わらないことだけ確かめる)。
- 既知の失敗 `military-smoke`(step1)は確認に使わない。
- コミットは日本語・末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。 push しない。
- 台帳 = `.superpowers/sdd/2026-10-28-index-css-colocation/progress.md`(各タスクの結果・overrides の理由・unused 一覧・Task 1 の実証結果)。

## 用語(全タスク共通)

MIL-SPEC 計画の「用語」と同じ(規則の鍵・対象 class・詳細度・順番頼りの組・起動時の部品/後読みの部品)。 違い: 対象 class は接頭辞でなく **一覧**(Task 3 の `scopes/index.mjs` の `CLASSES`)で決める。

## Review Focus

1. Tailwind の段が移した先で変わる(`.btn-tactile` が段の外へ出る等) — Task 3 のテスト `@layer components の規則は移し先でも @layer components に包まれる`。
2. `useTimelinePreviewHighlight.ts` が組み立てる `phase-select-preview`/`label-select-preview`/`preview-highlight` が unused に落ちる — Task 3 のテスト `.ts が組み立てる class は使っている部品が持ち主`。
3. 遅延部品(`CollabJoinerPage`)へ移した規則が housing.css/military.css より後に並んで勝ち負けが変わる — Task 4 Step 2 の compare-build `flipped` 0 と `toLazy` が CollabJoinerPage 分だけ。
4. トークン(`:root`/`.theme-*`)を分けたことで標準テーマと MIL-SPEC のトークンの対応検査が読めなくなる — Task 2 の `themeTokenParity.test.ts` が分けた後のファイル群で通る。
5. 3 部品以上が使う共通部品(`glass-*`・`sidebar-item`・`animate-conflict-pulse`)が 1 部品へ移る — Task 3 のテスト `3 部品以上が使う class は共有に残る`。

---

### Task 1: 移す前の基準+2 つの実証

**Files:** 台帳を作成。 実証の変更は捨てる(`git checkout -- src`)。

- [ ] **Step 1:** 裏で `node scripts/visual-regress/run.mjs --compare=dpr2`(全体・約 11 分)。 差 0 を確認。 差が出たら crops で仕分け、 今回より前の差であることを台帳に記録(要れば `--save-as` で撮り直し)
- [ ] **Step 2:** `node scripts/css-colocation/compare-build.mjs --save-as=pre-index` → `--compare=pre-index` が exit 0
- [ ] **Step 3: 実証 (a)** — `@theme { ... }`(5–79 行)と keyframes `ripple`・`gearSpin` を `src/styles/base/theme.css` へ移し入口から `@import "./styles/base/theme.css";` → `compare-build --compare=pre-index` exit 0 か。 結果を台帳へ。 だめなら `@theme` は入口に残す(以降の Task は台帳の結果に従う)
- [ ] **Step 4: 実証 (b)** — `.btn-tactile`(778–790 行)を `@layer components { }` ごと `src/components/PartySettingsModal.css` へ移し、 `PartySettingsModal.tsx` に `import './PartySettingsModal.css';` → compare-build で missing/extra 0、 かつビルド CSS で `.btn-tactile` が `@layer components` の中にあること(`grep` で確認)。 外れたら止めて報告
- [ ] **Step 5:** `git checkout -- src` で戻す。 台帳をコミット

**Task 1 の結果(10-28 済)**: 見た目の基準 322 一致+1 件は単独撮り直しで一致(並行撮影のぶれ)。 (a) `@theme` を `@import` 先へ移すと 349 規則が消える → **`@theme`+keyframes `ripple`・`gearSpin` は入口に残す**。 (b) `@layer components` は移し先でも保たれる。 ただし部品の隣の CSS は Tailwind の後処理(Lightning CSS)を通らず書き方が変わる(`0.3s`/`.3s`)→ Task 1.5 を追加。

### Task 1.5: compare-build に値の書き方の正規化を足す

**Files:** Modify `scripts/css-colocation/compare-build.mjs`(と必要なら `cssRules.mjs`)・Test `scripts/css-colocation/__tests__/compareBuild.test.ts`(既存があれば足す)

**Interfaces:** Produces `normalizeValue(prop: string, value: string): string` — `lightningcss` の `transform({ minify: true })` を対象ブラウザ指定なしで `a{prop:value}` に掛けた結果の値。 比較の鍵(`@layer|selector|prop:value`)の値部分にこれを使う。 `--raw` で今までどおりの比較

- [ ] **Step 1: 失敗するテスト** — `書き方だけの違いは同じ鍵`: `transition: transform 0.3s x, color 150ms ease` と `transition:transform .3s x, color .15s ease` の鍵が一致 / `中身の違いは別の鍵`: `backdrop-filter: blur(12px)` と `backdrop-filter: var(--tw-backdrop-blur,)` が不一致 / `段が違えば別の鍵`: 同じ宣言で `@layer components` の有無が違えば不一致
- [ ] **Step 2:** FAIL を確認 → 実装 → PASS
- [ ] **Step 3:** `--compare=pre-index`(src 無変更)が 0/0/0 のまま。 housing・military の見張りテストが通る
- [ ] **Step 4:** コミット

### Task 2: 土台を `src/styles/base/` へ切る(部品へはまだ移さない)

**Files:**
- Create: `src/styles/base/` の意味ファイル(例: `tokens-scale.css`・`tokens-dark.css`・`tokens-light.css`・`tokens-columns.css`・`global.css`・`glass.css`・`motion.css`)と `src/styles/base/to-move.css`(移す待ち)。 線引きは作る人。 各 500 行以下
- Modify: `src/index.css`(入口だけに)・`src/architecture/__tests__/file-size-limits.json`(`src/index.css` を `frozen` から外す)
- Modify: `src/styles/__tests__/themeTokenParity.test.ts:54-55`(`readCssBundle('src/index.css')` で連結を読む)・`scripts/css-colocation/__tests__/reachable.test.ts`・`scripts/milspec-sp2/military-smoke/steps-c.mjs`(index.css を文字で読む所)

- [ ] **Step 1:** 行範囲で切る。 `@layer base { ... }` は塊の途中で切るなら各ファイルで `@layer base { }` に包み直す(段は同じ)。 移す待ち = §3 で 1〜2 部品・0 部品の規則。 共有に残す = §4.2(3 部品以上・トークン・全体・Tailwind 設定)
- [ ] **Step 2:** `node scripts/css-colocation/compare-build.mjs --compare=pre-index` exit 0 / `npm run build` exit 0
- [ ] **Step 3:** `npx vitest run src/styles src/architecture scripts/css-colocation` 失敗 0
- [ ] **Step 4:** 裏で `node scripts/visual-regress/run.mjs --compare=dpr2 --only=miti`(`--only` は部分一致 1 つだけ=miti・miti-mobile・miti-milspec を含む)と `--only=site/` の 2 回、 全件一致
- [ ] **Step 5:** コミット

### Task 3: index の設定と道具の直し

**Files:**
- Create: `scripts/css-colocation/scopes/index.mjs`
- Modify(必要な時だけ): `scripts/css-colocation/planColocation.mjs`・`colocate.mjs`
- Test: `scripts/css-colocation/__tests__/indexScope.test.ts`

**Interfaces:**
- Consumes: Task 2 の `src/styles/base/to-move.css`
- Produces: `scopes/index.mjs` の export — `CLASSES: string[]`・`prefixRe: RegExp`(`CLASSES` の完全一致)・`componentsDir = 'src/components'`・`sharedDir = 'src/styles/base'`・`unusedDir = 'src/styles/base/unused'`・`entry = 'src/index.css'`・`sources()`(移す待ちだけを role `move` で返す)・`overrides`・`selectorOverrides`・`header(name)`・`sharedHeader`・`importLine(file)`・`addSharedImports(text, lines)`。 形は `scopes/military.mjs` に合わせる

- [ ] **Step 1: 失敗するテストを書く**(`render` と `planColocation` を `scopes/index.mjs` の設定で小さな CSS に掛ける)
  - `@layer components の規則は移し先でも @layer components に包まれる`: 入力 `@layer components { .btn-tactile{...} }`、 持ち主 `PartySettingsModal.tsx` → 出力が `@layer components {` で始まる
  - `.ts が組み立てる class は使っている部品が持ち主`: `.phase-select-preview .preview-highlight [data-phase-col]` の持ち主が `useTimelinePreviewHighlight.ts` を使う部品(.tsx)になる
  - `3 部品以上が使う class は共有に残る`: 3 つの .tsx が書く class の規則は行き先なし(残す)
  - `0 部品の class は unused へ`: `.water-drop` → `src/styles/base/unused/`
- [ ] **Step 2:** `npx vitest run scripts/css-colocation/__tests__/indexScope.test.ts` → FAIL(設定が無い)
- [ ] **Step 3:** `scopes/index.mjs` を書く。 `CLASSES` = 設計書 §3 の 0〜2 部品の class。 属性セレクタだけの規則(`[data-time-row]`・`.timeline-scroll-container[data-*]`)は `selectorOverrides` で「その属性を付けている部品」へ(要素を描く部品を Grep で確かめ、 1 行の理由を添える)。 `.ts` が組み立てる class は `overrides` で
- [ ] **Step 4:** テスト通過。 `node scripts/css-colocation/colocate.mjs --scope=housing --dry-run` と `--scope=military --dry-run` が直す前と同じ「移行済み」/ `npx vitest run scripts/css-colocation src/components/military/__tests__/militaryCssColocation.guard.test.ts src/components/housing/__tests__/housingCssColocation.guard.test.ts` 失敗 0
- [ ] **Step 5: 試走** — `node scripts/css-colocation/colocate.mjs --scope=index --dry-run` → `.out/plan.md` を読み、 `crossPairs` 0 / `src/dev/**`・テスト・`src/lib/**` が持ち主でない / ambiguous に誤りなし、 になるまで overrides を足す。 移し先一覧を台帳へ
- [ ] **Step 6:** コミット

### Task 4: 移す(まとまりごと)

まとまり(推奨順): ①1 部品だけ(空パネル・LoPo ボタン・リキャスト・エフェクト棒・流れる文字・進捗の詳細・競合の矢印・合流画面)→ ②2 部品(外側へ寄せる)→ ③unused。 各まとまりで:

- [ ] **Step 1:** `node scripts/css-colocation/colocate.mjs --scope=index --write --only=<まとまり>`
- [ ] **Step 2:** `compare-build --compare=pre-index` → missing/extra/flipped 0、 `toLazy` は遅延部品(`CollabJoinerPage` 等)の分だけで台帳の一覧と一致。 flipped が出たら `git checkout -- src` で戻し、 その規則を共有に残す設定を足してやり直す
- [ ] **Step 3:** `npm run build` exit 0 / `npx vitest run <移した部品の __tests__>` 失敗 0
- [ ] **Step 4:** 裏で `node scripts/visual-regress/run.mjs --compare=dpr2 --only=<関係 catalog>` 全件一致。 差は crops で仕分け、 今回の差なら止めて原因特定(systematic-debugging)
- [ ] **Step 5:** コミット。 最後のまとまりの後、 `src/styles/base/to-move.css` が空なら消して入口の import も消す

### Task 5: 見張り・決まり・コメント

**Files:**
- Create: `src/styles/__tests__/baseCssColocation.guard.test.ts`・`.claude/rules/base-css.md`(対象パス `src/styles/base/**`・`src/index.css`・`src/components/**/*.css`〔housing/military 除く〕)
- Modify: コメントで index.css を指す 7 か所(設計書 §3)を移し先へ

- [ ] **Step 1: 見張りテスト**(`militaryCssColocation.guard.test.ts` と同じ作り)
  - `src/styles/base/ には許可一覧のファイルしか無い`(許可一覧の各行に「なぜ共有か」のコメント)
  - `入口 index.css は Tailwind の行と @import だけ`(Task 1 で `@theme` を残したならそれも許可)
  - `CLASSES の規則は持ち主の隣の CSS にあり、 その部品が import している`
  - `部品 CSS 同士の順番頼りの組は 0`
- [ ] **Step 2:** わざと 1 規則を index.css 系へ戻すと落ちることを確かめてから戻す
- [ ] **Step 3:** 決まりのファイル(設計書 §4.5 の文)・コメントの直し
- [ ] **Step 4:** `npx vitest run src/styles scripts/css-colocation` 失敗 0 → コミット

### Task 6: 最終ゲート

- [ ] `npm run build` exit 0 / `npm run test:gate` 失敗 0 / `compare-build --compare=pre-index` exit 0 / file-size テスト通過
- [ ] 裏で visual-regress **全体** `--compare=dpr2` → 323 件一致
- [ ] 台帳に結果、 `docs/TODO.md` の「現在の状態」を更新してコミット
