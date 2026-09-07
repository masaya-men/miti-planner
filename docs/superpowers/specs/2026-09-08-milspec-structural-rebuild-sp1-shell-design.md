# MIL-SPEC 構造リビルド — SP1: レイアウトシェル — 設計書

- 作成日: 2026-09-08
- ステータス: brainstorm 完了 → 本設計書レビュー → writing-plans
- 種別: architectural（`/miti` に軍事モード専用のコンポーネントツリーを新設。標準モードは別経路で不変）
- 正典（デザイン）: `docs/.private/theme-refs/milspec-mockup.html`（masaya 手製・2695 行・MAIN チェックアウトのみ。worktree に `.private/` は無いので実装者には絶対パス `c:/Users/masay/Desktop/FF14Sim/docs/.private/theme-refs/milspec-mockup.html` を渡す）
- 関連: `docs/superpowers/specs/2026-09-02-military-theme-design.md`（**本書が方針を差し替える** — §0.1 参照） / memory `project_sf_military_theme` / `reference_milspec_material_language`

---

## 0. 一行サマリ

`themeStyle === 'military'` かつ PC のとき、`/miti` は**モックアップを構造から完全再現した専用コンポーネントツリー**（`MilspecLayout` + 各ゾーン部品）を描画する。既存の Zustand ストア・イベントハンドラにそのまま配線して編集機能を全部維持する。標準モード（`themeStyle` 未設定または `'standard'`）は既存 `Layout` をそのまま描画し、**1 バイトも変えない**。

本書は SP（サブプロジェクト）1 =「外側のレイアウトシェル」だけを対象とする。タイムライン表の中身・スマホ・編集モーダルの軍事化は SP2/3/4（§12）。

---

## 0.1 従来方針（2026-09-02 設計書）との関係

2026-09-02 設計書は「**再スキン主体**・レイアウトは大きく変えない・既存コンポーネントに `.theme-military` 前置で見た目だけ差し替え」という方針だった。Phase 1（トークン・プリミティブ・フォント・グレイン）と Phase 2（各ゾーンに `data-milspec-*` フックを付けて CSS で皮をかける）まで実装済み。

**masaya の最終判断（2026-09-07〜09-08）**: 再スキンではモックの固定グリッドのパネル配置を再現できない。「モックと全く同じ見た目で本番で使えるようにする」がゴール。→ **構造から作り直す**。

本書が差し替える範囲:
- 2026-09-02 §8「画面別リスキン」・§9「新規装飾クローム」・§13「レスポンシブ」・§16「実装フェーズ」 → 本書で置き換え。
- Phase 2 で標準コンポーネントに入れた `data-milspec-*` フックと、それを狙う CSS ルール → **撤去**（§9）。

本書が引き継ぐ範囲（2026-09-02 から不変・SP1 の土台）:
- §2 テーマ 2 軸化（`themeStyle` / `<html>` クラス付与）— 実装済み・不変。
- §3 トークン契約（意味トークン再定義・`--ms-*` 名前空間）— Phase 1.1〜1.2 で実装済み。SP1 の各ゾーン部品はこの `--ms-*` トークンと `.milspec-*` プリミティブ（Phase 1.3）を組み合わせて作る。
- §6 タイポグラフィ（Orbitron / Share Tech Mono の `@font-face`）— Phase 1.4〜1.5 で実装済み。
- §4 調整パネル（`MilspecTunePanel` / `--ms-tune-*`）— 実装済み。SP1 でも維持。
- 機能色の不変条件（青=進む/OK、赤=危険、黄=警告）。
- スコープ外（`/admin` `/housing` `MitigationSheet` LP）— 不変。

---

## 1. 全体像（SP1〜SP4）

「軍事モードの `/miti` を丸ごとモック再現」は 1 つの設計書に収めるには大きすぎる。**全部作る前提**で、リスクの低い順に 4 分割する（masaya 承認済 2026-09-08）。

| SP | 内容 | 状態 |
|---|---|---|
| **SP1**（本書） | 外側のレイアウトシェル。画面グリッド全体・ヘッダー・サイドバー・コントロールバー 2 段・フッター HUD・コンソール外枠・導管・タービン。ストア配線。**ワークスペースの中には既存の `Timeline` をそのまま埋め込む**（アプリは常に完全に使える）。 | 本書で設計 |
| SP2 | タイムライン表の中身。モックの固定 14 列グリッド・ヘッダーのブラケットパネル・リキャスト行・行スラット・軽減バー（`MitigationItem` の座標計算を新グリッドに合わせて作り直し）・横スクロール同期・行の間引き描画。軽減の配置/移動/削除・メモモード・AA モード・共同編集カーソル・フェーズ/ラベル表示を全維持。 | SP1 完了後に別設計書 |
| SP3 | スマホ用の軍事レイアウト（モックに無いので新規デザイン。部品は SP1/2 を流用）。 | 別設計書 |
| SP4 | 編集モーダルの軍事化（パーティ編成・ステータス設定・イベント追加・軽減追加。使いながら対象確定）。 | 別設計書 |

各 SP は「設計書 → プラン → subagent-driven-development」を独立に回す。

---

## 2. ブレインストーム確定事項（Q1〜Q6）

