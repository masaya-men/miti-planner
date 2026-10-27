# TourNavPage 分割 Implementation Plan(整頓④の 3 つ目)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/components/housing/pages/TourNavPage.tsx`(690 行・90 日で 11 変更/5 fix)を「ツアー中の 3 パネルの組み立て役」だけにし、処理と部品を `src/components/housing/tour/` へ分ける。見た目と動きは 1 つも変えない。

**Architecture:** 中身の移動だけ(書き換えない・重複している終了処理 3 本もまとめない)。フックは effect の実行順を今と同じに保つ(下の「順番の約束」)。JSX は今の DOM の並び順のまま部品へ切り出す。前後比較は ① 一時検査「HTML と外への呼び出しを状態ごとに記録→分割後に完全一致」 ② 既存の恒久テスト `TourNavPage.test.tsx`(32 件)が変更なしで通る ③ visual-regress `--compare=dpr2 --only=housing/`。

**Tech Stack:** React 18 / zustand / react-router / vitest(happy-dom)/ Playwright(visual-regress)

**Spec:** `docs/.private/2026-10-27-lopo-refactor-ideal.md` の表 4 行目(各 1000 行以下・1 仕事・前後比較)

## 測った結果(分割前)

| 行 | 中身 | 行き先 |
|---|---|---|
| 52-108 | 購読・pool・useTourRenderModel・isLast | ページに残す |
| 80-94, 258-337 | 招待(token/名前/作成中/発行待ち・発行・コピー・live 同期 effect) | `useHostInvite` |
| 110-126 | ナビ中の並び替え(draft・選択・確定) | `useTourReplan` |
| 128-171 | 跨ぎ ack・行き方帯・経過チップ・招待案内文 | ページに残す |
| 173-256 | 計画画面(住所から追加・トレイ・選択・マナー・開始) | `useTourPlanning` |
| 339-375 | 終了・完了後に探す/お気に入りへ戻る | `useTourExit` |
| 377-397 | 主ボタン・報告 | ページに残す |
| 403-487 | 計画フェーズの JSX(空状態/スマホ一覧/PC 蛇行) | `TourPlanningView` |
| 494-553 | 並び替え中の JSX(PC/スマホ) | `TourReplanView` |
| 652-679 | 完了オーバーレイ | `TourCompleteOverlay` |

見張りテスト `src/components/housing/__tests__/HousingDialog.guard.test.ts:16` の許可リストは完了オーバーレイの場所を指しているので、移動先へ書き換える。visual-regress カタログ(`scripts/visual-regress/catalog/housing.mjs`)の covers に新部品名を足す。

## Global Constraints

- 動き・見た目・DOM の並び順・クラス名・文言・コメントを変えない(コメントは移動先へそのまま持っていく)。
- **順番の約束**: effect の登録順 = useTourRenderModel 内 → useElapsed → 計画の選択戻し(useTourPlanning)→ 招待の live 同期(useHostInvite)。ページでの呼び出し順もこの順にする。
- `useHostInvite` は `crossingAckIndex` を受け取る(live 同期 effect の依存に入っているため)ので、跨ぎ ack の state より後で呼ぶ。
- 新ファイルは `src/components/housing/tour/`。テストは `__tests__/` 配下。
- 1 タスク 1 コミット。push しない(milspec-polish は未 push)。

## Review Focus

1. 招待発行 → 「次へ/見学/前へ」のたびに pushHostState が同じ引数で呼ばれる(Task 1 の記録で固定)。
2. 非公開/一時追加を含む招待 → 警告ダイアログ → 「このまま」で発行・スマホは自動コピー(Task 1 の記録で固定)。
3. 完了 → 3 パネルが inert・スマホ下バーが消える・戻るで endHostTour と localStorage 削除(Task 1 の記録で固定)。
4. trayIds 0↔1 で「住所から追加」パネルがアンマウントされない(Task 1: 開いたまま 1 件積んで記録)。
5. 並び替え中に見学済みが出る/「ツアーに戻る」でピン留め込みの順で確定(既存恒久テスト+Task 1)。

---

### Task 1: 分割前の記録(一時検査)

**Files:** Create `src/components/housing/pages/__tests__/TourNavPage.markupLock.test.tsx`(一時・Task 4 で削除)

