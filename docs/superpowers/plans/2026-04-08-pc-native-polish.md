# PC版ネイティブポリッシュ実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC版UIの色・モーション・レイアウトをネイティブアプリ品質に引き上げる。テーブル構造・軽減ロジックは不変。

**Architecture:** CSS変数の値変更（Phase 1）→ CSS `linear()` springカーブ追加＋transition適用（Phase 2）→ glass-panel除去・レイアウト調整（Phase 3）の段階的改善。各Phase後にビルド確認・デプロイ可能。

**Tech Stack:** CSS変数, CSS `linear()`, Tailwind CSS 4, framer-motion（既存箇所のみ）

**設計書:** `docs/superpowers/specs/2026-04-08-pc-native-polish-design.md`

---

## Phase 1: 色・質感

### Task 1: ダークテーマの色変更

**Files:**
- Modify: `src/index.css:117-131` (`:root, .theme-dark` セクション)

- [ ] **Step 1: ダークテーマのCSS変数を変更**

`src/index.css` の `:root, .theme-dark` セクション内で以下を変更:

```css
/* 行117-118: 背景色 */
--color-bg-primary: #0F0F10;
--color-bg-secondary: #0F0F10;

/* 行119: 三次背景 */
--color-bg-tertiary: #161618;

/* 行126: テキスト */
--color-text-primary: #F0F0F0;

/* 行131: ボーダー */
--color-border: rgba(255, 255, 255, 0.10);
```

- [ ] **Step 2: ダークのglass-panel変数を調整**

同ファイルの行176-178:

```css
--glass-panel-border: rgba(255, 255, 255, 0.12);
--glass-panel-inset: none;
--glass-panel-shadow: 0 0 12px rgba(255, 255, 255, 0.08), 0 0 3px rgba(255, 255, 255, 0.15);
```

- [ ] **Step 3: ダークのglass tier変数を調整**

行150-163:

```css
/* tier3 */
--glass-tier3-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);

/* tier1 */
--glass-tier1-bg: rgba(255, 255, 255, 0.03);
```

他のtier変数はそのまま。

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit && npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/index.css
git commit -m "style: ダークテーマの色調整（Linear風#0F0F10、ボーダー薄く）"
```

---

### Task 2: ライトテーマの色変更

**Files:**
- Modify: `src/index.css:208-277` (`.theme-light` セクション)

- [ ] **Step 1: ライトテーマのCSS変数を変更**

`.theme-light` セクション内で以下を変更:

```css
/* 行208-210: 背景色 */
--color-bg-primary: #FAFAFA;
--color-bg-secondary: #FAFAFA;
--color-bg-tertiary: #ffffff;

/* 行217: テキスト */
--color-text-primary: #171717;

/* 行222: ボーダー — 最大の印象変化 */
--color-border: rgba(0, 0, 0, 0.10);
```

- [ ] **Step 2: ライトのglass-panel変数を調整**

行275-277:

```css
--glass-panel-border: rgba(0, 0, 0, 0.08);
--glass-panel-inset: none;
--glass-panel-shadow: 0 0 8px rgba(0, 0, 0, 0.06), 0 0 2px rgba(0, 0, 0, 0.1);
```

- [ ] **Step 3: ライトのglass tier変数を調整**

行249-262:

```css
/* tier3 */
--glass-tier3-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);

/* tier2 border — 既にrgba(0,0,0,0.06)なのでそのまま */

