# トップページ + UI全体デザイン リデザイン仕様書

## 概要

LoPoのランディングページを、Active Theory / Igloo Inc 級の超インタラクティブなページに作り替える。同時に、アプリ全体のグラスモーフィズムを3層階層システムで復活させる。

## スコープ

1. **トップページ（PortalPage）の完全リデザイン** — 6セクション + プリローダー
2. **UI全体のグラスモーフィズム復活** — 3層階層システム（Tier 1/2/3）
3. **新規ライブラリ導入** — GSAP (ScrollTrigger) + Lenis

---

## Part 1: トップページ

### 技術スタック

- **GSAP** (ScrollTrigger, Timeline) — スクロール連動アニメーション
- **Lenis** — スムーズスクロール（GSAPとの公式統合）
- **Three.js** — 既存のParticleBackground.tsxを拡張（マウス追従追加）
- **CSS clip-path** — テキストリビール演出
- 既存の **framer-motion** と共存（トップページ以外はframer-motionのまま）

### デザイン方針

- **ダーク基調** — 黒背景 + 白テキスト + 大胆なタイポグラフィ
- **ナラティブ型スクロール** — スクロールでストーリーが展開する没入型
- **WebGLパーティクル背景** — マウス追従の微細なインタラクション
- **白黒ベース** — CLAUDE.mdのルール準拠。アクセントカラーは使わない
- **LoPoは総合ツールポータル** — 軽減プランナー + ハウジングツアープランナー（Coming Soon）

### プリローダー（初回訪問のみ）

- **表示条件:** `sessionStorage` に訪問フラグがない場合のみ表示
- **演出（約2.5秒）:**
  1. 円形プログレスインジケーター（SVG stroke-dashoffset）— 0%→100%
  2. 「LoPo」ロゴ出現（fade + scale）
  3. clip-path: circle() で中央から本体ページへ展開
- **2回目以降:** プリローダーをスキップ、ヒーローセクションから直接表示

### セクション構成

#### 01 — ヒーロー（ファーストビュー）

- **レイアウト:** フルスクリーン（100vh）、中央揃え
- **コンテンツ:**
  - 「FF14 Tool Portal」サブタイトル（letter-spacing: 4px、uppercase）
  - 「LoPo」メインロゴ（超大型タイポグラフィ）
  - キャッチコピー（1〜2行、後で文言調整）
  - CTAボタン2つ:「軽減プランナーを使う」（/miti へ）+「詳しく見る ↓」（スクロール）
- **背景:** WebGLパーティクル（既存ParticleBackground.tsx拡張）
  - マウス座標に追従してパーティクルが微妙に動く
  - スクロールでパーティクルの密度/速度が変化
- **アニメーション:**
  - テキスト: clip-path: inset() リビールで1行ずつ出現（GSAP Timeline、stagger 0.2s）
  - CTAボタン: fadeUp（delay後）
  - スクロール連動: テキストがパララックスでゆっくり上に消える
  - スクロールヒント: 「SCROLL」+ 縦線（opacity pulse）

#### 02 — 軽減プランナー紹介

- **レイアウト:** 左テキスト + 右アプリ画面（横並び）
- **コンテンツ:**
  - 「01 — Mitigation Planner」セクションラベル
  - メインコピー（後で文言調整）
  - 機能の箇条書き（3行程度）
  - 右側: アプリ画面のデモ動画プレースホルダー
    - 初期実装: アプリUIのモック画面（静的）
    - 素材準備後: 実際の操作動画に差し替え
- **アニメーション:**
  - テキスト: 左からスライドイン（GSAP ScrollTrigger）
  - アプリ画面: scale(0.85) → scale(1) にズームイン（ScrollTrigger scrub）
  - アプリ画面にドロップシャドウ（浮遊感）

#### 03 — 機能ハイライト（4つ）

- **レイアウト:** 2x2グリッド（モバイルは1列）
- **機能カード:**
  1. オートプラン — SA法による全体最適化
  2. FFLogsインポート — ログから自動生成
  3. どこでも使える — PC/スマホ/タブレット対応
  4. ワンクリック共有 — URLで共有
- **各カードの構造:** アイコン + タイトル + 説明（2行）
- **アイコン:** カスタムSVGまたは絵文字（白黒）
- **アニメーション:**
  - カード出現: fadeUp + stagger(0.15s)で左上→右上→左下→右下の順
  - ホバー: translateY(-4px) + border明るく（CSS transition）

#### 04 — ハウジングツアープランナー（Coming Soon）

- **レイアウト:** 左コンセプトモック + 右テキスト（02と左右反転）
- **コンテンツ:**
  - 「02 — Housing Tour Planner」セクションラベル
  - メインコピー（後で文言調整）
  - 説明テキスト（2行程度）
  - 「Coming Soon」バッジ
  - 左側: コンセプトモック / 動画プレースホルダー
    - 素材準備後: ゲーム内ハウジングツアー映像 + アプリ操作画面に差し替え
