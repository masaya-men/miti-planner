# CSS のテーマ指定を部品から抜く Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 部品のファイルからテーマの分かれ道を無くし(値は変数・MIL-SPEC の描き変えは MIL-SPEC のフォルダ)、枠の素材を改名し、層の順番を 1 か所で宣言し、2 本の見張りで固める。見た目は 1 px も変えない。

**Architecture:** 色の分かれ道は「部品は `var(--x)` を読むだけ・値は `tokens-dark.css`(`:root, .theme-dark`)/`tokens-light.css`(`.theme-light`)/ハウジングは `housing/tokens.css`」へ。一致の確かめは 2 段: (1) 新しい道具 `computed-probe` が各テーマで対象要素の計算後スタイルを JSON に吐き、作業前と比べる(撮影で届かない状態も確実に比べられる) (2) 既存の visual-regress を基準 `pre-t16` と比べる。

**Tech Stack:** CSS(Tailwind v4)・React/TS・Vitest(見張り)・Playwright(probe・visual-regress)

**Spec:** `docs/superpowers/specs/2026-10-29-theme-out-of-parts-design.md`

## Global Constraints
- 見た目は変えない: 各テーマ(light / dark / military+dark / military+light)で計算後の値が作業前と同一。
- 作業場所 `.claude/worktrees/milspec-polish`・ブランチ `milspec-polish`・push しない。
- `standard-*.css` の中身は書き換えない(例外: Task 6 の名前だけの置き換え)。
- MIL-SPEC 専用部品の `.theme-military` 前置きは触らない。`theme-reveal.css`・管理画面の見た目は触らない。
- ハウジングの CSS は `.claude/rules/housing-design.md` に従う。CSS 全般は `.claude/rules/css-rules.md`(blur 直書き禁止など)。
- 定義の無い var() の既存違反は直さない(直すと見た目が変わる)。一覧に載せるだけ。
- 1 ファイル 1 仕事・500 行を超えない。コメントは日本語。
- 1 部品(ファイル)ごとに commit。テストは対象を絞って回し、全体は Task 9 の `npm run test:gate` だけ。

## Review Focus
- ダークで今「指定なし」だった性質を変数にした時、ダーク側の既定値が今の計算後の値と違う(例: 影なし→`none` を入れ忘れ、別規則の値を上書き) → probe の dark 列で一致すること(Task 2〜4 の Step「probe compare」)。
- MIL-SPEC はライト/ダークのクラスも同時に付く: `.theme-military.theme-light` で、新しい変数が `semantic-tokens.css` の差し替えに負けて/勝って値が変わる → probe に military+light / military+dark を必ず含める(Task 1 の THEMES)。
- sheet.css の移動で読み込み順が `standard-table.css` より前になり、同じ強さの規則で負ける → 移動先は `military.css` で `standard-table.css` の直後に import・probe の military 列で一致(Task 5)。
- 改名漏れで `.glass-tier3` が残った部品だけ素材が外れる(背景が透明になる) → 見張りテストで旧名 0 件(Task 6 Step 1)。
- GridOverlay の光パルスがテーマ切替の直後に古い色のまま → store の値を毎フレーム `getState()` で読む(購読でなく)ことを Task 7 のテストで確かめる。

---

### Task 1: 一致を確かめる道具と作業前の基準

**Files:**
- Create: `scripts/theme-out/computed-probe.mjs`(probe 本体)
- Create: `scripts/theme-out/probes.mjs`(対象の一覧=データ)
- Create: `scripts/theme-out/README.md`(使い方 10 行以内)

**Interfaces:**
- Produces: `node scripts/theme-out/computed-probe.mjs --save=<名前>` → `.out/theme-out/<名前>.json` / `--compare=<名前>` → 差があれば表示して exit 1、無ければ exit 0。後の全タスクが使う。

