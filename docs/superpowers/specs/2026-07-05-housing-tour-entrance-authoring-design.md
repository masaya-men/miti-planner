# 家の入口 手動補正ツール + 経路終点の入口優先化 設計書（改善2の精度化）

> 2026-07-05 brainstorming 合意。中央地図 Phase 1（改善2「家の手前で止める」）の精度問題を、幾何のたたき台＋手動ドラッグ補正で解決する。

## 背景・課題

Phase 1 改善2 は「経路を家の箱の縁で止める」を幾何（`buildTourMapPlacements` の `最寄りノード→箱中心` 線分 × 箱輪郭の交点）で実装した。凸型の家（ミスト等）ではそこそこ効くが、以下で崩れる（最終ブランチレビュー M1 の実体・ユーザー実機で確認）:

- **凹型/L字/回転区画（ゴブレット等）**: 箱輪郭の重心（＝登録中心）が多角形の外に出て交点が求まらず、箱中心へフォールバック＝縁で止まらない。
- **入口が道に面した縁に無い家**: FF14 の実際の入口は道から外れた位置のことがあり、幾何は推論できない。

FF14 の実入口位置は幾何で当てられないため、**人が実際の入口を指定する**のが正確。ただし全区画手打ちは重いので、**幾何が置いた入口をたたき台として全区画に表示 → 崩れた家だけドラッグで補正 → 補正分だけ上書き保存**する。

## ゴール

- ツアー中地図の経路終点を、収録済みの家は実際の入口ぴったりに、未収録の家は従来の幾何で止める。
- 開発者（ユーザー本人）が、実マップ上で入口マーカーをドラッグして補正し、その結果を静的データとして書き出せる。
- 保全済みの地図参照データ（座標・node・edges・roadPath・outline）は一切変更しない。入口データは完全に別ファイルの追加レイヤー。

## 非ゴール（YAGNI）

- 本番アプリへのオーサリングUI露出（開発専用）。
- /admin でのライブ入口編集（案X 採用＝発表後の稀な修正は静的JSON更新＋再デプロイで対応。入口は低頻度データ）。
- アパートの部屋ごと入口（1棟1点で十分）。
- 未収録の凹型が箱中心に落ちる件の幾何的完全解決（手動補正で救う前提で許容）。

## アーキテクチャ

### 1. 入口データ（静的生成物JSON）

- ファイル: `src/data/housing/wardEntrances.generated.json`（既存 `wardAetherytes.generated.json` と同じ「生成物JSON」流儀）。
- 構造:
  ```jsonc
  {
    "mist":    { "6": [0.42, 0.58], "12": [0.31, 0.44] },   // plot番号 → [x, y] 0..1正規化
    "goblet":  { "apart": [0.50, 0.60] },                    // アパートは "apart" キーで1棟1点
    // ドラッグで補正した区画だけを持つ疎データ。未収録の区画は幾何フォールバック。
  }
  ```
- マップキーは既存 `resolveWardMapRef` の `mapKey`（`mist` / `mistSub` / `goblet` / … 全10）に一致させる。
- 初期状態は空（`{}`）＝全区画フォールバック＝現行と同挙動（回帰なし）。

### 2. 純関数

- `getPlotEntrance(area, plot): [number, number] | null`（新規 `src/lib/housing/plotEntrance.ts`）
  - `resolveWardMapRef(area, plot, …)` で mapKey/plot を解決し、`wardEntrances.generated.json` を引く。収録あり→ `[x, y]`（0..1）、なし→ `null`。
  - アパートは `apart` キーを引く。
- `computePlotDoor(json, plot, kind): { x: number; y: number } | null`（新規 `src/lib/housing/plotDoor.ts`。`mapGeometry` の `segmentPolygonIntersection` / `nodeToPointIn` を使う）
  - 現在 `buildTourMapPlacements` にインラインの「最寄りノード→箱中心 線分 × outline 交点」ロジックを純関数化。交点なし→ null（＝フォールバック発火条件）。`buildTourMapPlacements` は本関数を呼ぶだけにして重複を排除。
  - **経路とオーサリングツールが同じ関数を使う**ことで「見たまま」を保証。

