# MIL-SPEC SP2 — タイムライン表の軍事化 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `themeStyle === 'military'` かつ PC のとき、埋め込んだ本番 `Timeline` をモック `.workspace` / `.subtoolbar` の見た目に完全再現する。標準モードの `/miti` は `main` と完全一致。

**Architecture:** 本番の表ロジック（座標計算・collab・競合判定・行間引き・スクロール同期・`MitigationItem`）は丸ごと再利用。再現は (1) `src/styles/military.css` の「SP2 節」（全ルール `.theme-military` 前置）による見た目差し替えが主役、(2) CSS で作れない構造差（リキャスト行の独立・計器スクロールバーの可視化・inert な `data-mit-*` フック）だけを `themeStyle === 'military' && !isMobileTimeline` 限定の分岐で `Timeline.tsx` に足す。

**Tech Stack:** React 19 + Zustand + Tailwind v4 (Lightning CSS) + Vite。テスト = Vitest (happy-dom) + Playwright（`playwright-skill`）。i18n = react-i18next（`src/locales/{ja,en,zh,zh-Hant,ko}.json`）。

**Spec:** `docs/superpowers/specs/2026-09-09-milspec-sp2-table-design.md`（このプランは spec から論証する。executor は両方読む）

## Global Constraints

spec §14 から逐語コピー。**全タスクの要件に暗黙で含まれる。**

1. **標準モード（`themeStyle` 未設定 / `'standard'`）の `/miti` のレンダリング出力（computed style・DOM 骨格）・挙動を `main` と完全一致させる。** 許容差分は spec §3.3 の (a) `Timeline.tsx` に `themeStyle` 購読 1 行、(b) `themeStyle === 'military' && !isMobileTimeline` 限定分岐、(c) inert な `data-*` フック（標準 CSS が拾わない）、(d) `military.css` の SP2 節追加（`.theme-military` 前置のみ）のみ。
2. **既存の編集機能を壊さない。** 座標計算・`handleScrollSync`・`syncRecastRow`・`hideEmptyRows`・collab・競合判定・`MitigationItem` のドラッグ/リサイズ・Undo/Redo・AA/メモモード・フェーズ/ラベル編集・折りたたみが両モードで動く。
3. **`Timeline.tsx` / `TimelineRow.tsx` / `RecastRow.tsx` / `MitigationItem` のロジックに手を入れない。** SP2 が触るのは (a) 見た目 CSS、(b) リキャスト帯の器と配置、(c) スクロール同期対象への条件付き追加、(d) inert な `data-*` フック のみ。
4. **正典はモックアップ** = `c:/Users/masay/Desktop/FF14Sim/docs/.private/theme-refs/milspec-mockup.html`（絶対パス・GITIGNORE・MAIN チェックアウトのみ）。デザインの疑問はモックの CSS/DOM を引く。
5. すべての MIL-SPEC CSS ルールは `.theme-military` 前置（`military.css` の SP2 節に集約）。
6. `.claude/rules/css-rules.md` 遵守: `backdrop-filter: blur()` リテラル禁止 → `--tw-backdrop-blur` 変数パターン / `clip-path: path()` 禁止・`polygon()` 可 / 回転 `::before` の `%` 禁止・`200vmax`。
7. sizing はリポジトリ標準（`docs/design-philosophy-sizing.md` = `C:\Users\masay\.claude\design-philosophy-sizing.md`）: 全 text px 固定（rem 不使用）・`clamp(MIN, N vw, BASE)` で max=base=1489・html font-size 16px。**列幅 `--col-*-w` は原則変更しない**（§後述）。
8. i18n は最初から 5 言語（ja/en/zh/zh-Hant/ko）。機能ラベルの用語は変えない（「軽減後」「元ダメージ」「敵の攻撃」等）。軍事英字は装飾として重ねるだけ・翻訳対象外。
9. push は行わない（SP2 は非公開・プレビューゲート裏・最終マージ時のみ push）。push 前ゲート = `npm run build` + 対象 vitest。
10. `src/components/MobileFab.tsx` は小文字 `ab` で参照（本番ビルド保護・grep で誤置換しない）。
11. `military.css` の全新規変数は `--ms-*` 名前空間。モックの `--raised-hi` / `--cyan` / `--pl-dark` / `--shb-tr` 等は既存の `--ms-raised-hi` / `--ms-cyan` / `--ms-pl-dark` / `--ms-shb-tr` へ読み替える（SP1 Phase 1 で dark/light 両方定義済・`military.css:30-200`）。

---

## 前提知識（executor 必読・コード実測 2026-09-09）

### 本番 `Timeline.tsx`（4725 行）の PC 表示ツリー（`return` は 2687 行〜）

```
[data-timeline-root]  (flex flex-col h-full)
 └ .glass-panel
    ├ .empty-liquid-glass                          … プラン未選択オーバーレイ
    ├ controlBarRef  (div, h-7, "hidden md:block", z-[51])
    │   └ #timeline-controls-inner  (flex items-center)   ← handleScrollSync が translateX で追従
    │      ├ Area A  w=calc(var(--col-header-chunk-w)-1px)  : 折りたたむ button (setHideEmptyRows)
    │      ├ divider (w-[1px] h-3)
    │      ├ Area B  md:w=calc(var(--col-mechanic-w)-1px)   : AA追加 (isAaModeEnabled=Timeline local state) + divider + メモ (store setToolMode 'memo')
    │      ├ divider
    │      ├ Area C  : 罫線 button (showRowBorders) + リキャスト行 button (recastRowVisible=Timeline local state, handleToggleRecastRowVisible)
    │      ├ divider
    │      ├ Area D  : Undo / Redo / クリア(ClearMitigationsPopover)
    │      ├ divider
    │      └ <JobPickerRow partyMembers={visiblePartyMembers} ... />   … 別ファイル src/components/JobPickerRow*.tsx
    ├ headerRef  (div, h-10, hidden on mobile, z-50, bg-app-surface2 border-b)
    │   └ #timeline-header-inner  (flex items-center)   ← handleScrollSync が translateX で追従
    │      ├ phase header  (phaseHeaderRef)  w=var(--col-phase-w) / collapsed var(--col-phase-collapsed-w)
    │      ├ label header  (gimmickHeaderRef) w=var(--col-label-w) / collapsed
    │      ├ time header   w=var(--col-time-w)
    │      ├ mechanic header (mechanicHeaderRef)  w-full
    │      ├ RAW header   w=var(--col-counter-w)
    │      ├ TAKEN header w=var(--col-counter-w)
    │      └ <RecastRow ref={recastRowRef} partyMembers={visiblePartyMembers} placements={timelineMitigations} mitigationDefs={MITIGATIONS} />
    │          … .recast-cell を partyMembers.map で Fragment 返し。ここに同居。
    ├ <MyJobHighlightAttrBridge targetRef={scrollContainerRef} />
    ├ <RecordModeAttrBridge targetRef={scrollContainerRef} />
    └ scrollContainerRef  (div.timeline-scroll-container, "flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto relative custom-scrollbar", onScroll=handleScrollSync)
        └ 巨大 render IIFE（return は Fragment）:
           ├ [data-phase-overlay] sticky フェーズラベル（phases[] があるとき）
           ├ [data-label-overlay] ラベル帯
           ├ <MitigationItem> × N   … 絶対配置 left=memberLayout.get(ownerId).left, top=timeToYMap.get(time) or (time-offsetT)*pixelsPerSecond
           ├ <TimelineRow key={time}> × N  … 外側 [data-time-row={time}] + grid、data-phase-col / data-label-col セル
           └ <ConflictOffscreenArrows> 等
```

### 触ってはいけない既存メカニズム（spec §3.1・全部維持）

- **横スクロール同期** `handleScrollSync`（Timeline.tsx 1469-1494）: `scrollContainerRef.current.scrollLeft` を読み `scrollSyncTargets`（1480-1481 の配列）の各要素を `style.transform = translateX(-scrollLeft)`。配列は `{ ref, id, cacheKey }` の 2 要素（header / controls）。
- **スクロールバー幅補正** `syncPadding`（1509-1520）: `scrollContainerRef.current.offsetWidth - clientWidth` を計り `headerRef.current.style.paddingRight` と `controlBarRef.current.style.paddingRight` に反映。`window resize` イベントとマウント時（`useEffect` deps `[]`）に実行。本番は縦バー幅 0 なので実質 0。
- **縦スクロールバー非表示** `src/index.css:1629-1632`: `.timeline-scroll-container::-webkit-scrollbar:vertical { width: 0; display: none; }`（横バーは残す）。
- **リキャスト更新** `syncRecastRow`（1528-1568）: スクロール毎に現在時刻を算出し `recastRowRef.current.update(currentTime)`。`RecastRow` は re-render せず CSS 変数（`--cd-angle` / `--cd-display` / `--cd-order`）と `.recast-num` textContent を直書き。`hideEmptyRows` 時は `sortedTimeYRef` で Y 最近傍時刻を逆引き。
- **行間引き** `hideEmptyRows`（`useMitigationStore`）: 折りたたむボタンで切替。`timeToYMap` が実 Y。
- **`MitigationItem`**（Timeline.tsx 228-660）: 24px アイコン div + 効果棒 div（`mitigation.duration > 1` のとき `<div className="absolute top-3 w-1.5 z-10 rounded-b-sm border-x pointer-events-auto cursor-pointer" + colors.bg + colors.border + colors.shadow>`・`style={{ height: durationHeight, left: 'calc(50% + Npx)', transform: 'translateX(-50%)' }}`）。ドラッグ（`handlePointerDown/Move/Up` on アイコン div）・競合（`isConflicting` → `ring-2 ring-amber-400 animate-conflict-pulse`）・ターゲットジョブバッジ（`.absolute -bottom-2 -right-2`）・仮想アイテム（`isVirtual`）。
- **`RecastRow.tsx`**（190 行）: `forwardRef<RecastRowHandle>`。`partyMembers.map` で `<div className="recast-cell" data-member data-role style={{width: getColumnCssVar(role), ...}}>` を Fragment 返し。中の `<RecastIcon>` は「過去に一度でも置かれた mitigationId」ぶん静的マウント。`useImperativeHandle` で `{ update(currentTime), hideAll() }` を公開。
- **`TimelineRow.tsx`**（712 行）: 外側 `<div data-time-row={time} className={clsx("...grid...")}>`。`data-phase-col` / `data-label-col` セル。`showRowBorders` prop で罫線。

### 既存の安定フック（SP2 の CSS が狙ってよい・新規追加しない）

`.timeline-scroll-container` / `#timeline-header-inner` / `#timeline-controls-inner` / `[data-timeline-root]` / `[data-time-row]` / `[data-phase-col]` / `[data-label-col]` / `.recast-cell`（+ `data-member` / `data-role`）/ `[data-phase-overlay]` / `[data-label-overlay]` / `[data-mobile-scrolling]` / `[data-myjob-highlight]` / `[data-record-mode]`。

### 列幅トークン（`src/index.css:1570-1600`・`@media (min-width:768px)` の `:root, .theme-dark, .theme-light`）