- [ ] **Step 1:** `probes.mjs` に対象を列挙する。1 件 = `{ id, route, mount, targets: [{ selector, pseudo?: '::before'|'::after', props: [...] }] }`。`mount` は対象の DOM を作る HTML 文字列(画面の状態に頼らず `document.body` に差し込む。例: `<div class="no-plan"><div class="empty-plan-scrim"></div>…</div>`)。対象は設計書の表の全部: `.empty-plan-scrim`(+`::before`/`::after`)・`.empty-glass-corner-{tl,tr,bl,br}`・`.empty-glass-sheen`・`.plan-memo`・`.conflict-chevron`・`.miti-table-wrap`/`.miti-table thead`/`.miti-table td`/`.miti-spinner`・`.glass-frame`・`.glass-tier3`(+`::before`/`::after`)・sheet.css の MIL-SPEC 規則が当たる要素(`.milspec-app` の中に `[data-time-row] > [data-sheet-cols]`・`[data-member-id][data-sheet-cols]`・`[data-sheet-member]`・`[data-sheet-col]`・その中の `img`・`[class*="text-app-"]`・`[data-sheet-cols="0"] .milspec-jack`。sheet.css 36〜 行の規則を全部たどって 1 つずつ要素を作る)・ハウジング(route `/housing`、`.housing-workspace[data-theme=light|dark]` の中に `.housing-scenery`(+疑似)・`.housing-floor-grid`・`.housing-map-img`)。props は各規則に書かれている性質を全部(background・box-shadow・filter・color・border-* など、規則から機械的に拾う)。
- [ ] **Step 2:** `computed-probe.mjs` を書く。既存 `scripts/visual-regress/lib/` の dev サーバー起動を流用できればそれを使い、無理なら `npx vite --port 5183 --strictPort` を自分で起動・停止。THEMES = `[['theme-light'],['theme-dark'],['theme-military','theme-dark'],['theme-military','theme-light']]`。各 probe・各テーマで: route を開く → `<html>` のクラスを THEMES に置き換え(ハウジングは `data-theme` 属性を probe 側で切替)→ `mount` を差し込む → 全 target の `getComputedStyle(el, pseudo)` の props を読む。出力 `{ [probeId]: { [themeKey]: { [selector+pseudo]: { prop: value } } } }`。MIL-SPEC の CSS は MIL-SPEC 表示時だけ読み込まれる物があるので、military のテーマは store 経由で MIL-SPEC に切り替えた状態で測る(`localStorage` のテーマ保存値+DEV の閲覧権限。`scripts/visual-regress/catalog/miti-milspec.mjs` の storage の作り方を真似る)。
- [ ] **Step 3:** 検出力を確かめる: 一時的に `src/components/Memo/memo.css` の `.theme-light .plan-memo` の 1 値を変えて `--save=probe-check-a` → 戻して `--compare=probe-check-a` が exit 1 で `.plan-memo` の theme-light だけを指すこと。確認後、変更は戻す(commit しない)。
- [ ] **Step 4:** 基準を保存: `node scripts/theme-out/computed-probe.mjs --save=pre-t16`(2 回撮って同一なこと=`--compare=pre-t16` が exit 0)と `node scripts/visual-regress/run.mjs --save-as=pre-t16`(約 21 分・バックグラウンド可)。
- [ ] **Step 5:** commit `chore(theme-out): 計算後の見た目を比べる道具と作業前の基準`

### Task 2: 表まわりの色を変数へ(Timeline.css・memo.css・ConflictOffscreenArrows.css)

**Files:**
- Modify: `src/components/Timeline.css:53-110`(`.theme-light` 13 か所)
- Modify: `src/components/Memo/memo.css:39`
- Modify: `src/components/timeline/ConflictOffscreenArrows.css:15`
- Modify: `src/styles/base/tokens-dark.css`・`src/styles/base/tokens-light.css`(変数の追記)

**Interfaces:**
- Consumes: Task 1 の probe と基準 `pre-t16`
- Produces: 変数(名前は作り手。意味で付ける。例 `--empty-scrim-bg`・`--empty-scrim-shadow`・`--empty-scrim-edge-v`・`--empty-scrim-edge-h`・`--empty-corner-{tl,tr,bl,br}`・`--empty-sheen`・`--plan-memo-*`・`--conflict-chevron-filter`)

