---
paths:
  - "src/components/**"
  - "src/index.css"
  - "src/pages/**"
---

# LoPo DESIGN.md

UIを作成・修正する際、このファイルに従うこと。
禁止事項は `ui-design.md` を参照。

---

## 1. デザイン哲学

- **黒いキャンバスに白い光が浮かぶ** — ゲームHUDの精密さと戦略ツールの信頼感
- **白黒のみ** — アクセントカラーは機能色（青=進む/OK、赤=危険/削除、黄=警告）のみ
- **情報密度が高い** — FF14の軽減プランを一覧するため、コンパクトだが読みやすく
- **glassmorphism** — 半透明+ブラーで奥行きを表現、ただし控えめに

---

## 2. カラーパレット

### ダークテーマ（デフォルト）

| 役割 | CSS変数 | 値 | 用途 |
|------|---------|-----|------|
| 背景(主) | `--color-bg-primary` | `#0F0F10` | ページ全体の背景 |
| 背景(副) | `--color-bg-secondary` | `#0F0F10` | セクション背景 |
| 背景(三次) | `--color-bg-tertiary` | `#161618` | カード・パネル内部 |
| テキスト(主) | `--color-text-primary` | `#F0F0F0` | 本文、見出し |
| テキスト(副) | `--color-text-secondary` | `#d4d4d8` | 補足テキスト |
| テキスト(ミュート) | `--color-text-muted` | `#a1a1aa` | ラベル、プレースホルダ |
| ボーダー | `--color-border` | `rgba(255,255,255,0.10)` | 区切り線、枠線 |

### ライトテーマ

| 役割 | CSS変数 | 値 |
|------|---------|-----|
| 背景(主) | `--color-bg-primary` | `#FAFAFA` |
| 背景(三次) | `--color-bg-tertiary` | `#ffffff` |
| テキスト(主) | `--color-text-primary` | `#171717` |
| テキスト(副) | `--color-text-secondary` | `#27272a` |
| テキスト(ミュート) | `--color-text-muted` | `#52525b` |
| ボーダー | `--color-border` | `rgba(0,0,0,0.10)` |

### 機能色（両テーマ共通の役割）

| 役割 | ダーク | ライト | 用途 |
|------|--------|--------|------|
| 青(進む/OK) | `#3b82f6` | `#2563eb` | 保存ボタン、リンク、適用 |
| 赤(危険/削除) | `#ef4444` | `#dc2626` | 削除ボタン、エラー |
| 黄(警告) | `#f59e0b` | `#d97706` | 警告バナー、注意表示 |

各色に `-hover`、`-dim`（背景用10%透過）、`-border`（枠用25%透過）バリエーションあり。

### カラー改善メモ（参考）

純黒 `#000000` と純白 `#ffffff` の代替候補。将来的なテーマ改善時に検討する。

**ダーク背景の代替:**
- `#0D1117` (GitHub) — 青みがかった深黒
- `#0F0F10` (Linear) — ほぼ純黒だが微妙に柔らかい
- `#121212` (Material Design) — 標準的なダークUI
- `#151515` (Raycast) — ニュートラルな深みのあるグレー
- `#171717` (Vercel) — モダンで人気の高い選択肢
- `#181818` (YouTube) — 視認性重視の暗色

**ライト背景の代替:**
- `#FAFAFA` — モダンクラシック、最も一般的な代替
- `#F9FAFB` — SaaS系で多用される微グレー
- `#FDFDFD` — 純白に最も近いソフトホワイト
- `#F5F5F5` — ライトグレー（現在のbg-tertiaryで使用中）

---

## 3. タイポグラフィ

| 属性 | 値 |
|------|-----|
| フォント | `Rajdhani`, `M PLUS 1`, system-ui, sans-serif |
| 基本ウェイト | 500 |
| レタースペーシング | 0.02em |
| 行間 | 1.6 |

### サイズ階層

