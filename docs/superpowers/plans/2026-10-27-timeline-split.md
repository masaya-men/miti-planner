# Timeline.tsx 切り分け(整頓⑤)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/components/Timeline.tsx`(5037 行)を、見た目・動作・性能を一切変えずに `src/components/timeline/` 配下のフックと子コンポーネントへ分割する。

**Architecture:** 手法は 2 つだけ=(a) 状態+effect+ハンドラの塊をカスタムフックへ移す、(b) return 内の JSX 部分木を props 受けの子コンポーネントへ移す。共有 ref は Timeline 本体で作って引数で渡す。1 塊 = 1 タスク = 1 コミット。各タスクは tsc+対象テスト、区切り(Checkpoint)ごとに全画面の見た目比較と表の位置・動作の比較を回す。

**Tech Stack:** React 19 / TypeScript / Zustand / Vitest / Playwright(検査スクリプト)

**Spec:** `docs/superpowers/specs/2026-10-27-timeline-split-design.md`(必読。特に §3 制約・§4.1 順序の規則・§4.2 見張りテスト)

## Global Constraints

- 作業場所: `C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\milspec-polish`(ブランチ milspec-polish・push しない)。
- **見た目・アニメーション・機能・性能を変えない**。バグを見つけても直さず、台帳 `.superpowers/sdd/2026-10-27-timeline-split/progress.md` に記録だけする。
- **DOM 構造・クラス名・`data-*` 属性・id・要素の順序を変えない**。子コンポーネントは Fragment か元と同じ要素を返す(ラッパー要素を足さない)。
- **useMemo / useCallback / React.memo を足さない・消さない**。依存配列の中身も変えない(引数名が変わる場合の機械的な置換のみ)。
- **effect の相対順(useLayoutEffect 同士・useEffect 同士)と、描画中の ref 書き込み・DOM 読み取りの相対順を保つ**(spec §4.1)。保てないならフックを複数に割る。
- フックの戻り値は、元の変数名と同じ名前のプロパティを持つオブジェクトにし、呼び出し側で**即座に分割代入**する(`const { damageMap, rowSwapMarkers } = useTimelineDamage(...)`)。戻り値オブジェクトを丸ごと子へ渡さない。
- render 時に `window.innerWidth` を読む値(isMobileTimeline / isMobileView)は state 化しない。
- 公開 API(default `Timeline`・`resolveContentId`・`isJoinerReadonly`)は Timeline.tsx から export し続ける。
- 見張りテスト: `rawStyleAllowlist.json` は件数を移した先へ付け替えるのは可・**全ファイル合計を増やさない**。`ModalShell.guard.test.ts` の LEGACY に、`fixed inset-0` と `bg-black/` を含む移動先を `'not-window'` で登録してよい(Timeline.tsx と同じ扱い)。見張りの上限を上げる・テストを緩めるのは不可。
- 新ファイルの置き場所は `src/components/timeline/`。フック名は `useTimeline*`、コンポーネント名は `Timeline*`(下の各タスクで確定)。コメントは周辺と同じ密度の日本語。
- 行番号は 25bede5f 時点の目安。タスクを進めるとずれるので、**シンボル名で探す**。
- 同じタスクで 2 回検査に失敗したら止めて親に報告(手戻りの連鎖を防ぐ)。

### 検査コマンド(各タスク共通。以下「V1」「V2」と呼ぶ)

**V1(各タスクの最後)**
```bash
npx tsc -b 2>&1 | tail -5          # 期待: 何も出ない(exit 0)
npx vitest run src/components/__tests__/Timeline src/components/__tests__/TimelineRow src/components/__tests__/MitigationItem src/components/__tests__/PartyToggleStrip src/components/__tests__/MobileTimelineRow src/components/timeline src/styles/__tests__/rawStyleRatchet src/styles/__tests__/appTokenDefined src/components/ui/__tests__/ModalShell.guard src/__tests__/modalBackdropClose src/__tests__/noNativeTitleAttr 2>&1 | tail -8
# 期待: 全件 pass・失敗 0
```
ハングしたら 3 分で止めて単体ファイルずつ回す(memory: vitest のハング)。

