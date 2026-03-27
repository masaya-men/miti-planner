# 人気ページ ガラス強化 + オーバーレイ統一 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 人気ページのガラスエフェクトを `empty-liquid-glass` 品質に引き上げ、全モーダルオーバーレイを `bg-black/50 backdrop-blur-[2px]` に統一する

**Architecture:** CSS中心の実装。ガラスエフェクトは index.css に新クラスを定義し、PopularPage.tsx で適用。波ライティングは CSS animation のみ（JS不要）。オーバーレイ統一は各コンポーネントのクラス文字列を置換。

**Tech Stack:** CSS (animations, mask-composite, radial-gradient), Tailwind CSS classes, React (JSX className変更のみ)

---

## ファイル構成

| ファイル | 変更内容 |
|---------|---------|
| `src/index.css` | 新CSSクラス追加（ガラス + 波ライティング）、既存glass-popular-*を置換 |
| `src/components/PopularPage.tsx` | 新ガラスクラスの適用、波ライティング用のラッパー要素追加 |
| 21ファイル（オーバーレイ対象） | bg-black/XX → bg-black/50、backdrop-blur → backdrop-blur-[2px] |

---

## Task 1: 人気ページ用ガラスCSSクラス定義

**Files:**
- Modify: `src/index.css:337-409`（既存 glass-popular-* を置換）

- [ ] **Step 1: 既存の glass-popular-header / card / section を新しいガラスクラスに置き換える**

`src/index.css` の行337〜409にある既存の3クラスを削除し、以下の新しいクラスに置き換える。

```css
/* ============================
   人気ページ — ガラスエフェクト
   empty-liquid-glass ベースの白/黒ライン
   ============================ */

/* --- ヘッダー --- */
.glass-popular-header {
  position: relative;
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.25);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.08),
    inset 0 -1px 1px rgba(255,255,255,0.04),
    0 1px 3px rgba(0,0,0,0.3);
  overflow: hidden;
}
/* ヘッダー上辺シーンライン */
.glass-popular-header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(to right,
    transparent, rgba(255,255,255,0.15) 20%,
    rgba(255,255,255,0.25) 50%,
    rgba(255,255,255,0.15) 80%, transparent
  );
  pointer-events: none;
}

/* ライトテーマ ヘッダー */
.theme-light .glass-popular-header {
  background: rgba(255,255,255,0.55);
  border-bottom-color: rgba(0,0,0,0.08);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.8),
    inset 0 -1px 0 rgba(0,0,0,0.05),
    0 0 0 1px rgba(0,0,0,0.08),
    0 2px 8px rgba(0,0,0,0.04);
}
.theme-light .glass-popular-header::after {
  background: linear-gradient(to right,
    transparent, rgba(0,0,0,0.04) 20%,
    rgba(0,0,0,0.08) 50%,
    rgba(0,0,0,0.04) 80%, transparent
  );
}

/* --- カード --- */
.glass-popular-card {
  position: relative;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.08),
    inset 0 -1px 1px rgba(255,255,255,0.04);
  overflow: hidden;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
/* 縁のグラデーションボーダー（上下） */
.glass-popular-card::before {
  content: '';
  position: absolute; inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(180deg,
    rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 15%,
    transparent 35%, transparent 65%,
    rgba(255,255,255,0.06) 85%, rgba(255,255,255,0.15) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}
/* 縁のグラデーションボーダー（左右） */
.glass-popular-card::after {
  content: '';
  position: absolute; inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(90deg,
    rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 10%,
    transparent 25%, transparent 75%,
    rgba(255,255,255,0.04) 90%, rgba(255,255,255,0.12) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}

/* ホバー時: 縁が明るくなる */
.glass-popular-card:hover {
  border-color: rgba(255,255,255,0.25);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.12),
    inset 0 -1px 1px rgba(255,255,255,0.06),
    0 0 20px rgba(255,255,255,0.05);
}

/* ライトテーマ カード */
.theme-light .glass-popular-card {
  background: rgba(255,255,255,0.55);
  border-color: rgba(0,0,0,0.08);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.8),
    inset 0 -1px 0 rgba(0,0,0,0.05),
    0 0 0 1px rgba(0,0,0,0.08),
    0 2px 8px rgba(0,0,0,0.04);
}
.theme-light .glass-popular-card::before {
  background: linear-gradient(180deg,
    rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.03) 15%,
    transparent 35%, transparent 65%,
    rgba(0,0,0,0.02) 85%, rgba(0,0,0,0.05) 100%
  );
}
.theme-light .glass-popular-card::after {
  background: linear-gradient(90deg,
    rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 10%,
    transparent 25%, transparent 75%,
    rgba(0,0,0,0.02) 90%, rgba(0,0,0,0.04) 100%
  );
}
.theme-light .glass-popular-card:hover {
  border-color: rgba(0,0,0,0.15);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.8),
    inset 0 -1px 0 rgba(0,0,0,0.05),
    0 0 0 1px rgba(0,0,0,0.12),
    0 2px 12px rgba(0,0,0,0.06);
}

/* --- セクション --- */
.glass-popular-section {
  position: relative;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.05),
    inset 0 -1px 1px rgba(255,255,255,0.02);
  overflow: hidden;
}

.theme-light .glass-popular-section {
  background: rgba(255,255,255,0.4);
  border-color: rgba(0,0,0,0.06);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.6),
    0 0 0 1px rgba(0,0,0,0.06);
}
```