- **アニメーション:**
  - テキスト: 右からスライドイン
  - コンセプトモック: fadeUp
  - Coming Soonバッジ: opacity pulse（呼吸アニメーション）

#### 05 — CTA（行動喚起）

- **レイアウト:** 中央揃え、シンプル
- **コンテンツ:**
  - メインコピー（後で文言調整）
  - サブテキスト:「完全無料。アカウント登録なしですぐ使えます。」
  - CTAボタン:「軽減プランナーを使う」→ /miti
- **アニメーション:**
  - テキスト + ボタン: fadeUp
  - ボタンホバー: scale(1.05) + glow（box-shadow: 0 0 20px rgba(255,255,255,0.15)）

#### 06 — フッター

- **レイアウト:** 横並び（左: 権利表記、右: リンク）
- **コンテンツ:**
  - SE権利表記（必須）
  - 免責事項
  - プライバシーポリシー / 利用規約 / X(Twitter) リンク
- **border-top:** rgba(255,255,255, 0.06)

### モバイル対応

- セクション02/04: 横並び → 縦積み（テキスト上、モック下）
- セクション03: 2x2 → 1列
- ヒーロー: フォントサイズ縮小、CTAボタン縦積み
- カスタムカーソル: モバイルでは無効化
- WebGL: モバイルではパーティクル数を削減（パフォーマンス）

### i18n

- 全テキストはi18nキー経由（ハードコーディング禁止）
- 英語モードで表示が崩れないか確認
- キー命名規則: `portal.hero.title`, `portal.miti.heading`, `portal.housing.heading` 等

---

## Part 2: グラスモーフィズム 3層階層システム

### 概要

要素の「階層（前面/背面）」に応じてグラスの強さを3段階に分け、奥行きを表現する。blur値は強めに設定し、ひと目でガラスだと認識できるようにする。

### Tier 3 — がっつりグラス（最前面）

**適用対象:** ヘッダー / モーダル / サイドバー / 確認ダイアログ

| プロパティ | ダークテーマ | ライトテーマ |
|-----------|------------|------------|
| backdrop-filter | blur(40px) | blur(40px) |
| background | rgba(255,255,255, 0.14) | rgba(255,255,255, 0.70) |
| border | 1px solid rgba(255,255,255, 0.18) | 1px solid rgba(0,0,0, 0.08) |
| box-shadow | 0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1) | 0 12px 48px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5) |
| border-radius | 12-16px | 12-16px |

### Tier 2 — しっかりグラス（一時的なUI）

**適用対象:** ツールチップ / トースト / ボトムシート / ドロップダウン

| プロパティ | ダークテーマ | ライトテーマ |
|-----------|------------|------------|
| backdrop-filter | blur(28px) | blur(28px) |
| background | rgba(255,255,255, 0.08) | rgba(255,255,255, 0.60) |
| border | 1px solid rgba(255,255,255, 0.12) | 1px solid rgba(0,0,0, 0.06) |
| box-shadow | 0 8px 32px rgba(0,0,0,0.3) | 0 8px 32px rgba(0,0,0,0.06) |
| border-radius | 8-12px | 8-12px |

### Tier 1 — さりげないグラス（メインコンテンツ）

**適用対象:** タイムラインパネル / コンテンツパネル / 機能カード

| プロパティ | ダークテーマ | ライトテーマ |
|-----------|------------|------------|
| backdrop-filter | blur(16px) | blur(16px) |
| background | rgba(255,255,255, 0.04) | rgba(255,255,255, 0.45) |
| border | 1px solid rgba(255,255,255, 0.08) | 1px solid rgba(0,0,0, 0.05) |
| box-shadow | なし | なし |
| border-radius | 8-10px | 8-10px |

### 実装方法

CSS変数で一元管理し、Tailwindユーティリティクラスから参照する。

```css
/* index.css — ダークテーマ */
:root, .theme-dark {
  --glass-tier3-bg: rgba(255,255,255, 0.14);
  --glass-tier3-blur: 40px;
  --glass-tier3-border: rgba(255,255,255, 0.18);
  --glass-tier3-shadow: 0 12px 48px rgba(0,0,0,0.4);
  --glass-tier3-inset: inset 0 1px 0 rgba(255,255,255,0.1);

  --glass-tier2-bg: rgba(255,255,255, 0.08);
  --glass-tier2-blur: 28px;
  --glass-tier2-border: rgba(255,255,255, 0.12);
  --glass-tier2-shadow: 0 8px 32px rgba(0,0,0,0.3);

  --glass-tier1-bg: rgba(255,255,255, 0.04);
  --glass-tier1-blur: 16px;
  --glass-tier1-border: rgba(255,255,255, 0.08);
}

/* ライトテーマ */
.theme-light {
  --glass-tier3-bg: rgba(255,255,255, 0.70);
  --glass-tier3-border: rgba(0,0,0, 0.08);
  --glass-tier3-shadow: 0 12px 48px rgba(0,0,0,0.08);
  --glass-tier3-inset: inset 0 1px 0 rgba(255,255,255,0.5);

  --glass-tier2-bg: rgba(255,255,255, 0.60);
  --glass-tier2-border: rgba(0,0,0, 0.06);
  --glass-tier2-shadow: 0 8px 32px rgba(0,0,0,0.06);

  --glass-tier1-bg: rgba(255,255,255, 0.45);
  --glass-tier1-border: rgba(0,0,0, 0.05);
}
```

