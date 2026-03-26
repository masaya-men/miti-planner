# トップページ + グラスモーフィズム リデザイン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LoPoのランディングページをActive Theory/Igloo Inc級の超インタラクティブなページに刷新し、アプリ全体にグラスモーフィズム3層階層システムを導入する。

**Architecture:** 2つの独立した作業ストリーム — (A) グラスモーフィズムCSS変数とユーティリティクラスの定義→全コンポーネントへの適用、(B) GSAP+Lenisを使った新ランディングページの構築。Aを先に完了させることでBのランディングページでもglassクラスを利用できる。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Three.js (既存), GSAP (新規), Lenis (新規), framer-motion (既存・共存)

**Spec:** `docs/superpowers/specs/2026-03-26-landing-page-and-glass-redesign.md`

**検証方法:** このプロジェクトにはテストフレームワークがないため、各タスク完了時に `npm run build` でビルドエラーがないことを確認する。ビジュアル検証は `npm run dev` で開発サーバーを起動して目視確認。

---

## ファイル構造

### 新規作成
```
src/components/landing/
├── LandingPage.tsx          — ランディングページ本体（Lenis初期化 + 全セクション統合）
├── Preloader.tsx            — プリローダー（初回訪問のみ、sessionStorage制御）
├── HeroSection.tsx          — ヒーロー（100vh、clip-pathリビール、CTA）
├── MitiSection.tsx          — 軽減プランナー紹介（左テキスト + 右デモ画面）
├── FeaturesSection.tsx      — 機能ハイライト4枚カード（2x2グリッド）
├── HousingSection.tsx       — ハウジングツアー予告（Coming Soon）
├── CTASection.tsx           — 行動喚起（CTAボタン + Ko-fi）
└── LandingFooter.tsx        — フッター（SE権利表記）
src/hooks/
└── useSmoothScroll.ts       — Lenis + GSAP ScrollTrigger統合フック
```

### 変更
```
src/index.css                — glass-tier1/2/3 CSS変数追加、既存glass変数置換
tailwind.config.js           — glass Tier色をTailwind変数に追加
src/App.tsx                  — PortalPage → LandingPage に差し替え
src/components/ConsolidatedHeader.tsx  — glass-tier3 適用
src/components/Sidebar.tsx             — glass-tier3 + hover変数更新
src/components/Layout.tsx              — glass-tier1 適用（空パネル）
src/components/ui/Tooltip.tsx          — glass-tier2 適用
src/components/Toast.tsx               — glass-tier2 適用
src/components/MobileBottomSheet.tsx   — glass-tier2 適用
src/components/ConfirmDialog.tsx       — glass-tier3 適用
src/components/ParticleBackground.tsx  — マウス追従uniform追加
src/locales/ja.json                    — portal.*キー拡張
src/locales/en.json                    — 同上
package.json                           — gsap, lenis 追加
```

### 削除
```
src/components/PortalPage.tsx          — LandingPageに置き換え
```

---

## Task 1: GSAP + Lenis インストール

**Files:**
- Modify: `package.json`

- [ ] **Step 1: パッケージインストール**

```bash
cd c:/Users/masay/Desktop/FF14Sim
npm install gsap lenis
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功（新パッケージ追加のみ、コードは未変更）

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore: gsap + lenis をインストール"
```

---

## Task 2: グラスモーフィズム CSS変数定義

**Files:**
- Modify: `src/index.css`（L74-126付近のテーマ変数セクション）
- Modify: `tailwind.config.js`（glass色定義）

- [ ] **Step 1: index.css にTier変数を追加**

`src/index.css` のダークテーマセクション（`:root, .theme-dark` ブロック内、L91付近）で、既存のglass変数を以下に置き換える:

```css
/* 既存の以下を削除 */
--glass-bg-header: transparent;
--glass-bg-panel: transparent;
--glass-bg-card: transparent;
--glass-border: rgba(255, 255, 255, 0.12);
--glass-hover: rgba(255, 255, 255, 0.06);
--glass-active: rgba(255, 255, 255, 0.1);
--glass-shadow: none;

/* 以下に置き換え */
--glass-tier3-bg: rgba(255, 255, 255, 0.14);
--glass-tier3-blur: 40px;
--glass-tier3-border: rgba(255, 255, 255, 0.18);
--glass-tier3-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
--glass-tier3-inset: inset 0 1px 0 rgba(255, 255, 255, 0.1);

--glass-tier2-bg: rgba(255, 255, 255, 0.08);
--glass-tier2-blur: 28px;
--glass-tier2-border: rgba(255, 255, 255, 0.12);
--glass-tier2-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

--glass-tier1-bg: rgba(255, 255, 255, 0.04);
--glass-tier1-blur: 16px;
--glass-tier1-border: rgba(255, 255, 255, 0.08);

/* 後方互換: 既存クラスが壊れないよう旧名を新Tierにエイリアス */
--glass-bg-header: var(--glass-tier3-bg);
--glass-bg-panel: var(--glass-tier1-bg);
--glass-bg-card: var(--glass-tier1-bg);
--glass-border: var(--glass-tier1-border);
--glass-hover: rgba(255, 255, 255, 0.06);
--glass-active: rgba(255, 255, 255, 0.1);
--glass-shadow: var(--glass-tier3-shadow);
```

