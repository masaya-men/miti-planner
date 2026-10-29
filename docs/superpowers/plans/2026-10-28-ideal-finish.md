# 全体を理想にする仕上げ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 400〜500 行の 39 本を意味単位に分け、commit 直前の見張りを入れ、重複・名前・古い記録を点検し、外側を押したときの動きを 1 つの仕組みに揃える。

**Architecture:** 見張りは `src/architecture/__tests__/`(大きさ・共通の見た目)に集め、pre-commit で毎回流す。外側検知は共通フック `useDismissOnOutside` 1 本に集め、手書きは共通の見た目の見張りの rule で禁止する。分割は 7 組の担当が別 worktree で行い、親が検収して cherry-pick・commit する。

**Tech Stack:** React 19 / TypeScript / vitest / Playwright / husky

**Spec:** `docs/superpowers/specs/2026-10-28-ideal-finish-design.md`

## Global Constraints
- 見た目は変えない。visual-regress の合格は「全部一致」。意図して変えたのは ④ の「下に届かない」だけで、差が出たら理由を書いて基準を更新する。
- 分割はスキル project-hygiene「分け方の決まり」に従う(担当への指示書にこの節を一字一句写す)。行数の目安は書かない。
- 管理画面の AdminTemplates.tsx・TemplateEditor.tsx は分けない(作り直しの予定がある)。
- 担当は commit しない。commit は親が 1 系統で行う。担当の作業中に親は commit しない。
- コメント・文書は日本語で書く。公開リポなので、秘密の値・個人の識別子は書かない。
- 新しい比較の基準名は `pre-finish`(Task 0 で保存する)。

## Review Focus
1. チュートリアルの部品(TutorialMenu・TutorialCard)は、チュートリアル中でも自分の外側で閉じる必要がある → フックに `allowDuringTutorial` を持たせ、Task 3 のテストで固定する。
2. portal で body 直下に出した子(サブメニュー・日付ピッカーのカレンダー等)の中を押しても閉じてはいけない → `insideRefs` に渡す。Task 3 のテストで固定する。
3. 開くボタンをもう一度押したら「閉じる」だけになり、閉じてすぐ開き直してはいけない → 開くボタンも外扱いにして、続く click を止める。Task 3 のテストで固定する。
4. タッチ端末では pointerdown の後の click が遅れて来る、または来ない → 止める click は「次の 1 回か 400ms まで」とし、残ったままにしない。Task 3 のテストで固定する。
5. メニューの外で押した先がテキスト入力の場合は、閉じたうえで、その入力欄にフォーカスが当たってよい(focus は止めない・click だけ止める)→ Task 4 の実ブラウザ確認に入れる。

---

### Task 0: 比較の基準を保存する

- [ ] **Step 1:** `node scripts/visual-regress/run.mjs --save-as=pre-finish`(約 21 分・`src/` に未コミット変更が無い状態で行う)。期待: exit 0・`.out/baselines/pre-finish/` ができる。

### Task 1: commit 直前の見張り+共通の見た目の見張り(rule 1 本目=外側検知の手書き)

**Files:**
- Modify: `.husky/pre-commit`(末尾の `echo "✅ gitleaks..."` の後)
- Create: `src/architecture/__tests__/shared-look.test.ts`(`~/.claude/skills/project-hygiene/templates/shared-look.test.ts` の写し)
- Create: `src/architecture/__tests__/shared-look.json`

**Interfaces:**
- Produces: shared-look.json の rule id `outside-dismiss-handwritten`(Task 4 が frozen を 0 にする)

- [ ] **Step 1:** pre-commit に追記する。`./node_modules/.bin/vitest run src/architecture/__tests__ --reporter=dot || { echo "❌ 作りの見張りが失敗しました。commit を中止します。"; exit 1; }`
- [ ] **Step 2:** shared-look.json を作る。rule は `{ "id": "outside-dismiss-handwritten", "pattern": "(document|window)\\.addEventListener\\(\\s*['\"](mousedown|pointerdown|click)['\"]", "files": "^src/.*\\.tsx?$", "sharedHome": "^src/hooks/useDismissOnOutside\\.ts$|/__tests__/", "why": "外側を押した時の動きは useDismissOnOutside だけが書く(外側=閉じるだけ・下に届けない)" }`。frozen には今の数を入れる(テンプレのテストが落ちた時に出す一覧から写す)。外す物(Tooltip.tsx・MilspecTitleTooltip.tsx・MilspecKey.tsx は「閉じる」ではない)は frozen ではなく、理由つきの例外として `sharedHome` に足す。
- [ ] **Step 3:** `npx vitest run src/architecture/__tests__ --reporter=dot` → PASS。
- [ ] **Step 4:** わざと `src/components/__tmp.tsx` に `document.addEventListener('mousedown', f)` を書いて FAIL を確かめ、消す。
- [ ] **Step 5:** 空の commit で pre-commit が見張りを流すことを確かめる(出力に vitest の dot が出る)→ そのまま commit。`chore: commit 直前に作りの見張りを流す・外側検知の手書きを凍らせる`

