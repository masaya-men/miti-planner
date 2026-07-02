---
paths:
  - "src/components/housing/**"
  - "src/styles/housing.css"
  - "src/__tests__/housing/**"
  - "src/pages/housing/**"
---

# ハウジング画面 独自デザインルール (`/housing` 配下すべて)

> 本ルールは **`/housing` 配下全コンポーネント (workspace / register / モーダル / フォーム等) 専用**。 LoPo 既存 UI ルール ([ui-design.md](./ui-design.md) / [DESIGN.md](./DESIGN.md)) の白黒のみ・Inter 禁止・honey 色禁止・glassmorphism 控えめ等の制約は本画面に**一切適用されない**。
>
> **重要**: 以前は `workspace/**` のみ対象だったが、 ユーザーから「ハウジング配下は全部独立トンマナ」 と再三明言されたため、 2026-05-19 に対象範囲を `src/components/housing/**` 全体に拡大。 register/ や HousingDuplicateWarningDialog 等の旧 LoPo ルール準拠だった部分も、 今後はハウジング独自トンマナで作る。

## 正典 (Source of Truth)

**モックアップ**: `docs/.private/housing-tour-mockup/index.html` (997 行、 day/night 動画 + 完全な panel chrome 実装)
**スクリーンショット**: 同フォルダの `_screenshot-light.png` / `_screenshot-dark.png`

UI 修正時は必ずモックアップを開いて該当箇所の CSS/HTML を確認してから書く。 既存実装だけ見て改変するのは禁止 (モックアップが基準)。

## 採用デザイン規約

- **色**: ハニーゴールド (`#ffc987` → `#ffb35a`) と キャンドル (`#ffe2b3`) を **ブランドアクセント**として正式採用
  - ロゴマーク・テーマトグル ON 状態・アクセント文字・honey dot 等で利用
  - 機能色 (青/赤/黄) との競合なし
- **フォント**: `"Inter", "Helvetica Neue", -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic UI", sans-serif` を採用 (Inter 禁止ルール対象外)
- **トーン**: 動画背景 + ガラスパネル + ハニーゴールドの灯火 = ファンタジー世界観
- **glassmorphism**: 強めに採用 OK (mockup の panel chrome は ring border + 4 corner highlights + top sheen + 4 層 box-shadow + SVG displacement filter)。 **ただし再構築ページ (探す/お気に入り/新シェル) は下記「質感A案」でフラット化済み** — 重ガラスは適用しない。

## 質感A案 (再構築ページの正典・2026-07-01 確定 / 2026-07-02 補強)

2026-07-01 の全面再構築で、 **探す (BrowsePage) / お気に入り (FavoritesPage) / 新シェル**等の再構築ページは「質感A案」を採用。 モックアップの重ガラス (液体ガラス湾曲 / SVG displacement filter / 4 corner highlight) は**これらのページでは撤去**し、 落ち着いた濃紺フラット面へ寄せた (参考UI 準拠)。 モックアップは tour / workspace 世界観の正典として残るが、 **再構築ページの panel chrome は質感A案が優先**。

- **パネル = 濃紺フラット**: `--housing-panel-bg` (= `rgba(17,23,37,0.56)`) / `--housing-panel-bg-solid`。 動画背景は veil で後退させ、 パネルは半不透明の濃紺で「本文テキストが読める面」に。 ガラスは「縁 + わずかな透け」程度に留める (旧 `rgba(255,255,255,0.04)` の透けすぎを是正)。
- **2アクセント体系 (厳守)**:
  - **ハニー = 主アクション**: ツアー開始 / 公開する / ロゴ / アクティブタブ (`--housing-honey` 系)
  - **青 = 選択・進行・リンク**: カードのチェック選択 / 進捗リング / ステップ番号 (`--housing-aether` = `#00BFFF`。 透過は `--housing-aether-medium` / `--housing-aether-border`)
  - 副アクション「選択だけ追加」 は**ハニー据え置き**で決着 (2026-07-02 実画面ゲート)