```
--col-phase-w:   clamp(48px, 4.030vw, 60px)     --col-label-w:  clamp(40px, 3.358vw, 50px)
--col-time-w:    clamp(48px, 4.030vw, 60px)     --col-mechanic-w: clamp(160px, 13.432vw, 200px)
--col-counter-w: clamp(80px, 6.716vw, 100px)  (RAW / TAKEN 共通)
--col-th-w: 151px   (tank/healer 列・リキャストアイコン最大6個が対称に収まる実測値)
--col-dps-w: 53px   (dps 列・最大2個)
--col-member-pad-x: 2.9px
--col-member-start: calc(phase + label + time + mechanic + counter + counter)
--col-phase-collapsed-w: 16px   --col-label-collapsed-w: 16px
--col-header-chunk-w: calc(phase + label + time)
```

**`.theme-military` は `.theme-dark` / `.theme-light` に *追加* で付く**（`applyThemeClasses`）ので上記トークンは military にも継承される。
**SP2 では `--col-th-w` / `--col-dps-w` を変更しない**（リキャストアイコンの対称配置に必要な機能的制約・モックの 100/62 は装飾寄せで再現しない）。phase/label/time/mechanic/counter も原則据え置き（モック 40/40/58/200/90/98 と実 clamp は数 px 差・視覚差は SP2 後の統一調整で判断）。

### `military.css` の現状（`src/main.tsx:8` で無条件 import・`.theme-military` 無しでは不活性・現状 ~103KB）

- `--ms-*` トークン（`military.css:30-200`・dark は `:root` 相当、light は `.theme-military.theme-light`）: `--ms-well` / `--ms-recess-hi/lo` / `--ms-raised/-hi/-lo` / `--ms-cham-lg/-sm` / `--ms-cr-t/l/r/b`（raised 4 色ボーダー）/ `--ms-cs-t/l/r/b`（recess 反転）/ `--ms-cham-silhouette` / `--ms-cham-ridge` / `--ms-sh-*`（角落としプリセット polygon）/ `--ms-shb-tr/tl/bl`（小切り欠き・`--ms-nb` ベース）/ `--ms-edge-hi/lo` / `--ms-frame` / `--ms-bracket` / `--ms-cyan(-bright/-glow/-dim)` / `--ms-orange(-glow)` / `--ms-red(-glow)` / `--ms-green(-glow)` / `--ms-text(-sec/-muted)` / `--ms-heading` / `--ms-stencil` / `--ms-pl-dark/-lite` / `--ms-raised-grad`。
- tune ノブ: `--ms-tune-relief` / `--ms-tune-frame` / `--ms-tune-glow` / `--ms-tune-panelline` / `--ms-tune-shadow` / `--ms-tune-grain` / `--ms-tune-channel` ほか（`MilspecTunePanel` で実機調整）。
- プリミティブ: `.milspec-bolt`（四隅ビス）/ `.milspec-sc`（隅ステンシルコード）/ `.milspec-hash`（斜線束）/ `.milspec-pl`（スジ彫り）/ `.milspec-chan`（ゾーン外周チャンネル）/ `.milspec-hazard` / `.milspec-lamp`（スイッチランプ・`.lit .cyan/.amber/.green`）/ `.milspec-nameplate` / `.milspec-screen` 等。
- workspace: `.theme-military .milspec-ws`（装甲板・`military.css` ~994）+ `.theme-military .milspec-ws-screen`（沈んだ画面・`background: linear-gradient(180deg,#0d1319,#080c11)` + 深い inset・~1008）は **SP1 で実装済**。`MilspecWorkspace.tsx` は `.milspec-ws` > `.milspec-bolt`×4 + `.milspec-sc`×2（`WKS-07` / `RAID OPERATIONS PLOT · MITIGATION ARRAY`）+ `.milspec-hash` + `.milspec-ws-screen` > `{children}`。

### モック該当箇所（正典・行番号）

- コントロールバー `.subtoolbar`: DOM 2088-2119 / CSS 966-1032
- ワークスペース `.workspace` + `.ws-screen`: DOM 2121-2213 / CSS 1034-1071
- 表 `.table` / `.thead` / `.th`: DOM 2130-2149 / CSS 1076-1120
- リキャスト行 `.recast-row` / `.rc-label` / `.rc-cell` / `.rc-icon` / `.rc-num`: DOM 2151-2168 / CSS 1277-1300
- 表本体 `.tbody` / `.trow` / `.td-*`: DOM 2170-2208 / CSS 1122-1162
- 軽減バー `.mit-bar` / `.mit-lbl`: DOM 2175-2188 / CSS 1164-1190
- 端末キャップ `.ws-cap` / `.ws-note`: DOM 2210-2211 / CSS 1191-1198
- 計器スクロールバー `.gauge-cap` / `.tbody::-webkit-scrollbar` / `.ws-screen::-webkit-scrollbar` / `.phases::-webkit-scrollbar`: CSS 1200-1275
- ジョブチップ `.cj`: DOM 2117 / CSS 1023-1032

---

## ファイル構成

### 新規

| ファイル | 責務 |
|---|---|
| `src/styles/military.css` の「SP2 節」 | コントロールバー / 表ヘッダー / リキャスト帯 / 表本体・行・セル / 軽減バー / ジョブチップ / 計器スクロールバー（表 + サイドバー共有）/ ワークスペース端末キャップ の意匠。全ルール `.theme-military` 前置。SP1 節の後ろに `/* ========== SP2: TIMELINE TABLE ========== */` 見出しで区切って追記。 |
| `scripts/milspec-sp2/standard-invariance.mjs` | Playwright: `main` の標準 `/miti` を基準に、現ブランチの標準 `/miti`（`themeStyle` 未設定）の DOM 骨格 + 主要要素 `getBoundingClientRect` が一致するか検証。dark/light。全タスクで再実行。 |
| `scripts/milspec-sp2/military-smoke.mjs` | Playwright: `themeStyle='military'` で `/miti` を開き、コンソールエラー 0 + 実操作（軽減の配置/移動/削除・折りたたむ・AA・メモ・リキャストトグル・フェーズジャンプ・横スクロール同期・縦スクロールでリキャスト追従）。 |
| `src/locales/{ja,en,zh,zh-Hant,ko}.json` への追記 | `timeline.recast_row.label` 他（§Task 7）・既存 `timeline.recast_row.show` / `.hide` の 5 言語補完。 |

### 変更

| ファイル | 変更 | タスク |
|---|---|---|
| `src/components/military/MilspecWorkspace.tsx` | `.milspec-ws-cap`（端末キャップ）+ `.milspec-ws-note`（`ROSTER n / 8`）を追加。party 可視メンバー数を `usePartyStore` から読む。 | Task 2 |
| `src/components/Timeline.tsx` | (a) `themeStyle` を `useThemeStore` から購読（既に import 済）。(b) `MitigationItem` の効果棒 div に `data-mit-bar`、アイコンラッパー div に `data-mit-icon`（inert）。(c) `themeStyle === 'military' && !isMobileTimeline` のとき `<RecastRow>` を `headerRef` 外・`scrollContainerRef` 直前に `[data-milspec-recast-band]` としてマウント（else = 現状）。(d) 同条件のとき `scrollSyncTargets` にリキャスト帯 inner を追加 + `syncPadding` にも。(e) `themeStyle` 変化時に `syncPadding()` を 1 回呼ぶ `useEffect`。 | Task 6, 7, 8 |

### 触らない

`src/store/*.ts` / `Timeline.tsx` の座標計算・render IIFE・collab・競合判定・`hideEmptyRows`・同期ロジック本体・`MitigationItem` のドラッグ/競合/仮想アイテムロジック / `TimelineRow.tsx` のロジック / `RecastRow.tsx`（原則）/ `RecastIcon.tsx` / `MitigationSheet.*` / `src/components/MobileFab.tsx` / `/admin` `/housing` `landing` / モバイル（SP3）/ 表エリアのポップアップ / `src/index.css` の `.timeline-scroll-container::-webkit-scrollbar:vertical`（標準の幅 0 は維持）。

---

## テスト戦略

CSS の視覚忠実度は自動化しない（spec §10）。各タスクの機械検証は:

- **標準不変**: `node scripts/milspec-sp2/standard-invariance.mjs`（Task 1 で作る）が PASS。
- **軍事スモーク**: `node scripts/milspec-sp2/military-smoke.mjs` が PASS（コンソールエラー 0 + 操作が動く）。
- **DOM 契約**: 構造を変える Task（2/6/7/8）は Vitest（happy-dom）で「要素が存在する / 標準では存在しない」を検証。
- **ジオメトリ**: Playwright で列 x 整列・リキャスト帯位置・スクロールバー幅を実測 assert。
- **ビルド**: `npm run build`（tsc -b 厳密）exit 0。

**各タスクの最後に masaya がローカル実機でモックとスクリーンショット突き合わせ承認**（`feedback_visual_fidelity_requires_screenshot_diff` = SP1 品質却下の直接の教訓）。機能検証だけで「完了」と報告しない。`reference_dev_editor_hmr_hardreload`: useEffect 変更後はハードリロード。

Playwright は `playwright-skill` の作法（dev サーバー自動検出・スクリプトは `/tmp` でなく `scripts/milspec-sp2/`）。軍事モードに入れるショートカット = `localStorage.setItem('theme-storage', JSON.stringify({ state: { theme:'dark', themeStyle:'military', ... }, version: 2 }))` は SP1 punch-list で「実際の入口ボタンを踏まないと入口不在に気づけない」教訓あり → **スモークは標準UIのスタイル切替ボタン（`MilspecStyleToggle` / `ConsolidatedHeader` のゲート付きトグル）経由で軍事に入る経路も 1 回通す**。

---

## Task 1: SP2 検証ハーネス（標準不変 + 軍事スモーク）

**Files:**
- Create: `scripts/milspec-sp2/standard-invariance.mjs`
- Create: `scripts/milspec-sp2/military-smoke.mjs`
- Create: `scripts/milspec-sp2/README.md`

**Interfaces:**
- Produces: `standard-invariance.mjs`（`node` で実行・exit 0 = PASS / exit 1 = 差分あり）、`military-smoke.mjs`（同）。以降の全タスクの Step で `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs` を回す。

- [ ] **Step 1: dev サーバー起動確認**

Run: `npm run dev`（別ターミナル・既に起動していれば不要）。`playwright-skill` の dev サーバー自動検出に任せてよい。ポートは vite の既定（`5173` 前後）。

- [ ] **Step 2: `standard-invariance.mjs` を書く**

要件:
- 引数なしで実行。`BASELINE_URL`（環境変数・省略時は同一 origin の別ポートや `git worktree` の `main` を指す。CI でなく手動運用なので、**簡易版**: `main` を別ディレクトリに checkout せず、「現ブランチの標準モードの構造スナップショット」を `scripts/milspec-sp2/.baseline/standard-{dark,light}.json` に保存し、初回は `--save` で保存、以降は比較）。
- Playwright で `/miti` を開く（`localStorage` に `theme-storage` を書かず = `themeStyle` 未設定 = 標準）。プランは fixture（後述）で 1 つ選択済みにする。
- スナップショット対象:
  - `[data-timeline-root]` の `outerHTML` を「タグ名 + 主要 class + data 属性」だけに正規化した骨格文字列（テキストノード・style 属性の数値・Tailwind の状態クラスは除外）。
  - `#timeline-controls-inner` / `#timeline-header-inner` / `.timeline-scroll-container` / 先頭 5 個の `[data-time-row]` / `.recast-cell` 先頭 3 個 の `getBoundingClientRect`（`x/y/width/height` を小数第 1 位で丸め）。
  - `.timeline-scroll-container` の縦スクロールバー幅（`offsetWidth - clientWidth`）= 標準では 0。