### Task 2: 点検の棚卸し(読むだけ・Explore 担当)

**Files:**
- Create: `docs/.private/2026-10-28-ideal-finish-audit.md`

- [ ] **Step 1:** 次の 4 つを一覧にする。各行に `path:line`・抜粋・提案(共通化/改名/削除/残す+理由)。
  - 重複の見た目: 浮かぶ面の手書き(`float-surface` 以外で backdrop-filter+box-shadow+背景を同時に書く CSS)・角の丸みの直書き(`border-radius: <数字>px` と `rounded-[` の数)・お知らせ(トースト)の手書き・ボタンの形の手書き。3 か所以上の物だけを「共通化の候補」にする。
  - 重複の処理: 同じ名前・同じ中身の関数が 2 か所以上にある物(knip の duplicates と、目で見た関数名の一致)。
  - 名前: ファイル名と中身の仕事が合わない物。名前に `Misc`/`Utils`/`Helpers`/`And`/`+` が付く物。
  - 古い記録: `popular`・`featured`・`copyCount`・`みんなの軽減表`・`MitigationSheet`(Preview 以外)・`unused/` を指すコメント・文書・翻訳キー・設定。docs と TODO_COMPLETED / DESIGN_DECISIONS が食い違う記述。
- [ ] **Step 2:** 親へ件数の要約を 1 回だけ報告して終える(直さない)。

### Task 3: 共通フック useDismissOnOutside

**Files:**
- Create: `src/hooks/useDismissOnOutside.ts`
- Test: `src/hooks/__tests__/useDismissOnOutside.test.tsx`

**Interfaces:**
- Produces:
```ts
export type DismissOnOutsideOptions = { allowDuringTutorial?: boolean };
export function useDismissOnOutside(
  isOpen: boolean,
  onDismiss: () => void,
  insideRefs: ReadonlyArray<RefObject<HTMLElement | null>>,
  options?: DismissOnOutsideOptions,
): void;
```
`insideRefs` = パネル本体と、portal で出した子。開くボタンは入れない(外扱い=押すと閉じるだけ)。

- [ ] **Step 1: 失敗するテストを書く**(testing-library で、開いたパネル・開くボタン・下のボタン(onClick を spy)を描く)
  - `外側を押すと閉じ、下のボタンの onClick は呼ばれない`: pointerdown→mouseup→click を下のボタンに送る → onDismiss 1 回・spy 0 回
  - `中を押しても閉じない`: パネル内の pointerdown/click → onDismiss 0 回
  - `portal の子の中を押しても閉じない`: insideRefs[1] の中 → 0 回
  - `中で押して外で離しても閉じない`: パネル内 pointerdown → 外で click → onDismiss 0 回(click を止めるのは外で押した時だけ)
  - `開くボタンを押すと閉じるだけで開き直さない`: 開くボタンの onClick(トグル)spy 0 回・onDismiss 1 回
  - `止める click は 1 回だけ`: 外で閉じた後、2 回目の click は下に届く(spy 1 回)
  - `click が来なければ 400ms で止めを外す`: fake timers で 400ms 進めた後の click は届く
  - `重なりは手前だけ`: フック 2 つ(後から開いた方が手前)→ 外を押すと手前の onDismiss だけ 1 回
  - `チュートリアル中は閉じない`: `useTutorialStore.setState({ isActive: true })` → 0 回。`allowDuringTutorial: true` なら 1 回
  - `isOpen=false の時は何もしない`
