# Layout 分割 Implementation Plan(整頓④の 2 つ目)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/components/Layout.tsx`(918 行・90 日で 16 変更/7 fix)を「部品の組み立て役」だけにし、処理と部品を `src/components/layout/` へ分ける。見た目と動きは 1 つも変えない。

**Architecture:** 中身の移動だけ(書き換えない)。フックは呼ぶ順番を今と同じに保つ(下の「順番の約束」)。JSX は今の DOM の並び順のまま部品へ切り出す。前後比較は ① 一時検査「HTML を状態ごとに記録→分割後に完全一致」 ② 恒久テスト「自動保存の動き」 ③ visual-regress `--compare=dpr2`(miti/・mobile/・milspec/)。

**Tech Stack:** React 18 / zustand / framer-motion / vitest(happy-dom)/ Playwright(visual-regress)

**Spec:** `docs/.private/2026-10-27-lopo-refactor-ideal.md` の表 4 行目(各 1000 行以下・1 仕事・前後比較)

## Global Constraints

- 動き・見た目・DOM の並び順・クラス名・文言を変えない(コメントも原則そのまま移す)。
- **順番の約束(データ安全)**: Layout 内のフック呼び出し順 = 起動時復旧 → 共同編集の管制 → 自動保存 → ログイン時の取り込み。管制の subscribe は自動保存の subscribe より先に登録されること(Layout.tsx:239-241 のコメントの理由)。
- `isRemoteLoadingRef` は 1 本だけ作り、復旧・自動保存・取り込みで共有する。
- 新ファイルは `src/components/layout/` に置く。テストは `__tests__/` 配下。
- 1 タスク 1 コミット。push しない(milspec-polish は未 push のまま)。

## Review Focus

1. 素早いプラン切替(500ms 以内)→ 旧プランへ新データを書かない(Task 1 の恒久テストで固定)。
2. 共同編集中のプラン切替 → 自動保存側で保存しない(Task 1 の恒久テストで固定)。
3. スマホ下ナビの排他(1 つ開くと他が閉じる・未ログインのアカウントはログイン窓)→ Task 1 の HTML 記録で固定。
4. フォーカスモード(F キー)→ 右の細い帯とボタンが出る → Task 1 の HTML 記録で固定。
5. MIL-SPEC PC では MilspecLayout に同じ値が渡る → Task 1 の HTML 記録(部品の代役が受け取った値を書き出す)で固定。

---

### Task 1: 分割前の記録(一時検査+恒久テスト)

**Files:**
- Create: `src/components/__tests__/Layout.markupLock.test.tsx`(一時・Task 4 で削除)
- Create: `src/components/__tests__/Layout.autosave.test.tsx`(恒久)

- [ ] **Step 1: 一時検査を書く。** 子部品(Sidebar・ConsolidatedHeader・Mobile*・MilspecLayout・LoginModal ほか Layout が import する部品すべて)を「受け取った値を `data-props` に JSON で書き出す代役」に差し替え(関数は `"fn"`)、Layout が自分で書く HTML と配線だけを記録する。代役の MobileBottomNav は onMenuToggle 等を呼ぶボタンを持つ。状態(各 `container.innerHTML` を `toMatchSnapshot`):
  PC 既定 / PC プラン未選択 / PC で F キー(フォーカスモード)/ PC で S・H キー / PC 認証戻り中(localStorage `lopo_auth_redirecting`)/ PC 初回ユーザー / PC チュートリアル中 / MIL-SPEC PC / スマホ既定 / スマホ下ナビ: メニュー→取り込み→共有→アカウント(未ログイン・ログイン済)→カンペ の順に押した各時点 / スマホ プラン未選択。
- [ ] **Step 2: 恒久テストを書く**(実ストア・タイマーは fake):
  - `作業ストアの変更から 500ms 後に持ち主のプランへ保存する`
  - `500ms 以内にプランを切り替えたら旧プランへ保存しない`
  - `共同編集中のプラン切替では保存しない`
  - `タブが隠れたら即保存して saved になる`
- [ ] **Step 3:** 両方を実行 → 通る(スナップショット新規作成)。`npx vitest run src/components/__tests__/Layout.` 
- [ ] **Step 4: Commit** `test: Layout 分割前の画面の中身と自動保存の動きを記録(整頓④)`

### Task 2: 処理(フック)を layout/ へ移す

**Files:** Create in `src/components/layout/`:
- `useSidebarOpenState.ts` → `{ isSidebarOpen, setIsSidebarOpen, handleToggleSidebar, setSidebarPersisted, closeSidebar }`(Layout.tsx:64-85。`closeSidebar` は 589/637 行の閉じる処理)
- `useLayoutShortcuts.ts` → `useLayoutShortcuts({ isMobile, isSidebarOpen, isHeaderCollapsed, setSidebarPersisted, setIsHeaderCollapsed }): void`(141-202)
- `useBootstrapRestore.ts` → `useBootstrapRestore(isRemoteLoadingRef): void`(204-234)
- `useCollabLifecycle.ts` → `useCollabLifecycle(): void`(236-268・順番の約束のコメントごと)
- `usePlanAutoSave.ts` → `usePlanAutoSave(isRemoteLoadingRef): void`(270-425)
- `useLoginMigration.ts` → `useLoginMigration(isRemoteLoadingRef): LocalImportProps`(427-556・`{ isOpen, plans, onImport, onClose }` を返す)
- `useAuthRedirecting.ts` → `{ isNewUser, showAuthRedirecting }`(561-576)
- `useMobileSheets.ts` → 8 つの開閉 state・チュートリアル時に閉じる処理・カンペのイベント(101-139)と下ナビの押下処理 5 本(834-865 を一字一句)
- Modify: `src/components/Layout.tsx`(上記を呼ぶだけに。順番の約束を守る)
- [ ] Step 1: 移す → Step 2: Task 1 の 2 テストが変更なしで通る → Step 3: `npx tsc -b` 0 → Commit `refactor: Layout の処理を layout/ のフックへ分ける(整頓④)`

### Task 3: 部品(JSX)を layout/ へ移す

**Files:** Create in `src/components/layout/`:
- `AuthRedirectingOverlay.tsx`(618-625)
- `EmptyPlanState.tsx` `({ isMobile })`(725-744)
- `FocusModeRail.tsx` `({ visible, theme, onToggleTheme })`(752-808・`visible = isHeaderCollapsed && !isSidebarOpen`)
- `MobileTopSheets.tsx`(641-678 メニュー+パーティのシート)
- `LayoutOverlays.tsx`(810-916 を並び順そのまま。スマホのシート状態と押下処理は props)
- Modify: `src/components/Layout.tsx`
- [ ] Step 1: 移す → Step 2: Task 1 の 2 テストが変更なしで通る → Step 3: `npx tsc -b` 0 → Commit `refactor: Layout の部品を layout/ へ分ける(整頓④)`

### Task 4: 最終ゲートと後片付け

- [ ] Step 1: `node scripts/visual-regress/run.mjs --compare=dpr2 --only=miti/`、`--only=mobile/`、`--only=milspec/` → 差 0(差が出たら 1 回だけ撮り直し)
- [ ] Step 2: 一時検査 `Layout.markupLock.test.tsx` とスナップショットを削除
- [ ] Step 3: `npm run build` 0・`npm run test:gate` 失敗 0
- [ ] Step 4: 新しい目(別エージェント)で全体レビュー(正しさの指摘だけ採用)
- [ ] Step 5: TODO.md・順番表を更新 → Commit `test: Layout 分割用の一時検査を削除(分割後も全状態一致を確認済み)`
