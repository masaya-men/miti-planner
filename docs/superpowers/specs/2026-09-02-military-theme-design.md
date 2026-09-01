# MIL-SPEC テーマ（軍事SF・4つ目の選択式テーマ）— 設計書

- 作成日: 2026-09-02
- ステータス: brainstorm 完了 → 本設計書レビュー → writing-plans
- 種別: architectural（テーマシステムの2軸化 + 軽減表エディタ全面リスキン + 新規装飾クローム）
- 前提資料: `docs/.private/theme-refs/allagan-{light,dark}.png` / `docs/.private/2026-05-11-sf-military-theme-design-ORIGINAL.md`（素材・そのまま実行しない） / memory `project_sf_military_theme`

---

## 0. 一行サマリ

軽減表エディタ（`/miti`）に、既存の白黒テーマとは別系統の「軍事SF HUD」ルック（ユニコーンガンダム RX-0 = 白い軍事パネル分割・デカール・意味のない小文字 + アラガン戦闘解析端末）を、**選択式の4つ目のテーマ** として載せる。Light / Dark 両方をコアとする。**再スキン主体**でレイアウトは大きく変えない。

---

## 1. 目的・スコープ

### やること
- 軽減表エディタ画面（ルート `/miti` = `MitiPlannerPage` → `Layout` + `ConsolidatedHeader` + `Sidebar` + `Timeline` + `AppFooter` + 配下のモーダル + モバイル版）に MIL-SPEC ルックを適用する。
- Light 版（白基調・細い青のパネルライン・余白多め）と Dark 版（黒地・シアン発光 HUD・CRT 走査線）の両方を、同列のコアとして実装する。
- テーマ切替 UI を「明るさ（ライト/ダーク）× スタイル（標準/MIL-SPEC）」の2軸にする。
- 開発時だけ出る調整パネルで、発光・色相などの "さじ加減" を実機で詰められるようにする（詰め終わったら撤去）。

### やらないこと
- 管理画面（`/admin`）・LP（トップ）・みんなの軽減表（`MitigationSheet`）・ハウジング（`/housing`）へのテーマ適用。
- レイアウトの大改造（左アイコンレールのような新規ナビ、SCENARIO パネルの作り直し等）。
- 軽減表スプシモード（別タスク。トークン経由で作れば全テーマ自動対応になるので、本テーマのトークン設計だけ「スプシ対応可能」な形にしておく）。
- 課金・寄付者ゲート（全員無料）。

### スコープの線引き（判定基準）
編集対象が `src/components/MitiPlannerPage.tsx` / `src/components/Layout.tsx` / `src/components/ConsolidatedHeader.tsx` / `src/components/Sidebar.tsx` / `src/components/Timeline*.tsx` / `src/components/Mobile*.tsx`（エディタ関連）/ `src/components/*Modal*.tsx`（エディタから開くもの）/ `src/components/AppFooter.tsx` と、それらが読むトークン・CSS であれば対象。`admin/` `landing/` `housing/` 配下は対象外。

---

## 2. テーマシステムの2軸化

### 現状（コード調査 2026-09-01）
- `src/store/useThemeStore.ts`: `Theme = 'dark' | 'light'`、`persist` 名 `theme-storage` version 1。
- `<html>` へのクラス付与は **3箇所**:
  1. `useThemeStore` の `setTheme`（`classList.remove('theme-dark','theme-light')` → `add('theme-'+theme)`）
  2. `src/App.tsx` の `useEffect`（同じ処理）
  3. `index.html` 冒頭のインラインスクリプト（フラッシュ防止・localStorage から先読み）