- [ ] **Step 2: ブラウザで人気ページを開いてカード・ヘッダー・セクションの見た目を確認**

http://localhost:5174 で人気ページを開き、ダーク/ライト両テーマで以下を確認：
- カードの縁にグラデーションボーダーが表示されている
- ヘッダー下部にシーンラインが光っている
- ホバーで縁が明るくなる

- [ ] **Step 3: コミット**

```bash
git add src/index.css
git commit -m "feat: 人気ページのガラスエフェクトをempty-liquid-glass品質に刷新"
```

---

## Task 2: ホバー時の光走りアニメーション

**Files:**
- Modify: `src/index.css`（Task 1のカードクラスの後に追加）

- [ ] **Step 1: 光走りアニメーションのキーフレームとクラスを追加**

Task 1 で書いた `.glass-popular-card` の後に以下を追加する。

```css
/* --- カード: ホバー時の光走りアニメーション --- */
@keyframes cardLightSweep {
  0% {
    transform: translateX(-100%) skewX(-15deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translateX(300%) skewX(-15deg);
    opacity: 0;
  }
}

/* ホバー光走り用の子要素 */
.glass-card-sweep {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
  border-radius: inherit;
}
.glass-card-sweep::before {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 40%;
  background: linear-gradient(90deg,
    transparent,
    rgba(255,255,255,0.08) 40%,
    rgba(255,255,255,0.12) 50%,
    rgba(255,255,255,0.08) 60%,
    transparent
  );
  transform: translateX(-100%) skewX(-15deg);
  opacity: 0;
}
.glass-popular-card:hover .glass-card-sweep::before {
  animation: cardLightSweep 0.8s ease-out forwards;
}

/* ライトテーマ 光走り */
.theme-light .glass-card-sweep::before {
  background: linear-gradient(90deg,
    transparent,
    rgba(0,0,0,0.04) 40%,
    rgba(0,0,0,0.06) 50%,
    rgba(0,0,0,0.04) 60%,
    transparent
  );
}
```

- [ ] **Step 2: PopularPage.tsx のカードJSXに光走り用要素を追加**

`src/components/PopularPage.tsx` の共有カード（約行310）とスケルトンカード（約行346）の `glass-popular-card` div の直下に、子要素として以下を追加する：

```tsx
<div className="glass-card-sweep" />
```

具体的には、`glass-popular-card` を持つ各 `<div>` の開始タグ直後に挿入する。

- [ ] **Step 3: ブラウザでホバー時の光走りを確認**

http://localhost:5174 で人気ページを開き、カードにマウスを載せたときに：
- 左から右へ光が走って消える
- 再度ホバーで再発火する
- ダーク/ライト両テーマで動作する

- [ ] **Step 4: コミット**

```bash
git add src/index.css src/components/PopularPage.tsx
git commit -m "feat: 人気ページカードにホバー時の光走りアニメーション追加"
```

---

## Task 3: ページ全体の波ライティング

**Files:**
- Modify: `src/index.css`（Task 2の後に追加）
- Modify: `src/components/PopularPage.tsx`（波ライティング用ラッパー追加）

- [ ] **Step 1: 波ライティングのキーフレームとクラスを追加**

`src/index.css` に以下を追加：