- [ ] **Step 1:** 各規則の値を変数に置き換える: 部品側は素の規則で `var(--x)` を読むだけ、ダークの値(=今の素の規則の値。素の規則に無い性質は今の計算後の値=多くは `none`)を `tokens-dark.css`、ライトの値を `tokens-light.css` へ。`.theme-light` の規則は部品のファイルから消える。
- [ ] **Step 2:** probe compare: `node scripts/theme-out/computed-probe.mjs --compare=pre-t16` → exit 0(4 テーマとも差 0)。
- [ ] **Step 3:** visual-regress: `node scripts/visual-regress/run.mjs --compare=pre-t16 --only=page-` → 一致(差は前後同時撮りで揺れか確かめる。既知の揺れ=milspec/page-lanes)。
- [ ] **Step 4:** 3 ファイルそれぞれ commit(`refactor(css): 〇〇のライト用の色をテーマの変数へ`)

### Task 3: 軽減表のプレビューとガラスの縁を変数へ(MitigationSheetPreview.css・glass.css の .glass-frame)

**Files:**
- Modify: `src/components/MitigationSheetPreview.css:16,39,64,151`
- Modify: `src/styles/base/glass.css:25-32`(`.theme-light/.theme-dark .glass-frame`)
- Modify: `src/styles/base/tokens-dark.css`・`tokens-light.css`

- [ ] **Step 1:** Task 2 Step 1 と同じ手順で変数へ。`.glass-frame` はダーク側にも明示の規則があるので両方の値を移す。
- [ ] **Step 2:** probe compare `pre-t16` exit 0。
- [ ] **Step 3:** visual-regress `--compare=pre-t16 --only=share`(プレビューが出る画面)と `--only=page-` 一致。
- [ ] **Step 4:** ファイルごとに commit

### Task 4: ハウジングの背景と地図を変数へ(SceneryVideo.css・ward-map.css)

**Files:**
- Modify: `src/components/housing/workspace/SceneryVideo.css:21-45`
- Modify: `src/styles/housing/ward-map.css:16,29`
- Modify: `src/styles/housing/tokens.css`(`.housing-workspace[data-theme="light"|"dark"]` の節に追記。無ければその節を作る)

- [ ] **Step 1:** 変数名は `--housing-` で始める(ハウジングの決まり)。部品側は `var()` を読むだけ。`[data-theme]` の規則は部品のファイルから消える。
- [ ] **Step 2:** probe compare `pre-t16` exit 0(ハウジングの probe はライト/ダークの 2 列)。
- [ ] **Step 3:** visual-regress `--compare=pre-t16 --only=housing/` 一致。
- [ ] **Step 4:** ファイルごとに commit

### Task 5: スプシ表示の MIL-SPEC 規則を MIL-SPEC のフォルダへ(sheet.css)

**Files:**
- Create: `src/styles/military/standard-sheet.css`(sheet.css の `.theme-military` の規則 14 か所を前後のコメントごと一字一句)
- Modify: `src/components/timeline/sheet/sheet.css`(該当規則を削除)
- Modify: `src/styles/military.css:15`(`standard-table.css` の直後に `@import "./military/standard-sheet.css";`)
- Modify: `src/components/military/__tests__/militaryCssColocation.guard.test.ts:28` 付近(理由の一覧に `'standard-sheet.css': 'スプシ表示の列を .theme-military で描き変える。standard-table.css の行の規則より後に読む'`)

- [ ] **Step 1:** 移す。sheet.css の 34 行目のコメントは参照先の説明なので移動先へ一緒に持っていき、sheet.css 側には「MIL-SPEC での描き変えは src/styles/military/standard-sheet.css」1 行を残す。
- [ ] **Step 2:** `npx vitest run src/components/military/__tests__/militaryCssColocation.guard.test.ts src/styles/__tests__/` PASS。
- [ ] **Step 3:** probe compare `pre-t16` exit 0(military の 2 列)・`node scripts/css-colocation/compare-build.mjs` 欠け 0・visual-regress `--compare=pre-t16 --only=page-sheet` 一致。差が出たら中身は変えず import の位置だけを調整する。
- [ ] **Step 4:** commit `refactor(css): スプシ表示の MIL-SPEC の描き変えを MIL-SPEC のフォルダへ`