**V2(Checkpoint)** dev サーバー `npm run dev`(5173)を起動した状態で:
```bash
node scripts/visual-regress/run.mjs --compare=dpr2                 # 期待: 323 件すべて一致(exit 0)。約 11 分
node scripts/sticky-scroll/regress.mjs --out=split-cpN --compare=split-base   # 期待: exit 0(差 0)。--allow は使わない
node scripts/sticky-scroll/shots.mjs --out=split-cpN --compare=split-base     # 期待: exit 0
node scripts/sticky-scroll/frame-sync.mjs --mode=all               # 期待: ずれたコマ数・最大ずれが Task 0 の記録と同じ
```
visual-regress は自前で 5181/5182 を起動する。差が出たら直前の Checkpoint 以降のコミットを 1 つずつ戻して犯人を特定 → 原因を直す(差を許容しない)。

**V3(性能 A/B・Checkpoint C/D と最後)** spec §5・列固定台帳 Ruling P14 の方式:
1. `git worktree add <scratch>/split-ab-base split-base-tag` → そこで `npm ci && npm run build && npx vite preview --port 4185 --strictPort`。
2. 作業ツリーで `npm run build && npx vite preview --port 4186 --strictPort`。
3. 次を 2 往復(base→head→head→base の順)。条件=`--theme=standard` と `--theme=military`(縦・既定):
   `SP2_BASE_URL=http://localhost:4185 node scripts/milspec-polish/scroll-perf.mjs --theme=<t> --save=ab-<t>-base-<n> --out-dir=<scratch>/perf`
   `SP2_BASE_URL=http://localhost:4186 node scripts/milspec-polish/scroll-perf.mjs --theme=<t> --compare=ab-<t>-base-<n> --out-dir=<scratch>/perf`
4. 合格=各テーマで 2 往復とも exit 0(p95・ブロック時間とも 10% 以内)。1 往復だけ落ちたら 3 往復目で決める。結果の数値を台帳に記録。

## Review Focus

- プラン切替・初回表示のとき、スクロール位置の合わせ直し(初回 1 回スキップ)が元と同じ回数・同じ順で走ること → Task 12 のテスト+V2 regress の `probe.rows.afterPlanSwitch`。
- 閲覧専用(共同編集の閲覧者・readOnly)で、どの操作も編集にならないこと(readOnlyRef を全ハンドラが読み続ける)→ Task 10 のテスト。
- スマホ幅とPC幅の境目(767/768px 付近)で、表示の切り替わり方が変わらないこと → V2 visual-regress の mobile 群+Task 5 の確認。
- 横・縦にスクロールした状態でのメモ作成位置・相手のカーソル送信値が変わらないこと → V2 regress の `probe.memo` / `probe.cursor`。
- 行と軽減アイコンの再描画回数が増えないこと → TimelineRow.renderCount と Task 1 で足す MitigationItem の見張り。

---

### Task 0: 基準づくりと台帳

**Files:**
- Create: `.superpowers/sdd/2026-10-27-timeline-split/progress.md`

- [ ] **Step 1:** `git tag split-base HEAD`(ローカルのみ・push しない)。台帳に BASE の SHA を書く。
- [ ] **Step 2:** `node scripts/visual-regress/run.mjs --compare=dpr2` → 323 件一致を確認(一致しなければ止めて親に報告)。
- [ ] **Step 3:** `npm run dev` を起動し、`node scripts/sticky-scroll/regress.mjs --out=split-base` と `node scripts/sticky-scroll/shots.mjs --out=split-base` を取る(exit 0 または 2 の項目があれば台帳に記録)。
- [ ] **Step 4:** `node scripts/sticky-scroll/frame-sync.mjs --mode=all` の結果(コマ数・ずれたコマ数・最大ずれ px を 3 方式分)を台帳に記録。
- [ ] **Step 5:** V1 を回して全件 pass を確認・件数を台帳に記録。台帳はコミットしない(`.superpowers/` は既存の扱いに合わせる。gitignore されていれば対象外)。

### Task 1: MitigationItem を別ファイルへ(+再描画の見張り)

**Files:**
- Create: `src/components/timeline/MitigationItem.tsx`(`MitigationItemProps`・`getMitigationColorClasses`・`MitigationItem` を移す)
- Modify: `src/components/Timeline.tsx`(135-700 付近を削除し import)
- Create: `src/components/__tests__/MitigationItem.renderCount.test.tsx`
- Modify: `src/styles/__tests__/rawStyleAllowlist.json`(必要なら件数の付け替え)