- [ ] **Step 2:** `npx vitest run src/hooks/__tests__/useDismissOnOutside.test.tsx` → FAIL(モジュールが無い)
- [ ] **Step 3:** 実装する。document の `pointerdown`(capture)で判定する。外なら onDismiss を呼び、`click` を capture・once で `preventDefault`+`stopPropagation` する止めを 400ms だけ置く。重なりは useEscapeClose と同じモジュール内スタック(最後に開いた物だけが反応)。onDismiss は ref で最新を読む。
- [ ] **Step 4:** 同じコマンド → PASS
- [ ] **Step 5:** commit `feat: 外側を押した時の共通フック useDismissOnOutside`

### Task 4: 33 か所を共通フックへ乗せ替える(Task 1・3 の後)

**Files(Modify)**: AASettingsPopover・admin/templates/LocalizedEditPopover・ClearMitigationsPopover・LanguageSwitcher・ImportMenu・PulseSettings・ui/ContextMenu・progress/ProgressRecordPanel・tutorial/TutorialMenu・tutorial/TutorialCard・PartyStatusPopover・PartySettingsModal・housing/workspace/FilterDropdown・timeline/useTimelineWindowEvents(useTimelineClearMenuOutsideClick)・housing/housinger/HousingerReportMenu・HeaderTimeInput・HeaderMechanicSearch・HeaderGimmickDropdown・HeaderToolsMenu・HeaderPhaseDropdown・housing/shell/HousingBottomNav・housing/shell/AppHeader・housing/browse/BrowseSortSelect・BrowseViewToggle・ListingCard・Memo/MemoInputBox・housing/register/HousingDateTimePicker・housing/notifications/NotificationBell・housing/listing/HousingDetailKebab・HousingShareButton(Task 1 で frozen に入った全部。ずれていたら frozen の一覧が正)
- Modify: `src/architecture/__tests__/shared-look.json`(frozen の `outside-dismiss-handwritten` を空にする)
- Create: `playwright/outside-dismiss.spec.ts`

- [ ] **Step 1:** 各ファイルの手書きの useEffect を `useDismissOnOutside(open, close, [panelRef, ...portalRefs])` に置き換える。チュートリアルの 2 本は `{ allowDuringTutorial: true }`。今「外側で閉じない条件」(入力途中・処理中)を持つ物は、その条件を `isOpen && !busy` の形で第 1 引数に残す。開くボタン側の `stopPropagation` によるトグル回避の工夫は不要になるので消す。
- [ ] **Step 2:** `npx vitest run src/architecture/__tests__` → PASS(手書き 0)。触ったファイルの既存テスト → PASS。
- [ ] **Step 3:** `playwright/outside-dismiss.spec.ts` を書く。ヘッダーのツールメニュー・言語切替・ハウジングの並び替え・通知のベル・右クリックメニューの 5 か所で「開く→下にあるボタンの位置を押す→閉じる・下は反応しない」を確かめ、Review Focus 5(外の入力欄を押すとフォーカスが当たる)を 1 か所で確かめる。`npx playwright test playwright/outside-dismiss.spec.ts` → PASS
- [ ] **Step 4:** `node scripts/visual-regress/run.mjs --compare=pre-finish` → 一致(差が出たら、下に届かなくなったことによる意図した差かを crops で確かめ、理由を台帳に書く)
- [ ] **Step 5:** commit `refactor: 外側を押した時の動きを 33 か所とも共通フックに揃える`

### Task 5〜11: 意味単位の分割(組 A〜G)

組とファイルは設計書 ① の表に従う。並行: A・B・D・F・G は Task 1〜3 と同時に行う。C・E は Task 4 の commit の後に行う(PulseSettings・PartySettingsModal・ListingCard が重なるため)。各組は 1 担当(Sonnet)が 1 つの worktree で行い、指示書は `docs/.private/2026-10-28-ideal-finish-split-brief.md`(親が書く。前回の `2026-10-28-frozen-split-brief.md` を土台にして、「分け方の決まり」の節を一字一句写す)。

