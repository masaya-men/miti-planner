# MIL-SPEC 構造リビルド — SP2: タイムライン表の軍事化 — 設計書

- 作成日: 2026-09-09
- ステータス: brainstorm 完了 → 本設計書レビュー → writing-plans
- 種別: architectural（埋め込んだ本番 `Timeline` に `.theme-military` 時だけの見た目レイヤーを重ね、必要最小限の構造変更を軍事モード限定で入れる。標準モードの出力・挙動は `main` と一致）
- 正典（デザイン）: `docs/.private/theme-refs/milspec-mockup.html`（masaya 手製・MAIN チェックアウトのみ。worktree に `.private/` は無いので実装者には絶対パス `c:/Users/masay/Desktop/FF14Sim/docs/.private/theme-refs/milspec-mockup.html` を渡す）。表エリアの該当箇所 = `.subtoolbar`（2088-2119）/ `.workspace`（2121-2213）/ 表・行・軽減バー・リキャスト行の CSS（966-1300）
- 前提: `docs/superpowers/specs/2026-09-08-milspec-structural-rebuild-sp1-shell-design.md`（SP1・本番マージ済 `b820358e`）/ `docs/.private/2026-09-08-milspec-sp1-punch-list.md`（SP1 積み残し・2026-09-09「細部詰めは SP2 後にまとめて」方針）
- 関連 memory: `project_sf_military_theme` / `reference_milspec_material_language` / `feedback_visual_fidelity_requires_screenshot_diff` / `feedback_dataloss_exhaustive_audit` / `feedback_evidence_based_work`

---

## 0. 一行サマリ

`themeStyle === 'military'` かつ PC のとき、SP1 の `MilspecWorkspace`（装甲板）の内側に「沈んだ画面」レイヤーを設け、その中で動く**本番の `Timeline` をモック `.workspace` / `.subtoolbar` の見た目に完全再現**する。再現は (1) `military.css` の SP2 節（全ルール `.theme-military` 前置）による見た目の差し替えが主役、(2) CSS で作れない構造差（リキャスト行の独立・計器スクロールバーの可視化）だけを軍事モード限定の小さな分岐で入れる。**`Timeline.tsx` の座標計算・状態・イベント処理・共同編集・競合判定・行間引きロジックには一切手を入れない。標準モードの `/miti` は `main` と完全一致。**

---

## 0.1 SP1 設計書との関係

SP1 §1 の SP 一覧では SP2 を「モックの固定 14 列グリッド・…作り直し・`MitigationItem` の座標計算を新グリッドに合わせて作り直し」と記述していた。**本書はこの「作り直し」方針を見直す**:

- 本番の 14 列グリッドは既に `src/index.css` の `--col-*-w` clamp トークンで実装済み（PC: `--col-phase-w` / `--col-label-w` / `--col-time-w` / `--col-mechanic-w` / `--col-counter-w`×2 / `--col-th-w` / `--col-dps-w`）。メンバー列はパーティ人数・並び順・ロール別幅で**動的**。→ 固定 14 列を新規に組むのではなく、**この動的列システムを MIL-SPEC 用の比率にチューニング**する。
- `MitigationItem` の座標計算（列 x = `memberLayout` の DOM 実測、行 y = `time * pixelsPerSecond` または `timeToYMap`）は本番のグリッドと同じ列を基準にしているため、**作り直し不要**。バーとアイコンの**見た目だけ**をモックの `.mit-bar` / `.mit-lbl` に寄せる。

SP1 §5.5 / §4.1 は「SP2 で `MilspecControlBar` を `MilspecLayout` の 5 行目のグリッド行として復活」としていた。**本書はこれを撤回**（§5 で詳述）: 本番のコントロールバー（`controlBarRef`）はボタンの並び順が既にモック `.subtoolbar` と 1 対 1 で一致し、`--col-*` 列計算と `handleScrollSync` の横スクロール同期に既に配線済み。グリッド行へ昇格させると列整列とスクロール同期の再配線・`isAaModeEnabled` / `recastRowVisible` の状態持ち上げが必要になり、視覚的な利得はゼロ（モックの `.subtoolbar` は視覚的に「表の直上の操作帯」であり、埋め込みのコントロールバーは既にその位置にある）。→ **埋め込みのまま `.theme-military` CSS で `.subtoolbar` の見た目に塗り替える。** SP1 のグリッドは 4 行のまま。

SP1 §9 で `Timeline.tsx` / `TimelineRow.tsx` から撤去した Phase 2 スキンの `data-milspec-*` フックは、SP2 で**意図的・最小限に再導入**する（§3.3）。

---

## 1. スコープ

### 1.1 SP2 がやること