- dark（`theme:'dark'`）と light（`theme:'light'`）両方。
- `--save` フラグ: 現在値を `.baseline/` に保存して exit 0。フラグなし: `.baseline/` と比較し、差分があれば差分を print して exit 1。
- viewport = `1489 x 900`, `deviceScaleFactor: 1`（`design-philosophy-sizing.md` の「多数派再現」でなく安定比較優先で 1 倍）。

fixture: 既存の E2E / Playwright ヘルパにプラン選択の手順があれば流用。無ければスクリプト内で「サイドバーから最初のコンテンツ → 最初のプラン」をクリックする関数を書く。**executor は実 DOM を見てセレクタを確定すること**（`feedback_evidence_based_work`）。

- [ ] **Step 3: ベースライン保存**

Run: `node scripts/milspec-sp2/standard-invariance.mjs --save`
Expected: `.baseline/standard-dark.json` と `standard-light.json` が作られる。exit 0。
（このベースライン = SP2 着手前の標準モード。以降 SP2 の全タスクでこれと一致することを確認する。`git add` して固定する。）

- [ ] **Step 4: `military-smoke.mjs` を書く**

要件:
- Playwright で `/miti` を開き、標準UIのスタイル切替ボタン（`[data-milspec-style-toggle]` = SP1 で `ConsolidatedHeader` に復元されたゲート付きトグル。DEV では常時表示）をクリックして軍事モードに入る。**`localStorage` 直書きショートカットは使わない**（SP1 punch-list 教訓）。
- `page.on('console')` / `page.on('pageerror')` を収集。エラー 1 件でも exit 1。
- 実操作を順に実行し、それぞれ後に console エラー 0 を確認:
  1. 軽減セレクタを開き 1 個配置（メンバー列の空セルクリック → セレクタ → スキル選択）。
  2. 配置した軽減バーをドラッグして別の時刻へ移動。
  3. 折りたたむボタン（Area A）を ON/OFF。
  4. AA追加ボタンを ON、Esc で OFF。
  5. メモボタンを ON/OFF。
  6. リキャスト行トグル（Area C 2 個目）を OFF/ON。
  7. フェーズヘッダーをクリック → ドロップダウン → フェーズジャンプ（フェーズがあるプランのとき）。
  8. `.timeline-scroll-container` を `scrollBy({left: 300})` → `#timeline-header-inner` と `#timeline-controls-inner` の `transform` が `translateX(-300px)` 相当になっているか（数値許容 ±2px）。
  9. `.timeline-scroll-container` を `scrollBy({top: 400})` → リキャスト帯（Task 7 以降）の `.recast-num` textContent が変化 or 例外なし。
  10. 配置した軽減を削除（右クリック → 削除 or クリアボタン）。
- Task 1 時点では軍事モードの見た目は未実装なので「動く・エラーが出ない」だけを確認する。

- [ ] **Step 5: 両スクリプトを実行**

Run: `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs`
Expected: 両方 exit 0。standard は Step 3 のベースラインと一致（当然・まだ何も変えていない）。military-smoke は全操作でエラー 0。

- [ ] **Step 6: README を書く**

`scripts/milspec-sp2/README.md` に: 目的 / 実行方法 / `.baseline/` の意味 / 「標準不変が壊れたら SP2 の分岐の入れ方が誤り」/ masaya の視覚ゲートは別（自動化しない）。

- [ ] **Step 7: Commit**

```bash
git add scripts/milspec-sp2/
git commit -m "test(milspec-sp2): 標準不変ハーネス + 軍事スモーク"
```

- [ ] **Step 8: masaya ゲート** — このタスクは見た目を変えないので視覚確認は不要。「ハーネス整備完了・ベースライン取得」を 1 行報告（`feedback_close_review_loops_visibly`）。

---

## Task 2: ワークスペース端末キャップ + 二層の締め（`.ws-cap` / `.ws-note`）

**Files:**
- Modify: `src/components/military/MilspecWorkspace.tsx`
- Modify: `src/styles/military.css`（SP2 節を新設・冒頭）
- Test: `src/components/military/__tests__/MilspecWorkspace.test.tsx`（既存に追記）

**Interfaces:**
- Consumes: SP1 の `.milspec-ws` / `.milspec-ws-screen`（既存）。
- Produces: `MilspecWorkspace` が `.milspec-ws-cap` と `.milspec-ws-note` を描画。`.milspec-ws-note` のテキストは `usePartyStore` の可視メンバー数から `ROSTER {n} / 8`。

- [ ] **Step 1: DOM 契約テストを書く（失敗させる）**

`MilspecWorkspace.test.tsx` に追記:
```tsx
it('端末キャップと ROSTER ノートを持つ', () => {
  const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
  expect(container.querySelector('.milspec-ws-cap')).not.toBeNull();
  const note = container.querySelector('.milspec-ws-note');
  expect(note).not.toBeNull();
  expect(note!.textContent).toMatch(/ROSTER\s+\d\s*\/\s*8/);
});
```
`usePartyStore` を happy-dom で使うため、既存の他テストの store モック作法に合わせる（`src/components/military/__tests__/MilspecSidebar.test.tsx` を参照）。

- [ ] **Step 2: 実行して失敗を確認**

Run: `npx vitest run src/components/military/__tests__/MilspecWorkspace.test.tsx`
Expected: FAIL（`.milspec-ws-cap` が null）

- [ ] **Step 3: `MilspecWorkspace.tsx` に要素追加**

`.milspec-ws-screen` の後、`.milspec-ws` の子として:
```tsx
import { usePartyStore } from '../../store/usePartyStore'; // 実際のパスとセレクタ名は実 store を確認
// ...
const visibleCount = usePartyStore(s => s.partyMembers.filter(/* 可視条件 */).length);
// ...
<span className="milspec-ws-cap" aria-hidden />
<div className="milspec-ws-note" aria-hidden>
  {`ROSTER ${visibleCount} / 8`}
  <br />
  {visibleCount >= 8 ? 'FULL PARTY' : `SLOTS ${8 - visibleCount} OPEN`}
</div>
```
**executor は `usePartyStore` の実セレクタ名と「可視メンバー」の判定（`hiddenPartyMemberIds` 等）を実コードで確認してから書く。** 固定英字なので i18n 不要（Global Constraint 8）。

- [ ] **Step 4: SP2 節を `military.css` に新設 + `.ws-cap` / `.ws-note` の意匠**

`military.css` の SP1 節の末尾（workspace 節 `~1013` の後 or ファイル末尾の適切な位置）に:
```css
/* ============================================================
 * SP2: TIMELINE TABLE — タイムライン表の軍事化
 * 正典: docs/.private/theme-refs/milspec-mockup.html
 *   .subtoolbar(2088-2119/966-1032) / .workspace(2121-2213/1034-1071)
 *   .table/.thead/.th(2130-2149/1076-1120) / .recast-row(2151-2168/1277-1300)
 *   .tbody/.trow/.td(2170-2208/1122-1162) / .mit-bar/.mit-lbl(2175-2188/1164-1190)
 *   .ws-cap/.ws-note(2210-2211/1191-1198) / scrollbar(1200-1275) / .cj(1023-1032)
 * 全ルール .theme-military 前置。モックの --raised-hi 等は --ms-raised-hi へ読み替え。
 * ============================================================ */

/* ---------- Task 2: 端末キャップ + ROSTER ノート（mockup .ws-cap/.ws-note 1191-1198） ---------- */
.theme-military .milspec-ws-cap {
  position: absolute; top: 0; bottom: 0; width: 14px; pointer-events: none; z-index: 3;
  /* mockup: left は「表の実描画幅の右端」= 動的。実アプリは表幅が可変なので right 基準にせず
     .milspec-ws-screen の右端内側に貼る（表が screen 幅より狭ければ隙間に出る）。 */
  right: 0;
  background: linear-gradient(90deg, transparent, var(--ms-raised-lo) 40%, var(--ms-raised) 50%, var(--ms-raised-lo) 60%, #05070a);
  opacity: 0.55;
}
.theme-military .milspec-ws-note {
  position: absolute; right: 22px; top: 10px; z-index: 3; pointer-events: none; line-height: 1.7;
  font: 400 7px/1.7 'Share Tech Mono', monospace; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ms-text-muted); opacity: 0.38; text-align: right;
}
```
（mockup の `.ws-cap { left: 1192px }` は固定キャンバス前提。実アプリは表幅可変なので `right` 基準に読み替える。位置の最終調整は masaya ゲート + SP2 後の統一調整。）

- [ ] **Step 5: テスト実行**

Run: `npx vitest run src/components/military/__tests__/MilspecWorkspace.test.tsx`
Expected: PASS

- [ ] **Step 6: ハーネス**

Run: `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs`
Expected: 両方 exit 0（`MilspecWorkspace` は軍事モード専用なので標準不変は自明・スモークもエラー 0）

- [ ] **Step 7: ビルド**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add src/components/military/MilspecWorkspace.tsx src/styles/military.css src/components/military/__tests__/MilspecWorkspace.test.tsx
git commit -m "feat(milspec-sp2): ワークスペース端末キャップ + ROSTER ノート + SP2 CSS 節新設"
```

- [ ] **Step 9: masaya ゲート**

「Task 2 完了。ワークスペース右端の端末キャップ + `ROSTER n / 8` ノートを追加。DEV で軍事モードにして `/miti` を開き、モック `.ws-cap` / `.ws-note`（右端の細帯 + 極小テレメトリ文字）と見比べて。ハードリロード必須。」

---

## Task 3: 表本体 — 沈みスクリーン / 金属スラット行 / セル仕切り

**Files:**
- Modify: `src/styles/military.css`（SP2 節に追記）
- Test: Playwright（`military-smoke.mjs` に nth 検証を追加）

**Interfaces:**
- Consumes: `.theme-military .milspec-ws-screen`（SP1）。既存フック `.timeline-scroll-container` / `[data-time-row]` / `[data-phase-col]` / `[data-label-col]`。
- Produces: なし（CSS のみ）。

- [ ] **Step 1: `[data-time-row]` の兄弟構成を実測**

Playwright で軍事モード `/miti` を開き、`.timeline-scroll-container` 内 relative div の子要素の並びを列挙（`[...el.children].map(c => c.tagName + '.' + c.className + (c.dataset.timeRow ?? ''))`）。**`[data-time-row]` 以外の要素（`[data-phase-overlay]` / `[data-label-overlay]` / `MitigationItem` の絶対配置 div / `ConflictOffscreenArrows`）が兄弟にいるか**を確認。結果を `scripts/milspec-sp2/notes.md` に記録。

- [ ] **Step 2: nth の当て方を決める**

Step 1 の結果で:
- `[data-time-row]` が連続した兄弟なら `[data-time-row]:nth-of-type(even)` は使えない（`nth-of-type` はタグ名で数えるので div の絶対配置要素も数える）→ `[data-time-row] ~ [data-time-row]` の数え上げは不可。
- **推奨**: ゼブラ・4n 溝を `[data-time-row]` の**行インデックスに依存しない**表現にする。具体的には各行内で完結する意匠（上 hi / 下 lo の box-shadow・`border-bottom`）+ ゼブラは諦めるか、`TimelineRow` が既に持つ属性（`data-time-row` の値 = 秒。偶奇は秒で決まる = 意味がない）で近似せず、**CSS カウンタや `:nth-child` を使わず「4 行ごとの溝」だけを `[data-time-row]` の `nth-of-type` が安全に効く場合のみ**採用。
- Step 1 で「`[data-time-row]` が絶対配置要素より後にまとまって並ぶ」なら `[data-time-row]:nth-of-type(4n)` が使える可能性 → Playwright で 4 番目・8 番目の行に溝が付くか実測確認してから採用。
- 判断を `notes.md` に記録。

- [ ] **Step 3: 表本体 CSS を書く（mockup .tbody/.trow/.td 1122-1162 を --ms-* へ移植）**

```css
/* ---------- Task 3: 表本体（mockup .tbody/.trow/.td 1122-1162） ---------- */
/* .timeline-scroll-container を深い沈みスクリーンに。SP1 の .milspec-ws-screen（外側の枠）
   の内側でさらに一段沈める。 */