/* tier1 border — 既にrgba(0,0,0,0.05)なのでそのまま */
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit && npm run build`
Expected: 成功

- [ ] **Step 5: テスト実行**

Run: `npm test -- --run`
Expected: 116テスト全パス

- [ ] **Step 6: コミット**

```bash
git add src/index.css
git commit -m "style: ライトテーマの色調整（#FAFAFA、ボーダーrgba(0,0,0,0.10)）"
```

---

## Phase 2: モーション

### Task 3: CSS spring変数の新設

**Files:**
- Modify: `src/index.css` — `:root` セクションに追記

- [ ] **Step 1: spring easing変数をCSS変数に追加**

`:root, .theme-dark` セクション内（行131の後あたり）に追加:

```css
/* ── spring easing（CSS linear()） ── */
--ease-spring: linear(
  0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%,
  0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%,
  1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%,
  1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%,
  0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1
);
--ease-spring-gentle: linear(
  0, 0.007, 0.029 2.2%, 0.118, 0.24 7.1%, 0.621 13.8%,
  0.818 17.7%, 0.904, 0.967, 1.01, 1.037 25.4%,
  1.051, 1.058, 1.06, 1.056 31.2%, 1.042 34%,
  0.997 42%, 0.977 47.1%, 0.972 51.3%, 0.973 55.5%,
  0.993 71.7%, 1.001 78.9%, 1
);

/* ── duration ── */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-modal: 300ms;

