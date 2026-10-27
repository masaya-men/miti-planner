# ハウジング CSS を部品の隣へ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/styles/housing/` の番号ファイル 71 本の規則を、 持ち主の部品(.tsx)の隣の `<部品名>.css` へ機械で移し、 見た目を 1 画素も変えずに「順番頼り」を無くす。

**Architecture:** 手で切り貼りせず、 道具 3 本で行う。 ①規則を読む共通部品(PostCSS で規則・@media・詳細度・対象 class を取り出す)②ビルド比較(minify なしでビルドし、 規則の集まりと「順番頼りの組」の前後を基準と比べる)③移す道具(各規則の持ち主を JSX から判定し、 元の並びを保って書き出し、 部品に import を足す)。 持ち主の判定が割れる所は道具内の上書き表で決める。

**Tech Stack:** Node 24 / PostCSS 8(直接依存済み)/ Vite 7 の `build()` を JS から呼ぶ / vitest(`scripts/**/__tests__/**/*.test.ts` が対象)

**Spec:** `docs/superpowers/specs/2026-10-28-housing-css-colocation-design.md`

## Global Constraints

- 見た目の変化ゼロ。 visual-regress `--compare=dpr2 --only=housing/` が全件一致(基準 `scripts/visual-regress/.out/baselines/dpr2`・10-28 撮り直し済)。
- 規則は消さない・直さない・二重にしない(使われていない規則も持ち主の候補へ移して残す)。
- 置き場所 = 持ち主 .tsx と同じフォルダ・同じ名前の `.css`。 部品が `import './<名前>.css';` する。
- 共有として `src/styles/housing/` に残すのは トークン(00)・外枠(01・27 のうち持ち主が `shell/` の部品 or 持ち主なしの規則)・倍率(68・69・70)だけ。 番号は外して意味の名前にする。
- 部品 CSS 同士の「順番頼りの組」は最後に 0。
- 1 ファイル 500 行以下(`src/architecture/__tests__/file-size.test.ts`)。
- コミットは日本語・末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。 push しない。

## 用語(全タスク共通)

- **規則の鍵** = `media`(外側から順に @media/@supports の条件を ` && ` で連結・無ければ空文字)+ `selector`(空白を 1 つに正規化)。
- **対象 class** = セレクタを結合子(空白 `>` `+` `~`)で切った最後の部分(複合セレクタ)に含まれる `housing-` で始まる class。 最後の部分に無ければ、 セレクタ全体で最後に出てくる `housing-` class。 `:is()/:not()/:where()` の中は数えない。
- **詳細度** = [id, class・属性・疑似クラス, 要素・疑似要素]。 `:where()` は 0、 `:is()/:not()` は中の最大。
- **順番頼りの組** = 2 規則 A(先)・B(後)で、 media が同じ・詳細度が同じ・対象 class が 1 つ以上共通・同じ性質(カスタムプロパティ含む)を宣言、 のすべてを満たすもの。

## Review Focus

1. スマホ幅(767px 以下)の上書き(元 61・62・63)が部品へ散った後も効く — Task 3 の比較で「@media 付き規則の組」の前後が守られていることを確認。
2. `:root` やタグだけの規則(housing class なし)が勝手に部品へ移らない — Task 4 のテスト `持ち主なしの規則は元の番号ファイルの主な持ち主へ` / `共有ファイルの規則は動かない`。
3. `@keyframes` が使う側と離れても名前が 1 つだけ — Task 4 のテスト `同名 keyframes が 2 つあれば止まる`。
4. どの部品からも読まれない CSS ファイルが出ない — Task 6 の見張りテスト。
5. 倍率の生成道具(center-tokens)の出力が移行前後で一字一句同じ — Task 7。

---

### Task 1: 規則を読む共通部品

**Files:**
- Create: `scripts/housing-css/cssRules.mjs`
- Test: `scripts/housing-css/__tests__/cssRules.test.ts`

**Interfaces:**
- Produces:
  - `parseRules(cssText: string, file: string): Rule[]` — `Rule = { file, index, media, selector, selectors: string[], props: string[], decls: string, node }`。 @keyframes / @font-face は `{ kind: 'atrule', name, params }` として同じ配列に並べる(`kind: 'rule'` が通常)。 `index` はファイル内の通し番号。
  - `specificity(selector: string): [number, number, number]`
  - `subjectClasses(selector: string): string[]`
  - `findOrderPairs(rules: Rule[]): Array<[Rule, Rule, string]>` — 渡した並び順で A が先。 3 つ目は共通の性質名。 規則が複数セレクタなら、 セレクタ同士の全組で判定(どれか 1 組でも満たせば組)。