| トークン | px | 用途 |
|---------|-----|------|
| `--font-size-3xs` | 6px | 極小注記 |
| `--font-size-2xs` | 7px | バッジ内テキスト |
| `--font-size-xs` | 8px | テーブルセル密集時 |
| `--font-size-sm` | 9px | 補足ラベル |
| `--font-size-base` | 10px | 本文（タイムラインテーブル） |
| `--font-size-md` | 11px | やや強調するテキスト |
| `--font-size-lg` | 12px | ボタンテキスト、入力 |
| `--font-size-xl` | 13px | サブヘッダー |
| `--font-size-2xl` | 14px | 見出し小 |
| `--font-size-3xl` | 18px | 見出し中 |
| `--font-size-4xl` | 20px | 見出し大 |
| `--font-size-5xl` | 26px | ページタイトル |
| `--font-size-6xl` | 36px | ランディングページ |

---

## 4. コンポーネントスタイル

### ボタン

| 種類 | スタイル |
|------|---------|
| プライマリ(青) | `bg-app-blue text-white hover:bg-app-blue-hover rounded-md px-4 py-1.5 font-semibold uppercase` |
| デストラクティブ(赤) | `text-app-red hover:text-app-red-hover hover:bg-app-red-dim rounded-md` |
| ゴースト(白枠) | `text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text rounded-lg` |
| アクティブ | `active:scale-95` または `active:scale-90` |

### カード / パネル

- 背景: `bg-app-surface` または `bg-app-surface2`
- ボーダー: `border border-app-border` または `ring-1 ring-app-border`
- 角丸: `rounded-xl`（モーダル）, `rounded-lg`（カード）, `rounded-md`（小要素）

### モーダル / ポップオーバー

- glass-tier3 を使用: `glass-tier3` クラス
- shadow: `--glass-tier3-shadow` (ダーク: `0 12px 48px rgba(0,0,0,0.4)`)
- 上辺ハイライト: `--glass-tier3-inset` (inset 0 1px 0 rgba(255,255,255,0.1))
- スマホ: 下からスライドイン、`rounded-t-2xl rounded-b-none`
- PC: 中央またはクリック位置に表示

### 入力フィールド

```
bg-app-surface2 border border-app-border rounded-lg p-2.5
text-app-2xl text-app-text placeholder-app-text-muted
focus:border-app-text focus:bg-app-surface focus:outline-none
```

---

## 5. レイアウト

| 属性 | 値 |
|------|-----|
| ブレイクポイント | `md:` (768px) でスマホ/PC切替 |
| スマホ | フルブリード、下部スライドインモーダル |
| PC | サイドバー + メインエリア、固定幅テーブル |
| スペーシング | Tailwindスケール (`gap-2`, `p-4`, `space-y-6` 等) |

---

## 6. glassmorphism（3層システム）

| 層 | 用途 | blur | border透過 |
|-----|------|------|-----------|
| tier1 | 背景パネル | 16px | 8% |
| tier2 | ヘッダー、サイドバー | 28px | 12% |
| tier3 | モーダル、ポップオーバー | 12px | 18% |

上の層ほどblurが強く、ボーダーが濃い。

---

## 7. トランジション・アニメーション

- ホバー: `transition-colors` または `transition-all duration-200`
- モーダル表示: framer-motion `{ opacity: 0, scale: 0.95, y: 10 }` → `{ opacity: 1, scale: 1, y: 0 }`
- スマホモーダル: `{ y: '100%' }` → `{ y: 0 }`
- ボタン押下: `active:scale-95`
- 時間: `duration-100`（素早い）〜 `duration-200`（通常）

---

## 8. レスポンシブ

| 要素 | スマホ (<768px) | PC (≥768px) |
|------|----------------|-------------|
| フェーズ列 | 24px幅、フェーズなし時非表示 | 60px幅、常時表示 |
| ラベル列 | フェーズ位置に表示 | 50px固定 |
| 時間列 | 36px幅 | 60px幅 |
| モーダル | 下からスライドイン、全幅 | クリック位置に表示、400px幅 |
| サイドバー | オーバーレイ、スワイプで閉じ | 固定幅 |
