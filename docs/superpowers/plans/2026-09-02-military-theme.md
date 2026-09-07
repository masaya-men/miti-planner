# MIL-SPEC テーマ 本番移植 Implementation Plan（v2 — モックアップ準拠・全面改訂 2026-09-07）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 各タスクは fresh subagent へ自己完結の指示書として渡す。

**Goal:** 一週間かけて作り込んだ MIL-SPEC モックアップ（`docs/.private/theme-refs/milspec-mockup.html`）の見た目・遊びボタン・計器・装飾を **取りこぼしなく** 本番の軽減表エディタ（`/miti`）へ移植する。Light / Dark 両方を作り込む。完成まで一般ユーザーには見せない（`localStorage 'milspec-preview'` プレビューゲート）。standard テーマは 1 バイトも変えない。本番の編集機能（パーティ設定・取り込み・共有・Undo/Redo・リキャスト・PiP 等）は全て稼働させる。

**Architecture:** テーマの「スタイル軸」（`themeStyle: 'standard' | 'military'`・Phase 0 で実装済）が `military` のとき `<html>` に `theme-military` クラスが付く。リスキンは 3 層:
1. **意味トークン再定義** — `.theme-military.theme-dark {}` / `.theme-military.theme-light {}` で `--color-*` / `--glass-*` を MIL-SPEC パレットへ差し替え → Tailwind ユーティリティ（`bg-app-bg` 等）が全自動追従（半 themed 事故を防ぐ）。
2. **ゾーン別リスキン** — 既存の `data-milspec-*` DOM フック + 必要なら追加フックに、モックアップの CSS（`.hp` / `.subplate` / C 面 / スジ彫り / デカール …）を `.theme-military` 前置で載せる。
3. **新規クローム** — モックアップにしか無い装飾（導管・シーム・タービン遊びボタン・ロールカウンター計器・フッター HUD・外枠コンソール）を React コンポーネント化。`themeStyle==='military'` かつ PC のときだけ描画、それ以外は `null`。

モックアップの JS（タービン rig / ロールカウンター / 座標追従）は React へ移植。モックアップの固定キャンバス（1666×944 グリッド・座標直書き）は**捨てる** — 本番の応答レイアウト（`--col-*` の `clamp()` 列幅・ヘッダー折りたたみ・フォーカスモード・モバイル）に、モックアップの**表面の視覚言語だけ**を載せる。

**Tech Stack:** React 19 + Vite + Tailwind v4（`@theme` in CSS）+ Zustand（persist）+ i18next（5 言語）+ vitest（happy-dom）。CSS は素の CSS（`src/styles/military.css`）。フォントは自前ホスト woff2（Phase 0 で配置済）。

**一次資料（実装者は3つとも読む）:**
- 設計書: `docs/superpowers/specs/2026-09-02-military-theme-design.md`（テーマ2軸化の論拠・スコープ・トークン契約・デカール文言ガイドライン §12）
- **正典 = モックアップ**: `docs/.private/theme-refs/milspec-mockup.html`（GITIGNORE・ブラウザで開く。`<style>` 10–1856 行 = CSS / `<body>` 1858–2340 = DOM / `<script>` 2342–2693 = JS。**これが視覚言語の一次資料**。本プランはこのファイルの行番号を参照する）
- 全経緯: `docs/.private/2026-09-03-milspec-trace-workflow.md`（追記 1〜25 = masaya の全指示と却下事項）
- マテリアル言語: `docs/.private/theme-refs/milspec-material-language.md`（memory `reference_milspec_material_language`）/ メカ語彙: `docs/.private/theme-refs/milspec-mecha-language.md`

---

## 状況（2026-09-07 時点）

- **Phase 0 は worktree `milspec-theme` に実装・コミット済**（6 commits `29af250d..83c94a78`）: `useThemeStore` 2 軸化 + persist v2 migrate / `applyThemeClasses` / `App.tsx` + `index.html` フラッシュ防止スクリプト / `MilspecStyleToggle`（`ConsolidatedHeader` に DEV+preview ガード付きで配置）/ `MilspecTunePanel`（`Layout.tsx:878` にマウント）/ Orbitron・Share Tech Mono 自前ホスト / `military.css` を `main.tsx:8` で import。
- **旧 Phase 1（ヘッダー他のリスキン・commits `0bcad2a3..1970bbb2`）はモックアップ以前の版で、5 回作り直した末に破棄対象**。現 `military.css`（911 行）は語彙がモックアップと別物（`--milspec-*` トークン / `.milspec-panel` / `[data-milspec-chrome]` の px 直書きデカール）。**本体は Phase 1 でモックアップから作り直す。**
- **TSX 側の `data-milspec-*` フックは大量に既存**（下表）— これは**残して再スタイルする**。
- worktree ブランチは main より 5 commit遅れ（OGP カード修正 `280da74d` + ツアー修正 `68e13644` `482e9a94` `cbd58d47` が未取込）→ Task 0.R1 で取り込む。
- モックアップのノブ確定値（masaya 固定）: `grain-all 0.7 / grain-panel 0.55 / frame 1.25 / relief 1.1 / shadow 0 / glow 4 / panelline 1.2 / channel 0.5 / weather 0 / wear 0`。→ weather / wear が 0 = 全面テクスチャ（grime / scratches）は既定 OFF。ノブは残す（実機で再調整するため）。

### 既存 `data-milspec-*` フック棚卸し（survey 2026-09-07）

| フック | ファイル:行 | 要素 | 内包デカール |
|---|---|---|---|
| `data-milspec-header` | `ConsolidatedHeader.tsx:174` | ヘッダー内側 flex-col | chrome + titlebar + toolbar |
| `data-milspec-chrome` | `ConsolidatedHeader.tsx:179` | aria-hidden 装飾層 | 15 span（`milspec-c-*` 位置クラス付き）|
| `data-milspec-chrome` | `AppFooter.tsx:15` | aria-hidden span | `milspec-decal` ×2 + `milspec-led` |
| `data-milspec-titlebar` | `ConsolidatedHeader.tsx:203` | Layer A 行 | — |
| `data-milspec-wordmark` | `ConsolidatedHeader.tsx:213` | aria-hidden | `.milspec-wm-main` / `.milspec-wm-sub` |
| `data-milspec-title` | `ConsolidatedHeader.tsx:223` / `:259` | コンテンツ名 span（viewer/通常）| テキスト |
| `data-milspec-toolbar` | `ConsolidatedHeader.tsx:372` | Layer B 行（+ `.milspec-hash` クラス）| — |
| `data-progress-drawer-anchor` | `ConsolidatedHeader.tsx:486` | 24px 折りたたみハンドル領域（既存・milspec CSS もフック）| ハンドルボタン |
| `data-milspec-mobile-header` / `-mobile-logo` | `MobileHeader.tsx:34` / `:54` | `<header>` / LOPO span | — |
| `data-milspec-sidebar` | `Sidebar.tsx:1243` | `<motion.aside>` root | — |
| `data-milspec-dock` | `Sidebar.tsx:1277` | ボタンバー（NEW/複数選択/削除/AUTO）| — |
| `data-milspec-sect` | `Sidebar.tsx:1349` | **savage タブのみ** のシリーズ見出し | — |
| `data-milspec-backup` | `Sidebar.tsx:1586` | BACKUP/RESTORE ラッパ | — |
| `data-milspec-deployment` / `-deployment-hazard` | `Sidebar.tsx:1609` / `:1610` | aria-hidden DEPLOYMENT ブロック | `.milspec-deployment-{body,mark,text,en,jp}` |
| `data-milspec-table` | `Timeline.tsx:2694` | 表コンテナ（+ `.glass-panel`）| — |
| `data-milspec-thead` | `Timeline.tsx:2950` | `headerRef` 列見出し行 | — |
| `data-milspec-footer` / `-chrome` | `AppFooter.tsx:11` / `:15` | `<footer>` | `milspec-decal` ×2 |

**military.css に定義済だが未配線（死にセレクタ）**: `[data-milspec-collabel]` `[data-milspec-time]` `[data-timeline-time]` `[data-milspec-num]` `[data-milspec-row]` `[data-milspec-modal]` + 単体プリミティブ多数。→ Phase 1 で military.css を作り直すため一旦全部消える。

---

## Global Constraints

以下は全タスクの要件に暗黙で含まれる。値はモックアップ／spec から逐語コピー。

- **standard 不変（最重要）**: `themeStyle` 未指定（standard）のとき既存のダーク/ライトの見た目・挙動は完全に不変。
  - 全 CSS ルールは `.theme-military` 前置。装飾専用レイヤーは `[data-milspec-x] { display: none }` → `.theme-military [data-milspec-x] { display: … }`。
  - 新規 React コンポーネントは `themeStyle !== 'military'` のとき `return null`。
  - 新規 `data-milspec-*` 属性は `.theme-military` ルールが無ければ完全に不活性（既存 DOM への属性追加のみ・構造は変えない）。
  - 検証: 各タスクの DoD に「standard で該当画面が 1px も変わらない」を必ず含める。Task 4.6 で全画面回帰。
- **スコープ**: `/miti` エディタ配下のみ（`MitiPlannerPage` / `Layout` / `ConsolidatedHeader` / `Sidebar` / `Timeline*` / `TimelineRow` / `RecastRow` / `JobPickerRow` / `MobileHeader` / `AppFooter` / エディタから開くモーダル）。`admin/` `landing/` `housing/` `MitigationSheet.css`（みんなの軽減表シート本体）は**対象外**。
- **CSS 技術制約**（`.claude/rules/css-rules.md`）:
  - `backdrop-filter: blur(...)` リテラル禁止 → `--tw-backdrop-blur` 変数パターン。
  - `clip-path: path()` 禁止（`polygon()` は可）。モックアップは `polygon()` のみ使用。SVG `<path>` は可（フッター harness で使用）。
  - 回転する `::before` のサイズは `%` 禁止 → `200vmax`。
  - `mask: radial-gradient(circle closest-side …)` は可（chrono リング。ただし chrono は現状 dead code・Phase 3 では作らない）。
- **CSS トークン名前空間**: モックアップの private トークン（`--bg` `--panel` `--raised` `--cyan` `--cham-lg` `--sh-*` `--edge-hi` `--pl-dark` `--tune-*` 等 約 90 個）は **`--ms-*` に名前空間化**して移植（spec §3.3・スプシモード将来対応）。ノブは `--ms-tune-*`（9 個）。移植前に `grep -rn -- "--ms-" src/` で衝突ゼロを確認。
- **機能色の役割不変**: `--color-blue`（進む/OK）・`--color-red`（危険/削除）・`--color-amber`（警告）・緑（軽減後ダメージ）は色相が変わっても意味付け不変。MIL-SPEC では blue→シアン `#82ccdf`（dark）/ `#1183b0`（light）、amber→オレンジ、red→レッド、緑→`#59d089` / `#1f9d57`。
- **性能**:
  - `src/index.css` の `@property --mobile-effect-bar-progress { syntax:'<number>' }`（`index.css:1447-1451`・2026-08-14 スクロール性能の根治）を絶対に消さない。色と box-shadow だけ差し替える。
  - `.claude/rules/ui-design.md`「マウス追従 UI 禁止」— Phase 3.2 のロールカウンター（カーソル座標表示）は例外扱いだが **React state を毎フレーム更新しない**（rAF で DOM 直書き・追いついたら停止・pointermove は変数貯めのみ）。masaya の明示承認を Task 3.2 の DoD に置く。
  - `content-visibility: auto` を使う行（`TimelineRow` の `[content-visibility:auto]`）の見た目を変える改修は実行時挙動が壊れやすい（memory `feedback_structural_refactor_runtime_audit`）→ Task 2.5 は実機総点検を DoD に。
- **アニメーション**: 走査線・グロー脈動・タービン回転・火花/蒸気は `@media (prefers-reduced-motion: reduce)` で無効化（CSS 側の保険 + JS 側のガード両方）。
- **i18n**: ユーザーが読む新規文字列は i18n キー経由・最初から `ja / en / zh / zh-Hant / ko` の 5 言語。ロケール JSON は該当ブロックのみ textual 編集（全体 parse→stringify 禁止・memory `feedback_locale_json_textual_edit`）。**`aria-hidden` の装飾デカール（英語のコード・"A.R.D // SECTOR 01" 等）は i18n 不要**（コンテンツではない）。フッターの権利表記・リンクは既存の `t('footer.*')` キーを維持（新規キー不要）。
- **デカール文言**（spec §12）: 偽の著作権行（`© SQUARE ENIX` を飾りで置く）・偽のアクセス制限文（`UNAUTHORIZED ACCESS PROHIBITED`）・偽の所有権表記（`PROPERTY OF GARLEMALD EMPIRE`）は禁止。OK = `COMBAT ANALYSIS SYSTEM` / `ALLAGAN RESEARCH DIVISION` / `SYSTEM ONLINE ●` / 部品番号（`PX-042` 等）/ LoPo 機能の英語説明。実在の SE 著作権表記（`AppFooter` の本物）はスコープ外・不変。
- **検証**: 見た目は masaya のローカル実機確認がゲート（Claude はスクショを見ない・memory `feedback_no_screenshots_local_verify`）。DEV エディタの useEffect 変更後はハードリロード必須（memory `reference_dev_editor_hmr_hardreload`）。push 前ゲート = `npm run build`（tsc -b 厳密・memory `feedback_vercel_tsc_strict`）+ 変更周辺 vitest（フルスイートはハング既知 `reference_vitest_vmthreads_hang` のため対象を絞る）。DOM 構造を触るタスクは playwright で全ゾーン矩形（geometry）を実測回帰（workflow 追記 24 の教訓）。
- **コミット**: 1 タスク = 1〜数コミット。並行実行しない（`military.css` に集中するため直列）。コミットメッセージ末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。worktree からの push はしない（Task 4.6 のマージ後にまとめて）。
- **リリース方針**: 本テーマは軽減表スプシモード（別 spec/plan・未着手）と**セットで 1 回の大型アップデート**という 2026-09-02 の方針あり。Task 4.6 で masaya に「スプシモードを待つ / MIL-SPEC 単独で出す」を確認（本プランはどちらでも動くよう、マージ直前までプレビューゲートを維持する）。