ライトテーマセクション（`.theme-light` ブロック内、L119付近）も同様に:

```css
/* 既存を削除して以下に置き換え */
--glass-tier3-bg: rgba(255, 255, 255, 0.70);
--glass-tier3-blur: 40px;
--glass-tier3-border: rgba(0, 0, 0, 0.08);
--glass-tier3-shadow: 0 12px 48px rgba(0, 0, 0, 0.08);
--glass-tier3-inset: inset 0 1px 0 rgba(255, 255, 255, 0.5);

--glass-tier2-bg: rgba(255, 255, 255, 0.60);
--glass-tier2-blur: 28px;
--glass-tier2-border: rgba(0, 0, 0, 0.06);
--glass-tier2-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);

--glass-tier1-bg: rgba(255, 255, 255, 0.45);
--glass-tier1-blur: 16px;
--glass-tier1-border: rgba(0, 0, 0, 0.05);

/* 後方互換エイリアス */
--glass-bg-header: var(--glass-tier3-bg);
--glass-bg-panel: var(--glass-tier1-bg);
--glass-bg-card: var(--glass-tier1-bg);
--glass-border: var(--glass-tier1-border);
--glass-hover: rgba(0, 0, 0, 0.04);
--glass-active: rgba(0, 0, 0, 0.08);
--glass-shadow: var(--glass-tier3-shadow);
```

- [ ] **Step 2: glass-panel クラスをTierクラスに拡張**

`src/index.css` の `.glass-panel` 定義（L154-156付近）を以下に置き換え:

```css
/* 旧: .glass-panel { border: 1px solid var(--glass-border); } */

.glass-tier3 {
  background: var(--glass-tier3-bg);
  backdrop-filter: blur(var(--glass-tier3-blur));
  -webkit-backdrop-filter: blur(var(--glass-tier3-blur));
  border: 1px solid var(--glass-tier3-border);
  box-shadow: var(--glass-tier3-shadow), var(--glass-tier3-inset);
}

.glass-tier2 {
  background: var(--glass-tier2-bg);
  backdrop-filter: blur(var(--glass-tier2-blur));
  -webkit-backdrop-filter: blur(var(--glass-tier2-blur));
  border: 1px solid var(--glass-tier2-border);
  box-shadow: var(--glass-tier2-shadow);
}

.glass-tier1 {
  background: var(--glass-tier1-bg);
  backdrop-filter: blur(var(--glass-tier1-blur));
  -webkit-backdrop-filter: blur(var(--glass-tier1-blur));
  border: 1px solid var(--glass-tier1-border);
}

/* 後方互換: 既存の glass-panel は tier1 にマッピング */
.glass-panel {
  background: var(--glass-tier1-bg);
  backdrop-filter: blur(var(--glass-tier1-blur));
  -webkit-backdrop-filter: blur(var(--glass-tier1-blur));
  border: 1px solid var(--glass-tier1-border);
}
```

- [ ] **Step 3: 無効化されたホバー・シャインを復活させるか確認**

`src/index.css` L166 `.glass-interactive::after { display: none; }` と L177 `.hover-shine::after { display: none; }` は削除しない。グラスモーフィズムの復活はbackdrop-filterベースであり、疑似要素のシャインエフェクトは別件。

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功。後方互換エイリアスにより既存コンポーネントが壊れない。

- [ ] **Step 5: コミット**

```bash
git add src/index.css
git commit -m "feat: グラスモーフィズム3層Tier CSS変数定義"
```

---

## Task 3: ConsolidatedHeader に glass-tier3 適用

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx`（L179付近）

- [ ] **Step 1: ヘッダーコンテナにglass-tier3を適用**

L179付近の `bg-glass-header` を含むクラスに `glass-tier3` を追加し、`bg-glass-header` を削除:

```tsx
// 変更前:
className="w-full overflow-hidden pointer-events-auto bg-glass-header shadow-sm"