- 切替 UI: `ConsolidatedHeader.tsx` の Sun/Moon ボタン1個（`runTransition(() => setTheme(...), 'theme')`）。ほかに `Layout.tsx` のフォーカスモード右レール、`MobileHeader` / `MobileFAB` にもテーマトグルがある。
- トークンは **2層**:
  - Tailwind `@theme`（`src/index.css` 冒頭）が `--color-app-*` / `--text-app-*` エイリアスを定義 → `--color-bg-primary` 等の「意味トークン」を指す。
  - 意味トークン（`--color-bg-primary/secondary/tertiary`・`--color-text-primary/secondary/muted`・`--color-accent-primary`・`--color-toggle-bg`・`--color-border`・`--color-blue/red/amber`（+hover/dim/border）・`--glass-tier1/2/3-*`・`--glass-panel-*`・`--color-sheet-bg`・`--color-nav-*` ほか）を `:root, .theme-dark { }` / `.theme-light { }` で上書き。

### 変更方針
`useThemeStore` に **スタイル軸** を足す。明るさ軸（`theme`）は一切変えない。

```ts
export type Theme = 'dark' | 'light';               // 既存・不変
export type ThemeStyle = 'standard' | 'military';    // 新規

interface ThemeState {
  theme: Theme;
  themeStyle: ThemeStyle;                            // 新規・既定 'standard'
  // ...既存
  setThemeStyle: (s: ThemeStyle) => void;            // 新規
}
```

- persist は `theme-storage` を継続。version を 2 に上げ、`migrate` で `themeStyle` 未設定 → `'standard'` を補う。
- `<html>` クラス付与を3箇所すべて更新:
  - `theme` に応じて `theme-dark` / `theme-light`（既存）
  - `themeStyle === 'military'` のとき `theme-military` を**追加**（standard のときは付けない）
  - 例: military + dark → `<html class="theme-military theme-dark">`
- `index.html` インラインスクリプトも `themeStyle` を読んで `theme-military` を先付けする（フラッシュ防止）。

### なぜ「重ねる」か（全置換ではなく）
`.theme-dark` / `.theme-light` を残したまま `.theme-military` を重ねることで:
- 既存の dark/light 判定コード（`.theme-light .foo { }` 等が CSS 各所にある）がそのまま「下地」として動く。
- リスキンは **意味トークンの再定義** で行う（§3）。`.theme-military.theme-dark { --color-bg-primary: ...; }` のように意味トークンを丸ごと差し替えれば、`--color-app-*` 経由の Tailwind ユーティリティ（`bg-app-bg` `text-app-text` 等）は全部自動追従する。→ 「半 themed で取り残されるコンポーネント」を最小化。
- 装飾（切り欠き角・発光・ステンシル・走査線）だけ `.theme-military` を前置した**新規ルール**を足す。

---

## 3. トークン契約（リスキンの中心）

### 3.1 意味トークンの再定義
`.theme-military.theme-dark { }` と `.theme-military.theme-light { }` の2ブロックを新規 CSS に定義し、既存の意味トークンを**すべて**上書きする（一部だけ上書きすると混在事故になる）。最低限、以下を再定義:

| カテゴリ | トークン |
|---|---|
| 背景 | `--color-bg-primary` `--color-bg-secondary` `--color-bg-tertiary` |
| アクセント | `--color-accent-primary` `--app-accent-rgb` `--color-accent-secondary` `--color-accent-dim` |
| 文字 | `--color-text-primary` `--color-text-secondary` `--color-text-muted` `--color-text-on-accent` |
| トグル | `--color-toggle-bg` `--color-toggle-text` |
| 罫線 | `--color-border` `--color-border-accent` |
| 機能色 | `--color-blue*` `--color-red*` `--color-amber*`（青=進む/OK、赤=危険、黄=警告。MIL-SPEC ではシアン/オレンジ/レッド寄りに再定義するが**役割は不変**） |
| ガラス | `--glass-tier1/2/3-*`（blur を 0〜低に、bg を金属プレート風グラデに、border をシアン系に、shadow を強めに） |
| ガラス旧 | `--glass-bg-*` `--glass-border` `--glass-hover` `--glass-active` `--glass-panel-*` |
| モバイル | `--color-sheet-bg` `--color-nav-bg` `--color-nav-border` `--color-overlay` `--color-fab-*` |
| 進捗トースト | `--progress-toast-*` |
| 角丸 | `--radius-*`（`sm:2px` `md:3px` `lg:4px` … 全体的に立てる） |