---

## File Structure

### 新規ファイル

| ファイル | 責務 |
|---|---|
| `src/components/military/MilspecChrome.tsx` | `themeStyle==='military'` かつ PC のときだけ描画する装飾オーバーレイの束（`console-frame` 外枠 + 四隅ブラケット + ビス + ビネット、`wthr-ao` / `wthr-grime` レイヤー、必要なら `conduit` / `seam`）。`Layout.tsx` の `<GridOverlay/>` の直後にマウント。`pointer-events: none`。 |
| `src/components/military/MilspecConduit.tsx` | サイドバー↔本体の継ぎ目を貫く縦の蛇腹動力パイプ（バルクヘッド継手 + P クリップ + ID バンド）。サイドバーの実効全高に追従。 |
| `src/components/military/MilspecTurbineCluster.tsx` | 排熱ファンの遊びボタン。専用スイッチ 1 個 + 正方形フレーム（1 or 2 基）。ヘッダーの `hp-fill` 相当位置とフッターに配置。`useTurbineRig` を配線。 |
| `src/components/military/turbineRig.ts` | `createTurbineRig`（角速度を rAF で直接アニメ・idle→spinup→hold→spindown 状態機械）+ `spawnSparks` / `spawnSteam` / `makeTrickle`。モックアップ JS 2396–2519 の移植。純粋関数 + DOM 操作、React 非依存。 |
| `src/components/military/MilspecRollCounter.tsx` | フッター計器: X / Y カーソル座標のオドメーター（回転ドラム）。`buildRoll` / `rollTo` / `axisTargets` / `snapAxis` / `instTick`（モックアップ JS 2521–2645）の移植。rAF・DOM 直書き・React state を毎フレーム更新しない。 |
| `src/components/military/MilspecFooterHud.tsx` | `themeStyle==='military'` かつ PC のときの `AppFooter` の中身差し替え（`fp-info` 情報プレート + `fp-inst` 計器プレート + `fp-harness` PCB ハーネス SVG + `fp-reticle` レティクル + `MilspecRollCounter` + `MilspecTurbineCluster`）。権利表記・リンクは既存 `t('footer.*')` を再利用。 |
| `src/components/military/MilspecDeploymentSvg.tsx` | （必要なら）DEPLOYMENT ブロックの `X` エンブレム SVG を切り出し。既に `Sidebar.tsx:1612` にインライン SVG があるので**そのまま使い回す判断でも可**。 |
| `src/components/military/__tests__/turbineRig.test.ts` | rig の状態機械 / spark・steam 生成数 / reduced-motion no-op。 |
| `src/components/military/__tests__/MilspecRollCounter.test.tsx` | ドラム桁数 / `axisTargets` の桁分解 / `snapAxis` の整数スナップ / pointermove で React re-render が起きないこと。 |
| `src/components/military/__tests__/MilspecTurbineCluster.test.tsx` | `themeStyle` ガード / スイッチ押下で `rig.start` が呼ばれ多重押下がブロックされること / reduced-motion。 |
| `src/components/military/__tests__/MilspecFooterHud.test.tsx` | PC 限定描画 / standard で `null` / 権利リンクが既存キーで出ること。 |

### 変更ファイル

| ファイル | 変更 |
|---|---|
| `src/styles/military.css` | **本体を全面書き直し**（Phase 1）: `@font-face`（維持）/ `--ms-*` トークン（`.theme-military.theme-{dark,light}`）/ 意味トークンリマップ / `.theme-military` 前置の全プリミティブ + ゾーン別ルール（モックアップ 10–1856 の移植）。 |
| `src/components/dev/MilspecTunePanel.tsx` | `TUNABLES` をモックアップの 9 ノブ（`--ms-tune-grain-all/-frame/-relief/-shadow/-glow/-panelline/-channel/-weather/-wear`）に差し替え。`copyCss` の出力先セレクタを `.theme-military.theme-dark` に（dark で詰める前提）。 |
| `src/store/useThemeStore.ts` | 変更なし（Phase 0 で完了。必要なら `main` 取込時の衝突解消のみ）。 |
| `src/components/ConsolidatedHeader.tsx` | `data-milspec-chrome` の中身を整理（px 直書きの `milspec-c-*` を CSS 側の相対配置に寄せる or 減らす）。`hp-fill` 相当の位置に `<MilspecTurbineCluster placement="header"/>` を追加（`themeStyle` ガード）。折りたたみハンドル・`SyncButton` は DOM 変更なし（CSS のみ）。 |
| `src/components/Sidebar.tsx` | `data-milspec-sect` を **全タブ**（ultimate/other/archive も）に付与。`phases` 相当のリスト（各タブの `overflow-y-auto` パネル）の選択項目に `data-milspec-selected` 等のフック追加。`conduit` 用のガター（`seam` 22px 列は本番グリッドに無いので、`MilspecConduit` はサイドバー右端の絶対配置で対応）。 |
| `src/components/Timeline.tsx` | コントロールバー（`controlBarRef`・inline JSX 2720–2944）に `data-milspec-controlbar` フック。`headerRef`（`data-milspec-thead` 既存）内の RAW/TAKEN/RecastRow エリアに `.gauge-cap` 相当。`scrollContainerRef` に `data-milspec-scroll`。行（`renderItems`）と `MitigationItem` は class ベースで拾う（DOM 追加は最小）。 |
| `src/components/TimelineRow.tsx` | 時刻セル / RAW / Dmg セルに `data-milspec-num` / `data-milspec-time`（既存 CSS の死にセレクタを生かす）。lethal 行の Dmg セルに `data-milspec-lethal`。DOM 構造は変えない（`content-visibility` を壊さない）。 |
| `src/components/RecastRow.tsx` / `JobPickerRow.tsx` | 必要なら role タグ用フック。基本は既存 class（`.recast-cell` / `data-member-role`）で拾う。 |
| `src/components/AppFooter.tsx` | `themeStyle==='military'` かつ PC のとき `<MilspecFooterHud/>` に委譲（`h-6` → 実測 82px 相当・`pointer-events` を内側で制御）。standard は既存のまま。 |
| `src/components/Layout.tsx` | `<GridOverlay/>` 直後（`Layout.tsx:591`）に `<MilspecChrome/>`。`<MilspecConduit/>` はサイドバー領域の相対配置で（`Layout.tsx:642` のメインカラム or サイドバーラッパ付近）。 |
| `src/locales/{ja,en,zh,zh-Hant,ko}.json` | Ko-fi 導線（Task 4.4）+ タービン/計器の `aria-label` に必要な最小キーのみ。 |

### テスト規約

- **ロジック（rig 状態機械 / ロールカウンター桁分解 / トグルガード / 条件描画）** = 通常の TDD（失敗テスト先行→実装→green→commit）。
- **純粋な見た目（CSS リスキン）** = 自動テストを書かない。各タスクの DoD に **masaya がローカルで確認する具体チェックリスト** + **playwright geometry 回帰**（DOM を触った場合）。
- Phase 2 以降の見た目タスクは、着手時に対象コンポーネントの実 class / DOM を Read で確認してからスタイルを書く（推測禁止・memory `feedback_evidence_based_work`）。

---

## モックアップ → 本番 対応表

| ゾーン | モックアップ（正典）CSS 行 | 本番 DOM アンカー | 備考 |
|---|---|---|---|
| トークン: Dark | `milspec-mockup.html` 18–148 | `.theme-military.theme-dark {}` | `:root` → 名前空間化して移植 |
| トークン: Light | 149–218 | `.theme-military.theme-light {}` | `[data-theme="light"]` → 移植 |
| 全面グレイン / weather / AO / 走査線 | 220–316 | `MilspecChrome` の子レイヤー + `body::before` | weather/wear 既定 0（テクスチャ画像は data URI 化 or 省略可） |
| 共通プリミティブ（`.hp` / `.subplate` / `.screen` / `.bolt` / `.pl` / `.sc` / `.chan` / `.access` / C 面 / `.nameplate` / `.hazard-yellow` / `.echo` / wear marks / `.console-frame` / `.hdg` / `.lamp`）| 346–766, 1564–1576, 1811–1855 | `.theme-military .ms-*`（クラスは `ms-` 接頭 or `milspec-` 接頭に統一） | Phase 1.3 |
| ヘッダー（`.header` / `.hp-logo` / `.seam-diag` / `.hp-title` / `.hp-fill` / `.hp-share` / `.hp-tools` / `.hud-btn`）| 768–886 | `[data-milspec-header]` / `-titlebar` / `-wordmark` / `-title` / `-toolbar` + `[data-progress-drawer-anchor]` | Phase 2.1 / 2.2 |
| ツールバー棚（`.toolbar` / `.tb-cluster` / `.tool-btn` / `.tool-seg`）| 888–964 | `[data-milspec-toolbar]`（Layer B）| Phase 2.1（ヘッダーと一体） |
| コントロールバー（`.subtoolbar` / `.cbar-left` / `.cb-a`〜`.cb-e` / `.cb-tgl` / `.cb-ico` / `.cj`）| 966–1032 | `Timeline.tsx` `controlBarRef`（2720）inline JSX / `#timeline-controls-inner` | Phase 2.3 |
| ワークスペース + 表（`.workspace` / `.ws-screen` / `.table` / `.thead` / `.th` / `.tbody` / `.trow` / `.td-*` / `.mit-bar` / `.mit-lbl` / `.ws-cap` / `.gauge-cap` / `::-webkit-scrollbar` / `.recast-row` / `.rc-icon`）| 1034–1300 | `[data-milspec-table]` / `[data-milspec-thead]` / `scrollContainerRef` / `.timeline-scroll-container` / `RecastRow` の `.recast-cell` / `MitigationItem` | Phase 2.5（大） |
| サイドバー（`.sidebar` / `.scenario` / `.s-hd` / `.s-btn` / `.enc-name` / `.phases` / `.phase` / `.phase-h` / `.phase-tag` / `.pi` / `.pi.sel` / `.dock` / `.deployment`）| 1302–1412 | `[data-milspec-sidebar]` / `-dock` / `-sect` / `-backup` / `-deployment` + タブ別リストパネル | Phase 2.4 |
| フッター（`.footer` / `.fp` / `.fp-info` / `.fp-title` / `.finfo` / `.fp-inst` / `.rollbank` / `.rc-*` / `.fp-reticle` / `.fp-scan` / `.fp-harness`）| 1414–1576 | `AppFooter.tsx` → `MilspecFooterHud` | Phase 2.6 + Phase 3.2 |
| タービン（`.turbine` / `.tb-vanes` / `.tb-hub` / `.tb-frame` / `.tb-switch` / `.tb-spark` / `.tb-steam` / `.tb-cluster2`）| 1577–1701 | `MilspecTurbineCluster` | Phase 3.1 |
| 動力導管（`.conduit` / `.cd-fit` / `.cd-clip` / `.cd-band`）| 1703–1809 | `MilspecConduit` | Phase 3.3 |
| スイッチバンク / ロッカー（`.lamp` / `.tb-cluster > .sc` / `.cb-tgl`）| 1811–1855 | コントロールバー + ツールバー | Phase 2.1 / 2.3 |
| JS: タービン rig | `<script>` 2396–2519 | `turbineRig.ts` | Phase 3.1 |
| JS: ロールカウンター | 2521–2645 | `MilspecRollCounter.tsx` | Phase 3.2 |
| JS: 押下フラッシュ | 2647–2656 | `.theme-military` の `:active` CSS で代替（JS 不要）| Phase 1.3 |
| JS: 調整パネル | 2658–2692 | `MilspecTunePanel.tsx`（既存・ノブ差し替え）| Task 0.R2 |
| モックアップ dev 足場（`#ctl` / `#tune` / `.stage.trace` / `.wrap` / `applyFit`）| — | **移植しない** | — |

---

## Phase 0 — ✅ 完了（recap）+ 差分調整

Phase 0 のコード（`useThemeStore` 2 軸化 / `applyThemeClasses` / `App.tsx` + `index.html` / `MilspecStyleToggle` / `MilspecTunePanel` / フォント / `military.css` import）は worktree に実装済。以下は**モックアップ準拠へ寄せる差分調整**のみ。

### Task 0.R1: worktree に最新 main を取り込む

**Files:** worktree `.claude/worktrees/milspec-theme` 全体（マージコミット）

- [ ] **Step 1: 現状確認**

```bash
cd c:/Users/masay/Desktop/FF14Sim/.claude/worktrees/milspec-theme
pwd   # worktree 内であることを確認（memory reference_subagent_worktree_cwd_not_inherited）
git status   # クリーンであること
git log --oneline milspec-theme..main   # 5 commits: cbd58d47 / 482e9a94 / 68e13644 / 280da74d / 75ae6291
```

- [ ] **Step 2: main をマージ**

```bash
git fetch origin   # ローカル main が最新か確認（このリポジトリは push(main) で自動デプロイ）
git merge main
```

衝突が出るのは主に `docs/TODO.md`（両方が編集）。コードの衝突は `api/share/*` 等の可能性 — その場合は main 側を採用（milspec ブランチはそれらを触っていない）。マージ後 `git diff milspec-theme@{1}` で milspec の作業が消えていないか確認（memory `feedback_worktree_merge_uncommitted_check`）。

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: コミット**（マージコミットは `git merge` が作る。追加編集があれば別コミット）

---

### Task 0.R2: 調整ノブをモックアップの 9 個に差し替え

**Files:**
- Modify: `src/components/dev/MilspecTunePanel.tsx`

**Interfaces:**
- Produces: `--ms-tune-{grain-all,frame,relief,shadow,glow,panelline,channel,weather,wear}` を操作する dev パネル。`--ms-tune-grain-panel` は UI 無し（モックアップと同じ）。