/* ── scale ── */
--scale-press: 0.96;
--scale-hover: 1.04;
```

- [ ] **Step 2: prefers-reduced-motion を追加**

ファイル末尾（`@layer components` ブロックの後あたり）に追加:

```css
@media (prefers-reduced-motion: reduce) {
  :root, .theme-dark, .theme-light {
    --ease-spring: ease;
    --ease-spring-gentle: ease;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-modal: 0ms;
  }
}
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit && npm run build`
Expected: 成功（CSS変数の追加のみ、使用箇所はまだなし）

- [ ] **Step 4: コミット**

```bash
git add src/index.css
git commit -m "style: CSS spring easing変数を新設（linear()、reduced-motion対応）"
```

---

### Task 4: btn-tactileのspring化

**Files:**
- Modify: `src/index.css:858-865` (`@layer components` 内 `btn-tactile`)

- [ ] **Step 1: btn-tactileにspring transitionを追加**

行858-865を以下に置換:

```css
@layer components {
  /* ボタンのタクタイルフィードバック — spring */
  .btn-tactile {
    transition: transform var(--duration-fast) var(--ease-spring),
                color 150ms ease,
                background-color 150ms ease,
                border-color 150ms ease,
                opacity 150ms ease;
  }
  .btn-tactile:active {
    transform: scale(var(--scale-press));
  }
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: コミット**

```bash
git add src/index.css
git commit -m "style: btn-tactileをspring化（active:scale→CSS spring transition）"
```

---

### Task 5: モーダル・ポップオーバーのspring化

**Files:**
- Modify: `src/components/Toast.tsx:53`
- Modify: `src/components/ui/Tooltip.tsx:135-140`
- Modify: `src/index.css` — toastInキーフレーム

- [ ] **Step 1: Toast出現アニメーションのeasing変更**

`src/components/Toast.tsx` 行53の `cubic-bezier(0.2,0.8,0.2,1)` を変更。
Toastはキーフレームアニメーション（`animate-[toastIn_...]`）を使用しているので、
index.css内の `@keyframes toastIn` にspring easingを適用する。

ただしTailwindのarbitrary animation値内では `linear()` が使えないため、
index.cssにカスタムアニメーションクラスを追加:

```css
/* Toast springアニメーション */
.animate-toast-in {
  animation: toastIn var(--duration-modal) var(--ease-spring) forwards;
}
```

Toast.tsx 行53を以下に変更:

```tsx
"animate-toast-in",
```

- [ ] **Step 2: Tooltipのspring化**

`src/components/ui/Tooltip.tsx` 行138の `transition` を変更:

```tsx
transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
```

これはframer-motionのease配列で、springの跳ね感を近似。

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit && npm run build`
Expected: 成功

- [ ] **Step 4: テスト実行**

Run: `npm test -- --run`
Expected: 116テスト全パス

- [ ] **Step 5: コミット**

```bash
git add src/index.css src/components/Toast.tsx src/components/ui/Tooltip.tsx
git commit -m "style: Toast・Tooltipにspring easing適用"
```

---

### Task 6: ヘッダー・サイドバーのspring統一

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx:136`
- Modify: `src/components/Sidebar.tsx:1138,1145`

- [ ] **Step 1: ConsolidatedHeaderのspring値をSPRING.defaultに統一**

`src/components/ConsolidatedHeader.tsx` 行136:

現在:
```tsx
transition={{ type: "spring", stiffness: 300, damping: 30 }}
```

変更後:
```tsx
transition={{ type: "spring", stiffness: 400, damping: 28 }}
```

- [ ] **Step 2: Sidebarのspring値を統一**

`src/components/Sidebar.tsx` 行1138と1145:

現在:
```tsx
transition={fullWidth ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
```

変更後:
```tsx
transition={fullWidth ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 28 }}
```

両方の箇所（1138, 1145）で同じ変更。

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit && npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/ConsolidatedHeader.tsx src/components/Sidebar.tsx
git commit -m "style: ヘッダー・サイドバーのspring値をSPRING.default(400/28)に統一"
```

---

### Task 7: TimelineRow右ボタンの浮き上がりアニメーション

**Files:**
- Modify: `src/components/TimelineRow.tsx:226,263,298`

- [ ] **Step 1: group-hover箇所にtranslateY + transitionを追加**

行226のクラスを変更:

現在:
```tsx
"hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
```

変更後:
```tsx
"hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150"
```

行263, 298も同様のパターンで `translate-y-0.5 group-hover:translate-y-0 transition-all duration-150` を追加。
（各行の既存クラスに応じて調整。`transition-opacity` → `transition-all duration-150` に変更。）

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: コミット**

```bash
git add src/components/TimelineRow.tsx
git commit -m "style: TimelineRow右ボタンに浮き上がりアニメーション追加"
```

---

## Phase 3: レイアウト微調整

### Task 8: glass-panelの画面いっぱい化

**Files:**
- Modify: `src/index.css:176-178,275-277,809-815` (glass-panel変数＋クラス)
- Modify: `src/components/Timeline.tsx:1596`

- [ ] **Step 1: glass-panelのborder-radiusとborderを緩和**

`src/index.css` 行809-815を変更:

```css
/* glass-panel — タイムライン枠 */
.glass-panel {
  position: relative;
}
```

border と box-shadow の `!important` 指定を除去。テーブルが画面いっぱいに広がるように。

- [ ] **Step 2: Timeline.tsxのglass-panel周辺のpadding/border-radius調整**

`src/components/Timeline.tsx` 行1596のクラスを確認し、
`glass-panel` に依存していた角丸やパディングがあれば除去。

現在:
```tsx
"relative flex-1 flex flex-col pt-0 glass-panel overflow-hidden transition-all duration-300 ease-out"
```

`glass-panel` はそのまま残すが、CSS側でborder/shadowを除去済みなので見た目が変わる。
もし角丸 `rounded-*` が付いている場合は除去。

- [ ] **Step 3: ビルド確認 + 目視確認**

Run: `npm run build`
Expected: 成功。テーブルがサイドバー右端〜画面右端まで占有し、ヘッダー下に透けて見える。

- [ ] **Step 4: コミット**

```bash
git add src/index.css src/components/Timeline.tsx
git commit -m "style: glass-panelのborder/shadow除去（テーブル画面いっぱい化）"
```

---

### Task 9: モーダル角丸の微増

**Files:**
- Modify: `src/components/EventModal.tsx` — モーダルコンテナのrounded
- Modify: `src/components/PartySettingsModal.tsx` — モーダルコンテナのrounded

- [ ] **Step 1: EventModalの角丸を微増**

EventModalのPCモーダルコンテナで `rounded-xl` → `rounded-2xl` に変更（該当箇所を検索して置換）。

- [ ] **Step 2: PartySettingsModalの角丸を微増**

PartySettingsModalのPCパネルで `rounded-xl` があれば → `rounded-2xl` に変更。
（モバイルの `rounded-t-2xl` はそのまま。）

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/EventModal.tsx src/components/PartySettingsModal.tsx
git commit -m "style: モーダル角丸を微増（rounded-xl→rounded-2xl）"
```

---

## スマホフィードバック修正

### Task 10: テキスト選択防止（長押し・D&D時）

**Files:**
- Modify: `src/index.css` — グローバルルール追加
- Modify: `src/components/MobilePartySettings.tsx` — user-select追加

- [ ] **Step 1: 操作可能要素のテキスト選択防止CSSを追加**

`src/index.css` に追加:

```css
/* タッチ操作時のテキスト選択防止 */
button, [role="button"], .touch-none {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

- [ ] **Step 2: MobilePartySettingsのSwipeableSlotにuser-select追加**

`src/components/MobilePartySettings.tsx` の SwipeableSlot コンポーネントのルートdivに `select-none` クラスを追加。

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/index.css src/components/MobilePartySettings.tsx
git commit -m "fix: タッチ操作時のテキスト選択防止（user-select:none）"
```

---

### Task 11: スマホヘッダーのコンテンツ名調整

**Files:**
- Modify: `src/components/MobileHeader.tsx:53-60`

- [ ] **Step 1: コンテンツ名を非表示にする**

`src/components/MobileHeader.tsx` 行53-60のコンテンツ名表示を非表示にする。
プラン名とパーティアイコンだけで十分な情報量がある。

```tsx
{/* コンテンツ名はスマホでは省略 — 長すぎて必ずtruncateされ、タップで正式名称も見えないため */}
```

代替案: 完全非表示ではなく、フォントサイズを小さくして1行に収める。
判断はコンポーネント読んで決定。

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: コミット**

```bash
git add src/components/MobileHeader.tsx
git commit -m "style: スマホヘッダーのコンテンツ名を調整（情報密度改善）"
```

---

### Task 12: ジョブピッカー常時表示

**Files:**
- Modify: `src/components/MobilePartySettings.tsx`

- [ ] **Step 1: ジョブピッカーを常時表示に変更**

現在の `MobilePartySettings` では `focusedSlot && !myJobMode` の条件でスロット選択時のみジョブグリッドが表示され、
それ以外はロール別ジョブピッカー（D&Dソース）が表示される。

ロール別ジョブピッカーの表示条件 `!myJobMode && (...)` を確認し、
`focusedSlot` の有無に関わらず常時表示するように調整。

focusedSlot選択時: そのスロットへの配置用グリッド（現在通り）
focusedSlotなし: ロール別ジョブピッカー（D&Dソース）を常時表示（現在通り）

→ 実際には現在のコードで既にfocusedSlotなし時にロール別ピッカーが表示されている。
問題は「スロットをタップしないとジョブアイコンが見えない」点なので、
初期状態でロール別ピッカーが見えるようスクロール位置を調整するか、
スロット一覧の下に常にロール別ピッカーを表示する。

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: コミット**

```bash
git add src/components/MobilePartySettings.tsx
git commit -m "fix: ジョブピッカーを常時表示（D&Dの価値を活かす）"
```

---

### Task 13: PC版リグレッション修正

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx` — ハンドル位置修正
- Modify: `src/components/SyncButton.tsx` — 雲アイコン位置修正

- [ ] **Step 1: 実機確認でずれの原因を特定**

Chrome DevTools でPC表示にし、ヘッダーの開閉ハンドルとSyncButton雲アイコンの位置を確認。
スマホリデザインで追加されたCSS（index.css のモバイルCSS変数等）がPC側に影響していないか調査。

- [ ] **Step 2: 修正**

原因に応じて修正。レスポンシブブレイクポイント `md:` の条件が正しいか確認。

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add <修正ファイル>
git commit -m "fix: PC版ヘッダーハンドル・SyncButton位置ずれを修正"
```

---

### Task 14: 最終ビルド・テスト・デプロイ

**Files:** なし（確認のみ）

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: 成功

- [ ] **Step 2: フルテスト**

Run: `npm test -- --run`
Expected: 116テスト全パス

- [ ] **Step 3: TODO.md更新**

完了タスクをTODO.mdに反映。「現在の状態」セクションを更新。

- [ ] **Step 4: コミット・push**

```bash
git add docs/TODO.md
git commit -m "docs: TODO.md更新（PC版ネイティブポリッシュ完了）"
git push
```
