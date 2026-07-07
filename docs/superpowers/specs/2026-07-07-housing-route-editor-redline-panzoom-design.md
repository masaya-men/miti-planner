# 設計書: 経路エディタに「赤線常時表示 + パン/ズーム」

- 日付: 2026-07-07
- ブランチ: `feat/housing-dev-tour-preview`
- 状態: ユーザー承認済み（操作方式=Googleマップ式 / 赤線=常時表示・トグル無し）
- 対象: **DEV エディタ `/housing/dev/routes`（`RouteAuthoringPage.tsx`）のみ**。本番ツアー（`TourNavMap`/`TourNavPage`）は無改変。

## 背景 / 目的

自動経路は「赤いナビ線（`stroke="#FF0000"` の中心線）」を辿っているが、エディタでは赤線が CSS で**非表示**（`housing.css:909` の `.housing-map-svg-host svg [stroke="#FF0000"] { display: none; }`）。そのためユーザーは金線が赤線に乗っているか判断できず「道から外れて見える」誤解が生じた（実測では金線=赤線 0px を確認済み）。

自動ルーティングでは全家を完璧にできないと判明したため、ユーザーが**赤線を見ながら全家を手動で override（描き直し）する**方針に転換。そのために:

1. **赤線を常時表示**（全10エリア・エディタ限定）— 何に沿わせるべきかが見える。
2. **マップのパン/ズーム** — 拡大して精密に、自由に移動して各家を直せる。

## 非目標 (YAGNI)

- 本番ツアーコンポーネントの改変（赤線は本番では従来通り非表示）。
- 赤線の ON/OFF トグル（ユーザー判断=常時表示で良い）。
- ルーティングアルゴリズムの変更（道なり追従は既実装のまま）。
- ミニマップ / 慣性スクロール / ピンチズーム対応（PC マウス前提。将来必要なら別途）。

## 設計 1: 赤線の常時表示（エディタ限定）

`housing.css` の hide ルール（`.housing-map-svg-host svg [stroke="#FF0000"] { display: none; }`）を、**エディタルート `.housing-dev-tourpreview` 配下でだけ上書き**して表示する。本番ツアーは `.housing-dev-tourpreview` を持たないので影響なし。

```css
/* DEV 経路エディタでのみナビ赤線を可視化（本番ツアーは非表示のまま）。 */
.housing-dev-tourpreview .housing-map-svg-host svg [stroke="#FF0000"] {
  display: inline;
  stroke: var(--housing-dev-navline);
  stroke-width: var(--housing-dev-navline-w);
  fill: none;
  opacity: 0.85;
}
```

- セレクタ特異度が hide ルールより高い（先頭に `.housing-dev-tourpreview` を足すだけ）ので確実に勝つ。
- 属性値は hide ルールと同一の `"#FF0000"`（大文字）で対応。
- 新規トークンを `housing.css` のハウジング変数ブロックに追加: `--housing-dev-navline`（赤系）/ `--housing-dev-navline-w`（細め・例 `1.5px` 相当。ズームで太く見えるので細めに）。DEV 専用だがハードコード回避方針に従いトークン経由。
- `[stroke="#FF0000"]` はナビ道の線と Node マーカー両方に付く。両方薄赤で出る（Node は交差点の目印になり手動修正の助けになるので許容）。

## 設計 2: パン/ズーム（Googleマップ式）

### DOM 構造の追加

現在: `.housing-tour-map-wrap > (.housing-map-svg-host + svg.housing-map-overlay)`。

両レイヤー（地図SVG + オーバーレイ）を**1つのズームコンテナで包み、同じ transform をかける**ことで常に整列させる:

```
.housing-tour-map-wrap
  └ .housing-map-zoom  (position:absolute; inset:0; transform-origin:0 0;
                         transform: translate(tx,ty) scale(s))
      ├ .housing-map-svg-host (地図SVG・赤線含む)
      └ svg.housing-map-overlay (金線・点・起点・ドア)
```

