---
paths:
  - "src/components/housing/workspace/**"
  - "src/styles/housing.css"
  - "src/__tests__/housing/HousingWorkspace.test.tsx"
  - "src/__tests__/housing/TopBar.test.tsx"
  - "src/__tests__/housing/StatusBar.test.tsx"
  - "src/__tests__/housing/LiquidGlassPanel.test.tsx"
  - "src/__tests__/housing/SceneryVideo.test.tsx"
---

# ハウジング画面 独自デザインルール (`/housing` 配下のみ)

> 本ルールは **`/housing` ワークスペース専用**。 LoPo 既存 UI ルール ([ui-design.md](./ui-design.md) / [DESIGN.md](./DESIGN.md)) の白黒のみ・Inter 禁止・honey 色禁止・glassmorphism 控えめ等の制約は本画面に**適用されない**。

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

## トークン経由を徹底 (ハードコード禁止)

`src/styles/housing.css` 上部の CSS 変数 (`--housing-*`) を必ず利用。 ハードコード厳禁。

- 色: `--housing-honey` / `--housing-candle` / `--housing-panel-bg` / `--housing-text` / `--housing-text-dim` / `--housing-text-mute` / `--housing-divider` 等
- レイアウト: `--housing-header-h` / `--housing-status-h` / `--housing-panel-radius` / `--housing-main-gap` / `--housing-main-padding` / `--housing-left-w` / `--housing-right-w`
- 影: `--housing-text-shadow`

新トークンが必要になった場合も `housing.css` の `:root` ブロックに集約 (個別コンポーネント内には書かない)。

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