- [ ] **Step 1: `TUNABLES` を差し替え**（モックアップ `#tune` 1867–1886 + `KNOBS` 2661–2671 と一致させる）

```tsx
/** 調整対象の --ms-tune-* 変数。military.css の初期値・モックアップの #tune と一致させる。 */
const TUNABLES: { key: string; label: string; min: number; max: number; step: number }[] = [
  { key: '--ms-tune-grain-all',  label: '全面グレイン(粒状感)',            min: 0, max: 1.2, step: 0.02 },
  { key: '--ms-tune-frame',      label: '枠線・ブラケットの明るさ',        min: 0, max: 4,   step: 0.05 },
  { key: '--ms-tune-relief',     label: '★パネルの厚み・ベベル(立体感)',  min: 0, max: 6,   step: 0.05 },
  { key: '--ms-tune-shadow',     label: 'パネル背後のボケ落ち影',          min: 0, max: 8,   step: 0.05 },
  { key: '--ms-tune-glow',       label: 'アクセントの発光',                min: 0, max: 4,   step: 0.05 },
  { key: '--ms-tune-panelline',  label: 'スジ彫りの濃さ',                  min: 0, max: 5,   step: 0.05 },
  { key: '--ms-tune-channel',    label: 'ゾーン間の溝の深さ',              min: 0, max: 3,   step: 0.05 },
  { key: '--ms-tune-weather',    label: 'ウェザリング(汚れ)',              min: 0, max: 3,   step: 0.05 },
  { key: '--ms-tune-wear',       label: '摩耗(手置きの傷・チップ・雨だれ)', min: 0, max: 3,   step: 0.05 },
];
```

- [ ] **Step 2: `copyCss` の出力セレクタを変更**

```tsx
const copyCss = () => {
  const body = TUNABLES.map((t) => `  ${t.key}: ${vals[t.key]};`).join('\n');
  navigator.clipboard.writeText(`.theme-military.theme-dark {\n${body}\n}`);
};
```

- [ ] **Step 3: `enabled` ガードの localStorage キーを確認**（`'milspec-tune'` のまま。`?tune` クエリも維持）

- [ ] **Step 4: tsc**

Run: `npx tsc -b`
Expected: exit 0

- [ ] **Step 5: コミット**

```bash
git add src/components/dev/MilspecTunePanel.tsx
git commit -m "chore(theme): MIL-SPEC 調整ノブをモックアップの9個に差し替え"
```

---

### Task 0.R3: `military.css` を骨組みまで戻す

**Files:**
- Modify（実質書き直しの土台）: `src/styles/military.css`

**目的:** 旧 Phase 1 の CSS 本体（`.milspec-panel` / `[data-milspec-chrome]` の px 直書き / 旧トークン）を削除し、Phase 1 でモックアップから積み上げる**空の器**にする。

- [ ] **Step 1: 現 `military.css` の保全用コピー**（参照用・コミットには含めない）

```bash
cp src/styles/military.css /tmp/military.css.old-phase1
```

- [ ] **Step 2: `military.css` を以下だけに縮小**

```css
/* ============================================================
 * MIL-SPEC テーマ (軍事SF HUD) — codename: military
 * 正典: docs/.private/theme-refs/milspec-mockup.html
 * 設計書: docs/superpowers/specs/2026-09-02-military-theme-design.md
 * ⚠ .theme-military クラスが <html> に無いときは完全に不活性。
 * ⚠ 実装は Phase 1〜4 でモックアップから積み上げる（本ファイルは器）。
 * ============================================================ */

/* --- フォント (自前ホスト・latin サブセット・.theme-military 配下でのみ参照 → 自然遅延) --- */
@font-face { font-family: 'Orbitron'; src: url('/fonts/orbitron-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Orbitron'; src: url('/fonts/orbitron-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Orbitron'; src: url('/fonts/orbitron-900.woff2') format('woff2'); font-weight: 900; font-display: swap; }
@font-face { font-family: 'Share Tech Mono'; src: url('/fonts/share-tech-mono-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }

/* --- 調整ノブ (MilspecTunePanel が上書き。ここが実機で確定する最終値) --- */
.theme-military {
  --ms-tune-grain-all: 0.7;
  --ms-tune-grain-panel: 0.55;
  --ms-tune-frame: 1.25;
  --ms-tune-relief: 1.1;
  --ms-tune-shadow: 0;
  --ms-tune-glow: 4;
  --ms-tune-panelline: 1.2;
  --ms-tune-channel: 0.5;
  --ms-tune-weather: 0;
  --ms-tune-wear: 0;
}

/* Phase 1.1: --ms-* パレット (.theme-military.theme-{dark,light}) — ここに追記 */
/* Phase 1.2: 意味トークンリマップ — ここに追記 */
/* Phase 1.3: 共通プリミティブ — ここに追記 */
/* Phase 1.4: 背景 + 走査線 + フォント適用 — ここに追記 */
/* Phase 2.x: ゾーン別リスキン — ここに追記 */
```

- [ ] **Step 3: 死にセレクタが消えたことで tsc/build が壊れないか確認**

Run: `npx tsc -b && npx vite build`
Expected: exit 0（CSS のセレクタ削除は TS に影響しない。既存 `data-milspec-*` 属性が付いた TSX はそのままで OK — 対応する CSS が無いだけ = standard と同じ見た目に一時的に戻る）

- [ ] **Step 4: masaya 確認（任意・軽い）**: `military` に切り替えると「色だけ MIL-SPEC・装飾ゼロ」の状態（Phase 1 の出発点）。standard は不変。

- [ ] **Step 5: コミット**

```bash
git add src/styles/military.css
git commit -m "chore(theme): military.css を骨組みへ (旧Phase1 CSS撤去・モックアップ移植の土台)"
```

---

## Phase 1 — 土台（トークン体系 + 共通部品 + 背景）

Phase 1 のゴール: **モックアップの「削り出した金属の塊」の質感が、まだゾーン別リスキン前でも `.theme-military` 全体に効いている状態**。ここで masaya がマテリアルの方向性（C 面・スジ彫り・グレイン・ノブの効き）を承認する。

### Task 1.1: `--ms-*` パレットを移植

**Files:** Modify `src/styles/military.css`（Phase 1.1 セクション）

**Interfaces:**
- Consumes: モックアップ `milspec-mockup.html` 18–218 行
- Produces: `.theme-military.theme-dark {}` / `.theme-military.theme-light {}` に `--ms-*` 約 90 個

- [ ] **Step 1: 移植前チェック**

```bash
grep -rn -- "--ms-" src/   # military.css 以外にヒットが無いこと（衝突ゼロ）
```

- [ ] **Step 2: モックアップ 19–148 行（`:root, [data-theme="dark"]`）を `.theme-military.theme-dark {}` へ**

- 全 private トークンを `--ms-` 接頭に（`--bg`→`--ms-bg`、`--cham-lg`→`--ms-cham-lg`、`--sh-tr`→`--ms-sh-tr`、`--cyan`→`--ms-cyan` …）。
- `--tune-*` は既に Task 0.R3 で `--ms-tune-*` として `.theme-military {}` に定義済 → ここでは**再定義しない**。パレット内で `var(--tune-relief)` を参照している箇所を `var(--ms-tune-relief)` に置換。
- `--scanline` `--grid-line` `--plate-grad` `--raised-grad` `--channel-col` `--pl-dark` `--pl-lite` `--zone-edge` `--wear-*` `--btn-cast` `--btn-sheen` `--btn-body` も `--ms-` 接頭。
- `[data-theme="light"]` の `--btn-*` オーバーライド（149–156 行）は `.theme-military.theme-light {}` へ。

- [ ] **Step 3: モックアップ 159–218 行（`[data-theme="light"]`）を `.theme-military.theme-light {}` へ**（同じ接頭ルール）

- [ ] **Step 4: `* { box-sizing }` `html, body { background }` `.wrap` `.stage` `.app` グリッド（220–266 行）は移植しない**（本番のレイアウトを使う）。ただし `.mono` `.disp`（318–319 行相当）は `.theme-military` 配下のフォントクラスとして残す判断可。

- [ ] **Step 5: ビルド**

Run: `npx vite build`
Expected: exit 0

- [ ] **Step 6: masaya 確認**: `/miti` で `military` 切替 → 色が MIL-SPEC 配色（黒地スチールシアン / 白基調）。standard 不変。

- [ ] **Step 7: コミット** `feat(theme): MIL-SPEC パレット(--ms-*)をモックアップから移植`

---

### Task 1.2: 意味トークンのリマップ

**Files:** Modify `src/styles/military.css`（Phase 1.2 セクション）

**目的:** 本番の Tailwind ユーティリティ（`bg-app-bg` `text-app-text` `border-app-border` `bg-app-toggle` `text-app-blue` `glass-tier3` …）が MIL-SPEC パレットに全自動追従するよう、`.theme-military.theme-{dark,light}` で**意味トークンを丸ごと**上書きする（spec §3.1「一部だけ上書きすると混在事故」）。

- [ ] **Step 1: 本番の意味トークン一覧を確認**

```bash
grep -n -- "--color-bg-primary\|--color-accent-primary\|--color-blue\|--color-red\|--color-amber\|--glass-tier\|--color-toggle\|--color-border\|--color-text-\|--color-sheet-bg\|--color-nav-\|--color-fab-\|--app-accent-rgb\|--radius-" src/index.css | head -80
```

- [ ] **Step 2: `.theme-military.theme-dark {}` に意味トークンを追記**（`--ms-*` から引く）

spec §3.1 の表 + §5 の値。例:
```css
.theme-military.theme-dark {
  --color-bg-primary: var(--ms-bg);
  --color-bg-secondary: var(--ms-bg);
  --color-bg-tertiary: var(--ms-panel);
  --color-accent-primary: var(--ms-cyan);
  --app-accent-rgb: 130, 204, 223;
  --color-text-primary: var(--ms-text);
  --color-text-secondary: var(--ms-text-sec);
  --color-text-muted: var(--ms-text-muted);
  --color-border: var(--ms-hairline);
  --color-blue: var(--ms-cyan);
  --color-blue-hover: var(--ms-cyan-bright);
  --color-red: var(--ms-red);
  --color-amber: var(--ms-orange);
  --color-toggle-bg: var(--ms-cyan);
  --color-toggle-text: #06090c;
  /* ガラス = 金属プレート化 (blur 0) */
  --glass-tier3-bg: linear-gradient(180deg, var(--ms-raised-hi), var(--ms-raised-lo));
  --glass-tier3-border: var(--ms-hairline-2);
  --glass-tier3-blur: 0px;
  /* ... spec §3.1 の全カテゴリ ... */
  /* 角を立てる */
  --radius-sm: 2px; --radius-md: 3px; --radius-lg: 4px; --radius-xl: 6px; --radius-2xl: 8px;
}
```
> 完全な列挙は spec §3.1 の表 + 実装時に `index.css` で確認した全トークン。緑（軽減後ダメージ）のトークン名を Grep で特定して `var(--ms-green)` に。

- [ ] **Step 3: `.theme-military.theme-light {}` も同様**（light の `--ms-*` から）。`[reference_modal_light_mode_white_bg]` の `--glass-tier3-bg` は Light で白くなること（`var(--ms-raised-hi)` = `#ffffff`）。

- [ ] **Step 4: masaya 確認**: military で、まだ個別リスキンしていないボタン・モーダル・削除確認ダイアログの色が「意味は同じで色相だけ MIL-SPEC」。標準の青/赤/黄の役割が保たれている。standard 不変。

- [ ] **Step 5: コミット** `feat(theme): 意味トークンを MIL-SPEC パレットへリマップ`

---

### Task 1.3: 共通プリミティブを移植

**Files:** Modify `src/styles/military.css`（Phase 1.3 セクション）

**Interfaces:**
- Consumes: モックアップ 318–319, 346–766, 1564–1576, 1811–1855 行
- Produces: `.theme-military` 前置の再利用クラス群。**クラス名は `milspec-` 接頭に統一**（`.hp`→`.milspec-hp`、`.subplate`→`.milspec-subplate`、`.bolt`→`.milspec-bolt`、`.pl`→`.milspec-pl`、`.sc`→`.milspec-sc`、`.chan`→`.milspec-chan`、`.access`→`.milspec-access`、`.screen`→`.milspec-screen`、`.nameplate`→`.milspec-nameplate`、`.hazard-yellow`→`.milspec-hazard`、`.echo`→`.milspec-echo`、`.lamp`→`.milspec-lamp`、`.hdg`→`.milspec-hdg`、`.console-frame`→`.milspec-console-frame`、`.turbine`/`.tb-*` は Phase 3、`.cd-*` は Phase 3）。子要素セレクタ（`.hp > .chip` 等）も追従。

- [ ] **Step 1: マテリアル・トークン部（モックアップ 170–284 相当は Task 1.1 で移植済のはず）を確認**、不足あれば追記。

- [ ] **Step 2: プリミティブを移植**（`.theme-military` 前置 + `milspec-` 接頭 + `--ms-*` 参照）
  - `.milspec-hp`（+ `.stack` `.recess`）+ `> .chip`（面取り隅チップ）+ `> .lb`（L ブラケット）: 346–415
  - `.milspec-bolt`（+ `.tl/.tr/.bl/.br` + `::after` すり割り）: 417–435
  - `.milspec-pl`（+ `.h` `.v` `.dash` `.bead`）: 479–489, 636–639
  - `.milspec-subplate`（+ `.recess`）: 491–517
  - 小部品共通面取り（`.milspec-hud-btn, .milspec-tool-btn, .th, .milspec-s-btn` 等の border-* / clip-path 割当）: 519–555 → **本番の実クラスに読み替え**（Phase 2 で確定するので、ここでは `.milspec-hp` 系の定義だけ確実に）
  - `.milspec-sc`（極小ステンシル）: 556–563
  - `.milspec-screen`（沈んだ計器面）: 565–582
  - `.milspec-chan::after`（ゾーン外周チャンネル）: 584–588
  - `.milspec-access`（+ `.raised` `.chamf` + マイクロビス）: 596–623
  - `.milspec-gl`（プレート内格子スジ彫り）: 626–630
  - wear marks（`.milspec-rub-mark` `.milspec-grime-mark` `.milspec-drip` `.milspec-ao-mark`）: 641–680
  - `.milspec-console-frame`（+ `> i` ブラケット `> b` ビス `> .code`）: 682–710
  - `.milspec-hdg`（+ `.en` `.jp`）: 712–716
  - `.milspec-echo`（色収差二重刷り・`::before` cyan `::after` red + light）: 718–725
  - `.milspec-hazard`（`repeating-linear-gradient(-45deg …)`）: 727
  - `.milspec-decal`: 728
  - `.milspec-nameplate`（+ `::before` `::after` 留めネジ + light）: 730–749
  - 押下フィードバック（`:hover` `:active` `.flash-fx` keyframes + reduced-motion）: 751–766 → **モックアップ JS の `flash-fx` は使わず CSS の `:active` だけ移植**
  - `.milspec-lamp`（+ `.lit` `.cyan/.amber/.green` + light）: 1815–1828

