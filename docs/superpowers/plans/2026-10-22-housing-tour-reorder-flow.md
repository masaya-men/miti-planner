# ツアー並び替えの流れ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアー開始前・ナビ中のどちらからでも「回る順番」を変えられるようにし、それが分かるようにする。

**Architecture:** 計画とナビは同じ `/housing/tour`(TourNavPage が `listingIds` 0 件=計画 / 非 0=ナビ)。ナビ中の並び替えは TourNavPage 内のローカル状態 `replanning` で計画と同じ部品(TourTrayBoard / TourTrayList / TourTrayDetailPanel)を「残りの家だけ」で再利用し、戻るときに store の新アクション `reorderRemaining` で確定する。共有ツアーは live doc に `order`(家 id 配列)を足して参加者へ反映。

**Tech Stack:** React + zustand + react-i18next + dnd-kit + Firestore rules / vitest(happy-dom)

**Spec:** `docs/.private/2026-10-22-masaya-housing-fix-memo.md` の「並び替えの流れ 確定」節(①〜⑥)。見本 = https://claude.ai/artifact/WKgVZ2wrPQ72oocY4q3LMa

## Global Constraints

- `/housing` 配下は `.claude/rules/housing-design.md` 厳守: 色・font-size・寸法・影は `src/styles/housing.css` のトークン/クラス経由(tsx に rgb/hex/px 直書き禁止)。主アクション=ハニー(`.housing-tour-tray-start` 系)、副アクション=枠ボタン(`.housing-tour-progress-action--view` と同じ見た目: `--housing-chip-bg` 背景 + `--housing-panel-border` 枠)。装飾ピル/グラデ追加/色付き alert 箱は禁止。
- 文字列は i18n キー経由・**ja / en / ko / zh / zh-Hant の 5 ファイル全部**(`src/locales/*.json`)。ロケール JSON は該当ブロックだけ textual に編集(全体の再整形禁止)。
- 新しい文言(ja は確定・他言語は既存ハウジング文言のトーンで自然に訳す):
  - `housing.tray.reorder_then_start` = 「回る順番を変えてからツアー」/ en "Reorder stops, then tour"
  - `housing.tray.start_now` = 「このまま開始」/ en "Start now"
  - `housing.tour.reorder_button` = 「順番を変える」/ en "Reorder"
  - `housing.tray.board_title` = 「回る順番」/ en "Route order"
  - `housing.tray.board_hint`(既存キーの文言変更)= 「カード左の ⋮⋮ をつかんでドラッグで入れ替え・効率順ボタンで自動に並べ替え」/ en "Drag the ⋮⋮ handle to reorder, or use the efficient-order button"
  - `housing.tour.replan.hint` = 「ツアー中です。見学済みのハウジングは動かせません。これから行くハウジングはドラッグで入れ替えられます」
  - `housing.tour.replan.visited` = 「見学済み」/ `housing.tour.replan.upcoming` = 「これから行く順番」/ `housing.tour.replan.current_tag` = 「向かっている」
  - `housing.tour.replan.resume` = 「ツアーに戻る」/ `housing.tour.replan.resume_note` = 「新しい順番の、まだ行っていない最初のハウジングからナビを再開します。」
- テストは `__tests__/` 配下。実行は対象ファイルだけ `npx vitest run <files>`(全体は最後に `npm run test:gate`)。型は `npx tsc -b`。
- commit しない(親が検収して commit)。

## Review Focus

- 並び替えで今向かっている家を後ろへ動かした → 戻ったら新しい順番の未訪問の最初の家へ。見学中(viewing)だった家が先頭から外れたら phase は moving・viewStartAt null。先頭が同じ家なら phase/viewStartAt を保つ。(Task 4 のテスト)
- 共有ツアー参加者が古い live doc(order 無し)を受け取る → snapshot 順のまま表示。order に snapshot に無い id が混じる/足りない → snapshot に有る id だけ order 順、order に無い家は末尾へ。(Task 5 のテスト)
- 共有ツアーの幹事が並び替えた → 参加者の currentIndex が指す家が幹事と一致する(order と currentIndex を同じ書き込みで送る)。(Task 5)
- ナビ中の並び替えで家を消せてしまう → 残り 0 件で戻れる事故。並び替え中は削除ボタンを出さない。(Task 4)
- ハウジンガーページ「まとめてツアー」を本人以外が押す → ツアーは開始されず、並び替え画面にその人の家がトレイとして並ぶ。既存トレイの家は消えない。(Task 2)

---

### Task 1: 開始ボタンを 2 つに(PC 右パネル・スマホ下バー)

