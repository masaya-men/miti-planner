# Sidebar 分割計画(整頓④の 7 つ目・2026-10-27)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `src/components/Sidebar.tsx`(1849 行・LF・90 日で 7 変更/3 fix)を「フックを順に呼んで部品を並べ、窓を出すだけ」にし、処理と部品を新しいフォルダ `src/components/sidebar/` へ分ける。見た目と動きは 1 つも変えない。

**方針:** 中身の移動だけ(書き換えない)。移した本体は元の識別子のまま動くよう、各フックの先頭で受け取ったオブジェクトを分割代入する(`const { activeTab, setActiveTab, ... } = nav;`)。部品も props を分割代入して元の JSX 行をそのまま使う。書き換えてよいのは ① `export` の付与 ② import(相対パスの付け替え。`import('../types')` 型の書き方は `import('../../types')` へ) ③ フックの引数・分割代入・`return { ... }` ④ 部品の props 型と分割代入・`return (...)` の外枠 ⑤ Sidebar 側の呼び出しと分割代入 だけ。コメントは移動先へそのまま持っていく。

## 測った結果(分割前・行番号は今の Sidebar.tsx)

| 行 | 中身 | 行き先 |
|---|---|---|
| 1-70 | import | 各ファイルへ必要分 |
| 72-84 | SidebarProps | Sidebar に残す |
| 87-503 | ContentTreeItem(props 型・本体・displayName) | `sidebar/ContentTreeItem.tsx` |
| 505-682 | FreePlanSection | `sidebar/FreePlanSection.tsx` |
| 684-775 | ArchivePlanRow | `sidebar/ArchivePlanRow.tsx` |
| 777-787 | Sidebar 冒頭(t・contentLanguage・tutorial・runTransition・lang) | Sidebar に残す |
| 788-849 | selectedContentId・SidebarTab 型・activeTab・窓の開閉 state 3 つ・contextMenu・archivePrompt・チュートリアル effect 3 つ | `sidebar/useSidebarNav.ts`(`SidebarTab` 型は export) |
| 851-858 | usePlanMultiSelect の呼び出し | Sidebar に残す |
| 859-891 | showDeleteConfirm・フローティングバーの ref/flash・タブ別リストの ref 4 つと useSmoothWheelScroll・flash effect | `sidebar/useSidebarSelectionBar.ts` |
| 893-940 | pendingContent/pendingPlanName・user・showLoginModal・plans 等の購読・getSnapshot/loadSnapshot・currentPlanId 追従 effect・自動アーカイブ effect | `sidebar/useSidebarPlanSync.ts` |
| 942-1168 | handleSelectContent・createPlanDirectly・handleConfirmNewPlan・handleCancelNewPlan・handleLoadPlan | `sidebar/useSidebarPlanActions.ts` |
| 1170-1174 | tutorialStep・isTutorialContentSelect・isHovered | Sidebar に残す |
| 1176-1191 | `motion.aside`・本体の `motion.div`・内側 div の開始 | Sidebar に残す |
| 1192-1265 | 上の区切り・タブ・ボタンバー(兄弟 3 つ) | `sidebar/SidebarToolbar.tsx`(`<>…</>` で返す) |
| 1267-1430 | 零式・絶・その他・アーカイブの 4 タブの一覧 | `sidebar/SidebarTabLists.tsx`(`<>…</>` で返す) |
| 1432-1500 | フローティングアクションバー(createPortal) | `sidebar/SidebarFloatingBar.tsx` |
| 1502-1541 | 通知バー・ローカル保存の案内・バックアップ/復元ボタン | `sidebar/SidebarFooterBars.tsx`(`<>…</>` で返す) |
| 1542-1544 | 内側 div・motion.div の閉じ | Sidebar に残す |
| 1545-1614 | 常設ハンドル(`fullWidth ? null : <div>…</div>`) | `sidebar/SidebarHandle.tsx`(その式をそのまま返す) |
| 1615-1772 | NewPlanModal・ShareModal・名前入力ダイアログ・LoginModal・削除確認 | **Sidebar に残す**(下の Global Constraints 参照) |
| 1773 | `</motion.aside>` | Sidebar に残す |
| 1774-1839 | 右クリックメニュー(`contextMenu && (…)`) | `sidebar/SidebarContextMenu.tsx`(条件は Sidebar に残し、中の `<ContextMenu …/>` を部品へ) |
| 1840-1849 | ArchivePromptModal・Backup 2 つ・閉じ | Sidebar に残す |