> LP トークン（`--color-lp-*`）はスコープ外なので再定義しない。

### 3.2 MIL-SPEC 固有トークン
`.theme-military { }` に、テーマ固有の値を定義（dark/light 共通の骨格 + §4 のさじ加減変数を参照）:

```css
.theme-military {
  --milspec-font-display: 'Orbitron', 'Rajdhani', sans-serif;
  --milspec-font-mono: 'Share Tech Mono', ui-monospace, monospace;
  --milspec-font-ui: 'Rajdhani', 'M PLUS 1', system-ui, sans-serif;   /* 既存 UI フォント流用 */

  --milspec-clip-corner: var(--milspec-tune-corner, 8px);
  --milspec-border-w: 1px;
  --milspec-border-w-strong: 2px;
  /* 発光・走査線・ステンシル等は §4 のさじ加減変数を各所で参照 */
}
```

### 3.3 スプシモード互換の担保（将来タスク向け）
本テーマで新設するトークンは `--milspec-*` 名前空間に閉じる。スプシモードが将来 `--color-app-*` / 意味トークン経由で組まれれば、`.theme-military` の意味トークン再定義だけで自動対応する。装飾（切り欠き角等）はスプシのセル UI にも `.theme-military .spreadsheet-cell` のような形で足せる余地を残す。

---

## 4. さじ加減変数と調整パネル（Phase 0 の主役）

### 4.1 `--milspec-tune-*` 変数
「見た目の最終判断が要る」パラメータを CSS カスタムプロパティとして切り出し、`.theme-military` の各装飾ルールはこれを参照する。初期値は暫定、Phase 0 で masaya が実機で詰める。

| 変数 | 意味 | 暫定初期値 |
|---|---|---|
| `--milspec-tune-glow` | 発光の強さ（0〜1・Dark で主に効く） | `0.5` |
| `--milspec-tune-accent-hue` | シアンの色相回転（deg） | `0deg` |
| `--milspec-tune-accent-sat` | アクセント彩度倍率 | `1` |
| `--milspec-tune-corner` | 切り欠き角のサイズ（px） | `8px` |
| `--milspec-tune-scanline` | 走査線の不透明度（0〜0.06・Dark のみ） | `0.02` |
| `--milspec-tune-grid` | 背景グリッド線の不透明度 | `0.04` |
| `--milspec-tune-panel-line` | パネルラインの太さ（px・Light で主に効く） | `1px` |
| `--milspec-tune-decal` | デカール/ステンシル小文字の不透明度 | `0.9` |
| `--milspec-tune-hazard` | ハザード斜線帯の不透明度 | `0.55` |

### 4.2 調整パネル `MilspecTunePanel`
- `src/components/dev/MilspecTunePanel.tsx`（新規・**開発専用**）。
- 表示条件: `import.meta.env.DEV && (URLに ?tune が付く or localStorage 'milspec-tune'==='1')`。本番ビルドには出さない（条件で自然に落ちる。念のため `import.meta.env.DEV` ガード）。
- 中身: 各 `--milspec-tune-*` の `<input type="range">` + 現在値表示 + 「クリップボードにコピー」（現在値を CSS ブロックとして出力）。
- 動作: スライダー変更で `document.documentElement.style.setProperty('--milspec-tune-glow', v)` 等。CSS 変数の書き換えだけなのでリロード不要・即反映。
- 位置: 画面右下固定・小さい・折りたたみ可。テーマが `military` でないときは自動で隠れる。
- 撤去: Phase 0 完了時に確定値を `.theme-military.*` ブロックへ焼き込み、このコンポーネントとルート配線を削除する（実装計画の最終タスク）。

> ⚠ [[feedback_artifact_republish_state_loss]] の教訓と同様、Phase 0 で masaya に「今スライダーがどの値か」を確認してから CSS へ焼き込む。

