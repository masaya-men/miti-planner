# 軽減表の横スクロール(情報列の固定・見出しの同時移動・MIL-SPEC 横バー) Implementation Plan

2026-10-27 整頓⑤で Timeline.tsx を分割したため、Timeline.tsx の行参照を分割後の場所に書き換えた(旧行は split-base=5aba5053 基準)。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans。1 回に 1 タスクだけ行う。チェックボックス(`- [ ]`)で進捗を管理する。

**Goal:** PC の `/miti` で、横スクロール時に情報列 6 つを固定し、見出し・ボタンの欄を本文と同じコマで動かし、MIL-SPEC の横バーを S1「窪みの溝」にする。既存機能は変更前の記録と機械で突き合わせて壊さない。

**Architecture:** 設計書の確定事項どおり。本文 = 案 A 改(sheetContainer を中身いっぱいの幅にし、`position: sticky; left: 0` の不透明ペインに情報列を移す。xRatio の分母は入れ物の内容幅から測る)。見出し/ボタンの欄 = H2(窓 + トラック + CSS スクロール連動アニメーション。非対応は今の JS)。試作で可否を決めてから本番へ。

**Spec(確定済み・再設計しない。末尾「決定」が優先):** `docs/superpowers/specs/2026-10-23-timeline-sticky-scroll-design.md`(以下「設計書」。§番号はこの文書のもの)

**Tech Stack:** React 19 + TypeScript、Tailwind v4(Lightning CSS)、vitest(happy-dom)、Playwright(Chromium / WebKit / Firefox)。

---

## 全タスク共通のルール(各担当は必ず守る)