.theme-military .timeline-scroll-container {
  background: linear-gradient(180deg, #141b22, #0e141a);
  box-shadow:
    inset 0 8px 24px rgba(0,0,0,0.82), inset 0 2px 2px rgba(0,0,0,0.9),
    inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 0 0 2px rgba(255,255,255,0.03);
}
/* dark 固定 hex は light で上書き（Global Constraint 11・SP1 と同じ作法） */
.theme-military.theme-light .timeline-scroll-container {
  background: linear-gradient(180deg, #dde5ec, #cdd7e0);
  /* light 値は SP2 後の統一調整で詰める・ここは「破綻しない」レベル */
}

/* 各行 = 浮いた金属スラット */
.theme-military [data-time-row] {
  background: linear-gradient(180deg, rgba(255,255,255,0.028), rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.14));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5);
}
.theme-military [data-time-row]:hover {
  box-shadow: inset 3px 0 0 var(--ms-cyan), inset 0 1px 0 rgba(255,255,255,0.08);
  background-color: var(--ms-cyan-dim);
}
/* ゼブラ・4n 溝は Step 2 の判断に従う。安全に効く場合のみ: */
/* .theme-military [data-time-row]:nth-of-type(even) { ... } */
/* .theme-military [data-time-row]:nth-of-type(4n)  { box-shadow: ..., inset 0 -3px 0 -1px var(--ms-pl-dark); } */

/* セル間の inset 仕切り（mockup .td-* border-left 1145） */
.theme-military [data-time-row] > * {
  border-left: 1px solid rgba(0,0,0,0.42);
  box-shadow: inset 1px 0 0 rgba(255,255,255,0.045);
}
.theme-military [data-time-row] [data-phase-col] { border-left: 0; box-shadow: none; }

/* 時刻セル・元ダメージ・軽減後（mockup .td-time/.td-orig/.td-mit 1144/1151-1154）
   実 DOM のセルクラスを Step 1 で確認して狙う。時刻列は左から3番目、RAW/TAKEN は counter 列。
   実クラスが無ければ nth-child で位置指定（列数は phase/label/time/mechanic/RAW/TAKEN+members で固定）。 */
```
**executor は Step 1 で `TimelineRow` の各セルの実クラス/属性を確認**し、時刻・元ダメージ・軽減後・致命行のセレクタを確定する。「致命行」= `mitigation.duration` 無関係の lethal 判定 → `TimelineRow.tsx` で lethal に付くクラス/属性を grep（`lethal` / `is-lethal` / ダメージがバリアを超える判定）。無ければこの Task では致命セルの赤発光は「未確定」として `notes.md` に残し Task 10 で masaya と詰める。

- [ ] **Step 4: フェーズ / ラベルオーバーレイの整合**

`[data-phase-overlay]` / `[data-label-overlay]`（sticky フェーズ帯）が沈みスクリーン上で読めるか確認。必要なら:
```css
.theme-military [data-phase-overlay] { /* 金属バンド意匠・SP1 のサイドバー phase-tag と語彙を揃える */ }
.theme-military [data-label-overlay] { /* 同 */ }
```

- [ ] **Step 5: ハーネス + ビルド**

Run: `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs && npm run build`
Expected: 全部 exit 0。標準不変 = `[data-time-row]` を狙う CSS は `.theme-military` 前置なので標準では不活性 → ベースライン一致。

- [ ] **Step 6: Commit**

```bash
git add src/styles/military.css scripts/milspec-sp2/notes.md
git commit -m "feat(milspec-sp2): 表本体 — 沈みスクリーン + 金属スラット行 + セル仕切り"
```

- [ ] **Step 7: masaya ゲート**

「Task 3 完了。表本体を沈んだスクリーン + 各行を浮いた金属スラット + セル間の彫り込み仕切りに。ゼブラ/4n 溝は [採用した / 見送った（理由）]。致命行の赤セルは [実装した / 判定クラスが特定できず Task 10 で相談]。モック `.tbody` / `.trow`（2170-2208）と見比べて。」

---

## Task 4: 表ヘッダー — ブラケットタイル列見出し

**Files:**
- Modify: `src/styles/military.css`（SP2 節に追記）

**Interfaces:**
- Consumes: 既存フック `#timeline-header-inner`。SP1 の `--ms-shb-tr` / `--ms-shb-tl` / `--ms-cr-*` / `--ms-bracket` / `--ms-raised-*`。
- Produces: なし（CSS のみ）。

- [ ] **Step 1: ヘッダー内セルの実構成を実測**

Playwright で `#timeline-header-inner` の直接の子を列挙（クラス・幅・`ref` の手がかり）。phase / label / time / mechanic / RAW / TAKEN ヘッダー + `.recast-cell` 群（Task 7 で分離するまではここに同居）。折りたたみ状態（`phaseColumnCollapsed` / `labelColumnVisible`）の切替も見て、折りたたみ時の細い列の DOM を確認。

- [ ] **Step 2: ヘッダー CSS を書く（mockup .thead/.th 1076-1120 を移植）**

```css
/* ---------- Task 4: 表ヘッダー（mockup .thead/.th 1076-1120） ---------- */
.theme-military #timeline-header-inner {
  background:
    linear-gradient(158deg, rgba(255,255,255,0.05), transparent 40%, rgba(0,0,0,0.12)),
    var(--ms-raised-grad);
  box-shadow:
    inset 0 1px 0 var(--ms-cham-ridge), inset 0 -1px 0 rgba(0,0,0,0.5),
    0 calc(1px + 2px * var(--ms-tune-relief)) 0 rgba(0,0,0,0.55);
  position: relative;
}
/* 下端の muted steel ライン（mockup .thead::after 1086・シアン発光でなく渋い鋼色） */
.theme-military #timeline-header-inner::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
  background: rgba(150,190,205,0.28); pointer-events: none;
}
/* 各列見出しセル = ブラケット枠の金属タイル（mockup .th 1087-1094） */
.theme-military #timeline-header-inner > * {
  position: relative; margin: 4px 3px;
  background: linear-gradient(177deg, var(--ms-raised-hi), var(--ms-raised-lo));
  border: 1px solid var(--ms-frame);
  border-top-color: var(--ms-edge-hi); border-bottom-color: rgba(0,0,0,0.5);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.45), 0 2px 5px rgba(0,0,0,0.3);
}
/* 交互の切り欠き（mockup .th:nth-child(odd/even) 1097-1098・V字通気溝が継ぎ目で繋がる） */
.theme-military #timeline-header-inner > *:nth-child(odd)  { clip-path: var(--ms-shb-tr); }
.theme-military #timeline-header-inner > *:nth-child(even) { clip-path: var(--ms-shb-tl); }
/* 隅ブラケット（mockup .th::before/::after 1099-1101） */
.theme-military #timeline-header-inner > *::before,
.theme-military #timeline-header-inner > *::after {
  content: ""; position: absolute; width: 6px; height: 6px; border: 1px solid var(--ms-bracket);
}
.theme-military #timeline-header-inner > *::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.theme-military #timeline-header-inner > *::after  { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }
```
**注意**: `#timeline-header-inner` の子には `.recast-cell` 群（Task 7 で分離前）も含まれる。`> *` が recast セルにも当たる。Task 7 完了後は recast が別要素になるので問題ないが、Task 4→7 の間は recast セルにもブラケットタイルが乗る。許容（一時的・Task 7 で解消）か、`:not(.recast-cell)` で除外するかを判断して `notes.md` に記録。**推奨: `:not(.recast-cell)` で除外**しておき Task 7 で外す。

- [ ] **Step 3: Time 見出し下線 + `.hd-hash` 斜線束**

```css
/* Time 見出しの en に下線（mockup .th.time .en 1106）— 実 DOM で time ヘッダーの特定方法を確認して狙う */
/* .hd-hash（右上の斜線束・mockup 1104-1105）は実 DOM に無いので ::after 疑似で追加 */
.theme-military #timeline-header-inner > *:not([data-phase-col]):not(.recast-cell)::after {
  /* ↑ Step 2 の ::after（隅ブラケット）と衝突。hd-hash は別の疑似要素が要る →
     隅ブラケットを 1 つの ::before に box-shadow で 2 隅描くなどして ::after を空ける、
     または hd-hash を諦める。executor が mockup を見て優先度判断。 */
}
```
（`::before` / `::after` は各要素 1 つずつ。隅ブラケット 2 個 + hd-hash で 3 つ必要 → 隅ブラケットを `::before` に集約（box-shadow か multiple background で対角 2 隅）、`::after` を hd-hash に。実装の詳細は executor 判断・mockup 準拠。）

- [ ] **Step 4: 折りたたみ列**

`phaseColumnCollapsed` / `labelColumnVisible === false` のときの細い列（`--col-phase-collapsed-w` = 16px）も `.th` 意匠の縮小版で。`> *` セレクタが自動で当たるので、幅が狭いときにブラケットや切り欠きが潰れないか Playwright で折りたたんで確認。潰れるなら `:where()` で幅の狭い列を除外 or 簡略意匠。

- [ ] **Step 5: ハーネス + ビルド**

Run: `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs && npm run build`
Expected: 全部 exit 0。

- [ ] **Step 6: Commit**

```bash
git add src/styles/military.css scripts/milspec-sp2/notes.md
git commit -m "feat(milspec-sp2): 表ヘッダー — ブラケットタイル列見出し + 交互切り欠き"
```

- [ ] **Step 7: masaya ゲート**

「Task 4 完了。列見出しをブラケット枠の金属タイル + 交互の切り欠き（隣同士でV字溝が繋がる）+ 隅ブラケット + 下端の渋い鋼ライン。Time 見出しの下線 / hd-hash 斜線束は [実装 / 見送り]。折りたたみ列も確認済み。モック `.thead`（2130-2149）と見比べて。」

---

## Task 5: コントロールバー — `.subtoolbar` 意匠

**Files:**
- Modify: `src/styles/military.css`（SP2 節に追記）