| # | 論点 | 確定 |
|---|---|---|
| Q1 | 再現スコープ | **B: 完全再現**。タイムライン表のグリッドと操作モデルも作り直す（SP2）。「完璧に再現。既存機能は壊さずモックを取り入れる」。 |
| Q2 | サイズの合わせ方 | **A: 流動フィット**。モックのデザインを `clamp()` / `vw` / `fr` に変換して画面幅に流動的にフィット。基準幅 1489px（リポジトリ標準 sizing）。固定キャンバスでも zoom-to-fit でもない。 |
| Q3 | スマホ | **C: スマホ専用の軍事レイアウトも作る**（SP3）。画面が小さく素材を載せる面も少ないので PC ほど重くない見込み。SP1 の間はスマホは標準レイアウトにフォールバック。 |
| Q4 | 折りたたみ・集中モード | **A: 機能は維持**。畳んだ状態の凝ったデザインは SP1 の後の追加作業。SP1 では機能的に隠れる/戻る（素朴な細い帯で可）。 |
| Q5 | モックに無いポップアップ | 共有フロー・FFLogs 取込・スプレッドシート・裏方ダイアログ → **標準テーマそのまま**（軍事の皮をかけない・切替わって OK）。パーティ編成・ステータス設定・イベント追加・軽減追加 → **SP4 で軍事化**（SP1 では標準テーマ）。 |
| Q6 | 文字・言語 | 機能ラベルは各言語の実名のまま（用語は変えない）。モックがステンシル英字を見せる場所には、**その機能を正しく表す軍事風の英語ラベル**を装飾として重ね、実名を多言語で併記（モックの「大きな英字＋小さな実ラベル」パターン）。英字ラベルは固定・翻訳対象外。 |

---

## 3. アーキテクチャ

### 3.1 現状（コード確認 2026-09-08）

- ルート: `src/App.tsx` の `<Route path="/miti" element={<MitiPlannerPage />} />`。
- `src/components/MitiPlannerPage.tsx`: `<Layout>` で `<Timeline />`（`ErrorBoundary` 内）をラップして描画。`Layout` に `children` として渡している。
- `src/components/Layout.tsx`（883 行）は **2 つの役割を持つ**:
  1. **アプリの実行時ホスト（テーマ非依存・データ保護に直結）**: 起動時ミティゲーション復旧（`shouldRestoreMitigationFromPlan` / bootstrap）、collab ライフサイクル管制（`reconcileCollabForPlan`）、自動保存 2 層（localStorage 500ms デバウンス + Firestore イベント駆動 + 5 分定期）、ログイン時マイグレーション（`migrateOnLogin`）、キーボードショートカット（F=集中モード / S=サイドバー / H=ヘッダー）、iOS ビューポート補正。**約 400 行。全部フック（`useState` / `useEffect` / `useRef`）で、`return` より前にある。**
  2. **見た目**: `data-app-shell` div → `GridOverlay` / `MilspecChrome` / PC `Sidebar` / モバイルシート群 / メイン列（`ConsolidatedHeader` + `MobileHeader` + `<motion.main>{children}</motion.main>` + `AppFooter`）/ 集中モード右レール / モーダル群。
- 共有 UI 状態（`Layout` の `useState`）: `isSidebarOpen` / `isHeaderCollapsed` / `isHeaderNear` / `focusModeRef` / `isMobile`（`window.innerWidth < 768`・resize 監視）/ 各種モバイルシート開閉。`ConsolidatedHeader` へは props、子孫へは `MobileTriggersContext` で配布。
- `src/store/useThemeStore.ts`: `themeStyle: 'standard' | 'military'`（既定 `'standard'`）。`setThemeStyle` が `applyThemeClasses` を呼び `<html>` に `theme-military` を付与/除去。persist `theme-storage` v2、migrate で旧値に `themeStyle` を補完。**実装済み・SP1 で変更しない。**

### 3.2 分岐方式（採用案）

**`Layout.tsx` の内部で、全フックの後・標準 `return` の直前に、早期 return を 1 か所足す。**

```tsx
// Layout.tsx 内・全 useState/useEffect/useRef の後、既存 return (...) の直前
const themeStyle = useThemeStore(s => s.themeStyle);

if (themeStyle === 'military' && !isMobile) {
  return (
    <MilspecLayout
      // 今 ConsolidatedHeader / Sidebar に渡している共有状態をそのまま渡す
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={handleToggleSidebar}
      onCloseSidebar={() => { setIsSidebarOpen(false); localStorage.setItem('lopo_sidebar_open', 'false'); }}
      isHeaderCollapsed={isHeaderCollapsed}
      setIsHeaderCollapsed={setIsHeaderCollapsed}
      theme={theme}
      onToggleTheme={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
      partySortOrder={timelineSortOrder}
      setPartySortOrder={setTimelineSortOrder}
      onAutoPlan={() => window.dispatchEvent(new CustomEvent('timeline:autoplan'))}
      onImportLogs={() => window.dispatchEvent(new CustomEvent('timeline:import'))}
      statusOpen={mobileStatusOpen}
      setStatusOpen={setMobileStatusOpen}
      localImportProps={{ isOpen: localImportOpen, plans: localImportPlans, onImport: handleLocalImport, onClose: handleLocalImportClose }}
    >
      {children}
    </MilspecLayout>
  );
}

return ( /* ===== 既存の標準 JSX。1 文字も変えない ===== */ );
```

**なぜこの方式か**:
- 役割 1（実行時ホスト・約 400 行）は分岐より**前**にあるので、軍事でも標準でも**まったく同じものが動く**。自動保存・collab・データ復旧・マイグレーションは両モード共通・実績コードそのまま。データ保護コードに一切手を入れない。
- 標準 JSX（役割 2）は**未編集**。`themeStyle === 'standard'` のとき条件は false → 従来通り。
- `MilspecLayout` は完全に独立した新規サブツリー。標準コンポーネント（`ConsolidatedHeader` / `Sidebar` / `AppFooter` 等）を import もしない。
- 「別ルート / 別ページ」にすると役割 1 の 400 行を複製するか、`Layout` から抽出して共通化する必要がある。どちらもデータ保護コードに触れる（memory `feedback_dataloss_exhaustive_audit` の領域）。内部分岐なら実行時ホストが自動的に両モード共通になる。

**標準モード不変の定義**: 「`Layout.tsx` に 1 行も足さない」ではなく、**`themeStyle` が military でないときのレンダリング出力（DOM 構造・computed style・挙動）が `main` ブランチと完全一致すること**。分岐 1 か所の追加は避けられない（どちらのツリーを描くか決める処理が要る）。検証で一致を証明する（§10）。

### 3.3 `MilspecLayout` の責務境界