1. 1 回に 1 タスクだけ行う。着手前に設計書の該当 § を読む(再設計・再調査はしない。設計書にない判断が要ったら止めて親に報告)。
2. 自分のタスクの「対象ファイル」だけを触り、**そのファイルだけ**を `git add <path>` して commit する。`git add -A` / `git add .` 禁止。push しない。commit は日本語。末尾に次を付ける: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`(Opus 担当の場合は `Claude Opus 5.5`)。コミットは `rtk git commit -F <メッセージファイル>`(`-F -` は不可)。
3. ポート 5173 と 4173 のサーバーは親のもの。**止めない・再起動しない**。自分で起動したサーバーは自分の PID だけ止める。ビルドの確認用に別ポートを使うときは 4173 を避ける(例 4180)。ただし本番ビルド計測(Task 4・性能の照合)は親の 4173 の preview に向ける。親が 4173 に居ない場合は `npx vite preview --port 4180 --strictPort` を自分で立てて自分の PID で止める。
4. 秘密情報(キー・UID・メール・Webhook URL)をファイル・commit に書かない(公開リポジトリ)。
5. 共通の「触らないファイル」(設計書 §13): `src/components/MobileTimelineRow.tsx`、`isMobileTimeline` の分岐、`PlanMemo` / `yjsPlanData.ts` / カーソルの `{ timeSec, xRatio }` の形、`src/components/Memo/coords.ts`、`reanchorScrollTop` / `syncRecastRow` / ジャンプ、`index.css:1640-1643`、`validateMitigationPlacement`、ドラッグの縦計算、ハウジング関連の全ファイル。各タスクの「触らない」はこれに追加分を足したもの。
6. テストは対象を絞って実行する(`rtk npx vitest run <path>`)。フル実行は Task 18 だけ(`npm run test:gate`)。vitest がハングしたら早めに kill(自分の PID のみ)。
7. 同じ直しを 2 回失敗したら続けない。学びを書いて親に報告して止まる。
8. 画面条件の呼び名: **本人=1489×679 / DSR 2.58**、**多数派=1920×1080 / DSR 2**、**大画面=2560×1440**。スマホ=390×844。計測の結果は「どの条件か」を毎回明記する。
9. 結果ファイルは `scripts/sticky-scroll/.baseline/`(git に入れない。`.gitignore` への追加は Task 1 で行う)。
10. 完了報告は証拠つき(コマンドと出力の要点)。検証できなかった項目は「未検証」と明記する。

## モデル/effort の方針
既定は **Sonnet medium**。Opus や high にするタスクには理由を書いた。

## 全体の流れ(関門の位置)
- 段階 0: Task 1〜5(変更前の記録。アプリのコードは触らない)
- 段階 1(試作・捨てる): Task 6〜7
- **【関門】可否判断(Task 7 の直後)**: 不可なら Task 8 以降へ進まず、親に報告して止まる
- 段階 2(本番): Task 8〜17(小さなコミット)
- Task 18: push 前ゲート(性能 §9 と回帰 B の全照合)
- 段階 2-8(実機確認)は親がユーザーに依頼する。タスクではない。

---

# 段階 0: 変更前の記録

## Task 1: 回帰の自動確認 `regress.mjs`(設計書 §4 の [自]・§10 段階 0-1)

**モデル:** Sonnet high(項目数が多く、手を抜くと後段の検収が空洞化するため。実装の判断は不要)

**対象ファイル(新規):** `scripts/sticky-scroll/regress.mjs`、`scripts/sticky-scroll/README.md`(使い方 10 行以内)、`.gitignore` に `scripts/sticky-scroll/.baseline/` を 1 行追加。
**読むだけ:** `scripts/milspec-sp2/_fixture.mjs`(注入・launch・gotoMiti の流儀を踏襲)、`src/components/Timeline.tsx` と `src/components/timeline/`(各 file:line は設計書 §2・§4 の表。設計書側の Timeline.tsx 行は旧行=split-base)、`src/components/timeline/sheet/memberX.ts`。

**内容:** 設計書 §4 の [自] 全項目を Playwright で実行し、結果(要素の画面上の位置・計算済みスタイル・保存された xRatio・送信値・`[data-time-row]` 数・`sheetContainer.offsetWidth`・`scroller.scrollWidth/clientWidth`・`sheetWidth` 相当の実測・チュートリアル目印 3 つの `getBoundingClientRect`)を JSON で `.baseline/regress-<cond>.json` に書く。
- 条件: 画面 3 種(本人 / 多数派 / 大画面)× テーマ(標準ダーク・標準ライト・MIL-SPEC ダーク・MIL-SPEC ライト)× 表示(ふつう・スプシ)× 8 人 / 4 人以下。組み合わせが膨大な項目は、設計書 §4 の B 番号ごとに代表条件を決め、README に書く。
- 引数: `--out=<name>`(`baseline` / `after` 等)、`--compare=baseline`(差分を出し、意図しない差があれば exit 1。許容の値は 0.5px)。
- ホバー・選択(B4)は、マウスを乗せた行の `getComputedStyle`(background / border / font-weight / `::after`)を記録する。

**先に書く失敗テスト:** 本タスクは計測ツール。最初に `--compare` を空の baseline に対して実行し、「baseline が無い」で exit 1 になることを確認してから baseline を取る。
**合格条件(機械):**
1. `node scripts/sticky-scroll/regress.mjs --out=baseline` が exit 0。
2. もう一度 `--out=baseline2` で取り、`--compare=baseline` で差 0(= 2 回続けて同じ結果)。
3. 設計書 §4 の [自] 項目が README の対応表に全部あり、各々が JSON のどのキーかが分かる。

**検証コマンド:** `rtk node scripts/sticky-scroll/regress.mjs --out=baseline` → `rtk node scripts/sticky-scroll/regress.mjs --out=baseline2 --compare=baseline`
**触らない:** `src/` 配下の全ファイル、`scripts/milspec-sp2/*`(読むだけ)。
**commit:** `docs` ではなく `test(scripts): 軽減表の回帰自動確認(regress.mjs)を追加` — 追加した 3 ファイルのみ。

---

## Task 2: 画面写真 `shots.mjs`(設計書 §4 の [写]・§10 段階 0-2)

**モデル:** Sonnet medium

**対象ファイル(新規):** `scripts/sticky-scroll/shots.mjs`
**先に書く失敗テスト:** なし(計測ツール)。同じ画面を 2 回撮り、差を測る機能を先に作る。
**内容:** §4 の [写] 項目 × 3 画面幅 × テーマ 4 種 × ふつう/スプシ × scrollLeft 0。スマホ 390×844(B8)。MIL-SPEC のボタンの欄の背景が動画か無地か(設計書 §12)と、横バーが「浮いて見える」理由の候補(§8.3)を、撮った写真から README の `notes` に 3 行で書き残す(推測は「候補」と明記)。結果は `.baseline/shots/<name>/`。
- `--out=<name>` / `--compare=<name>`: ピクセル差(ピクセル数と割合)を出す。許容は「同じ画面を 2 回撮った差の最大値 ×1.5」で自動決定し `.baseline/tolerance.json` に保存。
**合格条件:**
1. `--out=baseline` と `--out=baseline2` の比較が、決めた許容内で全枚一致。
2. `tolerance.json` が存在する。
3. 写真に MIL-SPEC のダーク・ライト × 3 画面幅 × ふつう/スプシが全部ある(枚数をログに出す)。
**検証コマンド:** `rtk node scripts/sticky-scroll/shots.mjs --out=baseline` → `rtk node scripts/sticky-scroll/shots.mjs --out=baseline2 --compare=baseline`
**触らない:** `src/`、他の scripts。
**commit:** `test(scripts): 軽減表の画面写真ツール(shots.mjs)を追加`

---

## Task 3: 同時移動の検出 `frame-sync.mjs`(設計書 §10 段階 0-3)

**モデル:** Sonnet high(CDP の screencast とフレーム突き合わせは手順が繊細。ここが「1 拍遅れを検出できる道具」であることが関門の根拠になる)

**対象ファイル(新規):** `scripts/sticky-scroll/frame-sync.mjs`
**先に書く失敗テスト(=道具の自己証明):** 今のコードで実行して **「ずれたコマあり」と報告する**ことが合格条件そのもの。ずれなしと出たら道具の不備として直す。
**内容:** CDP `Page.startScreencast` で横スクロール中の全コマを取得。試験用 CSS(ハーネスが `page.addStyleTag` で差し込む。アプリのコードには入れない)で、見出しの最初のメンバー列の境目と本文の最初のメンバー列の境目に目印を付け、コマごとの 2 つの x の差を測る。動かし方 3 通り: 滑らかホイール(`page.mouse.wheel` + Shift)/ スクロールバーのつまみのドラッグ / 矢印キー。
- 引数: `--mode=wheel|thumb|key|all`、`--selector-header=` `--selector-body=`(Task 10 以降で DOM が変わっても目印を差し替えられるよう、セレクタを引数化。既定は現行 DOM)。
- 出力: コマ数 / ずれたコマ数 / 最大ずれ px / 3 通り別。ずれたコマが 1 つでもあれば `--expect-zero` で exit 1(Task 7・10 で使う)。
**合格条件:**
1. 現行コードで `--mode=all` が「ずれたコマ ≥1、最大ずれ > 0.5px」を報告(exit 0。`--expect-zero` なしなら)。
2. 同じ条件で 2 回実行して、ずれの有無の結論が同じ。
**検証コマンド:** `rtk node scripts/sticky-scroll/frame-sync.mjs --mode=all`(8 人・本人条件・標準テーマ・5173 の dev で可。性能計測ではないので dev を使ってよい)
**触らない:** `src/`、他の scripts。
**commit:** `test(scripts): 見出しと本文の同時移動を検出する frame-sync.mjs を追加`

---

## Task 4: 性能の基準(設計書 §9・§10 段階 0-4)

**モデル:** Sonnet medium

**対象ファイル(変更):** `scripts/milspec-polish/scroll-perf.mjs`(`:7, :13` 付近。`--dsr=2.58` と `--axis=x|y` の引数を足す。既定は今の動作のまま = 後方互換)
**先に書く失敗テスト:** `--axis=x --dsr=2.58` を足す前に実行して引数が無視される(横に動かない)ことを確認。
**内容:**
- 横は rAF の中で `scrollLeft` を動かす。滑らかホイールの実際の動き(`page.mouse.wheel` + Shift)を 1 本追加。
- 本番ビルドで測る: `rtk npm run build` → 親の 4173 の preview(なければ自分で 4180)。環境変数 `SP2_BASE_URL` で指定。
- 測るもの(基準を `--save=baseline-<cond>` で保存): 縦/横 × 標準/MIL-SPEC × ふつう/スプシ × データ(合成 300 行超、`docs/.private/perf-tools/dataset-normal.json`、`dataset-heavy.json`)。本人条件(1489×679・DSR 2.58・CPU 4 倍)。3 秒 × 5 回の中央値。
- 置く・消す: `docs/.private/perf-tools/run-measurements.cjs`(押してから描くまで)の基準も同条件で取り、結果ファイルの場所を README に書く。
- 追加の記録(合否には使わない): トレースの Layerize / Commit の時間。
**合格条件:**
1. 既定引数(`--axis=y --dsr=1`)の出力が変更前のスクリプトと同じ形式(後方互換。1 回実行して `--compare` が動く)。
2. 基準 JSON が 上記の全組み合わせ分保存されている(ファイル一覧をログに出す)。
3. 同じ条件を 2 回続けて取り、`--compare` が exit 0(測定が安定している。不安定なら回数を増やして報告)。
**検証コマンド:** `rtk npm run build` の後 `SP2_BASE_URL=http://localhost:4173 rtk node scripts/milspec-polish/scroll-perf.mjs --axis=x --dsr=2.58 --save=baseline-x` ほか組み合わせ分。
**触らない:** `src/`、`docs/.private/perf-tools/*`(読むだけ)。
**commit:** `test(scripts): scroll-perf に横スクロールと DSR 指定を追加し性能の基準を取る`(基準 JSON は commit しない)

---

## Task 5: 純粋関数の単体テスト(赤のまま・設計書 §10 段階 0-5、§6.3、§6.4)

**モデル:** Sonnet medium

**対象ファイル(新規):** `src/components/timeline/sheet/__tests__/stickyCoords.test.ts`(テストのみ。実装ファイル `src/components/timeline/sheet/stickyCoords.ts` は**まだ作らない**)
**読むだけ:** `src/components/timeline/sheet/memberX.ts`(`readLanesColumnVars` `lanesBands` `lanesSheetWidth` `memoCreateXRatio`)、`src/components/timeline/useTimelineMemoCursor.ts:60-98`(handleSheetClick。旧 Timeline.tsx:1122-1158)。前回の `infoPaneWidthCss` の式は `git show 9387f140` で参照。
**テスト内容(関数の署名もここで確定し、README コメントに書く):**
- `toSheetX(clientX, { scrollerLeft, frozenW, sheetLeft }): number`
  - 画面の x < frozenW → x画面 を返す / それ以外 → `clientX - sheetLeft` / scrollLeft 0 では全域で今の `clientX - sheetLeft` と一致 / 境界(= frozenW ちょうど)はレーン側。
- `computeFrozenWidth({ phase: {collapsed}, label: {...}, ... }): number` と `frozenWidthCss(...)`: フェーズ(または折りたたみ幅)+ ラベル(または折りたたみ幅)+ 時間 + 攻撃 + 元のダメージ + 軽減後。折りたたみの切替で幅が追従。
- `sheetContentWidth(...)`: max(中身の幅, 入れ物の内側の幅)(§6.2)。
**確認:** 「中身の幅の式の出所」(設計書 §12 の未確認)として、行のセル幅を出している関数を `memberX.ts` と `TimelineRow.tsx:654-690` から特定し、テストファイル先頭コメントに `file:line` を書く(Task 9 が使う)。
**合格条件:** `rtk npx vitest run src/components/timeline/sheet/__tests__/stickyCoords.test.ts` が **「モジュールが無い」で失敗**(赤)することを確認。他のテストは触らない。
**触らない:** `src/` の実装ファイル全て。
**commit:** `test(timeline): 固定列の座標・幅の純粋関数の単体テストを先に追加(赤)`

---

# 段階 1: 小さな試作(捨てる前提・コミットしない)

> 試作ブランチ名の例 `proto/sticky-scroll`(作業中のブランチから切る)。**コミットしない。結果は親に報告し、設計書への追記文は親が書く。** 試作ブランチは終了時に消さず、担当は「ブランチ名」と「変更ファイル一覧」を報告する。

## Task 6: 試作 1 — 本文の固定(設計書 §10 段階 1-1)

**モデル:** Sonnet high(捨てる試作だが、結果が関門の判断を決めるため。実装の自由度が高く、止まって報告する判断も要る)

**対象ファイル(試作ブランチ上でのみ編集):** `src/components/Timeline.tsx:608`(sheetContainer の幅。旧 Timeline.tsx:3529)、`src/components/TimelineRow.tsx:340-353, 389-686`(時間の列だけ)。
**試作の範囲(これ以上やらない):** sheetContainer の幅を中身に合わせる + 情報列の上に**空の**不透明な sticky の箱(z 70)+ 時間の列だけをその箱の中の `content-visibility` 付きの行で描く。
**先に書く失敗テスト(撮影比較ではなく計測スクリプト):** `scripts/sticky-scroll/proto-body.mjs`(これは commit してよい唯一のファイル)。scrollLeft 0 / 中間 / 最大で箱の画面上の x を測り、`elementsFromPoint` の最前面を調べ、縦に高速スクロールしても箱の中の行が抜けないかを調べる。まず現行コードで実行して「箱が無い」で失敗することを確認。
**合格条件(機械):**
1. 箱の画面上の x の差 0.5px 以内(scrollLeft 3 点)。3 画面幅(本人 / 多数派 / 大画面)× サイドバー開閉 × ふつう/スプシ。
2. 軽減のアイコン・帯が箱の下を通る(`elementsFromPoint` の最前面が箱)。
3. 箱の中の `content-visibility` の行が、縦の高速スクロールで抜けない(各スクロール停止後に見えるべき時間の行が全部描かれている)。
4. 縦・横のスクロール性能が §9.2 の範囲(Task 4 の基準比 +10% 以内)。
5. 768px 幅で固定列の幅が画面の幅より小さい(設計書 §12 の最後の項目。計算上 約 456px)。
**検証コマンド:** `rtk node scripts/sticky-scroll/proto-body.mjs`、`SP2_BASE_URL=... rtk node scripts/milspec-polish/scroll-perf.mjs --axis=x --dsr=2.58 --compare=baseline-x`
**触らない:** 共通の触らないファイル、`index.css:1373-1386`、MIL-SPEC の CSS 全部。
**commit:** `proto-body.mjs` のみ(アプリのコード変更は commit しない)。
**報告:** 合格条件 1〜5 の数値、どれが不合格か。

## Task 7: 試作 2 — 見出しの同時移動(設計書 §10 段階 1-2、§5.3)

**モデル:** Sonnet high(Chrome / WebKit / Firefox の挙動判断、Lightning CSS の残り方の確認が絡み、結果が H1 切替を決める)

**対象ファイル(試作ブランチ上でのみ編集):** `src/components/timeline/TimelineHeader.tsx:54-60`(見出し。旧 Timeline.tsx:3337-3343)と `src/components/timeline/useTimelineScrollSync.ts:96-121`(`handleScrollSync`。旧 :1528-1552)、`src/components/Timeline.tsx:552-561`(スクロールの入れ物 ref={scrollContainerRef}。旧 :3474-3481。ここに `scroll-timeline: --tl-x x`)、共通の親 `.glass-panel` に `timeline-scope: --tl-x`、CSS は `src/index.css` の末尾に試作用ブロック。
**試作の範囲:** 見出しだけを窓 + トラック + スクロール連動アニメーション(`@keyframes tl-track-x`、`--tl-max` は ResizeObserver で書く)。ボタンの欄・本文は触らない。非対応ブラウザでは今の JS に戻す。
**先に書く失敗テスト:** Task 3 の `frame-sync.mjs --expect-zero` を試作前に実行して失敗(ずれあり)することを再確認し、試作後に成功させる。
**合格条件(機械):**
1. `frame-sync.mjs --mode=all --expect-zero`(Chrome)で ずれたコマ 0。3 通りすべて。
2. `rtk npm run build` 後、`dist` の CSS を grep して `animation-timeline` が残っている(`rtk grep -r "animation-timeline" dist/assets/*.css`)。残らなければ JS で `style.animationTimeline` を書く方式に直して 1 を再確認。
3. Playwright **WebKit** で 1 と同じ確認(結果は「Safari の目安」と明記)。
4. Playwright **Firefox** で、遅れはあってもずれが溜まらない・コンソールエラー 0(今と同じ動き)。
5. パーティの増減・列の折りたたみ・サイドバー開閉・スプシ切替の各操作のあと、scrollLeft 最大で見出しと本文のメンバー列の x の差 0.5px 以内(`--tl-max` の追従)。
**検証コマンド:** `rtk node scripts/sticky-scroll/frame-sync.mjs --mode=all --expect-zero`、`rtk npm run build && rtk grep -r "animation-timeline" dist/assets`
**触らない:** 共通の触らないファイル、MIL-SPEC の CSS(`milspecTable.css` ほか)、ボタンの欄。
**commit:** なし(必要ならスクリプトの修正だけ。アプリのコード変更は commit しない)。
**報告:** 合格条件 1〜5 の結果。判断の提案(下の関門の表のどれか)を 1 行添える。

---

# 【関門】可否判断(Task 7 の直後・親が判断する)

担当は Task 6・7 の報告を親に返して**止まる**。親が下の表で判定し、**Task 8 以降は親の GO が出るまで着手しない**。

| 結果 | 判断 | 次の動き |
|---|---|---|
| Task 6 が不合格 | **不可**。本文の固定は作らない | 理由を書いて**親に報告して止まる**。ユーザーに報告(Task 8 以降は実行しない) |
| Task 6 合格 かつ Task 7 が Chrome で不合格 | H1(入れ物の中へ・sticky)に切替 | 親が設計書の追記と計画の修正(Task 10 を H1 に書き換え)を行う。MIL-SPEC のボタンの欄の見た目をユーザーに聞く(設計書 §11 Q3)。**それまで Task 8 以降は止まる** |
| Task 6 合格 かつ Task 7 が WebKit だけ不合格 | 対応外ブラウザと同じ扱い(今の JS 方式) | 報告に書いて GO |
| 両方合格 | **可** | 親が結果を設計書に追記して GO。試作ブランチは破棄(`git branch -D` は親が行う) |

関門で「不可」のとき、担当 Sonnet は**本番の段階に進まず、親に報告して止まる**。自分の判断で H1 に切り替えない。

---

# 段階 2: 本番(小さなコミット・設計書 §10 段階 2 の表に対応)

> 各タスクの冒頭で、`git status` が自分のタスクのファイルのみであること、`.baseline` が存在することを確認する。無ければ Task 1〜4 の結果を親に確認して止まる。

## Task 8: 設計書 2-1 — `sheetWidth` の測る相手と `memoCreateXRatio` の分母(§6.1)

**モデル:** Sonnet medium

**対象:** `src/components/timeline/useTimelineLayout.ts:37-51`(useTimelineSheetWidth の `sheetWidth` の ResizeObserver。旧 Timeline.tsx:836-850。これを、sheetContainer からスクロールの入れ物の `contentRect.width` に替える。カーソル用 ref ミラーはそのまま)、`src/components/timeline/useTimelineMemoCursor.ts:89`(handleSheetClick 内の `memoCreateXRatio(xPx, rect.width, …)` の `rect.width` → `sheetWidth`。旧 Timeline.tsx:1151)。`src/components/timeline/sheet/memberX.ts:70-` は引数の受け渡しだけ確認(変えない)。
**先に書く失敗テスト:** `src/components/timeline/__tests__/Timeline.sheetWidth.test.tsx`(新規)。入れ物の内容幅が変わると `sheetWidth` が追従し、sheetContainer の幅を広げても `memoCreateXRatio` の分母が変わらないこと(ResizeObserver をモックし、sheetContainer を `w-max` で 3000px、入れ物 1188px のときに分母が 1188)。まず赤を確認。
**合格条件:**
1. 新テスト緑 + `Timeline.sheet.test.tsx` `Timeline.layout.test.tsx` 緑。
2. `regress.mjs --compare=baseline` で差 0。
3. `sheetWidth` の実測の差 0.01px 以内(1489・1920・2560 × サイドバー開閉 × ふつう/スプシ)。小数点以下の一致(設計書 §12)を数値で報告。
**検証コマンド:** `rtk npx vitest run src/components/timeline/__tests__/Timeline.sheetWidth.test.tsx src/components/Timeline.sheet.test.tsx` / `rtk node scripts/sticky-scroll/regress.mjs --out=after --compare=baseline`
**触らない:** `Timeline.tsx:608` 以降と `timeline/TimelineRows.tsx` / `timeline/TimelineBands.tsx`(行の描画。旧 Timeline.tsx:3529 以降)、`memberX.ts` 本体、`coords.ts`。
**commit:** `refactor(timeline): xRatio の分母を入れ物の内容幅から測る(sheetContainer の幅から切り離し)`

## Task 9: 設計書 2-2 — `toSheetX` と固定列の幅の関数(§6.3、§6.4。固定列の幅 0 のまま)

**モデル:** Sonnet medium

**対象(新規):** `src/components/timeline/sheet/stickyCoords.ts`(`toSheetX` `computeFrozenWidth` `frozenWidthCss` `sheetContentWidth`)。Task 5 のテストを緑にする。行のセル幅を出す関数は Task 5 のコメントの `file:line` を再利用(式は 1 か所にする)。
**変更(最小):** `clientX` 利用先 6 か所(設計書 §6.4 の列挙。`useTimelineMemoCursor.ts:72`(handleSheetClick。旧 Timeline.tsx:1133)、`useTimelineMemoCursor.ts:196`(useTimelineCursorSend の onMove。旧 :1496)、`useTimelineSheetView.ts:58-62`(handleSheetCellTap。旧 :2198-2200)、`useTimelineSheetView.ts:186`(handleSheetPointerMove の sheetColumnFromX。旧 :2943)、`TableHoverHighlight.tsx:34`、`MemoOverlay.tsx:99`)で `toSheetX` を呼ぶ。ただし `frozenW = 0` を渡す(動きは変わらない)。
**先に書く失敗テスト:** Task 5 のテスト(赤)。
**合格条件:**
1. `rtk npx vitest run src/components/timeline/sheet/__tests__/stickyCoords.test.ts` 緑。
2. `Timeline.sheet.test.tsx` `CursorOverlay.test.tsx` `src/lib/collab/__tests__/` 緑。
3. `regress.mjs --compare=baseline` 差 0。
**検証コマンド:** 上記 + `rtk npx tsc -b --noEmit`(出力は tail で要約)
**触らない:** `coords.ts`、`MobileTimelineRow.tsx`、行の描画。
**commit:** `feat(timeline): 固定列の座標変換 toSheetX と幅の関数を追加(固定列幅 0 で挙動不変)`

## Task 10: 設計書 2-3 — 見出し・ボタンの欄を窓 + トラック + スクロール連動アニメーション(§5.3、§8.1)

**モデル:** Sonnet high(MIL-SPEC の `nth-child` 指定の書き換えが多く、見た目の回帰が出やすいため。Opus は不要)

**対象:** `timeline/TimelineControlBar.tsx:80-87`(ボタンの欄。旧 Timeline.tsx:3040-3047)、`timeline/TimelineHeader.tsx:54-60`(見出し。旧 :3337-3343)、`timeline/useTimelineScrollSync.ts:96-121`(`handleScrollSync` の書く先を inner → トラックに。旧 :1528-1552)、`timeline/useTimelineScrollSync.ts:136-148`(syncPadding。旧 :1568-1580)、`src/components/Timeline.layoutHooks.ts:24-58`(`offsetLeft` 実測の基準がトラックでも同じ値になること)、`src/components/military/table/milspecTable.css:21-23, 59-75, 221, 287-294`、`milspecDeck.css:5-9`、`MilspecReticle.tsx:76`(`#timeline-header-inner > :nth-child(-n+4)` が効き続けること)、`MilspecControlDeck.tsx:79`(漏れ光の長さ)、`src/index.css`(`tl-track-x` の `@keyframes` と `--tl-max`)。
- 「固定の側」は inner の直接の子のまま。窓 = `absolute; top:0; bottom:0; left: var(--frozen-w); right:0; overflow:hidden`。トラック = `absolute; left: calc(-1 * var(--frozen-w)); width: max-content`(設計書 §5.3)。窓とトラックには MIL-SPEC の `> *` の指定(`position: relative; height: 100%`)を当てない。
- 非対応の判定は `CSS.supports('animation-timeline: --a') && CSS.supports('timeline-scope: --a')`。Task 7 の結果(Lightning CSS で残るか)に従い、CSS か JS(`style.animationTimeline`)で書く。
- このタスクでは `--frozen-w` はまだ **0 ではなく本来の値**を定義する(窓の左端に必要)。ただし本文はまだ固定しない(Task 11)。
**先に書く失敗テスト:** `Timeline.layout.test.tsx` に「`#timeline-header-inner` の直接の子に窓が存在し、トラックの `offsetLeft` 基準が今と同じ」を追加(赤を確認)。`MilspecReticle` の既存テストはそのまま緑であること。
**合格条件:**
1. `frame-sync.mjs --mode=all --expect-zero`(Chrome)でずれたコマ 0。
2. `shots.mjs --compare=baseline` でスクロール 0 の写真が許容内で一致(標準・MIL-SPEC、ダーク・ライト、ふつう/スプシ)。漏れ光の見える長さが変わらないこと(§12)。
3. 軽減アイコンの画面上の位置が `regress.mjs` の baseline と 0.5px 以内(A3)。
4. パーティの増減・列の折りたたみ・スプシ切替・サイドバー開閉のあと、scrollLeft 最大でずれ 0.5px 以内。
5. 既存の `Timeline.layout.test.tsx` `Timeline.recastBand.milspec.test.tsx` `MitigationItem.milspec.test.tsx` `src/components/military/table/__tests__/` 緑。
**検証コマンド:** 上記 + `rtk npm run build`(exit 0)
**触らない:** 行の描画(`TimelineRow.tsx`)、sheetContainer(`:3529`)、スマホ、`handleScrollSync` の縦の部分。
**commit:** `feat(timeline): 見出しとボタンの欄を窓+トラックにしスクロール連動で同時移動させる`

## Task 11: 設計書 2-4 前半 — sheetContainer の幅 + 固定ペイン + 行を 2 つに分ける(§6.2、§6.6)

**モデル:** **Opus high**(理由: 本計画で最も影響範囲が広い。`TimelineRowContent` を 2 部品に分割しつつ JSX・クラス名・data 属性・`data-tutorial` を 1 文字も変えずに移し、`content-visibility` の重なりの箱・縞模様の偶奇・メモ化比較まで同時に守る必要がある。誤りは前回の撤回の主因 A1・A4 に直結し、Sonnet での手戻りコストが高い)

**対象:**
- `Timeline.tsx:608`(sheetContainer の幅 = `sheetContentWidth`、PC のみ。スマホは触らない。旧 Timeline.tsx:3529)、`timeline/TimelineBands.tsx:63, 114`(フェーズ・ラベルの帯 data-phase-overlay / data-label-overlay。旧 :3695, 3747)と `timeline/TimelineBands.tsx:140`(時刻選択の枠 ref={overlayRef}。旧 :3773)をペインの中へ、`timeline/TimelineRows.tsx:61-139` の `renderItems` のループ(行を作る箇所)で情報側とレーン側の両方を作る。
- `TimelineRow.tsx:340-353, 389-686`(`TimelineRowContent` を「情報列だけ」と「メンバー列だけ」に分ける。`data-row-part="info"|"lanes"`、レーン側の最初の子に `data-frozen-spacer`。どちらも `memo` + `rowPropsEqual`)。
- ペイン: `position: sticky; left: 0; z-index: 70`、不透明の地、`isolate`。行は両方の親で最初の子(縞模様 `nth-child(even)` の偶奇を揃える)。
**先に書く失敗テスト:**
1. `TimelineRow.split.test.tsx`(新規): 情報側の子の順番が現行の情報列 6 つと同じ・`data-tutorial`(`TimelineRow.tsx:539, 629, 663` 相当)が全部残る・レーン側の最初の子が空き。
2. `Timeline.layout.test.tsx` に「`sheetContainer.offsetWidth === 最初のレーン行.offsetWidth`」を追加。
3. 既存の `[data-time-row]` を数えるテストは数が倍になる。**意図した変化として** `[data-row-part="lanes"]` 等に直し、直す理由を 1 件ずつコミットメッセージに書く(設計書 B10)。
まず赤を確認してから実装する。
**合格条件:**
1. 新規テスト・既存 `Timeline.*.test.tsx` `TimelineRow.*.test.tsx` `src/components/timeline/__tests__/` 緑。
2. scrollLeft 0 の写真が一致(標準・MIL-SPEC。ただし MIL-SPEC の行 CSS は Task 13 で直すため、このタスクの写真比較は**標準テーマのみ**。MIL-SPEC は Task 13 で一致させる)。
3. 固定列の画面上の位置の差 0.5px 以内(scrollLeft 0・中間・最大 × 3 画面幅 × サイドバー開閉 × ふつう/スプシ)。`sheetContainer.offsetWidth === scroller.scrollWidth`(中身が画面より広いとき)。
4. チュートリアルの目印 3 つが見つかり、位置が baseline と 0.5px 以内。
5. 4 人以下・2560 幅で横スクロールが出ない・見た目が baseline と一致(B9-2)。
6. `regress.mjs --compare=baseline`(数が倍になるものは意図どおりと一覧化)。
7. スマホ 390×844 の DOM の骨組みが baseline と一致(B8)。
**検証コマンド:** 関係するテストのパスを列挙して `rtk npx vitest run ...` + `rtk npm run build`(exit 0)+ `regress.mjs` + `shots.mjs --compare=baseline`
**触らない:** MIL-SPEC の CSS(Task 13)、ホバーの写し・記録モード(Task 12)、メモ/カーソル(Task 14〜15)、`MobileTimelineRow.tsx`、`handleScrollSync`。
**commit:** `feat(timeline): 情報列を固定ペインへ移し行を情報側とレーン側に分ける`

## Task 12: 設計書 2-4 後半 — 行のホバーの写し・記録モード・行の下線(§6.6、A4)

**モデル:** Sonnet high(`hover` を含む 18 行の数え上げが抜けると A4 が再発するため。抜け漏れ防止のため high)

**対象:** `TimelineRow.tsx` の `hover` を含む全 18 行(`rtk grep -n "hover" src/components/TimelineRow.tsx` で全数を取り、README ではなくコミットメッセージに表にして残す)、`:365-374`(記録モードの `onClickCapture` を両方に付ける。青い枠は情報側は右辺なし、レーン側は左辺なし)、`src/index.css:1373-1386, 1404-1420`(`[data-time-row]::after` は情報側だけ)、`milspecTable.css:102-110, 128, 155`(MIL-SPEC のホバー指定を `data-row-hover` でも同じに。ただし MIL-SPEC の `nth-child` 書き換え自体は Task 13)。
- 行の出入り(`onMouseEnter` / `onMouseLeave`)のときだけ、もう片方の行へ `data-row-hover` を付ける。マウスの移動ごとには書かない。
**先に書く失敗テスト:** `TimelineRow.hover.test.tsx`(新規): 片方の `mouseenter` でもう片方に `data-row-hover` が付き、`mouseleave` で外れる / `mousemove` では属性が書かれない。さらに `scripts/sticky-scroll/hover-parity.mjs`(新規)で、実マウスを乗せた行と属性で光らせた行の計算済みスタイル(背景・下線・太字・「+」の表示)が一致することを測る。まず赤。
**合格条件:**
1. 上記テスト緑、`TimelineRow.*.test.tsx` 緑。
2. `hover-parity.mjs` で、18 行のそれぞれに対応する要素の計算済みスタイルが乗った側と写した側で一致(不一致 0)。
3. 記録モード: 行のどこ(情報側・レーン側)を押しても打点され、つなぎ目に枠の二重線がない(`regress.mjs` の該当項目が baseline と一致)。
4. `regress.mjs --compare=baseline` 一致(意図した変化のみ一覧化)。
**検証コマンド:** `rtk npx vitest run src/components/TimelineRow*` / `rtk node scripts/sticky-scroll/hover-parity.mjs` / `regress.mjs`
**触らない:** Task 11 で決めた DOM 構造(変える必要が出たら止めて親に報告)、MIL-SPEC の `nth-child`。
**commit:** `feat(timeline): 行のホバーと記録モードを情報側・レーン側で連動させる`

## Task 13: 設計書 2-4 MIL-SPEC — 行・見出しの順番に頼る CSS の書き換え(§8.1)

**モデル:** Sonnet high(写真一致が合格条件で、`nth-child` の取りこぼしが静かな見た目の崩れになるため)

**対象:** `src/components/military/table/milspecTable.css` の `:54-94`(見出し)、`:98-166`(行)、`:101`(縞模様)、`:105-110`(左の細いバー=情報側だけ)、`:120, 123, 128, 139-141, 149-166`(`[data-time-row] > :nth-child(N)` → `[data-time-row][data-row-part="info"] > :nth-child(N)`)。必要なら `printRows.ts:12-22`(両方の行に描き込みのクラスを付ける)。
**先に書く失敗テスト:** `src/components/military/table/__tests__/printRows.test.ts`(既存に追記または新規): 情報側とレーン側の両方の行にクラスが付く(赤を確認)。
**合格条件:**
1. `shots.mjs --compare=baseline` で、**MIL-SPEC のダーク・ライト × 3 画面幅 × ふつう/スプシ × scrollLeft 0** が許容内で一致(違いの画素 0 または許容内)。
2. `src/components/military/table/__tests__/` `Timeline.recastBand.milspec.test.tsx` `MitigationItem.milspec.test.tsx` 緑。
3. `rtk grep -n "nth-child" src/components/military/table/milspecTable.css` の全ヒットが、`data-row-part="info"` で絞られているか、見出し側か、縞模様のいずれか(数をコミットメッセージに書く)。
**検証コマンド:** `rtk npx vitest run src/components/military/table/__tests__ src/components/Timeline.recastBand.milspec.test.tsx` + `shots.mjs`
**触らない:** `milspecDeck.css`(Task 10 で済み)、標準テーマの CSS、横バー(`military.css:1462-1498` は Task 17)。
**commit:** `fix(milspec): 順番に頼る行・見出しの指定を情報側に絞り、固定ペイン導入後も見た目を保つ`

## Task 14: 設計書 2-5 前半 — 固定列を考えた変換の本適用(§6.4、§6.5)

**モデル:** Sonnet high(座標の取り違えは保存データ(xRatio)に直結するため)

**対象:** Task 9 で `frozenW = 0` にした 6 か所を本来の値に(`useTimelineMemoCursor.ts:60-98`(handleSheetClick・メモ作成・固定列の上は横に動かしても作らない。旧 Timeline.tsx:1122-1158)、`useTimelineMemoCursor.ts:182-227`(useTimelineCursorSend・カーソル送信。旧 :1488-1526)、`useTimelineSheetView.ts:58-62`(handleSheetCellTap・スプシのマス判定で固定列の上は無視。旧 :2198-2200)、`useTimelineSheetView.ts:186`(handleSheetPointerMove・スプシ列のツールチップ・固定列の上は出さない。旧 :2943)、`TableHoverHighlight.tsx:22-50`(固定列の上ではレーンの強調を消す)、`MemoOverlay.tsx:99`(ドラッグの離した位置))。スクロールの入れ物に `scroll-padding-left: var(--frozen-w)`(B9-7)。`--frozen-w` は入れ物と `.glass-panel` に置く(設計書 §6.3)。
**先に書く失敗テスト:** `Timeline.memoCreate.test.tsx` `Timeline.cursorSend.test.tsx`(新規。横に 300px 動かした状態で、情報列の上を押しても作らない / 送信値は §6.4 の決まりどおり / スクロール 0 では baseline と同じ値)。`TableHoverHighlight` のテスト追記。赤を確認。
**合格条件:**
1. 新規・既存テスト緑。
2. `regress.mjs` の B2(メモ)・B3-1(送信値)・B4-2・B4-3・B9-7 の項目が、スクロール 0 で baseline と一致。横に動かした状態の項目は設計書の決まり(固定列の上は作らない・出さない)を満たす。
3. 保存される xRatio が同じ画面座標で baseline と同じ値(ふつう/スプシ)。
**検証コマンド:** `rtk npx vitest run <新規テスト> src/components/timeline/__tests__` + `regress.mjs`
**触らない:** `coords.ts`、保存データの形、`CursorOverlay.tsx`(Task 15)、`MemoOverlay.tsx` の描画位置(Task 15)。
**commit:** `feat(timeline): メモ・カーソル・ホバー強調・スプシ判定で固定列を考えた座標変換を使う`

## Task 15: 設計書 2-5 後半 — 2 層(メモ/カーソル)・競合矢印・照準・重なり順(§7.1、A6)

**モデル:** Sonnet high(z の順を取り違えると A6 が再発。ただし z の表は設計書で確定済みのため Opus は不要)

**対象:** `src/components/collab/CursorOverlay.tsx:56-87`(1 人につきレーン層とペイン内の 2 要素。rAF で切替)、`MemoOverlay.tsx:62, 99-112`(情報列の位置のメモはペインの中)、`cursor.css:7`、`memo.css:22, 31`、`Timeline.tsx:590-606`(競合矢印を PC のみ sheetContainer の中へ。z 55。旧 Timeline.tsx:3514-3527)、`ConflictOffscreenArrows.tsx:92`、`MilspecReticle.tsx:103-109, 164`(左端の切り取り = 入れ物の左端 + 固定列の幅。狙う相手で z 60 / 75)、ドラッグ中のメモ z 80。
**先に書く失敗テスト:** `CursorOverlay.test.tsx` に「受信 x が情報列のとき、ペイン内の要素が表示・レーン層は非表示」を追加。`scripts/sticky-scroll/zorder.mjs`(新規): 横に 300px 動かした状態で `elementsFromPoint` により、(a) 固定列の上の最前面がペインの要素、(b) 情報列を指す相手のカーソルがペインより前、(c) レーンのアイコンが固定列の右側では最前面、(d) 画面外の競合矢印がペインの下、(e) ドラッグ中のメモが固定列の上で見える、を判定。赤を確認。
**合格条件:**
1. `zorder.mjs` が 5 項目すべて合格。
2. `CursorOverlay.test.tsx` `src/lib/collab/__tests__/` `Timeline.readonly.test.tsx` 緑。
3. `regress.mjs` の B1-5(競合矢印の位置・押して飛ぶ)・B3-2〜B3-4 がスクロール 0 で baseline と一致。横に動かしたとき、情報列のカーソルは固定、レーンのカーソルはレーンと一緒に動く。
4. スマホの競合矢印の場所が変わっていない(B8)。
**検証コマンド:** `rtk npx vitest run src/components/collab/__tests__ src/components/Timeline.readonly.test.tsx` / `rtk node scripts/sticky-scroll/zorder.mjs` / `regress.mjs`
**触らない:** `yjsPlanData.ts` とカーソル送信の形、スマホ経路。
**commit:** `feat(timeline): メモと相手のカーソルをペイン内/レーンの2層にし、競合矢印・照準の重なり順を整える`

## Task 16: 設計書 2-6 前半 — 固定列の境目(§8.2、Q2 = M0「変更なし」に訂正済み)

**モデル:** Sonnet medium

**方針(確定):** 境目の装飾は**足さない**。MIL-SPEC に継ぎ目の線(M1)も刻み(M2)も入れない。やるのは、見本の M0 と同じ「横に動かしたときだけ固定列の右に出る薄い影」だけ(見本 `docs/.private/2026-10-23-sticky-scroll-mockup/index.html:109-111`: 幅 10px・`linear-gradient(90deg, rgba(0,0,0,0.28), transparent)`)。標準・MIL-SPEC とも同じ影。
**対象:** `src/index.css`(影の要素/疑似要素。固定ペインの右端に付ける)、MIL-SPEC 側は新規の CSS を足さず、必要なら `milspecTable.css` に影が隠れないための最小の指定のみ。影の出し消しは `animation-range: 0 24px` の 0→1(非対応ブラウザは scroll イベントでクラス付け替え)。
**先に書く失敗テスト:** `scripts/sticky-scroll/seam.mjs`(新規): scrollLeft 0 で影の計算済み `opacity` が 0、24px 以上で 1(標準・MIL-SPEC)。さらに MIL-SPEC に継ぎ目の線が**無い**こと(固定列の右端 ±2px の画素が scrollLeft 0 の baseline 写真と一致)。赤を確認。
**合格条件:**
1. `seam.mjs` 合格。
2. `shots.mjs --compare=baseline` でスクロール 0 の写真が全て許容内で一致(意図した変化なし)。
3. 横に動かした写真で、影が固定列の右 10px 以内にだけある(見本 M0 との突き合わせ画像を `.baseline/seam-compare.png` に出す)。
4. 4 人以下で影が出ない(B9-2)。
**検証コマンド:** `rtk node scripts/sticky-scroll/seam.mjs` / `shots.mjs`
**触らない:** 横バー(Task 17)、固定ペインの DOM、MIL-SPEC の `--ms-edge-hi` 系の装飾。
**commit:** `feat(timeline): 固定列の右に横スクロール時だけ薄い影を出す(境目の装飾は足さない)`

---

## Task 17: 設計書 2-6 後半 — MIL-SPEC 横バー S1「窪みの溝」(§8.3、Q1 = S1)

**モデル:** Sonnet medium(見本があり、`::-webkit-scrollbar` 範囲の CSS のみ。写真の突き合わせで判定)

**対象:** `src/components/military/` 配下の横バーの CSS と `military.css:1462-1498`(`:1466` の縦バー非表示は維持)。S1 = 溝を窪みの地より 1 段暗く、上に暗い 1px・下に明るい 1px、目盛りは太い目盛りだけ・薄く、つまみは削り出しの金属の小片で中央に滑り止め `////`、光らない。自作のバー(JS)は作らない。
**先に書く失敗テスト:** `scripts/sticky-scroll/scrollbar-style.mjs`(新規): 横バーの `::-webkit-scrollbar-*` の計算が S1 の仕様(高さ・溝の色・つまみに発光 `box-shadow` なし)を満たすかを CSS の値から判定。赤を確認。
**合格条件:**
1. 見本 S1(`docs/.private/2026-10-23-sticky-scroll-mockup/`)とアプリの写真を、1489×679 のダーク・ライトで突き合わせた画像を出力(`feedback_visual_fidelity_requires_screenshot_diff`)。
2. 縦バーが非表示のまま(`regress.mjs` の項目)。標準テーマの横バーが変わっていない(`standard-invariance.mjs`: `scripts/milspec-sp2/standard-invariance.mjs`)。
3. `scrollbar-style.mjs` 合格。
**検証コマンド:** `rtk node scripts/sticky-scroll/scrollbar-style.mjs` / `rtk node scripts/milspec-sp2/standard-invariance.mjs`
**触らない:** 標準テーマの CSS、Firefox 向けの指定(今回扱わない)、固定ペイン。
**commit:** `feat(milspec): 横スクロールバーを S1「窪みの溝」にする`

---

# 最終タスク

## Task 18: 設計書 2-7 — push 前ゲートと性能・回帰の全照合(§9、§4)

**モデル:** Sonnet medium(全て既存の判定ツールの実行と照合。コードは触らない。失敗があれば直さず、どの Task に戻すかを報告)

**対象:** コードは触らない。結果を表にして親に返す。`docs/superpowers/plans/` に結果を書かない(報告のみ)。
**手順と合格条件(全部満たすこと。1 つでも不合格なら該当 Task 番号を添えて親に報告して止まる):**

**(A) ビルド・テスト**
1. `rtk npm run build` が exit 0。
2. `rtk npm run test:gate` が既知の失敗以外は緑(既知の失敗は一覧にして報告)。
3. B10 の既存テスト全部緑。

**(B) 性能(設計書 §9.2。本番ビルド・本人条件・CPU 4 倍・3 秒 ×5 回の中央値・Task 4 の基準と比較)**
4. `scroll-perf.mjs --axis=x --dsr=2.58 --compare=baseline-x` と `--axis=y ... --compare=baseline-y` が、標準/MIL-SPEC × ふつう/スプシ × 3 データ(合成 300 行超 / dataset-normal / dataset-heavy)で exit 0(p95 コマ間隔・長いタスクのブロック時間の合計が +10% 以内、基準 0 なら +50ms 以内)。
5. 長いタスクの件数が増えていない。
6. 置く・消す(`run-measurements.cjs`)の最長タスクと押してから描くまでが +10% 以内。
7. 追加の記録(合否に使わない): Layerize / Commit の時間を baseline と並べる。

**(C) 回帰チェックリスト(設計書 B)の全照合**
8. `regress.mjs --compare=baseline`: B1(1〜6)、B2(1〜5)、B3(1〜4)、B4(1〜5)、B5(1〜5)、B6(1・3)、B7-7、B8、B9(1・2・3・4・5・6・7)の [自] 項目を、項目ごとに「一致 / 意図した変化(理由)」の表にする。意図した変化は `[data-time-row]` の数が倍になること、固定列の右の影(横に動かしたときのみ)、S1 の横バーのみ。
9. `shots.mjs --compare=baseline`: B1-5・B1-7・B4-1・B4-5・B4-6・B6-2・B7(1〜6・8)・B8・B9-2 の [写] 項目の一致。スクロール 0 の MIL-SPEC・標準が許容内。意図した変化の画像を並べて一覧化。
10. `frame-sync.mjs --mode=all --expect-zero`(Chrome)でずれ 0。WebKit は目安として報告、Firefox は「遅れはあるが溜まらない・エラー 0」。
11. `hover-parity.mjs` `zorder.mjs` `seam.mjs` `scrollbar-style.mjs` が合格。
12. 固定列の画面上の位置の差 0.5px 以内(scrollLeft 0・中間・最大 × 3 画面幅 × サイドバー開閉 × ふつう/スプシ)と `sheetContainer.offsetWidth` の一致(§6.2)。
13. 保存される xRatio が、同じ画面座標で baseline と同じ値(ふつう/スプシ)。
14. スマホ 390×844 の DOM の骨組み・写真が baseline と一致(B8)。
15. 文字の拡大(`--text-scale-multiplier: 1.3`)で列の位置が崩れない(B9-5)。

**(D) 引き継ぎ**
16. `git status` が clean。push していない。親が 2-8(ユーザーの実機確認: 横スクロール・ホバー・メモ・MIL-SPEC の横バー、1489・ダーク/ライト)を依頼できるよう、「Firefox では見出しの 1 拍遅れが今のまま残る」(設計書 §11)を添えた報告文を返す。

**検証コマンド(まとめ):** 上記の各スクリプト。出力は tail/grep で要約し、フル出力を流し込まない。
**触らない:** 全ファイル(読むだけ)。
**commit:** なし(コードの変更がないため)。

---

## 自己点検(計画作成者)
- 設計書 §10 の段階 0(1〜5)= Task 1〜5、段階 1(1-1・1-2)= Task 6〜7、段階 2 の 2-1〜2-7 = Task 8〜18(2-3=Task 10、2-4=Task 11〜13、2-5=Task 14〜15、2-6=Task 16〜17、2-7=Task 18)、2-8 は親がユーザーに依頼。
- 設計書 §12 の未確認のうち「行のセル幅を出している関数」は Task 5 で特定、その他は設計書が示す段階(Task 6・7・8・10・18)で確認する。
- 設計書にない判断が必要になったら、担当は止まって親に報告する。
