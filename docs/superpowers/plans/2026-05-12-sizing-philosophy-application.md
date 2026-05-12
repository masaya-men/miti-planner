# LoPo Sizing 思想適用 — Phase 1 修正 + Phase 2 実装プラン

> 全プロジェクト共通の **サイズ設計哲学** (`C:\Users\masay\.claude\design-philosophy-sizing.md`) を LoPo に適用するためのタスク分解プラン。

**Goal:** タイムライン列幅と font-size tokens を「max = base = 開発者画面 px」 形式に統一し、 container max-width 1489px を主要 layout に適用する。 ultrawide で要素拡大せず余白拡大、 ノート PC で自動 92% 縮小、 開発者画面で pixel-perfect の 3 viewport 挙動を実現する。

**Architecture:** 全 token を `clamp(MIN_PX, N_VW, BASE_PX)` 形式 (`max = base`) に統一。 `BASE_PX` は開発者の 1489 viewport での既存 px 値を維持 (= 視覚変化を 1489 では起こさない)。 1920+ では新たに「base で固定」 が効くため、 既存より小さく見える (= ユーザー目標と整合)。

**Tech Stack:** CSS clamp() + vw / px ベース / Tailwind v4 / Playwright (期待値更新) / vitest 既存

---

## 関連ドキュメント

- 全プロジェクト共通思想: `C:\Users\masay\.claude\design-philosophy-sizing.md` (v2、 max=base)
- グローバル CLAUDE.md: `C:\Users\masay\.claude\CLAUDE.md` (「サイズ設計思想」 セクション)
- 元 LoPo plan: `docs/superpowers/plans/2026-05-12-timeline-full-responsive.md` (Phase 1 完了済)
- 統合 spec: `docs/superpowers/specs/2026-05-12-sizing-philosophy-alignment.md`

---

## Design Decisions (本セッションでの確認事項)

### Timeline 本体も中央寄せ対象 (spec から方針変更)

spec doc は「Timeline 本体は横スクロール対応のため除外」 としていたが、 ユーザー意図 「ウルトラワイドは余白が増えるだけ」 と整合するため、 **Timeline 本体にも `max-width: var(--container-max)` + `margin-inline: auto` を適用**(中央寄せ)。

横スクロールと max-width は独立した概念。 max-width は container サイズの天井、 横スクロール は container 内 content が天井超えたときに発火。 両立する。

### `-plus` トークン (16, 24) は **削除せず clamp 化**

調査の結果、 `--text-app-2xl-plus` / `--text-app-4xl-plus` として既存コードベースで使用されている (`src/index.css:56, 59` で `--text-app-*` にエイリアス)。 削除は破壊的変更になるため、 既存階層をそのまま clamp 化する。

### min 値は philosophy doc の推奨に従う (base × 0.85〜0.92)

ノート PC (1366) では vw 計算が base × 0.917 (= 1366÷1489) で自動的に縮小されるため、 min は viewport < 1366 の安全弁。 ただし保守的に base × 0.85〜0.92 を採用 (タブレット狭幅でも layout 破綻しないため)。

### アクセシビリティ代替 UI (アプリ内 text size 設定) は **本プランから除外** (将来 Phase)

`data-text-scale` 属性 + `--text-scale-multiplier` は philosophy doc § 4-7 で言及されているが、 実装 UI が必要なため別タスクとして切り出す。 本プランでは CSS 変数 `--text-scale-multiplier` 自体は予約のみで未使用。

---

## File Structure

### 修正対象ファイル

| ファイル | 責務 | 変更内容 |
|---------|------|---------|
| `src/index.css` | 全体 CSS トークン定義 | (1) `:root, .theme-dark` と `.theme-light` の両方に `--container-max: 1489px` + `--text-scale-multiplier: 1` 追加 (2) `font-size: 16px` を html に明示 (3) `@media (min-width: 768px)` 内の列幅 7 token の `max` を `base` に修正 (4) 同 media query 内に font-size tokens の clamp 上書きを追加 |
| `src/components/Timeline.tsx` | タイムライン本体 | 最外層 container に `max-width: var(--container-max); margin-inline: auto;` 追加 (中央寄せ) |
| `src/components/LandingPage.tsx` (該当箇所) | ランディングページ | 同上、 適用箇所判定 |
| `src/components/Layout.tsx` | アプリレイアウト | sidebar / modal が中央寄せ可能か確認、 必要なら適用 |
| `playwright/timeline-responsive.spec.ts` | E2E 回帰 | 期待値を新方針 (max=base) に書き換え |

