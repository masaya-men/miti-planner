# MIL-SPEC の CSS を部品の隣へ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/styles/military.css`(1996 行)と既存の部品 CSS 10 本の規則を、 持ち主の MIL-SPEC 部品の隣の `<部品名>.css` へ機械で移し、 テーマの土台だけを `src/styles/military/` に残す。 見た目は 1 画素も変えない。

**Architecture:** ハウジングで作った道具(`scripts/housing-css/`)を、 対象(housing / military)を設定で切り替えられる `scripts/css-colocation/` に作り直して使う。 先に military.css を行範囲で土台と「移す待ち」に機械的に切り(連結は元と一字一句同じ)、 次に道具で移す待ちと既存 10 本を持ち主へ配る。 起動時に読む CSS は常に後読み CSS より前に並ぶので、 土台↔部品の勝ち負けは今と同じに保たれる。 部品↔部品の順番頼りは 0 にして見張る。

**Tech Stack:** Node 24 / PostCSS 8 / Vite 7 の `build()` / vitest(`scripts/**/__tests__/**/*.test.ts` も対象)

**Spec:** `docs/superpowers/specs/2026-10-28-military-css-colocation-design.md`(前例: `docs/superpowers/specs/2026-10-28-housing-css-colocation-design.md`・`docs/superpowers/plans/2026-10-28-housing-css-colocation.md`)

## Global Constraints

- 見た目の変化ゼロ。 visual-regress `--compare=dpr2` の `miti-milspec/` と `miti/` が全件一致(基準 `scripts/visual-regress/.out/baselines/dpr2`)。
- 規則は消さない・直さない・二重にしない。 使われていない規則は `src/styles/military/unused/` へ元の名前で移し、 入口から読む。
- 置き場所 = 持ち主 .tsx と同じフォルダ・同じ名前の `.css`。 部品が `import './<名前>.css';` する。
- 共有 `src/styles/military/` に置けるのは: `palette.css` `semantic-tokens.css` `standard-revert.css` `backdrop.css` `standard-parts.css` `boot-parts.css` `primitives.css` `unused/`。 入口 `src/styles/military.css` は `@import` だけ。
- 詳細度を上げる書き換えは禁止。 両方向の上書きは「2 部品を包む外側の部品」のファイルへ寄せて台帳に理由を残す。 寄せ先が無ければ止めて報告。
- 部品 CSS 同士の順番頼りの組は最後に 0。
- 1 ファイル 500 行以下(`src/architecture/__tests__/file-size.test.ts`)。
- 既知の失敗 `military-smoke`(step1)は今回の確認に使わない。
- コミットは日本語・末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。 push しない。
- 台帳 = `.superpowers/sdd/2026-10-28-military-css-colocation/progress.md`(各タスクの結果・overrides の理由・unused 一覧)。

## 用語(全タスク共通)

ハウジング計画の「用語」と同じ(規則の鍵・対象 class・詳細度・順番頼りの組)。 ただし対象 class の接頭辞は設定で渡す: housing = `housing-`・`housinger-`、 military = `milspec-`(`ms-` で始まる class があれば含める・Task 2 の試走で確認)。
- **起動時の部品** = `reachable('src/main.tsx')` の `staticFiles` に入る .tsx。 **後読みの部品** = `dynamicFiles` に入る .tsx。

## Review Focus

1. 起動時に画面に出る MIL-SPEC 部品(`MilspecStyleToggle` など静的 import 3 か所)の規則が後読みへ移らない — Task 2 のテスト `起動時の部品が持ち主なら boot-parts へ`。
2. 標準の部品を `.theme-military` で描き変える規則が標準の部品の隣へ移らない — Task 2 のテスト `標準の部品が持ち主なら standard-parts へ`。
3. class を .ts が組み立てる規則(`armor/*.ts`・`fx/engine.ts` 等)が unused に落ちない — Task 2 のテスト `.ts が組み立てる class は import している部品が持ち主` と `テンプレート文字列の接頭辞は使われている扱い`。
4. 既存 10 本を分け直した後、 その古い import が残らない・新しい import が漏れない — Task 4 の見張りテスト 1 つ目。
5. 後読み CSS 同士の並びが開いた順で変わっても見た目が変わらない — Task 4 の見張りテスト 3 つ目(部品同士の順番頼り 0)。

---

### Task 1: 道具を対象切り替え式に作り直す+移行前の基準

