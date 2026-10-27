# RegisterPage 分割計画(整頓④の 6 つ目・2026-10-27)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `src/components/housing/pages/RegisterPage.tsx`(1967 行・CRLF・90 日で 9 変更/4 fix)を「フックを順に呼んで 3 列を並べるだけ」にし、処理と部品を `src/components/housing/register/page/` へ分ける。見た目と動きは 1 つも変えない。

**方針:** 中身の移動だけ(書き換えない)。移した本体は元の識別子のまま動くよう、各フックの先頭で受け取ったオブジェクトを分割代入する(`const { address, setAddress, ... } = f;`)。書き換えてよいのは ① `export` の付与 ② import ③ フックの引数・分割代入・`return { ... }` ④ ページ側の呼び出しと分割代入 だけ。コメントは移動先へそのまま持っていく。

## 測った結果(分割前・行番号は今の RegisterPage.tsx)

| 行 | 中身 | 行き先 |
|---|---|---|
| 1-64 | import | 各ファイルへ必要分 |
| 66-310 | buildDraftImageFields・STEP_IDS/StepId・STEP_LABEL_KEYS・visibleStepIds・TYPING_STAGGER_MS・ADDRESS_FIELD_NAMES・requiredFieldsForAddress・addressFromListing・buildLocalListingViewModel | `registerPageModel.ts`(すべて export) |
| 312-342 | RegisterPageProps と説明 | ページに残す |
| 344-348 | t/i18n・navigate・user・updateListing | ページに残す |
| 350-407, 501-505, 507-594 | フォームの値すべて(住所・確認ゲート・紹介・公開設定・画像/SNS の state と ref・addressRef 追従 effect・handleVisibilityChange・handleIntroChange) | `useRegisterFields.ts` |
| 409-435 | 登録枠の残数(isAdmin・remaining・registrationCount・取得 effect) | `useRegistrationQuota.ts` |
| 437-499, 596-697 | handleAddressChange・handleConfirmAddress・size 導出 effect・applyExtractedResult・applyExtractedAddress | `useRegisterAddressInput.ts` |
| 699-883 | handleTweetFetched・handleYoutubeFetched・handleOgpFetched・URL 欄の増減 | `useRegisterSnsFetch.ts` |
| 884-979 | effectiveStepIds・scroll-spy・進行度・handleJumpToStep | `useRegisterScrollSpy.ts` |
| 981-1051, 1470-1513 | hasMedia〜steps(入力チェック・ステッパー)・confirmSummary | `useRegisterChecks.ts` |
| 1053-1131 | 重複のライブ照会 | `useRegisterDuplicateCheck.ts` |
| 1133-1259, 1261-1267, 1403-1468 | submit の state・buildDraft・performRegister・performUpdate(1261-1267 は performUpdate の説明なので performUpdate の直前へ)・handleSubmit | `useRegisterSubmit.ts` |
| 1268-1401 | handleEditThumbnailPathsChange・commitEditSnsFetch(編集画面の写真) | `useRegisterEditMedia.ts` |
| 1515-1750 | オートセーブ保存・復元・破棄・handleUrlUserEdit | `useRegisterAutosave.ts` |
| 1752-1764 | 未ログイン表示 | ページに残す |
| 1771-1802 | 左列 `<section data-region="left">` | `RegisterLeftColumn.tsx` |
| 1808-1829 | 復元通知(`restoredNoticeVisible &&` の中身の div) | `RegisterAutosaveNotice.tsx`(条件はページに残す) |
| 1830-1928 | 中央列 | ページに残す |
| 1931-1951 | 右列 `<section data-region="right">` | `RegisterRightColumn.tsx` |
| 1953-1964 | 重複警告ダイアログ | ページに残す |

## フックの形(これ以外の形にしない)