各 JSX 塊が使う Sidebar の値(機械で数えた候補。最終的な props は tsc で確定):
- Toolbar: activeTab, setActiveTab, multiSelect, toggleMultiSelectMode, setIsNewPlanModalOpen, fullWidth, onAutoPlan
- TabLists: activeTab, lang, multiSelect, setMultiSelect, toggleItemId, plans, currentPlanId, updatePlan, selectedContentId, handleSelectContent, handleLoadPlan, setContextMenu, isTutorialContentSelect, runTransition, savageListRef, ultimateListRef, otherListRef, archiveListRef
- FloatingBar: multiSelect, setMultiSelect, floatingBarRef, floatingBarFlash, bundleModalOpen, handleShareBundle, setShowDeleteConfirm
- FooterBars: multiSelect, isOpen, setBackupExportOpen, setBackupRestoreOpen
- Handle: fullWidth, isOpen, onToggle, tutorialActive, currentStepIndex, isHovered, setIsHovered, setBackupExportOpen
- ContextMenu: contextMenu, setContextMenu, plans, user, setBundleModalOpen, setBundlePlansForModal, onClose
- t は各部品の中で `useTranslation()` を呼ぶ(ContentTreeItem が既にそうしている形)。フックには Sidebar の t を渡す。

## フックの形(これ以外の形にしない)

- `useSidebarNav(tutorialActive)` → `{ selectedContentId, setSelectedContentId, activeTab, setActiveTab, isNewPlanModalOpen, setIsNewPlanModalOpen, backupExportOpen, setBackupExportOpen, backupRestoreOpen, setBackupRestoreOpen, contextMenu, setContextMenu, archivePrompt, setArchivePrompt }`(以下 `nav`)
- `useSidebarSelectionBar(multiSelect)` → `{ showDeleteConfirm, setShowDeleteConfirm, floatingBarRef, floatingBarFlash, savageListRef, ultimateListRef, otherListRef, archiveListRef }`
- `useSidebarPlanSync({ setSelectedContentId, setActiveTab, setArchivePrompt })` → `{ pendingContent, setPendingContent, pendingPlanName, setPendingPlanName, user, showLoginModal, setShowLoginModal, plans, currentPlanId, setCurrentPlanId, updatePlan, getSnapshot, loadSnapshot }`(以下 `sync`)
- `useSidebarPlanActions({ t, runTransition, fullWidth, onClose, nav, sync })` → `{ handleSelectContent, handleConfirmNewPlan, handleCancelNewPlan, handleLoadPlan }`(createPlanDirectly は中に閉じる)

## 順番の約束(effect の実行順を今と同じに保つ)

Sidebar での呼び出し順 = 冒頭(useTranslation・useThemeStore・useTutorialStore・useTransitionOverlay)→ Nav(close-new-plan-modal 購読 → チュートリアル開始で零式 → plan-restored 購読)→ usePlanMultiSelect → SelectionBar(useSmoothWheelScroll ×4 → flash)→ PlanSync(currentPlanId 追従 → 自動アーカイブ)→ PlanActions(effect なし)→ tutorialStep・isHovered。useState/useRef の並びが変わるのは観測できないので可。

## Global Constraints