---

## 5. カラーパレット（初期値・Phase 0 で確定）

元設計書 §2.1 をベースに、Dark / Light それぞれの意味トークン初期値を置く。**これは出発点であって、§4 の調整で最終決定する。**

### Dark（黒地・シアン発光）
- `--color-bg-primary: #0a1015` / `secondary: #0a1015` / `tertiary: #0e1620`
- `--color-accent-primary: #5fd4ff`（シアン）/ `--app-accent-rgb: 95, 212, 255`
- `--color-text-primary: #d8e8f4` / `secondary: #94afc6` / `muted: #5d7a92`
- `--color-border: rgba(120,180,220,0.12)` / `--color-border-accent: rgba(120,200,240,0.35)`
- `--color-blue: #5fd4ff`（=シアン。"進む/OK" の役割）/ `--color-amber: #ff8a3d`（オレンジ。警告・タイムライン縦線）/ `--color-red: #ff3b3b`（レッド。致命）
- 軽減後ダメージの緑: `--color-... : #5fe39a`（該当トークンを特定して差し替え）
- ガラス: `blur: 0`、bg = ガンメタルのグラデ、border = `rgba(95,212,255,0.14〜0.3)`、shadow 強め

### Light（白基調・細い青ライン）
- `--color-bg-primary: #e9eff5` / `tertiary: #ffffff`
- `--color-accent-primary: #0a8fd1`（濃いシアン）
- `--color-text-primary: #162533` / `secondary: #3e556b` / `muted: #6f8398`
- `--color-border: rgba(40,80,120,0.18)` / `--color-border-accent: rgba(30,90,140,0.45)`
- `--color-blue: #0a8fd1` / `--color-amber: #e26a1a` / `--color-red: #d92020`
- ガラス: 白パネル + 薄いシアンの縁、影は控えめ、blur 低〜0

### 機能色の不変条件
`--color-blue`（進む/OK）・`--color-red`（危険/削除）・`--color-amber`（警告）は**色相が変わっても役割は不変**。ボタン・削除確認・競合警告の意味付けは既存のまま。緑（軽減後ダメージ）も維持。

---

## 6. タイポグラフィ

### フォント
| 用途 | フォント | 現状 |
|---|---|---|
| ロゴ・大見出し | Orbitron (500/700/900) | **新規・自前ホスト** |
| 数値・コード番号・タイムライン時刻 | Share Tech Mono | **新規・自前ホスト** |
| UI 全般・日本語 | Rajdhani + M PLUS 1 | 既存（流用） |

### 読み込み方式（業界標準 = 自前ホスト + 遅延）
- Orbitron / Share Tech Mono の woff2（latin サブセット・各20KB前後）を `public/fonts/` に配置。
- `src/styles/military.css` に `@font-face`（`font-display: swap`）を宣言。
- 参照は `.theme-military` 配下のルールのみ（`--milspec-font-display` 等）。→ **ブラウザは `.theme-military` が付くまでフォントファイルを一切ダウンロードしない**（フォントの遅延読み込みは標準挙動）。JS 不要。
- Google Fonts CDN は使わない（GDPR・追加接続の回避）。既存の Rajdhani / M PLUS 1 の自前化は別タスク（本テーマではやらない）。

### 文字装飾ルール（`.theme-military` 配下）
- 大見出し: `letter-spacing: 0.15em; text-transform: uppercase;`
- ラベル: `letter-spacing: 0.08em; text-transform: uppercase;`
- 日本語混在: `letter-spacing: 0.05em;` 控えめ

---

## 7. 装飾プリミティブ（再利用部品）

`src/styles/military.css` に集約。すべて `.theme-military` を前置。元設計書 §6 のスニペットを土台にする（`clip-path: polygon()` は使用可・`path()` は禁止 [css-rules.md]）。