```css
/* --- 人気ページ: 波ライティング --- */
@keyframes popularWaveLight {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(200%);
  }
}

.popular-wave-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.popular-wave {
  position: absolute;
  top: 0; bottom: 0;
  width: 60%;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255,255,255,0.015) 20%,
    rgba(255,255,255,0.04) 45%,
    rgba(255,255,255,0.04) 55%,
    rgba(255,255,255,0.015) 80%,
    transparent 100%
  );
  animation: popularWaveLight 7s ease-in-out infinite;
  will-change: transform;
}

/* ライトテーマ 波ライティング */
.theme-light .popular-wave {
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(0,0,0,0.01) 20%,
    rgba(0,0,0,0.025) 45%,
    rgba(0,0,0,0.025) 55%,
    rgba(0,0,0,0.01) 80%,
    transparent 100%
  );
}

/* 波がカードに当たった時のインタラクション */
.glass-popular-card {
  /* mix-blend-mode で波の光がカードの縁に反映される */
  isolation: isolate;
}
```

- [ ] **Step 2: PopularPage.tsx に波ライティング用ラッパーを追加**

`src/components/PopularPage.tsx` のメインのreturn文（コンテンツの最も外側のdiv）の直下に以下を追加する：

```tsx
{/* 波ライティング */}
<div className="popular-wave-container">
  <div className="popular-wave" />
</div>
```

- [ ] **Step 3: ブラウザで波ライティングを確認**

http://localhost:5174 で人気ページを開き：
- 約7秒周期でゆるい光の帯が左から右へ流れる
- カードの上を通過するとき、カードがほんのり明るく見える
- ダーク/ライト両テーマで自然に見える
- スクロールしても波が追従する（fixed配置）

- [ ] **Step 4: コミット**

```bash
git add src/index.css src/components/PopularPage.tsx
git commit -m "feat: 人気ページにゆるい波ライティング演出を追加"
```

---

## Task 4: カードのコーナーハイライトとシーンライン

**Files:**
- Modify: `src/index.css`（Task 3の後に追加）
- Modify: `src/components/PopularPage.tsx`（カード内にコーナー＋シーンライン要素追加）

- [ ] **Step 1: コーナーハイライトとシーンラインのCSSを追加**

`src/index.css` に以下を追加：

```css
/* --- カード: コーナーハイライト --- */
.glass-card-corner {
  position: absolute;
  width: 30px; height: 30px;
  pointer-events: none;
  z-index: 2;
}
.glass-card-corner-tl { top:0;left:0; background:radial-gradient(ellipse at 0% 0%,rgba(255,255,255,0.1) 0%,transparent 70%); }
.glass-card-corner-tr { top:0;right:0; background:radial-gradient(ellipse at 100% 0%,rgba(255,255,255,0.07) 0%,transparent 70%); }
.glass-card-corner-bl { bottom:0;left:0; background:radial-gradient(ellipse at 0% 100%,rgba(255,255,255,0.07) 0%,transparent 70%); }
.glass-card-corner-br { bottom:0;right:0; background:radial-gradient(ellipse at 100% 100%,rgba(255,255,255,0.05) 0%,transparent 70%); }

/* ライトテーマ コーナー */
.theme-light .glass-card-corner-tl { background:radial-gradient(ellipse at 0% 0%,rgba(255,255,255,0.4) 0%,transparent 70%); }
.theme-light .glass-card-corner-tr { background:radial-gradient(ellipse at 100% 0%,rgba(255,255,255,0.3) 0%,transparent 70%); }
.theme-light .glass-card-corner-bl { background:radial-gradient(ellipse at 0% 100%,rgba(255,255,255,0.3) 0%,transparent 70%); }
.theme-light .glass-card-corner-br { background:radial-gradient(ellipse at 100% 100%,rgba(255,255,255,0.25) 0%,transparent 70%); }

/* --- カード: 上辺シーンライン --- */
.glass-card-sheen {
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(to right,
    transparent, rgba(255,255,255,0.12) 20%,
    rgba(255,255,255,0.2) 50%,
    rgba(255,255,255,0.12) 80%, transparent
  );
}
.theme-light .glass-card-sheen {
  background: linear-gradient(to right,
    transparent, rgba(255,255,255,0.4) 20%,
    rgba(255,255,255,0.6) 50%,
    rgba(255,255,255,0.4) 80%, transparent
  );
}
```

- [ ] **Step 2: PopularPage.tsx のカードJSXにコーナーとシーンラインを追加**

