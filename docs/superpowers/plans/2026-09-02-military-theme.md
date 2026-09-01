# MIL-SPEC テーマ（軍事SF） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軽減表エディタ（`/miti`）に、選択式の4つ目のテーマ「MIL-SPEC（軍事SF HUD）」を Light / Dark 両方で載せる。再スキン主体、レイアウト不変。

**Architecture:** 明るさ軸（`theme: dark|light`・不変）に対して直交する「スタイル軸」（`themeStyle: standard|military`）を `useThemeStore` に足す。`themeStyle==='military'` のとき `<html>` に `theme-military` クラスを**追加**（`theme-dark`/`theme-light` は残す）。リスキンは「意味トークン（`--color-bg-primary` 等 ~40個）を `.theme-military.theme-dark {}` / `.theme-military.theme-light {}` で丸ごと再定義」→ `--color-app-*` 経由の Tailwind ユーティリティが全自動追従。装飾（切り欠き角・発光・ステンシル・走査線）は `.theme-military` 前置の新規 CSS。見た目の "さじ加減" は `--milspec-tune-*` CSS 変数に切り出し、開発専用の調整パネルで実機調整 → 確定値を CSS へ焼き込み → パネル撤去。

**Tech Stack:** React 19 + Vite + Tailwind v4（`@theme` in CSS）+ Zustand（persist）+ i18next（5言語）+ vitest。CSS は素の CSS ファイル（`src/styles/`）。フォントは自前ホスト woff2 + `@font-face`。

**Spec:** `docs/superpowers/specs/2026-09-02-military-theme-design.md`（本プランはこの spec から論証する。実装者は両方読むこと）

## Global Constraints

- **言語**: コード内コメント・ドキュメントは日本語（CLAUDE.md）。
- **i18n**: UI 文字列は i18n キー経由・ハードコード禁止。新規キーは最初から `ja / en / zh / zh-Hant / ko` の5言語すべて（`src/locales/*.json`）。ロケール JSON は該当ブロックのみ textual 編集、全体 parse→stringify 禁止。
- **CSS 技術制約**: `backdrop-filter: blur(...)` リテラル禁止（`--tw-backdrop-blur` 変数パターン）。`clip-path: path()` 禁止（`polygon()` は可）。回転する `::before` は `200vmax`。
- **表示名**: テーマ選択 UI に出す名前は **`MIL-SPEC`**（全言語共通・翻訳しない）。内部 codename は `military`。
- **スコープ**: `/miti` エディタとその配下（`MitiPlannerPage` / `Layout` / `ConsolidatedHeader` / `Sidebar` / `Timeline*` / `Mobile*` / エディタから開くモーダル / `AppFooter`）のみ。`admin/` `landing/` `housing/` `MitigationSheet.css`（みんなの軽減表シート）は対象外。
- **機能色の役割不変**: `--color-blue`（進む/OK）・`--color-red`（危険/削除）・`--color-amber`（警告）・緑（軽減後ダメージ）は色相が変わっても意味付けを変えない。
- **性能**: `src/index.css` の `@property --mobile-effect-bar-progress { syntax:'<number>' }` を絶対に消さない（2026-08-14 スクロール性能の根治）。マウス追従の高頻度イベントを増やさない。
- **アニメーション**: 走査線・グロー脈動は `@media (prefers-reduced-motion: reduce)` で無効化。
- **既存挙動不変**: `themeStyle` 未指定（standard）のとき、既存のダーク/ライトの見た目・挙動は完全に不変。
- **フォント**: Google Fonts CDN は使わない。Orbitron / Share Tech Mono は自前ホスト woff2 + `@font-face`（`font-display: swap`）、`.theme-military` 配下でのみ参照（→ 自然遅延読み込み）。
- **検証**: 見た目の変更は masaya のローカル実機確認がゲート（Claude はスクショを見ない）。DEV エディタの useEffect 変更後はハードリロード必須。push 前ゲート = `npm run build`（tsc -b 厳密）+ 変更周辺 vitest（フルスイートはハング既知のため対象を絞る）。
- **コミット**: 1タスク=1コミット目安。並行実行しない（同一 CSS ファイルに集中するため直列）。コミットメッセージ末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。

---

## File Structure

### 新規ファイル

| ファイル | 責務 |
|---|---|
| `src/styles/military.css` | `@font-face` 宣言 / `.theme-military.theme-dark` `.theme-military.theme-light` の意味トークン再定義 / `.theme-military` の `--milspec-*` 固有トークン + `--milspec-tune-*` 変数 / `.milspec-*` 装飾プリミティブ / 画面別リスキンルール（`.theme-military` 前置）。`src/main.tsx` で `import`。 |
| `public/fonts/orbitron-{400,700,900}.woff2` | Orbitron（ロゴ・大見出し）。latin サブセット。 |
| `public/fonts/share-tech-mono-400.woff2` | Share Tech Mono（数値・コード番号）。latin サブセット。 |
| `src/components/military/MilspecStyleToggle.tsx` | スタイル切替ボタン（`standard` ⇄ `military`）。ヘッダー等から使う小コンポーネント。 |
| `src/components/military/MilspecFooterHUD.tsx` | 開閉式フッター HUD（enemy LEGEND / DECAL CODE / 紋章 / SYSTEM STATUS）。PC + `military` のときだけ描画。 |
| `src/components/military/svg/MilspecCrest.tsx` | アラガン紋章 インライン SVG（`currentColor`）。 |
| `src/components/military/svg/MilspecBarcode.tsx` | バーコード風 インライン SVG（`AR-<YYMMDD>`）。 |
| `src/components/dev/MilspecTunePanel.tsx` | **開発専用**の調整パネル。`--milspec-tune-*` をスライダーで操作。Phase 3 で撤去。 |
| `src/store/__tests__/useThemeStore.test.ts` | `themeStyle` トグル / persist migrate / クラス付与ロジックのテスト。 |
| `src/components/military/__tests__/MilspecStyleToggle.test.tsx` | 切替ボタンの動作テスト。 |
| `src/components/military/__tests__/MilspecFooterHUD.test.tsx` | PC 限定描画・開閉のテスト。 |

### 変更ファイル

| ファイル | 変更 |
|---|---|
| `src/store/useThemeStore.ts` | `ThemeStyle` 型 / `themeStyle` state（既定 `'standard'`）/ `setThemeStyle` / `applyThemeClasses` ヘルパー / persist version 2 + migrate。 |
| `src/App.tsx` | `<html>` クラス付与 useEffect を `themeStyle` も見るよう変更。 |
| `index.html` | フラッシュ防止インラインスクリプトに `themeStyle` 先読み。 |
| `src/main.tsx` | `import './styles/military.css'`。 |
| `src/components/ConsolidatedHeader.tsx` | Sun/Moon ボタンの隣に `<MilspecStyleToggle />`。 |
| `src/components/MobileHeader.tsx` | テーマトグルの隣に `<MilspecStyleToggle compact />`。 |
| `src/components/MobileFab.tsx` | FAB メニューにスタイル切替項目（casing: 必ず `MobileFab` 小文字 `ab`）。 |
| `src/components/AppFooter.tsx` | `military` かつ PC のとき `<MilspecFooterHUD />` に委譲。 |
| `src/locales/{ja,en,zh,zh-Hant,ko}.json` | `theme.style.*` キー追加。 |
| `src/styles/military.css` 追記（Phase 1〜3 で継続的に） | 画面別リスキン・新規クロームのスタイル。 |