| # | 対象 | 内容 |
|---|---|---|
| 1 | `MilspecWorkspace` 内層 | 装甲板の内側に「沈んだ画面」レイヤー（`.ws-screen` 相当）を追加。二層構造にする。 |
| 2 | コントロールバー（`.subtoolbar`） | 埋め込みのまま `.theme-military` CSS で塗り替え（`.cb-tgl` / `.cb-ico` / `.cb-div` / `.cj` 意匠・ランプは実 ON のみ点灯・ステンシルデカール）。 |
| 3 | 表ヘッダー（`.thead`） | ブラケット枠の金属タイル列見出し（`.th` 意匠・交互切り欠き・`.th.time` 下線・`.hd-hash`・四隅ビス・下端 muted steel ライン）。 |
| 4 | リキャスト行（`.recast-row`） | **軍事モード限定の構造変更**: 今はヘッダー内に同居しているリキャストのメンバーセルを、ヘッダーの下・表本体の上に「左ラベル `Recast / リキャスト` + 1 行ぶんの高さ」の独立帯として切り出す。中身（`RecastRow` のアイコン静的マウント + `update()` の CSS 変数直書き）は不変。 |
| 5 | 表本体（`.tbody` / `.trow` / `.td`） | 沈んだスクリーン面・行は浮いた金属スラット・4 行ごとに溝・偶数行ゼブラ・ホバーでシアン左バー・致命行（`.trow.lethal`）は「軽減後」セルが赤発光の凹みセル。列間 inset 仕切り。TIME レール（`.pl.v`）と成績仕切り（`.pl.bead.v`）のスジ彫りデカール。 |
| 6 | 軽減バー（`MitigationItem`） | 6px 効果棒を工業パイプ意匠（中心 ID 帯・下端フランジ・ロール色 `--mb-col`）に。24px アイコンを軍事チップ意匠に。ドラッグ・リサイズ・競合警告（琥珀リング）・画面外ガイド矢印はロジックも機能色も不変。 |
| 7 | ジョブチップ（`JobPickerRow`） | `.cj` 意匠（面取り 4 色ボーダー・実ジョブアイコン）に塗り替え。 |
| 8 | 計器スクロールバー（可視化 + 共有） | **軍事モード限定**: 本番で幅 0 に隠している縦スクロールバー（`src/index.css:1629`）を `.theme-military` 時だけ解除し、目盛り + ブラシメタルスライダーの計器意匠に。横スクロールバーも同じ意匠。非スクロール域（ヘッダー / リキャスト帯）に静的な `.gauge-cap` を置き「ヘッダーから表まで貫通する 1 本の計器」に見せる。同じ意匠を MIL-SPEC サイドバー（`MilspecContentTree` のスクロール領域）にも共有。 |
| 9 | ワークスペースの外装デカール | 四隅ビス・`WKS-07` / `RAID OPERATIONS PLOT · MITIGATION ARRAY` ステンシル・`.hash` 斜線束・`.pl.h` スジ彫り・`.ws-cap`（端末キャップ）・`.ws-note`（`ROSTER n / 8`）。 |
| 10 | i18n | 新規キー（リキャスト行ラベル等）を 5 言語（ja/en/zh/zh-Hant/ko）同時追加。 |

### 1.2 SP2 がやらないこと

- **フォント・余白・立体感・ロールカウンター回転ドラム・`fp-inst` 幅・SCENARIO/ツリー役割整理 の最終詰め** → SP2 後にシェル + 表をまとめて 1 回で調整（2026-09-09 masaya 方針・punch-list）。SP2 の各部品は「モックの構造・意匠を再現し機能が動く」まで。最終的な数値（フォント px・gap・relief）は SP2 完了後の統一調整フェーズで CSS 変数として確定。
- **スマホの軍事レイアウト** → SP3。SP2 は PC 限定（`!isMobileTimeline`）。スマホは標準にフォールバック。
- **パーティ編成 / ステータス設定 / イベント追加 / 軽減追加モーダルの軍事化** → SP4。SP2 では標準テーマで開く。
- **表エリアのポップアップ**（敵の攻撃検索 `mechanicSearchOpen` / フェーズドロップダウン `phaseDropdownOpen` / ラベルドロップダウン `gimmickDropdownOpen` / AA 設定ポップオーバー `aaSettingsOpen` / クリア確認ポップオーバー `clearMenuOpen` / フェーズジャンプドロップダウン / 軽減セレクタ `MitigationSelector`） → **標準テーマのまま**（SP1 Q5 準拠・切替わって OK）。
- **`Timeline.tsx` / `TimelineRow.tsx` / `MitigationItem` のロジック分解・複製・座標計算の作り直し。**
- **共有 / FFLogs 取込 / スプレッドシート取込の軍事化**（SP1 Q5・標準のまま）。

---

## 2. ブレインストーム確定事項

| # | 論点 | 確定 |
|---|---|---|
| B1 | 再現度 | **モック完全再現**（masaya「よくわかりませんが、モックの見た目を再現してください」2026-09-09）。エンジニアリング上の判断（どこを CSS で・どこを構造変更で・コントロールバーの扱い）は実装側で引き取る。正典はモック。 |
| B2 | 実装方式 | **埋め込んだ本番 `Timeline` の見た目レイヤー化**。表のロジックは丸ごと再利用。SP1 の `MilspecLayout` のような並行コンポーネントツリーは表には作らない（データ事故リスク回避 = `feedback_dataloss_exhaustive_audit`）。 |
| B3 | サイズ | SP1 Q2 = A（流動フィット）を踏襲。列幅は `--col-*-w` の clamp を MIL-SPEC 用に上書き（max=base=1489 基準）。モックの固定 px（44/40/58/200/90/98/100/62）は「比率の目標」であって固定値ではない。 |
| B4 | コントロールバー | グリッド行に昇格させない。埋め込みのまま CSS で `.subtoolbar` の見た目に。状態の持ち上げ不要。 |
| B5 | リキャスト行 | モックの「独立した帯 + 左ラベル」を再現する。これは軍事モード限定の構造変更（§4）。標準モードは今のまま（ヘッダー内同居）。 |
| B6 | 計器スクロールバー | 本番で隠している縦バーを軍事モード限定で可視化。表とサイドバーで意匠を共有。標準モードは隠れたまま。 |
| B7 | 完成ライン | 「軍事版の表が構造として立ち上がり、全編集機能が動き、ゾーンごとにモックとスクショ突き合わせで masaya が承認」まで。細部の数値詰めは SP2 後。 |

---

## 3. アーキテクチャ

### 3.1 現状のコード（2026-09-09 確認）

`src/components/Timeline.tsx`（4725 行）の PC 表示ツリー（`return` は 2687 行〜）:

```
[data-timeline-root]  (flex flex-col h-full)
 └ .glass-panel  (flex-1 flex flex-col)
    ├ .empty-liquid-glass                     … プラン未選択オーバーレイ
    ├ controlBarRef  (h-7, hidden md:block)   … #timeline-controls-inner
    │   ├ Area A: 折りたたむ (setHideEmptyRows)         → var(--col-header-chunk-w)
    │   ├ divider
    │   ├ Area B: AA追加 (isAaModeEnabled local state) + メモ (store setToolMode 'memo')  → var(--col-mechanic-w)
    │   ├ divider
    │   ├ Area C: 罫線 (showRowBorders) + リキャスト行 (recastRowVisible local state)
    │   ├ divider
    │   ├ Area D: Undo / Redo / クリア (ClearMitigationsPopover)
    │   ├ divider
    │   └ JobPickerRow  (partyMembers, handleJobIconClick)
    ├ headerRef  (h-10, hidden on mobile)     … #timeline-header-inner
    │   ├ phase header (phaseHeaderRef, phaseDropdownOpen)   → var(--col-phase-w) / collapsed var(--col-phase-collapsed-w)
    │   ├ label header (gimmickHeaderRef, gimmickDropdownOpen) → var(--col-label-w) / collapsed
    │   ├ time header (var(--col-time-w))
    │   ├ mechanic header (mechanicHeaderRef, mechanicSearchOpen)  → w-full
    │   ├ RAW header (var(--col-counter-w))
    │   ├ TAKEN header (var(--col-counter-w))
    │   └ <RecastRow>  … メンバーセル (.recast-cell) を Fragment で返す。ここに同居している。
    ├ <MyJobHighlightAttrBridge> / <RecordModeAttrBridge>
    └ scrollContainerRef  (.timeline-scroll-container, overflow-y-auto md:overflow-x-auto, onScroll=handleScrollSync)
        └ 巨大 render IIFE:
           ├ phases[] → sticky フェーズラベルオーバーレイ  ([data-phase-overlay])
           ├ labels[] → ラベル帯オーバーレイ  ([data-label-overlay])
           ├ timelineMitigations[] → <MitigationItem> (絶対配置: left=memberLayout, top=timeToYMap or time*pps)
           ├ times[] → <TimelineRow> ([data-time-row], grid 列を1行で横断)  ×N
           └ <ConflictOffscreenArrows> 等
```

重要な既存メカニズム（**全部そのまま維持する**）:

- **横スクロール同期** `handleScrollSync`（1469-1494 行）: `scrollContainerRef.scrollLeft` を読み、`#timeline-header-inner` と `#timeline-controls-inner` を `translateX(-scrollLeft)` で追従。対象は `scrollSyncTargets` 配列（1480-1481 行）。
- **スクロールバー幅補正** `syncPadding`（1509-1520 行）: `offsetWidth - clientWidth` を計り `headerRef` / `controlBarRef` の `paddingRight` に反映。`resize` とマウント時に実行。本番は縦バー幅 0 なので実質 0。
- **縦スクロールバー非表示** `src/index.css:1629`: `.timeline-scroll-container::-webkit-scrollbar:vertical { width: 0; display: none; }`（横バーは残す）。
- **リキャスト行の更新** `syncRecastRow`（1528-1560 行）: スクロール毎に現在時刻を算出し `recastRowRef.current.update(currentTime)` を呼ぶ。`RecastRow` は re-render せず CSS 変数直書き（`--cd-angle` / `--cd-display` / `--cd-order`、`.recast-num` textContent）。`hideEmptyRows` 時は `sortedTimeYRef` で Y 最近傍の時刻を逆引き。
- **行間引き** `hideEmptyRows`（store）: イベントの無い秒を詰めて表示。`timeToYMap` が実 Y を保持。折りたたむボタンで切替。
- **`MitigationItem`**（228-660 行）: 24px アイコン + 効果棒（`duration > 1` のとき `w-1.5` = 6px・`height: durationHeight`・色は `getMitigationColorClasses` の Tailwind クラス）。ドラッグ（`handlePointerDown/Move/Up`）・競合（`isConflicting` → `ring-2 ring-amber-400 animate-conflict-pulse`）・ターゲットジョブバッジ。
- **`RecastRow.tsx`**（190 行）: `partyMembers.map` で `.recast-cell`（`data-member` / `data-role` / 幅 = `getColumnCssVar(role)`）を Fragment で返す。各セル内に `<RecastIcon>` を「過去に一度でも置かれた mitigationId」ぶん静的マウント。
- **`TimelineRow.tsx`**（712 行）: 外側 `[data-time-row]` + `grid`。`data-phase-col` / `data-label-col` セル。`showRowBorders` で罫線。
- テーマ: `Timeline.tsx` は既に `useThemeStore` を import 済（`contentLanguage` を購読）。`isMobileTimeline = window.innerWidth < 768`（render 時計算・非リアクティブ）。

### 3.2 SP2 の適用方式

**3 層で当てる:**

1. **`military.css` の SP2 節（主役・全体の 8 割）** — 全ルール `.theme-military` 前置。既存の安定したセレクタ（クラス・id・data 属性）を狙って見た目を差し替える。狙えるフック（既存・SP2 で追加しない）:
   - `.theme-military .timeline-scroll-container` / `.theme-military #timeline-header-inner` / `.theme-military #timeline-controls-inner`
   - `.theme-military [data-timeline-root]` / `.theme-military [data-time-row]` / `.theme-military [data-phase-col]` / `.theme-military [data-label-col]`
   - `.theme-military .recast-cell` / `.theme-military [data-phase-overlay]` / `.theme-military [data-label-overlay]`
   - Tailwind ユーティリティで組まれた要素（コントロールバーのボタン等）は、親（`#timeline-controls-inner`）からの子孫セレクタ + 構造位置で狙う。狙いづらい箇所のみ 2 の対象。

2. **軍事モード限定の構造変更（§4 で詳述・最小限）** — `themeStyle === 'military' && !isMobileTimeline` のときだけ分岐:
   - リキャスト行をヘッダーから切り出して独立帯にする（`RecastRow` の呼び出し位置と外側の器を変える。中身は不変）。
   - その独立帯を `handleScrollSync` の同期対象と `syncPadding` の対象に条件付きで追加。
   - 縦スクロールバーの可視化は CSS だけ（`.theme-military` セレクタで `width:0` を上書き）。`syncPadding` は `offsetWidth - clientWidth` を測るので可視化後の実バー幅に自動追従する。ただし `themeStyle` 変化時に `syncPadding` を再実行するトリガーを 1 つ足す。

3. **意図的な `data-milspec-*` / 安定クラスフック（CSS で届かない所だけ・数個）** — 標準モードで無害（標準 CSS が拾わない）。候補:
   - `MitigationItem` の効果棒 div と アイコンラッパー（色が JS で決まる Tailwind クラスのため、安定した目印がないと軍事意匠を当てられない）。例: `data-mit-bar` / `data-mit-icon`。
   - 独立化したリキャスト帯のルート要素。
   - 各フックは「標準モードのレンダリング出力（computed style・挙動）が `main` と一致」を破らない（data 属性の追加は DOM 骨格・computed style・挙動を変えない）。§10 で証明。