// 変更後:
className="w-full overflow-hidden pointer-events-auto glass-tier3"
```

`shadow-sm` は `glass-tier3` の `box-shadow` で置き換えられるため削除。

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: dev serverで目視確認**

```bash
npm run dev
```

ヘッダーにbackdrop-blur(40px)が効いていること、背景がかすかに透けていること、border + inset shadowが見えることを確認。ダーク/ライト両テーマで確認。

- [ ] **Step 4: コミット**

```bash
git add src/components/ConsolidatedHeader.tsx
git commit -m "feat: ヘッダーにglass-tier3適用"
```

---

## Task 4: Sidebar に glass-tier3 適用

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: サイドバーのメインコンテナを特定して glass-tier3 を適用**

サイドバーの最外側コンテナ（`motion.aside` または `aside` 要素）に `glass-tier3` クラスを追加。既存の `bg-app-bg` や `border-glass-border` を削除（glass-tier3が背景・ボーダーを提供するため）。

内部の `bg-glass-card`, `border-glass-border`, `hover:bg-glass-hover`, `bg-glass-active` はそのまま維持（後方互換エイリアスで機能する）。

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: 目視確認**

サイドバーにglass効果が効いていること。内部のメニューアイテムのhover/active状態が正常に動作すること。PCとモバイル両方で確認。

- [ ] **Step 4: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: サイドバーにglass-tier3適用"
```

---

## Task 5: Tooltip, Toast, MobileBottomSheet に glass-tier2 適用

**Files:**
- Modify: `src/components/ui/Tooltip.tsx`（L143付近）
- Modify: `src/components/Toast.tsx`（L50付近）
- Modify: `src/components/MobileBottomSheet.tsx`

- [ ] **Step 1: Tooltip を glass-tier2 に変更**

```tsx
// 変更前 (Tooltip.tsx L143):
className={clsx(
  "glass-panel whitespace-nowrap px-2.5 py-1.5 rounded-lg ...",
  className
)}

// 変更後:
className={clsx(
  "glass-tier2 whitespace-nowrap px-2.5 py-1.5 rounded-lg ...",
  className
)}
```

- [ ] **Step 2: Toast を glass-tier2 に変更**

```tsx
// 変更前 (Toast.tsx L50):
className={clsx(
  "flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-bg glass-panel shadow-lg",
  ...
)}

// 変更後: bg-app-bg と shadow-lg を削除（glass-tier2が提供）
className={clsx(
  "flex items-center gap-2 px-4 py-2.5 rounded-xl glass-tier2",
  ...
)}
```

- [ ] **Step 3: MobileBottomSheet を glass-tier2 に変更**

MobileBottomSheetのメインパネルコンテナにある既存のglass系クラスを `glass-tier2` に置き換え。

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

- [ ] **Step 5: 目視確認**

ツールチップ・トースト・ボトムシートそれぞれにblur(28px)のガラス効果が見えること。

- [ ] **Step 6: コミット**

```bash
git add src/components/ui/Tooltip.tsx src/components/Toast.tsx src/components/MobileBottomSheet.tsx
git commit -m "feat: Tooltip/Toast/BottomSheetにglass-tier2適用"
```

---

## Task 6: ConfirmDialog, Layout(空パネル), Timeline に glass-tier 適用

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`（L42付近）
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: ConfirmDialog を glass-tier3 に変更**

```tsx
// 変更前 (ConfirmDialog.tsx L42):
className={clsx(
  "relative w-[360px] max-w-[90vw] rounded-2xl glass-panel",
  ...
)}

// 変更後:
className={clsx(
  "relative w-[360px] max-w-[90vw] rounded-2xl glass-tier3",
  ...
)}
```

- [ ] **Step 2: Layout.tsx の空パネル（!currentPlanId時）に glass-tier1 を確認**

空パネルは `.empty-liquid-glass` で独自のbackdrop-filterを持っている。これはそのまま維持（Tier1より特殊な演出のため）。Layout.tsx内のその他のglass-panel使用箇所があればglass-tier1に置き換え。

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add src/components/ConfirmDialog.tsx src/components/Layout.tsx
git commit -m "feat: ConfirmDialog/Layoutにglass-tier適用"
```

---

## Task 7: ParticleBackground にマウス追従を追加

**Files:**
- Modify: `src/components/ParticleBackground.tsx`

- [ ] **Step 1: マウス座標uniformを追加**

既存のuniformsオブジェクトに `uMouse` を追加:

```typescript
const uniforms = {
  uTime: { value: 0 },
  uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uTheme: { value: isDark ? 0 : 1 },
  uSpeed: { value: isDark ? 0.40 : 0.35 },
  uBlobSz: { value: (isDark ? 0.15 : 0.10) * (window.innerWidth / window.innerHeight) },
  uBr: { value: isDark ? 0.45 : 0.30 },
  uMouse: { value: new THREE.Vector2(0.5, 0.5) },  // 追加: 正規化座標(0-1)
};
```

