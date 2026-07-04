# ハウジングツアー: 目的地アピールを「実箱ハイライト」化 ＋ アパートのナビ対応 設計書

- 日付: 2026-07-04
- ブランチ: `feat/housing-tour-nav-m1`（本物のナビ化 P2+P4 の視覚ポリッシュの続き）
- 前提読物: `docs/superpowers/plans/2026-07-04-housing-tour-nav-p2.md`、`.superpowers/sdd/progress.md`（実機視覚ゲート節）

## 背景と問題（実コードで確認済み）

中央地図の「目的地アピール」が、地図と無関係な**被せ矩形**になっている。

- 地図SVG（`*.generated.svg`・`.housing-map-svg-host` に `dangerouslySetInnerHTML` で埋め込み）内には、各区画が**実際の箱の形をした単一パス**として存在する:
  - 区画: `<path id="plot_N" d="…" fill="white" fill-opacity="0.3" stroke="black">`（`N` = 1..30。本街/拡張とも SVG は 1-30 命名）
  - アパート: `<path id="apart_1">`（本街）/ `<path id="apart_2">`（拡張街）。各マップに1棟のみ。
- しかし現状のアピールは [`TourNavMap.tsx`](../../../src/components/housing/tour/TourNavMap.tsx) が **150×110 のハニー矩形（`<rect>`）を `target.x/y` に被せているだけ**（[TourNavMap.tsx:57-68](../../../src/components/housing/tour/TourNavMap.tsx#L57-L68)）。実箱は静止したまま。ユーザー評価＝「箱自体をアニメせず雑に上に重ねている」＝**間違ったアピール**。

### 併発している既存バグ（アパート）

- アパートは地図配置・玄関ノード・座標を持つが、ツアーでは:
  - **棟1（本街）**: 家のハイライト枠のみ。**エーテライト起点・経路が出ない**（[buildTourMapPlacements.ts:48](../../../src/lib/housing/buildTourMapPlacements.ts#L48) は `getPlotOriginNode(area, plot)` を呼ぶが、アパートは `plot` 無し → null）。
  - **棟2（拡張街）**: **何も出ない**。sub マップの apart はデータ上 `plot:2` なのに [resolveWardMapRef.ts:24](../../../src/lib/housing/resolveWardMapRef.ts#L24) が常に `highlightPlot:1` を返し、[wardRoute.ts:25](../../../src/lib/housing/wardRoute.ts#L25) の `plot===1 && kind==='apart'` に一致せず target が null。
- アパート用の「最寄りエーテライト名」「言葉ナビ」は**元データに存在しない**（`wardDirections.generated.json` は plot 1-60 キーのみ）。

## ゴール

1. 目的地アピールを、**実際の区画/アパートのパス（`#plot_N` / `#apart_N`）そのものを光らせる**方式へ変更する（被せ矩形は撤去、放射リングは残す）。家・アパート共通の1つの仕組み。
2. アパートに、**最寄りエーテライト（同一地図内・幾何最寄り）→ アパート玄関のゴージャス経路 + 起点マーカー**を出す。
3. その過程で**棟2アパートの「何も出ない」バグを解消**する。

## 非ゴール（YAGNI）

- 言葉ナビ（右パネル）のアパート対応は本設計の対象外（別途スプシ記入待ち）。本設計は**中央地図のみ**。
- レガシー `MapView` / `wardRoute` の Mist 委譲ラッパ等の死にコード掃除は対象外（別タスク）。
- 経路アニメ自体の見た目（太さ/色/コメット等）は視覚#1で承認済みのため変更しない。

## 設計

### 共通方針

- 実箱ハイライトは「埋め込み済みSVGの該当パスに光らせ用クラスを付け外し」で行う（描画のたびに前を消して今を付ける命令的DOM操作）。SVGは `dangerouslySetInnerHTML` で入るため、これが素直な手段。
- ハイライトの見た目（案1「灯りが灯る」）: 箱の中がハニーで満ちて**ふわっと明滅（呼吸）**、縁がキャンドル色、外側にやわらかいグロー。**色は必ず `--housing-*` トークン経由**（housing.css 内の数値 px/stroke-width は housing.css の確立規約に従いリテラル可）。
- CSS は SVG プレゼンテーション属性（`fill="white"` 等）に優先するため、クラス側で `fill`/`stroke`/`fill-opacity` を上書きできる（検証済みのCSS仕様）。

### コンポーネント / ユニット

**1. `resolveWardMapRef`（変更・追加のみ）**
戻り値に `elementId: string` を追加する。SVG の id へ写像する責務をここに集約（main/sub の判定を既に持つため自然）。
- 区画: `plot_${highlightPlot}`（`highlightPlot` は 1-30。本街/拡張とも SVG id と一致）
- アパート: `apart_${apartmentBuilding === 2 ? 2 : 1}`（本街=`apart_1`／拡張街=`apart_2`）
- 既存フィールド（`mapKey`/`highlightPlot`/`highlightKind`）は不変。消費者（[WardMapPreview.tsx:39](../../../src/components/housing/register/WardMapPreview.tsx#L39)）は個別フィールドを分割代入するのみ＝追加は後方互換。

**2. `apartToPlacementIn(json)`（新規・`wardRoute.ts`）**
各マップに1つだけ存在する `kind==='apart'` の家エントリを、番号に依存せず返す純関数。`{ x, y, nodeId } | null`。棟2の target null バグを構造的に解消。

**3. `getApartmentOrigin(json, mapKey)`（新規・純関数）**
アパートの起点＝**同一地図内で幾何最寄りのエーテネットシャード**を返す（家は名前で正典指定だが、アパートは正典データが無いため距離で自動選択）。
- `json.houses` の apart エントリの正規化座標 `(x,y)` を取得。
- `getMapAetherytes(mapKey)` のシャード群から最も近い1つを選ぶ。
- `{ node, aetheryte, x, y } | null` を返す（`getPlotOriginNode` と同じ形）。
- **本街/拡張クロス0は構造的に保持**: `getMapAetherytes(mapKey)` は当該マップのシャードのみ（本街=非`[拡張街]`／sub=`[拡張街]`）。棟2は必ず `[拡張街]` シャードに解決する（テストで保証）。
- 全10棟で「最寄りシャードのノード → アパート玄関ノード」が道づたいに到達可能なことは検算済み（reachable=true 全件）。

**4. `buildTourMapPlacements`（変更）**
- target 配置: `ref.highlightKind === 'apart'` なら `apartToPlacementIn(json)`、それ以外は従来の `plotToPlacementIn(json, highlightPlot, 'plot')`。
- 起点: `currentListing.buildingType === 'apartment'` なら `getApartmentOrigin(json, mapKey)`、それ以外は従来の `getPlotOriginNode(area, plot)`。
- 経路: 従来どおり `buildRoutePathIn(json, origin.node, targetPlacement.nodeId)` + 玄関座標への最終 `L`。target に nodeId が入るようになったのでアパートでも経路が引ける。
- `TourMapModel` に `targetElId: string | null` を追加（= `ref.elementId`。target が解決できた時のみ set）。
- `placed`（番号ノード）ループも `apart` 分岐で拾えるよう `plotToPlacementIn`→apart 対応にする（棟2が placed から漏れないように）。

**5. `TourNavMap`（変更）**
- **被せ矩形（`<rect>`）を撤去**。
- **放射リング（`<circle>` 2本）は `target.x/y` を中心に残す**。
- host に `ref` を持たせ、`useEffect([status, svg, targetElId])` で:
  - host 内の `.housing-tour-target-box` を全て外す → `model.targetElId` があれば `[id="…"]` を1つ探してクラス付与。
  - `svg`（＝マップ切替で innerHTML 差し替え）と `targetElId`（＝ステップ移動）両方の変化で再適用。
- 経路・起点マーカー・番号ノードは不変。

**6. `housing.css`（追加）**
- `.housing-map-svg-host svg .housing-tour-target-box { fill / stroke / animation }` と `@keyframes`（fill-opacity + drop-shadow の呼吸）。色は既存トークン（`--housing-honey` / `--housing-candle`）＋必要なら glow 用トークンを `.housing-workspace` ブロックに追加。

## データフロー

```
currentListing ──▶ resolveWardMapRef ──▶ { mapKey, highlightPlot, highlightKind, elementId }
                                              │
asset(useWardMapAsset: json+svg) ────────────┤
                                              ▼
                       buildTourMapPlacements(json, mapKey, ref, currentListing, steps, i)
                          ├─ target      = apart? apartToPlacementIn(json) : plotToPlacementIn(...)
                          ├─ origin      = apartment? getApartmentOrigin(json,mapKey) : getPlotOriginNode(area,plot)
                          ├─ routePath   = buildRoutePathIn(json, origin.node, target.nodeId) + L(door)
                          └─ targetElId  = ref.elementId
                                              ▼
                       TourNavMap: overlay(rings@target, route, origin, nodes)
                                   + effect: host.querySelector([id=targetElId]).classList.add(target-box)
```

## エラー / 退避

- `targetElId` に一致する要素が host に無い場合はハイライト無し（地図は素の状態で表示・クラッシュしない）。
- `getApartmentOrigin` が null（データ欠落）の場合は起点・経路無し（従来の家の null フォールバックと同じ挙動）。ただし全10棟で解決可能なことは検算済み。
- SVG 再埋め込み（マップ切替）直後も effect が再適用されるため 1 フレーム stale ハイライトは残らない。

## テスト（TDD・純関数を先に）

- `resolveWardMapRef`: `elementId` が `plot_6` / `apart_1`（本街）/ `apart_2`（拡張街）になる。既存フィールド不変。
- `apartToPlacementIn`: 全10マップで apart エントリを番号非依存で返す（棟2含む）。存在しない kind は null。
- `getApartmentOrigin`: 全10棟で non-null・node 非空。**棟2は必ず `[拡張街]` シャード名に解決（クロス0）**。本街は非`[拡張街]`。
- `buildTourMapPlacements`: アパート（棟1/棟2）で target/routePath/origin/targetElId が揃う。**家の既存挙動は不変（回帰なし）**。placed に棟2が含まれる。
- `TourNavMap`: `targetElId` 付きモデルで、`<rect>` が無いこと・リング/経路/起点が残ること。DOM クラス付与は happy-dom で検証（付かないケース＝要素なしも）。
- 各ステップ末で `npm run build`（tsc -b 厳密）+ `npx vitest run <対象>`。全体 `npx vitest run` は既知 legacy 5 fail のみ（新規ゼロ）を維持。

## 実装順（2段・各段でユーザーのローカル実機確認をゲート）

- **ステップ1（家）**: `resolveWardMapRef.elementId` 追加 → `buildTourMapPlacements.targetElId` 追加 → `TourNavMap` 実箱ハイライト（rect撤去・リング残す）+ `housing.css`。→ **家で「実箱が灯る」ことをユーザーがローカル確認**。
  - この時点でアパートを目的地にすると `#apart_N` は光り得るが、起点/経路はまだ null（ステップ2で補完）。
- **ステップ2（アパート）**: `apartToPlacementIn` + `getApartmentOrigin` + `buildTourMapPlacements` のアパート分岐。→ **アパート（棟1/棟2）で起点→経路→箱ハイライトが揃うことをユーザーがローカル確認**。棟2バグ解消。

## 制約（厳守）

- 勝手に push / main merge しない（[[feedback_deploy]]）。各ステップはユーザーのローカル確認がゲート。
- 本街(plot/apart_1)/拡張街(apart_2)を絶対に混ぜない（[[reference_housing_aetheryte_source_svg]]）。テストでクロス0を保証。
- 色ハードコード禁止・`--housing-*` トークン経由。i18n 追加キーは4言語 parity（本設計は新規UI文字列なしの想定）。