**Interfaces:**
- Produces: `export const MitigationItem`(React.memo・displayName 維持)/ `export function getMitigationColorClasses(jobId: string | undefined, ownerId: string, partySortOrder?: string)` / `export interface MitigationItemProps`。行ループ(Task 15)は `getMitigationColorClasses` をここから import。

- [ ] **Step 1: 見張りテストを先に書く(移動前の Timeline.tsx に対して)** — `TimelineRow.renderCount.test.tsx` と同じ方式(描画回数を数える仕組みをそのまま流用)で、`it('軽減を 1 つ置いても、他の MitigationItem は再描画されない')` と `it('関係ない state(ホバー)が変わっても MitigationItem は再描画されない')`。期待値=現状の実測回数を固定(`expect(count).toBe(<実測>)`)。数え方が `TimelineRow.renderCount.test.tsx` の方式で実現できない場合は、その理由を台帳に書いてこの Step を飛ばす(無理に Timeline 側へ計測コードを足さない)。
- [ ] **Step 2:** テストが現状のコードで pass することを確認(見張りなので最初から緑)。
- [ ] **Step 3:** 3 つのシンボルを新ファイルへ移し、Timeline.tsx から import。中身は 1 文字も変えない(import 文の追加のみ)。
- [ ] **Step 4:** V1 → pass。rawStyleRatchet が落ちたら allowlist の件数を新ファイルへ付け替え(合計不変)。
- [ ] **Step 5:** commit `refactor(timeline): 軽減アイコンの部品を別ファイルへ移す(整頓⑤)`

### Task 2: ダメージ計算 → `useTimelineDamage`

**Files:** Create `src/components/timeline/useTimelineDamage.ts` / Modify `Timeline.tsx`

**Interfaces:**
- Produces: `useTimelineDamage(args)` が返す `{ maxTime, conflictingIds, mobileConflictingIds, damageMap, rowSwapMarkers, rowLabels, …(生存・シールド系の元の変数名すべて) }`。引数は移した計算が読む値そのもの(元の変数名のまま渡す)。
- `prevDamageMapRef` などの「前回値 ref」はフック内に移す(参照同一性の仕組みごと移す)。

- [ ] **Step 1:** 移す範囲を列挙して台帳に書く: `maxTime`・`conflictingIds`・`mobileConflictingIds`・`damageMapResult`・`prevDamageMapRef`/`damageMap`(reuseEqualDamages)・`rowSwapMarkers`(reuseEqualArray)・`rowLabels`・生存/シールド系。effect を含むなら元の行と、前後にある他の effect を書く。
- [ ] **Step 2:** フックへ移動。呼び出し位置は、移した最初の宣言があった位置(依存する値の宣言より後)。
- [ ] **Step 3:** V1 → pass(特に TimelineRow.renderCount・Timeline.shieldAbsorption)。
- [ ] **Step 4:** commit `refactor(timeline): ダメージ計算をフックへ移す(整頓⑤)`

### Task 3: ピクチャーインピクチャー → `useTimelinePip` + `TimelinePipLayer`

**Files:** Create `src/components/timeline/useTimelinePip.ts`・`src/components/timeline/TimelinePipLayer.tsx` / Modify `Timeline.tsx`

**Interfaces:**
- Produces: `useTimelinePip()` → `{ pipWindow, pipContainer, pipMenuOpen(元の名前), handleOpenPip, handleClosePip, openPipMenu, scheduleClosePipMenu, cancelClosePipMenu, … }`。`TimelinePipLayer` は return 末尾の PiP メニュー+PiP 本体(createPortal 部分)を描く。

- [ ] **Step 1:** 状態(796-804 付近)とハンドラ(1230-1308 付近)を列挙 → フックへ。
- [ ] **Step 2:** JSX 末尾の PiP メニュー・PiP 本体を `TimelinePipLayer` へ(props=使う値をそのまま)。
- [ ] **Step 3:** V1 → pass。
- [ ] **Step 4:** commit `refactor(timeline): ピクチャーインピクチャーを切り出す(整頓⑤)`

### Task 4: プレビュー強調 → `useTimelinePreviewHighlight`

**Files:** Create `src/components/timeline/useTimelinePreviewHighlight.ts` / Modify `Timeline.tsx`