### 既存ファイルへの影響なし (確認用)

- `src/utils/calculator.ts` — `getColumnCssVar` 経由なので変更不要
- `src/components/TimelineRow.tsx` — CSS 変数経由なので変更不要
- `src/components/Timeline.layoutHooks.ts` — DOM 計測値なので clamp 変更を自動追従

---

## Task 1: src/index.css の列幅 7 token の max を base に修正

**Files:**
- Modify: `src/index.css` (PC 用 `@media (min-width: 768px)` ブロック、 column width tokens)

- [ ] **Step 1: 現状値の確認**

Run via Grep: `--col-(phase|label|time|mechanic|counter|th|dps)-w` in `src/index.css`

期待: 既存 `@media (min-width: 768px)` 内の 7 token を発見

- [ ] **Step 2: max 値を base に変更**

| token | 旧 max | 新 max (= base) |
|---|---|---|
| `--col-phase-w` | 80 | **60** |
| `--col-label-w` | 70 | **50** |
| `--col-time-w` | 80 | **60** |
| `--col-mechanic-w` | 280 | **200** |
| `--col-counter-w` | 140 | **100** |
| `--col-th-w` | 180 | **125** |
| `--col-dps-w` | 80 | **50** |

`min` と `vw 係数` は据え置き。 例:
```css
--col-th-w: clamp(110px, 8.395vw, 125px);  /* 旧: clamp(110px, 8.395vw, 180px) */
```

- [ ] **Step 3: tsc + build 確認**

```bash
npx tsc --noEmit 2>&1 | tail -3
rtk npm run build 2>&1 | grep "built in"
```

Expected: tsc clean、 build PASS。 既存の `--col-member-start` calc() は max=base 値で再計算 → 1489 で 570px (= 元の `currentLeft = 570` と整合)、 1920+ で 570px 固定 (= ultrawide で content 幅固定 = ユーザー目標)。

- [ ] **Step 4: コミット (個別)**

```bash
rtk git add src/index.css
rtk git commit -m "feat(css): 列幅 token の clamp max を base に統一 (Phase 1A)
- max = base = 開発者画面 px (philosophy v2 適用)
- ultrawide で要素拡大せず、 1489+ で全列固定
- 1366 ノート PC は vw 自然値で base × 0.917 ≈ 92% 縮小"
```

---

## Task 2: Playwright テストの期待値を新方針に更新

**Files:**
- Modify: `playwright/timeline-responsive.spec.ts` (EXPECTED_TH_WIDTH / EXPECTED_DPS_WIDTH の値)

- [ ] **Step 1: 新期待値の計算**

新 clamp(110, 8.395vw, 125) の挙動:
- 1366: `min(125, max(110, 1366 × 0.08395))` = `min(125, max(110, 114.68))` = **114.68** → round 115
- 1489: 125 (アンカー)
- 1920+: 125 (max 固定)

新 clamp(45, 3.358vw, 50) の挙動:
- 1366: `min(50, max(45, 1366 × 0.03358))` = **45.87** → round 46
- 1489: 50 (アンカー)
- 1920+: 50 (max 固定)

| viewport | 旧期待 (max=180/80) | 新期待 (max=125/50) |
|---|---|---|
| 1366-laptop | 115 / 46 | **115 / 46** (不変) |
| 1489-user-actual | 125 / 50 | **125 / 50** (不変) |
| 1920-majority | 161 / 64 | **125 / 50** ← 変更 |
| 2560-27inch-4k-150 | 180 / 80 | **125 / 50** ← 変更 |
| 3840-native-4k | 180 / 80 | **125 / 50** ← 変更 |

- [ ] **Step 2: テストファイルの期待値オブジェクトを書き換え**

```typescript
const EXPECTED_TH_WIDTH: Record<string, number> = {
  '1366-laptop': 115,
  '1489-user-actual': 125,
  '1920-majority': 125,      // 変更: 161 → 125
  '2560-27inch-4k-150': 125, // 変更: 180 → 125
  '3840-native-4k': 125,     // 変更: 180 → 125
};

const EXPECTED_DPS_WIDTH: Record<string, number> = {
  '1366-laptop': 46,
  '1489-user-actual': 50,
  '1920-majority': 50,       // 変更: 64 → 50
  '2560-27inch-4k-150': 50,  // 変更: 80 → 50
  '3840-native-4k': 50,      // 変更: 80 → 50
};
```