- [ ] **Step 2: mousemoveイベントリスナーを追加**

コンポーネント内のuseEffect（canvasセットアップ部分）にマウスイベントを追加:

```typescript
const handleMouseMove = (e: MouseEvent) => {
  uniformsRef.current.uMouse.value.set(
    e.clientX / window.innerWidth,
    1.0 - e.clientY / window.innerHeight  // Y軸反転（GLSL座標系）
  );
};
window.addEventListener('mousemove', handleMouseMove);

// cleanup
return () => {
  window.removeEventListener('mousemove', handleMouseMove);
  // ... 既存のcleanup
};
```

- [ ] **Step 3: フラグメントシェーダーにマウス影響を追加**

シェーダーの `uniform` 宣言に `uniform vec2 uMouse;` を追加し、`organicPos()` 関数内またはメインの色計算部分でマウス座標の影響を加える:

```glsl
uniform vec2 uMouse;

// organicPos内またはmain内で:
// マウス位置に近いほどブロブが微妙に引き寄せられる
vec2 mouseInfluence = (uMouse - 0.5) * 0.08;
// 各ブロブ位置に mouseInfluence を加算
```

影響度は `0.08` 程度（微細に動く）。ガッツリ動かすのではなく、マウスに「反応している」のがわかる程度。

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

- [ ] **Step 5: 目視確認**

`npm run dev` でマウスを動かした時に背景パーティクルが微妙に追従すること。

- [ ] **Step 6: コミット**

```bash
git add src/components/ParticleBackground.tsx
git commit -m "feat: WebGL背景にマウス追従を追加"
```

---

## Task 8: i18n キー拡張

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: ja.json に portal ランディング用キーを追加**

既存の `portal` キーの下に、各セクション用のキーを追加:

```json
"portal": {
  "title": "LoPo",
  "subtitle": "軽減プランナーやハウジングツアーなど、冒険をサポートするツール群",
  "coming_soon": "準備中",
  "hero": {
    "label": "FF14 Tool Portal",
    "tagline": "レイドの軽減計画を、もっとスマートに。",
    "tagline_sub": "ハウジングツアーも、もうすぐ。",
    "cta_primary": "軽減プランナーを使う",
    "cta_secondary": "詳しく見る",
    "scroll_hint": "SCROLL"
  },
  "miti": {
    "label": "01 — Mitigation Planner",
    "heading": "スプシの時代は終わりました。",
    "desc_1": "ドラッグ&ドロップで軽減を配置。",
    "desc_2": "リアルタイムでダメージ計算。",
    "desc_3": "FFLogsから自動インポート。"
  },
  "features": {
    "auto_plan": {
      "title": "オートプラン",
      "desc": "AIが最適な軽減配置を自動計算。SA法による全体最適化"
    },
    "fflogs": {
      "title": "FFLogsインポート",
      "desc": "ログから攻撃タイムラインを自動生成。手入力ゼロ"
    },
    "responsive": {
      "title": "どこでも使える",
      "desc": "PC・スマホ・タブレット完全対応。外出先でも確認"
    },
    "share": {
      "title": "ワンクリック共有",
      "desc": "URLひとつでPTメンバーに共有。コピー不要"
    }
  },
  "housing": {
    "label": "02 — Housing Tour Planner",
    "heading": "ハウジングをもっと楽しく。",
    "desc_1": "お気に入りのお家を見つけて、",
    "desc_2": "みんなでツアーに出かけよう。",
    "badge": "Coming Soon"
  },
  "cta": {
    "heading": "今すぐ、始めよう。",
    "sub": "完全無料。アカウント登録なしですぐ使えます。",
    "button": "軽減プランナーを使う",
    "kofi": "気に入ったら → Ko-fiで応援する"
  },
  "footer": {
    "copyright": "© SQUARE ENIX CO., LTD. All Rights Reserved.",
    "disclaimer": "当サイトは非公式のファンツールであり、株式会社スクウェア・エニックスとは一切関係ありません。",
    "privacy": "プライバシーポリシー",
    "terms": "利用規約"
  },
  "tools": {
    "miti_planner": {
      "title": "軽減プランナー",
      "description": "タイムラインベースの軽減計画ツール。零式・絶のボスタイムラインに軽減スキルを配置して、パーティ全体の軽減計画を作成。"
    },
    "housing_tour": {
      "title": "ハウジングツアー",
      "description": "ハウジングエリアの巡回ルートを計画・共有するためのツール。お気に入りの家を見つけて、フレンドと一緒にツアーしよう。"
    }
  }
}
```