- [ ] **Step 1: 失敗するテストを書く**(`cssRules.test.ts`)
  - `specificity('.a .b:hover')` → `[0,3,0]` / `specificity('html:root .x')` → `[0,2,1]` / `specificity(':where(.a) .b')` → `[0,1,0]` / `specificity('.a:not(.b, #c)')` → `[1,1,0]`
  - `subjectClasses('.housing-a .housing-b.is-open > span')` → `['housing-b']`(右端 `span` に housing class が無いので全体の最後)/ `subjectClasses('.housing-a .housing-b.housing-c')` → `['housing-b','housing-c']`
  - `parseRules('@media (max-width: 767px){ .housing-a{color:red} }','x.css')[0].media` → `'(max-width: 767px)'`
  - `findOrderPairs` : `.housing-a{color:red}` と `.x .housing-a{color:blue}` → 組 0 件(詳細度違い)/ `.housing-a{color:red}` と `.housing-a{color:blue}` → 1 件 `'color'` / 同じ 2 規則で片方だけ @media → 0 件
- [ ] **Step 2: 実行して落ちることを確認** — `npx vitest run scripts/housing-css/__tests__/cssRules.test.ts` → FAIL(モジュールなし)
- [ ] **Step 3: 実装**(PostCSS の `parse` と walk。 セレクタの切り分けは自前の小さな字句解析でよい=括弧の深さと文字列を見る)
- [ ] **Step 4: 通ることを確認** — 同コマンド PASS
- [ ] **Step 5: コミット** `chore(housing-css): CSS 規則を読む共通部品`

### Task 2: ビルド比較の道具+移行前の基準保存

**Files:**
- Create: `scripts/housing-css/compare-build.mjs`
- Test: `scripts/housing-css/__tests__/compareBuild.test.ts`

**Interfaces:**
- Consumes: Task 1 の `parseRules` `findOrderPairs`
- Produces:
  - CLI `node scripts/housing-css/compare-build.mjs --save-as=<名前>` / `--compare=<名前>` — Vite の `build()` を `{ build: { cssMinify: false, outDir: <一時>, emptyOutDir: true } }` で呼び(約 11 秒)、 `assets/index-*.css` を `.out/<名前>.css` に保存(`scripts/housing-css/.out/` は .gitignore に足す)。 compare は終了コード 0/1。
  - `compareCss(baseCss: string, nextCss: string): { missing: string[], extra: string[], flipped: Array<{a: string, b: string, prop: string}> }`(純関数・テスト対象)。 規則の同一性は「鍵+宣言の正規化文字列+同じものの何個目か」。 `flipped` = 基準 CSS 内の順番頼りの組のうち、 次の CSS で前後が逆になったもの。

- [ ] **Step 1: 失敗するテスト** — `compareCss` に対し: 同じ CSS → 全部空 / 規則を 1 つ消す → `missing` 1 / 同じ規則を 2 回 → `extra` 1 / `.housing-a{color:red}.housing-a{color:blue}` を逆順に → `flipped` 1 / 組でない 2 規則の入れ替え → `flipped` 0
- [ ] **Step 2: 落ちることを確認** — `npx vitest run scripts/housing-css/__tests__/compareBuild.test.ts`
- [ ] **Step 3: 実装**(CLI 部分は `import.meta.url` が実行ファイルの時だけ動かす)
- [ ] **Step 4: 通ることを確認**
- [ ] **Step 5: 移行前の基準を保存** — `node scripts/housing-css/compare-build.mjs --save-as=before` → 続けて `--compare=before` が exit 0(missing/extra/flipped すべて 0)であること
- [ ] **Step 6: コミット** `chore(housing-css): ビルド CSS の比較道具`

### Task 3: 移す道具(試走と一覧づくりまで)

**Files:**
- Create: `scripts/housing-css/colocate.mjs`
- Test: `scripts/housing-css/__tests__/colocate.test.ts`

**Interfaces:**
- Consumes: Task 1
- Produces:
  - `planColocation(input): Plan` — `input = { sources: Array<{file, css}>, jsx: Array<{file, text}>, sharedFiles: string[], overrides: Record<string,string> }`。 `Plan = { outputs: Map<出力パス, Rule[]>, kept: Map<共有ファイル, Rule[]>, ambiguous: Array<{cls, candidates}>, crossPairs: Array<[Rule,Rule,string]> }`。 出力パス = 持ち主 .tsx のパスの拡張子を `.css` に替えたもの。
  - CLI `node scripts/housing-css/colocate.mjs --dry-run` → 一覧を `scripts/housing-css/.out/plan.md` に書く(番号ファイル → 移し先と規則数 / 割れた class / 部品同士の順番頼りの組)。 `--write [--only=<components/housing 以下のフォルダ名,…>]` → ファイル書き出し+import 追加+番号ファイルから削除。