- **やる**: モックの `.app` グリッド（§4）を組み、7 ゾーン部品を配置し、`props` で受けた共有状態を各ゾーンに配り、`{children}`（既存 `Timeline`）をワークスペースゾーンに埋め込む。PC 用グローバルオーバーレイ（§8）を自前でマウントする。
- **やらない**: フック（実行時ホスト）は持たない。持つのは軽い UI 状態のみ（例: フッター HUD の開閉、ゾーンのローカル表示状態）。データを触る処理は一切書かない — 既存ストアのアクションを呼ぶだけ。
- **依存**: `useThemeStore`（`theme` / `themeStyle`）、`usePlanStore`、`useMitigationStore`、`usePartyStore` 等の既存ストア。`react-i18next`。`props`（`Layout` からの共有状態）。

---

## 4. 画面グリッド（モック `.app` の再現）

### 4.1 モックの構造（`milspec-mockup.html:240-250`）

```
grid-template-columns: 285px 22px 1fr;
grid-template-rows:    90px 72px 52px 1fr 82px;
grid-template-areas:
  "header  header header"
  "sidebar seam   toolbar"
  "sidebar seam   subtoolbar"
  "sidebar seam   workspace"
  "sidebar seam   footer";
```

- 列: サイドバー 285 / 溝 22 / 本体 1fr
- 行: ヘッダー 90 / ツールバー 72 / コントロールバー 52 / ワークスペース 1fr / フッター 82
- `header` は全幅。`sidebar` と `seam` は 2〜5 行を縦断。

> **SP1 の行構成**: モックの `.subtoolbar`（コントロールバー・52px）は独立ゾーンにしない。理由: AA モード（`isAaModeEnabled`）・リキャスト行表示（`recastRowVisible`）は `Timeline.tsx` のローカル state で外から触れず、SP1 で埋め込む `Timeline` が自前のコントロールバーを持つため、独立ゾーン化すると二重になる。**SP1 のグリッドは 4 行**（`header 90 / toolbar 72 / workspace 1fr / footer 82`）。`Timeline` 自身のコントロールバーがワークスペース（装甲板）内の上端に乗る。**SP2 で表を作り直すとき `MilspecControlBar` を 5 行目として復活**させる。

### 4.2 SP1 の流動グリッド（Q2 = A）

`MilspecLayout` のルート要素に CSS Grid を組む。モックの固定 px を `--ms-*` 変数化し、基準幅 1489 で `clamp()` 表現する。

| 領域 | モック px | SP1 の値（方針） |
|---|---|---|
| サイドバー列幅 | 285 | `clamp(232px, 19.1vw, 285px)`（畳み時 0 へアニメ） |
| 溝列幅 | 22 | `clamp(16px, 1.5vw, 22px)` |
| 本体列 | 1fr | `1fr` |
| ヘッダー行高 | 90 | `clamp(76px, 6vw, 90px)`（縦は詰める・小 clamp） |
| ツールバー上段 | 72 | `clamp(60px, 4.8vw, 72px)` |
| ツールバー下段 | 52 | `clamp(44px, 3.5vw, 52px)` |
| ワークスペース行 | 1fr | `1fr`（残り全部） |
| フッター行 | 82 | `clamp(64px, 5.5vw, 82px)` |

- 具体的な min / vw 係数は実装時に mockup と 1489/1920/2560 の 3 ケースで詰める（プランのタスクに検証手順を入れる）。上表は出発点。
- コンテナ最大幅はリポジトリ標準に合わせる（標準 `Layout` の `md:max-w-[var(--container-max)] md:mx-auto` と同じ挙動 = 中央寄せ・上限で頭打ち）。`MilspecLayout` ルートも同じ `--container-max` を尊重する。
- 行高（ヘッダー・ツールバー・フッター）は縦の余白が貴重なのでほぼ固定＋わずかな `clamp`。ワークスペースが残りを全部取る。
- テキストは全 px 固定（rem 不使用）。`--ms-font-display` / `--ms-font-mono` は Phase 1 で定義済み。
- 768px 未満は §3.2 の `!isMobile` 条件で標準にフォールバック（SP3 で専用スマホ版）。

### 4.3 グリッド契約（テスト可能な不変条件）

- `MilspecLayout` ルートは `display: grid` で、上記 7 領域（header / sidebar / seam / toolbar / subtoolbar / workspace / footer）を `grid-template-areas` で持つ。
- 各ゾーン部品は対応する `grid-area` に 1 対 1 で入る。
- ワークスペースゾーンは内部 `overflow` を持たず、中の `Timeline`（SP1）または `MilspecTable`（SP2）が自前でスクロールする。
- `data-app-shell` 属性は `MilspecLayout` ルートにも付ける（Phase 1.4 のグレイン `[data-app-shell]::after` / スキャンライン `[data-app-shell]::before` がそのまま乗る）。

---

## 5. ゾーン部品

すべて `src/components/military/` 配下の新規部品。見た目は `--ms-*` トークン + `.milspec-*` プリミティブ（Phase 1.3）+ 本書の新規 CSS（`military.css` の SP1 節・全ルール `.theme-military` 前置）で作る。**押したときの動作は既存ストアのアクションをそのまま呼ぶ** — 標準モードと動作は完全共通、見た目だけ差し替え。

各部品について「何をするか / どう使うか（props）/ 何に依存するか」を明記する。

### 5.1 `MilspecHeader` — `grid-area: header`

モック: `milspec-mockup.html:1920-1979`（`<header class="header chan">`）