**Files:**
- Move: `scripts/housing-css/` → `scripts/css-colocation/`(`__tests__/` ごと。 `.out/` の .gitignore 行も直す)
- Create: `scripts/css-colocation/planColocation.mjs`(`colocate.mjs` から `planColocation` `destOfOwner` `addCssImport` を移す・対象に依らない部分)
- Create: `scripts/css-colocation/scopes/housing.mjs`(今の `colocate.mjs` 304–379 行の OVERRIDES / SELECTOR_OVERRIDES / FILE_FALLBACK / SHARED / FRAME / HEADER と「番号ファイルが無ければ止まる」判定をそのまま)
- Modify: `scripts/css-colocation/colocate.mjs`(CLI だけ。 `--scope=housing|military` で設定を読む)・`cssRules.mjs`・`classGroups.mjs`・`compare-build.mjs`・`listHousingCss.mjs`
- Modify(参照の追従): `src/components/housing/__tests__/housingCssColocation.guard.test.ts`・`scripts/housing-scale/convert.mjs`・`.claude/rules/housing-design.md`(パス `scripts/housing-css/` → `scripts/css-colocation/`)
- Test: `scripts/css-colocation/__tests__/*.test.ts`(既存 6 本を新しい名前に追従+下記を追加)

**Interfaces:**
- Produces:
  - `subjectClasses(selector: string, prefixRe?: RegExp): string[]`(既定 = 今の housing の挙動)
  - `classGroups(jsxTexts: string[], prefixRe?: RegExp)`(同上)
  - `compareBuilds(base: BuildCss, next: BuildCss, related?): { missing, extra, flipped, lazyCross: number }` — `BuildCss = { eager: string, lazy: Array<{ file: string, css: string }> }`。 比べる並び = eager の後に lazy を file 名順。 `flipped` から「両方が別々の lazy ファイルにある組」は外し、 その数を `lazyCross` に出す(後読み同士の並びは実行時に決まるため Task 4 の見張りで判定)。 既存の `compareCss(a, b, related)` は `compareBuilds({eager:a,lazy:[]},{eager:b,lazy:[]})` と同じ結果を返すよう残す。
  - CLI `node scripts/css-colocation/compare-build.mjs --save-as=<名前> | --compare=<名前>` — ビルドの `assets/*.css` を全部読み、 `index-*.css` を eager・他を lazy として `.out/<名前>.json` に保存。 lazy のファイル名はハッシュを除いた名前で持つ。
  - `scopes/<名前>.mjs` の形: `{ prefixRe, componentsDir, sharedDir, unusedDir, entry, sources(): Array<{file, css, role}>, overrides, selectorOverrides, fileFallback, header(name) }`。 `role` = `'shared'`(動かさない)/ `'frame'`(条件付きで動かす)/ `'pending'`(全部動かす)。

- [ ] **Step 1:** 裏で `node scripts/visual-regress/run.mjs --compare=dpr2 --only=miti` を回す(設計書 §4.4-3「移す前に差 0」)。 差が出たら crops を見て仕分け、 今回の変更前の差であることを台帳に記録(撮り直しが要るなら `--save-as` で基準を取り直す)
- [ ] **Step 2: 失敗するテストを足す**
  - `cssRules.test.ts`: `subjectClasses('.theme-military .milspec-a .milspec-b', /^milspec-/)` → `['milspec-b']` / 接頭辞を渡さなければ今と同じ結果(既存テストがそのまま通る)
  - `compareBuild.test.ts`: eager の規則が lazy へ移っただけ → missing/extra/flipped 0 / eager の `.milspec-a{color:red}` と lazy の `.milspec-a{color:blue}` を、 次で両方 lazy の別ファイルに分ける → flipped 0・lazyCross 1 / eager 内の組の逆転 → flipped 1
- [ ] **Step 3:** 落ちることを確認 — `npx vitest run scripts/css-colocation`
- [ ] **Step 4:** 実装(移動 → 分割 → 引数追加の順。 `colocate.mjs` の CLI は 150 行以下・`planColocation.mjs` は 500 行以下)
- [ ] **Step 5:** 通ることを確認 — `npx vitest run scripts/css-colocation src/components/housing/__tests__/housingCssColocation.guard.test.ts` 失敗 0 / `node scripts/css-colocation/colocate.mjs --scope=housing --dry-run` が今までと同じ「移行済み」で止まる
- [ ] **Step 6: 移行前の基準を保存** — `node scripts/css-colocation/compare-build.mjs --save-as=pre-military` → 続けて `--compare=pre-military` が exit 0
- [ ] **Step 7:** コミット `chore(css-colocation): CSS を部品の隣へ移す道具を対象切り替え式に`