### 3.3 標準モード不変の定義（SP1 constraint #1 の継承）

**`themeStyle` が `'military'` でないときの `/miti` のレンダリング出力（computed style・DOM 骨格・挙動）が `main` と完全一致すること。** 許容される差分:

- (a) `Timeline.tsx` に `themeStyle` の購読 1 行（既に `useThemeStore` は import 済）。
- (b) `themeStyle === 'military' && !isMobileTimeline` を条件にした分岐（リキャスト帯の器・スクロール同期対象への追加）。条件が false のとき従来と同一パス。
- (c) `MitigationItem` / リキャスト帯ルート等への inert な `data-*` 属性 or 安定クラスの付与（標準 CSS が拾わない）。
- (d) `military.css` の SP2 節追加（`.theme-military` 前置のみ・`.theme-military` クラスが `<html>` に無いとき不活性）。

上記以外は `Timeline.tsx` / `TimelineRow.tsx` / `RecastRow.tsx` / `MitigationItem` の実装に手を入れない。§10 で `main` との一致を機械検証する。

---

## 4. 軍事モード限定の構造変更（詳細）

### 4.1 リキャスト行の独立

**現状**: `RecastRow` は `headerRef`（`#timeline-header-inner`・h-10）の中、RAW/TAKEN ヘッダーの右に `.recast-cell` を並べる（メンバー列と同じ x）。左の列見出し（敵の攻撃 / Time 等）は `headerRef` の JSX が担当。「Recast / リキャスト」というラベルは無い。

**モック**（`.recast-row`・CSS 1280-1300）: `.thead` と `.tbody` の間に非スクロールの独立行。`grid-template-columns` は表と同一。`.rc-label`（"Recast / リキャスト"）が左 6 列ぶん（`grid-column: 1 / span 6`）を占有し、残り 8 列に `.rc-cell`。`min-height: 34px`。

**SP2 の実装**（軍事モード限定）:
- `themeStyle === 'military' && !isMobileTimeline` のとき、`<RecastRow>` を `headerRef` の中から出し、`headerRef` の**直後**・`scrollContainerRef` の**直前**に新しい器 `[data-milspec-recast-band]` としてマウントする。
  - 器の内側は横スクロール同期用の inner（`#timeline-recast-inner` 等）+ 左の `.rc-label`（i18n）+ 既存 `<RecastRow>`（メンバーセルの Fragment・**中身は完全に不変**）。
  - 列の左端（PH〜TAKEN の 6 列ぶん）はラベルが占有。`RecastRow` の各 `.recast-cell` は幅 = `getColumnCssVar(role)` なので、ラベルの幅 = 6 列合計（`var(--col-header-chunk-w) + var(--col-mechanic-w) + var(--col-counter-w) * 2`）に固定すればメンバーセルが自動で正しい x に揃う。
- 標準モードでは `<RecastRow>` は従来どおり `headerRef` 内に置く（分岐の else 側 = 現状のまま）。
- `recastRowVisible`（Timeline local state・トグルボタンは `.cb-c` の 2 個目）の挙動:
  - ON: 帯を表示。`syncRecastRow` が `update()` を呼ぶ（現状どおり）。
  - OFF: 帯ごと非表示（`hidden`）。モックのトグルボタンもこれ前提。`recastRowRef.current.hideAll()` は現状どおり呼ばれるが帯自体が消えるので視覚差は帯の有無。
- **横スクロール同期**: `scrollSyncTargets`（`handleScrollSync` 内 1480-1481 行）に、軍事モードのときだけ `{ ref: recastBandInnerRef, id: 'timeline-recast-inner', cacheKey: 'recast' }` を追加。標準モードでは配列は現状のまま。
- **スクロールバー幅補正**: `syncPadding`（1509-1520 行）で軍事モードのとき `recastBandInnerRef` にも `paddingRight` を反映。
- `RecastRow.tsx` 自体は**変更しない**（Fragment を返す現状の実装をそのまま使う）。器と配置だけ Timeline 側で変える。

> リキャスト帯を「独立行」にしても、`RecastRow` の核心（アイコンの静的 DOM + `update()` の CSS 変数直書きで 60fps スクロール時に re-render しない）は完全に保たれる。触るのは「どの親の下に、どんなラッパーで置くか」だけ。

### 4.2 計器スクロールバーの可視化

**現状**: `src/index.css:1629` が `.timeline-scroll-container::-webkit-scrollbar:vertical { width: 0; display: none; }`。横バーは `::-webkit-scrollbar { width: 8px; height: 8px }`（グローバル 520 行）+ `.custom-scrollbar` で薄いグレー。

**SP2 の実装**:
- `military.css` SP2 節に:
  ```css
  .theme-military .timeline-scroll-container::-webkit-scrollbar:vertical { width: 14px; display: block; }
  .theme-military .timeline-scroll-container::-webkit-scrollbar-track { /* モック .tbody::-webkit-scrollbar-track の目盛り意匠 */ }
  .theme-military .timeline-scroll-container::-webkit-scrollbar-thumb { /* ブラシメタルスライダー */ }
  .theme-military .timeline-scroll-container::-webkit-scrollbar:horizontal { height: 14px; /* 同意匠を 90° */ }
  ```