1489 の strict assertion (`Math.round(width) === 125 / 50`) はそのまま (基準値変わらず)。

- [ ] **Step 3: Playwright 実行確認**

```bash
npx playwright test 2>&1 | tail -10
```

Expected: 5/5 PASS。 1489 strict 含む。

- [ ] **Step 4: コミット**

```bash
rtk git add playwright/timeline-responsive.spec.ts
rtk git commit -m "test(playwright): 列幅期待値を max=base 新方針に更新 (Phase 1B)
- 1920+ は 125/50 で max 固定、 ultrawide で要素拡大しない
- 1366 (115/46) と 1489 (125/50) の期待値は不変"
```

---

## Task 3: html font-size: 16px 明示 + container max-width トークン追加

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: `:root` ブロックに `font-size: 16px` を確認**

Read `src/index.css:95-130` 付近の `:root, .theme-dark` ブロック。

すでに `font-size: 16px` が明示されていれば何もしない (おそらく既存)。 なければ追加:
```css
:root,
.theme-dark {
  font-size: 16px;  /* ブラウザ内 font 設定 (経路 b) の影響を無効化 */
  /* ... 既存 token 群 ... */
}
```

注: ライトテーマ `.theme-light` でも同じ font-size: 16px を明示。

- [ ] **Step 2: `--container-max` と `--text-scale-multiplier` を追加**

`:root, .theme-dark` モバイル既定ブロックと `.theme-light` モバイル既定ブロックの両方に:

```css
/* === 共通基盤 (全 viewport 共通) === */
--container-max: 1489px;           /* 開発者画面幅 = 上限、 大画面で余白確保 */
--text-scale-multiplier: 1;        /* アプリ内 text size 設定の倍率 (将来 UI 追加用) */
```

これらは media query 不要 (mobile / PC 同値)。

- [ ] **Step 3: build 確認**

```bash
rtk npm run build 2>&1 | grep "built in"
```

- [ ] **Step 4: コミット**

```bash
rtk git add src/index.css
rtk git commit -m "feat(css): html font-size 明示 + container-max トークン追加 (Phase 2A)
- font-size: 16px をルートに明示 (ブラウザ font 設定の影響を無効化)
- --container-max: 1489px (= 開発者画面幅、 ultrawide で中央寄せ用)
- --text-scale-multiplier: 1 (将来のアプリ内 text size UI 用に予約)"
```

---

## Task 4: font-size tokens を clamp+vw 化 (PC 用 media query)

**Files:**
- Modify: `src/index.css` (`@media (min-width: 768px)` ブロック内に font-size 上書き定義を追加)

- [ ] **Step 1: 既存 font-size tokens の値確認**

`src/index.css:106-120` 付近で既存 14 token (`-3xs` から `-6xl` まで、 `-plus` 含む) の固定 px 値を確認:
- 3xs=6, 2xs=7, xs=8, sm=9, base=10, md=11, lg=12, xl=13, 2xl=14, 2xl-plus=16, 3xl=18, 4xl=20, 4xl-plus=24, 5xl=26, 6xl=36

これら値が **base = 開発者画面 1489 で見せたい px**。

- [ ] **Step 2: 各 token の vw 係数を計算**

公式: `N_VW = BASE_PX / 1489 × 100`

| token | base | vw 係数 | min (base × 0.88) |
|---|---|---|---|
| 3xs | 6 | 0.403vw | 5 |
| 2xs | 7 | 0.470vw | 6 |
| xs | 8 | 0.537vw | 7 |
| sm | 9 | 0.604vw | 8 |
| base | 10 | 0.671vw | 9 |
| md | 11 | 0.738vw | 10 |
| lg | 12 | 0.806vw | 11 |
| xl | 13 | 0.873vw | 11 |
| 2xl | 14 | 0.940vw | 12 |
| 2xl-plus | 16 | 1.074vw | 14 |
| 3xl | 18 | 1.209vw | 16 |
| 4xl | 20 | 1.343vw | 17 |
| 4xl-plus | 24 | 1.612vw | 21 |
| 5xl | 26 | 1.746vw | 22 |
| 6xl | 36 | 2.418vw | 30 |