| モックのパーツ | 中身 | 配線先 |
|---|---|---|
| `.hp.hp-logo` | "LoPo" ロゴ（Orbitron）+ メタ 3 行（`Combat Analysis System` / `Loop Optimizer · Fire-Plan Unit` / `MDL. LP-2 / STD ISSUE`）+ `DMG-REDUCTION PLANNING SET` 刻印 | ロゴクリック → `navigate('/')`（ホーム） |
| `.seam-diag` | 赤い斜め構造シーム（装飾） | なし |
| `.hp.hp-title.recess` | 遭遇名プレート（jp: `至天の座アルカディア零式：ヘビー級1` / en）+ `TTL-01 · TARGET ENGAGEMENT` 刻印 | `usePlanStore` の現在プランのタイトル/遭遇名を表示 |
| `.hp.hp-fill` | 中央の銘板（`DEFENSIVE COOLDOWN PLANNING TERMINAL` 等）+ ハザード + `.tb-cluster2` タービン（`#tb-switch-header` スイッチ + 回転羽根） | タービンスイッチ = 遊び（ローカル state でアニメ ON/OFF、データ非依存） |
| `.hp.hp-share` | "SHR / 共有 / // Share" プレート | クリック → 共有フロー起動（標準の共有モーダルを開く。Q5 = 標準テーマ表示） |
| `.hp-tools` の 4 × `.hud-btn` | Tutorial（チュートリアル）/ Theme（テーマ）/ Lang（言語）/ Account（ログイン） | Tutorial → `useTutorialStore.startTutorial('main')` / Theme → `props.onToggleTheme` / Lang → 言語メニュー（既存の言語切替 UI を呼ぶ）/ Account → ログインモーダル or アカウントメニュー |

**追加で載せる必要があるもの**（モックの `.hp-tools` は 4 つだが実アプリのヘッダーにある機能）:
- **スタイル切替**（標準 ⇄ 軍事）— `MilspecStyleToggle`（Phase 1 実装済）を `.hud-btn` の意匠で。プレビューゲート（`import.meta.env.DEV || localStorage 'milspec-preview'==='1'`）を維持。
- **同期ボタン**（`SyncButton`）/ **保存状態インジケーター**（`usePlanStore` の `saveStatus`）— ヘッダーのどこか（`.hp-fill` の刻印域 or `.hp-tools` の並び）に軍事意匠で。
- **パーティ表示絞り込み**（`View / 表示メンバー`）・**設定**（`Config / 設定`）— モックではツールバー側（§5.4）にあるので、ヘッダーには置かず §5.4 に集約。

props: `{ theme, onToggleTheme, onImportLogs, onAutoPlan, isHeaderCollapsed, ... }`（`Layout` から）
依存: `usePlanStore` / `useTutorialStore` / `useAuthStore` / `useThemeStore` / 既存の共有フロー起動関数 / 既存の言語切替 UI

`isHeaderCollapsed === true`（H キー / 集中モード）: SP1 では細い帯 1 本に縮む（凝ったデザインは後追い・Q4）。

### 5.2 `MilspecSidebar` — `grid-area: sidebar`

モック: `milspec-mockup.html:1982-2060`（`<aside class="sidebar chan">`）

| モックのパーツ | 中身 | 配線先 |
|---|---|---|
| `.sb-collapse` (‹) | 折りたたみハンドル | `props.onToggleSidebar` |
| `.hp.scenario` | "Scenario / シナリオ" 見出し + `.s-btns` 4 ボタン（NEW 新規作成 / IMPORT インポート / TEMPLATE テンプレート / DELETE 削除） | NEW → `usePlanStore.createPlan` / IMPORT → 取込フロー / TEMPLATE → テンプレート選択 / DELETE → 削除確認 → `deletePlan` |
| `.enc-name` | 現在プランの遭遇名 | `usePlanStore` 現在プラン |
| `.hp.phases` | フェーズブロック（`phase-h` 層番号 + `phase-tag` PHASE 01 + `pi` 項目 = ラベル一覧、`.pi.sel` 選択中、`.pi.add` "+ 追加"） | フェーズ/ラベルの一覧・選択・追加は既存のフェーズ編集ロジック（`useMitigationStore` の phases / timelineEvents） |
| `.hp.dock` | Backup（バックアップ）/ Restore（復元）ボタン | 既存のバックアップ/復元フロー |
| `.hp.deployment` | "Deployment / 展開を支援する" 装飾ブロック（ハザード + × マーク SVG） | **完全に装飾**（操作なし） |

**実アプリのサイドバーにあってモックに無いもの**（`Sidebar.tsx` を確認して洗い出す。プランのタスクで対応表を作る）:
- プラン一覧（`.hp.scenario` の下 or `.hp.phases` と統合）— コンテンツツリー / プラン行の選択・複製・並び替え
- タブ切替（もしあれば）
- savage セクション等

props: `{ isSidebarOpen, onToggleSidebar, onCloseSidebar }`
依存: `usePlanStore`（plans / currentPlanId / CRUD）/ `useMitigationStore`（phases / events）/ 既存のバックアップ・テンプレート・取込フロー起動関数

`isSidebarOpen === false`: 幅 0 へアニメ（`clamp` の下限でなく 0）。集中モードでも同じ。

### 5.3 `MilspecSeam` — `grid-area: seam`

モック: `milspec-mockup.html:254-263`（`.seam`）+ 導管（`.conduit`）

- 構造の溝（`linear-gradient` + inset shadow）。サイドバー（可変パネル）と本体（固定筐体）が別ハルであることを物理的な溝で示す。
- 動力導管の装飾（`.conduit` — Phase 1 or 本書で。§7 の外枠 `MilspecChrome` と役割分担を実装時に確定）。
- **完全に装飾**。props なし。依存なし。

### 5.4 `MilspecToolbar` — `grid-area: toolbar` / `MilspecSubToolbar`（下段）

モック: `milspec-mockup.html:2063-2086`（`<div class="toolbar">`）

**注意**: モックの `.toolbar` はツールバー上段（72px）で「クラスタ 3 つ + スペーサー」。モックの `.subtoolbar`（52px）は別物 = **コントロールバー**（§5.5）。混同しない。

`MilspecToolbar`（上段・`grid-area: toolbar`）:

