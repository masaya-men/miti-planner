# SpreadsheetGridImportModal 分割計画(整頓⑤の 1 つ目・2026-10-27)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `src/components/SpreadsheetGridImportModal.tsx`(1250 行・**CRLF**)を「フックを順に呼んで部品を並べるだけ」にし、処理と部品を新しいフォルダ `src/components/gridImport/` へ分ける。見た目と動きは 1 つも変えない。

**方針:** 中身の移動だけ(書き換えない)。移した本体は元の識別子のまま動くよう、各フックの先頭で受け取ったオブジェクトを分割代入する(`const { jobs, mitigations, ... } = args;`)。部品も props を分割代入して元の JSX 行をそのまま使う。書き換えてよいのは ① `export` の付与 ② import(相対パスの付け替え) ③ フックの引数・分割代入・`return { ... }` ④ 部品の props 型と分割代入・`return (...)` の外枠 ⑤ 本体側の呼び出しと分割代入 ⑥ 本体からの再 export 1 行 だけ。コメントは移動先へそのまま持っていく。

## 測った結果(分割前・行番号は今のファイル)

| 行 | 中身 | 行き先 |
|---|---|---|
| 1-33 | import | 各ファイルへ必要分 |
| 35-40 | Props | 本体に残す |
| 42-142 | ImportSource・WizardStep 型・BASE_FIELDS・ASSIGNABLE_FIELDS・Lang4・emptyHeaderTable・setColumnValues・autoAssignSingleSlots・sortResultPartyBySlots | `gridImport/gridImportModel.ts`(型・定数・関数すべて export) |
| 144-157 | 本体冒頭(useTranslation・lang・gridLang・jobs・mitigations) | 本体に残す |
| 158-159 | step | 本体に残す |
| 161-204 | 取り込み先コンテンツ選択 4 つ・defaultSelRef・初期選択 effect・selectedContentId・テンプレ読込 effect・targetOverrides・targetKey・toOverridesById | `gridImport/useGridImportSelection.ts` |
| 206-381 | 貼り付けの state 群・entries・assignment・pasteSurfaceRef・resetAll・開いた時のリセット effect・ingestText・handleGridPaste・pasteError・handlePasteFromClipboard・**isMobile(useIsMobile の呼び出し位置ごと)**・handleMobilePasteChange・フェーズ名ミラー effect・step2 フォーカス effect・onColumnPaste・commitPendingDraft・goToParty | `gridImport/useGridImportPaste.ts` |
| 383-430 | roleOf・setMobileColumnSlot・mobileMemberColumns・detectedJobIds・detectedByRole・割当再シード effect・handleSlotChange | `gridImport/useGridImportParty.ts` |
| 432-568 | isGrid・partyOverride・matrixPreview・gridPreview・preview・displayedPreviewEvents・mobileEventCount・perPhaseMits・skipped・partyComplete・hasPendingMatrixDraft・hasPreviewEvents・blockReason・canConfirm・handleConfirm・hasUnassignedMemberCols・hasNoTimeCol・isGridEmpty・showCreateBlock・blockMsg | `gridImport/useGridImportPreview.ts` |
| 570-606 | `if (!isOpen) return null;`・ModalShell・ModalHeader・Step1・Step2 の外枠 div 開始 | 本体に残す |
| 607-650 | フェーズ・バー(`(source === 'matrix' \|\| entries.length > 0) && (…)`) | `gridImport/GridImportPhaseBar.tsx`(条件は本体に残し、中の `<div>…</div>` を部品へ) |
| 652-673 | flow 行・parseFailed 表示 | 本体に残す |
| 675-760 | スマホの貼り付け面(`isMobile ? (` の真側の `<div>…</div>`) | `gridImport/GridImportMobilePaste.tsx` |
| 761-796 | PC の貼り付け面(偽側の `<div ref={pasteSurfaceRef}>…</div>`) | `gridImport/GridImportPcSurface.tsx`(ref は props `pasteSurfaceRef` で受け取りそのまま `ref={pasteSurfaceRef}`。forwardRef にしない) |
| 797-810 | Step2 閉じ・Step3 | 本体に残す |
| 812-881 | フッター(`<div className="px-5 py-3 border-t …">…</div>`) | `gridImport/GridImportFooter.tsx` |
| 882-884 | ModalShell 閉じ | 本体に残す |
| 886-1182 + 1241-1250 | GridView + StatusChip(StatusChip は GridView からしか使われない) | `gridImport/GridView.tsx`(GridView を export・StatusChip は同じファイル内で非 export) |
| 1184-1239 | PartyAssignmentStep | `gridImport/PartyAssignmentStep.tsx` |