### Task 6: 枠の素材の改名(.glass-tier3 → .frame-surface)と使われない掛け戻しの削除

**Files:**
- Modify: `src/styles/base/glass.css`(クラスと付属クラス)・`tokens-dark.css`・`tokens-light.css`(`--glass-tier3-*` → `--frame-surface-*`)・`src/styles/military/semantic-tokens.css`・`src/styles/military/standard-revert.css`
- Modify: TSX 10 本(`AppFooter`・`CollabJoinerPage`・`ConsolidatedHeader`・`Sidebar`・`WelcomeSetup`・`admin/CsvImportModal`・`admin/FflogsTranslationModal`・`header/HeaderCollapseHandle`・`layout/FocusModeRail`・`sidebar/SidebarHandle`)
- Modify: `src/styles/base/float-surface.css`(コメント内の参照)・テスト `floatSurface.guard.test.ts`・`floatSurface.shells.test.tsx`・`src/styles/__tests__/floatSurface.test.ts`・`military-overlay-island.test.ts`・`militaryCssColocation.guard.test.ts`・`scripts/milspec-sp2/military-smoke/steps-{a,e}.mjs`
- Test: `src/styles/__tests__/frameSurface.rename.test.ts`

**Interfaces:**
- Produces: クラス `.frame-surface`・変数 `--frame-surface-{bg,blur,border,shadow,inset}`(名前は作り手が変えてよいが、変えたら Task 8 の見張りの説明にも合わせる)。`glass.css` はファイル名も仕事に合わせて `frame-surface.css` に改名し `src/index.css` の import を直す(`.glass-frame` 等の付属クラスが他の仕事なら残す)。

- [ ] **Step 1:** 失敗テスト: `frameSurface.rename.test.ts` — `src/**/*.{css,ts,tsx}` と `scripts/**/*.mjs`(テスト自身を除く)に `glass-tier3` の文字列が 0 件。今は FAIL。
- [ ] **Step 2:** 掛け戻しを実測: MIL-SPEC の画面(dev・military)で窓を数種類開き、`document.querySelectorAll('.milspec-app .glass-tier3').length` が常に 0 か確かめる(visual-regress の milspec/win-* の開き方を使う)。0 なら `standard-revert.css` の `.glass-tier3` を含むセレクタの部分と `--std-glass-tier3-*` を削除、1 以上なら改名に合わせる。結果を commit メッセージに書く。
- [ ] **Step 3:** 名前を置き換える(1 commit)。
- [ ] **Step 4:** `npx vitest run src/styles/__tests__ src/components/ui/__tests__ src/components/military/__tests__` PASS(rename テストを含む)。
- [ ] **Step 5:** probe compare(`.glass-tier3` の probe は新しい名前で同じ値になるよう `probes.mjs` の selector を書き換えてから比べる。値の比較は旧名の基準と新名の今)exit 0・visual-regress `--compare=pre-t16` 全体一致。
- [ ] **Step 6:** commit `refactor(css): ヘッダー等の枠の素材を仕事の名前に改名`

### Task 7: GridOverlay の明るさを store から読む

**Files:**
- Modify: `src/components/GridOverlay.tsx:165-166`
- Test: `src/components/__tests__/GridOverlay.theme.test.ts`(既存のテストがあればそこへ足す)

- [ ] **Step 1:** 失敗テスト: 描画のたびの明るさ判定を関数 `isDarkTheme(): boolean`(`GridOverlay.tsx` 内または隣の小さなファイル)に出し、`useThemeStore.setState({ theme: 'light' })` → `false`、`'dark'` → `true`、`<html>` のクラスを逆にしても store の値が勝つこと。
- [ ] **Step 2:** `isDarkTheme = () => useThemeStore.getState().theme === 'dark'` で実装し、165 行を置き換える(フレームごとに `getState()`。購読しない)。
- [ ] **Step 3:** テスト PASS・`npx tsc -b` 0。
- [ ] **Step 4:** commit