- `.milspec-cut-corner` — 切り欠き角プレート（`clip-path: polygon(...)`、サイズは `var(--milspec-tune-corner)`）
- `.milspec-hazard-stripe` — ハザード斜線帯（`repeating-linear-gradient(-45deg, ...)`、不透明度 `var(--milspec-tune-hazard)`）
- `.milspec-brackets` / `.milspec-brackets-4` — 四隅アングルブラケット
- `.milspec-rivets` — 四隅リベット（`radial-gradient`）
- `.milspec-glow-text` / `--orange` / `--red` — グロー文字（強さ `var(--milspec-tune-glow)`）
- `.milspec-stencil` / `--faded` — ステンシル印字（Orbitron 900・不透明度 `var(--milspec-tune-decal)`）
- `.milspec-scanline-bar` / `--cyan` — タイムライン縦線用の発光バー
- `.milspec-badge` / `--edit` / `--share` — 角切りバッジ（EDIT MODE 等）

### 全体背景（Dark のみ CRT 走査線）
```css
.theme-military.theme-dark body::before {
  /* 走査線オーバーレイ・不透明度 var(--milspec-tune-scanline)・mix-blend-mode: screen */
}
@media (prefers-reduced-motion: reduce) {
  .theme-military body::before { display: none; }
}
```
背景グリッド（`linear-gradient` の格子・不透明度 `var(--milspec-tune-grid)`）は dark/light 共通で body に。

---

## 8. 画面別リスキン

すべて「既存の構造・クラスはそのまま、`.theme-military` 前置で見た目だけ差し替え」。

| 画面要素 | 実体 | リスキン内容 |
|---|---|---|
| ヘッダー | `ConsolidatedHeader.tsx`（Tailwind 直書き） | 装甲板グラデ背景 + 下端に赤ハザード帯 + LoPo ロゴを Orbitron ステンシル化（"COMBAT ANALYSIS SYSTEM" のサブ + `Ver. 2.0.0`）+ タイトルを角切りプレート + EDIT MODE / SHARE MODE を `.milspec-badge` + アイコンボタンを HUD ボタン化。**Tailwind ユーティリティが `--color-app-*` 経由なので土台の色は自動追従**、追加の装飾のみ `.theme-military .miti-header ...` 相当（実クラス名は実装時に確定）で足す。 |
| ツールバー（PARTY/STATUS/…） | ConsolidatedHeader 下段 | 角ばったコンソールスイッチ風。アイコン + 英語 + 日本語サブの構造は既存のまま、枠・アクティブ表現をシアン発光に。 |
| サイドバー | `Sidebar.tsx` | SCENARIO パネル風のカード見出し（`.milspec-stencil` + 菱形マーカー）、プラン項目の選択表現をシアン、下部の BACKUP/RESTORE をドックボタン化。**新規の縦アイコンレールは作らない。** |
| タイムライン表 | `Timeline*.tsx` / `TimelineRow.tsx` / `MobileTimelineRow.tsx` | スコープ風の背景グリッド、ヘッダー行を装甲板 + シアン下線、数値セルを Share Tech Mono、時刻をシアン、軽減後ダメージを緑グロー、致命を赤枠。AA/スキルの縦線を `.milspec-scanline-bar` の強発光オレンジ/シアンに。 |
| 効果時間のエフェクト（旧称「エフェクト棒」） | `MobileEffectBarLayer` ほか | 発光バー化。`src/index.css` の `@property --mobile-effect-bar-progress { syntax:'<number>' }`（スクロール性能の根治・2026-08-14）は絶対に消さない。色・発光だけ差し替える。 |
| カード（プラン一覧・OGP プレビュー） | `Sidebar` 内 / `SharePlanCard` | 角切り + リベット + ステンシルのラベル。 |
| モーダル | `EventModal` `PartySettingsModal` `ShareModal` ほか | `--glass-tier3-*` 再定義で土台が金属プレート化。角を立てる。[reference_modal_light_mode_white_bg] の `glass-tier3-bg` 必須ルールは維持。 |
| フッター | `AppFooter.tsx`（既存 24px 帯） | §9 のステータス帯へ拡張（PC のみ）。 |