各 JSX 塊が使う値(最終的な props は tsc で確定):
- PhaseBar: source, phaseName, setPhaseName, commitPendingDraft, entries, perPhaseMits
- MobilePaste: mobileCopyHintOpen, setMobileCopyHintOpen, pasteBuffer, handleMobilePasteChange, source, mobileEventCount, mobileMemberColumns, jobs, gridLang, setMobileColumnSlot, blockMsg, skipped
- PcSurface: pasteSurfaceRef, handleGridPaste, table, setTable, mitigations, jobs, source, byColumnMode, onColumnPaste, displayedPreviewEvents, templateEvents, targetOverrides, setTargetOverrides, gridLang, isGridEmpty, handlePasteFromClipboard, pasteError
- Footer: step, setStep, onClose, entries, source, resetAll, isGrid, goToParty, isMobile, blockMsg, preview, skipped, handleConfirm, canConfirm, showCreateBlock
- `t` は各部品の中で `useTranslation()` を呼ぶ(GridView が既にそうしている形)。フックには本体の `t` を渡す。

## フックの形(これ以外の形にしない)

- `useGridImportSelection({ isOpen, defaultSelection })` → `{ selLevel, setSelLevel, selCategory, setSelCategory, selBoss, setSelBoss, selTitle, setSelTitle, selectedContentId, templateEvents, targetOverrides, setTargetOverrides, toOverridesById }`(以下 `sel`)
- `useGridImportPaste({ t, isOpen, step, setStep, jobs, mitigations, gridLang, setTargetOverrides })` → `{ table, setTable, source, matrixParsed, parseFailed, byColumnMode, setByColumnMode, phaseName, setPhaseName, pasteBuffer, mobileCopyHintOpen, setMobileCopyHintOpen, entries, assignment, setAssignment, pasteSurfaceRef, resetAll, handleGridPaste, pasteError, handlePasteFromClipboard, isMobile, handleMobilePasteChange, onColumnPaste, commitPendingDraft, goToParty }`(以下 `paste`)
- `useGridImportParty({ jobs, source, table, setTable, entries, matrixParsed, setAssignment })` → `{ setMobileColumnSlot, mobileMemberColumns, detectedByRole }`(roleOf・detectedJobIds は中に閉じる)
- `useGridImportPreview({ t, step, jobs, mitigations, source, table, entries, matrixParsed, phaseName, assignment, detectedByRole, onImport, onClose, selectedContentId, templateEvents, toOverridesById })` → `{ isGrid, preview, displayedPreviewEvents, mobileEventCount, perPhaseMits, skipped, canConfirm, handleConfirm, isGridEmpty, showCreateBlock, blockMsg }`
- 本体の Props 型(`onImport` の型)は `useGridImportPreview` 側で `Props['onImport']` を使わず、同じ型を引数の型に書く(本体を import しない=循環 import を作らない)。

## 順番の約束(effect の実行順を今と同じに保つ)

本体での呼び出し順 = useTranslation → gridLang 等 → jobs/mitigations の useMemo → step の useState → **Selection**(初期選択 effect → テンプレ読込 effect)→ **Paste**(開いた時のリセット effect → useIsMobile → フェーズ名ミラー effect → step2 フォーカス effect)→ **Party**(割当再シード effect)→ **Preview**(effect なし)。useState/useRef の並びが変わるのは観測できないので可。