- `useRegisterFields(mode, initialValues)` → 上の表のフォームの値・setter・ref・2 つのハンドラ・`requiredFields`・`fieldState` を全部返す(以下 `f`)。
- `useRegistrationQuota(user)` → `{ isAdmin, remaining, registrationCount }`
- `useRegisterAddressInput(f)` → `{ handleAddressChange, handleConfirmAddress, applyExtractedResult, applyExtractedAddress }`
- `useRegisterSnsFetch(f, applyExtractedResult, applyExtractedAddress, t)` → `{ handleTweetFetched, handleYoutubeFetched, handleOgpFetched, handleAddUrlSlot, handleRemoveUrlSlot }`
- `useRegisterScrollSpy(mode, user)` → `{ effectiveStepIds, scrollContainerRef, sectionRefs, activeStepId, stepperProgress, handleJumpToStep }`
- `useRegisterChecks(f, mode, effectiveStepIds, activeStepId, i18n)` → `{ addressOk, addressCandidate, checklistItems, canSubmit, checkPanelItems, steps, confirmSummary }`
- `useRegisterDuplicateCheck(mode, addressOk, addressCandidate)` → `{ duplicateState, duplicates, privateMatchCount }`
- `useRegisterSubmit({ f, mode, initialValues, onSaved, user, canSubmit, t, navigate, updateListing })` → `{ submitting, submitErrorKey, submitDuplicates, setSubmitDuplicates, buildDraft, performRegister, handleSubmit }`
- `useRegisterEditMedia({ f, initialValues, buildDraft, updateListing })` → `{ handleEditThumbnailPathsChange, commitEditSnsFetch }`
- `useRegisterAutosave({ f, mode, user })` → `{ restoredNoticeVisible, handleDiscardRestore, handleUrlUserEdit }`
- t / i18n / navigate / updateListing はページの 1 回だけの取得を渡す(フック内で useTranslation 等を新たに呼ばない)。

## 順番の約束(effect の実行順を今と同じに保つ)

ページでの呼び出し順 = Fields(addressRef 追従)→ Quota(残数取得)→ AddressInput(size 導出)→ SnsFetch → ScrollSpy(IO・scroll)→ Checks → DuplicateCheck(照会・unmount 破棄)→ Submit → EditMedia → Autosave(保存→復元)。useState/useMemo の並びが変わるのは観測できないので可。`if (!user) return` は全フック呼び出しの後のまま。

## Global Constraints

- 動き・見た目・DOM の並び順・クラス名・data-testid・文言・コメント・依存配列(`doneMap` の未使用 `mode` や eslint-disable も含む)を変えない。
- `RegisterPage.tsx` は `export { buildDraftImageFields } from '../register/page/registerPageModel';` を残す(`buildDraftImageFields.test.ts` が `'../RegisterPage'` から読む)。App.tsx は変更なし。
- 循環 import を作らない(model はページやフックを import しない。`src/__tests__/noCircularImports.test.ts` の ALLOWED は 0 件のまま)。
- 新ファイルは LF で書く(元は CRLF)。各ファイル 1000 行以下(目安: 最大は useRegisterSubmit/useRegisterAutosave で 250〜350 行)。
- 既存テスト `RegisterPage.test.tsx`(63 件)・`buildDraftImageFields.test.ts` は 1 文字も変えずに通す。
- 1 タスク 1 コミット。push しない。

## Review Focus

1. オートセーブ:保存 effect が復元 effect より先に登録されている(初回は保存せず、復元後に保存再開)。
2. 復元起因の SNS 再取得で住所は空欄だけ埋まる(restoreRefetchGuardRef が Fields→AddressInput/SnsFetch/Autosave で同じ ref)。
3. 重複のライブ照会:edit では走らない・500ms・古い応答を捨てる。
4. 送信:重複あり→ダイアログ→「それでも登録」で performRegister(buildDraft())。
5. 編集:保存→onSaved→fetchAndUpsert→loadMine→toast→navigate の順。

---

### Task 1: 分割前の記録(一時検査)

**Files:** Create `src/components/housing/pages/__tests__/RegisterPage.markupLock.test.tsx`(一時・Task 4 で削除)