**Interfaces:**
- Consumes: 既存フック `#timeline-controls-inner`。SP1 の `.milspec-lamp` プリミティブ・`--ms-recess-*` / `--ms-cr-*` / `--ms-cs-*` / `--ms-cyan` / `--ms-cham-*`。
- Produces: なし（CSS のみ）。**ボタンの DOM・状態・ハンドラは一切変えない。**

- [ ] **Step 1: コントロールバー内の実 DOM を実測**

Playwright で `#timeline-controls-inner` の子孫を列挙。Area A〜D の各ボタンの実クラス（Tailwind ユーティリティ直書き）・`bg-app-toggle`（ON 状態）の付き方・divider（`w-[1px] h-3`）・`JobPickerRow` のチップ要素。**ON 状態の判定に使えるフック**（`bg-app-toggle` クラスの有無 / `aria-pressed` / データ属性）を確認して `notes.md` に記録。

- [ ] **Step 2: コントロールバー背景 + divider（mockup .subtoolbar 969-986）**

```css
/* ---------- Task 5: コントロールバー（mockup .subtoolbar 966-1032） ---------- */
.theme-military [data-timeline-root] > div:has(> #timeline-controls-inner) {
  /* = controlBarRef（h-7 の外側 div）。:has が使えない環境なら Timeline に data 属性を足すか
     #timeline-controls-inner の親を JS 無しで狙える別法。executor 確認。 */
  background: linear-gradient(180deg, var(--ms-raised-hi), var(--ms-raised) 60%, var(--ms-raised-lo));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 5px rgba(0,0,0,0.38);
}
.theme-military #timeline-controls-inner { position: relative; }
/* 下端の渋い鋼ライン（mockup .subtoolbar::after 975-976） */
.theme-military #timeline-controls-inner::after {
  content: ""; position: absolute; left: 4px; right: 4px; bottom: 2px; height: 1px;
  background: rgba(150,190,205,0.22); pointer-events: none;
}
/* divider（mockup .cb-div 985-986・V 断面スジ彫り） */
.theme-military #timeline-controls-inner .w-\[1px\].h-3 {
  background: linear-gradient(90deg, rgba(255,255,255,0.09) 0 1px, rgba(0,0,0,0.6) 1px 2px) !important;
}
```
（`:has()` は本番の Lightning CSS + ターゲットブラウザで可否を確認。不可なら Task 5 の中で `controlBarRef` の div に `data-milspec-controlbar` を足す（inert・Global Constraint (c)）。**executor 判断・`notes.md` に記録。**）

- [ ] **Step 3: トグルボタン（折りたたむ / AA / メモ）を `.cb-tgl` 意匠に（mockup 988-1008）**

Step 1 で確認した各ボタンのセレクタに対し、ロッカートグル意匠（`--ms-recess-*` グラデ + 面取り `--ms-cs-*` + inset 影）。ON 状態（`bg-app-toggle` 相当）のときシアン下線 + `--ms-cyan-glow`。左端に `.milspec-lamp` 相当を `::before` で（ON のとき点灯）。

- [ ] **Step 4: アイコンボタン（罫線 / リキャスト / Undo / Redo / クリア）を `.cb-ico` 意匠に（mockup 1009-1022）**

極小キートップ意匠（`--ms-raised-grad` + `--ms-frame` 枠 + inset ハイライト）。ON（罫線 ON / リキャスト ON）は左端シアン inset。クリアは hover で `--ms-red`。

- [ ] **Step 5: ステンシルデカール（mockup .hash / .sc "ENGAGEMENT TIMELINE CONTROL · SEC-2" 2092-2093）**

`#timeline-controls-inner::before` 等で右側の空き（`JobPickerRow` の右）に斜線束 + ステンシル文字。固定英字。

- [ ] **Step 6: ハーネス + ビルド**

Run: `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs && npm run build`
Expected: 全部 exit 0。**military-smoke の Step 3〜6（折りたたむ / AA / メモ / リキャストトグル）が引き続き動く**ことを重点確認（CSS で `pointer-events` を殺していないか）。

- [ ] **Step 7: Commit**

```bash
git add src/styles/military.css scripts/milspec-sp2/notes.md src/components/Timeline.tsx
# ↑ Timeline.tsx は data-milspec-controlbar を足した場合のみ
git commit -m "feat(milspec-sp2): コントロールバー — .subtoolbar 意匠（ロッカートグル + キートップ + ランプ）"
```

- [ ] **Step 8: masaya ゲート**

「Task 5 完了。コントロールバーを raised プレート化。折りたたむ / AA / メモ = ロッカートグル（ON でシアン下線 + ランプ点灯）、罫線 / リキャスト / Undo / Redo / クリア = 極小キートップ。ボタンの位置・動作は一切変えていない。モック `.subtoolbar`（2088-2119）と見比べて。全ボタンが押せることも確認済み。」

---

## Task 6: 軽減バー + ジョブチップ

**Files:**
- Modify: `src/components/Timeline.tsx`（`MitigationItem` に inert な `data-mit-bar` / `data-mit-icon`・**それだけ**）
- Modify: `src/styles/military.css`（SP2 節に追記）
- Test: `src/components/__tests__/`（`MitigationItem` の属性テスト・既存の Timeline 系テストファイルに追記 or 新規）

**Interfaces:**
- Consumes: 既存フック `#timeline-controls-inner`（JobPickerRow）。SP1 の `--ms-cyan/green/orange(-glow)` / `--ms-cr-*` / `--ms-cham-silhouette`。
- Produces: `MitigationItem` の効果棒 div に `data-mit-bar`、24px アイコンラッパー div に `data-mit-icon`。

- [ ] **Step 1: 属性テストを書く（失敗させる）**

`MitigationItem` を render するテスト。既存の Timeline テストの作法（happy-dom + store モック）に合わせる。無ければ最小の新規ファイル `src/components/__tests__/MitigationItem.milspec.test.tsx`:
```tsx
// @vitest-environment happy-dom
// MitigationItem は Timeline.tsx 内の非 export コンポーネント。
// export されていなければ、Timeline を render して軽減を 1 個配置した状態で
// document.querySelector('[data-mit-bar]') / '[data-mit-icon]' を確認する統合テストにする。
it('軽減バーとアイコンラッパーに inert フックが付く', () => {
  // ... 軽減を1個持つプランで Timeline を render
  expect(container.querySelector('[data-mit-icon]')).not.toBeNull();
  // duration > 1 の軽減なら:
  expect(container.querySelector('[data-mit-bar]')).not.toBeNull();
});
```
**executor は `MitigationItem` が export されているか確認**（Timeline.tsx 228 行・`const MitigationItem`）。されていなければ Timeline 統合テスト。

- [ ] **Step 2: 実行して失敗を確認**

Run: `npx vitest run <test file>`
Expected: FAIL

- [ ] **Step 3: `Timeline.tsx` の `MitigationItem` に属性追加（2 箇所だけ）**

- 効果棒 div（`mitigation.duration > 1` の `<div className="absolute top-3 w-1.5 ...">`・Timeline.tsx ~618）に `data-mit-bar=""` を追加。
- 24px アイコンラッパー div（`<div className={clsx("rounded shadow-md relative z-20 ...")}>`・~552、または内側の `bg-black/50` div ~569）に `data-mit-icon=""` を追加。executor が「軍事意匠を当てやすい方」の div を選ぶ（外側 = 位置基準・内側 = アイコン枠）。
- **他は何も変えない。** `colors.bg` 等の JS 色クラスはそのまま残す（CSS で上書きする）。

- [ ] **Step 4: 標準不変を即確認**

Run: `node scripts/milspec-sp2/standard-invariance.mjs`
Expected: exit 0。**`data-mit-bar` / `data-mit-icon` は骨格正規化で拾われる可能性がある** → `standard-invariance.mjs` の骨格正規化が「`data-mit-*` を含む」なら、この属性追加でベースライン差分が出る。その場合は「inert な data 属性追加は Global Constraint (c) で許容」と判断し、`--save` でベースラインを更新して差分の内訳（`data-mit-bar` / `data-mit-icon` の追加のみ・computed style 不変）をコミットメッセージに明記する。computed style / geometry に差分が出たら実装ミス → revert。

- [ ] **Step 5: 軽減バー CSS（mockup .mit-bar/.mit-lbl 1164-1190）**

```css
/* ---------- Task 6: 軽減バー（mockup .mit-bar/.mit-lbl 1164-1190） ---------- */
.theme-military [data-mit-bar] {
  /* 工業パイプの一区間。実 DOM の w-1.5(6px) はそのまま。colors.bg を上書き。 */
  background: linear-gradient(90deg, #0a0e12 0%, #1c232a 22%, #2e363f 48%, #1c232a 76%, #0a0e12 100%) !important;
  border-color: rgba(0,0,0,0.5) !important;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.35) !important;
}
.theme-military [data-mit-bar]::before { /* 中心 ID 帯（ロール色） */
  content: ""; position: absolute; left: 50%; top: 3px; bottom: 3px; width: 2px; transform: translateX(-50%);
  background: var(--ms-mb-col, var(--ms-cyan)); box-shadow: 0 0 3px var(--ms-mb-glow, var(--ms-cyan-glow));
}
.theme-military [data-mit-bar]::after { /* 下端フランジ */
  content: ""; position: absolute; left: 50%; bottom: -2px; width: 11px; height: 4px; transform: translateX(-50%);
  background: linear-gradient(180deg, #4a545e, #2a323a); border-radius: 1px; box-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
/* ロール色: executor が MitigationItem の props から role/jobId を引ける方法を確認。
   引けるなら data-role を足す（inert）or colors オブジェクトにロールが入っているか。
   引けないなら colors.bg の Tailwind クラス（bg-cyan-* 等）を属性セレクタで分岐:
   .theme-military [data-mit-bar].bg-sky-500 { --ms-mb-col: var(--ms-cyan); } 等。 */
```
**executor は `MitigationItem` の `colors` の中身と `getMitigationColorClasses` の戻り値を確認**してロール色の引き方を確定（`notes.md`）。

- [ ] **Step 6: アイコンチップ意匠（mockup .mit-lbl 1182-1190 相当）**

```css
.theme-military [data-mit-icon] {
  border-radius: 1px;
  border: 1px solid var(--ms-cr-r);
  border-top-color: var(--ms-cr-t); border-left-color: var(--ms-cr-l);
  box-shadow: 0 0 0 1px var(--ms-cham-silhouette), inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.4);
  background: linear-gradient(180deg, #3a434c, #262d34);
}
/* 競合リング（ring-2 ring-amber-400 animate-conflict-pulse）は機能色 → 触らない。 */
```
mockup `.mit-lbl` のジョブコードテキスト併記は実 DOM（アイコン + ターゲットジョブバッジ）に対しては SP2 では入れない（spec §13・SP2 後判断）。

- [ ] **Step 7: ジョブチップ `.cj`（mockup .cj 1023-1032）**

`#timeline-controls-inner` 内の `JobPickerRow` のチップ要素（Step 1 で確認したクラス）に:
```css
.theme-military #timeline-controls-inner <chip selector> {
  border-style: solid; border-width: 1px; border-radius: 1px;
  border-top-color: var(--ms-cr-t); border-left-color: var(--ms-cr-l);
  border-right-color: var(--ms-cr-r); border-bottom-color: var(--ms-cr-b);
  box-shadow: 0 0 0 1px var(--ms-cham-silhouette);
  background: linear-gradient(180deg, #3a444f, #2a323c);
}
```
実ジョブアイコンは維持。クリック挙動（`handleJobIconClick`）不変。