- `.custom-scrollbar` クラスがコンテナに付いているが、`::-webkit-scrollbar` の疑似要素は最も詳細度の高いセレクタが勝つので `.theme-military .timeline-scroll-container::-webkit-scrollbar` で上書き可能。
- **⚠ `scrollbar-width` チェック**: Chrome 121+ は要素に `scrollbar-width`（標準プロパティ）が指定されていると `::-webkit-scrollbar` 系を無視する（trace-workflow 追記 16 の既知ハマり）。`.timeline-scroll-container` および MIL-SPEC サイドバーのスクロール要素に `scrollbar-width` が残っていないか実装前に grep 確認。`.no-scrollbar` クラス（`scrollbar-width: none`・536 行）が付いていないことも確認。
- **`syncPadding` の再実行**: 現状は `resize` とマウントのみ。`themeStyle` 変化でバーが出現/消滅するので、`themeStyle` を deps に含む `useEffect` で `syncPadding()` を 1 回呼ぶ（rAF 1 フレーム後 = レイアウト確定後）。標準 → 軍事、軍事 → 標準の両方向。
- **非スクロール域の静的キャップ**: ヘッダー（`#timeline-header-inner` の右端）とリキャスト帯の右端に、モック `.gauge-cap`（目盛りだけの静的縦帯 + 縦書き "SCR"）を疑似要素 or 小要素で置く。ヘッダー〜表で目盛りが縦に連続して「1 本の計器」に見えるよう、目盛りピッチをスクロールバー track と揃える。

### 4.3 計器スクロールバーのサイドバー共有

- MIL-SPEC サイドバー（SP1 で実装した `MilspecContentTree` / `MilspecSidebar`）のスクロール領域に、同じ `military.css` の計器スクロールバー意匠を適用（モック `.phases::-webkit-scrollbar`・やや細身 10px）。
- SP1 punch-list の「未使用 CSS 約 28 個」に weathering 一式等があるが、スクロールバー関連の未使用宣言があれば SP2 でこの共有意匠に集約。
- 実装前に `MilspecContentTree` / `MilspecSidebar` のスクロール要素の現状（クラス・`scrollbar-width` の有無・`overflow` 指定）を確認してから当てる（`feedback_evidence_based_work`）。

---

## 5. コントロールバーの再現（`.subtoolbar`）

**変更しない**: DOM 構造・ボタンの並び・状態・イベントハンドラ・`handleScrollSync` への配線・列幅計算。

**`military.css` SP2 節で塗り替える**（`#timeline-controls-inner` 子孫を狙う）:

| モック | 実 DOM | 意匠 |
|---|---|---|
| `.subtoolbar` 背景 | `controlBarRef`（`bg-app-surface2 border-b h-7`） | raised プレート + `var(--zone-edge)` 溝 + 下端 muted steel ライン |
| `.cb-a` 折りたたむ（`.cb-tgl.on` + `.lamp lit cyan`） | Area A のボタン（`hideEmptyRows` false で `bg-app-toggle`） | ロッカートグル意匠 + 左端ランプ（`!hideEmptyRows` のとき点灯） |
| `.cb-div` | Area 間の `w-[1px] h-3` divider | V 断面のスジ彫り仕切り |
| `.cb-b` AA追加 / メモ（`.cb-tgl` + `.lamp`） | Area B の 2 ボタン（`isAaModeEnabled` / `isMemoMode` で `bg-app-toggle`） | 同ロッカー意匠・ランプは ON のときだけ点灯 |
| `.cb-c` 罫線 / リキャスト行（`.cb-ico.on` / `.cb-ico`） | Area C の 2 ボタン（`showRowBorders` / `recastRowVisible`） | 極小キートップ（`.cb-ico`）・ON は左端シアン inset |
| `.cb-d` Undo / Redo / クリア（`.cb-ico` / `.cb-ico.danger`） | Area D の 3 ボタン | 同キートップ・クリアは hover で赤 |
| `.cb-e` ジョブチップ（`.cj` × 8） | `<JobPickerRow>` | §7 |
| `.hash` / `.sc` "ENGAGEMENT TIMELINE CONTROL · SEC-2" | （実 DOM に無い） | 疑似要素で右端に装飾追加 |

ランプ（`.lamp`）は SP1 で `military.css` に実装済のプリミティブを流用。「渋い」= 点灯は実際に ON の機能だけ（折りたたむ OFF 中・AA 中・メモ中・罫線 ON・リキャスト ON）。

---

## 6. 表ヘッダー・本体・軽減バーの再現

### 6.1 ヘッダー（`.thead` / `.th`）

- `#timeline-header-inner`（`bg-app-surface2 h-10`）→ raised プレート + 四隅ビス + 下端 muted steel ライン（`rgba(150,190,205,0.28)`）。
- 各列見出しセル → `.th` 意匠: `linear-gradient(177deg, raised-hi, raised-lo)` + 硬ベベル + 隅ブラケット（`::before`/`::after` の 6px L 字）+ 交互の切り欠き（`clip-path: polygon()` の `--shb-tr` / `--shb-tl`・**`path()` 禁止・polygon 可**、css-rules.md）。
- `.th.time` 相当（Time 見出し）→ en に下線（`border-bottom: 1px solid rgba(150,190,205,0.4)`）。
- 各見出しの `.hd-hash`（右上の斜線束）→ 疑似要素で追加。
- PH / LB の小列（`th-mini`）→ フォント小・中央寄せ。ChevronDown（ドロップダウン開閉）は維持。
- フェーズ列 / ラベル列の**折りたたみ**（`phaseColumnCollapsed` / `labelColumnVisible` → `--col-phase-collapsed-w` 等）は現状動作のまま。折りたたみ時の細い列も `.th` 意匠の縮小版で。

### 6.2 本体（`.tbody` / `.trow` / `.td`）

- `scrollContainerRef`（`.timeline-scroll-container`）→ 深い沈みスクリーン（`inset` shadow・`linear-gradient(180deg, #141b22, #0e141a)` 相当・SP2 後の統一調整で最終値）。
- `[data-time-row]`（各行）→ 浮いた金属スラット（上 hi / 下 lo の box-shadow）。
  - `:nth-child(even)` ゼブラ。
  - `:nth-child(4n)` 濃い溝（`inset 0 -3px 0 -1px var(--pl-dark)`）。
  - `:hover` → `inset 3px 0 0 var(--cyan)` + 微シアン背景。
  - **⚠ `nth-child` の当たり方**: render IIFE は行以外の要素（フェーズ/ラベルオーバーレイ・`MitigationItem`・`ConflictOffscreenArrows`）も同じ親（`scrollContainerRef` 内の relative div）に絶対配置でマウントする。`:nth-child(even)` が意図とズレる可能性 → `[data-time-row]:nth-of-type()` か、行だけを数える別の当て方を実装時に検証（geometry 実測）。