- 持ち主の決め方(この順):
  1. 規則の各セレクタの対象 class → `overrides[class]`(.tsx パス)があればそれ。
  2. その class を文字列として含む `src/**/*.tsx`(`__tests__` 除く)が 1 本 → それ。
  3. 複数 → その中で「同じ番号ファイルの class を最も多く含む .tsx」(同数は パスの辞書順で先)。 `ambiguous` に記録。
  4. 0 本(使われていない class・housing class なし)→ その番号ファイルで最も多くの規則の持ち主になった .tsx。
  5. 規則のセレクタごとに持ち主が違う → 最初のセレクタの持ち主(`ambiguous` に記録)。
  6. 共有ファイルの規則は動かさない。 ただし `01`・`27` の規則は、 持ち主が `src/components/housing/shell/` 以外の .tsx なら移す。
  7. `@keyframes 名前` → 同じ番号ファイル内でその名前を `animation`/`animation-name` に使う最初の規則の持ち主。 無ければ 4 と同じ。
- 書き出しは、 移行前の入口の連結順(番号順・各ファイル内の順)をそのまま保ち、 @media の入れ子は元の条件で包み直す(同じ出力ファイルで連続する同条件はまとめてよい)。 直前のコメントは規則に付けて一緒に動かす。
- 出力ファイルの先頭に 1 行コメント: `/* <部品名> の見た目(ハウジング)。 他の部品の見た目は同じ詳細度で上書きしない。 */`

- [ ] **Step 1: 失敗するテスト**(小さな架空の入力で `planColocation`)
  - `持ち主が 1 つならそこへ`: `.housing-a` を `A.tsx` だけが含む → `A.css` に入る
  - `共有ファイルの規則は動かない`: `00-tokens.css` の `:root{}` は `kept` に残る
  - `持ち主なしの規則は元の番号ファイルの主な持ち主へ`
  - `元の並びを保つ`: 番号 10 の規則が番号 05 より後ろに出る
  - `@media を包み直す`
  - `同名 keyframes が 2 つあれば止まる`(例外を投げる)
  - `部品をまたぐ順番頼りを crossPairs に出す`
- [ ] **Step 2: 落ちることを確認** — `npx vitest run scripts/housing-css/__tests__/colocate.test.ts`
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通ることを確認**
- [ ] **Step 5: 試走** — `node scripts/housing-css/colocate.mjs --dry-run` → `plan.md` を読み、 次を全部その場で解消するまで `overrides` を足す: `crossPairs` が 0 / 出力が 500 行を超えるファイルが無い(超えるなら、 その部品の中の意味のまとまり=子部品の持ち主へ寄せる override で分ける)/ `ambiguous` のうち明らかに違う持ち主(例: 開発専用ページ `housing/dev/*` が普通の画面の規則の持ち主になる)が無い。 `housing/dev/*` と `src/lib/**` は持ち主にしない(候補から外す)。
- [ ] **Step 6: 一覧の記録** — `plan.md` の要約(番号ファイル → 移し先)を台帳 `.superpowers/sdd/2026-10-28-housing-css-colocation/progress.md` に貼る(使われていない class の一覧も=別タスク用)
- [ ] **Step 7: コミット** `chore(housing-css): 規則を持ち主の部品の隣へ移す道具`

### Task 4: 移す(まとまりごと)

まとまりと順番(またがりの少ない順): ① `notifications,report,delete,login,mypage,media,skeleton,edit` ② `register`(`register/page` 含む) ③ `listing,housinger,favorites` ④ `browse`(`browse/map` `browse/tagpicker` 含む) ⑤ `tour` ⑥ `pages,shell,workspace` と直下の部品(`--only=.` で直下)。

各まとまりで:
- [ ] **Step 1:** `node scripts/housing-css/colocate.mjs --write --only=<まとまり>`
- [ ] **Step 2:** `node scripts/housing-css/compare-build.mjs --compare=before` → exit 0(missing/extra/flipped 0)。 flipped が出たら: その組を同じ持ち主へ寄せる override を足して道具でやり直す(`git checkout -- src` で戻してから)。 共有と部品の組なら import の並び(共有を先に)を直す。
- [ ] **Step 3:** `npx vitest run src/components/housing src/__tests__/housing src/lib/housing src/data/housing` → 失敗 0(CSS の場所を読むテストが落ちたら Task 7 の該当分をこのまとまりで先に直す)
- [ ] **Step 4:** `node scripts/visual-regress/run.mjs --compare=dpr2 --only=housing/` を裏で回し、 次のまとまりの Step 1〜3 と並行。 差が出たら手を止めて原因を特定(systematic-debugging)。
- [ ] **Step 5:** コミット `refactor(housing): <まとまり> の CSS を部品の隣へ`