- **AI 感の払拭**: 装飾 999px ピル / honey gradient / 過剰 glow / **色付き alert 箱 (色地 + 左アクセント縦線)** を避ける。 補足・ヒント文は箱にせず、 ヘアライン区切り (`border-top: 1px solid var(--housing-divider)`) + 装飾なしのグレー文字 (`var(--housing-text-mute)`) の静かな注記に。 → memory `feedback_housing_no_ai_pills.md`
- **余白リズム**: 縦積み UI (ツールバー / 一括バー / カード) は要素間に一定の余白を。 各要素の `padding-bottom` で間隔を作ると最後→次が 0px 密着になり素人っぽい → **コンテナに `gap` を付けて統一リズム**にする (例: `.housing-listing-grid-wrap { gap: 12px }`)。 → memory `feedback_housing_whitespace_rhythm.md`
- **実画面検証**: 見た目に関わる変更は開発者の実画面 (CSS `1489x679` / DPR `2.58`) のスクショで目視確認してから完了宣言する。

## トークン経由を徹底 (ハードコード 100% 禁止 — 例外ほぼゼロ)

**ユーザー確定方針 (2026-05-18)**: ハードコードは「ほんとのほんとの例外」 以外**絶対禁止**。 今後のテーマ追加 (3 つ目以降のテーマ / 色変更要望 / ブランディング刷新) を考えると、 1 つでもハードコードがあるとそこが取り残されて UI が壊れる。 token 経由なら 1 箇所書き換えれば全箇所反映。

### 必ず token 経由にするもの

- **色** (rgb / rgba / hex の literal): `style={{ color: '#fff' }}` や `style={{ border: '1px solid rgba(255,255,255,0.22)' }}` のような直書きは **すべて禁止**
- **font-size / line-height** の px 直書き
- **寸法系**: パネル幅 / ヘッダー高さ / 角丸 / 余白の固定値直書き
- **影** (box-shadow / text-shadow の literal)

### 「ほんとの例外」 の判定

- `aspect-video` / `aspect-square` 等の **Tailwind 純粋ユーティリティクラス** (= 比率や挙動を表す class) は OK。 ただし `text-xs` `text-sm` のような **font-size を rem で固定する class** は housing では避けて、 housing.css の token クラス経由が望ましい
- 1 箇所限定のレイアウト微調整 (`gap-2` 等) は許容、 ただしテーマで変わる値ではないこと
- 不明なら token を新規作成する選択肢を優先

### 新規 token の追加場所

`src/styles/housing.css` の `.housing-workspace` ブロック (上部) に集約。 個別コンポーネントの `<style>` や `style={{}}` で**新規定義しない**。 必要になったら housing.css に追加 → token 経由で参照。

### 実装時の自己レビュー手順

実装の最後に grep で確認 (各コンポーネント新規追加時):
```
rgb\(   /   rgba\(   /   #[0-9a-f]{3,8}   /   px;
```
これらが当該ファイルに残っていたら token 化を必ず検討。 残してよいのは housing.css の中だけ。

## 既存共通ルール (引き続き適用)

- **i18n**: 文字列は必ず i18n キー経由 ([i18n.md](./i18n.md))
- **backdrop-filter 直書き禁止**: Tailwind v4 Lightning CSS が削除するため、 `--tw-backdrop-blur` 変数パターン または CSS 変数経由 ([css-rules.md](./css-rules.md))。 ただし `backdrop-filter: var(--liquid-filter, none)` のような **変数参照は OK** (`blur(...)` リテラルではない)
- **conic-gradient** / **clip-path: path()** の技術制約 ([css-rules.md](./css-rules.md))

## デザイン変更の承認フロー

ハウジング画面でも、 **モックアップから外れる変更**を加えるときは必ずユーザーに確認してから。
モックアップ準拠の追加実装 (Plan B/C/D/E の panel 中身を埋める作業) は確認不要、 自律的に進めて OK。

## memory 参照

詳細経緯と運用判断は memory に集約:
- `feedback_housing_design_independent.md` — 独自トンマナ採用の経緯
- `feedback_housing_no_ai_pills.md` — AI 感の払拭 (装飾ピル/gradient/glow/色付きalert箱を避ける)
- `feedback_housing_whitespace_rhythm.md` — 縦積み UI の余白リズム (0px 密着を避ける)
- `project_housing_tour_design.md` — デザイン議論のリンク
- `project_housing_phase_status.md` — 進行状況