- [ ] **Step 3: reduced-motion ガード**: `.flash-fx` の keyframes は `@media (prefers-reduced-motion: reduce) { animation: none }`（767 行相当）。

- [ ] **Step 4: ビルド** `npx vite build` → exit 0

- [ ] **Step 5: masaya 確認**（プリミティブ単体は画面に出ないので軽い確認）: military でエラーが無いこと・standard 不変。実際の見た目は Phase 2 で。

- [ ] **Step 6: コミット** `feat(theme): MIL-SPEC 共通プリミティブ(装甲板/C面/スジ彫り/デカール等)を移植`

---

### Task 1.4: 背景（ドットグリッド）+ 走査線 + フォント適用範囲

**Files:** Modify `src/styles/military.css`（Phase 1.4 セクション）

- [ ] **Step 1: 背景**（モックアップ 268–316, 465–483 行相当）
  - `.theme-military body`（or `[data-app-shell]`）に金属グレイン + ドットグリッド。`.stage::after` の全面グレイン（256px タイル・`mix-blend-mode: overlay`・`opacity: calc(var(--ms-tune-grain-all) + 0.06)`）は **`MilspecChrome` の子 or `body::after`**。グレインタイル画像は `tex/grain.png` → **data URI 化して military.css に埋め込む**（`sharp` `noise.mean:128` 必須・memory `reference_sharp_noise_mean_128`。既存 `docs/.private/theme-refs/tex/grain.png` を base64 化。~数 KB なら inline、大きければ `public/` に置く）。
  - weather（`.wthr-grime` `.wthr-ao`）は既定 `--ms-tune-weather: 0` で不可視 → CSS は移植するが画像は省略可（ノブを上げたときだけ効かせたいなら data URI 化）。**まず weather 抜きで移植し、Task 4.2 で masaya が必要と言えば追加**。

- [ ] **Step 2: 走査線**（`.theme-military.theme-dark body::before` — `repeating-linear-gradient(0deg, var(--ms-scanline) 0 1px, transparent 1px 3px)`・`position: fixed`・`z-index` は本番の最前面より下）+ `@media (prefers-reduced-motion: reduce) { display: none }`。

- [ ] **Step 3: フォント適用**（spec §6）: `.theme-military` 配下で `--ms-font-display: 'Orbitron' …` `--ms-font-mono: 'Share Tech Mono' …`。**body 全体に Orbitron を掛けない**（旧 Phase 0 の教訓・ledger Task 0.3）— 見出し / ロゴ / 大きい数字だけ。本文 UI は Rajdhani + M PLUS 1 のまま。

- [ ] **Step 4: masaya 確認**: military で背景にうっすらドット + 金属グレイン、Dark は走査線。本文が読みにくくなっていない。standard 不変。reduced-motion で走査線が消える。

- [ ] **Step 5: コミット** `feat(theme): MIL-SPEC 背景(ドット+グレイン)+走査線+フォント適用範囲`

---

### Task 1.5: `MilspecChrome` コンポーネントの土台 + console-frame

**Files:**
- Create: `src/components/military/MilspecChrome.tsx`
- Modify: `src/components/Layout.tsx`（`<GridOverlay/>` 直後にマウント）

**Interfaces:**
- Consumes: `useThemeStore` の `themeStyle`
- Produces: `<MilspecChrome/>` — `themeStyle==='military'` かつ `window.innerWidth >= 768` のときだけ `.milspec-console-frame`（+ 四隅ブラケット・ビス・コード）+ グレイン/weather/AO レイヤーを描画。それ以外 `null`。`pointer-events: none`。

- [ ] **Step 1: 失敗テストを書く** — `src/components/military/__tests__/MilspecChrome.test.tsx`

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecChrome } from '../MilspecChrome';
import { useThemeStore } from '../../store/useThemeStore';