### テスト規約（このプラン内）

- **ロジック（store / トグル / 条件描画）** = 通常の TDD（失敗テスト先行 → 実装 → green → commit）。
- **純粋な見た目（CSS リスキン）** = 自動テストを書かない。代わりに各タスクの「Definition of done」に **masaya がローカルで確認する具体的チェックリスト**を書く。実装 → masaya 確認 → commit。
- Phase 1 以降の「見た目」タスクは、フェーズ着手時に対象コンポーネントの実クラス／DOM を Read で確認してからスタイルを書く（推測で書かない）。

---

## Phase 0 — 骨組み + 調整基盤

Phase 0 のゴール: **本物のテーマが Light / Dark 両方で切り替わり、調整パネルで見た目を詰められる状態**。ここで masaya が方向性を承認する。

### Task 0.1: `useThemeStore` にスタイル軸を追加

**Files:**
- Modify: `src/store/useThemeStore.ts`
- Create: `src/store/__tests__/useThemeStore.test.ts`

**Interfaces:**
- Produces:
  - `type ThemeStyle = 'standard' | 'military'`
  - `useThemeStore` state に `themeStyle: ThemeStyle`（既定 `'standard'`）と `setThemeStyle: (s: ThemeStyle) => void`
  - `export function applyThemeClasses(theme: Theme, style: ThemeStyle): void` — `<html>` の `theme-dark`/`theme-light`/`theme-military` を正しい状態にする単一の関数（App.tsx と store が共用）
- Consumes: なし

- [ ] **Step 1: 失敗テストを書く** — `src/store/__tests__/useThemeStore.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore, applyThemeClasses } from '../useThemeStore';

describe('useThemeStore themeStyle 軸', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    useThemeStore.setState({ theme: 'dark', themeStyle: 'standard' });
  });

  it('themeStyle の既定は standard', () => {
    expect(useThemeStore.getState().themeStyle).toBe('standard');
  });

  it('setThemeStyle("military") で state が更新され <html> に theme-military が付く', () => {
    useThemeStore.getState().setThemeStyle('military');
    expect(useThemeStore.getState().themeStyle).toBe('military');
    expect(document.documentElement.classList.contains('theme-military')).toBe(true);
    // 明るさ軸のクラスは維持
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('setThemeStyle("standard") で theme-military が外れる', () => {
    useThemeStore.getState().setThemeStyle('military');
    useThemeStore.getState().setThemeStyle('standard');
    expect(document.documentElement.classList.contains('theme-military')).toBe(false);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('setTheme("light") は themeStyle=military を保ったまま theme-light に切り替える', () => {
    useThemeStore.getState().setThemeStyle('military');
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.documentElement.classList.contains('theme-military')).toBe(true);
  });

  it('applyThemeClasses は3クラスを冪等に正規化する', () => {
    document.documentElement.className = 'theme-dark theme-military foo';
    applyThemeClasses('light', 'standard');
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.documentElement.classList.contains('theme-military')).toBe(false);
    expect(document.documentElement.classList.contains('foo')).toBe(true); // 無関係クラスは触らない
  });
});

describe('useThemeStore persist migrate', () => {
  it('version<2 の永続値に themeStyle が無ければ standard を補う', () => {
    // migrate 関数を直接叩く（persist の内部形に合わせる）
    const migrated = (useThemeStore.persist.getOptions().migrate as any)(
      { theme: 'dark', contentLanguage: 'ja', mobileEffectBarMode: 'icon' },
      1,
    );
    expect(migrated.themeStyle).toBe('standard');
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `npx vitest run src/store/__tests__/useThemeStore.test.ts`
Expected: FAIL（`applyThemeClasses` 未定義 / `themeStyle` 未定義）

- [ ] **Step 3: 実装** — `src/store/useThemeStore.ts`

`Theme` の下に:

```ts
/** テーマの「スタイル軸」。明るさ軸(theme)と直交。'military' = 軍事SF HUD (MIL-SPEC)。 */
export type ThemeStyle = 'standard' | 'military';
```

`ThemeState` インターフェースに追加:

```ts
    themeStyle: ThemeStyle;
    setThemeStyle: (style: ThemeStyle) => void;
```

ファイル末尾（`create` の外）にヘルパーを追加:

```ts
/** <html> のテーマクラス3種(theme-dark / theme-light / theme-military)を正しい状態へ正規化する。
 *  App.tsx の useEffect と store の setter が共用し、付与ロジックを1箇所に閉じる。 */
export function applyThemeClasses(theme: Theme, style: ThemeStyle): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-military');
    root.classList.add(`theme-${theme}`);
    if (style === 'military') root.classList.add('theme-military');
}
```

`persist` の中身:
- 初期 state に `themeStyle: 'standard',` を追加。
- `setTheme` を書き換え（現在の直接 classList 操作をヘルパー呼び出しに）:

```ts
            setTheme: (theme) => {
                set({ theme });
                applyThemeClasses(theme, get().themeStyle);
            },
            setThemeStyle: (themeStyle) => {
                set({ themeStyle });
                applyThemeClasses(get().theme, themeStyle);
            },
```

（`create` のシグネチャを `(set, get) => ({...})` に変更。既存は `(set) =>` なので `get` を足す。）

- persist オプション: `version: 2` に上げ、`migrate` を拡張（既存の mobileEffectBarMode 移行は残す）:

```ts
            version: 2,
            migrate: (persistedState, version) => {
                const state = persistedState as Partial<ThemeState>;
                if (version < 1 && state.mobileEffectBarMode === 'scroll') {
                    state.mobileEffectBarMode = 'icon';
                }
                if (version < 2 && state.themeStyle == null) {
                    state.themeStyle = 'standard';
                }
                return state;
            },
```

- [ ] **Step 4: テスト実行 → green 確認**

Run: `npx vitest run src/store/__tests__/useThemeStore.test.ts`
Expected: PASS（全 6 ケース）

- [ ] **Step 5: tsc**

Run: `npx tsc -b`
Expected: exit 0

- [ ] **Step 6: コミット**

```bash
git add src/store/useThemeStore.ts src/store/__tests__/useThemeStore.test.ts
git commit -m "feat(theme): テーマにスタイル軸(themeStyle: standard|military)を追加"
```

---

### Task 0.2: `<html>` クラス付与を App.tsx と index.html で `themeStyle` 対応にする

**Files:**
- Modify: `src/App.tsx:186-191`（theme sync useEffect）
- Modify: `index.html`（インラインスクリプト）

**Interfaces:**
- Consumes: `applyThemeClasses` / `useThemeStore.themeStyle`（Task 0.1）
- Produces: なし

- [ ] **Step 1: App.tsx を変更**

`src/App.tsx` 冒頭の import に `applyThemeClasses` を追加:

```ts
import { useThemeStore, applyThemeClasses } from './store/useThemeStore';
```

`function App()` 内、`const theme = useThemeStore((state) => state.theme);` の下に:

```ts
  const themeStyle = useThemeStore((state) => state.themeStyle);