`src/components/PopularPage.tsx` の共有カードとスケルトンカード内（`glass-card-sweep` の直後）に以下を追加：

```tsx
<div className="glass-card-corner glass-card-corner-tl" />
<div className="glass-card-corner glass-card-corner-tr" />
<div className="glass-card-corner glass-card-corner-bl" />
<div className="glass-card-corner glass-card-corner-br" />
<div className="glass-card-sheen" />
```

- [ ] **Step 3: ブラウザで確認**

http://localhost:5174 で人気ページを開き：
- カードの四隅に淡いハイライトが見える
- カード上辺に細い光の反射線が走っている
- ダーク/ライト両テーマで自然に見える

- [ ] **Step 4: コミット**

```bash
git add src/index.css src/components/PopularPage.tsx
git commit -m "feat: 人気ページカードにコーナーハイライトとシーンライン追加"
```

---

## Task 5: オーバーレイ統一 — bg-black/50 backdrop-blur-[2px] への一括変更

**Files:**
以下の全ファイルを変更（すべて `src/components/` 配下）

- [ ] **Step 1: bg-black/20, bg-black/30 のファイルを修正**

**JobPicker.tsx 行42:**
```
変更前: "absolute inset-0 bg-black/20 pointer-events-auto"
変更後: "absolute inset-0 bg-black/50 backdrop-blur-[2px] pointer-events-auto"
```

**Timeline.tsx 行2315:**
```
変更前: "fixed inset-0 z-[9998] md:bg-transparent bg-black/30"
変更後: "fixed inset-0 z-[9998] md:bg-transparent bg-black/50 md:backdrop-blur-none backdrop-blur-[2px]"
```
※ md:bg-transparent がある = PC版では透明。blurもPC版では不要なので `md:backdrop-blur-none` を追加。

- [ ] **Step 2: bg-black/40（オーバーレイ用途のみ）を修正**

**CheatSheetView.tsx 行424:**
```
変更前: "fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
変更後: "fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
```

**NewPlanModal.tsx 行179:**
```
変更前: "absolute inset-0 bg-black/40 cursor-pointer"
変更後: "absolute inset-0 bg-black/50 backdrop-blur-[2px] cursor-pointer"
```

**SaveDialog.tsx 行57:**
```
変更前: "absolute inset-0 bg-black/40 cursor-pointer"
変更後: "absolute inset-0 bg-black/50 backdrop-blur-[2px] cursor-pointer"
```

**MitigationSelector.tsx 行204:**
```
変更前: bg-black/40 backdrop-blur-sm
変更後: bg-black/50 backdrop-blur-[2px]
```
※ このファイルは条件付きクラスの中にある。`bg-black/40` を `bg-black/50` に、`backdrop-blur-sm` を `backdrop-blur-[2px]` に変更。

**Timeline.tsx 行1984:**
```
変更前: "absolute inset-0 bg-black/40"
変更後: "absolute inset-0 bg-black/50 backdrop-blur-[2px]"
```

- [ ] **Step 3: bg-black/50（blur追加のみ）を修正**

**MobileBottomSheet.tsx 行85:**
```
変更前: "md:hidden fixed inset-0 bg-black/50 z-[300] transition-opacity duration-300"
変更後: "md:hidden fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[300] transition-opacity duration-300"
```

※ ConfirmDialog.tsx と LoginModal.tsx は `bg-black/50 backdrop-blur-[2px]` で既に統一値。変更不要。

- [ ] **Step 4: bg-black/60 を修正（パート1: Party系 + Event系）**

**PartyStatusPopover.tsx 行181:**
```
変更前: "absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ease-out"
変更後: "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out"
```

**PartySettingsModal.tsx 行613:**
```
変更前: "absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ease-out"
変更後: "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out"
```

**EventModal.tsx 行441:**
```
変更前: ${isMobile ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}
変更後: ${isMobile ? 'bg-black/50 backdrop-blur-[2px]' : 'bg-transparent'}
```

- [ ] **Step 5: bg-black/60 を修正（パート2: インポート・移行・共有系）**

**FFLogsImportModal.tsx 行191:**
```
変更前: "absolute inset-0 bg-black/60 backdrop-blur-sm"
変更後: "absolute inset-0 bg-black/50 backdrop-blur-[2px]"
```

**JobMigrationModal.tsx 行43:**
```
変更前: "absolute inset-0 bg-black/60 backdrop-blur-sm"
変更後: "absolute inset-0 bg-black/50 backdrop-blur-[2px]"
```