| モックのクラスタ | ボタン | 配線先 |
|---|---|---|
| `.tb-cluster` "CREW" | Party（パーティ編成）/ Config（設定）/ Import（ログ取込）/ More（その他） | Party → パーティ編成モーダル（SP1 = 標準テーマ）/ Config → 設定モーダル（同）/ Import → `props.onImportLogs` / More → その他メニュー |
| `.tool-spacer` | 刻印テキスト 2 行（装飾） | なし |
| `.tb-cluster` "VIEW" | Popular（みんなの軽減表）/ View（表示メンバー） | Popular → `navigate('/popular')` or 既存導線 / View → パーティ表示絞り込み UI |
| `.tb-cluster.tool-seg` "SORT" | Light（ライトパーティ）/ Role（ロール別）セグメント | `props.setPartySortOrder`（既存の `timelineSortOrder`） |

props: `{ onImportLogs, partySortOrder, setPartySortOrder, statusOpen, setStatusOpen }`
依存: `usePartyStore` / 既存の設定・パーティ編成モーダル起動関数 / `navigate`

### 5.5 `MilspecControlBar` — **SP2 へ移動**（SP1 では作らない）

モック: `milspec-mockup.html:2089-2119`（`<div class="subtoolbar">` — 「表の直上に細く乗る操作列」）

**SP1 では作らない。** §4.1 の注記の通り、AA モード（`isAaModeEnabled`・Timeline ローカル state）・リキャスト行表示（`recastRowVisible`・同）は外から触れず、埋め込んだ `Timeline` が自前のコントロールバー（`controlBarRef` — 横スクロール同期 `#timeline-controls-inner` と `paddingRight` 補正の一部）を持つ。SP1 で独立ゾーン化すると二重になり、スクロール同期も壊す。**SP2 で表グリッドと操作モデルを作り直すときに `MilspecControlBar` を 5 行目として実装**し、そのとき AA/リキャストの state を持ち上げる（or Timeline から公開する）。

以下は SP2 の配線メモ（参考・SP1 では未使用）:

| モックのグループ | ボタン | 配線先 |
|---|---|---|
| `.cb-a` | 折りたたむ（空行の折りたたみトグル） | `useMitigationStore.setHideEmptyRows` |
| `.cb-b` | AA 追加（AA モード）/ メモ（メモモード） | 既存の AA モード・メモモードのトグル |
| `.cb-c` | 行の罫線 / リキャスト行（表示トグル） | 既存の対応するトグル |
| `.cb-d` | 元に戻す / やり直し / 軽減をクリア（danger） | Undo / Redo / クリア確認 → 既存のアクション |
| `.cb-e` | ジョブチップ（PLD WAR WHM SCH DRG NIN BLM BRD） | パーティメンバーの並び表示（`usePartyStore`）。SP1 では表示のみ or 既存のメンバー操作 |

props: 必要な既存 state / setter を `Layout` 経由 or 直接ストア購読
依存: `useMitigationStore`（hideEmptyRows / AA / メモ / undo-redo）/ `usePartyStore`

> SP1 ではコントロールバーの操作は「既存のトグルを呼ぶ」までで、表側の見た目の反応は埋め込んだ既存 `Timeline` の挙動に従う。SP2 で表と一体で仕上げる。

### 5.6 `MilspecWorkspace` — `grid-area: workspace`

モック: `milspec-mockup.html:2123-2213`（`<div class="workspace chan">`）

- 「浮いた raised の大装甲板」= 四隅ビス（`.bolt`）+ スジ彫り（`.pl`）+ コード名刻印（`WKS-07` / `RAID OPERATIONS PLOT · MITIGATION ARRAY`）+ `.ws-screen`（沈んだスクリーン面）。
- **SP1**: `.ws-screen` の中に `{children}` をそのまま入れる。`children` の実体は `MitiPlannerPage` が渡す `<div className="flex flex-col h-full relative z-10"><div className="flex-1 overflow-auto relative flex"><ErrorBoundary><Timeline /></ErrorBoundary></div></div>`（+ モバイル専用 `MobileGuide`・PC では不活性）。装甲板の枠・刻印・スクリーン面だけ軍事意匠で作り、中身の表は従来の `Timeline` が全機能そのまま動く。
- 埋め込みブリッジ: 標準 `Layout` では `children` は `<motion.main className="flex-1 flex flex-col ... overflow-hidden">` の中に入り、`children` の `flex flex-col h-full` がそれを埋める。`MilspecWorkspace` の `.ws-screen`（`{children}` の直接の親）も**同じ前提を満たす**: `display:flex; flex-direction:column; min-height:0;` で、グリッドの `workspace` 行（`1fr`）が与える確定高さの中で `children` の `h-full` / `flex-1 overflow-auto` が解決するようにする。`Timeline` / `MitiPlannerPage` のコードに軍事用の分岐は入れない（SP1 では）。
- `.ws-note`（`ROSTER 08 / 08` / `FULL PARTY`）= `usePartyStore` のメンバー数から算出 or 装飾。
- **SP2** でこの中身を `MilspecTable` に差し替える。

props: `children`
依存: なし（枠のみ）。`.ws-note` のみ `usePartyStore`。

### 5.7 `MilspecFooter` — `grid-area: footer`

モック: `milspec-mockup.html:2216-2280+`（`<footer class="footer chan">`）

| モックのパーツ | 中身 | 配線先 |
|---|---|---|
| `.fp.fp-info` | `MIL-SPEC` タイトル + 説明 + 著作権行（`© 2026 LoPo` / `FINAL FANTASY XIV © SQUARE ENIX` / `掲載データは非公式のファンメイド`）+ リンク（プライバシーポリシー・利用規約・特定商取引法に基づく表記・お問い合わせ・Discord・X @lopoly_app） | `AppFooter.tsx` と同じ i18n キー（`footer.copyright` / `footer.disclaimer`）・同じリンク先・法的ドロップダウン |
| `.fp-harness` SVG | PCB 配線の装飾（直角トレース・ヴィア・ジャンクション `J-04`） | 装飾のみ |
| `.fp.fp-inst` | "Telemetry" 計器 + カーソル座標（静止中は完全停止） | カーソル座標 = マウス移動時のみ更新（memory `reference_perf_forced_reflow_resizeobserver` / マウス追従 UI 禁止ルールに注意 — `.claude/rules/ui-design.md`。**モックのカーソル座標計器は「動いた時だけ」= 高頻度 state 更新を避ける実装にする**。実装で pointermove の rAF スロットル + 静止検知） |