- 動き・見た目・DOM の並び順・クラス名・data-testid・data-tutorial 属性・文言・コメント・依存配列(eslint-disable 行も含む)を変えない。
- **名前入力ダイアログと削除確認は Sidebar.tsx に残す**。`src/components/ui/__tests__/ModalShell.guard.test.ts` の LEGACY に `'Sidebar.tsx': 'not-window'` があり、ファイルの中に覆い(`fixed inset-0` + `bg-black/`)が残っていることが前提。新しい部品に覆いを入れない(入れると見張りが落ちる)。見張りテスト自体は変更しない。
- `src/styles/__tests__/rawStyleAllowlist.json` は今 `"components/Sidebar.tsx": [0,1,3]`(#直書き 1・text-[Npx] 3)。移した先のファイルごとに数え直し、移った分を新しいキー(`components/sidebar/….tsx`)へ、Sidebar の数を減らす。**合計は [0,1,3] のまま**。`rawStyleRatchet.test.ts` が通ること。
- 外から import されているのは `Sidebar` だけ(`Layout.tsx`・`layout/MobileTopSheets.tsx`)。export 名・ファイルの場所は変えない。
- 循環 import を作らない(sidebar/ の部品・フックは `../Sidebar` を import しない。`src/__tests__/noCircularImports.test.ts` の ALLOWED は 0 件のまま)。
- 新ファイルは LF。各ファイル 1000 行以下(目安: ContentTreeItem 約 420・Sidebar 本体 約 350・他は 250 以下)。
- 1 タスク 1 コミット。push しない。commit は `rtk git commit -m "…"`(stdin の -F - は使わない)。

## Review Focus

1. 新規作成: 既存プランありのコンテンツはクリックで展開のみ / なし→名前入力→Enter で作成(テンプレート読込→commitNewPlan)/ チュートリアル中はダイアログなしで専用名で作成→800ms 後に `content:selected`。
2. 作成の最初に共同編集を切断(`useCollabSessionStore.getState().disconnect()`)が残っている。
3. プラン切替: 今のプランを保存→アーカイブ/圧縮済みなら再圧縮→圧縮解凍(失敗でトースト)→loadSnapshot(data, planId)→タブ追従→lastOpened。
4. 自動アーカイブは localStorage の済みフラグで 1 回だけ。
5. 複数選択: 件数が増えた時だけ枠が光る・共有 10 件上限・削除確認。

---

### Task 1: 分割前の記録(一時検査)

**Files:** Create `src/components/__tests__/Sidebar.markupLock.test.tsx`(一時・Task 4 で削除)

- [ ] **Step 1:** Sidebar を直接描画する一時テストを作る(Sidebar 単体のテストは今は無い。モックの作り方は `src/components/__tests__/Layout.autosave.test.tsx` と `src/components/military/__tests__/MilspecSidebar.test.tsx` を参考にする)。子部品は実物のまま。テンプレート読込(`../data/templateLoader` の getTemplate)は固定データを返すモックにする。外への呼び出し(updatePlan・archivePlans・loadSnapshot・setCurrentPlanId・commitNewPlan・disconnect・completeEvent・showToast・alert・localStorage.setItem・setLastOpened)を 1 本の記録配列に積む。各状態で `document.body.innerHTML`(portal を含めるため body 全体)と記録配列を `toMatchSnapshot`(時刻・UUID は固定)。
  状態: PC で開く/閉じる/fullWidth(スマホ)/ 4 タブそれぞれ(プランあり・なし)/ コンテンツの展開・折りたたみ / プランなしのコンテンツをクリック→名前入力→Enter で作成・Esc で中止 / 既存プランをクリックで切替(圧縮済みの解凍成功・失敗)/ 共有の複数選択→2 件選択(フローティングバー)→キャンセル / 削除の複数選択→削除確認→削除・やめる / プランを右クリック→メニュー表示→項目を 1 つ実行 / チュートリアル中(ステップ main-1-content のハイライト・作成→`content:selected`)/ 過去拡張の零式プランがある→自動アーカイブ→通知の窓 / 未ログイン・ログイン / ハンドルのホバー / 件数上限(全体・コンテンツ別)で alert。
- [ ] **Step 2:** `rtk npx vitest run src/components/__tests__/Sidebar.markupLock` → 通る(スナップショット新規)。同じコマンドをもう 1 回 → 通る(記録が安定していることの確認)。
- [ ] **Step 3: Commit** `test: Sidebar 分割前の画面の中身と外への呼び出しを記録(整頓④)`

### Task 2: 小部品 3 つと処理(フック)を sidebar/ へ移す

**Files:** Create `src/components/sidebar/` の `ContentTreeItem.tsx`・`FreePlanSection.tsx`・`ArchivePlanRow.tsx`・`useSidebarNav.ts`・`useSidebarSelectionBar.ts`・`useSidebarPlanSync.ts`・`useSidebarPlanActions.ts` / Modify `Sidebar.tsx`

- [ ] **Step 1:** 行範囲はスクリプトで切り出す(手で打ち直さない)。各フックは「引数 → 分割代入 → 元の行そのまま → return」。
- [ ] **Step 2:** 行の突き合わせ: 元の 1849 行のうち、空行・import 行・上の「書き換えてよい」行以外が、新ファイル群のどこかに同じ回数現れることをスクリプトで確認(結果を報告)。
- [ ] **Step 3:** markupLock が変更なしで通る / `rtk npx tsc -b` 0 / `rtk npx vitest run src/__tests__/noCircularImports.test.ts src/styles/__tests__/rawStyleRatchet.test.ts src/components/ui/__tests__/ModalShell.guard.test.ts` 通る
- [ ] **Step 4: Commit** `refactor: Sidebar の小部品と処理を sidebar/ へ分ける(整頓④)`

### Task 3: 見た目の塊(JSX)を sidebar/ へ移す

**Files:** Create `src/components/sidebar/` の `SidebarToolbar.tsx`・`SidebarTabLists.tsx`・`SidebarFloatingBar.tsx`・`SidebarFooterBars.tsx`・`SidebarHandle.tsx`・`SidebarContextMenu.tsx` / Modify `Sidebar.tsx`・`src/styles/__tests__/rawStyleAllowlist.json`

- [ ] Step 1: 移す(上の表と props 候補のとおり)→ Step 2: 行の突き合わせ(Task 2 と同じスクリプト)→ Step 3: markupLock(スナップショット無変更)・`rawStyleRatchet`・`ModalShell.guard`・`noCircularImports` が通る → Step 4: `rtk npx tsc -b` 0 → Commit `refactor: Sidebar の見た目の塊を部品へ分ける(整頓④)`

### Task 4: 最終ゲートと後片付け

- [ ] Step 1: `node scripts/visual-regress/run.mjs --compare=dpr2 --only=miti/`、続けて `--only=mobile/` → 差 0(差が出たら 1 回だけ撮り直し。それでも差があれば止めて報告)。**バックグラウンド起動は 1 回だけ・port 5182 の重複起動に注意**(前の実行が残っていたら止めてから)。
- [ ] Step 2: 一時検査とスナップショットを削除 → Commit `test: Sidebar 分割用の一時検査を削除(分割後も全記録一致を確認済み)`
- [ ] Step 3: `rtk npm run build` 0・`npm run test:gate` 失敗 0(件数を報告)