- [ ] **Step 3: `@media (min-width: 768px)` ブロックに上書き定義を追加**

既存 `@media (min-width: 768px) { :root, .theme-dark, .theme-light { ... 列幅 token ... } }` ブロックの中に追記 (既存ブロックを拡張):

```css
@media (min-width: 768px) {
    :root,
    .theme-dark,
    .theme-light {
        /* === 列幅 token (Task 1 で max=base 済み) === */
        --col-phase-w: clamp(48px, 4.030vw, 60px);
        /* ... 既存の列幅 7 個 ... */

        /* === Font-size token (PC 用 clamp+vw、 max = base) === */
        --font-size-3xs: clamp(5px,  0.403vw, 6px);
        --font-size-2xs: clamp(6px,  0.470vw, 7px);
        --font-size-xs:  clamp(7px,  0.537vw, 8px);
        --font-size-sm:  clamp(8px,  0.604vw, 9px);
        --font-size-base: clamp(9px,  0.671vw, 10px);
        --font-size-md:  clamp(10px, 0.738vw, 11px);
        --font-size-lg:  clamp(11px, 0.806vw, 12px);
        --font-size-xl:  clamp(11px, 0.873vw, 13px);
        --font-size-2xl: clamp(12px, 0.940vw, 14px);
        --font-size-2xl-plus: clamp(14px, 1.074vw, 16px);
        --font-size-3xl: clamp(16px, 1.209vw, 18px);
        --font-size-4xl: clamp(17px, 1.343vw, 20px);
        --font-size-4xl-plus: clamp(21px, 1.612vw, 24px);
        --font-size-5xl: clamp(22px, 1.746vw, 26px);
        --font-size-6xl: clamp(30px, 2.418vw, 36px);
    }
}
```

注意点:
- モバイル (`< 768px`) は既存 `:root` ブロックの固定 px 値のまま (上書きされない)
- PC では clamp で 1366-1489 でスムーズ伸縮、 1489+ で max 固定

- [ ] **Step 4: build + vitest 確認**

```bash
rtk npm run build 2>&1 | grep "built in"
npx vitest run 2>&1 | tail -3
```

Expected: 全 PASS。 viewport=1489 で font-size が既存固定値と同値 (10/11/12/13/14/16/18/20/24/26/36)。

- [ ] **Step 5: コミット**

```bash
rtk git add src/index.css
rtk git commit -m "feat(css): font-size tokens を clamp+vw 化 (Phase 2B、 max=base)
- 全 14 token (-plus 含む) を PC 用 media query で clamp 上書き
- 1489 で既存 px 値と一致、 1366 で base × 0.917 ≈ 92% 自然縮小
- 1920+ で base 固定 (= ultrawide で text 拡大しない)
- モバイル既定値は変更なし"
```

---

## Task 5: Timeline 本体に container max-width 適用 (中央寄せ)

**Files:**
- Modify: `src/components/Timeline.tsx` (最外層 container)

- [ ] **Step 1: Timeline.tsx の最外層 container 特定**

Read `src/components/Timeline.tsx` の return 文付近 (component の JSX root)。

最外層に `max-width: var(--container-max); margin-inline: auto;` を追加できる場所を特定。 ただし以下を遵守:
- 既存の overflow / scroll 挙動を壊さない
- mobile (`< 768px`) では適用しない (フル幅維持)

- [ ] **Step 2: max-width 適用**

最外層 div (または既存 wrapper) に Tailwind クラス追加:
```tsx
className="md:max-w-[var(--container-max)] md:mx-auto ..."
```

または既存 className に追記。

- [ ] **Step 3: ブラウザ実機目視 (skipped — Playwright で検証)**

- [ ] **Step 4: Playwright で 3840 中央寄せ確認**

`playwright/timeline-responsive.spec.ts` に新しいアサーションを追加 (もしくは Task 6 で別タスク化):