- `.td` セル → 列間の inset 仕切り（`border-left: 1px solid rgba(0,0,0,0.42)` + `inset 1px 0 0 rgba(255,255,255,0.045)`）。`td-phase` は仕切りなし。
- 時刻セル（`td-time` 相当）→ `Share Tech Mono` + シアン寄りグレー。
- 元ダメージ → 白等幅右寄せ。軽減後 → 緑発光等幅 + `%` は小さく muted。
- **致命行**（`.trow.lethal` 相当・実 DOM の lethal 判定を確認して該当クラス/属性を特定）→「軽減後」セルが赤発光の凹みセル（`inset` の赤 shadow + `rgba(239,90,95,0.3)` リング）。
- TIME レール（`.pl.v` @ mechanic 列の左）と 成績仕切り（`.pl.bead.v` @ counter|member 境界）→ `military.css` の絶対配置デカール（`scrollContainerRef` 内 relative div 基準）。列 x はトークンから算出（`calc(var(--col-header-chunk-w) + ...)`）。

### 6.3 軽減バー（`MitigationItem`）

- 効果棒 div（`absolute top-3 w-1.5 ... rounded-b-sm border-x` + JS 色クラス）→ `data-mit-bar` フックを付け、`military.css` で工業パイプ意匠に:
  - `background: linear-gradient(90deg, #0a0e12, #1c232a 22%, #2e363f 48%, #1c232a 76%, #0a0e12)` 相当（金属管の丸み）。
  - `::before` = 中心 ID 帯（ロール色 `--mb-col` = tank シアン / healer 緑 / dps オレンジ・`box-shadow` で微発光）。
  - `::after` = 下端の小フランジ。
  - ロール色は `data-myjob-dim` や既存のロール情報から引く（実装時に `MitigationItem` が持つロール/ジョブ情報を確認。JS 色クラス `colors.bg` はそのまま残し、CSS で上書き）。
- 24px アイコンラッパー → `data-mit-icon` フック → 軍事チップ意匠（面取り + 金属枠 + `Share Tech Mono` のジョブコード併記はモック `.mit-lbl` 由来だが、実 DOM ではアイコン + ターゲットジョブバッジ。モックの「チップ」に寄せた枠 + 影に留め、テキスト併記は SP2 後の統一調整で判断）。
- **維持**: ドラッグ（`hover:scale-110` / `cursor-grab`）・競合（`ring-2 ring-amber-400 animate-conflict-pulse` = 機能色そのまま）・ターゲットジョブバッジ・`laneIndex` の重ね置きオフセット（`overlapOffset`）・`isVirtual`（効果時間途中変化の仮想アイテム）・画面外ガイド矢印（`ConflictOffscreenArrows`・機能色そのまま）。
- ツールチップ（ホバーでスキルアイコン）は維持。

---

## 7. ジョブチップ（`JobPickerRow` → `.cj`）

- `JobPickerRow`（`controlBarRef` の右端・`src/components/` に別ファイル）の各チップを `.cj` 意匠に:
  - `width: 27px; height: 17px` 相当・`Share Tech Mono` 7.5px・面取り 4 色ボーダー（`--cr-t/l/r/b`）+ `box-shadow: 0 0 0 1px var(--cham-silhouette)`。
  - 実ジョブアイコンは維持（モックも `icons/*.png` を使用）。
- クリック挙動（`handleJobIconClick` → メンバー操作）は不変。
- パーティ人数が 8 未満・並び順（ライト/ロール）でチップ数と順序が変わるのは現状のまま。モックの「+追加」相当は実 DOM の挙動に従う。

---

## 8. ワークスペース外装（`.workspace` / `.ws-screen` / `.ws-cap` / `.ws-note`）

SP1 の `MilspecWorkspace`（`src/components/military/MilspecWorkspace.tsx`・15 行・現状は枠のみ）を二層化:

- **外層** = 装甲板（既に SP1 で `.milspec-*` プリミティブで raised プレート化されている想定・punch-list で「立体感が弱い」指摘あり → SP2 後の統一調整で最終化）。四隅ビス・`WKS-07`（左）/ `RAID OPERATIONS PLOT · MITIGATION ARRAY`（右）ステンシル・`.hash` 斜線束（左下）・`.pl.h` スジ彫り（上）。
- **内層**（SP2 で追加）= 沈んだ画面（`.ws-screen` 相当）: `flex: 1; overflow: hidden; box-shadow: inset ...` の深い凹み。この中に `{children}`（= `MitiPlannerPage` → `Timeline`）が入る。
  - モックの `.ws-screen` は `overflow-x: auto`（横スクロール担当）だが、**実アプリは `scrollContainerRef` 自身が横スクロールを持つ**ので、内層は `overflow: hidden` にして横スクロールは触らない（モックのネスト構造は再現しない・結果は同じ）。
- `.ws-cap`（表の右端・未使用メンバー枠ぶんの端末キャップ）→ `MilspecWorkspace` 内の絶対配置デカール。位置は「表の実描画幅の右端」= 動的。実装時に `memberLayout` の最終列右端 or CSS の列合計から算出。
- `.ws-note`（`ROSTER n / 8` / `FULL PARTY`）→ `usePartyStore` の可視メンバー数から算出（`ROSTER {visible} / 8`）。8 未満なら `SLOTS {8-visible} OPEN` 等。i18n 不要の固定英字（SP1 Q6・装飾ラベル）。

> `.ws-screen`（内層）は `children` の直接の親になる。SP1 §5.6 の埋め込みブリッジ条件（`display:flex; flex-direction:column; min-height:0;` で `children` の `h-full` / `flex-1 overflow-auto` が解決する）を SP2 でも満たす。

---

## 9. i18n

- 新規キー（5 言語同時・`feedback_i18n_all_5_languages_upfront`）:
  - `timeline.recast_row.label`（"Recast / リキャスト" のうち JP 実ラベル部分。EN 大文字 "RECAST" は装飾なので固定英字として CSS or キー分離。実装時にモックの「大英字 + 小実ラベル」パターンに合わせる）。
  - 既存キー `timeline.recast_row.show` / `timeline.recast_row.hide`（トグルツールチップ・2859 行で使用）は 5 言語存在を確認（`t('timeline.recast_row.hide', 'リキャスト非表示')` のフォールバック付き = 未整備の可能性 → SP2 で 5 言語追加）。