- [ ] **Step 8: テスト + ハーネス + ビルド**

Run: `npx vitest run <test file> && node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs && npm run build`
Expected: 全部 exit 0。**military-smoke の Step 1〜2（軽減の配置・ドラッグ移動）と Step 10（削除）が引き続き動く**ことを重点確認（`data-mit-bar` の `pointer-events` / `cursor` を CSS で殺していないか。mockup の `.mit-bar { pointer-events: none }` を真似ると実アプリのバークリック転送（`handleBarClick`）が死ぬ → **`pointer-events` は触らない**）。

- [ ] **Step 9: Commit**

```bash
git add src/components/Timeline.tsx src/styles/military.css <test file> scripts/milspec-sp2/notes.md scripts/milspec-sp2/.baseline/
git commit -m "feat(milspec-sp2): 軽減バーを工業パイプ意匠に + ジョブチップ .cj 化（inert フック追加）"
```

- [ ] **Step 10: masaya ゲート**

「Task 6 完了。軽減の効果棒を工業パイプ（中心ロール色の ID 帯 + 下端フランジ）、アイコンを金属チップ枠、コントロールバーのジョブチップを面取りタイルに。ドラッグ・競合の琥珀リング・画面外矢印・バークリックは一切変えていない（実機で配置/移動/削除を確認済み）。モック `.mit-bar` / `.mit-lbl`（2175-2188）・`.cj`（2117）と見比べて。」

---

## Task 7: リキャスト行の独立（軍事モード限定の構造変更）

**Files:**
- Modify: `src/components/Timeline.tsx`（`themeStyle` 購読 + リキャスト帯の条件付きマウント + スクロール同期対象追加 + syncPadding 追加）
- Modify: `src/styles/military.css`（SP2 節に追記）
- Create: `src/components/__tests__/Timeline.recastBand.milspec.test.tsx`
- Modify: `src/locales/{ja,en,zh,zh-Hant,ko}.json`

**Interfaces:**
- Consumes: `useThemeStore`（`themeStyle`）。`RecastRow`（変更なし・Fragment を返す）。`handleScrollSync` / `syncPadding` / `scrollSyncTargets`（Timeline.tsx 内）。
- Produces: 軍事モードのとき `[data-milspec-recast-band]`（ルート）> `#timeline-recast-inner`（横スクロール同期対象）> `.milspec-rc-label`（左ラベル） + `<RecastRow>`。標準モードでは `<RecastRow>` は従来どおり `#timeline-header-inner` 内。

- [ ] **Step 1: DOM 契約テストを書く（失敗させる）**

`Timeline.recastBand.milspec.test.tsx`:
```tsx
// @vitest-environment happy-dom
// 軽減を1個以上持つプランで Timeline を render。
describe('リキャスト帯（軍事モード）', () => {
  it('themeStyle=military のとき、リキャストはヘッダー外の独立帯に出る', () => {
    // useThemeStore を themeStyle:'military' でセット
    // window.innerWidth を 1489 に（!isMobileTimeline）
    // render(<Timeline />)
    const band = container.querySelector('[data-milspec-recast-band]');
    expect(band).not.toBeNull();
    expect(band!.querySelector('#timeline-recast-inner')).not.toBeNull();
    expect(band!.querySelector('.milspec-rc-label')).not.toBeNull();
    expect(band!.querySelectorAll('.recast-cell').length).toBeGreaterThan(0);
    // ヘッダー内には recast-cell が無い
    expect(container.querySelector('#timeline-header-inner .recast-cell')).toBeNull();
  });
  it('themeStyle=standard のとき、リキャストは従来どおりヘッダー内', () => {
    // themeStyle:'standard'
    expect(container.querySelector('[data-milspec-recast-band]')).toBeNull();
    expect(container.querySelector('#timeline-header-inner .recast-cell')).not.toBeNull();
  });
});
```
**executor は既存の Timeline テストがどう store をセットアップしているか確認**（`src/**/__tests__/` で `Timeline` を render しているテストを探す。無ければ `useMitigationStore` / `usePartyStore` / `usePlanStore` / `useThemeStore` の最小セットアップを組む）。happy-dom で `window.innerWidth` を 1489 にする。

- [ ] **Step 2: 実行して失敗を確認**

Run: `npx vitest run src/components/__tests__/Timeline.recastBand.milspec.test.tsx`
Expected: FAIL（`[data-milspec-recast-band]` が null）

- [ ] **Step 3: i18n キー追加（5 言語）**

`src/locales/{ja,en,zh,zh-Hant,ko}.json` の `timeline` ブロックに（既存 `recast_row` サブオブジェクトがあれば追記・`feedback_locale_json_textual_edit` = 該当ブロックのみ textual 編集）:
```json
"recast_row": {
  "label": "リキャスト",        // ja
  "show": "リキャスト表示",       // 既存 or 追加
  "hide": "リキャスト非表示"      // 既存 or 追加
}
```
- en: `"label": "Recast"`, `"show": "Show recast"`, `"hide": "Hide recast"`
- zh: `"label": "复唱"`（管理画面用語対応表 `feedback_game_mechanics_source_currency` / `project_housing_gameterms_admin_glossary` に相当語があれば準拠。無ければ暫定 `"复唱时间"` 等・executor が既存 zh ロケールの類似語に合わせる）
- zh-Hant: `"label": "復唱"`
- ko: `"label": "리캐스트"`
mockup の大英字 "RECAST" は装飾 → CSS の `::before` で固定英字を重ねる（キーにしない・Global Constraint 8）。

- [ ] **Step 4: `Timeline.tsx` に `themeStyle` 購読 + `isMilspecTable` 派生値**

`useThemeStore` の既存 import（15 行）を使い、コンポーネント本体（662 行〜）で:
```tsx
const themeStyle = useThemeStore(s => s.themeStyle);
const isMilspecTable = themeStyle === 'military' && !isMobileTimeline;
```
`isMobileTimeline` は 758 行で定義済（`window.innerWidth < 768`）。

- [ ] **Step 5: リキャスト帯 ref + マウント分岐**

- ref 追加（`recastRowRef` の近く・1418 行付近）:
  ```tsx
  const recastBandInnerRef = useRef<HTMLDivElement>(null);
  ```
- `#timeline-header-inner` 内の `<RecastRow ... />`（3062-3067 行）を条件分岐:
  ```tsx
  {!isMilspecTable && (
    <RecastRow ref={recastRowRef} partyMembers={visiblePartyMembers} placements={timelineMitigations} mitigationDefs={MITIGATIONS} />
  )}
  ```
- `headerRef` の div（2948-3069）の**直後**、`<MyJobHighlightAttrBridge>`（3072）の前に:
  ```tsx
  {isMilspecTable && (
    <div data-milspec-recast-band className={clsx("flex-shrink-0 relative overflow-hidden", !recastRowVisible && "hidden")}>
      <div id="timeline-recast-inner" ref={recastBandInnerRef} className="flex items-center h-full w-max min-w-max will-change-transform">
        <div className="milspec-rc-label flex-none flex items-center" style={{ width: 'var(--col-member-start)' }}>
          {t('timeline.recast_row.label')}
        </div>
        <RecastRow ref={recastRowRef} partyMembers={visiblePartyMembers} placements={timelineMitigations} mitigationDefs={MITIGATIONS} />
      </div>
    </div>
  )}
  ```
  （`--col-member-start` = phase+label+time+mechanic+counter+counter = リキャストセルの開始 x。ラベルがこの幅を占めれば `.recast-cell` が正しい x に揃う。`recastRowVisible` OFF で帯ごと `hidden`。）

- [ ] **Step 6: 横スクロール同期対象に追加**

`handleScrollSync`（1469-1494）の `scrollSyncTargets`（1480-1481）を:
```tsx
const scrollSyncTargets = [
  { ref: headerRef, id: 'timeline-header-inner', cacheKey: 'header' as const },
  { ref: controlBarRef, id: 'timeline-controls-inner', cacheKey: 'controls' as const },
  ...(isMilspecTable ? [{ ref: recastBandInnerRef, id: 'timeline-recast-inner', cacheKey: 'recast' as const }] : []),
];
```
`cacheKey` の型 union に `'recast'` を追加（該当の型定義を grep）。`handleScrollSync` が `useCallback` なら deps に `isMilspecTable` を追加。

- [ ] **Step 7: `syncPadding` に追加**

`syncPadding`（1509-1520）で `controlBarRef` に `paddingRight` を当てている箇所の隣に:
```tsx
if (isMilspecTable && recastBandInnerRef.current) {
  recastBandInnerRef.current.style.paddingRight = `${scrollbarWidth}px`;
}
```
`syncPadding` の `useEffect` deps に `isMilspecTable` を追加（分岐で対象が増減するため）。

- [ ] **Step 8: リキャスト帯 CSS（mockup .recast-row/.rc-label 1277-1300）**

```css
/* ---------- Task 7: リキャスト帯（mockup .recast-row 1277-1300・軍事モード限定の独立行） ---------- */
.theme-military [data-milspec-recast-band] {
  flex-shrink: 0; position: relative; z-index: 2; min-height: 34px;
  background: linear-gradient(180deg, var(--ms-recess-hi), var(--ms-recess-lo));
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.4);
}
.theme-military .milspec-rc-label {
  padding-left: calc(var(--col-header-chunk-w) + var(--col-mechanic-w) - 60px); /* mockup: rc-label padding-left 151px 相当を実列に合わせる。executor が実測で微調整 */
  font: 700 8px/1 'Share Tech Mono', monospace; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--ms-text-muted); opacity: 0.55;
}
.theme-military .milspec-rc-label::before { /* 大英字 RECAST の装飾（固定・翻訳外） */
  content: "RECAST "; opacity: 0.7; letter-spacing: 0.24em;
}
/* .recast-cell（Task 4 で #timeline-header-inner > * が当たっていた分）は帯に移ったので
   Task 4 の :not(.recast-cell) 除外を外してよい（帯側では別意匠）。 */
.theme-military [data-milspec-recast-band] .recast-cell { /* mockup .rc-cell 1290 */ }
.theme-military [data-milspec-recast-band] .recast-icon,
.theme-military [data-milspec-recast-band] .recast-cell > * { /* mockup .rc-icon 1291-1300 の円形・clockswipe 意匠。実 RecastIcon のクラスを確認 */ }
```
**executor は `RecastIcon.tsx` の実クラス名を確認**してアイコン意匠を当てる（clockswipe は実アプリが `--cd-angle` で既に持っている → 見た目だけ寄せる）。

- [ ] **Step 9: Task 4 の recast 除外を外す**

Task 4 で `#timeline-header-inner > *:not(.recast-cell)` にしていた箇所を、Task 7 完了後は recast-cell がヘッダーに居ない（軍事モード時）ので `:not(.recast-cell)` を残しても害はないが、意図を明確にするためコメント更新。標準モードでは recast-cell がヘッダーに残る → `:not(.recast-cell)` は**残す**（標準モードのヘッダー recast セルにブラケットタイルを付けない = 標準は `.theme-military` 前置なので元々当たらない・確認のみ）。