---

## 9. 新規装飾クローム（PC / モバイル出し分け）

| 部品 | PC | モバイル | 実装 |
|---|---|---|---|
| **フッター HUD 帯**（enemy LEGEND / DECAL CODE / アラガン紋章 / SYSTEM STATUS） | **開閉式**（デフォルト開、畳むとステータス1行）。既存 `AppFooter` の領域を拡張（~24px → 開時 ~100px）。`enemy LEGEND` は実用（タイムラインのアイコン凡例） | **まるごと非表示** | 新規 `MilspecFooterHUD.tsx`。`.theme-military` かつ PC のときだけ描画。開閉状態は localStorage。 |
| **装飾スパイン**（縦組みステンシル "A.R.D // COMBAT ANALYSIS"・目盛り・パネル番号） | 画面端とサイドバーの隙間に。**完全に飾り**（操作要素なし）。1280px 以下では幅が取れなければ自動で消す | **なし**（代わりに MobileHeader の塗替え + ヘッダー下やナビ際の横型デカール1行 "AR-2409 // SYSTEM ONLINE ●" 等） | CSS 中心 + 必要なら小コンポーネント。`content-visibility` 等で常時コスト0に。 |
| **アラガン紋章 SVG** | フッター HUD 中央 | — | `src/components/military/svg/MilspecCrest.tsx`（インライン SVG・`currentColor`） |
| **バーコード SVG** | フッター HUD | — | `src/components/military/svg/MilspecBarcode.tsx`（"AR-<YYMMDD>"） |
| **小デカール**（"PX-042" 等の意味のない部品番号・ステンシル小文字） | ヘッダー隅・サイドバー下・フッター等の**既存の余白**に | ヘッダー下の横1行等 | CSS の `::after` / 小さな `<span className="milspec-stencil milspec-stencil--faded">` |
| **XENO ARMOR 広告カード** | **作らない**（広告に見える・寄付堅持と不整合） | — | — |

> スパインとフッター HUD の中身は「作りながら足せる所に足す」（masaya 方針 2026-09-02）。実装計画では「最小構成 → 実機で余白を見て追加」を明示する。

---

## 10. 切替 UI

### スタイル切替ボタン（新規）
- `ConsolidatedHeader.tsx` の Sun/Moon ボタンの**隣**に、独立した「スタイル切替」ボタンを新設（トグルではなく専用ボタン）。
- クリックで `themeStyle` を `standard` ⇄ `military` トグル。既存のテーマ遷移演出（`useTransitionOverlay` の `runTransition`）を流用（渡す variant は実装時に確認）。
- アイコン: 標準時 = MIL-SPEC を示すアイコン（六角ボルト/ブラケット等）、MIL-SPEC 時 = 標準へ戻すアイコン。Tooltip に i18n 文言。
- ラベル露出が要るところは "MIL-SPEC"（全言語共通）。

### 配置箇所
| 箇所 | 対応 |
|---|---|
| `ConsolidatedHeader`（PC ヘッダー） | **必須**。Sun/Moon の隣。 |
| `MobileHeader` | **必須**。テーマトグルの隣。 |
| `MobileFAB` | **必須**（FAB メニューに項目追加）。 |
| `Layout` フォーカスモード右レール | 任意（3アイコンの最小ストリップ。4つ目を足すか、ここは省略）。実装時に判断。 |

### i18n
- `theme.style.milspec` = "MIL-SPEC"（全言語同一）
- `theme.style.toggle_to_milspec` / `theme.style.toggle_to_standard`（Tooltip・5言語）
- Ko-fi 導線文（下記 §11・5言語）

---

## 11. 寄付導線