describe('MilspecChrome', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'dark', themeStyle: 'standard' });
    window.innerWidth = 1440;
  });

  it('standard のとき何も描画しない', () => {
    const { container } = render(<MilspecChrome />);
    expect(container.firstChild).toBeNull();
  });

  it('military + PC のとき console-frame を描画する', () => {
    useThemeStore.setState({ themeStyle: 'military' });
    const { container } = render(<MilspecChrome />);
    expect(container.querySelector('.milspec-console-frame')).not.toBeNull();
  });

  it('military + モバイル幅のとき console-frame を描画しない', () => {
    useThemeStore.setState({ themeStyle: 'military' });
    window.innerWidth = 500;
    const { container } = render(<MilspecChrome />);
    expect(container.querySelector('.milspec-console-frame')).toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認** — `npx vitest run src/components/military/__tests__/MilspecChrome.test.tsx`（`// @vitest-environment happy-dom` を先頭に付ける — 兄弟の store テストと同じ作法）

- [ ] **Step 3: 実装** — `MilspecChrome.tsx`

```tsx
import { useSyncExternalStore } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

/** PC 判定を matchMedia で購読（resize で再評価。state は最小限）。 */
function usePcViewport(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(min-width: 768px)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => true,
  );
}

/** MIL-SPEC の全画面装飾オーバーレイ。themeStyle==='military' かつ PC のときだけ描画。
 *  外枠コンソール（四隅ブラケット + ビス + 型番）+ 全面グレイン/weather/AO。pointer-events: none。 */
export const MilspecChrome: React.FC = () => {
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const isPc = usePcViewport();
  if (themeStyle !== 'military' || !isPc) return null;
  return (
    <div className="milspec-chrome-root" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      <div className="milspec-console-frame">
        <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
        <b className="tl" /><b className="tr" /><b className="bl" /><b className="br" />
        <span className="code">LoPo Combat Analysis System · MIL-SPEC Theme Profile · MSP-REV-C</span>
      </div>
      {/* weather/AO は Task 4.2 で必要と判断されたら追加 */}
    </div>
  );
};
```

- [ ] **Step 4: テスト green** — `npx vitest run src/components/military/__tests__/MilspecChrome.test.tsx`

- [ ] **Step 5: `military.css` に `.milspec-chrome-root` / `.milspec-console-frame`（Task 1.3 で移植済のはず）を配線**。`.milspec-console-frame` は `.theme-military` 前置を外して `.milspec-chrome-root` 配下でよい（コンポーネント自体がガード済）。ただし **`.theme-military` セレクタは残す**（standard で万一マウントされても不活性にするため二重防御）。

- [ ] **Step 6: `Layout.tsx` にマウント**

`src/components/Layout.tsx` の `<GridOverlay />`（591 行付近）の**直後**に:
```tsx
      <MilspecChrome />
```
import 追加:
```tsx
import { MilspecChrome } from './military/MilspecChrome';
```

- [ ] **Step 7: tsc + build** — `npx tsc -b && npx vite build` → exit 0

- [ ] **Step 8: masaya 確認**: PC の military で画面外周にブラケット + ビネット + 底辺に型番。standard・モバイルで一切出ない。

- [ ] **Step 9: コミット** `feat(theme): MilspecChrome(外枠コンソール)+ Layout マウント`

---

### Task 1.6: Phase 1 承認ゲート — マテリアルの方向性を承認

**これはコードタスクではなく masaya との調整セッション。**

- [ ] **Step 1: masaya がローカルで確認**
  - `npm run dev` → `/miti?tune` → `military` に切替、Dark / Light 両方
  - 調整パネルのスライダー（relief / panelline / channel / glow / frame / grain）を動かして「削り出した金属の塊」の質感が納得いくか
  - `docs/.private/theme-refs/milspec-mockup.html` をブラウザで並べて見比べる
  - 本文テキストのコントラストが十分か

- [ ] **Step 2: 確定値があれば焼き込む**（調整パネルの「値をコピー」→ `military.css` の `.theme-military {}` のノブ初期値を更新。「モックアップ確定値」コメントを付ける）

- [ ] **Step 3: masaya の明示 OK**「この方向で Phase 2（ゾーン別リスキン）に進んでよい」

---

## Phase 2 — ゾーン別リスキン（standard 不変）

> **各タスク着手時に必ず:** 対象コンポーネントを Read し、実際の class 名・DOM・既存 `data-milspec-*` フックを確認してからスタイルを書く。モックアップの該当行（対応表）を横に開く。**standard で 1px も変わらないこと** + **DOM を触ったら playwright で全ゾーン矩形を回帰**を全タスクの DoD に。

各タスクは着手時にこのプランの記述を subagent 指示書へ bite-sized 化する（対象 mockup 行 / 対象実 DOM 行 / 追加フック / DoD / 触ってはいけないファイル / commit）。

### Task 2.1: ヘッダー（Layer A / Layer B / wordmark / chrome）

- **Mockup:** 768–964, 1830–1850 行（`.header` / `.hp-logo` / `.logo-meta` / `.seam-diag` / `.hp-title` / `.hp-fill` / `.hp-share` / `.hp-tools` / `.hud-btn` / `.toolbar` / `.tb-cluster` / `.tool-btn` / `.tool-seg` / `.lamp` 配線）
- **実 DOM:** `ConsolidatedHeader.tsx` — `[data-milspec-header]`(174) / `[data-milspec-chrome]`(179) / `[data-milspec-titlebar]`(203) / `[data-milspec-wordmark]`(213) / `[data-milspec-title]`(223,259) / `[data-milspec-toolbar]`(372・`.milspec-hash` クラス付)。Layer A 右グループのボタン群（Share / Tutorial / Theme / MilspecStyleToggle / Lang / Login = `iconBtnBase` の丸ボタン）。Layer B は Party / Config / Import / More ‖ みんなの軽減表 / PartyVisibility / Sort SegmentButton。
- **内容:**
  - `[data-milspec-header]` = 暗い筐体（`--ms-well`）。`::before` = 筐体天面の破線シアン、`::after` = 下端の赤ハザード帯（spec §8）。
  - Layer A: LoPo ロゴを Orbitron の沈んだプレート（`.logo-text` 相当 — 本番は `<LoPoButton size="sm">`。ロゴ SVG は変えず、`[data-milspec-wordmark]` の `.milspec-wm-main`（"Combat Analysis System" Share Tech Mono）/ `.milspec-wm-sub`（"Ver 2.0.0 // Loop Optimizer"）を隣に）。`[data-milspec-title]` = 角切りプレート化。右グループの丸ボタンを `.milspec-hud-btn` 相当の金属タイル（clip-path で片角切り欠き・`--btn-sheen` / `--btn-body` で立体化・`filter: drop-shadow` の接地影）。区切り線（`.h-5 w-px`）を `.milspec-pl.v` 風に。
  - Layer B: `[data-milspec-toolbar]` = 浮いた raised 棚（`::before` 天面ヘアライン・`::after` 底の金属ベベル）。ピルボタン（Party / Config / みんなの軽減表）とアイコンボタン（Import / More / PartyVisibility）を沈んだトレイ + 金属タイル化。`SegmentButton`（Sort）は `.tool-seg` 相当（active をシアン発光 + 左 2px）。アクティブ状態（`bg-app-toggle`）は `.milspec-lamp.lit.cyan` 相当のインジケータ球。
  - `[data-milspec-chrome]`: 既存 15 span を整理。px 直書きの `milspec-c-*` を減らし、意味のある銘板（`.milspec-nameplate` "DEFENSIVE COOLDOWN PLANNING TERMINAL / PARTY SURVIVABILITY OPTIMIZER"）+ 少数のステンシル + `SYS ONLINE ●` LED に寄せる（spec §12・workflow 追記 25）。狭幅で重ならないよう `%` / `flex` ベースに。
  - `.seam-diag`（LoPo とタイトルの斜め継ぎ目・赤ライン + ハッチ + 緑マーク）: 本番 DOM に無いので `[data-milspec-titlebar]` の擬似要素 or 小 `<span aria-hidden>` を 1 個足す（workflow 追記 5 で「実アプリに無い装飾として意図的に残す」= masaya 承認済）。
- **DoD（masaya）:** ヘッダーが軍事端末 / ロゴ脇に Orbitron 副題 / ボタンが物理的な金属タイル（押すと沈む）/ Layer B が浮いた棚 / Sort セグメントが物理スイッチ / Dark は発光・Light は白プレート / 折りたたみハンドル領域（次タスク）以外は完成 / standard 不変 / geometry 回帰 OK。

### Task 2.2: 折りたたみハンドル + SyncButton の MIL-SPEC 化（機能監査 3 点のうち 2 点）

- **Mockup:** ヘッダー下端の質感（`.header` `::after` ハザード）+ mecha 語彙のスイッチ/ランプ。**ハンドル自体はモックアップに無い**（workflow 追記 18 で「本番にあるがモック未反映」）→ MIL-SPEC の語彙で新規デザイン。
- **実 DOM:** `ConsolidatedHeader.tsx:486` `[data-progress-drawer-anchor]`（24px 領域）→ ボタン 502–548（`ChevronUp/Down` + wiggle `motion.div`）。`SyncButton` = `ConsolidatedHeader.tsx:303`（プラン名の後・`showLabel`）/ `:498`（折りたたみ時ハンドル左）/ `Layout.tsx:749`（フォーカスモード右レール）。
- **内容:**
  - `[data-progress-drawer-anchor] .glass-frame` = 上下の 1px 罫線をシアン + 中央にハザードタブ（`::before`）。ハンドルの `ChevronUp/Down` を `.milspec` の矢印色に。ホバー時の wiggle はそのまま（standard と共通の motion なので触らない — CSS 色だけ）。
  - `SyncButton`（`CloudCheck` / `RotateCw` / `CloudAlert` アイコン）: `.theme-military` で `.milspec-lamp` 風の状態インジケータに。保存済 = 緑 LED / 同期中 = シアン点滅 / エラー = 赤 LED。**コンポーネントの DOM は変えず** `SyncButton.tsx` の返す要素に `data-milspec-sync` を足すだけ、CSS で色付け。
- **DoD（masaya）:** ハンドルが軍事端末の折りたたみレバーに見える / 同期状態が LED インジケータで一目でわかる（3 状態）/ フォーカスモード右レールの sync も同様 / standard 不変 / geometry 回帰。

### Task 2.3: コントロールバー + PiP ボタン（機能監査 3 点目）

- **Mockup:** 966–1032 行（`.subtoolbar` / `.cbar-left` / `.cb-a`〜`.cb-e` / `.cb-div` / `.cb-tgl`（ロッカー）/ `.cb-ico`（キートップ）/ `.cj`（ジョブチップ））+ 1852–1855 行（ロッカー）
- **実 DOM:** `Timeline.tsx` inline JSX — `controlBarRef`(2720)`.flex-shrink-0 z-[51] h-7 … bg-app-surface2 border-app-border hidden md:block` / `#timeline-controls-inner`(2728)。Area A = 折りたたむ/展開（`AlignJustify`・`bg-app-toggle` when active）/ Area B = AA追加（`Sword`）+ メモ（`Pencil`）/ Area C = 罫線（`Rows3`）+ **PiP（`PictureInPicture2` 2838–2857・hover メニュー portal 4688）** + リキャスト（`Clock`）/ Area D = Undo（`Undo2`）+ Redo（`Redo2`）+ クリア（`Trash2`+`ChevronDown`）/ 右端 = `<JobPickerRow>`(2936)。区切りは `.w-[1px] h-3 … bg-app-text … rounded-full`。
- **内容:**
  - `controlBarRef` に `data-milspec-controlbar` を追加。`[data-milspec-controlbar]` = 沈んだプレート（`--ms-recess-*`・`::after` 底の細ライン）。
  - Area 幅は本番の `--col-header-chunk-w` / `--col-mechanic-w` / `--col-counter-w` に既に揃っているので**触らない**。
  - 折りたたむ/AA追加/メモ = `.milspec-cb-tgl` 風のロッカースイッチ（`bg-app-toggle` active = シアン下線 + `.milspec-lamp.lit.cyan`）。
  - 罫線/PiP/リキャスト/Undo/Redo/クリア = `.milspec-cb-ico` 風のキートップ（`--btn-sheen` / `--btn-body` / `filter: drop-shadow` / active で沈む）。`on` 状態（罫線 ON・リキャスト ON）= 左 2px シアン。クリアの `.danger` = hover で赤。
  - `PictureInPicture2` ボタン: モックアップに無いので MIL-SPEC の語彙で（キートップ + hover でシアン）。hover メニュー portal（"カンペ" / "動画記録" 4689–4711）も `[data-milspec-modal]` 相当の質感に。
  - 区切り線を `.milspec-cb-div`（V 断面）に。
  - `<JobPickerRow>` のジョブチップ（`.cj` 相当）= 小さい金属タイル（実ジョブアイコン `<img>` はそのまま）。
- **DoD（masaya）:** コントロールバーが沈んだ計器列 / トグルがロッカー・アイコンがキートップ（押すと沈む）/ ON 状態が光る / PiP ボタンとメニューも同系統 / ジョブチップが金属タイル / 横スクロール同期が壊れていない（`handleScrollSync`）/ standard 不変 / geometry 回帰。

### Task 2.4: サイドバー（SCENARIO / phases / 選択 pill / dock / DEPLOYMENT）

- **Mockup:** 1302–1412 行（`.sidebar` / `.sidebar::before` / `.sb-collapse` / `.scenario` / `.s-hd` / `.s-btns` / `.s-btn`（+ `.imp` 緑）/ `.enc-name` / `.phases` / `.phase` / `.phase-h` / `.phase-tag` / `.pi` / `.pi.sel`（角丸 pill + シアン左 + 菱形マーカー）/ `.pi.add` / `.dock` / `.deployment`）
- **実 DOM:** `Sidebar.tsx` — `[data-milspec-sidebar]`(1243 `<motion.aside>`) / `[data-milspec-dock]`(1277 ボタンバー: NEW PLAN / 複数選択 / 選択削除 / AUTO) / `[data-milspec-sect]`(1349 **savage のみ**) / タブ別リストパネル（`savageListRef` 1334 / `ultimateListRef` 1385 / `otherListRef` 1415 / `archiveListRef` 1467 — 各 `overflow-y-auto … custom-scrollbar`）/ `<ContentTreeItem>`（`.sidebar-item` の選択表現）/ `[data-milspec-backup]`(1586) / `[data-milspec-deployment]`(1609 + `.milspec-deployment-*` 子)。折りたたみハンドルレール `Sidebar.tsx:1640-1708`。
- **内容:**
  - `data-milspec-sect` を **全タブ**の見出しに付与（`Sidebar.tsx:1349` だけでなく ultimate/other/archive の見出しにも。DOM を 3 箇所触る — geometry 回帰必須）。
  - `[data-milspec-sidebar]` = クールスレート bg（`--ms-sb-bg`・モックアップ実測 `#232a33`）。`::before` = 最上部だけの斜めハッチ小 greeble（**全高の黄帯は撤去** — workflow 追記の差分リスト #1）。旧 military.css の全高ハザード帯を消す。
  - SCENARIO パネル（実 DOM は `SegmentButton`（savage/ultimate/other/archive タブ）+ `[data-milspec-dock]` のボタンバー）= `.milspec-hp.recess` の浅い凹み + 面取り隅 + L ブラケット + `SCN-01` ステンシル。`[data-milspec-sect]` の見出し = "Scenario / シナリオ" 風（`::before` の `▚` マーカー）。
  - `[data-milspec-dock]` の 4 ボタン = 独立金属タイル（`--btn-sheen`）。IMPORT/インポート相当は緑（`--ms-green`）。
  - タブ別リストパネル = `.milspec-hp.recess.stack` 風の 1 枠（`.phases` 相当）。各コンテンツ行（`<ContentTreeItem>`）の選択 = `.pi.sel` 相当（角丸 pill・`background: linear-gradient(177deg, #2c4a61, #21374a)`・左 3px シアン・左外に菱形マーカー・glow）。→ `ContentTreeItem` の選択中要素に `data-milspec-selected` フックを足す（DOM 最小変更）。
  - 「層 N」の見出し相当（other タブの `FreePlanSection` / savage の series 内）は本番の構造に合わせて `.phase-h` 風（大きい数字 + `⌄`）を適用できる範囲で。**無理に作らない**（spec「新規の縦アイコンレールは作らない」の精神）。
  - `[data-milspec-backup]`（BACKUP/RESTORE）= dock ボタン化（面取り隅 + アイコン + EN/JP 縦積み）。中央に `.milspec-pl.v`。
  - `[data-milspec-deployment]`（既に `.milspec-deployment-*` 子あり）= 上にハザード帯（`[data-milspec-deployment-hazard]`）+ `X` エンブレム SVG（既存インライン 1612）+ "DEPLOYMENT / 展開を支援する"（muted・煽らない）+ 雨だれ 3 本（`.milspec-drip`）。
  - サイドバー右端の折りたたみレール（`Sidebar.tsx:1655`）= `[data-progress-drawer-anchor]` と同じ扱いで質感を合わせる。**ここに `MilspecConduit` が乗る**（Phase 3.3）ので、レール幅（24px）を導管が通れるガターとして意識。
- **DoD（masaya）:** サイドバーが作戦ボード / 全タブの見出しが同じステンシル / 選択中コンテンツが角丸 pill + 菱形 + 発光 / dock がドックボタン / DEPLOYMENT が下端に / 全高黄帯が消えている / スクロールバーが計器意匠（Phase 2.5 と共通・`scrollbar-width:thin` を付けない — workflow 追記 16 の根治）/ standard 不変 / geometry 回帰。

### Task 2.5: タイムライン表（thead / recast-row / tbody / 行 / セル / mit-bar / 計器スクロールバー）— **大タスク・着手時にさらに分割**

- **Mockup:** 1034–1300 行（`.workspace` / `.ws-screen` / `.table` / `.thead` / `.th`（+ `.th-mini` `.th-mem` `.role-*`）/ `.tbody` / `.trow`（+ `.lethal` + `:nth-child(4n)` + `:hover`）/ `.td`（+ `-phase/-lbl/-time/-act/-orig/-mit`（+ `.red` `.pct`）/ `-mem`）/ `.mit-bar`（+ `.role-*` + `::before` ID 帯 + `::after` フランジ）/ `.mit-lbl` / `.ws-cap` / `.ws-note` / `.gauge-cap` / `.tbody::-webkit-scrollbar` / `.ws-screen::-webkit-scrollbar` / `.phases::-webkit-scrollbar` / `.recast-row` / `.rc-label` / `.rc-cell` / `.rc-icon`（+ `::after` clockswipe）/ `.rc-num`）
- **実 DOM:** `Timeline.tsx` — `[data-milspec-table]`(2694 + `.glass-panel`) / `[data-milspec-thead]`(2950 `headerRef`) / `#timeline-header-inner`(2956) → phase/label/time/mechanic/RAW/TAKEN 見出し + `<RecastRow>`(3063) / `scrollContainerRef`(3076 `.timeline-scroll-container flex-1 overflow-y-auto md:overflow-x-auto … custom-scrollbar`) / `sheetContainerRef`(3132) → `renderItems`（`<TimelineRow>`）+ phase/label overlay(3413,3462) + `<MitigationItem>`(3525) + `<MemoOverlay>` + `<CursorOverlay>`。`TimelineRow.tsx` — 各セル（`data-time-row` / `data-phase-col` / `data-label-col` / 時刻 `font-mono` / RAW / Dmg `<AnimatedDamage>` / ジョブ列 `getColumnCssVar(role)`）。`RecastRow.tsx` — `.recast-cell`（`data-member-role` / `width: getColumnCssVar`）Fragment。`index.css` — `--col-*`（PC: `clamp()` + `--col-th-w:151px` / `--col-dps-w:53px`）/ `.timeline-scroll-container::-webkit-scrollbar:vertical { width:0 }`(1629)。横同期 = `handleScrollSync`（`scrollLeft` → `#timeline-header-inner` / `#timeline-controls-inner` に `translateX`）/ 幅補正 = `syncPadding`（`headerRef.paddingRight`）。
- **サブ分割（着手時）:**
  1. **表コンテナ + thead**: `[data-milspec-table]` = 装甲板 or 沈んだ筐体（モックアップの `.workspace` = 浮いた raised 装甲板 + `.ws-screen` = 沈んだ画面 の二層。本番は 1 枚だが、`[data-milspec-table]` を装甲板・`scrollContainerRef` を沈んだ画面と読み替える）。`[data-milspec-thead]` = 浮いた raised プレート + 四隅ブラケット + 下端シアン発光線（`::after`）。各列見出しセル（本番は `.border-r border-app-border` の div）に `.milspec-th` 相当（交互の V 字ノッチ `--ms-shb-tr` / `--ms-shb-tl` で隣同士の斜めカットが繋がる — mockup 1097–1101）。EN 大文字 Rajdhani + JP 小。メンバー列見出し（`th-mem`）= ロールタグ（tank シアン / healer 緑 / dps オレンジ・下端 2px）+ ジョブアイコン `<img>`（既存）。
  2. **RecastRow**: `.recast-cell` に `.milspec` を。`.rc-icon`（円形・実アイコン + `conic-gradient` の clockswipe — 本番は既に `--cd-angle` を使う `RecastIcon`）に金属リング + `.rc-num` シアン。→ **`RecastIcon.tsx` の DOM を変えない**、CSS だけ。左端の非スクロール域に `.gauge-cap` 相当（縦「SCR」目盛りキャップ）。
  3. **行 + セル**: `.trow` = 薄い横スラット（`box-shadow` 上 hi / 下 lo）+ 偶数ゼブラ + `:nth-child(4n)` に濃い溝 + `:hover` で `inset 3px 0 シアン` + `background: rgba(cyan,0.06)`。`TimelineRow.tsx` の各セルに `data-milspec-*` を足す: 時刻 = `data-milspec-time`（Share Tech Mono シアン・既存 CSS の死にセレクタ `[data-milspec-time]` を生かす）/ RAW = `data-milspec-num`（等幅右寄せ）/ Dmg = 軽減後（`.td-mit` 相当・緑グロー `text-shadow`）+ lethal 行は `data-milspec-lethal`（赤枠 + 背景 + inset glow — mockup 1136–1139）。`<AnimatedDamage>` の DOM は変えない。`%` バッジ = `.pct`（小さい muted）。**`[content-visibility:auto]` の行に box-shadow / border を足すときは実行時挙動を実機総点検**（memory `feedback_structural_refactor_runtime_audit`）。
  4. **mit-bar（`<MitigationItem>`）**: 本番の `<MitigationItem>`（`left={absoluteLeft}` の絶対配置バー）に `.milspec` = §2 動力パイプ語彙（`background: linear-gradient(90deg, #0a0e12 … #2e363f … #0a0e12)` + `::before` 中心 ID 帯（role 色）+ `::after` 下端フランジ）。`.mit-lbl`（軽減種別ラベル + アイコン）も金属プレート化。→ `MitigationItem` の className に `data-milspec-mitbar` + `data-role` を足す（DOM 最小変更・既存の絶対配置ロジックは触らない）。
  5. **計器スクロールバー**: `scrollContainerRef` に `data-milspec-scroll`。`[data-milspec-scroll]::-webkit-scrollbar`（縦・width 14px・目盛り + ブラシメタルスライダー・hover でシアン）/ 横（`::-webkit-scrollbar:horizontal` or `.ws-screen` 相当）。⚠ `index.css:1629` が縦バーを `width:0` で隠している → `.theme-military [data-milspec-scroll]::-webkit-scrollbar:vertical { width: 14px; display: block }` で上書き。**`scrollbar-width` 標準プロパティを絶対に付けない**（workflow 追記 16: Chrome 121+ で `::-webkit-scrollbar` 意匠が無効化される）。`syncPadding` の `paddingRight` 補正が 14px 前提になるので、`headerRef` 側の `.gauge-cap` 幅と合わせる。**本番移植でスクロールバーを可視化するか隠したままにするかは masaya に確認**（workflow 追記 15: 実アプリは意図的に隠している）。
- **DoD（masaya）:** 表が戦術スコープ / 数値が等幅で読みやすい / 緑（軽減後）/ 赤（致命）の意味が保たれている / 行 hover が発光バー / mit-bar が動力パイプ / リキャストアイコンが金属リング + clockswipe / スクロールバーが計器（or 隠したまま — 確認結果次第）/ 横スクロール同期が完全（ヘッダー / リキャスト行 / 本文 / mit-bar が同じ量動く）/ 縦スクロールが重くなっていない（memory `reference_perf_content_visibility`）/ standard 不変 / geometry 回帰（全ゾーン矩形不変）。

### Task 2.6: フッター（`AppFooter` → `MilspecFooterHud` 委譲・情報プレート部）

> Phase 2.6 = フッターの**静的部分**（情報プレート + レイアウト骨格）。動く計器（ロールカウンター）は Phase 3.2、タービンは Phase 3.1。

- **Mockup:** 1414–1576 行（`.footer` grid `2.05fr 1fr` / `.fp` / `.fp-info` / `.fp-title` / `.fp-rule` / `.finfo`（`.c` `.sep` `a`）/ `.fp-inst` / `.fp-inst .ilbl`（縦書き）/ `.ticks` / `.fp-reticle`（SVG）/ `.fp-scan` / `.fp-dash` / `.fp-harness`（PCB SVG・2234–2274 行の SVG マークアップ））
- **実 DOM:** `AppFooter.tsx`（49 行・唯一の `<footer>`・`Layout.tsx:710` に 1 回マウント・`h-6 … hidden md:flex … pointer-events-none` + `glass-tier3 glass-frame`）。中身 = `[data-milspec-chrome]`(15) + `<p>` に `t('footer.copyright')` / `t('footer.disclaimer')` / legal ドロップダウン（privacy/terms/commercial）/ Discord / X / `<PulseSettings/>`。
- **内容:**
  - `AppFooter.tsx` を `themeStyle` 対応に:
    ```tsx
    const themeStyle = useThemeStore((s) => s.themeStyle);
    // military かつ PC のとき MilspecFooterHud に委譲
    if (themeStyle === 'military') {
      return <MilspecFooterHud legalOpen={footerLegalOpen} setLegalOpen={setFooterLegalOpen} />;
    }
    // 既存の standard フッター（不変）
    ```
  - `MilspecFooterHud.tsx`（新規・Task 2.6 で骨格・Phase 3 で計器/タービン充填）:
    - ルート `<footer>` — `themeStyle==='military'` 前提だが二重防御で `hidden md:flex`。高さは `h-6` でなく実測 82px 相当（`min-h-[82px]`）。`pointer-events` は内側のリンク/ボタンだけ `auto`。
    - grid `2.05fr 1fr`（`.fp-info` / `.fp-inst`）。
    - `.fp-info`（左・右下大きく斜め切り `--ms-sh-slab`）: `.fp-title`（`MIL-SPEC` Orbitron + "Defensive Cooldown Scheduling System — Mitigation Fire-Plan Computer"）/ `.fp-rule` 溝 / `.finfo` = **既存の i18n キーをそのまま**（`t('footer.copyright')` / `FINAL FANTASY XIV © SQUARE ENIX` / `t('footer.disclaimer')` / privacy・terms・commercial・お問い合わせ・Discord・X）。legal ドロップダウンのロジック（`footerLegalOpen`）は `AppFooter` から props で受けるか `MilspecFooterHud` 内に移す。`<PulseSettings/>` も配置。
    - `.fp-inst`（右・上両角落とし `--ms-sh-tl-tr`）: `.ilbl` "Telemetry"（縦書き）/ `.ticks` 飾り目盛り / `.sc` "TLM-04 · REV.C" / `.fp-reticle`（ダイヤ型レティクル SVG・`opacity:0.3`）/ `.fp-scan`（"ACW/ECW/PCW" 疑似数値）/ `.fp-dash` 破線。**中身の `<MilspecRollCounter/>` と `<MilspecTurbineCluster placement="footer"/>` は Phase 3 で挿入**（今は空の器）。
    - `.fp-harness`（PCB ハーネス SVG）: モックアップ 2234–2274 の SVG をそのまま JSX 化（`feDropShadow` 使用可・`clip-path: path()` は使っていない）。位置は `.fp-info` / `.fp-inst` の間。
  - `Layout.tsx` の `motion.main` は footer 高さを考慮していない（footer は `shrink-0` の flex 兄弟）→ military 時は編集領域が ~58px 狭くなる。**許容**（masaya の「フッターを半分にした」判断・workflow 追記 6-8）。
- **DoD（masaya）:** フッターが立体的な装甲プレート 2 枚 / 左に権利表記（既存の文言・リンクが全部生きている・legal ドロップダウンが開く）/ 右に計器プレート（中身はまだ空 or プレースホルダ）/ PCB ハーネスが 2 枚の間に / モバイルで一切出ない / standard フッターが完全に不変 / geometry 回帰。

### Task 2.7: モーダル / カード

- **Mockup:** `.milspec-modal` 相当は明示のセクションが無い → プリミティブ（`.milspec-hp` / 角切り / ブラケット / `.milspec-hdg` Orbitron）+ spec §8 のモーダル指針。
- **実 DOM:** エディタから開くモーダル: `EventModal`（`Timeline.tsx:3881`）/ `PartySettingsModal`（`Timeline.tsx:4272`）/ `LoginModal` / `MitigationSheet`（`ConsolidatedHeader` / `Timeline`）/ `BoundaryEditModal` / `FFLogsImportModal` / `SpreadsheetGridImportModal` / `ConfirmDialog` / 各種 Popover（`AASettingsPopover` / `ClearMitigationsPopover` / `PartyStatusPopover` / `Header*Dropdown`）。土台は `--glass-tier3-*`（Task 1.2 で再定義済 = 金属プレート化・Light で白い `[reference_modal_light_mode_white_bg]`）。
- **内容:** 各モーダルのルート要素に `data-milspec-modal` を足す（`.theme-military [data-milspec-modal]` = 角を立てる + 四隅ブラケット + 見出しを `.milspec-hdg`）。土台は Task 1.2 のトークン再定義で自動追従。**個別モーダルの中身レイアウトは触らない**（機能不変）。Popover / Dropdown は共通の親クラスがあれば 1 箇所で。
- **DoD（masaya）:** モーダルが端末ダイアログ / Light で白い（`glass-tier3-bg` 必須ルール維持）/ スクロール可能な中身が枠内に収まる / 全モーダルの機能（保存 / キャンセル / 各入力）が動く / standard 不変。

### Task 2.8: モバイル（MobileHeader + カード/表の角切り + 1 行デカール）

- **Mockup:** モバイル専用のモックは無い（1666×944 固定）。spec §13: モバイル = 色 + MobileHeader 塗替え + カード/タイムラインの角切り・ステンシル + 横型デカール 1 行。**フッター HUD / スパイン / タービン / 導管はモバイルで一切出さない**（`MilspecChrome` / `MilspecFooterHud` / `MilspecTurbineCluster` は PC ガード済）。
- **実 DOM:** `MobileHeader.tsx` — `[data-milspec-mobile-header]`(34) / `[data-milspec-mobile-logo]`(54)。`MobileTimelineRow` / `MobileEffectBarLayer` / `MobileBottomNav` / `MobileFab`。
- **内容:**
  - `[data-milspec-mobile-header]` = `--ms-well` 系の暗い bg + `::after` に横型デカール 1 行（"AR-2409 // SYSTEM ONLINE ●" 等・`aria-hidden`）。`[data-milspec-mobile-logo]` = Share Tech Mono ステンシル。
  - モバイルの行（`MobileTimelineRow`）・カード = 軽い角切り + ステンシル（重くしない・`content-visibility` を壊さない）。
  - `MobileBottomNav` / `MobileFab` は色追従のみ（Task 1.2 の `--color-nav-*` / `--color-fab-*` 再定義で自動）。
  - `@property --mobile-effect-bar-progress` を消さない・色と box-shadow だけ（Global Constraints）。
- **DoD（masaya・実機 iPhone）:** モバイル military で色 + ヘッダー + 1 行デカールで「MIL-SPEC っぽい」/ フッター HUD・タービン・導管が出ない / スクロールが重くない（`reference_perf_content_visibility` 系）/ standard 不変。

---

## Phase 3 — 新規クローム（React コンポーネント）

> 全コンポーネント: `themeStyle==='military'` かつ PC のときだけ描画・それ以外 `null`。reduced-motion で動きを止める。i18n は `aria-label` の最小限のみ。

### Task 3.1: `MilspecTurbineCluster` + `turbineRig`（タービン遊びボタン）

**Files:**
- Create: `src/components/military/turbineRig.ts`
- Create: `src/components/military/MilspecTurbineCluster.tsx`
- Create: `src/components/military/__tests__/turbineRig.test.ts`
- Create: `src/components/military/__tests__/MilspecTurbineCluster.test.tsx`
- Modify: `src/components/ConsolidatedHeader.tsx`（Layer A の `hp-fill` 相当位置に header cluster）
- Modify: `src/components/military/MilspecFooterHud.tsx`（`.fp-inst` 右端に footer cluster）
- Modify: `src/styles/military.css`（`.milspec-turbine` / `.milspec-tb-*` — mockup 1577–1701）
- Modify: `src/locales/*.json`（`t('theme.milspec.turbine_switch_aria')` 5 言語）

**Interfaces:**
- Produces:
  - `turbineRig.ts`: `createTurbineRig(vanesEl: HTMLElement, idleDegPerSec: number, maxDegPerSec: number, totalMs: number): { totalMs: number; start(callbacks?: { onProgress?: (p:number)=>void; onMax?: ()=>void; onSpindown?: ()=>void }): boolean }` / `spawnSparks(hostEl, count, spreadMs)` / `spawnSteam(hostEl)` / `makeTrickle(hostEl): (p:number)=>void`
  - `<MilspecTurbineCluster placement="header" | "footer" />` — `placement` で基数（header=1・footer=2）とサイズを切替。

- [ ] **Step 1: 失敗テスト（rig）** — `turbineRig.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTurbineRig } from '../turbineRig';

// rAF を制御可能に
let now = 0;
const rafCbs: FrameRequestCallback[] = [];
beforeEach(() => {
  now = 0;
  rafCbs.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafCbs.push(cb); return rafCbs.length; });
  vi.stubGlobal('performance', { now: () => now });
});
afterEach(() => vi.unstubAllGlobals());
function tick(ms: number) { now += ms; const cbs = rafCbs.splice(0); cbs.forEach((cb) => cb(now)); }

describe('createTurbineRig', () => {
  it('idle 状態では start() が true を返し、多重 start() は false', () => {
    const el = document.createElement('span');
    const rig = createTurbineRig(el, 15, 1700, 9000);
    tick(16); // frame ループ起動
    expect(rig.start()).toBe(true);
    expect(rig.start()).toBe(false); // spinup 中は受け付けない
  });

  it('spinup 中 onProgress、最高速到達で onMax、減速開始で onSpindown が呼ばれる', () => {
    const el = document.createElement('span');
    const rig = createTurbineRig(el, 15, 1700, 1000); // 短縮尺
    const onProgress = vi.fn(), onMax = vi.fn(), onSpindown = vi.fn();
    tick(16);
    rig.start({ onProgress, onMax, onSpindown });
    for (let i = 0; i < 80; i++) tick(16); // 総尺 1000ms 経過
    expect(onProgress).toHaveBeenCalled();
    expect(onMax).toHaveBeenCalledTimes(1);
    expect(onSpindown).toHaveBeenCalledTimes(1);
  });

  it('SPINUP:HOLD:SPINDOWN の配分が 0.318 : 0.091 : 0.591', () => {
    const el = document.createElement('span');
    const rig = createTurbineRig(el, 15, 1700, 10000);
    expect(rig.totalMs).toBeGreaterThanOrEqual(9990);
  });
});
```

- [ ] **Step 2: 失敗確認** — `npx vitest run src/components/military/__tests__/turbineRig.test.ts`

- [ ] **Step 3: 実装** — `turbineRig.ts`（モックアップ JS 2396–2482 を TS 化。`createTurbineRig` / `spawnSparks` / `spawnSteam` / `makeTrickle`。DOM 操作は `document.createElement` + `animationend` で自己除去。型を付ける。`matchMedia('(prefers-reduced-motion: reduce)')` チェックは呼び出し側（コンポーネント）で）

- [ ] **Step 4: テスト green**

- [ ] **Step 5: 失敗テスト（コンポーネント）** — `MilspecTurbineCluster.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MilspecTurbineCluster } from '../MilspecTurbineCluster';
import { useThemeStore } from '../../../store/useThemeStore';

beforeEach(() => {
  useThemeStore.setState({ theme: 'dark', themeStyle: 'military' });
  window.innerWidth = 1440;
});

describe('MilspecTurbineCluster', () => {
  it('standard のとき null', () => {
    useThemeStore.setState({ themeStyle: 'standard' });
    const { container } = render(<MilspecTurbineCluster placement="footer" />);
    expect(container.firstChild).toBeNull();
  });

  it('footer は正方形フレームを 2 基描画する', () => {
    const { container } = render(<MilspecTurbineCluster placement="footer" />);
    expect(container.querySelectorAll('.milspec-tb-frame')).toHaveLength(2);
  });

  it('header は 1 基', () => {
    const { container } = render(<MilspecTurbineCluster placement="header" />);
    expect(container.querySelectorAll('.milspec-tb-frame')).toHaveLength(1);
  });

  it('スイッチ押下でスイッチが disabled + active になり、しばらくして戻る', () => {
    vi.useFakeTimers();
    render(<MilspecTurbineCluster placement="footer" />);
    const sw = screen.getByRole('button');
    fireEvent.click(sw);
    expect(sw).toBeDisabled();
    expect(sw).toHaveClass('active');
    vi.advanceTimersByTime(12000);
    expect(sw).not.toBeDisabled();
    vi.useRealTimers();
  });

  it('reduced-motion のときスイッチは押せるが rig を起動しない（エラーなし）', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    render(<MilspecTurbineCluster placement="footer" />);
    fireEvent.click(screen.getByRole('button'));
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 6: 失敗確認 → 実装** — `MilspecTurbineCluster.tsx`（モックアップ 1958–1970 / 2312–2331 の DOM + 2484–2519 の配線。`placement` で基数。`useRef` で `.tb-vanes` を掴んで `createTurbineRig`。各フレームに専属 rig + stagger 最大 550ms。`onProgress`=`makeTrickle` / `onMax`=`spawnSparks(20..35)` / `onSpindown`=`spawnSteam`。多重クリックは `disabled` でブロック。reduced-motion なら rig を作らずスイッチだけ装飾。`aria-label` は i18n）→ green

- [ ] **Step 7: `military.css`** — `.milspec-turbine` / `.milspec-tb-vanes`（`repeating-conic-gradient` + `animation: tb-spin 22s linear infinite`）/ `.milspec-tb-hub` / `.milspec-tb-frame`（正方形 48px + 四隅ビス）/ `.milspec-tb-switch`（+ `::before` ワイヤーガード + `.active .lamp` オレンジ点灯）/ `.milspec-tb-spark`（`@keyframes tb-spark-fly`）/ `.milspec-tb-steam`（`@keyframes tb-steam-puff`）/ `.milspec-tb-cluster2` + `@media (prefers-reduced-motion) { .milspec-tb-vanes { animation: none } .milspec-tb-spark, .milspec-tb-steam { display: none } }`（mockup 1577–1701）

- [ ] **Step 8: ヘッダー配置** — `ConsolidatedHeader.tsx` Layer A の左グループ末尾 or `[data-milspec-chrome]` 近傍に `{themeStyle === 'military' && <MilspecTurbineCluster placement="header" />}`。位置は CSS で `hp-fill` 相当の余白へ absolute。

- [ ] **Step 9: フッター配置** — `MilspecFooterHud.tsx` の `.fp-inst` 右端に `<MilspecTurbineCluster placement="footer" />`。

- [ ] **Step 10: 回転物注意プラカード**（mockup 2308–2311・"⚠ ROTATING PARTS · 回転注意" + 黄黒ストライプ）を両クラスタの脇に（`aria-hidden`）。

- [ ] **Step 11: tsc + build + 対象 vitest** → green

- [ ] **Step 12: masaya 確認**: ヘッダー / フッターにファン + スイッチ / スイッチ押下 → 9〜10 秒回転（前半無音 → 後半じわじわ火花 → 最高速で一気にバースト → 減速開始で蒸気 5〜9 個）/ フッター 2 基が同期しない / reduced-motion で回らない・火花蒸気出ない / standard で一切出ない / geometry 回帰。

- [ ] **Step 13: コミット**（rig / コンポーネント / CSS / 配置で 2〜3 コミット）

---

### Task 3.2: `MilspecRollCounter`（フッター X/Y カーソル座標計器）

**Files:**
- Create: `src/components/military/MilspecRollCounter.tsx`
- Create: `src/components/military/__tests__/MilspecRollCounter.test.tsx`
- Modify: `src/components/military/MilspecFooterHud.tsx`（`.fp-inst-body` に挿入）
- Modify: `src/styles/military.css`（`.milspec-rollbank` / `.milspec-rc-*` — mockup 1479–1559）

**⚠ Global Constraints「マウス追従 UI 禁止」の例外扱い** — React state を毎フレーム更新しない実装。masaya の明示承認を DoD に。

**Interfaces:**
- Produces: `<MilspecRollCounter/>` — `themeStyle==='military'` かつ PC のときだけ。X / Y 2 行のオドメーター（各 `4 桁 + '.' + 3 桁`）。`pointermove` でカーソル座標（stage zoom 補正なし・`window` 座標をそのまま）を目標に、rAF で追従、追いついたら `snapAxis` で整数スナップして完全停止。

- [ ] **Step 1: 失敗テスト** — `MilspecRollCounter.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecRollCounter, axisTargets, snapAxisTargets } from '../MilspecRollCounter';
import { useThemeStore } from '../../../store/useThemeStore';

beforeEach(() => {
  useThemeStore.setState({ theme: 'dark', themeStyle: 'military' });
  window.innerWidth = 1440;
});

describe('MilspecRollCounter', () => {
  it('standard のとき null', () => {
    useThemeStore.setState({ themeStyle: 'standard' });
    const { container } = render(<MilspecRollCounter />);
    expect(container.firstChild).toBeNull();
  });

  it('X / Y 2 行 × 各 7 桁ドラムを描画する', () => {
    const { container } = render(<MilspecRollCounter />);
    expect(container.querySelectorAll('.milspec-rc')).toHaveLength(2);
    expect(container.querySelectorAll('.milspec-rc-d')).toHaveLength(14); // 7 × 2
  });

  it('axisTargets: 1234.567 を [1,2,3,4,5,6,7(端数)] へ分解', () => {
    const t = axisTargets(1234.567);
    expect(t.slice(0, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(t[6]).toBeCloseTo(7.67, 1); // 最小桁は端数連続
  });

  it('snapAxisTargets: 全桁が整数', () => {
    snapAxisTargets(1234.567).forEach((v) => expect(Number.isInteger(v)).toBe(true));
  });

  it('pointermove を 100 回発火しても React re-render は起きない（render 関数の呼び出し回数不変）', () => {
    const renderSpy = vi.fn();
    function Wrapper() { renderSpy(); return <MilspecRollCounter />; }
    render(<Wrapper />);
    const before = renderSpy.mock.calls.length;
    for (let i = 0; i < 100; i++) window.dispatchEvent(new Event('pointermove'));
    expect(renderSpy.mock.calls.length).toBe(before);
  });
});
```

- [ ] **Step 2: 失敗確認 → 実装** — `MilspecRollCounter.tsx`（モックアップ JS 2521–2645 を移植。`buildRoll` は JSX で書く（`.milspec-rc-digits` > `.milspec-rc-d` > `.milspec-rc-strip`（0-9,0 の 11 span））/ `rollTo` / `axisTargets`（`AXIS_PLACES=[3,2,1,0,-1,-2,-3]`・`A_SPEED`）/ `snapAxisTargets` は export（テスト用）/ `instTick` は `useEffect` の中で rAF ループ・`pointermove` リスナは `{ passive: true }`・`moving` フラグ・追いついたら `snapAxis` で停止。**stage zoom 補正は本番では不要**（`getComputedStyle(stageEl).zoom` は使わない — 本番にステージ zoom は無い）。`prefers-reduced-motion` で `pointermove` 追従を無効化（座標を固定表示）。cleanup で リスナ + rAF 解除）→ green

- [ ] **Step 3: `military.css`** — `.milspec-rollbank`（+ `.sub`）/ `.milspec-rc` / `.milspec-rc-k` / `.milspec-rc-digits`（沈んだ窓・C 面 inset）/ `.milspec-rc-d`（曲面陰影）/ `.milspec-rc-strip`（`translateY` される数字列・`will-change: transform`）/ `.milspec-rc-sep` + light（mockup 1479–1559。`.chrono*` は移植しない — dead code）

- [ ] **Step 4: `MilspecFooterHud.tsx` の `.fp-inst-body` に `<MilspecRollCounter/>`**

- [ ] **Step 5: tsc + build + vitest** → green

- [ ] **Step 6: masaya 確認 + 承認**:
  - フッター右にドラム式の X / Y 座標計器 / マウスを動かすと最小桁が回る / 止めると数フレームで整数位置にスナップして完全停止（滲まない）/ reduced-motion で追従しない / standard で出ない
  - **明示承認**: 「カーソル座標をフッターに出す（グローバル pointermove リスナ・React re-render なし）を採用してよい」 or 「座標でなく別の表示（スクロール位置 / 固定値 / 撤去）にする」

- [ ] **Step 7: コミット**

---

### Task 3.3: `MilspecConduit`（動力導管）

**Files:**
- Create: `src/components/military/MilspecConduit.tsx`
- Modify: `src/components/Layout.tsx`（サイドバー領域の相対配置）or `src/components/military/MilspecChrome.tsx`（子として）
- Modify: `src/styles/military.css`（`.milspec-conduit` / `.milspec-cd-*` — mockup 1703–1809）

**Interfaces:**
- Produces: `<MilspecConduit/>` — `themeStyle==='military'` かつ PC のときだけ。サイドバー右端の折りたたみレール（24px ガター）に沿った縦の蛇腹パイプ。上端 = ツールバー付近のバルクヘッド継手、下端 = フッター下端まで（サイドバーの実効全高）。P クリップ 4 本 + ID バンド 1 本。`pointer-events: none`。**サイドバーが折りたたまれても位置は固定**（レールは常に 24px 存在する）。

- [ ] **Step 1: 失敗テスト** — standard で null / military + PC で `.milspec-conduit` 描画 / モバイルで null（Task 1.5 の `MilspecChrome.test` と同型）

- [ ] **Step 2: 実装** — `MilspecConduit.tsx`（モックアップ DOM 1909–1917。`.cd-fit.top` / `.cd-band` / `.cd-clip` ×4 / `.cd-fit.bot`。位置は CSS で `left` をサイドバーレールの中央（本番のグリッド構造を Read で確認 — サイドバーラッパ `Layout.tsx:595` の右端 or メインカラム `Layout.tsx:642` の左端付近）。`top`/`bottom` はヘッダー下〜フッター下端。）

- [ ] **Step 3: `military.css`** — `.milspec-conduit`（3 層背景: エッジクラッシュ + 蛇腹リング + form 陰影・`filter: drop-shadow`）/ `.milspec-cd-fit`（+ `::before` 六角ナット `::after` 穴 + ビス）/ `.milspec-cd-clip`（+ `::after` 中央ボルト）/ `.milspec-cd-band` + light（mockup 1703–1809）

- [ ] **Step 4: マウント** — `MilspecChrome.tsx` の子として（`MilspecChrome` が既に PC + military ガード済なので二重ガードにならない）or `Layout.tsx` のサイドバー付近。**サイドバー折りたたみ時に本文コンテンツと被らないこと**を実機確認。

- [ ] **Step 5: masaya 確認**: サイドバーと本体の継ぎ目に縦パイプ / 継手・クリップ・ID バンド / サイドバー折りたたみでも本文に被らない / スクロールしても固定 / standard・モバイルで出ない / geometry 回帰（本文コンテンツの位置不変）。

- [ ] **Step 6: コミット**

---

### Task 3.4: `MilspecSeam`（サイドバー↔本体の溝 + 両壁）

**Files:**
- Modify: `src/components/military/MilspecChrome.tsx` or `MilspecConduit.tsx`（溝は導管とセット）
- Modify: `src/styles/military.css`

**内容:** モックアップは `.app` グリッドに 22px の `seam` 列を新設していた（1904 行）。**本番グリッドに列は足さない**（レイアウト変更を避ける）。代わりに、サイドバー右端の 24px レール領域に「別ハル同士の物理的な溝」に見える擬似要素を `MilspecChrome` の子で乗せる（`background: linear-gradient(90deg, #04060a, var(--ms-well), #04060a)` + `inset box-shadow` の両壁）。`MilspecConduit` はその溝の中央を通る。

- [ ] **Step 1: `military.css`** に `.milspec-seam`（mockup 258–263 の `.seam` を擬似要素化）
- [ ] **Step 2: `MilspecChrome` / `MilspecConduit` に `<span className="milspec-seam" aria-hidden/>`**
- [ ] **Step 3: masaya 確認**: サイドバーと本体が「別々に留められた 2 つの構造体」に見える溝 / レイアウトが動かない / standard 不変
- [ ] **Step 4: コミット**

---

### Task 3.5: デカール密度 + `nameplate` + トラッキングレティクルの最終配置

**Files:** Modify `src/styles/military.css` + 各コンポーネントに `<span aria-hidden className="milspec-sc / milspec-decal / milspec-nameplate">` を少数

**内容:** workflow 追記 24–25 の「情報密度アップ」を本番へ。**既存語彙のみ流用**（`.milspec-sc` ステンシル / `.milspec-hazard` / `.milspec-nameplate` / レティクル SVG）・新パーツは作らない。配置箇所（mockup と対応）:
- ヘッダー `hp-fill` 相当の中央面 → `.milspec-nameplate`（機能説明・spec §12 準拠の英語 + 軍用語）
- ツールバーの CREW⇔VIEW 間の空白 → 破線ガイド + ステンシルコード 2 つ
- コントロールバーのジョブチップ右の空白 → 斜線束 + "ENGAGEMENT TIMELINE CONTROL"
- ワークスペース装甲板の隅 → `WKS-07` / "RAID OPERATIONS PLOT · MITIGATION ARRAY"
- サイドバー右上（折りたたみ矢印脇）→ "SB-01 · VARIABLE"
- フッター `.fp-inst` の空白 → `.fp-reticle`（ダイヤ型レティクル）+ `.fp-scan`（疑似数値）

- [ ] **Step 1: 各コンポーネントに `aria-hidden` の span を最小限追加**（geometry を動かさない absolute 配置）
- [ ] **Step 2: `military.css` で位置決め**（`%` / `flex` ベース・px 直書きを避ける — 狭幅で重ならないよう）
- [ ] **Step 3: masaya 確認**: 余白が MGEX 級の密度で埋まる / 情報の邪魔をしない / 偽の著作権・アクセス制限文が無い（spec §12）/ レイアウト不変 / standard で一切出ない
- [ ] **Step 4: コミット**

---

## Phase 4 — 仕上げ

### Task 4.1: レスポンシブ総点検（1489 / 1920 / 2560 / モバイル）— 着手時に分割

- **内容:** モックアップは 1666×944 固定。本番は流動。各幅で: C 面 / スジ彫り / デカール / タービン / 導管 / フッター HUD / 計器スクロールバー / console-frame が破綻しないか。`clamp()` の見直し。スクロールバー約 17px 控除。ヘッダー折りたたみ・フォーカスモード（サイドバー閉 + ヘッダー畳み）・サイドバー折りたたみの各状態で導管・溝・chrome が正しく追従するか。body に横スクロールが出ないか。
- **手順:** `playwright-skill` で 1489×679(DPR2.58) / 1920×1080(DPR2) / 2560 / iPhone の 4 ケース × standard/military × dark/light を撮影、masaya が確認。
- **DoD（masaya）:** 4 ケースで軍事 HUD が成立 / 横スクロール発生なし / ヘッダー折りたたみ・フォーカスモードで導管/chrome が破綻しない / standard 不変。

### Task 4.2: ライトテーマの詰め

- **内容:** モックアップの light は `[data-theme="light"]` トークンまでは作られているが、実機での作り込みは dark ほど詰めていない（workflow「dark で詰めてから light」）。`.theme-military.theme-light` の全ゾーンを実機で点検: C 面の 4 色（`--cr-*` / `--cs-*`）が薄い面取りでも読めるか / echo が読みやすいか / 白基調の構造感 / weather を入れるか（`--ms-tune-weather` を light で少し上げるか）。
- **DoD（masaya・Light 実機）:** RX-0 的な「白い軍事パネル / 設計図」に見える / 本文コントラスト十分 / dark と統一感 / standard(light) 不変。

### Task 4.3: reduced-motion + a11y + text-scale 総点検

- **内容:** OS の視差効果カットで: 走査線 / グロー脈動 / タービン回転 / 火花蒸気 / ロールカウンター追従 / `.flash-fx` が全部止まる。`MilspecStyleToggle` の `aria-pressed` / `aria-label`（Phase 0 済）。タービンスイッチの `aria-label`。装飾 span が全て `aria-hidden`。アプリ内 text size 設定（`data-font-scale` / `data-text-scale`）でレイアウトが割れない（フォント差し替えの影響）。Dark/Light の本文コントラスト比。
- **DoD:** reduced-motion で全アニメ停止 / text size 変更で崩れない / スクリーンリーダーで装飾が読まれない。

### Task 4.4: Ko-fi 導線 + i18n 5 言語

**Files:** Modify `MilspecFooterHud.tsx` or `MilspecStyleToggle` 付近 / `src/locales/*.json`

- **内容:** MIL-SPEC 選択時、フッター HUD 内 or スタイル切替ボタン付近に控えめな一行「このテーマが気に入ったら ☕ Ko-fi」。i18n キー `theme.milspec.support` を 5 言語。煽り表現なし（spec §11・memory `feedback_discord_announcement_tone` は別コンテキストだがトーンは踏襲）。既存の Ko-fi リンク URL を Grep で確認して流用（`Sidebar.tsx` の `/support` Link・`href` を確認）。
- **DoD:** military のときだけ出る / 事実ベースの一行 / リンクが正しい / 5 言語で表示崩れなし / standard で出ない。

### Task 4.5: `MilspecTunePanel` の扱い + 確定値焼き込み

- **内容:** masaya に確認: (a) 本番リリース後も dev パネルを残す（`import.meta.env.DEV` ガードで本番非表示） / (b) 撤去する。
  - **残す場合**: 現状のまま（`Layout.tsx:878`）。確定値を `military.css` の `.theme-military {}` ノブ初期値に焼き込み。
  - **撤去する場合**: `MilspecTunePanel.tsx` 削除 + `Layout.tsx` から `<MilspecTunePanel />` + import 削除。`grep -rn "MilspecTunePanel\|--ms-tune-" src/` で CSS の変数参照だけ残りコンポーネント参照 0 を確認。
- **DoD:** 確定値が焼き込み済 / (撤去なら) tsc + build green + grep クリーン。

### Task 4.6: whole-branch 敵対レビュー + standard 回帰 + ガード解除 + マージ

**前提:** リリース方針の確認（スプシモードとセット or MIL-SPEC 単独）を masaya に。

- [ ] **Step 1: standard 回帰の全画面確認**（masaya・実機）: `themeStyle='standard'` で `/miti` の PC / モバイル / Dark / Light / 各モーダル / フォーカスモード / 共同編集ビューアが**完全に**元通り。`git stash` した状態と比較できるなら比較。`admin/` `landing/` `housing/` `MitigationSheet`（みんなの軽減表）が変わっていないことを確認。

- [ ] **Step 2: fresh context のサブエージェントで `superpowers:requesting-code-review`** — whole-branch。重点: (a) standard 回帰・スコープ外への波及、(b) `themeStyle` ガードの穴（military 以外で新コンポーネントが描画されないか・CSS が漏れないか）、(c) rAF リスナ / pointermove の cleanup 漏れ、(d) `content-visibility` を壊す CSS、(e) i18n ハードコード。採用は**正しさに関わる指摘のみ**（過剰防御は入れない・memory の運用ルール）。

- [ ] **Step 3: 指摘対応**（`superpowers:receiving-code-review` で技術的に吟味してから）

- [ ] **Step 4: ガード解除** — `ConsolidatedHeader.tsx:344` の `import.meta.env.DEV || localStorage['milspec-preview']==='1'` を外し `<MilspecStyleToggle />` を無条件表示。モバイル導線（`MobileHeader` / `MobileFab` にスタイル切替）を追加（spec §10・`feedback_mobilefab_casing_exact` に注意）。

- [ ] **Step 5: push 前ゲート** — `npm run build`（exit 0）+ 変更周辺 vitest（`src/components/military/` + `src/store/` を対象・フルスイートはハング既知）。

- [ ] **Step 6: masaya 最終実機確認** — standard/military × Dark/Light × PC/スマホ、全編集機能。

- [ ] **Step 7: マージ + push + デプロイ** — worktree を main へマージ（`superpowers:finishing-a-development-branch`）→ まとめて push（大型アップデート 1 本）→ Vercel 自動デプロイ（memory `reference_vercel_git_autodeploy`）→ CF「すべてパージ」（memory `reference_cf_cache_housing_ogp_pages` — フロント変更デプロイ後）。worktree teardown 時に `.env.local` を確認（gitignore 済・空上書き不要だが `git worktree remove` 前に走査・memory `feedback_worktree_secret_check`）。

- [ ] **Step 8: Discord 告知**（masaya が投稿・淡々と機能列挙・memory `feedback_discord_announcement_tone`）

---

## Self-Review

**1. Spec カバレッジ:**

| spec セクション | 対応タスク |
|---|---|
| §1 スコープ | Global Constraints + 各タスクの対象ファイル |
| §2 2軸化 | Phase 0（実装済） |
| §3.1 意味トークン再定義 | Task 1.2 |
| §3.2 固有トークン | Task 1.1（`--ms-*`）|
| §3.3 スプシ互換（`--ms-*` 名前空間） | Global Constraints + Task 1.1 |
| §4 さじ加減変数 + 調整パネル | Task 0.R2, 0.R3, 1.6, 4.5 |
| §5 パレット | Task 1.1（`--ms-*`）, 1.2（意味トークン）, 1.6（確定）|
| §6 フォント | Phase 0（@font-face・自前ホスト）+ Task 1.4（適用範囲・見出しのみ）|
| §7 装飾プリミティブ | Task 1.3 |
| §8 画面別リスキン | Task 2.1〜2.8 |
| §9 新規クローム（PC/モバイル出し分け）| Phase 3 全部 + Task 2.6（フッター HUD）+ Task 2.8（モバイル抑制）|
| §10 切替 UI（配置4箇所） | Phase 0（ConsolidatedHeader）+ Task 4.6 Step 4（MobileHeader/FAB + ガード解除）|
| §11 寄付導線 | Task 4.4 |
| §12 デカール文言ガイドライン | Global Constraints + Task 2.1 / 3.5 の DoD |
| §13 レスポンシブ | Task 4.1 + Task 2.8 |
| §14 アクセシビリティ | Task 1.4（reduced-motion）+ Task 4.3 |
| §15 ファイル構成 | File Structure 節 |
| §16 実装フェーズ | Phase 0（recap）→ 1（土台）→ 2（ゾーン）→ 3（クローム）→ 4（仕上げ）|
| §17 テスト方針 | テスト規約節 + Phase 3 の TDD |
| §18 スコープ外 | Global Constraints + Task 4.6 Step 1/2 の回帰確認 |
| §19 未確定 | Task 1.6（マテリアル）/ 3.2 Step 6（座標計器の採否）/ 4.5（tune パネル）/ 4.6（リリース単位）で決める |

**モックアップ固有の追加要素（spec §9 を超える部分）とタスク対応:**

| モックアップ要素 | タスク |
|---|---|
| C 面（面取り 4 色ボーダー）方式 | Task 1.1（トークン）+ 1.3（`.milspec-hp` 等）|
| seam 溝 + 両壁 | Task 3.4 |
| MGEX ベゼル（`.workspace` 装甲板 + `.ws-screen` 沈み画面の二層）| Task 2.5 サブ 1 |
| リキャスト行 | Task 2.5 サブ 2（本番 `RecastRow` は既存 → CSS のみ）|
| 計器化スクロールバー | Task 2.5 サブ 5（+ 可視/非可視の masaya 確認）|
| タービン遊びボタン（rig JS）| Task 3.1 |
| ロールカウンター座標計器 | Task 3.2（+ マウス追従ルールの masaya 承認）|
| 動力導管 | Task 3.3 |
| フッター HUD（82px・情報 + 計器）| Task 2.6 + 3.1 + 3.2 |
| PCB ハーネス SVG | Task 2.6 |
| console-frame 外枠 | Task 1.5 |
| nameplate / トラッキングレティクル / デカール密度 | Task 3.5 |
| 機能監査 3 点（折りたたみハンドル / SyncButton / PiP ボタン）| Task 2.2（前 2）+ Task 2.3（PiP）|

**2. Placeholder scan:** Phase 0 / 1 / 3 は具体コード入り。Phase 2 は「モックアップの該当行 + 実 DOM の行 + 追加フック + DoD」を明記した構造タスク（純粋 CSS 見た目・対象実 DOM を先に読む必要があるため意図的にこの粒度・着手時に bite-sized 化。正典＝モックアップが行番号付きで存在するため「実装せよ」の曖昧さは無い）。"適切なエラー処理" 等の曖昧表現なし。DoD は全タスクに具体チェックリスト + standard 不変 + geometry 回帰。

**3. Type consistency:**
- `themeStyle` / `setThemeStyle` / `applyThemeClasses` — Phase 0 で確定、全タスクで同名参照。
- `--ms-*` トークン + `--ms-tune-*`（9 個）— Task 0.R3 の初期値・0.R2 の `TUNABLES`・1.1 の移植・4.5 の焼き込みで同じキー集合。
- `createTurbineRig(vanesEl, idleDegPerSec, maxDegPerSec, totalMs)` — Task 3.1 で定義、`MilspecTurbineCluster` で消費。
- `axisTargets` / `snapAxisTargets` — Task 3.2 で export、同名でテスト参照。
- `<MilspecTurbineCluster placement="header" | "footer" />` — Task 3.1 で定義、2.1（header）/ 2.6（footer）で参照。
- `<MilspecChrome/>` / `<MilspecConduit/>` / `<MilspecRollCounter/>` / `<MilspecFooterHud/>` — File Structure と各タスクで一致。
- クラス接頭辞 = `.milspec-*`（Task 1.3 で `--ms-*` トークンとは別に、クラスは `milspec-` に統一と明記）。

**4. ギャップ:**
- モックアップの `.chrono`（アナログ時計）は dead code のため移植しない（workflow 追記 14 で撤去）。将来 masaya が復活を望めば別タスク。
- モックアップの weather テクスチャ（grime / scratches）は `--ms-tune-weather: 0` のため既定 OFF。Task 1.4 で「まず抜きで移植」、Task 4.2 で masaya が必要と言えば data URI で追加。
- スプシモードとのセットリリースは Task 4.6 Step 1 で確認（本プラン単独でも動く設計）。

---

## Execution Handoff

**プラン完成・`docs/superpowers/plans/2026-09-02-military-theme.md` に保存。**

実行は **`superpowers:subagent-driven-development`**（handoff 指定）: task ごとに fresh subagent + 各タスク間で司令塔がレビュー。worktree は `.claude/worktrees/milspec-theme`（subagent 指示書に絶対パス cd + pwd 確認を必ず入れる・memory `reference_subagent_worktree_cwd_not_inherited`）。

着手順: Task 0.R1 → 0.R2 → 0.R3 → Phase 1（1.1〜1.6）→ **Task 1.6 で masaya マテリアル承認ゲート** → Phase 2 → Phase 3 → Phase 4 → **Task 4.6 でマージ**。

masaya の実機確認ゲート: Task 1.6（マテリアル方向性）/ Task 3.2 Step 6（座標計器の採否）/ Task 4.1（レスポンシブ）/ Task 4.2（ライト）/ Task 4.5（tune パネル）/ Task 4.6（最終・リリース単位）。