各組の手順:
- [ ] **Step 1:** ファイルごとに仕事の境目(部品・フック・見出し・describe)を一覧にして、分けた後のファイル名を決める。名前に「+」が要る物は、まだ混ざっている。
- [ ] **Step 2:** 移すだけで分ける(中身は書き換えない。import と export の付け替えだけ)。テストのファイルは describe ごとに `<元の名前>.<仕事>.test.tsx` へ分ける。
- [ ] **Step 3:** 確かめる。`npx tsc -b` 0・その組のテスト PASS・テスト名の一覧が分割の前後で同じ(`npx vitest list <対象>` の差 0)・CSS は `node scripts/css-colocation/compare-build.mjs` 欠け 0・`node scripts/visual-regress/run.mjs --compare=pre-finish --only=<その組の画面>` 一致。
- [ ] **Step 4:** 1 つの仕事のままで 400 行を超える物は、切らずに理由をつけて報告する。
- [ ] **Step 5:** 親が検収して cherry-pick し、組ごとに commit `refactor(<組>): <ファイル> を仕事ごとに分ける`

### Task 12: 共通の見た目の rule を足す(Task 2 の後)

**Files:**
- Modify: `src/architecture/__tests__/shared-look.json`
- Modify: `.claude/rules/ui-design.md`(末尾に 3 行)

- [ ] **Step 1:** 棚卸しで「3 か所以上」になった見た目ごとに rule を 1 本ずつ足す(浮かぶ面・角の丸み・お知らせ・ボタンの形のうち、該当した物)。sharedHome = その共通の部品のファイル。今の数を frozen に入れる。
- [ ] **Step 2:** わざと 1 か所足して FAIL を確かめ、戻す。`npx vitest run src/architecture/__tests__` → PASS
- [ ] **Step 3:** ui-design.md に「新しい UI の前に共通の部品を探す・shared-look.json で凍らせた書き方はまねしない・外側を押した時の動きは useDismissOnOutside」を書く。
- [ ] **Step 4:** commit `chore: 共通の見た目の見張りに <rule 名> を足す`

### Task 13: 点検の修正(Task 2・12 の後)

- [ ] **Step 1:** 棚卸しの一覧を上から順に直す。共通化は frozen の数を減らす方向で行う(1 部品ずつ・visual-regress の該当画面一致)。改名は `git mv` で行い import を直す。古い記録は消すか、今の状態へ書き直す。残す物は、一覧に理由を書く。
- [ ] **Step 2:** `npx tsc -b` 0・`npm run knip` 0・対象テスト PASS
- [ ] **Step 3:** 種類ごとに commit(共通化 / 改名 / 古い記録)

### Task 15: これまでの宿題の回収(設計書 ⑤ の a〜g)

- [ ] **Step 1:** (a)(d) は「わざと壊して見張りが気づかない」再現テストを先に書いて FAIL を確かめ、見張りを直して PASS にする。(e) は「行き先に書けない物が 1 つあると、何も書き換えない」テストを先に書く。
- [ ] **Step 2:** (b) は standard-parts.css へ一字一句移し、compare-build 欠け 0・visual-regress の military 一致を確かめる。
- [ ] **Step 3:** (c)(f) は systematic-debugging で根因を特定してから直す(推測で設定を変えない)。
- [ ] **Step 4:** (g) は firestore.rules の変更と deploy を masaya に確認してから行う(本番の保存の決まりなので)。
- [ ] **Step 5:** 1 件ごとに commit

### Task 16: CSS のテーマ指定を部品から抜く(設計書 ⑥・Task 5〜11 の後)

- [x] **Step 1:** 測る: 部品の CSS にあるテーマ指定の本数と種類を一覧にし、@layer の今の使い方(base の 5 本・PartySettingsModal.css)を確かめる。
- [x] **Step 2:** brainstorming→writing-plans で別の設計書・計画に起こす(1 部品ずつ・visual-regress 一致・見張りで数を凍らせる)。
- [x] **Step 3:** その計画どおりに実行する(10-29 完了)。

### Task 14: 最終ゲート

- [ ] **Step 1:** `npm run test:gate` 失敗 0・`npm run build` 0・`npm run lint` 0・`npm run knip` 0
- [ ] **Step 2:** `node scripts/visual-regress/run.mjs --compare=pre-finish` 全体一致(意図した差は理由つき)・`node scripts/css-colocation/compare-build.mjs` 欠け 0
- [ ] **Step 3:** 400 行を超える文字のファイルを数え直す(データ・自動生成・翻訳・例外の登録を除く)。残ったのは理由つきの物だけ、を確かめる
- [ ] **Step 4:** fresh context の opus で全体の敵対レビュー(正しさの指摘だけ取り込む)
- [ ] **Step 5:** TODO.md を更新し、完了を TODO_COMPLETED.md へ移して commit