- [ ] **Step 10: テスト + ハーネス + ビルド**

Run: `npx vitest run src/components/__tests__/Timeline.recastBand.milspec.test.tsx && node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs && npm run build`
Expected: 全部 exit 0。
- **標準不変**: `themeStyle` 未設定なら `isMilspecTable === false` → 全分岐が else → `[data-milspec-recast-band]` 無し・recast はヘッダー内・`scrollSyncTargets` 2 要素・`syncPadding` 従来通り。ベースライン一致。
- **military-smoke**: Step 8（横スクロール）でリキャスト帯 inner も `translateX` 追従。Step 9（縦スクロール）で `.recast-num` 更新。Step 6（リキャストトグル）で帯が消える/出る。

- [ ] **Step 11: Playwright ジオメトリ assert を military-smoke に追加**

軍事モードで:
- `[data-milspec-recast-band]` の `getBoundingClientRect().top` が `#timeline-header-inner` の bottom 以上・`.timeline-scroll-container` の top 以下（＝ヘッダーと本体の間）。
- `[data-milspec-recast-band] .recast-cell` の先頭の `left` が、同じメンバーの `#timeline-header-inner` のメンバー列位置（or `MitigationItem` の列 x）と ±2px 一致。
- 横スクロール 300px 後、`#timeline-recast-inner` の `transform` が `#timeline-header-inner` と同じ。

- [ ] **Step 12: Commit**

```bash
git add src/components/Timeline.tsx src/styles/military.css src/components/__tests__/Timeline.recastBand.milspec.test.tsx src/locales/ scripts/milspec-sp2/
git commit -m "feat(milspec-sp2): リキャスト行を軍事モード限定で独立帯に切り出し（左ラベル + スクロール同期）"
```

- [ ] **Step 13: masaya ゲート**

「Task 7 完了。軍事モードのとき、リキャストアイコンを列見出しの中から出して「左に RECAST / リキャスト ラベル + 1 行ぶんの帯」に独立させた。中身（アイコンの常駐・クールダウン円グラフ・残秒）は一切変えていない。標準モードは従来どおり見出し内同居。横スクロール・縦スクロールでの追従、リキャスト表示トグルでの開閉を実機確認済み。モック `.recast-row`（2151-2168）と見比べて。」

---

## Task 8: 計器スクロールバー（表 + サイドバー共有）

**Files:**
- Modify: `src/styles/military.css`（SP2 節に追記）
- Modify: `src/components/Timeline.tsx`（`themeStyle` 変化時に `syncPadding()` を 1 回呼ぶ `useEffect`・**それだけ**）
- Modify: `src/components/military/MilspecContentTree.tsx` or `MilspecSidebar.tsx`（スクロール要素に `scrollbar-width` が残っていれば除去・共有クラス付与）

**Interfaces:**
- Consumes: 既存 `.timeline-scroll-container` / `src/index.css:1629` の縦バー非表示ルール。SP1 の `--ms-cyan(-glow)`。
- Produces: `.theme-military` 時のみ縦横スクロールバーが計器意匠で可視。共有クラス `.milspec-gauge-scroll`（or 直接セレクタ）。

- [ ] **Step 1: `scrollbar-width` の残存を全数確認**

Run: `grep -rn "scrollbar-width" src/`
既知（前提知識より）: `src/index.css:537`（`.no-scrollbar`）、`src/components/MobileFab.tsx` / `PipView.tsx`（inline style・スコープ外）、`housing.css`（スコープ外）。
**確認事項**: `.timeline-scroll-container` と MIL-SPEC サイドバーのスクロール要素（`MilspecContentTree` の `overflow-y-auto` を持つ div）に `scrollbar-width` / `.no-scrollbar` クラスが**付いていない**こと。付いていたら Chrome 121+ が `::-webkit-scrollbar` を無視する（`project_sf_military_theme` 追記 10 の既知ハマり）。結果を `notes.md`。

- [ ] **Step 2: 縦スクロールバー可視化 + 計器意匠（mockup .tbody::-webkit-scrollbar 1220-1237）**

```css
/* ---------- Task 8: 計器スクロールバー（mockup 1200-1275） ---------- */
/* 本番 src/index.css:1629 の「.timeline-scroll-container 縦バー width:0」を軍事モードだけ解除。
   ::-webkit-scrollbar 疑似要素は詳細度の高いセレクタが勝つ。 */
.theme-military .timeline-scroll-container::-webkit-scrollbar:vertical { width: 14px; display: block; }
.theme-military .timeline-scroll-container::-webkit-scrollbar:horizontal { height: 14px; display: block; }
.theme-military .timeline-scroll-container::-webkit-scrollbar-track {
  background:
    repeating-linear-gradient(180deg, rgba(130,204,223,0.22) 0 1px, transparent 1px 6px),
    repeating-linear-gradient(180deg, rgba(130,204,223,0.42) 0 1.5px, transparent 1.5px 24px),
    linear-gradient(90deg, #1b232a, #10161b);
  box-shadow: inset 3px 0 6px rgba(0,0,0,0.6), inset -1px 0 0 rgba(255,255,255,0.04);
}
.theme-military .timeline-scroll-container::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, #232b33, #4b5763 45%, #5c6975 50%, #4b5763 55%, #232b33);
  border-radius: 1px; border: 3px solid transparent; background-clip: padding-box;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 2px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.5);
}
.theme-military .timeline-scroll-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(90deg, #263039, #5c6975 45%, var(--ms-cyan) 50%, #5c6975 55%, #263039);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 0 8px var(--ms-cyan-glow), 0 0 0 1px rgba(0,0,0,0.5);
}
.theme-military .timeline-scroll-container::-webkit-scrollbar-thumb:active { filter: brightness(0.88); }
.theme-military .timeline-scroll-container::-webkit-scrollbar-corner { background: #10161b; }
/* 横向きは track の repeating を 90° に（別ルールで上書き） */
.theme-military .timeline-scroll-container::-webkit-scrollbar-track:horizontal {
  background:
    repeating-linear-gradient(90deg, rgba(130,204,223,0.22) 0 1px, transparent 1px 6px),
    repeating-linear-gradient(90deg, rgba(130,204,223,0.42) 0 1.5px, transparent 1.5px 24px),
    linear-gradient(180deg, #1b232a, #10161b);
}
```
**light は `.theme-military.theme-light` で track/thumb の色を上書き**（SP2 後の統一調整で最終化・ここは破綻しない程度）。

- [ ] **Step 3: 静的目盛りキャップ（mockup .gauge-cap 1208-1219）**

ヘッダー（`#timeline-header-inner`）とリキャスト帯（`[data-milspec-recast-band]`）の右端に、スクロールバー track と同じ目盛りピッチの静的縦帯を `::after` で:
```css
.theme-military #timeline-header-inner::before,   /* ::after は Task 4 で使用済 → ::before を使う */
.theme-military [data-milspec-recast-band]::after {
  content: ""; position: absolute; right: 0; top: 0; bottom: 0; width: 14px; z-index: 3; pointer-events: none;
  background:
    repeating-linear-gradient(180deg, rgba(130,204,223,0.22) 0 1px, transparent 1px 6px),
    repeating-linear-gradient(180deg, rgba(130,204,223,0.42) 0 1.5px, transparent 1.5px 24px),
    linear-gradient(90deg, rgba(0,0,0,0.4) 0 3px, transparent 3px 4px, transparent),
    linear-gradient(90deg, #1b232a, #10161b);
}
```
（`#timeline-header-inner` の `::before` が Task 4 で未使用か確認。使用済なら小要素を 1 個足すか、Task 4 の隅ブラケットを box-shadow に寄せて疑似要素を空ける。executor 判断。目盛りピッチ（`6px` / `24px`）を Step 2 の track と厳密に一致させる。）

- [ ] **Step 4: `themeStyle` 変化時の `syncPadding` 再実行**

`Timeline.tsx` に `useEffect` を 1 個追加（`syncPadding` が参照できるスコープで・1509 付近の下）:
```tsx
useEffect(() => {
  // themeStyle 変化でスクロールバーが出現/消滅 → padding 補正を測り直す。
  const id = requestAnimationFrame(() => syncPadding());
  return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [themeStyle]);
```
`syncPadding` が `useEffect` 内のローカル関数なら、共通化 or その `useEffect` の deps に `themeStyle` を足す形にする（executor が既存構造を見て最小変更を選ぶ）。

- [ ] **Step 5: サイドバー共有**

`MilspecContentTree`（or `MilspecSidebar`）のスクロール要素に同じ意匠。mockup `.phases::-webkit-scrollbar`（1260-1275）はやや細身（10px）:
```css
.theme-military .milspec-content-tree-scroll::-webkit-scrollbar { width: 10px; }   /* 実クラス名は実 DOM 確認 */
.theme-military .milspec-content-tree-scroll::-webkit-scrollbar-track { /* mockup .phases track */ }
.theme-military .milspec-content-tree-scroll::-webkit-scrollbar-thumb { /* 同 thumb */ }
```
Step 1 で `scrollbar-width` が付いていたら**その要素から除去**（SP1 の実装なので触ってよい・標準サイドバーには影響しない）。

- [ ] **Step 6: ハーネス + ビルド**

Run: `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs && npm run build`
Expected: 全部 exit 0。
- **標準不変**: 縦バー幅は標準で 0 のまま（`standard-invariance.mjs` の「縦スクロールバー幅 = 0」チェックが PASS）。
- **military-smoke**: 追加 assert — 軍事モードで `.timeline-scroll-container` の `offsetWidth - clientWidth` が > 0（≈14px）。`#timeline-header-inner` の `paddingRight` がそのバー幅と一致（syncPadding 動作）。横スクロール後もヘッダー/コントロールバー/リキャスト帯が本体とズレない。

> ⚠ headless Chromium はオーバーレイ系スクロールバー（幅 0）を返す環境がある（`project_sf_military_theme` 追記 11・trace-workflow 追記 15/16）。その場合 Playwright では `offsetWidth - clientWidth` が 0 になり assert が失敗しうる → スクリプトに「headless で幅 0 なら WARN でスキップ・masaya の実機 Chrome で確認」とフォールバックを入れる。CSS 構文・レイアウト補正の正しさ（`syncPadding` の呼び出し）だけ機械確認。

- [ ] **Step 7: Commit**

```bash
git add src/styles/military.css src/components/Timeline.tsx src/components/military/ scripts/milspec-sp2/
git commit -m "feat(milspec-sp2): 計器スクロールバー — 軍事モードで縦バー可視化 + 目盛り意匠 + サイドバー共有"
```

- [ ] **Step 8: masaya ゲート**

「Task 8 完了。軍事モードのとき、隠していたタイムライン縦スクロールバーを目盛り + ブラシメタルの計器バーとして表示。横バーも同意匠。ヘッダー/リキャスト帯の右端に静的な目盛りキャップを置いて「1 本貫通する計器」に。同じ意匠を MIL-SPEC サイドバーにも。⚠ 私の環境（headless）ではスクロールバーの実描画が確認できないので、**実機 Chrome で**モック（`.tbody::-webkit-scrollbar` の目盛り + スライダー）と見比べて。`scrollbar-width` の残存が無いことは確認済み。標準モードは隠れたまま。」