**Interfaces:**
- Consumes: `rowLayoutRef`(本体で作成)。
- Produces: `{ previewEndTimeRef, overlayRef, updatePreviewHighlight, throttledUpdatePreview }`(`overlayRef` は JSX の TL 選択強調要素へ付けたまま)。

- [ ] **Step 1:** 825-827・862-935 付近を移す。`rowLayoutRef` は引数で受ける。
- [ ] **Step 2:** V1 → pass。commit `refactor(timeline): プレビュー強調をフックへ移す(整頓⑤)`

### Task 5: スマホのフェーズ表示・エフェクト棒 → `useTimelineMobileScrollChrome`

**Files:** Create `src/components/timeline/useTimelineMobileScrollChrome.ts` / Modify `Timeline.tsx`

**Interfaces:**
- Consumes: `scrollContainerRef`・`rowLayoutRef`(本体で作成)。
- Produces: `{ syncMobilePhaseLabel, scheduleMobileEffectBarHide, syncMobileEffectBarVisibility, (touch ハンドラ群), (JSX が参照する mobileEffectBar*Ref・現在フェーズ表示用の ref/state) }`。**`syncMobilePhaseLabel` は rowLayout 変化時の effect(1945 付近・本体に残る)から呼ばれる**ので必ず返す。

- [ ] **Step 1:** 1648-1870 付近を列挙。effect(1699/1834/1853/1866 付近)の前後にある本体側 effect との相対順を台帳に書く。順序が崩れる場合はフックを 2 つに割る。
- [ ] **Step 2:** 移動 → V1 → pass。
- [ ] **Step 3:** commit `refactor(timeline): スマホのスクロール時の表示をフックへ移す(整頓⑤)`

### Task 6: スプシ表示の状態 → `useTimelineSheetView`

**Files:** Create `src/components/timeline/useTimelineSheetView.ts` / Modify `Timeline.tsx`

**Interfaces:**
- Consumes: `sortedPartyMembers`・`memberLayout`・`sheetContainerRef`(引数)。
- Produces: `{ sheetToast, sheetPopover, (setter), sheetColumnMapRef, sheetTRef, sheetDefsRef, handleSheetCellTap, sheetHidden*, sheetCols, handleSheetPointerMove }`。

- [ ] **Step 1:** 752-765・2190-2258・2833-2857・2939-2948 付近を列挙。**`sheetColumnMapRef` の描画中書き込み(2855 付近)と `sheetTRef`/`sheetDefsRef` の書き込み(2191-93 付近)**は、`memberLayout` が決まった後・読む側より前。飛び地のため、`memberLayout` より前に要る部分と後に要る部分で 2 フック(`useTimelineSheetViewState` / `useTimelineSheetColumns`)に割ってよい。
- [ ] **Step 2:** 移動 → V1 → pass(Timeline.sheet・TimelineRow.sheet)。
- [ ] **Step 3:** commit `refactor(timeline): スプシ表示の状態をフックへ移す(整頓⑤)`

### Task 7: メモ・共同編集カーソル → `useTimelineMemoCursor`

**Files:** Create `src/components/timeline/useTimelineMemoCursor.ts` / Modify `Timeline.tsx`

**Interfaces:**
- Consumes: `sheetContainerRef`・`timeToYMapRef`・`memberXMapRef`・`scrollContainerRef`・`sheetWidth`(引数)。
- Produces: `{ memoInput, setMemoInput, reflectMemosToPlan, handleSheetClick, handleMemo*(元の名前すべて) }`。カーソル送信 effect(1491 付近)はフック内。

- [ ] **Step 1:** 829-836・1111-1228・1484-1527 付近を移す。effect の相対順を台帳に書いて確認。
- [ ] **Step 2:** V1 → pass。commit `refactor(timeline): メモと共同編集カーソルをフックへ移す(整頓⑤)`

### Checkpoint A

- [ ] V2 を回して全部合格。台帳に結果。

### Task 8: キーボード・ウィンドウイベント → `useTimelineKeyboard` ほか

**Files:** Create `src/components/timeline/useTimelineKeyboard.ts`(元に戻す/やり直し・各 Esc・AA の Esc)・`src/components/timeline/useTimelineWindowEvents.ts`(自動配置/取り込みのイベント・チュートリアル・進捗ジャンプ・clearMenu の外側クリック) / Modify `Timeline.tsx`