- `.housing-map-zoom` は wrap 内で `inset:0`。両子は従来通り `inset:0 / 100%`。両者が同じ transform を受けるので**ズレない**。
- **座標変換の頑健性**: 点配置の `clientToNorm` は `svg.getScreenCTM().inverse()` を使う。`getScreenCTM` は祖先の CSS transform を含む screen→user 行列を返すため、**パン/ズーム中でもクリック位置→正規化座標が正しく解決**する（追加の補正不要）。

### 状態

`const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })`。`tx/ty` は wrap のピクセル空間（wrap 自身は非スケールなので screen px と等価）。

### 操作

- **ホイール = カーソル位置へズーム**:
  - `factor = e.deltaY < 0 ? 1.1 : 1/1.1`、`newScale = clamp(scale*factor, 1, 8)`。
  - カーソル下の内容座標を固定: wrap 内カーソル `m = client - wrapRect`、`k = newScale/scale`、`newT = m - (m - t)*k`。
  - `e.preventDefault()`（ページスクロール抑止）。
- **地図ドラッグ = パン**（点配置と分離するため配置タイミングを変更）:
  - 現行「pointerdown で即配置」→「**pointerup で配置（動いていなければ）**」に変更。
  - overlay 空き領域 pointerdown: 開始位置と `tx/ty` を記録・`setPointerCapture`。まだ配置しない。
  - pointermove: 点ドラッグ中（`dragIdx != null`）は従来の点移動。そうでなければパン候補 → 移動量が閾値（例 5px）超で「パンした」フラグ、`tx/ty = tx0 + (client - start)` を更新。
  - pointerup: 点ドラッグ中なら解除。そうでなくパン未発生（移動 < 閾値）なら**その位置に点を配置**（従来 `onStageDown` の中身を移設）。
- **点をドラッグ = 微調整** / **ダブルクリック = 削除**: 従来通り（点の circle は `stopPropagation` + `setPointerCapture` でパン判定に食われない）。
- **「等倍に戻す」ボタン**: `setView({ scale:1, tx:0, ty:0 })`。ツールバーに追加。
- 既存トグル（道/ジャンプ・道スナップ・1つ戻す・白紙・保存）は不変。

## 触るファイル

- `src/components/housing/dev/RouteAuthoringPage.tsx`: ズームコンテナ追加 / `view` 状態 / wheel・pointer ハンドラ改修（配置を pointerup 化）/ 「等倍に戻す」ボタン。
- `src/styles/housing.css`: 赤線可視化ルール（`.housing-dev-tourpreview` スコープ）+ `.housing-map-zoom` + 新トークン2つ。
- 本番コンポーネント / ルーティング lib: **無改変**。

## テスト / 検証

- 自動テスト: 本コンポーネントは DEV 専用・インタラクティブで単体テストの費用対効果が低い。純ロジック（ズーム座標式）を切り出せるなら小さな単体を検討するが必須としない。
- **Playwright 実機検証**（主）:
  - `/housing/dev/routes` で赤線が全エリア表示される（`[stroke="#FF0000"]` が可視）。
  - ホイールでカーソル位置ズーム / ドラッグでパン / クリックで点配置（動かした時は配置されない）/ 点ドラッグ微調整 / 等倍リセット。
  - 赤線・金線・点がズーム/パンで**ズレず一体**で動く（スクショで目視）。
- 回帰: `npm run build` + 全 `vitest run`（既存緑を維持・DEV変更なので既存テストに影響しない想定）。
- 本番ツアーで赤線が**非表示のまま**であること（`.housing-dev-tourpreview` 非配下）を確認。

## 位置づけ

修正期間中の DEV ツール強化。ユーザーが全家を赤線に沿って手動 override → まとめて Claude に渡す → 最終ゲート（build+vitest+finishing-branch+承認で main）。