- [ ] **Step 1:** `RegisterPage.test.tsx` の 1-113 行のモックと renderPage 等の補助をそのまま写す(子部品は実物のまま)。外への呼び出し(canRegister・checkDuplicate・registerListing・uploadListingThumbnail・updateMock・navigateMock・showToast・scrollIntoView・localStorage の setItem/removeItem)を 1 本の記録配列に積む。各状態で `container.innerHTML` と記録配列を `toMatchSnapshot`(時刻依存は fake timers / Date 固定)。
  状態: 未ログイン / create 初期(一般・管理者・残数取得失敗)/ 住所を手入力(家・アパート)→ 500ms 後に重複なし・重複あり(公開・非公開)/ 住所確認 → 画像 1 枚 → 送信(重複なし→登録→遷移)/ 送信で重複→ダイアログ→「それでも登録」・「戻って修正」/ ツイート取得(住所自動入力・スタッガーを進め切る・動画あり・2 本目の重複 URL)/ YouTube 取得・OGP 取得 / URL 欄を増やす・減らす / 下書きを置いてマウント→復元通知→破棄 / 一時ツアーのプリフィル / edit(initialValues あり)初期 → タイトル変更 → 保存(成功・失敗)/ ステッパーのジャンプ。
- [ ] **Step 2:** `npx vitest run src/components/housing/pages/__tests__/RegisterPage.markupLock` → 通る(スナップショット新規)。同じコマンドをもう 1 回 → 通る(記録が安定していることの確認)。
- [ ] **Step 3: Commit** `test: RegisterPage 分割前の画面の中身と外への呼び出しを記録(整頓④)`

### Task 2: 処理(フック)と定数を register/page/ へ移す

**Files:** Create `src/components/housing/register/page/` に `registerPageModel.ts` と上の 10 本のフック / Modify `RegisterPage.tsx`

- [ ] **Step 1:** 行範囲はスクリプトで切り出す(CRLF→LF 正規化・手で打ち直さない)。各フックは「引数 → 分割代入 → 元の行そのまま → return」。
- [ ] **Step 2:** 行の突き合わせ:元の 1967 行のうち、空行・import 行・上の「書き換えてよい」行以外が、新ファイル群のどこかに同じ回数現れることをスクリプトで確認(結果を報告)。
- [ ] **Step 3:** markupLock・`RegisterPage.test.tsx`・`buildDraftImageFields.test.ts` が変更なしで通る / `npx tsc -b` 0 / `npx vitest run src/__tests__/noCircularImports.test.ts` 通る
- [ ] **Step 4: Commit** `refactor(housing): RegisterPage の処理を register/page/ のフックへ分ける(整頓④)`

### Task 3: 部品(JSX)を register/page/ へ移す

**Files:** Create in `src/components/housing/register/page/`:
- `RegisterLeftColumn.tsx` `({ steps, onJump, progress, isAdmin, remaining, registrationCount })`(1771-1802・t は部品内で useTranslation)
- `RegisterAutosaveNotice.tsx` `({ postUrl, onDiscard })`(1809-1828 の div)
- `RegisterRightColumn.tsx` `({ mode, checkPanelItems, duplicateState, duplicates, privateMatchCount, address })`(1931-1951)
- Modify: `RegisterPage.tsx`
- [ ] Step 1: 移す → Step 2: markupLock(スナップショット無変更)・既存テストが通る → Step 3: `npx tsc -b` 0 → Commit `refactor(housing): RegisterPage の左右の列と復元通知を部品へ分ける(整頓④)`

### Task 4: 最終ゲートと後片付け

- [ ] Step 1: `node scripts/visual-regress/run.mjs --compare=dpr2 --only=housing/` → 差 0(差が出たら 1 回だけ撮り直し。それでも差があれば止めて報告)
- [ ] Step 2: 一時検査とスナップショットを削除 → Commit `test: RegisterPage 分割用の一時検査を削除(分割後も全記録一致を確認済み)`
- [ ] Step 3: `npm run build` 0・`npm run test:gate` 失敗 0(件数を報告)