```

theme sync useEffect（現 186-191 行）を差し替え:

```ts
  // Sync theme classes on <html> so Tailwind dark: variants & .theme-military skins work
  useEffect(() => {
    applyThemeClasses(theme, themeStyle);
  }, [theme, themeStyle]);
```

- [ ] **Step 2: index.html インラインスクリプトを変更**

`index.html` の `<script>` 内、テーマ適用ブロックを差し替え（`themeStyle` を読み、`theme-military` を先付け）:

```html
    try {
      var d = JSON.parse(localStorage.getItem('theme-storage') || '{}');
      var s = d && d.state;
      var t = s && s.theme;
      var brightness = (t === 'light' || t === 'dark')
        ? t
        : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      document.documentElement.classList.add('theme-' + brightness);
      if (s && s.themeStyle === 'military') {
        document.documentElement.classList.add('theme-military');
      }
    } catch(e) {
      document.documentElement.classList.add(
        window.matchMedia('(prefers-color-scheme: light)').matches ? 'theme-light' : 'theme-dark'
      );
    }
```

- [ ] **Step 3: 既存テストの回帰確認**

Run: `npx vitest run src/store/__tests__/useThemeStore.test.ts src/components/__tests__/ConsolidatedHeader.viewer.test.tsx`
Expected: PASS

- [ ] **Step 4: ローカル実機確認（masaya）**

- `npm run dev` → `/miti` を開く（ハードリロード）
- DevTools コンソールで `useThemeStore.getState().setThemeStyle('military')` を実行 → `<html>` に `theme-military` が付く（見た目はまだ変わらない = CSS 未実装なので正常）
- `setThemeStyle('standard')` で外れる
- リロードしても standard のまま（persist 動作確認）

- [ ] **Step 5: コミット**

```bash
git add src/App.tsx index.html
git commit -m "feat(theme): <html> のクラス付与(App/index.html)を themeStyle 対応に"
```

---

### Task 0.3: `military.css` の骨格 — トークン再定義 + 背景 + さじ加減変数

**Files:**
- Create: `src/styles/military.css`
- Modify: `src/main.tsx`（`import './styles/military.css'` を `import './index.css'` の後に追加）

**Interfaces:**
- Consumes: 既存の意味トークン名（spec §3.1）
- Produces: `.theme-military` 系のトークン契約 / `--milspec-tune-*` 変数（spec §4.1 の名前・初期値）

- [ ] **Step 1: `src/styles/military.css` を作成**

構成（この順で書く。値は spec §5 の初期値をそのまま。**これは Phase 0 の調整で確定するので "暫定" コメントを付ける**）:

```css
/* ============================================================
 * MIL-SPEC テーマ (軍事SF HUD) — codename: military
 * 設計書: docs/superpowers/specs/2026-09-02-military-theme-design.md
 * ⚠ .theme-military クラスが <html> に無いときは完全に不活性。
 * ⚠ 数値(色・発光・サイズ)は Phase 0 の調整パネルで確定する暫定値。
 * ============================================================ */

/* --- フォント (自前ホスト・latin サブセット・.theme-military 配下でのみ参照 → 自然遅延) --- */
@font-face {
  font-family: 'Orbitron';
  src: url('/fonts/orbitron-400.woff2') format('woff2');
  font-weight: 400; font-display: swap;
}
@font-face {
  font-family: 'Orbitron';
  src: url('/fonts/orbitron-700.woff2') format('woff2');
  font-weight: 700; font-display: swap;
}
@font-face {
  font-family: 'Orbitron';
  src: url('/fonts/orbitron-900.woff2') format('woff2');
  font-weight: 900; font-display: swap;
}
@font-face {
  font-family: 'Share Tech Mono';
  src: url('/fonts/share-tech-mono-400.woff2') format('woff2');
  font-weight: 400; font-display: swap;
}

/* --- さじ加減変数 (調整パネルが上書きする。ここが Phase 0 で確定する最終値になる) --- */
.theme-military {
  --milspec-tune-glow: 0.5;          /* 発光の強さ 0-1 (Dark で主に効く) */
  --milspec-tune-accent-hue: 0deg;   /* シアンの色相回転 */
  --milspec-tune-accent-sat: 1;      /* アクセント彩度倍率 */
  --milspec-tune-corner: 8px;        /* 切り欠き角のサイズ */
  --milspec-tune-scanline: 0.02;     /* 走査線の不透明度 (Dark のみ) */
  --milspec-tune-grid: 0.04;         /* 背景グリッド線の不透明度 */
  --milspec-tune-panel-line: 1px;    /* パネルラインの太さ (Light で主に効く) */
  --milspec-tune-decal: 0.9;         /* デカール/ステンシル小文字の不透明度 */
  --milspec-tune-hazard: 0.55;       /* ハザード斜線帯の不透明度 */

  /* --- 固有トークン --- */
  --milspec-font-display: 'Orbitron', 'Rajdhani', sans-serif;
  --milspec-font-mono: 'Share Tech Mono', ui-monospace, monospace;
  --milspec-border-w: 1px;
  --milspec-border-w-strong: 2px;

  /* 角を全体的に立てる */
  --radius-sm: 2px; --radius-md: 3px; --radius-lg: 4px; --radius-xl: 6px; --radius-2xl: 8px;

  font-family: var(--milspec-font-display), var(--milspec-font-ui, 'Rajdhani'), sans-serif;
}

/* --- Dark: 黒地・シアン発光 (意味トークン再定義・暫定値 spec §5) --- */
.theme-military.theme-dark {
  --color-bg-primary: #0a1015;
  --color-bg-secondary: #0a1015;
  --color-bg-tertiary: #0e1620;
  --color-accent-primary: #5fd4ff;
  --app-accent-rgb: 95, 212, 255;
  --color-accent-secondary: #5fd4ff;
  --color-accent-dim: rgba(95, 212, 255, 0.12);
  --color-text-primary: #d8e8f4;
  --color-text-secondary: #94afc6;
  --color-text-muted: #5d7a92;
  --color-text-on-accent: #06090c;
  --color-toggle-bg: #5fd4ff;
  --color-toggle-text: #06090c;
  --color-border: rgba(120, 180, 220, 0.12);
  --color-border-accent: rgba(120, 200, 240, 0.35);
  --color-blue: #5fd4ff; --color-blue-hover: #8fe2ff;
  --color-blue-dim: rgba(95,212,255,0.12); --color-blue-border: rgba(95,212,255,0.3);
  --color-amber: #ff8a3d; --color-amber-hover: #ffa561;
  --color-amber-dim: rgba(255,138,61,0.12); --color-amber-border: rgba(255,138,61,0.3);
  --color-red: #ff3b3b; --color-red-hover: #ff6161;
  --color-red-dim: rgba(255,59,59,0.12); --color-red-border: rgba(255,59,59,0.3);
  /* ガラス = 金属プレート化 (blur 0) */
  --glass-tier1-bg: linear-gradient(180deg, rgba(20,32,44,0.85), rgba(14,22,32,0.92));
  --glass-tier1-border: rgba(95,212,255,0.14);
  --glass-tier1-blur: 0px;
  --glass-tier2-bg: linear-gradient(180deg, rgba(26,39,51,0.95), rgba(18,28,40,0.98));
  --glass-tier2-border: rgba(95,212,255,0.22);
  --glass-tier2-blur: 0px;
  --glass-tier2-shadow: 0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04);
  --glass-tier3-bg: linear-gradient(180deg, rgba(30,45,60,0.98), rgba(20,30,42,1));
  --glass-tier3-border: rgba(95,212,255,0.3);
  --glass-tier3-blur: 0px;
  --glass-tier3-shadow: 0 12px 36px rgba(0,0,0,0.7), 0 0 0 1px rgba(95,212,255,0.05);
  --glass-tier3-inset: inset 0 1px 0 rgba(255,255,255,0.06);
  --glass-panel-border: rgba(95,212,255,0.2);
  --glass-panel-shadow: 0 0 12px rgba(95,212,255,0.08), 0 0 3px rgba(95,212,255,0.15);
  /* モバイル */
  --color-sheet-bg: #0e1620;
  --color-nav-bg: rgba(10,16,21,0.85);
  --color-nav-border: rgba(95,212,255,0.14);
  --color-fab-bg: rgba(95,212,255,0.12);
  --color-fab-border: rgba(95,212,255,0.35);
}