**Interfaces:**
- Consumes: 元の effect が読む setter・ref をそのまま引数で受ける(D の setter を多数受けるのは可)。
- Produces: なし(effect のみ)。値を返す必要がある場合は元の名前で返す。

- [ ] **Step 1:** 1096-1110・1322-1398・1871-1880・2386-2390・2691-2812 付近の effect を列挙し、**本体に残る他の effect との相対順**を台帳に書く。キーボード系とウィンドウ系で順序が交互になる場合は、元の順に並ぶよう複数回に分けて呼ぶ(例: `useTimelineWindowEvents` を前半/後半に割る)。
- [ ] **Step 2:** 移動 → V1 → pass。commit `refactor(timeline): キー操作と画面全体のイベントをフックへ移す(整頓⑤)`

### Task 9: オート配置・AA・取り込み → `useTimelineAutoPlan`

**Files:** Create `src/components/timeline/useTimelineAutoPlan.ts` / Modify `Timeline.tsx`

**Interfaces:**
- Produces: `{ handleAutoPlan, sheetImportDefault, handleSheetImport, isMitiSheetOpen, isAaModeEnabled, aaSettingsOpen, (setter) }`。

- [ ] **Step 1:** 1065-1095・1429-1455 付近を移す → V1 → pass。
- [ ] **Step 2:** commit `refactor(timeline): オート配置と取り込みをフックへ移す(整頓⑤)`

### Task 10: モーダル開閉+編集ハンドラ → `useTimelineEditing`

**Files:** Create `src/components/timeline/useTimelineEditing.ts`(必要なら `useTimelineDialogs.ts` と 2 つに) / Modify `Timeline.tsx` / Test: `src/components/__tests__/Timeline.readonlyEdit.test.tsx`

**Interfaces:**
- Consumes: `readOnlyRef`・ストアの操作関数・`timeToYMapRef` 等(引数)。
- Produces: モーダル/ポップオーバーの state と setter(806-1000 付近の元の名前すべて)+ハンドラ(1950-2457 付近の元の名前すべて。`stable*` は useStableCallback のまま)。

- [ ] **Step 1: 閲覧専用の見張りテストを先に書く** — `Timeline.sheet.test.tsx` の描画の仕方を流用し、閲覧専用(`isJoinerReadonly` が true になる条件)で Timeline を描画。`it('閲覧専用では行のセルを押しても軽減選択が開かない')`・`it('閲覧専用では右クリックで軽減が消えない')`。期待=ストアの操作関数が呼ばれない・選択 UI が出ない。現状のコードで pass することを確認。
- [ ] **Step 2:** 移す state・ハンドラ・effect を列挙して台帳に書く(量が多いので、移動前に一覧を作ってから)。
- [ ] **Step 3:** 移動(1 コミットで大きすぎる場合は state → ハンドラの 2 コミットに分けてよい)。
- [ ] **Step 4:** V1 → pass。
- [ ] **Step 5:** commit `refactor(timeline): 窓の開閉と編集の操作をフックへ移す(整頓⑤)`

### Checkpoint B

- [ ] V2 を回して全部合格。台帳に結果。

### Task 11: 列・レイアウト計算 → `useTimelineLayout`

**Files:** Create `src/components/timeline/useTimelineLayout.ts`(順序を保つため `useTimelineRowLayout` と `useTimelineMemberLayout` の 2 つに割ってよい) / Modify `Timeline.tsx`

**Interfaces:**
- Consumes: `scrollContainerRef`・`sheetContainerRef`(本体で作成)・ストアの値。
- Produces: `{ isMobileTimeline, isMilspecTable, rowUnitPx, sheetWidth, maxMitiIconsPerRow, phaseCollapsed/labelCollapsed(元の名前), recastRowVisible, gridLines, eventsByTime, rowLayout, rowLayoutRef, timeToYMapRef, sortedTimeYRef, sortedPartyMembers, visiblePartyMembers, memberHeaderRefs, getMemberRefCallback, memberLayout, memberStartPx, scrollViewportW, memberXMap, memberXMapRef, hoverGeomRef, cursorToLocalXRef }`。`rowLayoutRef`/`timeToYMapRef` 等をこれ以前のタスクで本体に作っていた場合は、作る場所はそのまま本体に残し、書き込みだけフックへ。