**Files:**
- Modify: `src/components/housing/browse/TourTray.tsx`(開始ボタン周り・props に `onReorder: () => void` 追加)
- Modify: `src/components/housing/pages/BrowsePage.tsx:238` / `src/components/housing/pages/FavoritesPage.tsx:257`(`onReorder={() => navigate('/housing/tour')}` を渡す)
- Modify: `src/components/housing/shell/MobileTourTrayBar.tsx:80-96`(アイコンだけの並び替えボタン → 枠ボタン「順番を変える」(`housing.tour.reorder_button`)・開始ボタンの文言 → `housing.tray.start_now`)
- Modify: `src/styles/housing.css`(副アクションの枠ボタンのクラスを追加 or 既存流用)/ `src/locales/*.json`
- Test: `src/__tests__/housing/TourTray.test.tsx`、MobileTourTrayBar のテスト(既存があればそこ、無ければ `src/components/housing/shell/__tests__/MobileTourTrayBar.test.tsx` 新規)

PC 右パネル下部(見本①): 区切り線の下に縦 2 段。上=枠ボタン(並び替えアイコン ArrowDownUp + `housing.tray.reorder_then_start`)、下=ハニー(Play + `housing.tray.start_now`)。トレイ 0 件ならどちらも disabled。並び替えボタンはトレイを消さずに `/housing/tour`(計画画面)へ。開始ボタンは今の onStart のまま(マナー確認→即ナビ)。

- [ ] Step 1: 失敗テスト — TourTray: 「回る順番を変えてからツアー」ボタンを押すと `onReorder` が 1 回呼ばれ `onStart` は呼ばれない / 「このまま開始」で `onStart` / 0 件で両方 disabled。MobileTourTrayBar: 「順番を変える」(accessible name)で navigate('/housing/tour')、トレイは空にならない。
- [ ] Step 2: 失敗を確認 → Step 3: 実装 → Step 4: 対象テスト+`npx tsc -b` 合格

### Task 2: ハウジンガーページ「まとめてツアー」→ 並び替え画面へ

**Files:**
- Modify: `src/components/housing/pages/HousingerPage.tsx:363-395`(commitTourAll)と呼び出し側(L597-601 付近・マナー確認ダイアログがこの経路にあれば外す=開始は並び替え画面の開始ボタンでマナー確認が出るため)
- Test: `src/__tests__/housing/HousingerPage.test.tsx`(既存の tourAll テストを新仕様へ更新)

今の「既存トレイ+その人の家を後ろへ追加し orderTourStopIds で順序付け」の結果を **ツアー store ではなく `useTourTrayStore` のトレイ**に入れ、`start()` / `enterTourMode()` / `trayStore.clear()` は呼ばず、`navigate('/housing/tour')` だけする。

- [ ] Step 1: 失敗テスト — tourAll を押すと `useHousingTourStore.getState().running === false`・`listingIds` 空のまま、トレイ(`useTourTrayStore`)に既存分+その人の家が入り、navigate('/housing/tour')。
- [ ] Step 2〜4: 失敗確認 → 実装 → 対象テスト+tsc 合格

### Task 3: 並び替え画面の見出し・案内・左の住所

**Files:**
- Modify: `src/components/housing/browse/TourTrayBoard.tsx:157-163`(ツールバー: 左に見出し `housing.tray.board_title`(大きめ・太字)とその下に `housing.tray.board_hint`(既存 `.housing-tour-board-hint`)、右に効率順ボタン。見出し行の下にヘアライン区切り)。props に `hint?: string`(ナビ中の並び替えで差し替え用・未指定は board_hint)
- Modify: `src/components/housing/tour/TourTrayDetailPanel.tsx`(タイトル h2 の下に住所 1 行。形式はナビ画面 `TourShowcasePanel.tsx:97-98` と同じ関数。`canDisplayAddress(listing)` が false なら出さない。タイトル未入力で h2 自体が住所のときは重複させない)。props に `startLabel?: string`・`note?: string`(Task 4 用。未指定なら今の `housing.tray.start`・note なし)
- Modify: `src/styles/housing.css`(見出しクラス)/ `src/locales/*.json`
- Test: `src/components/housing/browse/__tests__/TourTrayBoard.test.tsx`、`src/components/housing/tour/__tests__/TourTrayDetailPanel.test.tsx`

- [ ] Step 1: 失敗テスト — Board に「回る順番」の見出しと新ヒント文 / `hint` 指定時はその文。DetailPanel: タイトル有り+住所公開→住所 1 行が出る / 住所非公開→出ない / タイトル無し→住所は h2 の 1 回だけ / `startLabel`・`note` 指定時にその文言。
- [ ] Step 2〜4

### Task 4: ナビ中の「順番を変える」