- モックのステンシル英字（`WKS-07` / `RAID OPERATIONS PLOT · MITIGATION ARRAY` / `ENGAGEMENT TIMELINE CONTROL · SEC-2` / `ROSTER n / 8` 等）は**固定・翻訳対象外**（SP1 Q6）。
- 機能ラベルの用語は変えない（「軽減後」「元ダメージ」「敵の攻撃」等はそのまま。軍事英字は装飾として重ねるだけ）。

---

## 10. 標準モード不変の検証（最重要）

writing-plans で以下を機械判定タスクに落とす:

1. **標準 `/miti` の DOM/幾何 一致**: `main` と本ブランチで `themeStyle` 未設定の `/miti` をヘッドレスで開き、コントロールバー・ヘッダー・リキャスト（ヘッダー内同居のまま）・表・行・軽減バー・スクロールバー（幅 0 のまま）の `getBoundingClientRect` と `outerHTML` 骨格が一致。dark / light 両方。
2. **既存テスト全緑**: `Timeline` 系・`RecastRow` 系・`MitigationItem` 系・collab・自動保存・`useThemeStore` 系。ロジック無改造なので通るはず。通らなければ分岐の入れ方が誤り。フルスイートは vmThreads ハング既知（`reference_vitest_vmthreads_hang`）→ 変更周辺に絞る。
3. **軍事モード基本動作**: コンソールエラー 0。実操作が全部動く — 軽減の配置 / 移動 / 削除 / ドラッグ / 競合警告 / 画面外矢印・共同編集カーソル・折りたたむ（行間引き）・AA モード・メモモード・罫線トグル・リキャスト行トグル・フェーズジャンプ・ラベル編集・横スクロール（ヘッダー / コントロールバー / リキャスト帯 / 軽減バーが同期）・縦スクロール（リキャスト行が追従）・スクロールバーが可視で計器意匠。
4. **リキャスト帯の独立が壊れていない**: 軍事モードでリキャスト帯が「ヘッダー下・表上」に独立表示され、左ラベルが出て、メンバーセルの x が表の列と一致（geometry 実測）。標準モードではヘッダー内同居のまま。
5. **push 前ゲート**: `npm run build`（tsc -b 厳密）exit 0 + 変更周辺 vitest 緑。

**視覚忠実度は自動化しない。** ゾーンごと（コントロールバー / ヘッダー / リキャスト帯 / 行・セル / 軽減バー / スクロールバー / ワークスペース外装）に **masaya がモックとスクリーンショット突き合わせで承認**（`feedback_visual_fidelity_requires_screenshot_diff` = SP1 の品質却下の直接の教訓・機能検証だけで「完了」と報告しない）。`reference_dev_editor_hmr_hardreload`（useEffect 変更後はハードリロード）。

---

## 11. ファイル構成（SP2）

### 新規

| ファイル | 役割 |
|---|---|
| `src/styles/military.css` への SP2 節追記 | コントロールバー / ヘッダー / リキャスト帯 / 表本体 / 行・セル / 軽減バー / ジョブチップ / 計器スクロールバー（表 + サイドバー共有）/ ワークスペース内層 の意匠。全ルール `.theme-military` 前置。 |
| `src/locales/{ja,en,zh,zh-Hant,ko}.json` への追記 | `timeline.recast_row.label` 他・既存 `recast_row.show/hide` の 5 言語補完。 |

### 変更

| ファイル | 変更 |
|---|---|
| `src/components/Timeline.tsx` | (a) `themeStyle` 購読を追加。(b) `themeStyle === 'military' && !isMobileTimeline` のとき `<RecastRow>` を `headerRef` 外の独立帯 `[data-milspec-recast-band]` としてマウント（else = 現状）。(c) `handleScrollSync` の `scrollSyncTargets` と `syncPadding` に軍事モード時のみリキャスト帯 inner を追加。(d) `themeStyle` 変化時に `syncPadding()` を 1 回呼ぶ `useEffect`。(e) `MitigationItem` の効果棒 / アイコンラッパーに inert な `data-mit-bar` / `data-mit-icon`。**標準モードのレンダリング出力・挙動は不変。** |
| `src/components/military/MilspecWorkspace.tsx` | 装甲板の内側に「沈んだ画面」内層を追加（二層化）。`.ws-cap` / `.ws-note` デカール。 |
| `src/components/RecastRow.tsx` | **原則変更しない**（Fragment を返す現状の実装をそのまま使う）。もし独立帯の左ラベルをこのコンポーネント内で持たせる設計にするなら、`variant` prop で分岐（標準 = Fragment のみ / military = ラベル + セル）。Timeline 側で器を組む方式を優先し、RecastRow は据え置きが第一候補。 |

### 触らない

- `src/store/*.ts`（`useThemeStore` / `useMitigationStore` / `usePartyStore` / `usePlanStore` 等）
- `src/components/Timeline.tsx` の座標計算・render IIFE・collab・競合判定・`hideEmptyRows`・`handleScrollSync` の同期ロジック本体・`MitigationItem` のドラッグ/競合/仮想アイテムロジック
- `src/components/TimelineRow.tsx` のロジック（`data-*` は既存のものを CSS で狙うだけ・新規追加は最小限）
- `src/components/RecastRow.tsx` のアイコン静的マウント + `update()` の CSS 変数直書き
- `MitigationSheet.tsx` / `MitigationSheet.css`（みんなの軽減表・スコープ外）
- `src/components/MobileFab.tsx`（casing 厳守 `ab`・`feedback_mobilefab_casing_exact`）
- `/admin` `/housing` `landing` / モバイル（SP3）/ 表エリアのポップアップ（標準のまま）
- `src/index.css` の `.timeline-scroll-container::-webkit-scrollbar:vertical`（標準の幅 0 は維持・軍事は `.theme-military` セレクタで上書き）