- [ ] **Step 1:** 819-860・977-1029・1887-1944・2814-2969 付近を列挙。**useLayoutEffect の順(sheetWidth 840 → 位置合わせ直し 1560〔Task 12 側〕→ memberStartPx 2911)**と描画中書き込み(1939-41・2935・2951・2962)を台帳に書く。位置合わせ直しを挟むため、sheetWidth を含む前半と memberStartPx を含む後半を別フックにし、間で Task 12 のフックを呼ぶ形にする。
- [ ] **Step 2:** `isMobileTimeline` は render 時の `window.innerWidth` 読みのまま(state 化しない)。
- [ ] **Step 3:** 移動 → V1 → pass(Timeline.layout・PartyToggleStrip)。`PartyToggleStrip.test.tsx:53` のコメントの参照先を新ファイルに更新。
- [ ] **Step 4:** commit `refactor(timeline): 列と行の位置計算をフックへ移す(整頓⑤)`

### Task 12: スクロールと横同期 → `useTimelineScrollSync`

**Files:** Create `src/components/timeline/useTimelineScrollSync.ts` / Modify `Timeline.tsx`

**Interfaces:**
- Consumes: `scrollContainerRef`・`headerRef`・`controlBarRef`(本体で作成)・`rowLayout`・`sortedTimeYRef`。
- Produces: `{ scrollSyncInnerElsRef, handleScrollSync, syncRecastRow, handleNavJump, (smooth wheel の戻り値) }`。**`syncRecastRow` は rowLayout 変化時の effect(本体)から呼ばれる**ので返す。

- [ ] **Step 1:** 1033-1040・1400(プラン切替リセット)・1450-1647 付近を列挙。`reanchorMountedRef` による初回スキップを含む位置合わせ直し(1560)・余白合わせ(1569)・effect 1622/1634 の相対順を台帳に書く。
- [ ] **Step 2:** 移動 → V1 → pass。
- [ ] **Step 3:** commit `refactor(timeline): スクロールと横の同期をフックへ移す(整頓⑤)`

### Checkpoint C

- [ ] V2 を回して全部合格。
- [ ] V3(性能 A/B)を回して合格。台帳に数値。

### Task 13: 操作バー → `TimelineControlBar`

**Files:** Create `src/components/timeline/TimelineControlBar.tsx`(MIL-SPEC デッキ部分が大きければ `TimelineMilspecDeck.tsx` に分ける) / Modify `Timeline.tsx` / allowlist・ModalShell.guard の付け替え

**Interfaces:**
- Produces: `TimelineControlBar`(props=元の JSX が読む値そのまま。`controlBarRef` は props で受けて同じ要素へ付ける)。JobPickerRow(3321 付近)を含む。

- [ ] **Step 1:** 3040-3336 付近を移す。DOM・クラスは 1 文字も変えない。
- [ ] **Step 2:** V1 → pass。commit `refactor(timeline): 操作バーを別部品へ(整頓⑤)`

### Task 14: 見出し行 → `TimelineHeader`

**Files:** Create `src/components/timeline/TimelineHeader.tsx` / Modify `Timeline.tsx`

**Interfaces:**
- Produces: `TimelineHeader`(`headerRef` を props で受け、`#timeline-header-inner` を含む 3337-3469 付近をそのまま描く。列見出し・リキャスト行・SheetColumnHeader)。

- [ ] **Step 1:** 移動 → V1 → pass(Timeline.recastBand.milspec)。
- [ ] **Step 2:** commit `refactor(timeline): 見出し行を別部品へ(整頓⑤)`

### Task 15: 行ループ → `TimelineRows`

**Files:** Create `src/components/timeline/TimelineRows.tsx` / Modify `Timeline.tsx`

**Interfaces:**
- Consumes: `getMitigationColorClasses`(Task 1)・stable* ハンドラ・damageMap 等(すべて個別の props)。
- Produces: `TimelineRows`(3535-3667 付近の IIFE の中身。renderItems と mitigationsByTime を**毎描画で同じように組み立てる**。useMemo を足さない。Fragment を返す)。`TimelineRows` 自体は React.memo にしない(元は毎描画で評価されていたため)。

- [ ] **Step 1:** 移動 → V1 → pass(TimelineRow.renderCount を必ず確認)。
- [ ] **Step 2:** commit `refactor(timeline): 行の並びを別部品へ(整頓⑤)`

