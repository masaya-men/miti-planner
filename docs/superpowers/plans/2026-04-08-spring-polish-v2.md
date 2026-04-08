# スプリングポリッシュ v2 — バグ修正 + ICS Mediaパターン適用

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ表示のバグ修正（透過・レイアウト・D&D）＋ ICS Media記事のspring easingパターンをアプリ全体に適用し、ネイティブアプリ品質のインタラクションを実現する。

**Architecture:** (1) CSS変数に3段階のspring easing（default/bouncy/snappy）を追加、(2) スマホUI構造バグを修正、(3) MobileBottomSheet・Toast・モーダル・サイドバー・ヘッダーにspring transitionを統一適用。

**Tech Stack:** CSS `linear()`, CSS変数, framer-motion（既存箇所のspring値統一）, React `createPortal`

**参考:** [ICS Media — CSSのlinear()によるスプリングアニメーション](https://ics.media/entry/260402/) / [GitHub examples](https://github.com/ics-creative/260402_spring_animation/)

---

## Phase A: CSS spring変数の拡充

### Task 1: spring easing 3段階 + duration拡充

**Files:**
- Modify: `src/index.css:135-158`（`:root, .theme-dark` 内のspring変数セクション）
- Modify: `src/index.css:1154-1160`（`prefers-reduced-motion`セクション）

- [ ] **Step 1: spring変数を3段階に拡充**

`src/index.css` の `:root, .theme-dark` セクション内、行135-158を以下に置換:

```css
    /* ── spring easing（CSS linear() — ICS Media記事準拠） ── */

    /* default: 穏やかな収束。モーダル・シート・ドロワー・ヘッダー開閉 */
    --ease-spring: linear(
      0, 0.0107, 0.0398, 0.0834, 0.138, 0.2003, 0.2677, 0.3379,
      0.4089, 0.4791, 0.5471, 0.612, 0.6731, 0.7297, 0.7815, 0.8283,
      0.87, 0.9068, 0.9388, 0.9662, 0.9892, 1.0083, 1.0237, 1.0357,
      1.0449, 1.0514, 1.0556, 1.058, 1.0587, 1.0581, 1.0563, 1.0538,
      1.0506, 1.0469, 1.043, 1.0388, 1.0347, 1.0306, 1.0266, 1.0228,
      1.0192, 1.0159, 1.0128, 1.0101, 1.0076, 1.0055, 1.0036, 1.002,
      1.0006, 0.9995, 0.9986, 0.9979, 0.9974, 0.997, 0.9967, 0.9966,
      0.9966, 0.9966, 0.9967, 0.9968, 0.997, 0.9972, 0.9975, 0.9977,
      0.998, 0.9982, 0.9984, 0.9987, 0.9989, 0.9991, 0.9992, 0.9994,
      0.9996, 0.9997, 0.9998, 0.9999, 1, 1, 1.0001, 1.0001, 1.0002,
      1.0002, 1.0002, 1.0002, 1.0002, 1.0002, 1.0002, 1.0002, 1.0002,
      1.0002, 1.0001, 1.0001, 1.0001, 1.0001, 1.0001, 1.0001, 1.0001,
      1.0001, 1, 1, 1
    );

    /* bouncy: 行きすぎ→戻り。トースト・ポップオーバー・ボタンモーフィング */
    --ease-spring-bouncy: linear(
      0, 0.0222, 0.0833, 0.1743, 0.2867, 0.4123, 0.5436, 0.6739,
      0.7978, 0.911, 1.0102, 1.0934, 1.1594, 1.2082, 1.2403, 1.2569,
      1.2599, 1.2511, 1.2328, 1.2074, 1.177, 1.1437, 1.1095, 1.0759,
      1.0443, 1.0157, 0.991, 0.9705, 0.9546, 0.9431, 0.9359, 0.9326,
      0.9327, 0.9357, 0.941, 0.9481, 0.9562, 0.965, 0.9739, 0.9826,
      0.9906, 0.9978, 1.0039, 1.0089, 1.0128, 1.0154, 1.017, 1.0176,
      1.0174, 1.0164, 1.0149, 1.013, 1.0108, 1.0085, 1.0062, 1.0039,
      1.0019, 1.0001, 0.9986, 0.9974, 0.9965, 0.9958, 0.9955, 0.9954,
      0.9955, 0.9958, 0.9963, 0.9968, 0.9974, 0.998, 0.9986, 0.9991,
      0.9996, 1.0001, 1.0005, 1.0008, 1.001, 1.0011, 1.0012, 1.0012,
      1.0011, 1.0011, 1.0009, 1.0008, 1.0006, 1.0005, 1.0003, 1.0002,
      1.0001, 0.9999, 0.9999, 0.9998, 0.9997, 0.9997, 0.9997, 0.9997,
      0.9997, 0.9997, 0.9998, 0.9998, 1
    );

    /* snappy: 素早く収束。ボタンpress・ホバー・小さなUI変化 */
    --ease-spring-snappy: linear(
      0, 0.0088, 0.0327, 0.068, 0.1117, 0.1614, 0.2149, 0.2706,
      0.327, 0.3831, 0.4379, 0.4907, 0.5412, 0.5889, 0.6336, 0.6751,
      0.7135, 0.7487, 0.7809, 0.81, 0.8362, 0.8597, 0.8807, 0.8994,
      0.9158, 0.9302, 0.9428, 0.9537, 0.9632, 0.9712, 0.9781, 0.9839,
      0.9888, 0.9928, 0.9961, 0.9988, 1.001, 1.0026, 1.0039, 1.0049,
      1.0055, 1.006, 1.0062, 1.0063, 1.0062, 1.0061, 1.0059, 1.0056,
      1.0053, 1.005, 1.0046, 1.0043, 1.0039, 1.0036, 1.0032, 1.0029,
      1.0026, 1.0023, 1.0021, 1.0018, 1.0016, 1.0014, 1.0012, 1.0011,
      1.0009, 1.0008, 1.0006, 1.0005, 1.0005, 1.0004, 1.0003, 1.0002,
      1.0002, 1.0001, 1.0001, 1.0001, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
    );

    /* ── duration ── */
    --duration-fast: 150ms;
    --duration-normal: 250ms;
    --duration-modal: 300ms;
    --duration-sheet: 1s;
    --duration-toast: 1.1s;

    /* ── scale ── */
    --scale-press: 0.96;
    --scale-hover: 1.04;
```

- [ ] **Step 2: reduced-motion を更新**

`src/index.css` 末尾の `@media (prefers-reduced-motion: reduce)` セクションを更新:

```css
@media (prefers-reduced-motion: reduce) {
  :root, .theme-dark, .theme-light {
    --ease-spring: ease;
    --ease-spring-bouncy: ease;
    --ease-spring-snappy: ease;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-modal: 0ms;
    --duration-sheet: 0ms;
    --duration-toast: 0ms;
  }
}
```

- [ ] **Step 3: 旧変数 `--ease-spring-gentle` の参照を確認・除去**

`--ease-spring-gentle` はどこからも使用されていないので、定義を除去（今回 `--ease-spring-bouncy` と `--ease-spring-snappy` に置換）。

- [ ] **Step 4: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
rtk git add src/index.css
rtk git commit -m "style: spring easing 3段階化（ICS Media準拠 default/bouncy/snappy）"
```

---

## Phase B: スマホUIバグ修正

### Task 2: スマホヘッダー/ボトムナビの透過化

**Files:**
- Modify: `src/components/MobileHeader.tsx:32`
- Modify: `src/index.css`（`--color-nav-bg` の値変更、ダーク・ライト両方）

- [ ] **Step 1: MobileHeader の背景透過度を変更**

`src/components/MobileHeader.tsx` 行32:

現在:
```tsx
className="shrink-0 border-b flex md:hidden flex-col justify-center px-3 z-40 relative bg-app-bg/95 backdrop-blur-md border-app-border"
```

変更後:
```tsx
className="shrink-0 border-b flex md:hidden flex-col justify-center px-3 z-40 relative bg-app-bg/70 backdrop-blur-xl border-app-border"
```

- [ ] **Step 2: ボトムナビ CSS変数の透過度を変更**

`src/index.css` のダークテーマ（`:root, .theme-dark` 内）:

現在:
```css
--color-nav-bg: rgba(20, 20, 20, 0.85);
```

変更後:
```css
--color-nav-bg: rgba(20, 20, 20, 0.70);
```

ライトテーマ（`.theme-light` 内）:

現在:
```css
--color-nav-bg: rgba(249, 249, 249, 0.94);
```

変更後:
```css
--color-nav-bg: rgba(249, 249, 249, 0.70);
```

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/MobileHeader.tsx src/index.css
rtk git commit -m "style: スマホヘッダー/ボトムナビの透過化（70%+backdrop-blur-xl）"
```

---

### Task 3: テーブル画面いっぱい化の修正

**Files:**
- Modify: `src/components/Layout.tsx:489`

- [ ] **Step 1: main要素のbottomパディングをゼロに**

スクリーンショットで確認した「ボトムナビの左に空白」は、`<motion.main>` の `pb-16` がテーブル下に余白を作っている。テーブルはボトムナビの下に透けて見えるべきなので、スマホでもパディングをゼロにする。

`src/components/Layout.tsx` 行489:

現在:
```tsx
className={clsx("flex-1 flex flex-col relative overflow-hidden pb-16 md:pb-0", !currentPlanId && "no-plan")}
```

変更後:
```tsx
className={clsx("flex-1 flex flex-col relative overflow-hidden pb-0", !currentPlanId && "no-plan")}
```

- [ ] **Step 2: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 3: コミット**

```bash
rtk git add src/components/Layout.tsx
rtk git commit -m "fix: スマホテーブルの余白除去（ボトムナビの下に透ける）"
```

---

### Task 4: D&Dゴーストの位置修正（createPortal）

**Files:**
- Modify: `src/components/MobilePartySettings.tsx`

- [ ] **Step 1: createPortal をインポート**

ファイル先頭のインポートに追加:
```tsx
import { createPortal } from 'react-dom';
```

- [ ] **Step 2: ドラッグゴーストを createPortal で document.body に移動**

現在のドラッグゴースト（`{drag.isDragging && drag.item && (` ブロック、約行334-348）を `createPortal` で囲む。

現在:
```tsx
{/* ドラッグゴースト */}
{drag.isDragging && drag.item && (
    <div
        className="fixed pointer-events-none z-50"
        style={{
            left: drag.position.x - 24,
            top: drag.position.y - 24,
            transform: `scale(${SCALE.drag})`,
        }}
    >
        <div className="w-12 h-12 rounded-xl bg-app-surface2 border border-app-text/30 flex items-center justify-center shadow-lg shadow-black/40">
            <img src={drag.item.icon} className="w-9 h-9 object-contain" />
        </div>
    </div>
)}
```

変更後:
```tsx
{/* ドラッグゴースト — MobileBottomSheetのtransformを回避するためportal化 */}
{drag.isDragging && drag.item && createPortal(
    <div
        className="fixed pointer-events-none z-[9999]"
        style={{
            left: drag.position.x - 24,
            top: drag.position.y - 24,
            transform: `scale(${SCALE.drag})`,
        }}
    >
        <div className="w-12 h-12 rounded-xl bg-app-surface2 border border-app-text/30 flex items-center justify-center shadow-lg shadow-black/40">
            <img src={drag.item.icon} className="w-9 h-9 object-contain" />
        </div>
    </div>,
    document.body
)}
```

z-indexを `z-50` → `z-[9999]` に変更（MobileBottomSheetのz-index 301を超えるため）。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/MobilePartySettings.tsx
rtk git commit -m "fix: D&Dゴースト位置修正（createPortalでtransform containingブロック回避）"
```

---

## Phase C: spring適用 — MobileBottomSheet

### Task 5: MobileBottomSheet にspring transition適用

**Files:**
- Modify: `src/components/MobileBottomSheet.tsx`

- [ ] **Step 1: spring easing を追加**

MobileBottomSheetはframer-motionの `SPRING.default` を使用中。framer-motionのspringは十分だが、`transition` プロパティを `SPRING.default` からより弾むバージョンに変更。

`src/components/MobileBottomSheet.tsx` 行92:

現在:
```tsx
transition={SPRING.default}
```

変更後:
```tsx
transition={{ type: "spring", stiffness: 380, damping: 22 }}
```

stiffness 380 + damping 22 は `--ease-spring-bouncy` に近い弾み。シートが「ポヨンっ」と止まる。

- [ ] **Step 2: exit transitionを別に設定（閉じる時はバネなし）**

ICS Media記事のパターン: 「Opening gets the spring. Closing stays short and plain.」

framer-motionの `exit` transitionを使って閉じる時は素早く:

行89-92を変更:

現在:
```tsx
initial={{ y: '100%' }}
animate={{ y: 0 }}
exit={{ y: '100%' }}
transition={SPRING.default}
```

変更後:
```tsx
initial={{ y: '100%' }}
animate={{ y: 0, transition: { type: "spring", stiffness: 380, damping: 22 } }}
exit={{ y: '100%', transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
```

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/MobileBottomSheet.tsx
rtk git commit -m "style: MobileBottomSheet春化（bouncy open / smooth close）"
```

---

## Phase D: spring適用 — Toast

### Task 6: Toast アニメーション強化

**Files:**
- Modify: `src/index.css`（`@keyframes toastIn` + `.animate-toast-in`）

- [ ] **Step 1: toastIn キーフレームを強化**

`src/index.css` の `@keyframes toastIn`（行72-75）を変更:

現在:
```css
@keyframes toastIn {
  from { opacity: 0; transform: translateY(12px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

変更後（translateYとscaleを大きく、バネ感を強調）:
```css
@keyframes toastIn {
  from { opacity: 0; transform: translateY(-52px) scale(0.82); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

- [ ] **Step 2: `.animate-toast-in` のeasingとdurationを更新**

`src/index.css` の `.animate-toast-in`（行881）を変更:

現在:
```css
.animate-toast-in {
  animation: toastIn var(--duration-modal) var(--ease-spring) forwards;
}
```

変更後:
```css
.animate-toast-in {
  animation: toastIn var(--duration-toast) var(--ease-spring-bouncy) forwards;
}
```

`--duration-toast: 1.1s` + `--ease-spring-bouncy` で、ICS Media記事のトーストパターンと同じバネ感。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
rtk git add src/index.css
rtk git commit -m "style: Toast spring bouncy化（ICS Mediaパターン準拠）"
```

---

## Phase E: spring適用 — ボタン・インタラクション

### Task 7: btn-tactileのspring snappy化 + ホバーspring

**Files:**
- Modify: `src/index.css`（`.btn-tactile` セクション）

- [ ] **Step 1: btn-tactile を snappy spring に更新**

`.btn-tactile` は現在 `--ease-spring` を使用中。ボタンは素早い応答が重要なので `--ease-spring-snappy` に変更。

現在の `.btn-tactile` セクション（`@layer components` 内）:
```css
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
```

変更後:
```css
  .btn-tactile {
    transition: transform 0.3s var(--ease-spring-snappy),
                color 150ms ease,
                background-color 150ms ease,
                border-color 150ms ease,
                opacity 150ms ease;
  }
  .btn-tactile:active {
    transform: scale(var(--scale-press));
  }
```

- [ ] **Step 2: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 3: コミット**

```bash
rtk git add src/index.css
rtk git commit -m "style: btn-tactileをspring snappy化（素早い応答感）"
```

---

## Phase F: spring適用 — サイドバー・ヘッダー

### Task 8: サイドバーのspring化

**Files:**
- Modify: `src/components/Sidebar.tsx`（行1138, 1145）

- [ ] **Step 1: サイドバーのspring値をbouncyに変更**

現在（両箇所とも）:
```tsx
transition={fullWidth ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 28 }}
```

変更後:
```tsx
transition={fullWidth ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 22 }}
```

サイドバーの開閉はシートと同じ弾みで統一。

- [ ] **Step 2: ヘッダー開閉のspring値をよりbouncy化**

`src/components/ConsolidatedHeader.tsx` 行136:

現在:
```tsx
transition={{ type: "spring", stiffness: 400, damping: 28 }}
```

変更後:
```tsx
transition={{ type: "spring", stiffness: 380, damping: 22 }}
```

- [ ] **Step 3: Layout.tsx の main paddingTop spring も統一**

`src/components/Layout.tsx` 行492:

現在:
```tsx
transition={{ type: "spring", stiffness: 300, damping: 30 }}
```

変更後:
```tsx
transition={{ type: "spring", stiffness: 380, damping: 22 }}
```

- [ ] **Step 4: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Sidebar.tsx src/components/ConsolidatedHeader.tsx src/components/Layout.tsx
rtk git commit -m "style: サイドバー/ヘッダー/レイアウトのspring統一（bouncy 380/22）"
```

---

### Task 9: 最終ビルド・テスト

**Files:** なし（確認のみ）

- [ ] **Step 1: フルビルド**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 2: フルテスト**

Run: `rtk vitest run`
Expected: 116テスト全パス

- [ ] **Step 3: TODO.md更新**

完了タスクをTODO.mdに反映。

- [ ] **Step 4: コミット・push**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs: TODO.md更新（spring polish v2完了）"
rtk git push
```