### Task 8: 層の順番の宣言と見張り 2 本

**Files:**
- Modify: `src/index.css:1`(先頭に `@layer theme, base, components, utilities;` と理由コメント 2 行=「層の外の CSS は部品の見た目で、ユーティリティより強い。これが今の決まり」)
- Modify: `src/components/PartySettingsModal.css:2`(`@layer components` の理由をコメントで説明できなければ層を外す。外すなら probe に `PartySettingsModal` の該当要素を足して前後一致・visual-regress `--only=party` 一致)
- Create: `src/architecture/__tests__/themeInParts.test.ts`・`src/architecture/__tests__/undefinedCssVars.test.ts`・`src/architecture/undefined-css-vars.json`(許可一覧=データ)

- [ ] **Step 1:** `themeInParts.test.ts`: `src/**/*.css` で `/\.theme-(light|dark|military)\b|\[data-theme\b|\.milspec-app\b/` を含む規則のあるファイルが、許可(`src/styles/military/**`・`src/components/military/**`・`src/styles/base/tokens-*.css`・`src/styles/base/global.css`・`src/styles/housing/tokens.css`・`src/styles/housing/theme-reveal.css`)の外に 0 件。TS/TSX(`__tests__` 除く)で `classList.contains('theme-` が 0 件(`useThemeStore.ts`・`dev/MilspecTunePanel.tsx` は許可)。テストのメッセージは「テーマの値は tokens に・MIL-SPEC の描き変えは styles/military へ」と直し方を言う。
- [ ] **Step 2:** `npx vitest run src/architecture/__tests__/themeInParts.test.ts` PASS(Task 2〜7 の後なので 0 件のはず。落ちたら漏れを直す)。試しに memo.css に `.theme-light .plan-memo{}` を足して FAIL を確かめ、戻す。
- [ ] **Step 3:** `undefinedCssVars.test.ts`: 定義の集合 = `src/**/*.css` の `--x:` ∪ `src/**/*.{ts,tsx}` の `'--x'`/`"--x"`/`` `--x` ``(style 書き込み)∪ Tailwind v4 が作る変数(`--tw-*`・`--color-*`・`--radius-*` など `@theme` 由来は `src/index.css` の `@theme` から拾う)。使用 = `var(--x)`(第 2 引数=代わりの値があるものは除く)。使用−定義−許可一覧 が 0 件。許可一覧 JSON は `{ "--x": "理由" }`、理由が「要確認」の物は打ち間違いの疑い。一覧に載っているのに使われなくなった名前も FAIL(消し忘れ防止)。
- [ ] **Step 4:** 今の違反を数えて JSON に載せる(直さない)。打ち間違いに見える物は理由を `要確認: <近い名前>` に。件数と要確認の一覧を commit メッセージと台帳に書く。テスト PASS。
- [ ] **Step 5:** `src/index.css` の宣言を入れ、probe compare `pre-t16` exit 0・visual-regress `--compare=pre-t16` 全体一致。
- [ ] **Step 6:** commit(宣言/見張り 1/見張り 2 を別々に)

### Task 9: 仕上げの確かめと記録

- [ ] **Step 1:** `npm run test:gate` 失敗 0・`npm run build` 0・`npm run lint` 0・`npx tsc -b` 0。
- [ ] **Step 2:** `node scripts/theme-out/computed-probe.mjs --compare=pre-t16` exit 0・`node scripts/visual-regress/run.mjs --compare=pre-t16` 全体一致(差は前後同時撮りで揺れと確定させ理由を書く)。
- [ ] **Step 3:** `docs/TODO.md` の現在の状態を更新(Task 16 完了・次=⑤Task 14・要確認の var 一覧があれば masaya への報告事項として)。`docs/superpowers/plans/2026-10-28-ideal-finish.md` の Task 16 にチェック。台帳 `.superpowers/sdd/2026-10-28-ideal-finish/progress.md` に 1 行。
- [ ] **Step 4:** commit `docs(TODO): Task 16 完了`