⑥の後、 番号ファイルは共有分だけになる。

### Task 5: 共有ファイルの名前と入口

**Files:**
- Rename: `src/styles/housing/00-tokens.css`→`tokens.css` / `01-shell-frame.css`→`shell-frame.css` / `27-rebuild-shell.css`→`shell-header.css` / `68-scale-pc.css`→`scale-pc.css` / `69-scale-svg-icons.css`→`scale-svg-icons.css` / `70-center-tokens.css`→`center-tokens.css`(中身が空になったものは削除)
- Modify: `src/styles/housing.css`(残った共有の `@import` だけ・先頭コメントを「共有はトークン・外枠・倍率だけ。 部品の見た目は部品の隣」に)

- [ ] **Step 1:** 改名と入口の書き換え(並び順は元の番号順のまま)
- [ ] **Step 2:** `compare-build --compare=before` exit 0 / `npm run build` exit 0
- [ ] **Step 3:** コミット `refactor(housing): 共有 CSS を意味の名前に`

### Task 6: 見張りテスト

**Files:**
- Create: `src/components/housing/__tests__/housingCssColocation.guard.test.ts`

- [ ] **Step 1: テストを書く**(3 つ)
  - `部品の CSS は同じフォルダの .tsx が import している`: `src/components/housing/**/*.css` それぞれに、 同じフォルダの .tsx のどれかに `import './<名前>.css'` がある
  - `共有フォルダは許可一覧だけ`: `src/styles/housing/` のファイル名集合 = 許可配列(各行に「なぜ共有か」のコメント)
  - `部品同士の順番頼りが 0`: `src/components/housing/**/*.css` を全部 `parseRules` → ファイルをまたぐ `findOrderPairs` の組が 0。 失敗時は組の両ファイル名・セレクタ・性質を出す
- [ ] **Step 2:** 通ることを確認 → わざと 1 本の import を消して 1 つ目が落ちること、 別部品の CSS に既存規則と同じセレクタ・同じ性質を足して 3 つ目が落ちることを確認して戻す
- [ ] **Step 3:** コミット `test(housing): CSS の置き場所と順番頼りの見張り`

### Task 7: 道具・テスト・決まりの追従

**Files:**
- Create: `scripts/housing-css/listHousingCss.mjs` — `listHousingCss(root): string[]`= 入口の @import 順の共有ファイル → `src/components/housing/**/*.css` をパスの辞書順
- Modify: `scripts/housing-scale/center-tokens.mjs`・`scripts/housing-scale/convert.mjs`(ファイル一覧を `listHousingCss` に。 出力先は `center-tokens.css`)
- Modify: `src/lib/housing/__tests__/housingScaleCss.test.ts`・`src/data/housing/__tests__/wardMapNodeHiding.test.ts`(読む先を規則の新しい在りかへ。 何を固定するかは変えない)
- Modify: `.claude/rules/housing-design.md` 64・66・74 行目付近(置き場所の段落を設計書 4.5 の文に)・`src/components/housing/**` の .tsx コメントで「housing.css」と書いてある所は、 実際の在りか(`<部品名>.css`)に直す(コメントのみ)

- [ ] **Step 1:** `node scripts/housing-scale/center-tokens.mjs` → `git diff --exit-code src/styles/housing/center-tokens.css` が 0(一字一句同じ)
- [ ] **Step 2:** 該当テスト 2 本 PASS
- [ ] **Step 3:** コミット `chore(housing): CSS の在りか変更に道具・テスト・決まりを追従`

### Task 8: 最終ゲート

- [ ] `npm run build` exit 0 / `npm run test:gate` 失敗 0 / `compare-build --compare=before` exit 0 / visual-regress `--compare=dpr2 --only=housing/` 全件一致 / file-size テスト通過
- [ ] 全体レビュー(fresh・opus)→ 正しさの指摘だけ反映
- [ ] `docs/TODO.md` を更新(完了・次=military.css ほか 3 本を同じ道具で)・台帳に結果
- [ ] `colocate.mjs` はハウジング専用の作りなら military 用に一般化するかを次の計画で判断(この計画では残す)