- [ ] **Step 2: en.json に同じ構造で英語テキストを追加**

```json
"portal": {
  "title": "LoPo",
  "subtitle": "Tools to support your adventures — mitigation planning, housing tours, and more",
  "coming_soon": "Coming Soon",
  "hero": {
    "label": "FF14 Tool Portal",
    "tagline": "Plan your raid mitigation, smarter.",
    "tagline_sub": "Housing tours, coming soon.",
    "cta_primary": "Open Mitigation Planner",
    "cta_secondary": "Learn more",
    "scroll_hint": "SCROLL"
  },
  "miti": {
    "label": "01 — Mitigation Planner",
    "heading": "Spreadsheets are over.",
    "desc_1": "Drag & drop to place mitigations.",
    "desc_2": "Real-time damage calculation.",
    "desc_3": "Auto-import from FFLogs."
  },
  "features": {
    "auto_plan": {
      "title": "Auto Plan",
      "desc": "AI-powered optimal mitigation placement using simulated annealing"
    },
    "fflogs": {
      "title": "FFLogs Import",
      "desc": "Auto-generate attack timelines from logs. Zero manual input"
    },
    "responsive": {
      "title": "Use Anywhere",
      "desc": "Fully responsive on PC, phone, and tablet"
    },
    "share": {
      "title": "One-Click Share",
      "desc": "Share with party members via a single URL"
    }
  },
  "housing": {
    "label": "02 — Housing Tour Planner",
    "heading": "Make housing more fun.",
    "desc_1": "Find your favorite houses,",
    "desc_2": "and tour them with friends.",
    "badge": "Coming Soon"
  },
  "cta": {
    "heading": "Get started now.",
    "sub": "Completely free. No registration required.",
    "button": "Open Mitigation Planner",
    "kofi": "Like it? → Support on Ko-fi"
  },
  "footer": {
    "copyright": "© SQUARE ENIX CO., LTD. All Rights Reserved.",
    "disclaimer": "This is an unofficial fan tool and is not affiliated with SQUARE ENIX CO., LTD.",
    "privacy": "Privacy Policy",
    "terms": "Terms of Service"
  },
  "tools": {
    "miti_planner": {
      "title": "Mitigation Planner",
      "description": "Timeline-based mitigation planning tool. Place mitigation skills on boss timelines for Savage and Ultimate raids."
    },
    "housing_tour": {
      "title": "Housing Tour",
      "description": "Plan and share housing area tour routes. Find beautiful houses and tour them with friends."
    }
  }
}
```

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat: ランディングページ用i18nキー追加"
```

---

## Task 9: useSmoothScroll フック作成

**Files:**
- Create: `src/hooks/useSmoothScroll.ts`

- [ ] **Step 1: Lenis + GSAP ScrollTrigger統合フックを作成**

```typescript
import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useSmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    // GSAP ScrollTriggerとLenisを同期
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return lenisRef;
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/hooks/useSmoothScroll.ts
git commit -m "feat: useSmoothScrollフック（Lenis + GSAP ScrollTrigger）"
```

---

## Task 10: Preloader コンポーネント

**Files:**
- Create: `src/components/landing/Preloader.tsx`

- [ ] **Step 1: プリローダーを作成**

```typescript
import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface PreloaderProps {
  onComplete: () => void;
}