**Files:**
- Modify: `src/store/useHousingTourStore.ts`(アクション追加)
- Modify: `src/components/housing/pages/TourNavPage.tsx`(ローカル state `replanning`・並び替え表示)
- Modify: 「ルートのステップ」見出しを描いているコンポーネント(`TourRouteSteps.tsx` か `TourProgressPanel.tsx`・見出しの右に枠ボタン `housing.tour.reorder_button`。prop `onReorder?: () => void` が有るときだけ表示=参加者画面 JoinTourPage では出ない)
- Modify: `src/components/housing/tour/TourMobileBar.tsx`(上段右に同ボタン・prop `onReorder?`)
- Create: `src/components/housing/tour/TourVisitedList.tsx`(見学済みの家の固定リスト: 鍵アイコン・番号・サムネ・名前・「見学済み」・薄く・ドラッグ不可)
- Modify: `TourTrayBoard.tsx` / `TourTrayList.tsx`(prop `removable?: boolean`(既定 true)・false で × ボタンを出さない。`currentId?: string` で「向かっている」タグ)
- Modify: `src/styles/housing.css` / `src/locales/*.json`
- Test: `src/store/__tests__/useHousingTourStore.test.ts`(無ければ新規)、`src/components/housing/pages/__tests__/TourNavPage.test.tsx`

**Interfaces:**
- Produces: `reorderRemaining: (remainingIds: string[]) => void` — `listingIds = listingIds.slice(0, currentIndex).concat(remainingIds)`、`currentIndex` 据え置き。新しい `listingIds[currentIndex]` が元と違えば `phase='moving'`・`viewStartAt=null`、同じなら据え置き。`remainingIds` が空なら何もしない。

画面(見本④): `replanning` 中は PC=計画画面と同じ 2 パネル。左=TourTrayDetailPanel(選択中の家・`startLabel=housing.tour.replan.resume`・`note=housing.tour.replan.resume_note`・押すと `reorderRemaining(draft)` して `replanning=false`。マナー確認は出さない)。右=見出し+`hint=housing.tour.replan.hint`、`housing.tour.replan.visited` の小見出し+TourVisitedList(0 件なら節ごと非表示)、`housing.tour.replan.upcoming` の小見出し+TourTrayBoard(`listingIds=draft`・`removable=false`・`currentId=元の listingIds[currentIndex]`)。draft は `replanning` 開始時に `listingIds.slice(currentIndex)` で初期化。スマホ=TourVisitedList+TourTrayList(同 props)+「ツアーに戻る」ボタン。完了オーバーレイ表示中は「順番を変える」を出さない。

- [ ] Step 1: 失敗テスト(store)— 4 件中 currentIndex=1 で `reorderRemaining(['d','b','c'])` → `['a','d','b','c']`・currentIndex 1・phase moving / 先頭が同じ `['b','d','c']` で viewing と viewStartAt を保つ / 空配列で不変。
- [ ] Step 2: 失敗テスト(画面)— ナビ中に「順番を変える」→ 「見学済み」「これから行く順番」が出て × ボタンが無い →「ツアーに戻る」でナビ表示に戻る。
- [ ] Step 3〜5: 失敗確認 → 実装 → 対象テスト+tsc 合格

### Task 5: 共有ツアー中の並び替えを参加者へ

**Files:**
- Modify: `src/types/sharedTour.ts`(`SharedTourLiveState` に `order?: string[] | null` と説明コメント)
- Modify: `src/lib/sharedTour/hostSync.ts`(`pushHostState` の patch に `order` を追加)/ `TourNavPage.tsx:312-317`(`order: listingIds` を同じ書き込みで送る・deps に listingIds)
- Create: `src/lib/sharedTour/applyLiveOrder.ts` — `applyLiveOrder(snapshotIds: string[], order: string[] | null | undefined): string[]`(order が配列なら snapshot に有る id だけ order 順・重複除去、order に無い snapshot の id は元の順で末尾へ。order 無しは snapshotIds そのまま)
- Modify: `src/components/housing/pages/JoinTourPage.tsx:38`(orderedIds を `applyLiveOrder(snapshot ids, live?.order)` に)
- Modify: `firestore.rules` の live update 条件に `&& (!('order' in request.resource.data) || request.resource.data.order == null || (request.resource.data.order is list && request.resource.data.order.size() <= 100))`
- Test: `src/lib/sharedTour/__tests__/applyLiveOrder.test.ts`、rules テストが既存なら同ファイルに 1 件

- [ ] Step 1: 失敗テスト — applyLiveOrder: 無し→そのまま / 並び替え / 未知 id 無視 / 欠けた id は末尾 / 重複除去。
- [ ] Step 2〜4
- 注意: rules の本番反映(`firebase deploy --only firestore:rules`)は親が push 時に行う。実装役は実行しない。