### 3. 経路への配線（`buildTourMapPlacements`）

終点（door）決定を優先順位付きに格上げ:

1. `getPlotEntrance(area, plot)` に収録あり → その点（0..1 × viewBox で px 化）。
2. なければ `computePlotDoor(json, plot, kind)`（従来の箱縁幾何）。
3. それも null（凹型等）→ 箱中心（`targetPlacement.x/y`）＝現行フォールバック。

改善1（エーテライト実座標→道への投影起点）は不変。`TourMapModel` の形も不変（消費側 TourNavMap 無改変）。

### 4. オーサリングページ（開発専用）

- ルート: `import.meta.env.DEV` でのみ有効（例 `/housing/dev/entrances`）。本番ビルドには出さない/露出しない。
- 構成:
  - マップ選択 UI（全10マップ）。
  - 選択マップの実SVGを `.housing-map-svg-host` で描画（ツアーと同じ見た目）。参照データは読み取りのみ。
  - **その全区画に入口マーカー**を重ねて表示。初期位置＝上書きデータがあればそれ、なければ `computePlotDoor` の幾何値。区画番号ラベル付き。
  - 色分け: **未補正（幾何のまま）＝グレー**／**補正済（ドラッグした）＝ハニー**。
  - マーカーを**ドラッグ**→ 画面px を 0..1 に変換して保持（変換は純関数化しテスト）。
  - **「JSON書き出し」ボタン**: 現在の全上書き点を `wardEntrances.generated.json` 形式でクリップボードコピー＆画面表示 → 開発者が私に渡し、私がファイルへコミット反映。
  - **経路プレビュートグル**: 選択中の家について、起点エーテライト→入口の実経路を重ねて表示（見え方を確認しながら補正）。
- housing 独自トンマナ（`housing.css` トークン経由・ハードコード禁止）。ただし開発専用ツールなので装飾は最小で可。

## データフロー

```
[開発ツール] マップ選択 → 全区画に computePlotDoor / 既存override でマーカー描画
   → ユーザーがドラッグ補正（px→0..1）→ override 状態を更新（色ハニー化）
   → 「書き出し」→ wardEntrances 形式JSON をクリップボードへ
   → 私が wardEntrances.generated.json にコミット
[本番ツアー] buildTourMapPlacements → getPlotEntrance(あれば) → computePlotDoor(なければ) → 箱中心(最終)
   → routePath 終点が入口へ
```

## テスト方針

- 純関数 TDD:
  - `getPlotEntrance`: 収録あり→その点／なし→null／apart キー解決。
  - `computePlotDoor`: 箱縁で止まる（中心でない）／凹型で交点なし→null。
  - `buildTourMapPlacements`: 入口データありの区画は終点＝入口ぴったり／なしは従来フォールバック（既存テスト維持）。
  - ドラッグ座標変換（screen px ↔ 0..1）純関数。
- 手動確認（実画面ゲート）: オーサリングのドラッグ操作感・色分け、経路プレビューの見た目。UI自体は自動テストしない。
- `npm run build`（tsc -b 厳密）EXIT0。既知 legacy 5 fail 以外の新規 fail ゼロ。保全マップデータ不変。

## 進め方（段階）

1. データ形式（空JSON）＋`getPlotEntrance`＋`computePlotDoor`切り出し＋経路配線。**この時点で入口データ空＝全部フォールバック＝現行と同挙動（回帰なし）**。
2. オーサリングページを作る。
3. **ユーザーがまずミストで全区画ドラッグ補正** → JSON反映 → 実機で経路確認。
4. 良ければ他マップへ横展開。

## 未解決の小課題（実装時に確定）

- オーサリングページの入口マーカーのドラッグ実装（SVGオーバーレイ上の pointer イベント→viewBox座標）。マウス追従禁止ルール（ui-design.md）はドラッグ操作なので対象外（高頻度state更新ではなくドラッグ中のみ）だが、`requestAnimationFrame` 抑制など軽量化に留意。
- 発表後修正フロー: 報告 → 開発ツールで該当マップを開き該当区画をドラッグ → JSON更新 → デプロイ（案X）。