### Task 2: military の設定・土台の切り分け・試走

**Files:**
- Create: `src/styles/military/palette.css`(元 1–327 行)/ `semantic-tokens.css`(328–587)/ `standard-revert.css`(588–760)/ `primitives.css`(761–1139)/ `backdrop.css`(1140–1214)/ `pending-1.css`(1215–1610)/ `pending-2.css`(1611–1996)。 境目はコメントの塊の手前で切る(行番号は目安。 規則やコメントの途中で切らない)
- Modify: `src/styles/military.css` → 上 7 本の `@import` だけ(この並び)
- Create: `scripts/css-colocation/scopes/military.mjs`
- Test: `scripts/css-colocation/__tests__/colocate.test.ts` に追加

**Interfaces:**
- Consumes: Task 1 の `planColocation` と scope の形
- Produces: `scopes/military.mjs` の `sources()` = 上 7 本(palette・semantic-tokens・standard-revert・backdrop は `'shared'`、 primitives は `'frame'`、 pending-1/2 は `'pending'`)+既存 10 本(`'pending'`・今の import 先の部品が読む順)。 持ち主の判定に次を足す(planColocation の引数で渡せるようにし、 housing は既定のまま):
  - 候補 = `src/**/*.tsx` に加えて `src/components/military/**/*.ts`。 .ts が持ち主になったら、 その .ts を import している .tsx(複数なら一番外側=他の候補を描いている方)へ置き換える
  - テンプレート文字列 `` `milspec-${…}` `` の接頭辞(`milspec-x-`)で始まる class は、 その文字列を含むファイルが使っている扱い
  - 持ち主が起動時の部品 → `shared:boot-parts` / `src/components/military/` の外の部品 → `shared:standard-parts` / 3 つ以上の military 部品が同じ数で割れて決まらない → `shared:primitives` / 見つからない → `unused/<元のファイル名>`
  - `'frame'`(primitives)の規則は、 持ち主が後読みの military 部品 1 つに決まる時だけ動かす

- [ ] **Step 1: 土台を切る** — 7 本へ行範囲で移し、 入口を `@import` だけにする。 `node scripts/css-colocation/compare-build.mjs --compare=pre-military` exit 0 / `npm run build` exit 0
- [ ] **Step 2: 失敗するテスト**(小さな架空の入力で `planColocation`)
  - `起動時の部品が持ち主なら boot-parts へ`
  - `標準の部品が持ち主なら standard-parts へ`
  - `.ts が組み立てる class は import している部品が持ち主`
  - `テンプレート文字列の接頭辞は使われている扱い`
  - `shared の規則は動かない`(palette の `.theme-military.theme-dark{--ms-x:1}` は残る)
  - `frame は後読みの部品 1 つに決まる時だけ動く`
  - `元のファイルが空になったら消し、 その import も消す`(既存 10 本の改名・分け直し用)
- [ ] **Step 3:** 落ちることを確認 → 実装 → 通ることを確認(`npx vitest run scripts/css-colocation`)
- [ ] **Step 4: 試走** — `node scripts/css-colocation/colocate.mjs --scope=military --dry-run` → `.out/plan.md` を読み、 次がすべて満たされるまで `scopes/military.mjs` の overrides を足す: `crossPairs` 0 / 500 行を超える出力なし / `src/dev/**`・テスト・`src/lib/**` が持ち主になっていない / ambiguous に明らかな誤りなし / 両方向の上書きは外側の部品へ寄せた(理由を overrides のコメントに)
- [ ] **Step 5: 撮れていない状態の一覧** — 部品をまたぐ class を持つ部品のうち、 `scripts/visual-regress/catalog/miti-milspec.mjs` に写らない状態を台帳に一覧。 クリック 1 回で出せるものだけ catalog に足し、 その分だけ今の CSS のまま `--save-as=dpr2` に追加撮影(既存の基準は上書きしない方法で。 できなければ足さずに台帳へ)
- [ ] **Step 6:** `plan.md` の要約(移し元 → 移し先と規則数・unused 一覧・overrides の理由)を台帳に貼る
- [ ] **Step 7:** コミット `refactor(military): military.css を土台と移す待ちに切り分け+移す道具の設定`

### Task 3: 移す(まとまりごと)