- スタイル切替ボタン付近、または MIL-SPEC 選択時に一度だけ出る控えめな一行に「気に入ったら Ko-fi で応援」リンク。
- 文言は in-app のみ（Discord 告知トーン規則 [[feedback_discord_announcement_tone]] は別コンテキスト）。
- 「ぜひ試して」等の煽り表現は使わない。事実ベースの一行（例: "このテーマが気に入ったら ☕ Ko-fi"）。
- i18n キー `theme.style.milspec_support` を5言語。
- 支援者ゲートは作らない（[[feedback_auth_privacy]]・全員無料）。

---

## 12. デカール文言のガイドライン

memory 論点3 に従う。

| OK（そのまま使う） | 調整 or 不使用 |
|---|---|
| COMBAT ANALYSIS SYSTEM / LOOP OPTIMIZER | PROPERTY OF GARLEMALD EMPIRE（偽の所有権表記・SE 表記と紛らわしい） |
| ALLAGAN RESEARCH DIVISION / COMBAT SIMULATION DEPARTMENT（ゲーム内用語・商標問題なし） | OWNERSHIP OF THIS DATA IS RESTRICTED / UNAUTHORIZED ACCESS PROHIBITED（偽のアクセス制限文） |
| SYSTEM ONLINE ● / OPERATIONAL / 正常稼働中 | DO NOT REMOVE（実物の注意書きに酷似・弱める or 削る） |
| PX-042 / MTG-81A / AR-240517 等の意味のない部品番号・コード | © SQUARE ENIX 等の偽の著作権行（本物のフッター表記と別に、飾りとして置かない） |
| Ver. 2.0.0 / A.R.D // <日付> | |

実在の SE 著作権表記（`AppFooter` の本物）はスコープ外・不変。

---

## 13. レスポンシブ

- 基準は既存の sizing 思想（[design-philosophy-sizing]）に従う。全 text px 固定・`clamp(MIN, N vw, BASE)` で max=base=1489。
- 1489 / 1920 / 2560 / スマホ の各ケースで破綻しないこと。
- 1280px 以下: 装飾スパインが幅を取れなければ自動で消す。フッター HUD は開閉式のまま。
- スマホ（<768px）: フッター HUD 非表示・スパイン非表示。テーマ性は「色 + MobileHeader 塗替え + タイムライン/カードの角切り・ステンシル + 横型デカール1行」で担保。
- スクロールバー約17px 控除は既存どおり。

---

## 14. アクセシビリティ

- 走査線オーバーレイ・グロー脈動アニメは `@media (prefers-reduced-motion: reduce)` で無効化。
- Dark / Light とも本文テキストのコントラスト比を確認（発光で読みにくくならないこと。Phase 0 の実機チェック項目）。
- アプリ内 text size 設定（`data-text-scale`）は既存どおり効くこと（フォント差し替えでレイアウトが割れないか確認）。
- スタイル切替ボタンに `aria-label` / `aria-pressed`。

---

## 15. ファイル構成（新規・変更）

### 新規
- `src/styles/military.css` — `@font-face` / `.theme-military.*` トークンブロック / `.milspec-*` 装飾プリミティブ / 画面別リスキンルール。`src/main.tsx` で `import`（バンドル同梱・`.theme-military` 無しでは不活性）。
- `public/fonts/orbitron-*.woff2` / `public/fonts/share-tech-mono-*.woff2`
- `src/components/military/MilspecFooterHUD.tsx`
- `src/components/military/svg/MilspecCrest.tsx` / `MilspecBarcode.tsx`
- `src/components/military/MilspecStyleToggle.tsx`（スタイル切替ボタン）
- `src/components/dev/MilspecTunePanel.tsx`（開発専用・Phase 0 後に撤去）