## Global Constraints

- 動き・見た目・DOM の並び順・クラス名・aria 属性・文言・コメント・依存配列(`eslint-disable-next-line` 行も含む)を変えない。
- **外への export を保つ**: `TimelineDialogs.tsx` が `SpreadsheetGridImportModal` を、`__tests__/SpreadsheetGridImportModal.test.tsx` が `autoAssignSingleSlots` `setColumnValues` `sortResultPartyBySlots` を `../SpreadsheetGridImportModal` から import している。本体に `export { setColumnValues, autoAssignSingleSlots, sortResultPartyBySlots } from './gridImport/gridImportModel';` を置く。既存テストファイルは変更しない。
- `src/__tests__/noNativeTitleAttr.test.ts` の ALLOWED は今 `'components/SpreadsheetGridImportModal.tsx': 2`(640 行のチップ・1005 行の select)。移動後は `'components/gridImport/GridImportPhaseBar.tsx': 1` と `'components/gridImport/GridView.tsx': 1` に振り分け、本体のキーを消す(アルファベット順の位置に入れる)。**合計 2 のまま**。
- `rawStyleAllowlist.json`・`ModalShell.guard` は今このファイルを載せていない(数 0・覆いなし)。新ファイルも 0 のままのはず=変更しない(落ちたら止めて報告)。
- 循環 import を作らない(gridImport/ の部品・フックは `../SpreadsheetGridImportModal` を import しない。`src/__tests__/noCircularImports.test.ts` の ALLOWED は 0 件のまま)。
- 本体ファイルは CRLF のまま(改行コードを変えない)。新ファイルは LF。各ファイル 400 行以下(目安: GridView 約 310・本体 約 230・他は 160 以下)。
- 1 タスク 1 コミット。push しない。commit は `rtk git commit -m "…"`(stdin の -F - は使わない)。
- **触ってはいけないファイル**: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`・`src/components/timeline/TimelineDialogs.tsx`・`src/lib/sheetImport/**`・ロケール JSON・見張りテスト本体(ALLOWED の数の振り分け以外)。

## Review Focus

1. 開くたびに step1 へ戻り全データ初期化(targetOverrides も)・初期選択は開いた時だけ。
2. 貼り付け: 空→見出しだけ / 行列形式→読み取り表示(解釈不能で汎用エラー)/ 見出し形式→編集可+単独ロールの枠自動割当。フェーズ名を打つと行列形式の「フェーズ」列が即時に変わる。
3. step2→3 で未追加の行列貼り付けを自動で積む。作成時も未追加分を自動で取り込む。
4. 作成: 手動 > 自作列 > テンプレ > なし の順で対象を確定 → onImport → 成功で閉じる。
5. ブロック文言の優先順(時間列なし → 枠未割当 / パーティ未完成 → フェーズなし)。

---

### Task 1: 分割前の記録(一時検査)

**Files:** Create `src/components/__tests__/SpreadsheetGridImportModal.markupLock.test.tsx`(一時・Task 4 で削除)

- [ ] **Step 1:** 既存の `src/components/__tests__/SpreadsheetGridImportModal.test.tsx` のモック(useSkillsData・templateLoader・useIsMobile・i18n)と貼り付けデータの作り方をそのまま流用し、本体を描画する一時テストを作る。`onImport` `onClose` の呼び出し(引数ごと)を 1 本の記録配列に積む。各状態で `document.body.innerHTML` と記録配列を `toMatchSnapshot`。
  状態: 閉じている / 開く(step1・既定選択あり・なし)/ step2 空(PC・スマホ)/ 見出し形式を貼る(PC=GridView・スマホ=textarea)→ 枠未割当の警告 → 枠を割当 → 作成 / 列ごと貼り付けモード ON→列に貼る / unknown 列→「この列は？」→ メンバー→ジョブ選択 / 対象列の select を変更(手動 override)→作成 / 時間列なしの警告 / 行列形式を貼る→フェーズ名入力→「このフェーズを追加」→もう 1 枚貼る→次へ(step3)→枠を入れ替え→作成 / 行列形式の解釈不能(parseFailed)/ クリアボタン / 戻るボタン / クリップボードから貼る(成功・失敗)/ onImport が false(閉じない)。
- [ ] **Step 2:** `rtk npx vitest run src/components/__tests__/SpreadsheetGridImportModal.markupLock` → 通る(スナップショット新規)。同じコマンドをもう 1 回 → 通る(記録が安定していることの確認)。
- [ ] **Step 3: Commit** `test: SpreadsheetGridImportModal 分割前の画面の中身と外への呼び出しを記録(整頓⑤)`

### Task 2: 型・関数・小部品と処理(フック)を gridImport/ へ移す

**Files:** Create `src/components/gridImport/` の `gridImportModel.ts`・`GridView.tsx`・`PartyAssignmentStep.tsx`・`useGridImportSelection.ts`・`useGridImportPaste.ts`・`useGridImportParty.ts`・`useGridImportPreview.ts` / Modify `SpreadsheetGridImportModal.tsx`・`src/__tests__/noNativeTitleAttr.test.ts`(GridView 分の 1 を振り分け。本体は残り 1)

- [ ] **Step 1:** 行範囲はスクリプトで切り出す(手で打ち直さない)。各フックは「引数 → 分割代入 → 元の行そのまま → return」。
- [ ] **Step 2:** 行の突き合わせ: 元の 1250 行(`\r` を除いて比較)のうち、空行・import 行・上の「書き換えてよい」行以外が、新ファイル群のどこかに同じ回数現れることをスクリプトで確認(結果を報告)。
- [ ] **Step 3:** markupLock が変更なしで通る / 既存 `SpreadsheetGridImportModal.test.tsx` が通る / `rtk npx tsc -b` 0 / `rtk npx vitest run src/__tests__/noCircularImports.test.ts src/__tests__/noNativeTitleAttr.test.ts src/styles/__tests__/rawStyleRatchet.test.ts src/components/ui/__tests__/ModalShell.guard.test.ts` 通る
- [ ] **Step 4: Commit** `refactor: SpreadsheetGridImportModal の型・小部品・処理を gridImport/ へ分ける(整頓⑤)`

### Task 3: 見た目の塊(JSX)を gridImport/ へ移す

**Files:** Create `src/components/gridImport/` の `GridImportPhaseBar.tsx`・`GridImportMobilePaste.tsx`・`GridImportPcSurface.tsx`・`GridImportFooter.tsx` / Modify `SpreadsheetGridImportModal.tsx`・`src/__tests__/noNativeTitleAttr.test.ts`(本体の残り 1 を PhaseBar へ・本体キーを削除)

- [ ] Step 1: 移す(上の表と props 候補のとおり)→ Step 2: 行の突き合わせ(Task 2 と同じスクリプト)→ Step 3: markupLock(スナップショット無変更)・既存テスト・4 つの見張りが通る → Step 4: `rtk npx tsc -b` 0 → Commit `refactor: SpreadsheetGridImportModal の見た目の塊を部品へ分ける(整頓⑤)`

### Task 4: 最終ゲートと後片付け

- [ ] Step 1: `node scripts/visual-regress/run.mjs --compare=dpr2 --only=miti/win-grid-import`(`catalog/miti.mjs:87` の 1 件=step1 の画面)→ 差 0(差が出たら 1 回だけ撮り直し。それでも差があれば止めて報告)。**バックグラウンド起動は 1 回だけ・port 5182 の重複起動に注意**(前の実行が残っていたら止めてから)。step2/3 は撮っていないので markupLock が前後比較の本体。
- [ ] Step 2: 一時検査とスナップショットを削除 → Commit `test: SpreadsheetGridImportModal 分割用の一時検査を削除(分割後も全記録一致を確認済み)`
- [ ] Step 3: `rtk npm run build` 0・`npm run test:gate` 失敗 0(件数を報告)