/* --- Light: 白基調・細いシアンライン (暫定値 spec §5) --- */
.theme-military.theme-light {
  --color-bg-primary: #e9eff5;
  --color-bg-secondary: #e9eff5;
  --color-bg-tertiary: #ffffff;
  --color-accent-primary: #0a8fd1;
  --app-accent-rgb: 10, 143, 209;
  --color-accent-secondary: #0a8fd1;
  --color-accent-dim: rgba(10, 143, 209, 0.10);
  --color-text-primary: #162533;
  --color-text-secondary: #3e556b;
  --color-text-muted: #6f8398;
  --color-text-on-accent: #ffffff;
  --color-toggle-bg: #0a8fd1;
  --color-toggle-text: #ffffff;
  --color-border: rgba(40, 80, 120, 0.18);
  --color-border-accent: rgba(30, 90, 140, 0.45);
  --color-blue: #0a8fd1; --color-blue-hover: #0876ad;
  --color-blue-dim: rgba(10,143,209,0.08); --color-blue-border: rgba(10,143,209,0.25);
  --color-amber: #e26a1a; --color-amber-hover: #c05713;
  --color-amber-dim: rgba(226,106,26,0.08); --color-amber-border: rgba(226,106,26,0.25);
  --color-red: #d92020; --color-red-hover: #b81a1a;
  --color-red-dim: rgba(217,32,32,0.08); --color-red-border: rgba(217,32,32,0.25);
  --glass-tier1-bg: linear-gradient(180deg, #ffffff, #f5f8fb);
  --glass-tier1-border: rgba(30,90,140,0.14);
  --glass-tier1-blur: 0px;
  --glass-tier2-bg: linear-gradient(180deg, #ffffff, #f0f5fa);
  --glass-tier2-border: rgba(30,90,140,0.18);
  --glass-tier2-blur: 0px;
  --glass-tier3-bg: #ffffff;
  --glass-tier3-border: rgba(30,90,140,0.22);
  --glass-tier3-blur: 0px;
  --glass-tier3-shadow: 0 12px 36px rgba(20,40,70,0.12);
  --glass-tier3-inset: inset 0 1px 0 rgba(255,255,255,0.6);
  --glass-panel-border: rgba(30,90,140,0.16);
  --glass-panel-shadow: 0 0 8px rgba(30,90,140,0.06), 0 0 2px rgba(30,90,140,0.12);
  --color-sheet-bg: #ffffff;
  --color-nav-bg: rgba(233,239,245,0.9);
  --color-nav-border: rgba(30,90,140,0.16);
  --color-fab-bg: rgba(255,255,255,0.95);
  --color-fab-border: rgba(30,90,140,0.2);
}

/* --- 全体背景: グリッド (dark/light 共通) --- */
.theme-military body {
  background-image:
    linear-gradient(rgba(var(--app-accent-rgb), var(--milspec-tune-grid)) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--app-accent-rgb), var(--milspec-tune-grid)) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* --- CRT 走査線 (Dark のみ) --- */
.theme-military.theme-dark body::before {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none; z-index: 9999;
  background: repeating-linear-gradient(
    0deg,
    rgba(var(--app-accent-rgb), var(--milspec-tune-scanline)) 0px,
    rgba(var(--app-accent-rgb), var(--milspec-tune-scanline)) 1px,
    transparent 1px, transparent 3px);
  mix-blend-mode: screen;
}
@media (prefers-reduced-motion: reduce) {
  .theme-military body::before { display: none; }
}
```

- [ ] **Step 2: `src/main.tsx` に import 追加**

```ts
import './index.css'
// ... (既存の import 群)
import './styles/military.css'
```
（`./styles/housing.css` の前後どちらでもよいが、`./index.css` より後に）

- [ ] **Step 3: フォント woff2 の暫定プレースホルダ**

Orbitron / Share Tech Mono の woff2 は Task 0.4 で用意する。このタスクでは `@font-face` の `src` パスだけ書いておく（ファイルが無い間は `font-display: swap` でフォールバック表示になるだけで壊れない）。

- [ ] **Step 4: ビルド確認**

Run: `npx vite build`
Expected: `military.css` がバンドルに含まれ、エラーなし（未配置フォントの 404 はビルドを止めない）

- [ ] **Step 5: ローカル実機確認（masaya）**

- `/miti` で `setThemeStyle('military')` → **色が軍事HUD配色に変わる**（背景が黒/白、アクセントがシアン、角が立つ、背景にうっすらグリッド、Dark は走査線）
- Light / Dark 両方を切り替えて確認
- `setThemeStyle('standard')` で完全に元に戻る（既存の見た目が1px も変わっていない）
- ボタン・削除確認ダイアログ・競合警告の色（青/赤/黄相当）が「意味は同じで色相だけ変わった」状態

- [ ] **Step 6: コミット**

```bash
git add src/styles/military.css src/main.tsx
git commit -m "feat(theme): military.css の骨格(意味トークン再定義+背景+さじ加減変数)"
```

---

### Task 0.4: フォントの自前ホスト

**Files:**
- Create: `public/fonts/orbitron-400.woff2` `orbitron-700.woff2` `orbitron-900.woff2` `share-tech-mono-400.woff2`
- （`military.css` の `@font-face` は Task 0.3 で記述済み）

- [ ] **Step 1: フォントファイルの取得**

Orbitron / Share Tech Mono は SIL Open Font License（再配布・自前ホスト可）。latin サブセットの woff2 を用意する。取得元の候補:
- `google-webfonts-helper`（gwfh.mranftl.com）で "Orbitron" weights 400/700/900 と "Share Tech Mono" 400 の latin サブセット woff2 をダウンロード
- または `npm i @fontsource/orbitron @fontsource/share-tech-mono` して `node_modules/@fontsource/*/files/*-latin-*.woff2` をコピー（依存に残さず files だけ取り出すなら devDependency として入れて後で外す）

ファイル名は `military.css` の `src` と一致させる: `orbitron-400.woff2` / `orbitron-700.woff2` / `orbitron-900.woff2` / `share-tech-mono-400.woff2`。

- [ ] **Step 2: 配置**

`public/fonts/` に4ファイルを置く。各 15〜40KB 程度のはず。合計 100KB 未満を確認（超えるならサブセットが latin になっていない）。

- [ ] **Step 3: ローカル確認（masaya）**

- `military` テーマで `/miti` を開き、DevTools Network で `military` 切替時に `orbitron-*.woff2` が読み込まれること（standard のときは読み込まれないこと）
- ロゴ／見出しが Orbitron に、タイムラインの数値が Share Tech Mono になっていること
- ライセンス表記: `public/fonts/OFL.txt` に両フォントの OFL 全文を置く（再配布時に必要）

- [ ] **Step 4: コミット**

```bash
git add public/fonts/
git commit -m "feat(theme): Orbitron / Share Tech Mono を自前ホスト(OFL)"
```

---

### Task 0.5: スタイル切替ボタン `MilspecStyleToggle`

**Files:**
- Create: `src/components/military/MilspecStyleToggle.tsx`
- Create: `src/components/military/__tests__/MilspecStyleToggle.test.tsx`
- Modify: `src/locales/{ja,en,zh,zh-Hant,ko}.json`
- Modify: `src/components/ConsolidatedHeader.tsx`（Sun/Moon ボタンの隣に配置）

**Interfaces:**
- Consumes: `useThemeStore` の `themeStyle` / `setThemeStyle`（Task 0.1）、`useTransitionOverlay` の `runTransition`
- Produces: `<MilspecStyleToggle compact?: boolean className?: string />`

- [ ] **Step 1: i18n キーを5言語追加**

`src/locales/ja.json` の適切なブロック（`app.toggle_theme_*` の近く）に:
```json
"theme_style_to_milspec": "MIL-SPEC テーマに切り替え",
"theme_style_to_standard": "標準テーマに戻す",
```
en:
```json
"theme_style_to_milspec": "Switch to MIL-SPEC theme",
"theme_style_to_standard": "Back to standard theme",
```
zh: `"切换到 MIL-SPEC 主题"` / `"返回标准主题"`
zh-Hant: `"切換到 MIL-SPEC 主題"` / `"返回標準主題"`
ko: `"MIL-SPEC 테마로 전환"` / `"표준 테마로 돌아가기"`

（キーのフルパスは既存の `app.*` に合わせる。実装時に `app.toggle_theme_light` のパスを Grep で確認して同じ階層に置く。）

- [ ] **Step 2: 失敗テストを書く** — `MilspecStyleToggle.test.tsx`

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MilspecStyleToggle } from '../MilspecStyleToggle';
import { useThemeStore } from '../../../store/useThemeStore';
import { TransitionOverlayProvider } from '../../ui/TransitionOverlay';

const renderToggle = () =>
  render(<TransitionOverlayProvider><MilspecStyleToggle /></TransitionOverlayProvider>);

describe('MilspecStyleToggle', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    useThemeStore.setState({ theme: 'dark', themeStyle: 'standard' });
  });

  it('クリックで standard → military に切り替わる', () => {
    renderToggle();
    fireEvent.click(screen.getByRole('button'));
    expect(useThemeStore.getState().themeStyle).toBe('military');
  });

  it('military のときもう一度クリックで standard に戻る', () => {
    useThemeStore.setState({ themeStyle: 'military' });
    renderToggle();
    fireEvent.click(screen.getByRole('button'));
    expect(useThemeStore.getState().themeStyle).toBe('standard');
  });

  it('aria-pressed が themeStyle を反映する', () => {
    useThemeStore.setState({ themeStyle: 'military' });
    renderToggle();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
```

（`TransitionOverlayProvider` の実際の export 名は `src/components/ui/TransitionOverlay.tsx` を Read で確認。Provider が別名なら合わせる。）

- [ ] **Step 3: テスト実行 → 失敗確認**

Run: `npx vitest run src/components/military/__tests__/MilspecStyleToggle.test.tsx`
Expected: FAIL（コンポーネント未作成）

- [ ] **Step 4: 実装** — `MilspecStyleToggle.tsx`

```tsx
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useThemeStore } from '../../store/useThemeStore';
import { useTransitionOverlay } from '../ui/TransitionOverlay';

interface Props {
  /** モバイルヘッダー等・小さめ表示 */
  compact?: boolean;
  className?: string;
}

/** テーマの「スタイル軸」を standard ⇄ military で切り替える専用ボタン。
 *  明るさ軸(Sun/Moon)とは独立。ヘッダー / モバイルヘッダー / FAB から使う。 */
export const MilspecStyleToggle: React.FC<Props> = ({ compact = false, className }) => {
  const { t } = useTranslation();
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const setThemeStyle = useThemeStore((s) => s.setThemeStyle);
  const { runTransition } = useTransitionOverlay();
  const isMil = themeStyle === 'military';
  const size = compact ? 14 : 16;

  return (
    <button
      type="button"
      aria-pressed={isMil}
      aria-label={isMil ? t('app.theme_style_to_standard') : t('app.theme_style_to_milspec')}
      title={isMil ? t('app.theme_style_to_standard') : t('app.theme_style_to_milspec')}
      onClick={() => runTransition(() => setThemeStyle(isMil ? 'standard' : 'military'), 'theme')}
      className={clsx(
        'group flex items-center justify-center transition-colors cursor-pointer',
        className,
      )}
    >
      {/* 六角ボルト + ブラケットの簡易アイコン。military のときはアクティブ色。 */}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           className={clsx(isMil ? 'text-app-accent' : 'text-app-text-muted group-hover:text-app-text')}>
        <path d="M3 3h4M3 3v4M21 3h-4M21 3v4M3 21h4M3 21v-4M21 21h-4M21 21v-4" />
        <path d="M12 8.5l3 1.75v3.5L12 15.5l-3-1.75v-3.5z" />
      </svg>
    </button>
  );
};
```

（`text-app-accent` などのユーティリティが存在するか実装時に確認。無ければ `text-[var(--color-app-accent)]`。）

- [ ] **Step 5: テスト実行 → green 確認**

Run: `npx vitest run src/components/military/__tests__/MilspecStyleToggle.test.tsx`
Expected: PASS（3 ケース）

- [ ] **Step 6: ConsolidatedHeader に配置**

`src/components/ConsolidatedHeader.tsx` の Sun/Moon の `<Tooltip>...</Tooltip>` ブロック（現 294-306 行あたり）の**直後**に:

```tsx
                            <MilspecStyleToggle className={clsx(iconBtnBase, iconBtnDefault)} />
```

import 追加: `import { MilspecStyleToggle } from './military/MilspecStyleToggle';`

- [ ] **Step 7: 回帰テスト**

Run: `npx vitest run src/components/__tests__/ConsolidatedHeader.viewer.test.tsx src/components/military/__tests__/`
Expected: PASS

- [ ] **Step 8: tsc + ローカル確認（masaya）**

- `npx tsc -b` → exit 0
- `/miti` の PC ヘッダーに Sun/Moon の隣に新ボタン → クリックで MIL-SPEC ⇄ 標準が切り替わる（遷移演出つき）

- [ ] **Step 9: コミット**

```bash
git add src/components/military/ src/components/ConsolidatedHeader.tsx src/locales/
git commit -m "feat(theme): MIL-SPEC スタイル切替ボタン + ヘッダー配置 + i18n5言語"
```

---

### Task 0.6: 調整パネル `MilspecTunePanel`（開発専用）

**Files:**
- Create: `src/components/dev/MilspecTunePanel.tsx`
- Modify: `src/components/Layout.tsx`（ルート付近に条件マウント）

**Interfaces:**
- Consumes: `useThemeStore.themeStyle`
- Produces: なし（開発専用・Phase 3 で撤去）

- [ ] **Step 1: 実装** — `MilspecTunePanel.tsx`

```tsx
import { useEffect, useState } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

/** 調整対象の --milspec-tune-* 変数。military.css の初期値と一致させる。 */
const TUNABLES: { key: string; label: string; min: number; max: number; step: number; unit?: string }[] = [
  { key: '--milspec-tune-glow', label: '発光の強さ', min: 0, max: 1, step: 0.01 },
  { key: '--milspec-tune-accent-hue', label: 'シアン色相回転', min: -60, max: 60, step: 1, unit: 'deg' },
  { key: '--milspec-tune-accent-sat', label: 'アクセント彩度', min: 0.5, max: 1.5, step: 0.01 },
  { key: '--milspec-tune-corner', label: '切り欠き角サイズ', min: 0, max: 16, step: 1, unit: 'px' },
  { key: '--milspec-tune-scanline', label: '走査線 不透明度', min: 0, max: 0.06, step: 0.002 },
  { key: '--milspec-tune-grid', label: '背景グリッド 不透明度', min: 0, max: 0.12, step: 0.005 },
  { key: '--milspec-tune-panel-line', label: 'パネルライン太さ', min: 0, max: 3, step: 0.5, unit: 'px' },
  { key: '--milspec-tune-decal', label: 'デカール 不透明度', min: 0, max: 1, step: 0.02 },
  { key: '--milspec-tune-hazard', label: 'ハザード帯 不透明度', min: 0, max: 1, step: 0.02 },
];

/** 開発専用。?tune クエリ or localStorage 'milspec-tune'==='1' かつ DEV かつ military のときだけ出る。
 *  --milspec-tune-* を実機でドラッグ調整するためのパネル。Phase 3 で撤去。 */
export const MilspecTunePanel: React.FC = () => {
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const [open, setOpen] = useState(true);
  const [vals, setVals] = useState<Record<string, number>>({});

  const enabled =
    import.meta.env.DEV &&
    themeStyle === 'military' &&
    (new URLSearchParams(location.search).has('tune') ||
      localStorage.getItem('milspec-tune') === '1');

  useEffect(() => {
    if (!enabled) return;
    const cs = getComputedStyle(document.documentElement);
    const init: Record<string, number> = {};
    for (const t of TUNABLES) init[t.key] = parseFloat(cs.getPropertyValue(t.key)) || 0;
    setVals(init);
  }, [enabled]);

  if (!enabled) return null;

  const set = (key: string, v: number, unit?: string) => {
    setVals((p) => ({ ...p, [key]: v }));
    document.documentElement.style.setProperty(key, unit ? `${v}${unit}` : String(v));
  };

  const copyCss = () => {
    const body = TUNABLES.map((t) => `  ${t.key}: ${vals[t.key]}${t.unit ?? ''};`).join('\n');
    navigator.clipboard.writeText(`.theme-military {\n${body}\n}`);
  };

  return (
    <div style={{
      position: 'fixed', right: 8, bottom: 8, zIndex: 100000,
      background: 'rgba(10,16,21,0.95)', color: '#d8e8f4', border: '1px solid #5fd4ff',
      font: '11px ui-monospace, monospace', padding: open ? 10 : 4, maxWidth: 260,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
           onClick={() => setOpen((o) => !o)}>
        <strong>MIL-SPEC TUNE</strong><span>{open ? '−' : '+'}</span>
      </div>
      {open && (
        <>
          {TUNABLES.map((t) => (
            <label key={t.key} style={{ display: 'block', marginTop: 6 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.label}</span><span>{vals[t.key]}{t.unit ?? ''}</span>
              </span>
              <input type="range" min={t.min} max={t.max} step={t.step}
                     value={vals[t.key] ?? 0}
                     onChange={(e) => set(t.key, parseFloat(e.target.value), t.unit)}
                     style={{ width: '100%' }} />
            </label>
          ))}
          <button onClick={copyCss} style={{ marginTop: 8, width: '100%' }}>CSS をコピー</button>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Layout.tsx にマウント**

`src/components/Layout.tsx` の `return (` の直後、`<div data-app-shell ...>` の中の末尾付近（他のグローバルマウント群の近く）に:

```tsx
      <MilspecTunePanel />
```

import 追加（ファイル冒頭の import 群に。lazy でなくてよい — `enabled` が false のとき即 `null` を返すので）:

```tsx
import { MilspecTunePanel } from './dev/MilspecTunePanel';
```

- [ ] **Step 3: tsc + ビルド**

Run: `npx tsc -b && npx vite build`
Expected: exit 0。`import.meta.env.DEV` により本番バンドルでは `enabled` が常に false になる（tree-shake されなくても実害なし・軽量）。

- [ ] **Step 4: ローカル確認（masaya）**

- `npm run dev` → `/miti?tune` を開き `setThemeStyle('military')` → 右下に調整パネル
- スライダーを動かすと即座に見た目が変わる（発光・角・走査線 等）
- standard に切り替えるとパネルが消える
- 本番ビルド（`npm run build && npm run preview`）ではパネルが出ないこと

- [ ] **Step 5: コミット**

```bash
git add src/components/dev/MilspecTunePanel.tsx src/components/Layout.tsx
git commit -m "feat(theme): MIL-SPEC 調整パネル(開発専用・?tune)"
```

---

### Task 0.7: Phase 0 承認ゲート — 見た目の方向性を詰めて確定値を焼き込む

**これはコードタスクではなく、masaya との調整セッション。**

- [ ] **Step 1: masaya がローカルで詰める**

`npm run dev` → `/miti?tune` → Dark / Light 両方で:
- 発光の強さ、シアンの色相、切り欠き角、走査線、グリッド、パネルライン、デカール不透明度、ハザード帯を納得いくまで調整
- 参考画像（`docs/.private/theme-refs/allagan-{light,dark}.png`）と見比べる
- 本文テキストのコントラストが十分か（発光で読みにくくなっていないか）

- [ ] **Step 2: 確定値を CSS へ焼き込む**

調整パネルの「CSS をコピー」で得た `.theme-military { --milspec-tune-*: ...; }` ブロックを、`src/styles/military.css` の暫定値と差し替え。「暫定」コメントを「Phase 0 で確定（2026-XX-XX）」に更新。

- [ ] **Step 3: パレット微調整があれば反映**

Dark/Light の意味トークン（`#5fd4ff` 等）に変更要望があれば `military.css` の該当ブロックを更新。

- [ ] **Step 4: masaya の最終承認**

「この方向で Phase 1（画面別リスキン）に進んでよい」の明示的 OK をもらう。

- [ ] **Step 5: コミット**

```bash
git add src/styles/military.css
git commit -m "feat(theme): Phase 0 調整 — MIL-SPEC のさじ加減を実機で確定"
```

---

## Phase 1 — 画面別リスキン

> **着手時に必ず:** 対象コンポーネントのファイルを Read し、実際の class 名・DOM 構造・既存の `.theme-light` 上書きの有無を確認してからスタイルを書く（`ConsolidatedHeader` 等は Tailwind ユーティリティ直書きで `.miti-header` のような固定クラスが無い。装飾を足すには `data-*` 属性やラッパ class を足すか、既存の構造クラスに乗せる）。各タスクは着手時にこのプランの subagent 指示へ bite-sized 化する。

各タスク共通の Definition of done: **standard では 1px も変わらない** ことを確認 + masaya が military（Dark/Light 両方）で該当画面を実機確認。

### Task 1.1: ヘッダー（`ConsolidatedHeader` / `MobileHeader`）
- **Files:** `src/styles/military.css`（追記）/ 必要なら `ConsolidatedHeader.tsx` `MobileHeader.tsx` にラッパ class か `data-milspec` 属性を足す
- **内容:** 装甲板グラデ背景 + 下端赤ハザード帯 + LoPo ロゴを Orbitron ステンシル化（"COMBAT ANALYSIS SYSTEM" サブ + `Ver. 2.0.0` バッジ）+ タイトルを角切りプレート化 + EDIT MODE / SHARE MODE バッジを `.milspec-badge` + HUD ボタン風のアイコンボタン。
- **DoD チェックリスト（masaya）:** ヘッダーが軍事端末っぽい / ロゴが Orbitron / EDIT MODE バッジが角切り / Dark は発光 Light は白プレート / スマホヘッダーも同系統 / standard 不変。

### Task 1.2: ツールバー（PARTY / STATUS / MITIGATION … タブ行）
- **Files:** `military.css` 追記
- **内容:** 角ばったコンソールスイッチ風（`clip-path` で片側斜め）。アクティブタブをシアン発光 + 上辺2px。アイコン+英語+日本語サブの3段構造は既存のまま。
- **DoD:** タブが物理スイッチっぽい / アクティブが光る / ラベルの改行が崩れない / standard 不変。

### Task 1.3: サイドバー（`Sidebar`）
- **Files:** `military.css` 追記
- **内容:** SCENARIO パネル風の見出し（`.milspec-stencil` + 菱形マーカー + `.milspec-font-mono` のサブコード）。プラン項目の選択表現をシアン + 左2px。下部 BACKUP/RESTORE をドックボタン化。「DEPLOYMENT 展開を支援する」相当のサポートリンクをデカール化。**新規の縦アイコンレールは作らない。**
- **DoD:** サイドバーが作戦ボードっぽい / 選択中プランが光る / 下部ボタンがドック風 / standard 不変。

### Task 1.4: タイムライン表（`Timeline*` / `TimelineRow` / `MobileTimelineRow`）
- **Files:** `military.css` 追記
- **内容:** スコープ風の背景グリッド（`.miti-table` 相当のコンテナに）/ ヘッダー行を装甲板 + シアン下線 + Orbitron ラベル / 時刻セルをシアン + `.milspec-font-mono` / RAW ダメージを mono / 軽減後ダメージを緑グロー / 致命セルを赤枠 + 背景 / 行 hover を `inset 2px 0 シアン`。
- **DoD:** 表が戦術スコープっぽい / 数値が等幅で読みやすい / 緑/赤の意味が保たれている / スマホの行も同系統 / standard 不変。

### Task 1.5: AA / スキルの縦線（効果時間を示すエフェクト・タイムライン軸）
- **Files:** `military.css` 追記
- **内容:** AA 縦線を `.milspec-scanline-bar`（強発光オレンジ、上端に三角キャップ）/ スキルの効果時間エフェクトを発光バー化（色は種別で。`@property --mobile-effect-bar-progress` は不変・色と box-shadow だけ差し替え）/ タイムライン時間軸を `border` シアン + 目盛り + mono の tick ラベル。
- **DoD:** 縦線が発光している / 効果時間エフェクトが HUD っぽい / スクロールが重くなっていない（[[reference_perf_content_visibility]] 系）/ standard 不変。

### Task 1.6: カード（プラン一覧カード / OGP プレビュー / `SharePlanCard`）
- **Files:** `military.css` 追記
- **内容:** 角切り + `.milspec-rivets` + `.milspec-stencil` のラベル + シアンの薄縁。
- **DoD:** カードが装甲パネルっぽい / チェック選択（青）の意味が保たれる / standard 不変。

### Task 1.7: モーダル（`EventModal` / `PartySettingsModal` / `ShareModal` ほかエディタ配下）
- **Files:** `military.css` 追記
- **内容:** `--glass-tier3-*` 再定義で土台は金属プレート化済みなので、追加で角を立てる + 見出しを Orbitron + 四隅ブラケット。[reference_modal_light_mode_white_bg] の `glass-tier3-bg` 必須ルールは維持（Light で白くなること）。
- **DoD:** モーダルが端末ダイアログっぽい / Light で白い / スクロール可能な中身が枠内で収まる / standard 不変。

---

## Phase 2 — 新規装飾クローム

> masaya 方針「最小構成 → 実機で余白を見て足す」。各タスクは「まず出す → masaya と一緒に密度を調整」。

### Task 2.1: フッター HUD（開閉式・PC のみ）
- **Files:** Create `src/components/military/MilspecFooterHUD.tsx` / Create `MilspecFooterHUD.test.tsx` / Modify `src/components/AppFooter.tsx` / `military.css` 追記
- **Interfaces:** `<MilspecFooterHUD />` — `military` かつ `window.innerWidth >= 768` のときだけ中身を描画。開閉状態は `localStorage['milspec-hud-open']`。
- **ロジックテスト（TDD）:**
  - `themeStyle !== 'military'` → `null`
  - モバイル幅 → `null`（`useIsMobile` 相当 or matchMedia）
  - 開閉トグルで `localStorage` が更新される
  - 閉時はステータス1行のみ、開時は4カラム（LEGEND / DECAL CODE / 紋章 / SYSTEM STATUS）
- **AppFooter 変更:** `themeStyle === 'military'` のとき既存の `<p>` の代わりに `<MilspecFooterHUD />` を出す（standard は既存のまま）。`h-6` → HUD 開時は auto、閉時は `h-6` 相当。
- **DoD:** PC で開閉できる / 閉じると細い1行 / enemy LEGEND がタイムラインのアイコンと対応 / SYSTEM STATUS の ● が脈動（reduced-motion で停止）/ スマホでは一切出ない / standard 不変。

### Task 2.2: アラガン紋章 SVG + バーコード SVG
- **Files:** Create `src/components/military/svg/MilspecCrest.tsx` `MilspecBarcode.tsx`
- **内容:** 元設計書 §8.1 / §8.2 の SVG を土台に。`currentColor` + `viewBox`。バーコードは `AR-<YYMMDD>`（`new Date()` から組み立て）。
- **DoD:** フッター HUD 中央に紋章 / バーコード下に `AR-<今日の日付>` / 発光ドロップシャドウ。

### Task 2.3: 装飾スパイン（PC のみ・非操作）
- **Files:** `military.css` 追記 + 必要なら `Layout.tsx` に薄い装飾 `<div>`（`aria-hidden`）
- **内容:** 画面端とサイドバーの隙間に縦組みステンシル（"A.R.D // COMBAT ANALYSIS SYSTEM"）+ 目盛り + パネル番号。`writing-mode: vertical-rl` or 回転。完全に飾り（`pointer-events: none`）。1280px 以下で隙間が無ければ `display: none`。
- **DoD:** PC 広幅で左端に縦の飾り / 押せない / 1280px 以下で消える / スマホで出ない / レイアウトが動かない（既存コンテンツの位置不変）。

### Task 2.4: 小デカール（意味のない部品番号・ステンシル小文字）
- **Files:** `military.css` 追記（`::after` 中心）+ 必要な箇所に `<span aria-hidden className="milspec-stencil milspec-stencil--faded">`
- **内容:** ヘッダー隅・サイドバー下・フッター・タイムライン余白に "PX-042" "MTG-81A" 等。§12 の文言ガイドライン厳守（偽の著作権・所有権テキストを置かない）。
- **DoD:** 余白に小さいコードが散る / 情報の邪魔をしない / レイアウト不変 / standard で一切出ない。

---

## Phase 3 — 仕上げ

### Task 3.1: モバイル切替導線（MobileHeader / MobileFAB）
- **Files:** Modify `src/components/MobileHeader.tsx` / `src/components/MobileFab.tsx`（casing `MobileFab` 厳守 [[feedback_mobilefab_casing_exact]]）
- **内容:** MobileHeader のテーマトグル隣に `<MilspecStyleToggle compact />`。FAB メニューに「MIL-SPEC」項目（既存のテーマ切替項目の作りに合わせる）。
- **DoD:** スマホでも標準 ⇄ MIL-SPEC が切り替えられる（ヘッダーと FAB の両方）/ standard 不変。

### Task 3.2: Ko-fi 導線
- **Files:** `military.css` 追記 or 小コンポーネント / `src/locales/*.json`
- **内容:** MIL-SPEC 選択時、スタイル切替ボタン付近 or フッター HUD 内に控えめな一行「このテーマが気に入ったら ☕ Ko-fi」。i18n キー `app.theme_style_milspec_support` を5言語。煽り表現なし。既存の Ko-fi リンク URL を Grep で確認して流用。
- **DoD:** military のときだけ出る / 事実ベースの一行 / リンクが正しい / standard で出ない。

### Task 3.3: レスポンシブ総点検（1489 / 1920 / 2560 / スマホ）
- **Files:** `military.css` 調整
- **内容:** 各幅で切り欠き角・ステンシル・フッター HUD・スパインが破綻しないか。`clamp()` の見直し。スクロールバー17px 控除。
- **DoD（masaya、Playwright 補助可）:** 4ケースで軍事HUDが成立、横スクロール発生なし、standard 不変。

### Task 3.4: アクセシビリティ + reduced-motion 総点検
- **内容:** 走査線・グロー脈動が `prefers-reduced-motion: reduce` で止まる / スタイル切替ボタンの aria / text-scale 設定で割れない / コントラスト比（Dark/Light の本文）。
- **DoD:** OS の視差効果カットで走査線・脈動が消える / アプリ内 text size 変更で崩れない。

### Task 3.5: 調整パネル撤去
- **Files:** Delete `src/components/dev/MilspecTunePanel.tsx` / Modify `src/components/Layout.tsx`（マウント + import 削除）
- **前提:** Phase 0 の確定値が `military.css` に焼き込み済み。
- [ ] Step 1: `military.css` の `--milspec-tune-*` が「確定値」コメントになっていることを確認
- [ ] Step 2: `MilspecTunePanel.tsx` を削除、`Layout.tsx` から `<MilspecTunePanel />` と import を削除
- [ ] Step 3: `npx tsc -b && npx vite build` → exit 0
- [ ] Step 4: `grep -rn "MilspecTunePanel\|milspec-tune" src/` → CSS の変数定義（`--milspec-tune-*` を各装飾ルールが参照している）だけが残り、パネル参照は 0
- [ ] Step 5: コミット `chore(theme): MIL-SPEC 調整パネルを撤去(確定値は焼き込み済み)`

### Task 3.6: whole-branch 敵対レビュー + マージ
- **内容:** fresh context のサブエージェントで `requesting-code-review`。採用は「正しさに関わる指摘」のみ（過剰防御は入れない）。standard 回帰・スコープ外への波及（admin/LP/housing/MitigationSheet が変わっていないか）を重点確認。
- **DoD:** レビュー指摘対応済み / `npm run build` + 対象 vitest green / masaya 最終実機確認（Dark/Light・PC/スマホ）→ main へ。

---

## Self-Review

**1. Spec coverage:**

| spec セクション | 対応タスク |
|---|---|
| §1 スコープ | Global Constraints + 各タスクの Files が `/miti` 配下限定 |
| §2 2軸化（store / 3箇所のクラス付与 / 重ねる方針） | 0.1, 0.2 |
| §3 トークン契約（意味トークン再定義） | 0.3 |
| §3.3 スプシ互換 | 0.3 Step 1（`--milspec-*` 名前空間）+ Global Constraints |
| §4 さじ加減変数 + 調整パネル | 0.3, 0.6, 0.7, 3.5 |
| §5 パレット | 0.3（初期値）, 0.7（確定） |
| §6 フォント | 0.3（@font-face）, 0.4（自前ホスト） |
| §7 装飾プリミティブ | 0.3（背景・走査線）, Phase 1 各タスク（`.milspec-*` を使う） |
| §8 画面別リスキン | 1.1〜1.7 |
| §9 新規クローム（PC/モバイル出し分け） | 2.1〜2.4 |
| §10 切替 UI（配置4箇所） | 0.5（ConsolidatedHeader）, 3.1（MobileHeader/FAB）, 3.4/task 記載（フォーカスレールは任意） |
| §11 寄付導線 | 3.2 |
| §12 デカール文言ガイドライン | 2.4 の DoD + Global Constraints |
| §13 レスポンシブ | 3.3 |
| §14 アクセシビリティ | 0.3（reduced-motion）, 3.4 |
| §15 ファイル構成 | File Structure 節と一致 |
| §16 実装フェーズ | Phase 0〜3 の構造と一致 |
| §17 テスト方針 | テスト規約節 + 各タスクの Step |
| §18 スコープ外 | Global Constraints + Self-review の波及確認（3.6） |
| §19 未確定 | 0.7 で確定 |

ギャップ: フォーカスモード右レールへのスタイル切替は「任意」のまま（spec §10 でも任意）。実装者が Task 3.1 の中で判断する旨を明記済み。

**2. Placeholder scan:** Phase 0 は具体コード入り。Phase 1〜3 は「着手時に bite-sized 化」と明示した構造タスク（純粋な CSS 見た目タスクで、対象の実 DOM を先に読む必要があるため意図的にこの粒度）。DoD は各タスクに具体チェックリストあり。"適切なエラー処理" 等の曖昧表現なし。

**3. Type consistency:**
- `ThemeStyle` / `themeStyle` / `setThemeStyle` / `applyThemeClasses` — 0.1 で定義、0.2 / 0.5 / 0.6 で同名参照。一致。
- `<MilspecStyleToggle compact? className? />` — 0.5 で定義、3.1 で `compact` 使用。一致。
- `--milspec-tune-*` の9変数 — 0.3 の CSS 初期値、0.6 の `TUNABLES` 配列、0.7 の焼き込み、3.5 の grep で同じキー集合。一致。
- `MilspecFooterHUD` — 2.1 で定義、2.2（紋章を中に置く）で参照。一致。

---

## Execution Handoff

（このセクションはプラン確定後に案内する）