**実フッターにあるもの**: `PulseSettings`（`AppFooter.tsx` にある）— 軍事意匠で `.fp` のどこかに。

props: なし（i18n / 既存リンクは自前）
依存: `react-i18next` / 既存の法的ページリンク / `usePlanStore`（saveStatus をここにも出すか実装時判断）

`AppFooter` は `hidden md:flex`（PC のみ）。`MilspecFooter` も PC 前提（SP1 が PC 限定なので自明）。

### 5.8 `MilspecChrome`（既存・Phase 1.5）+ 導管

- `src/components/military/MilspecChrome.tsx` は実装済み（`themeStyle==='military' && isPc` のとき `.milspec-console-frame` を描画）。
- SP1: `MilspecLayout` がこれを描画する（標準 JSX の分岐 return によって Layout 標準 JSX の `<MilspecChrome/>` は軍事モードでは実行されない。標準モードでは従来通り null を返すだけ）。
- コンソール外枠 + 画面端の導管の意匠。`MilspecSeam` の溝内導管との役割分担を実装時に確定（外枠 = 画面 4 辺、seam = サイドバー/本体境界）。

---

## 6. 折りたたみ・集中モード（Q4 = A）

- 状態は `Layout` が持つ（`isSidebarOpen` / `isHeaderCollapsed` / `focusModeRef`）。`MilspecLayout` は props で受けて各ゾーンに配る。
- キーボードショートカット（F / S / H）は `Layout` の実行時ホスト（分岐前）で動くので**軍事モードでも従来通り効く**。
- SP1 の各ゾーンの畳み方:
  - `isSidebarOpen === false` → サイドバー列幅を 0 へアニメ、`MilspecSidebar` は非表示。
  - `isHeaderCollapsed === true` → ヘッダー行高を細く、`MilspecHeader` は細い帯 1 本（素朴で可）。
  - 集中モード（F）= 上記 2 つの組み合わせ + `MilspecToolbar` / `MilspecControlBar` の扱いは実装時に確認（標準は表だけ残す）。
- **畳んだ状態の凝ったデザイン（軍事語彙のミニ HUD 等）は SP1 スコープ外**。SP1 は「機能的に隠れて戻る」まで。

---

## 7. サイズ・レスポンシブ（Q2 = A）

§4.2 の通り。追加の不変条件:

- 1489 / 1920 / 2560 の 3 ケースで、横スクロールバーが body に出ない・パネルが重ならない・テキストがはみ出さない。
- 広い画面: `--container-max` で中央寄せ・頭打ち（標準 `Layout` と同挙動）。
- 狭い画面（768〜1489）: `clamp` 下限まで縮小。
- reduced-motion: Phase 1 の走査線・グロー脈動は `@media (prefers-reduced-motion: reduce)` で無効（既存）。タービン回転アニメも同様に停止。
- `data-text-scale`（アプリ内文字サイズ設定）が効くこと（フォント差し替えでレイアウトが割れないか実機確認 — masaya ゲート）。

---

## 8. モックに無いポップアップの扱い（Q5）

### 8.1 標準テーマそのまま（軍事の皮なし）

以下は `themeStyle` に関わらず標準の見た目で開く。切替わって OK（masaya 明示）:
- 共有フロー（共有モーダル・共同編集開始・オーナーパネル・URL 共有）
- FFLogs 取込ダイアログ / インポートウィザード
- スプレッドシート取込
- 裏方: ローカル取込ダイアログ（`LocalImportDialog`）/ 上限解消シート（`LimitResolutionSheet`）/ 連鎖配置プロンプト（`AetherflowChainPromptModal` / `AstrologianDrawChainPromptModal`）/ `LocalDataSafetyAutoPrompt` / `RenderPendingIndicator`

### 8.2 SP1 では標準・SP4 で軍事化

- パーティ編成モーダル / ステータス設定モーダル / イベント追加モーダル / 軽減追加モーダル
- SP1 ではこれらも標準テーマで開く。SP4 で対象を確定して軍事化。

### 8.3 実装

- `MilspecLayout` は PC 用のグローバルオーバーレイ（§8.1 の裏方 8 種 + `MilspecTunePanel`）を**自前でマウント**する。
- これらは全て「非アクティブ時は null を返す」自己ゲート型。軍事モードでは Layout 標準 JSX が描画されない（分岐 return）ので二重マウントにならない。
- `LocalImportDialog` のデータ（`isOpen` / `plans` / `onImport` / `onClose`）は `Layout` で計算済みなので `props.localImportProps` で受け取る。
- モバイル専用オーバーレイ（`MobileShareController` / モバイルアカウントシート / `LoginModal` モバイル / `mobileCueSheet`）は SP1 スコープ外（軍事は PC 限定）。`Layout` 標準 JSX 側に残す。
- **`Layout` 標準 JSX からオーバーレイのマウントを移動/抽出しない**（標準モード不変を優先）。`MilspecLayout` が必要分を自前で並べる（約 8 行の重複は許容）。

---

## 9. Phase 2 スキンの撤去

Phase 2（Task 2.1〜2.8）で標準コンポーネントに入れた以下を撤去し、標準コンポーネントを Phase 1 以前のきれいな状態に戻す:

- `ConsolidatedHeader.tsx` / `Sidebar.tsx` / `Timeline.tsx` / `TimelineRow.tsx` / `AppFooter.tsx` / `MobileHeader.tsx` 等に付けた `data-milspec-*` 属性。
- `military.css` の Phase 2 節（`.theme-military [data-milspec-header] { ... }` 等・**標準コンポーネントの DOM を狙うルール**）。
- Phase 2 で標準 JSX に足したラッパー要素・クラス（`.milspec-seg` フック等）で、標準モードに影響し得るもの。