CSSユーティリティクラス:
```css
.glass-tier3 {
  background: var(--glass-tier3-bg);
  backdrop-filter: blur(var(--glass-tier3-blur));
  border: 1px solid var(--glass-tier3-border);
  box-shadow: var(--glass-tier3-shadow), var(--glass-tier3-inset);
}
.glass-tier2 {
  background: var(--glass-tier2-bg);
  backdrop-filter: blur(var(--glass-tier2-blur));
  border: 1px solid var(--glass-tier2-border);
  box-shadow: var(--glass-tier2-shadow);
}
.glass-tier1 {
  background: var(--glass-tier1-bg);
  backdrop-filter: blur(var(--glass-tier1-blur));
  border: 1px solid var(--glass-tier1-border);
}
```

### 適用対象マッピング

| コンポーネント | Tier | ファイル |
|--------------|------|---------|
| ConsolidatedHeader | 3 | src/components/ConsolidatedHeader.tsx |
| Sidebar | 3 | src/components/Sidebar.tsx |
| モーダル全般 | 3 | 各モーダルコンポーネント |
| ConfirmDialog | 3 | src/components/ui/ConfirmDialog.tsx |
| Tooltip | 2 | src/components/ui/Tooltip.tsx |
| Toast | 2 | src/components/Toast.tsx |
| MobileBottomSheet | 2 | src/components/MobileBottomSheet.tsx |
| Timeline（メインパネル） | 1 | src/components/Timeline.tsx |
| 空パネル | 1 | src/components/Layout.tsx |
| 機能カード（トップページ） | 1 | src/components/PortalPage.tsx |

### 既存のglass-panel置き換え

現在の`.glass-panel`（ボーダーのみ）を削除し、上記のTierクラスに置き換える。`bg-glass-header` / `bg-glass-panel` / `bg-glass-card` 等の既存CSS変数も新Tier変数に統合する。

---

## Part 3: 変更対象ファイル

### 新規作成
- `src/components/landing/LandingPage.tsx` — トップページ本体
- `src/components/landing/Preloader.tsx` — プリローダー
- `src/components/landing/HeroSection.tsx` — ヒーローセクション
- `src/components/landing/MitiSection.tsx` — 軽減プランナー紹介
- `src/components/landing/FeaturesSection.tsx` — 機能ハイライト
- `src/components/landing/HousingSection.tsx` — ハウジングツアー予告
- `src/components/landing/CTASection.tsx` — CTA
- `src/components/landing/Footer.tsx` — フッター
- `src/hooks/useSmoothScroll.ts` — Lenis + GSAP ScrollTrigger統合

### 変更
- `src/App.tsx` — ルーティング変更（PortalPage → LandingPage）
- `src/index.css` — glass-tier1/2/3 変数追加、既存glass変数削除
- `src/components/ConsolidatedHeader.tsx` — glass-tier3 適用
- `src/components/Sidebar.tsx` — glass-tier3 適用
- `src/components/ui/Tooltip.tsx` — glass-tier2 適用
- `src/components/Toast.tsx` — glass-tier2 適用
- `src/components/MobileBottomSheet.tsx` — glass-tier2 適用
- `src/components/Timeline.tsx` — glass-tier1 適用
- `src/components/Layout.tsx` — glass-tier1 適用（空パネル）
- `src/components/ParticleBackground.tsx` — マウス追従追加
- `public/locales/ja/translation.json` — portal.*キー追加
- `public/locales/en/translation.json` — 同上

### 削除
- `src/components/PortalPage.tsx` — LandingPageに置き換え

### 新規依存パッケージ
- `gsap` — アニメーションエンジン
- `lenis` — スムーズスクロール

---

## 色のルール（CLAUDE.md準拠）

- トップページ: **白黒のみ**。アクセントカラーは使わない
- グラスモーフィズム: 白黒の透過のみ
- 既存のアクセントカラー（Timeline軽減色、ConfirmDialog赤/琥珀等）はこのタスクのスコープ外。UI全体デザイン整え後に別途対応

## 文言について

全セクションの文言（キャッチコピー、説明文）は仮置き。i18nキーの構造だけ先に作り、文言はユーザーと別途調整する。
