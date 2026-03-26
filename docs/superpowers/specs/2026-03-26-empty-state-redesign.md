# 空パネル（プラン未選択時）リデザイン仕様書

## 概要
プラン未選択時に表示される空パネルを、CE-1 V9スタイル（ゴーストテーブル背景 + 中央SVGイラスト + 重力落下アニメーション）にリデザインする。PC版・スマホ版で文言とレイアウトを分ける。

## 表示条件
`!currentPlanId` の場合に表示（現行と同じ）

## デザイン: CE-1 V9（ゴースト + 重力落下）

### 構造
1. **背景: ゴーストテーブル** — 実際のタイムラインを暗示する薄い罫線グリッド（opacity極低）
2. **中央: SVGイラスト** — タイムライン風の枠線が手描き風に描画される
3. **中央: テキスト** — 1行のみ（サブテキストなし）

### アニメーション（全てCSSのみ、transform+opacityでGPU合成、60fps保証）
1. ゴーストテーブルが一括フェードイン（0.5秒）
2. SVGの枠線・罫線がstroke-dashoffsetで順番に描画（0.5秒〜1.1秒）
3. 軽減バー風ブロックが**上から落下してバウンス**（cubic-bezier(.34,1.56,.64,1)）（1.4秒〜2.0秒）
4. テキストがfadeUp（2.4秒〜）
5. 合計約3秒で完了、ループなし

### 文言（i18nキー経由、ハードコーディング禁止）

| | 日本語 | 英語 |
|---|---|---|
| **PC** | サイドバーからコンテンツを選択 | Select content from the sidebar |
| **スマホ** | メニューからコンテンツを選択 | Select content from the menu |

i18nキー案:
- `app.empty_state_pc` — PC版テキスト
- `app.empty_state_mobile` — スマホ版テキスト

（既存の `app.empty_state_title` / `app.empty_state_desc` は削除）

### PC版レイアウト
- 現行の `Layout.tsx` 内 `!currentPlanId` ブロックを置き換え
- ゴーストテーブル: position absolute、inset 0、ヘッダー行 + 12行のグリッド
- 中央SVG: 140x95px、タイムライン風の枠+横罫線+軽減バーブロック3つ
- テキスト: SVGの下、font-size 0.82rem、color #999

### スマホ版レイアウト
- `isMobile` 判定で文言を切り替え
- ゴーストテーブルのカラム数を減らす（Time, Attack, MT, STの4列）
- SVGサイズを小さく（120x80px程度）
- テキスト: font-size 0.75rem

## 変更対象ファイル
- `src/components/Layout.tsx` — 空パネルのJSX + CSSを置き換え
- `public/locales/ja/translation.json` — i18nキー追加・既存キー削除
- `public/locales/en/translation.json` — 同上

## 削除するもの
- 現行のタグ型吹き出し（motion.div、左右揺れアニメーション）
- `app.empty_state_title` / `app.empty_state_desc` のi18nキー

## 色のルール
- 白黒のみ（CLAUDE.mdルール準拠）
- ゴースト罫線: rgba(255,255,255, 0.03〜0.06)
- SVG stroke: #444〜#555
- ブロック fill: #444〜#555
- テキスト: #999（PC）、#888（スマホ）