---

## Task 9: ワークスペース外装デカール + フェーズ/ラベルオーバーレイ仕上げ

**Files:**
- Modify: `src/styles/military.css`（SP2 節に追記）
- Modify: `src/components/military/MilspecWorkspace.tsx`（`.milspec-pl` スジ彫り等の小要素が足りなければ追加）

**Interfaces:**
- Consumes: SP1 の `.milspec-bolt` / `.milspec-sc` / `.milspec-hash` / `.milspec-pl`（既存プリミティブ）。
- Produces: なし（既存プリミティブの配置と CSS）。

- [ ] **Step 1: mockup `.workspace` 外装の要素を洗い出す**

mockup DOM 2123-2128: `.bolt`×4 / `.sc` "WKS-07"（左）・"RAID OPERATIONS PLOT · MITIGATION ARRAY"（右）/ `.hash`（左下）/ `.pl.h`（上・`opacity:.5`）。`MilspecWorkspace.tsx` の現状（前提知識）と突き合わせ、**足りないのは `.pl.h`（上端のスジ彫り）だけ**か確認。Task 2 で `.ws-cap` / `.ws-note` は追加済。

- [ ] **Step 2: 足りない要素を追加**

```tsx
// MilspecWorkspace.tsx・.milspec-ws の子
<span className="milspec-pl h" style={{ left: 16, right: 16, top: 6, opacity: 0.5 }} aria-hidden />
```
mockup 2128 と同じ。`.milspec-pl` は SP1 実装済プリミティブ。`.h`（水平スジ彫り）の variant があるか確認（`project` trace-workflow で `.milspec-pl.h` の「水平スジ彫り線省略」と punch-list にあり → `.h` variant が未実装なら `military.css` に追加）。

- [ ] **Step 3: フェーズ/ラベルオーバーレイ意匠（Task 3 Step 4 で保留した分）**

`[data-phase-overlay]` / `[data-label-overlay]` を沈みスクリーン上で読める金属バンドに。SP1 サイドバーの `phase-tag` 語彙（`Share Tech Mono` + `--ms-stencil` + ヘアライン罫）と揃える。

- [ ] **Step 4: ハーネス + ビルド**

Run: `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs && npm run build`
Expected: 全部 exit 0。

- [ ] **Step 5: Commit**

```bash
git add src/components/military/MilspecWorkspace.tsx src/styles/military.css
git commit -m "feat(milspec-sp2): ワークスペース外装スジ彫り + フェーズ/ラベルオーバーレイ意匠"
```

- [ ] **Step 6: masaya ゲート**

「Task 9 完了。装甲板上端のスジ彫り、フェーズ/ラベルの帯を金属バンドに。モック `.workspace`（2123-2128）+ フェーズ帯と見比べて。」

---

## Task 10: i18n 検証 + 3 ビューポート + push 前ゲート + whole-branch 敵対レビュー

**Files:**
- Modify: `src/locales/{ja,en,zh,zh-Hant,ko}.json`（不足キー補完）
- Modify: `docs/TODO.md`（現在の状態を更新）
- Modify: `docs/superpowers/specs/2026-09-09-milspec-sp2-table-design.md`（§13 未確定の決着を追記）

**Interfaces:**
- Consumes: Task 1-9 の成果全部。
- Produces: SP2 完了状態。

- [ ] **Step 1: i18n 全数チェック**

- SP2 で追加/使用した全キー（`timeline.recast_row.*` 他）が ja/en/zh/zh-Hant/ko の 5 ファイル全てに存在するか。
  Run: 既存の locale 整合チェックスクリプトがあれば実行（`grep -rn "i18n\|locale" scripts/` で探す）。無ければ 5 ファイルで該当キーを目視 grep。
- 英語モードで `/miti` 軍事表示 → リキャスト帯ラベル "RECAST Recast" 等がはみ出さないか Playwright スクショ（masaya ゲートで確認）。
- zh / zh-Hant / ko でリキャスト帯ラベルが崩れないか。

- [ ] **Step 2: 3 ビューポート検証**

`military-smoke.mjs` を viewport `1489x900` / `1920x1080` / `2560x1440` で回すバリアント（`--viewport` 引数）。各で:
- body に横スクロールバーが出ない。
- コントロールバー / ヘッダー / リキャスト帯 / 表 / 軽減バーの列が揃う（`#timeline-header-inner` のメンバー列 x と `MitigationItem` の列 x が ±2px）。
- コンソールエラー 0。

Run: `node scripts/milspec-sp2/military-smoke.mjs --viewport 1489x900 && ... 1920x1080 && ... 2560x1440`
Expected: 全部 exit 0。

- [ ] **Step 3: push 前フルゲート**

Run: `npm run build`
Expected: exit 0（tsc -b 厳密・`feedback_vercel_tsc_strict`）

Run: SP2 で触れた/関連する vitest を対象実行:
`npx vitest run src/components/military/ src/components/__tests__/Timeline.recastBand.milspec.test.tsx src/components/__tests__/MitigationItem.milspec.test.tsx`
（フルスイートは vmThreads ハング既知 `reference_vitest_vmthreads_hang` → 対象を絞る。`feedback_test_run_cost_discipline`）
Expected: 全緑。

Run: `node scripts/milspec-sp2/standard-invariance.mjs`（最終・dark/light）
Expected: exit 0 = SP2 全体で標準モードが `main`（= SP2 着手前ベースライン）と完全一致。

- [ ] **Step 4: whole-branch 敵対レビュー**

fresh context のサブエージェント（`requesting-code-review` skill or `Explore`/`general-purpose` agent）に SP2 の全 diff（`git diff <SP2 開始コミット>..HEAD`）を渡してレビュー依頼。観点:
- 標準モード不変が本当に守られているか（`Timeline.tsx` の分岐が `isMilspecTable === false` で完全に元パスか）。
- `handleScrollSync` / `syncPadding` の変更が標準モードで no-op か。
- `data-mit-bar` / `data-mit-icon` / `data-milspec-recast-band` が標準 CSS に一切拾われないか。
- CSS の `!important` 濫用・`.theme-military` 前置漏れ・`clip-path: path()` / `backdrop-filter: blur()` リテラルの混入（css-rules.md 違反）。
- `pointer-events` / `cursor` を CSS で殺して編集操作を壊していないか。

**採用するのは正しさに関わる指摘だけ**（過剰防御は逆コスト・`CLAUDE.md`）。指摘対応は個別コミット。

- [ ] **Step 5: spec の未確定を決着**

`docs/superpowers/specs/2026-09-09-milspec-sp2-table-design.md` §13 の各項目に、実装で確定した答えを追記（`nth` の当て方 / ロール色の引き方 / 致命セルの扱い / `RecastRow` 据え置き可否 / `military.css` 動的 import の判断 等）。

- [ ] **Step 6: TODO.md 更新**

`docs/TODO.md` の「現在の状態」の SP2 行を「SP2 実装完了・masaya 全ゾーン承認・次 = SP2 後の統一見た目調整（フォント/余白/立体感/ロールカウンター/fp-inst 幅）」に。行数 100 以内を確認（`wc -l docs/TODO.md`）。

- [ ] **Step 7: Commit**

```bash
git add src/locales/ docs/TODO.md docs/superpowers/specs/2026-09-09-milspec-sp2-table-design.md scripts/milspec-sp2/
git commit -m "chore(milspec-sp2): i18n 5言語補完 + 3ビューポート検証 + spec 未確定の決着"
```

- [ ] **Step 8: masaya 最終ゲート**

全ゾーン（ワークスペース外装 / コントロールバー / ヘッダー / リキャスト帯 / 表本体・行・セル / 軽減バー / ジョブチップ / スクロールバー）をモックと突き合わせて最終承認。dark / light 両方。英 / 中 / 韓の表示崩れが無いか。

「SP2 完了報告: 軍事版の表が構造として立ち上がり、全編集機能（配置/移動/削除・共同編集・折りたたむ・AA・メモ・リキャスト・フェーズジャンプ・横スクロール）が動く。標準モードは `main` と完全一致（自動検証済）。フォント・余白・立体感の最終数値は次の統一調整フェーズ。マージするか、SP3（スマホ）着手まで branch 保持か指示ください。」

---

## Self-Review（プラン作成者による・spec との突き合わせ）

**1. Spec coverage:**

| spec §1.1 の項目 | 対応タスク |
|---|---|
| 1 `MilspecWorkspace` 内層（二層） | SP1 で `.milspec-ws-screen` 実装済 + Task 3（沈みスクリーン強化）+ Task 9（外装） |
| 2 コントロールバー塗り替え | Task 5 |
| 3 表ヘッダー ブラケットタイル | Task 4 |
| 4 リキャスト行の独立 | Task 7 |
| 5 表本体 スラット/ゼブラ/致命セル | Task 3 |
| 6 軽減バー 工業パイプ | Task 6 |
| 7 ジョブチップ `.cj` | Task 6 |
| 8 計器スクロールバー（可視化 + 共有） | Task 8 |
| 9 ワークスペース外装デカール | Task 2（`.ws-cap`/`.ws-note`）+ Task 9（スジ彫り/オーバーレイ） |
| 10 i18n 5 言語 | Task 7（キー追加）+ Task 10（全数検証） |
| spec §10 標準不変検証 | Task 1（ハーネス）+ 全タスクで再実行 + Task 10（最終）+ Task 10 Step 4（敵対レビュー） |
| spec §10 視覚忠実度 masaya ゲート | 全タスクの最終 Step |

漏れなし。

**2. Placeholder scan:** CSS の詳細値で「mockup 行番号を見て確定」に委ねている箇所が複数ある（例: Task 3 の致命セル判定、Task 4 の hd-hash、Task 6 のロール色）。これは spec が「正典 = mockup・最終値は SP2 後の統一調整」と定めているため**意図的**。各該当 Step に「executor が実 DOM / mockup を確認して確定」と明記し、確定結果を `notes.md` / spec §13 に残す手順を入れてある。純粋な「TODO / TBD」は無い。

**3. Type consistency:**
- `isMilspecTable`（Task 7 で定義）を Task 7・Task 8 で一貫使用。
- `recastBandInnerRef` / `#timeline-recast-inner` / `[data-milspec-recast-band]` / `.milspec-rc-label` — Task 7 で定義、Task 8 で `[data-milspec-recast-band]::after` を参照。一致。
- `data-mit-bar` / `data-mit-icon` — Task 6 で定義、以降参照なし（CSS のみ）。一致。
- `scrollSyncTargets` の `cacheKey` union に `'recast'` 追加（Task 7 Step 6）— 既存 `'header'` / `'controls'` と同じ型。
- `scripts/milspec-sp2/standard-invariance.mjs` / `military-smoke.mjs` / `.baseline/` / `notes.md` — Task 1 で定義、全タスクで一貫参照。

**4. 追加確認:**
- Task 4 と Task 7 の順序依存（Task 4 の `:not(.recast-cell)` を Task 7 で解説）を両タスクに明記済。
- Task 8 の headless スクロールバー問題を Step 6 の WARN フォールバック + masaya 実機ゲートで回避。
- `military.css` 肥大（動的 import）は Task 10 Step 5 で判断（別タスク化も可）と明記。