```typescript
test(`Timeline is centered at 3840 ultrawide`, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('/miti');
  await page.waitForSelector('[data-member-role="tank"]', { state: 'attached' });

  // Timeline container の左右余白がほぼ均等 (中央寄せ)
  const container = page.locator('main, [data-timeline-root]').first();
  const box = await container.boundingBox();
  if (box) {
    const leftMargin = box.x;
    const rightMargin = 3840 - (box.x + box.width);
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(50);  // ±50px tolerance
  }
  await ctx.close();
});
```

Note: 適用箇所が判明するまで selector は調整必要。

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Timeline.tsx playwright/timeline-responsive.spec.ts
rtk git commit -m "feat(Timeline): 本体に container max-width 1489 適用 (中央寄せ)
- PC viewport (md: 以上) で max-width: var(--container-max) + mx-auto
- ultrawide で Timeline content が中央寄せ、 左右に均等余白
- mobile は変更なし (フル幅維持)
- Playwright 中央寄せアサーション追加"
```

---

## Task 6: LP / Sidebar / Modal の container max-width 適用 audit

**Files:**
- Audit: `src/components/LandingPage.tsx` (該当箇所)
- Audit: `src/components/Sidebar.tsx`
- Audit: `src/components/{NewPlanModal,LoginModal,...}.tsx`
- Audit: `src/components/Layout.tsx`

- [ ] **Step 1: 各コンポーネントの現状 width 設定確認**

Read 各ファイルの container を確認:
- LandingPage: 既存 max-width あるか、 ultrawide で間延びするか
- Sidebar: 固定幅 / フル幅 / max-width
- Modal: 既存 max-width あるか
- Layout: app-shell の構造

- [ ] **Step 2: 適用が必要な箇所を特定**

判定基準:
- すでに max-width が設定されている → 値を `var(--container-max)` に統一
- max-width が未設定で ultrawide で間延びする → 追加
- 元から固定幅 (sidebar 240px 等) → 変更不要

- [ ] **Step 3: 適用**

該当コンポーネントに max-width + margin-inline: auto を追加。

- [ ] **Step 4: 視覚回帰確認**

build + vitest + 既存 Playwright (5 viewport) で破綻なし確認。

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/...
rtk git commit -m "feat(layout): LP / 主要 layout に container max-width 適用
- LandingPage / その他 audit 結果に基づき個別適用
- Sidebar / Modal の既存幅設定は維持
- ultrawide で content 中央寄せ、 左右均等余白"
```

---

## Task 7: 最終ビルド + 全テスト + TODO 更新 + push

- [ ] **Step 1: 全テスト**

```bash
rtk npm run build 2>&1 | tail -10
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -3
npx playwright test 2>&1 | tail -10
```

Expected: 全 PASS。 Playwright 5+1 (中央寄せ) test PASS。

- [ ] **Step 2: docs/TODO.md 更新**

「現在の状態」 セクションに本セッションの完了記録を追記、 詳細は TODO_COMPLETED.md に移動。

- [ ] **Step 3: 最終 push**

```bash
rtk git push
```

Vercel 自動デプロイ。 push 後、 ユーザー本人環境 (1489) + 1920 + 3840 でブラウザから動作確認。

---

## Phase 6 (将来別タスク) — アプリ内 text size 設定 UI

philosophy doc § 4-7 で言及されている `data-text-scale` 属性 + `--text-scale-multiplier` を使った text size 切替 UI は、 設定 modal 等の実装が必要なため別タスクで進行。 本プランでは CSS 変数の予約のみ。

---

## Self-Review チェックリスト

- [x] **Spec coverage**: spec の Step 1-6 をすべて Task 化。 Phase 2 font 修正版含む
- [x] **Placeholder スキャン**: TBD / TODO / implement later なし。 clamp 値は計算根拠付き
- [x] **Type consistency**: CSS のみの変更で TS 型に影響なし
- [x] **モバイル考慮**: `< 768px` は既存固定 px のまま、 PC 用 media query でのみ clamp 化
- [x] **DPR 影響**: clamp + vw は CSS 論理 px ベース、 DPR 非依存 (本人 DPR 2.58 / 多数派 DPR 1 で同結果)
- [x] **テスト戦略**: vitest (既存維持) + Playwright (期待値更新 + 中央寄せ assertion 追加)
- [x] **Phase 1 既存実装との整合**: Task 1 で max を base にするだけ。 既存 `getColumnCssVar` / `useMeasuredMemberLayout` / `data-member-role` は変更不要 (CSS 経由で自動追従)