**PhaseModal.tsx 行82:**
```
変更前: ${isMobile ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}
変更後: ${isMobile ? 'bg-black/50 backdrop-blur-[2px]' : 'bg-transparent'}
```

**ShareModal.tsx 行108:**
```
変更前: "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
変更後: "fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
```

- [ ] **Step 6: bg-black/60 を修正（パート3: サイドバー・チュートリアル・ガイド）**

**Sidebar.tsx 行1170:**
```
変更前: bg-black/60 backdrop-blur-sm
変更後: bg-black/50 backdrop-blur-[2px]
```
※ Sidebar.tsx 内に複数のオーバーレイがある可能性あり。`bg-black/60` を全て `bg-black/50` に、`backdrop-blur-sm` を全て `backdrop-blur-[2px]` に変更する。

**TutorialOverlay.tsx 行442:**
```
変更前: "fixed inset-0 z-[100010] bg-black/60 backdrop-blur-sm"
変更後: "fixed inset-0 z-[100010] bg-black/50 backdrop-blur-[2px]"
```
※ TutorialOverlay.tsx 内の他のオーバーレイ（行682, 750付近）も同様に `bg-black/60` → `bg-black/50`、`backdrop-blur-sm` → `backdrop-blur-[2px]` に変更。

**MobileGuide.tsx 行47:**
```
変更前: "fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
変更後: "fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-6"
```

- [ ] **Step 7: bg-black/80 を修正**

**Layout.tsx 行686:**
```
変更前: "fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
変更後: "fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
```

- [ ] **Step 8: 全モーダルを開いてオーバーレイの統一を確認**

http://localhost:5174 で以下のモーダルを順番に開いて、背景の暗さ・ぼかしが同じに見えることを確認する：
- ログインモーダル
- 確認ダイアログ（プラン削除など）
- 共有モーダル
- FFLogsインポートモーダル
- サイドバー内モーダル（新規プランなど）
- スマホ表示でボトムシート

- [ ] **Step 9: コミット**

```bash
git add src/components/JobPicker.tsx src/components/Timeline.tsx src/components/CheatSheetView.tsx src/components/NewPlanModal.tsx src/components/SaveDialog.tsx src/components/MitigationSelector.tsx src/components/MobileBottomSheet.tsx src/components/PartyStatusPopover.tsx src/components/PartySettingsModal.tsx src/components/EventModal.tsx src/components/FFLogsImportModal.tsx src/components/JobMigrationModal.tsx src/components/PhaseModal.tsx src/components/ShareModal.tsx src/components/Sidebar.tsx src/components/TutorialOverlay.tsx src/components/MobileGuide.tsx src/components/Layout.tsx
git commit -m "fix: 全モーダルオーバーレイをbg-black/50 backdrop-blur-[2px]に統一"
```

---

## Task 6: 最終確認とビルド

**Files:** なし（確認のみ）

- [ ] **Step 1: ビルドが通ることを確認**

```bash
npm run build
```

エラーが出なければOK。

- [ ] **Step 2: ダーク/ライト両テーマで人気ページを最終確認**

以下をすべて確認：
- カードの縁グラデーション・コーナーハイライト・シーンラインが見える
- ホバーで光が走る
- 波ライティングが7秒周期で流れる
- スケルトンカードにも同じエフェクトがかかっている
- ヘッダー下部にシーンラインがある

- [ ] **Step 3: 複数のモーダルでオーバーレイの暗さが統一されていることを最終確認**

- [ ] **Step 4: TODO.md を更新**

`docs/TODO.md` の以下の項目を完了に移動：
- 「人気ページのガラス表現を大幅強化」
- 「UI全体の温度感統一」

---

## 対象外（この計画に含まないもの）

| 項目 | 理由 |
|------|------|
| AASettingsPopover.tsx の bg-black/90 | ツールチップ背景色。モーダルオーバーレイではない |
| Timeline.tsx 行1950 の bg-black/20 hover:bg-black/40 | ボタンのホバー効果。オーバーレイではない |
| PhaseModal.tsx 行96 の bg-black/40 | モーダルヘッダーバーの背景色。オーバーレイではない |
| z-index の統一 | 別タスクとして扱う |
| TutorialOverlay の SVG spotlight (rgba(0,0,0,0.75)) | スポットライトマスクでありオーバーレイとは別の役割 |
