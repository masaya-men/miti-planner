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
- **glassmorphism**: 強めに採用 OK (mockup の panel chrome は ring border + 4 corner highlights + top sheen + 4 層 box-shadow + SVG displacement filter)

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
- `project_housing_tour_design.md` — デザイン議論のリンク
- `project_housing_phase_status.md` — 進行状況