### 変更
- `src/store/useThemeStore.ts` — `themeStyle` / `setThemeStyle` / migrate v2
- `src/App.tsx` — `<html>` クラス付与に `theme-military` 追加
- `index.html` — インラインスクリプトに `themeStyle` 先読み
- `src/components/ConsolidatedHeader.tsx` / `MobileHeader.tsx` / `MobileFab.tsx`（casing 厳守 [[feedback_mobilefab_casing_exact]]）— スタイル切替ボタン配線
- `src/components/AppFooter.tsx` — MIL-SPEC 時にフッター HUD へ委譲（PC）
- `src/locales/{ja,en,zh,zh-Hant,ko}.json` — i18n キー追加（最初から5言語 [[feedback_i18n_all_5_languages_upfront]]）
- CSS 各所で `.theme-light .foo { ハードコード }` になっている箇所のうち、エディタ対象かつ MIL-SPEC で破綻するものに `.theme-military .foo { }` を追加（`MitigationSheet.css` の該当分は対象外＝みんなの軽減表シート）

---

## 16. 実装フェーズ（writing-plans で詳細化）

- **Phase 0 — 骨組み + 調整**
  1. `useThemeStore` 2軸化 + 3箇所のクラス付与 + migrate。
  2. `military.css` に意味トークン再定義（§5 初期値）+ `--milspec-tune-*` 変数 + 最小限の装飾（切り欠き角・背景グリッド・走査線・ステンシル）。
  3. フォント自前ホスト + `@font-face`。
  4. スタイル切替ボタン（最低 ConsolidatedHeader）。
  5. `MilspecTunePanel`。
  6. **masaya がローカルで Dark / Light を実機確認 → 調整パネルでさじ加減を詰める → 確定値を CSS へ焼き込み**。ここで見た目の方向性を承認。
- **Phase 1 — 画面別リスキン**（§8 を上から。ヘッダー → ツールバー → サイドバー → タイムライン → カード → モーダル → フッター）。各段でローカル実機確認。
- **Phase 2 — 新規装飾クローム**（§9。フッター HUD 開閉式 → スパイン → SVG → 小デカール。「最小 → 余白を見て追加」）。
- **Phase 3 — 仕上げ**（レスポンシブ 1280/スマホ / reduced-motion / コントラスト / i18n / Ko-fi 導線 / 調整パネル撤去 / whole-branch 敵対レビュー）。

各フェーズは「ローカル実機確認（masaya）」をゲートにする。[[feedback_no_screenshots_local_verify]]（Claude はスクショを見ない）・[[reference_dev_editor_hmr_hardreload]]（useEffect 変更後はハードリロード）。

---

## 17. テスト方針

- **単体**: `useThemeStore` の `themeStyle` トグル / persist migrate v1→v2（`themeStyle` 補完） / `<html>` クラス付与の組み合わせ（military+dark / military+light / standard）。
- **コンポーネント**: `MilspecStyleToggle` のトグル動作 / `MilspecFooterHUD` の PC 限定描画・開閉 / 調整パネルの DEV ガード。
- **回帰**: 既存のテーマ関連テスト（`ConsolidatedHeader.viewer.test` 等）が standard で不変。
- **視覚**: 自動化しない。Phase ごとの masaya 実機確認が正典。
- push 前ゲート: `npm run build`（tsc -b 厳密 [[feedback_vercel_tsc_strict]]）+ 変更周辺 vitest。フルスイートはハング既知 [[reference_vitest_vmthreads_hang]] のため対象を絞る。

---

## 18. スコープ外・将来

- 軽減表スプシモード（別タスク。本テーマのトークンを `--color-app-*` / 意味トークン経由で組む前提が整えば全テーマ自動対応）。
- 管理画面・LP・みんなの軽減表・ハウジングへの MIL-SPEC 適用。
- 既存 Rajdhani / M PLUS 1 の自前ホスト化。
- 元設計書 §7.2.1 の縦アイコンレール（偽ナビになるため不採用）、§7.7 XENO ARMOR カード（不採用）。

## 19. 未確定（Phase 0 の調整で決める）

- §5 の全パレット値（初期値は出発点）。
- §4 の全 `--milspec-tune-*` 初期値。
- フッター HUD の開時の高さ・列構成の最終形。
- スパインの具体的な内容量（「足せる所に足す」）。
- フォーカスモード右レールにスタイル切替を足すか。