- [ ] **Step 1:** 子部品(TourProgressPanel・TourNavMap・TourShowcasePanel・TourEmptyState・TourInvitePanel・TourTrayDetailPanel・TourVisitedList・TourTrayBoard・TourTrayList・EphemeralAddPanel・MannerNoticeDialog・HousingLoginPrompt・TourMobileBar・TourAddressExposureDialog・HousingReportModal)を「受け取った値を `data-props` に JSON で書き出し、関数 prop ごとに押せるボタンを持つ代役」に差し替える。useTranslation は毎回同じ t(キーをそのまま返す)。createSharedTour/pushHostState/endHostTour/navigate/showToast/clipboard を記録用モックにし、各状態で `container.innerHTML` と「外への呼び出し一覧」を `toMatchSnapshot`。
  状態: 空(PC/スマホ)/ 空で住所から追加を開く→1 件積む / 計画 PC(既定・別カード選択・開始押下→マナー→開始)/ 計画スマホ / 実行中 PC(未ログイン・ログイン済)/ 跨ぎステップ(1 回目・2 回目の次へ)/ スマホ見学中(時刻固定)/ 招待発行(通常・警告ダイアログ経由・スマホ自動コピー)→次へ / 並び替え PC・スマホ(currentIndex=1)→ツアーに戻る / 完了(PC・スマホ)→探すへ・お気に入りへ / 報告を開く / 終了。
- [ ] **Step 2:** `npx vitest run src/components/housing/pages/__tests__/TourNavPage` → 通る(スナップショット新規)
- [ ] **Step 3: Commit** `test: TourNavPage 分割前の画面の中身と外への呼び出しを記録(整頓④)`

### Task 2: 処理(フック)を tour/ へ移す

**Files:** Create in `src/components/housing/tour/`:
- `useTourPlanning.ts` → `useTourPlanning(pool: MockListing[])` が `{ addOpen, setAddOpen, onAddToTray, trayIds, setTrayIds, trayRegionForAdd, selectedPlanId, setSelectedPlanId, selectedPlanListing, planMannerOpen, setPlanMannerOpen, commitPlanStart }` を返す(173-256)
- `useTourReplan.ts` → `useTourReplan(listingIds, currentIndex, pool)` が `{ replanning, replanDraft, setReplanDraft, replanSelectedId, setReplanSelectedId, startReplan, resumeFromReplan }`(110-126・reorderRemaining はフック内で購読)
- `useHostInvite.ts` → `useHostInvite({ isLoggedIn, openLogin, listingIds, pool, ephemeral, currentIndex, phase, viewStartAt, crossingAckIndex })` が `{ tourToken, tourName, setTourName, creatingInvite, pendingInvite, setPendingInvite, onInvite, onConfirmExpose, onCopyInvite, onMobileInviteTap }`(80-94, 258-337)
- `useTourExit.ts` → `useTourExit(tourToken, setCompleted)` が `{ onFinish, backToBrowse, backToFavorites }`(339-375・一字一句)
- Modify: `TourNavPage.tsx`(上記を順番の約束どおり呼ぶ)
- [ ] Step 1: 移す → Step 2: Task 1 と既存 `TourNavPage.test.tsx` が変更なしで通る → Step 3: `npx tsc -b` 0 → Commit `refactor(housing): TourNavPage の処理を tour/ のフックへ分ける(整頓④)`

### Task 3: 部品(JSX)を tour/ へ移す

**Files:** Create in `src/components/housing/tour/`:
- `TourPlanningView.tsx` `({ isMobile, planning, onGoFavorites })`(403-487・`planning` は useTourPlanning の戻り値・`navigate('/housing')` は部品内で useNavigate)
- `TourReplanView.tsx` `({ isMobile, listingIds, currentIndex, pool, replan })`(494-553・visited 等の計算ごと)
- `TourCompleteOverlay.tsx` `({ onBackBrowse, onBackFavorites })`(652-679)
- Modify: `TourNavPage.tsx`、`HousingDialog.guard.test.ts:16`(`'tour/TourCompleteOverlay.tsx'` へ)、`catalog/housing.mjs`(tour-empty/tour-tray の covers に `TourPlanningView`、tour-complete に `TourCompleteOverlay`)
- [ ] Step 1: 移す → Step 2: Task 1・既存テスト・guard テストが通る → Step 3: `npx tsc -b` 0 → Commit `refactor(housing): TourNavPage の部品を tour/ へ分ける(整頓④)`

### Task 4: 最終ゲートと後片付け

- [ ] Step 1: `node scripts/visual-regress/run.mjs --compare=dpr2 --only=housing/` → 差 0(差が出たら 1 回だけ撮り直し)
- [ ] Step 2: 一時検査とスナップショットを削除
- [ ] Step 3: `npm run build` 0・`npm run test:gate` 失敗 0
- [ ] Step 4: 新しい目(別エージェント)で全体レビュー(正しさの指摘だけ採用)
- [ ] Step 5: TODO.md・順番表を更新 → Commit `test: TourNavPage 分割用の一時検査を削除(分割後も全状態一致を確認済み)`