export function Preloader({ onComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // sessionStorageチェック: 2回目以降はスキップ
    if (sessionStorage.getItem('lopo-visited')) {
      onComplete();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        sessionStorage.setItem('lopo-visited', '1');
        onComplete();
      },
    });

    // Phase 1: プログレス 0→100 (0s-1.5s)
    tl.to({}, {
      duration: 1.5,
      onUpdate: function() {
        setProgress(Math.round(this.progress() * 100));
      },
    });

    // Phase 2: ロゴ出現 (1.5s-2s)
    tl.fromTo(
      logoRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' },
      1.2 // プログレス終了少し前から開始
    );

    // Phase 3: clip-pathで展開 (2s-2.5s)
    tl.to(containerRef.current, {
      clipPath: 'circle(150% at 50% 50%)',
      duration: 0.8,
      ease: 'power2.inOut',
    });

    return () => { tl.kill(); };
  }, [onComplete]);

  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100000] bg-black flex flex-col items-center justify-center"
      style={{ clipPath: 'circle(100% at 50% 50%)' }}
    >
      {/* プログレスサークル */}
      <svg width="80" height="80" viewBox="0 0 80 80" className="mb-4" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <circle
          ref={circleRef}
          cx="40" cy="40" r="36"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>

      {/* パーセンテージ */}
      <div className="font-mono text-sm text-white/50 mb-6">{progress}%</div>

      {/* ロゴ */}
      <div ref={logoRef} className="opacity-0">
        <div className="text-5xl font-black tracking-tighter text-white">LoPo</div>
        <div className="text-[11px] text-white/30 tracking-[3px] uppercase text-center mt-1">
          FF14 Tool Portal
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/components/landing/Preloader.tsx
git commit -m "feat: プリローダーコンポーネント（初回訪問のみ）"
```

---

## Task 11: HeroSection コンポーネント

**Files:**
- Create: `src/components/landing/HeroSection.tsx`

- [ ] **Step 1: ヒーローセクションを作成**

```typescript
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const taglineSubRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // テキスト clip-path リビール
      const tl = gsap.timeline({ delay: 0.3 });

      tl.fromTo(labelRef.current,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power3.out' }
      );

      tl.fromTo(logoRef.current,
        { clipPath: 'inset(0 100% 0 0)', opacity: 0 },
        { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 0.6, ease: 'power3.out' },
        '-=0.3'
      );

      tl.fromTo(taglineRef.current,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'power3.out' },
        '-=0.2'
      );

      tl.fromTo(taglineSubRef.current,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'power3.out' },
        '-=0.2'
      );

      tl.fromTo(ctaRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
        '-=0.1'
      );

      tl.fromTo(scrollHintRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5 },
        '-=0.2'
      );

      // スクロールパララックス: テキストがゆっくり上に消える
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          if (sectionRef.current) {
            const children = sectionRef.current.querySelector('.hero-content') as HTMLElement;
            if (children) {
              gsap.set(children, {
                y: -self.progress * 100,
                opacity: 1 - self.progress * 0.8,
              });
            }
          }
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const scrollToNext = () => {
    const next = sectionRef.current?.nextElementSibling;
    if (next) next.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section ref={sectionRef} className="relative h-screen flex items-center justify-center overflow-hidden">
      <div className="hero-content relative z-10 flex flex-col items-center text-center px-4">
        {/* ラベル */}
        <div ref={labelRef} className="text-[11px] text-white/40 tracking-[4px] uppercase mb-3">
          {t('portal.hero.label')}
        </div>

        {/* ロゴ */}
        <div ref={logoRef} className="text-[clamp(48px,12vw,96px)] font-black tracking-tighter leading-none">
          {t('portal.title')}
        </div>

        {/* キャッチコピー */}
        <div ref={taglineRef} className="text-base md:text-lg text-white/60 mt-4 max-w-md leading-relaxed">
          {t('portal.hero.tagline')}
        </div>
        <div ref={taglineSubRef} className="text-sm text-white/30 mt-1">
          {t('portal.hero.tagline_sub')}
        </div>

        {/* CTA */}
        <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 mt-8 opacity-0">
          <button
            onClick={() => navigate('/miti')}
            className="px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:scale-105 transition-transform"
          >
            {t('portal.hero.cta_primary')}
          </button>
          <button
            onClick={scrollToNext}
            className="px-6 py-3 border border-white/20 rounded-lg text-sm text-white/60 hover:border-white/40 transition-colors"
          >
            {t('portal.hero.cta_secondary')} ↓
          </button>
        </div>
      </div>

      {/* スクロールヒント */}
      <div ref={scrollHintRef} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-0">
        <div className="text-[10px] text-white/25 tracking-widest">{t('portal.hero.scroll_hint')}</div>
        <div className="w-px h-5 bg-gradient-to-b from-white/25 to-transparent"></div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/components/landing/HeroSection.tsx
git commit -m "feat: ヒーローセクション（clip-pathリビール + パララックス）"
```

---

## Task 12: MitiSection + FeaturesSection コンポーネント

**Files:**
- Create: `src/components/landing/MitiSection.tsx`
- Create: `src/components/landing/FeaturesSection.tsx`

- [ ] **Step 1: MitiSection を作成**

```typescript
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function MitiSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // テキスト: 左からスライドイン
      gsap.fromTo(textRef.current,
        { x: -60, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      // アプリ画面: スクロール連動ズームイン
      gsap.fromTo(mockupRef.current,
        { scale: 0.85, opacity: 0.5 },
        {
          scale: 1, opacity: 1,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 60%',
            end: 'center center',
            scrub: 1,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="min-h-screen flex items-center py-20 px-6 md:px-16">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        {/* テキスト */}
        <div ref={textRef} className="flex-1 opacity-0">
          <div className="text-[11px] text-white/40 tracking-[2px] uppercase mb-3">
            {t('portal.miti.label')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
            {t('portal.miti.heading')}
          </h2>
          <div className="text-sm md:text-base text-white/50 leading-relaxed space-y-1">
            <p>{t('portal.miti.desc_1')}</p>
            <p>{t('portal.miti.desc_2')}</p>
            <p>{t('portal.miti.desc_3')}</p>
          </div>
          <button
            onClick={() => navigate('/miti')}
            className="mt-6 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:scale-105 transition-transform"
          >
            {t('portal.hero.cta_primary')}
          </button>
        </div>

        {/* アプリ画面モック（動画プレースホルダー） */}
        <div ref={mockupRef} className="flex-[1.2] glass-tier1 rounded-2xl p-3 shadow-2xl">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-white/20"></div>
              <div className="text-[10px] text-white/40">LoPo — M9S</div>
            </div>
            {/* タイムライン風のモック行 */}
            {[
              { time: '0:10', name: 'Cross Tail Switch' },
              { time: '0:25', name: 'Quadruple Crossing' },
              { time: '0:42', name: 'Arcane Revelation' },
              { time: '1:05', name: 'Raining Swords' },
            ].map((row) => (
              <div key={row.time} className="flex items-center gap-2 py-1.5 border-t border-white/5">
                <div className="text-[9px] text-white/30 w-8 font-mono">{row.time}</div>
                <div className="text-[10px] text-white/50 flex-1">{row.name}</div>
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-5 h-5 rounded bg-white/[0.06] border border-white/[0.08]"></div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-center text-[9px] text-white/20 mt-3 italic">
              動画プレースホルダー — 後で差し替え
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: FeaturesSection を作成**

```typescript
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FEATURE_KEYS = ['auto_plan', 'fflogs', 'responsive', 'share'] as const;
const FEATURE_ICONS = ['⚡', '📊', '📱', '🔗'];

export function FeaturesSection() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(card,
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.5, ease: 'power2.out',
            delay: i * 0.15,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 65%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 px-6 md:px-16">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURE_KEYS.map((key, i) => (
          <div
            key={key}
            ref={el => { cardsRef.current[i] = el; }}
            className="glass-tier1 rounded-xl p-5 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 opacity-0"
          >
            <div className="text-xl mb-2">{FEATURE_ICONS[i]}</div>
            <h3 className="text-sm font-semibold mb-1">{t(`portal.features.${key}.title`)}</h3>
            <p className="text-[11px] text-white/40 leading-relaxed">{t(`portal.features.${key}.desc`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add src/components/landing/MitiSection.tsx src/components/landing/FeaturesSection.tsx
git commit -m "feat: 軽減プランナー紹介 + 機能ハイライトセクション"
```

---

## Task 13: HousingSection + CTASection + LandingFooter

**Files:**
- Create: `src/components/landing/HousingSection.tsx`
- Create: `src/components/landing/CTASection.tsx`
- Create: `src/components/landing/LandingFooter.tsx`

- [ ] **Step 1: HousingSection を作成**

```typescript
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HousingSection() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(textRef.current,
        { x: 60, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      gsap.fromTo(mockupRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.6, ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 65%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="min-h-screen flex items-center py-20 px-6 md:px-16">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        {/* コンセプトモック（左） */}
        <div ref={mockupRef} className="flex-1 glass-tier1 rounded-2xl p-6 min-h-[200px] flex flex-col items-center justify-center opacity-0">
          <div className="text-4xl mb-3">🏠</div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-7 h-7 rounded bg-white/[0.06] border border-white/[0.08]"></div>
            ))}
          </div>
          <div className="text-[9px] text-white/20 mt-4 italic">
            動画プレースホルダー — 後で差し替え
          </div>
        </div>

        {/* テキスト（右） */}
        <div ref={textRef} className="flex-1 opacity-0">
          <div className="text-[11px] text-white/40 tracking-[2px] uppercase mb-3">
            {t('portal.housing.label')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
            {t('portal.housing.heading')}
          </h2>
          <div className="text-sm md:text-base text-white/50 leading-relaxed space-y-1">
            <p>{t('portal.housing.desc_1')}</p>
            <p>{t('portal.housing.desc_2')}</p>
          </div>
          <div className="mt-4 inline-block px-4 py-2 border border-white/12 rounded-md text-xs text-white/40 animate-pulse">
            {t('portal.housing.badge')}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: CTASection を作成**

```typescript
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function CTASection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="py-32 px-6 flex flex-col items-center text-center">
      <h2 className="text-3xl md:text-4xl font-bold mb-3">
        {t('portal.cta.heading')}
      </h2>
      <p className="text-sm text-white/40 mb-8">
        {t('portal.cta.sub')}
      </p>
      <button
        onClick={() => navigate('/miti')}
        className="px-8 py-3.5 bg-white text-black rounded-lg text-sm font-bold hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all"
      >
        {t('portal.cta.button')}
      </button>
      <div className="mt-5 text-xs text-white/25">
        ☕ <a href="https://ko-fi.com/lopoly" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40 transition-colors">
          {t('portal.cta.kofi')}
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: LandingFooter を作成**

```typescript
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-white/[0.06] py-6 px-6 md:px-16">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-[11px] text-white/30 text-center md:text-left">
          <div>{t('portal.footer.copyright')}</div>
          <div className="text-[10px] mt-0.5">{t('portal.footer.disclaimer')}</div>
        </div>
        <div className="flex gap-4 text-[11px] text-white/40">
          <Link to="/privacy" className="hover:text-white/60 transition-colors">
            {t('portal.footer.privacy')}
          </Link>
          <Link to="/terms" className="hover:text-white/60 transition-colors">
            {t('portal.footer.terms')}
          </Link>
          <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">
            𝕏
          </a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

- [ ] **Step 5: コミット**

```bash
git add src/components/landing/HousingSection.tsx src/components/landing/CTASection.tsx src/components/landing/LandingFooter.tsx
git commit -m "feat: ハウジング予告 + CTA + フッターセクション"
```

---

## Task 14: LandingPage 統合 + ルーティング変更

**Files:**
- Create: `src/components/landing/LandingPage.tsx`
- Modify: `src/App.tsx`
- Delete: `src/components/PortalPage.tsx`

- [ ] **Step 1: LandingPage を作成**

```typescript
import { useState, useCallback } from 'react';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { Preloader } from './Preloader';
import { HeroSection } from './HeroSection';
import { MitiSection } from './MitiSection';
import { FeaturesSection } from './FeaturesSection';
import { HousingSection } from './HousingSection';
import { CTASection } from './CTASection';
import { LandingFooter } from './LandingFooter';
import ParticleBackground from '../ParticleBackground';

export function LandingPage() {
  const [preloaderDone, setPreloaderDone] = useState(
    () => !!sessionStorage.getItem('lopo-visited')
  );

  useSmoothScroll();

  const handlePreloaderComplete = useCallback(() => {
    setPreloaderDone(true);
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* WebGL背景 */}
      <ParticleBackground />

      {/* プリローダー */}
      {!preloaderDone && <Preloader onComplete={handlePreloaderComplete} />}

      {/* メインコンテンツ */}
      <main className="relative z-10">
        <HeroSection />
        <MitiSection />
        <FeaturesSection />
        <HousingSection />
        <CTASection />
        <LandingFooter />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: App.tsx のルーティングを変更**

```tsx
// 変更前:
import PortalPage from './components/PortalPage';
// ...
<Route path="/" element={<PortalPage />} />

// 変更後:
import { LandingPage } from './components/landing/LandingPage';
// ...
<Route path="/" element={<LandingPage />} />
```

PortalPageのimportを削除。

- [ ] **Step 3: PortalPage.tsx を削除**

```bash
git rm src/components/PortalPage.tsx
```

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功。PortalPageへの参照がすべてLandingPageに置き換わっていること。

- [ ] **Step 5: dev serverで統合テスト**

```bash
npm run dev
```

確認項目:
1. `/` でプリローダー → ヒーロー → スクロールで全セクション表示
2. CTAボタンで `/miti` に遷移
3. `/miti` で軽減プランナーが正常に動作（既存機能に影響なし）
4. `/share/:shareId` が正常動作
5. ダーク/ライトテーマ切替
6. 日本語/英語切替
7. モバイルレスポンシブ

- [ ] **Step 6: コミット**

```bash
git add src/components/landing/LandingPage.tsx src/App.tsx
git commit -m "feat: ランディングページ統合 + ルーティング切替"
```

---

## Task 15: 最終確認 + TODO更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: 全体ビルド + Lint**

```bash
npm run build
```

- [ ] **Step 2: 全画面目視テスト**

- [ ] `/` : プリローダー→ヒーロー→全セクション→フッター
- [ ] `/` 2回目アクセス: プリローダースキップ
- [ ] スクロール: Lenisスムーズスクロール + パララックス + セクション出現アニメーション
- [ ] マウス: WebGL背景がマウスに追従
- [ ] `/miti` : ヘッダー/サイドバー/ツールチップにグラスモーフィズム
- [ ] モバイル: レスポンシブ表示
- [ ] ライトテーマ: 全体が正しく反転
- [ ] 英語モード: テキストが正しく切り替わる

- [ ] **Step 3: TODO.md更新**

「公開前マスト」セクションのトップページデザインとUI全体デザイン見直しを完了に移動。

- [ ] **Step 4: 最終コミット**

```bash
git add docs/TODO.md
git commit -m "docs: トップページ + グラスモーフィズム完了をTODOに反映"
```