まとまりと順番: ① `header` ② サイドバー(`MilspecSidebar` `MilspecContentTree` `MilspecPlanCore` と `armor/drawer` 系)③ `table` ④ 残りの military 部品(`MilspecLayout` `MilspecDecor` `MilspecKey` `MilspecArmor` `fx` `power` `footer` `rail` `MilspecVent` `MilspecNotifBeacon` `MilspecBackdropVideo` ほか)⑤ 共有行き(boot-parts / standard-parts / primitives / unused)。 `--only` の指定はフォルダ名(`src/components/military` 以下)と `_shared`。

各まとまりで:
- [ ] **Step 1:** `node scripts/css-colocation/colocate.mjs --scope=military --write --only=<まとまり>`
- [ ] **Step 2:** `node scripts/css-colocation/compare-build.mjs --compare=pre-military` → missing/extra/flipped 0(lazyCross は表示のみ)。 flipped が出たら `git checkout -- src` で戻し、 overrides を足してやり直す
- [ ] **Step 3:** `npx vitest run src/components/military src/__tests__` → 失敗 0
- [ ] **Step 4:** 裏で `node scripts/visual-regress/run.mjs --compare=dpr2 --only=miti-milspec/` → 全件一致。 差は crops で仕分け、 今回の差なら止めて原因特定(systematic-debugging)
- [ ] **Step 5:** コミット `refactor(military): <まとまり> の CSS を部品の隣へ`

⑤の後、 `pending-1.css` `pending-2.css` と既存 10 本の古い名前のファイルは無くなっている(残っていたら止まる)。 入口は共有 7 種+unused の `@import` だけ。

### Task 4: 見張りテスト

**Files:**
- Create: `src/components/military/__tests__/militaryCssColocation.guard.test.ts`(ハウジングの見張りと同じ 3 つ。 共通にできる処理は `scripts/css-colocation/` から import)

- [ ] **Step 1: テストを書く**
  - `部品の CSS は同じフォルダの .tsx が import している`(`src/components/military/**/*.css`)
  - `共有フォルダは許可一覧だけ`(`src/styles/military/` の中身 = Global Constraints の 8 種。 各行に「なぜ共有か」のコメント)
  - `部品同士の順番頼りが 0`(`src/components/military/**/*.css` の全規則で `findOrderPairs`・接頭辞 `milspec-`。 失敗時は両ファイル名・セレクタ・性質を出す)
- [ ] **Step 2:** 通ることを確認 → わざと import を 1 行消して 1 つ目が落ちる・別部品の CSS に既存と同じセレクタ・性質を足して 3 つ目が落ちることを確認して戻す
- [ ] **Step 3:** コミット `test(military): CSS の置き場所と順番頼りの見張り`

### Task 5: 決まり・コメントの追従

**Files:**
- Create: `.claude/rules/military-css.md`(frontmatter の対象 = `src/components/military/**/*.css`・`src/styles/military/**`。 本文 = 設計書 §4.5 の文+共有 8 種それぞれの 1 行説明+「道具=`scripts/css-colocation/`・見張り=`militaryCssColocation.guard.test.ts`」)
- Modify: 移した CSS の中で「military.css NN-MM 行」「milspecTable.css へ移した」など古い在りかを指すコメントを、 今の在りかに直す(コメントのみ・規則は触らない)/ `src/components/military/**` の .tsx のコメントで military.css を指す所も同様

- [ ] **Step 1:** `grep -rn "military\.css [0-9]\|military\.css:[0-9]\|milspec[A-Z][a-zA-Z0-9]*\.css" src` の該当を直す → 再実行で 0 件(新しい部品名 .css の import 行は除く)
- [ ] **Step 2:** `compare-build --compare=pre-military` exit 0(コメントは比較に入らないことの確認)
- [ ] **Step 3:** コミット `docs(military): CSS の置き場所の決まりとコメントを新しい在りかに`

### Task 6: 最終ゲート

- [ ] `npm run build` exit 0 / `npm run test:gate` 失敗 0 / `compare-build --compare=pre-military` exit 0 / file-size テスト通過
- [ ] visual-regress `--compare=dpr2` 全体 1 回 → 全件一致(仕分け済みの報告 `report.html` を添える)
- [ ] 標準テーマの起動時 CSS が小さくなったことを記録(`pre-military.json` と最終の eager の規則数・バイト数を台帳に)
- [ ] 全体レビュー(fresh・opus)→ 正しさの指摘だけ反映
- [ ] `docs/TODO.md` 更新(完了・次=index.css → MitigationSheet.css を同じ道具で `--scope` を足して)・台帳に結果