### Task 16: 帯と PC の軽減アイコン層 → `TimelineBands` / `TimelineMitigationLayer`

**Files:** Create `src/components/timeline/TimelineBands.tsx`(ホバー強調・フェーズ帯・ラベル帯・TL 選択の強調 3668-3783 付近。`overlayRef` を props で受ける)・`src/components/timeline/TimelineMitigationLayer.tsx`(3784-4087 付近・MitigationItem のループ) / Modify `Timeline.tsx`

- [ ] **Step 1:** 帯を移動 → V1 → pass → commit `refactor(timeline): 帯を別部品へ(整頓⑤)`
- [ ] **Step 2:** 軽減アイコン層を移動 → V1 → pass(MitigationItem.renderCount)→ commit `refactor(timeline): 軽減アイコンの層を別部品へ(整頓⑤)`

### Checkpoint D

- [ ] V2 を回して全部合格。
- [ ] V3(性能 A/B)を回して合格。台帳に数値。

### Task 17: 下部・重なり UI の部品化

**Files:** Create(各 1 ファイル):
- `TimelinePopovers.tsx` — phase/label/event のポップオーバー(4717-4918 付近・createPortal・`backdropClose` ごと移す)
- `TimelineDialogs.tsx` — メモバー・コピーモードのバー・EventModal・MobileContextMenu・BoundaryEditModal×2・ヘッダーのドロップダウン 4 個(4138-4267)と、スプシのトースト/ポップオーバー・MitigationSelector・JobPicker・PartySettingsModal・取り込み 2 種・ConfirmDialog(4541-4625)
- `TimelineMobileSheets.tsx` — スマホの軽減一覧シート(4268-4540・`genId` を使う)・スマホの元に戻す/やり直し・ツールシート・MitigationSheet(4626-4716)
- `TimelineModeBars.tsx` — AA バー・TL 選択バー・VideoRecorderModal(4919-5036 のうち PiP 以外)
- Modify: `Timeline.tsx`・`rawStyleAllowlist.json`・`ModalShell.guard.test.ts`(LEGACY 追加)

**Interfaces:**
- `genId` は `src/components/timeline/genId.ts` へ移し、Timeline.tsx と TimelineMobileSheets の両方から import。

- [ ] **Step 1:** 4 ファイルを 1 つずつ移動。各移動の後に V1 → pass → commit(4 コミット・メッセージ `refactor(timeline): <名前>を別部品へ(整頓⑤)`)。
- [ ] **Step 2:** modalBackdropClose・ModalShell.guard が新ファイルで pass することを確認(LEGACY 追加は `'not-window'` のみ)。

### Task 18: 仕上げ — 全体ゲート・敵対レビュー・列固定計画の付け替え

**Files:** Modify `docs/superpowers/plans/2026-10-23-timeline-sticky-scroll.md`・`.superpowers/sdd/2026-10-23-timeline-sticky-scroll/progress.md`(⏸ 行の参照)・`docs/TODO.md`

- [ ] **Step 1:** `wc -l src/components/Timeline.tsx` を台帳に記録(目安 1500 以下。届かなくても追加で切らない)。
- [ ] **Step 2:** `npm run build` → exit 0。`npm run test:gate` → 失敗 0(HousingerPage.test の単発失敗が出たら単独で再実行して切り分け・台帳に記録)。
- [ ] **Step 3:** V2 全部・V3 を回して合格。frame-sync も Task 0 の記録と一致。
- [ ] **Step 4:** 敵対レビュー(fresh context・`split-base..HEAD`):「挙動が変わった箇所(effect 順・描画中書き込み順・参照同一性・DOM・依存配列)だけ」を探させる。正しさに関わる指摘だけ直す。
- [ ] **Step 5:** 列固定計画 Task 5〜18 と台帳 ⏸ 行の `Timeline.tsx:<行>` 参照を、新しい `ファイル:行` へ書き換える(計画の手順・判定は変えない)。commit `docs: 列固定の計画の参照先を切り分け後の場所に合わせる`
- [ ] **Step 6:** `docs/TODO.md` の「現在の状態」を更新(⑤完了・次=列固定 Task 5)・100 行以内を確認。`git tag -d split-base`。commit。
