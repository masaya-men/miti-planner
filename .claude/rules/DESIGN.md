---
paths:
  - "src/components/**"
  - "src/index.css"
  - "src/pages/**"
---

# LoPo デザイン核心ルール

UI を作成・修正する際、 以下の核心ルールに従うこと。
**詳細スペック (カラー値・フォントサイズ・コンポーネント別スタイル) は [docs/DESIGN.md](../../docs/DESIGN.md) を参照**。
禁止事項は [ui-design.md](./ui-design.md) を参照。

---

## デザイン哲学 (毎回意識する)

- **黒いキャンバスに白い光が浮かぶ** — ゲーム HUD の精密さと戦略ツールの信頼感
- **白黒のみ** — アクセントカラーは機能色 (青=進む/OK、 赤=危険/削除、 黄=警告) のみ
- **情報密度が高い** — FF14 軽減プランを一覧するため、 コンパクトだが読みやすく
- **glassmorphism** — 半透明 + ブラーで奥行きを表現、 ただし控えめに

## トークン経由を徹底

- 色は CSS 変数 (`--color-*`) 経由、 ハードコード禁止
- font-size は `--font-size-*` トークン経由、 px 直書き禁止
- glassmorphism は `glass-tier1/tier2/tier3` クラス経由
- 詳細値は [docs/DESIGN.md](../../docs/DESIGN.md)

## 即時に守るアニメーション規約

- ホバー: `transition-colors` または `transition-all duration-200`
- ボタン押下: `active:scale-95`
- モーダル表示: framer-motion で `{ opacity, scale, y }` → 通常状態へ
- 時間: 100ms (素早い) 〜 200ms (通常)

## レスポンシブ基本

- ブレイクポイント `md:` (768px) でスマホ / PC 切替
- スマホはフルブリード、 PC はサイドバー + 固定幅テーブル
- 詳細な列幅・モーダルサイズは [docs/DESIGN.md](../../docs/DESIGN.md) を参照