---

## 12. 実装フェーズ（writing-plans で詳細化）

各タスクにローカル実機確認ゲート（masaya がモックとスクショ突き合わせ）:

1. **ワークスペース内層 + 標準不変検証の土台** — `MilspecWorkspace` の二層化。既存 Timeline がその中で従来どおり動く。§10-1,2 を回す（この時点で標準不変が壊れていないことを先に固める）。
2. **表本体（`.tbody` / `.trow` / `.td`）** — 沈みスクリーン・金属スラット行・ゼブラ・4n 溝・ホバー・列間仕切り・致命セル。`nth-child` の当たり方を geometry 実測で検証。
3. **表ヘッダー（`.thead` / `.th`）** — ブラケットタイル・交互切り欠き・隅ブラケット・`.hd-hash`・Time 下線・折りたたみ列。
4. **コントロールバー（`.subtoolbar`）** — `.cb-tgl` / `.cb-ico` / `.cb-div` / ランプ / ステンシル。ボタン挙動不変を確認。
5. **ジョブチップ（`.cj`）** — `JobPickerRow` の塗り替え。
6. **軽減バー（`MitigationItem`）** — `data-mit-bar` / `data-mit-icon` 追加 + 工業パイプ / 軍事チップ意匠。ドラッグ・競合・仮想アイテム・画面外矢印の回帰確認。
7. **リキャスト行の独立** — 軍事モード限定の器 + 左ラベル + スクロール同期追加 + `syncPadding` 追加。§10-4 を実測。標準モードの同居維持を確認。
8. **計器スクロールバー（表 + サイドバー共有）** — `.theme-military` の `::-webkit-scrollbar` 上書き・`scrollbar-width` 残存チェック・`themeStyle` 変化時の `syncPadding` 再実行・`.gauge-cap` 静的キャップ・MIL-SPEC サイドバーへの共有適用。
9. **ワークスペース外装デカール** — ビス・ステンシル・`.hash`・`.pl.h`・`.ws-cap`・`.ws-note`。
10. **i18n 5 言語 + 3 ビューポート（1489/1920/2560）+ push 前ゲート + whole-branch 敵対レビュー**（fresh context・採用は正しさに関わる指摘のみ）。

各フェーズ後に masaya がローカルで実機確認 → 次へ。

---

## 13. 未確定（実装時 or SP2 後の統一調整で詰める）

- 表本体・行・ヘッダーの最終的なフォント px・gap・relief・色 hex（SP2 後の「シェル + 表まとめて調整」フェーズ）。
- `.trow:nth-child` が行以外の兄弟要素（オーバーレイ・軽減バー）を数えてしまう問題の最終的な当て方（`nth-of-type` / データ属性セレクタ / 実装時 geometry 検証）。
- `MitigationItem` の効果棒のロール色をどこから引くか（`MitigationItem` の props / store から確認）。
- モック `.mit-lbl` のジョブコードテキスト併記を SP2 で入れるか（アイコン + バッジの実 DOM に対し）。
- `.gauge-cap` の目盛りピッチをスクロールバー track とどう厳密に揃えるか。
- `recastRowVisible` OFF 時にリキャスト帯を完全非表示にするか、ラベルだけ残すか（第一候補 = 完全非表示）。
- `RecastRow.tsx` を据え置きにするか `variant` prop を足すか（第一候補 = 据え置き・Timeline 側で器を組む）。
- `military.css` の肥大（punch-list: 現状 103KB・`themeStyle==='military'` 条件の動的 import 検討）→ SP2 でさらに増えるため、動的 import 化を SP2 のどこかで判断（別タスク化も可）。

---

## 14. 制約（Global Constraints・全タスク拘束）

1. **標準モード（`themeStyle` 未設定 / `'standard'`）の `/miti` のレンダリング出力（computed style・DOM 骨格）・挙動を `main` と完全一致させる。** 許容差分は §3.3 の (a)〜(d) のみ。§10 で証明。
2. **既存の編集機能を壊さない。** 座標計算・`handleScrollSync`・`syncRecastRow`・`hideEmptyRows`・collab・競合判定・`MitigationItem` のドラッグ/リサイズ・Undo/Redo・AA/メモモード・フェーズ/ラベル編集・折りたたみが両モードで動く。
3. **`Timeline.tsx` / `TimelineRow.tsx` / `RecastRow.tsx` / `MitigationItem` のロジックに手を入れない。** SP2 が触るのは (a) 見た目 CSS、(b) リキャスト帯の器と配置、(c) スクロール同期対象への条件付き追加、(d) inert な `data-*` フック のみ。
4. **正典はモックアップ**（`docs/.private/theme-refs/milspec-mockup.html`・絶対パスで実装者に渡す）。デザインの疑問はモックの CSS/DOM を引く。
5. すべての MIL-SPEC CSS ルールは `.theme-military` 前置（`military.css` の SP2 節に集約）。
6. `.claude/rules/css-rules.md` 遵守（`backdrop-filter: blur()` リテラル禁止 → `--tw-backdrop-blur` 変数 / `clip-path: path()` 禁止・`polygon()` 可 / 回転 `::before` は `200vmax`）。
7. sizing はリポジトリ標準（`design-philosophy-sizing.md`）: 全 text px 固定・`clamp(MIN, N vw, BASE)` で max=base=1489・html font-size 16px。列幅は `--col-*-w` の clamp を MIL-SPEC 用に上書き。
8. i18n は最初から 5 言語（ja/en/zh/zh-Hant/ko）。機能ラベルの用語は変えない（「軽減後」「元ダメージ」「敵の攻撃」等）。軍事英字は装飾として重ねるだけ・翻訳対象外。
9. push は worktree から行わない（最終マージ時のみ）。push 前ゲート = `npm run build` + 対象 vitest。
10. `src/components/MobileFab.tsx` は小文字 `ab` で参照（本番ビルド保護）。
11. SP2 完了 = 「軍事版の表が構造として立ち上がり全編集機能が動く + ゾーンごとに masaya がモックとスクショ突き合わせで承認」まで。フォント/余白/立体感の最終数値は SP2 後の統一調整フェーズ。