**残すもの**:
- `military.css` の Phase 1 節: `@font-face`、`--ms-tune-*`、`.theme-military.theme-{dark,light}` の `--ms-*` パレット、`.theme-military` の意味トークン再定義、`.milspec-*` プリミティブ（`.milspec-hp` / `.milspec-bolt` / `.milspec-pl` / `.milspec-screen` / `.milspec-chan` / `.milspec-console-frame` / `.milspec-lamp` / `.milspec-hazard` / `.milspec-decal` / `.milspec-nameplate` / `.milspec-hdg` / `.milspec-echo` 等）、グレイン `[data-app-shell]::after`、スキャンライン、ウェザリング `.milspec-wthr-*`。
- `MilspecChrome.tsx` / `MilspecStyleToggle`（配線先はヘッダーゾーンに移設）/ `MilspecTunePanel` / `useThemeStore` の `themeStyle` 軸 / プレビューゲート。

**判断（プランで明記）**: Phase 2 の CSS のうち、SP1 のゾーン部品でそのまま流用できる「見た目の宣言」（色・影・effect の当て方）は、セレクタを新ゾーンのクラス名に書き換えて再利用してよい（デザイン判断は済んでいる）。撤去するのは「標準 DOM を狙うセレクタ」であって、質感の知見ではない。

---

## 10. 標準モード不変の検証（最重要）

以下を機械判定できる形でプランのタスクに入れる:

1. **標準 `/miti` の DOM/幾何 一致**: `main` ブランチと本ブランチで、`themeStyle` 未設定の `/miti` をヘッドレスで開き、主要要素（ヘッダー・サイドバー・ツールバー・表・フッター）の `getBoundingClientRect` と DOM 構造（`outerHTML` の骨格）が完全一致。dark / light 両方。
2. **既存テスト全緑**: collab（`collabLifecycle.test.ts` 等）・自動保存・bootstrap（`bootstrapMitigation`）・`ConsolidatedHeader` 系・`useThemeStore` 系。実行時ホストは無改造なので通るはず。通らなければ分岐の入れ方が誤り。
3. **軍事モード基本動作**: コンソールエラー 0。配線した機能が実際に動く — テーマ切替 / 並び替え / 設定モーダル / プラン作成・複製・削除 / バックアップ・復元 / 自動立案（イベント発火）/ ログ取込（イベント発火）/ 共有起動 / チュートリアル起動 / ホーム遷移。
4. **埋め込んだ `Timeline` が完全機能**: 軍事モードのワークスペース内で、軽減の配置・削除・スクロール・フェーズジャンプが従来通り動く。
5. **push 前ゲート**: `npm run build`（tsc -b 厳密）exit 0 + 変更周辺 vitest 緑（フルスイートは vmThreads ハング既知 — 対象を絞る）。

視覚の一致（モック再現度）は自動化しない。**masaya のローカル実機確認がゲート**（memory `feedback_no_screenshots_local_verify`：Claude はスクショを見ない。`reference_dev_editor_hmr_hardreload`：useEffect 変更後はハードリロード）。

---

## 11. ファイル構成（SP1）

### 新規

| ファイル | 役割 |
|---|---|
| `src/components/military/MilspecLayout.tsx` | ルート。`.app` グリッド + 7 ゾーン配置 + PC オーバーレイ + `{children}` |
| `src/components/military/MilspecHeader.tsx` | §5.1 |
| `src/components/military/MilspecSidebar.tsx` | §5.2 |
| `src/components/military/MilspecSeam.tsx` | §5.3（小） |
| `src/components/military/MilspecToolbar.tsx` | §5.4 上段 |
| `src/components/military/MilspecControlBar.tsx` | §5.5（モックの `.subtoolbar`） |
| `src/components/military/MilspecWorkspace.tsx` | §5.6 |
| `src/components/military/MilspecFooter.tsx` | §5.7 |
| `src/components/military/svg/*.tsx` | 紋章・PCB ハーネス・×マーク等のインライン SVG（必要分） |
| `src/locales/{ja,en,zh,zh-Hant,ko}.json` への追記 | 新規 i18n キー（軍事ラベル併記分・最初から 5 言語 — memory `feedback_i18n_all_5_languages_upfront`） |

### 変更

| ファイル | 変更 |
|---|---|
| `src/components/Layout.tsx` | 全フックの後・標準 return の直前に `if (themeStyle === 'military' && !isMobile) return <MilspecLayout .../>` を 1 か所追加。`themeStyle` の購読を追加。**標準 return の JSX は未編集。** |
| `src/styles/military.css` | SP1 節を追加（各ゾーンの意匠・全ルール `.theme-military` 前置）。Phase 2 節（§9）を撤去。 |
| `ConsolidatedHeader.tsx` / `Sidebar.tsx` / `Timeline.tsx` / `TimelineRow.tsx` / `AppFooter.tsx` / `MobileHeader.tsx` 他 | §9 の `data-milspec-*` フック撤去（Phase 1 以前へ復元） |
| `MilspecStyleToggle` の配線 | `MilspecHeader` から呼ぶよう移設（従来 `ConsolidatedHeader` 隣接だった分） |

### 触らない

- `src/store/*.ts`（`useThemeStore` 含む — 2 軸化は実装済み）
- `src/components/Timeline*.tsx` の**ロジック**（`data-milspec-*` 撤去以外）
- `MitigationSheet.tsx` / `MitigationSheet.css`（みんなの軽減表・スコープ外）
- `src/components/MobileFab.tsx`（casing 厳守 — memory `feedback_mobilefab_casing_exact`。SP1 では変更なし）
- `/admin` `/housing` `landing`

---

## 12. SP1 がやらないこと

- タイムライン表の中身の作り直し（列グリッド・軽減バー座標・スクロール同期・行間引き）→ **SP2**。SP1 は既存 `Timeline` を埋め込むだけ。
- `MilspecControlBar`（モック `.subtoolbar`・折りたたむ/AA追加/メモ/罫線/リキャスト行/元に戻す・やり直し/軽減クリア/ジョブチップ）→ **SP2**（§5.5・§4.1 注記）。SP1 では埋め込んだ `Timeline` 自身のコントロールバーがそのまま動く。
- スマホの軍事レイアウト → **SP3**。SP1 は 768px 未満で標準にフォールバック。
- パーティ編成・ステータス設定・イベント追加・軽減追加モーダルの軍事化 → **SP4**。
- 折りたたみ/集中モードの凝った軍事デザイン → SP1 後の追加作業（Q4）。
- 共有・FFLogs・スプシの軍事化 → やらない（Q5・標準のまま）。
- フッター HUD / タービン / ロールカウンター / 導管 の「作り込みの最終形」→ SP1 で骨格まで、細部は実機を見て追加（2026-09-02 §9 の「足せる所に足す」方針を踏襲）。

---

## 13. 未確定（実装時 or 後続 SP で詰める）

- §4.2 の `clamp` の min / vw 係数（実装時に 3 ケースで詰める・プランに検証手順）。
- `MilspecSeam` の導管と `MilspecChrome` の外枠導管の役割分担。
- ヘッダーに追加で載せる機能（同期・保存状態・スタイル切替）の正確な配置。
- `MilspecControlBar` のジョブチップ（`.cb-e`）が SP1 で操作対応するか表示のみか。
- フッターのカーソル座標計器の実装詳細（pointermove rAF スロットル + 静止検知。マウス追従 UI 禁止ルールとの折り合い）。
- 集中モード時の `MilspecToolbar` / `MilspecControlBar` の扱い。
- Phase 2 CSS のどの宣言を新ゾーンに流用するか（プランのタスク単位で判断）。

---

## 14. 実装フェーズ（writing-plans で詳細化）

SP1 内の想定タスク順（各タスクにローカル実機確認ゲート）:

1. **分岐 + `MilspecLayout` の骨格** — `Layout.tsx` に分岐追加、`MilspecLayout` が `.app` グリッドと 7 つの空ゾーン枠 + `{children}` 埋め込み + PC オーバーレイ。標準不変検証（§10-1,2）。軍事モードで「グリッドに既存 Timeline が乗るだけ」の状態。
2. **Phase 2 スキン撤去**（§9）— 標準コンポーネントを Phase 1 以前へ。標準不変検証を再実行。
3. **`MilspecWorkspace`** — 装甲板の枠・ビス・刻印・スクリーン面。既存 Timeline がその中で従来通り動く。
4. **`MilspecHeader`** — ロゴ/メタ/遭遇名/銘板/共有/ツール。配線 + 実機確認。
5. **`MilspecSidebar`** — シナリオ/プラン一覧/フェーズ/バックアップ/DEPLOYMENT。配線 + 実機確認。
6. **`MilspecToolbar`** — モック `.toolbar`（CREW: パーティ編成/設定/ログ取込/その他・VIEW: みんなの軽減表/表示メンバー・SORT: ライト/ロール）。配線 + 実機確認。（`MilspecControlBar` は SP2）
7. **`MilspecFooter`** — 情報プレート/PCB ハーネス/計器。配線 + 実機確認。
8. **`MilspecSeam` + `MilspecChrome` 統合 + 折りたたみ挙動** — 溝/導管/外枠、S/H/F の機能的な畳み。
9. **サイズ詰め**（§4.2 の係数を 3 ケースで）+ i18n 5 言語 + push 前ゲート + whole-branch レビュー。

各フェーズ後に masaya がローカルで実機確認 → 次へ。

---

## 15. 制約（Global Constraints・全タスク拘束）

1. **標準モード（`themeStyle` 未設定 / `'standard'`）のレンダリング出力・挙動を `main` と完全一致させる。** 許容される変更は (a) `Layout.tsx` の分岐 1 か所の追加、(b) Phase 1/2 でこのプロジェクトが標準コンポーネントに加えた軍事関連の追加物（`data-milspec-*` 属性・ラッパー・`MilspecStyleToggle` の配線等）の撤去 = プロジェクト着手前の状態への復元、のみ。それ以外は標準 return の JSX・標準コンポーネントの実装に手を入れない。撤去後、標準モードの出力が `main` と一致することを §10 で証明する。
2. **既存の編集機能を壊さない。** 自動保存・collab・データ復旧・マイグレーション（`Layout` の実行時ホスト）は無改造。パーティ設定・取込・Undo/Redo・共有・リキャスト・PiP・集中モード・ヘッダー/サイドバー折りたたみが両モードで動く。
3. **みんなの軽減表シート本体**（`MitigationSheet.tsx` / `MitigationSheet.css`）は対象外・不変。
4. **正典はモックアップ**（`docs/.private/theme-refs/milspec-mockup.html`・絶対パスで実装者に渡す）。デザインの疑問はモックの CSS/DOM を引く。
5. すべての MIL-SPEC CSS ルールは `.theme-military` 前置（`military.css` に集約）。
6. `.claude/rules/css-rules.md` 遵守（`backdrop-filter: blur()` リテラル禁止 → `--tw-backdrop-blur` 変数 / `clip-path: path()` 禁止・polygon 可 / 回転 `::before` は `200vmax`）。
7. sizing はリポジトリ標準（`design-philosophy-sizing.md`）: 全 text px 固定・`clamp(MIN, N vw, BASE)` で max=base=1489・container max-width 1489・html font-size 16px。
8. i18n は最初から 5 言語（ja/en/zh/zh-Hant/ko）。機能ラベルの用語は変えない（memory `feedback_terminology_housing` の精神 — 「軽減表」等の既存用語を軍事語に置換しない。軍事英字は装飾として重ねるだけ）。
9. push は worktree から行わない（最終マージ時のみ）。push 前ゲート = `npm run build` + 対象 vitest。
10. `src/components/MobileFab.tsx` は小文字 `ab` で参照（本番ビルド保護）。
