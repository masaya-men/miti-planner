# 経路お絵かきツール + 経路セグメント化・ジャンプ弧描画 設計書

> 2026-07-07 brainstorming 合意。ツアー経路が「ユーザーが描いた赤線(道)」から外れる問題を、**ユーザー自身が道の上をなぞって経路を描き保存できる開発専用ツール**で解決する。入口オーサリング(`EntranceAuthoringPage` + vite `/__save-entrances`)の姉妹ツール。

## 背景・課題

経路生成 `buildVerbalRoute`(verbalRoute.ts)は、まず道追従経路 `buildSnappedRoutePoints`(=ユーザーが Figma に `stroke="#FF0000"` で描いた赤線を parse した `edges` を辿る道なり)を作る。ところが直後の `shouldReroute` 判定が「行き方テキストの方角と経路の出だしの向きが逆半平面なら道追従を捨て、`directionalWalk`(方角優先の貪欲歩き)や最悪 `[S,E]` 直線ジャンプに切り替える」ため、**せっかくの道なり経路が捨てられて道から外れる**。

`wardRouteOverrides` の手動 override は最優先で reroute を丸ごと回避できる(buildTourMapPlacements.ts:90)が、**Claude が座標を手打ちして 1 件ずつ試行錯誤するのは非効率かつ不正確**(実証: mist-sub 13 で複数往復)。ユーザー本人が実マップ上で道をなぞって経路を確定できるのが正しい。

## ゴール

- 開発者(ユーザー本人)が、実マップ上で経路の点を打って道なりに描き、`wardRouteOverrides.generated.json` に保存できる。
- 経路は **「道」区間(実線)と「ジャンプ」区間(破線・弧を描いて飛ぶ)** を任意順・任意個で持てる。ジャンプはツール上で明示的に登録する。
- ジャンプの弧描画は **本番ツアー地図にも反映**(道に無い区間が弧で飛ぶ表現に統一)。
- 保全済みの参照データ(座標・node・edges・roadPath・outline・入口)は一切変更しない。override レイヤーのみ。

## 非ゴール(YAGNI)

- 本番アプリへのオーサリング UI 露出(開発専用・`import.meta.env.DEV` gate)。
- `reroute` アルゴリズム自体の修正(退化リスクで撤回済み=A案。override で個別上書きが確定方針)。
- 自動経路生成(buildVerbalRoute)の精度改善。
- 経路のアニメーション演出の刷新(既存のコメット/流れは維持)。

## データ構造の変更

現行 `RouteOverride`(wardRouteOverrides.ts):

```ts
interface RouteOverride { road: [number, number][]; jump: [number, number][] | null }
```

新 `RouteOverride`(セグメント方式):

```ts
type Pt = [number, number];
interface RouteSegment { kind: 'road' | 'jump'; points: Pt[] }   // points は 0..1 正規化
interface RouteOverride { segments: RouteSegment[] }
```

- 道/ジャンプ区間を**任意順・任意個**で保持(道→ジャンプ→道… が表現できる)。
- 既存 override 13 件(mist 6 + mist-sub 8: 全て `jump: null`)は `{ road }` → `[{ kind:'road', points: road }]` に**一括変換**して挙動維持。変換は生成物 JSON を直接書き換え + 純関数 `migrateLegacyOverride` を用意(テスト用)。

## 経路 → SVG パス化(純関数 `routeToPaths`)

新規 `src/lib/housing/routePaths.ts`:

```ts
function routeToPaths(segments: RouteSegment[], w: number, h: number):
  { routePath: string | null; routeJumpPath: string | null }
```

- **road セグメント群** → `routePath`: 各 road セグを `M x y L x y …` サブパス化し、複数サブパスを 1 本の d 文字列に連結。
- **jump セグメント群** → `routeJumpPath`: 各 jump セグの連続ペア A→B を **2 次ベジェの弧** `M Ax Ay Q Cx Cy Bx By` にして連結。
  - 制御点 `C = 中点 + 法線単位ベクトル × (|AB| × ARC_K)`。`ARC_K ≈ 0.22`。膨らむ向きは経路進行の一方向に固定(実装時に上寄せで確定)。
- **TourNavMap は無改造**。`routePath` / `routeJumpPath` が「複数サブパス/弧を含む d 文字列」になるだけ。コメット(`animateMotion path={route}`)も d に追従。

## buildTourMapPlacements の配線

- override あり → `routeToPaths(override.segments, w, h)` で `routePath` / `routeJumpPath` を得る。
- override なし → 従来 `buildVerbalRoute`。ただし **jump の弧化を全経路で統一**するため、`buildVerbalRoute` が返す `{road, jump}` も `routeToPaths` 相当で描画する(reroute の破線ジャンプも弧で飛ぶ)。road/jump → segments 変換を挟むか、jump path 生成のみ弧関数に差し替え(実装時に最小差分で確定)。

## オーサリングページ `RouteAuthoringPage`(`/housing/dev/routes`・DEV gate)

- **巡回**: 前へ/次へ・番地ジャンプ(tour-preview と同じ操作感)。全 310 を 1 件ずつ。
- **地図**: 実 SVG(道) + 現在の家ハイライト(`#plot_N`/`#apart_N`) + 起点エーテライト + 入口 + 編集中の経路。ツアーと同じ `.housing-map-svg-host` + overlay。
- **編集操作**:
  - 地図クリックで**点を末尾に追加**。点を**ドラッグで移動**、選択して**削除**。
  - **モード切替「道」「ジャンプ」**: これから打つ点の区間種別。ジャンプ点は破線・弧でプレビュー。
  - **道スナップ(トグル)**: クリック/ドラッグ点を最寄り edge に吸着(`nearestPointOnPolylines` 流用)。道の上を正確になぞれる。オフで自由配置。
  - **起点(エーテライト)と入口を両端に自動配置**(初期状態)。ユーザーは間の道/ジャンプ点だけ打つ。
  - **初期値**: 既存 override があればその segments、無ければ現在の `buildVerbalRoute` 結果をたたき台に表示。
- **保存**: `POST /__save-routes` → `wardRouteOverrides.generated.json` 直書き。保存後 Claude に「保存した」と伝える運用。
- housing トークン経由(ハードコード禁止)。開発専用ツールなので装飾は最小で可。

## vite `routeSaverPlugin`

`entranceSaverPlugin` と同型を追加(vite.config.ts):

- エンドポイント `/__save-routes`、TARGET = `src/data/housing/wardRouteOverrides.generated.json`。
- POST body を JSON object 検証 → `writeFileSync`。`apply: 'serve'`(本番 build 非含有)。

## 純関数と単体テスト(TDD)

- `routeToPaths(segments, w, h)`: road 連結 / jump 弧 / 空 / road+jump 混在。
- `migrateLegacyOverride({road, jump})` → segments。
- `snapToEdges(pt, edges)` → 最寄り点(`nearestPointOnPolylines` ラッパ)。
- screen px ↔ 0..1(既存 `entranceAuthoring.pxToNorm` 流用、`clientToViewBox` は `EntranceAuthoringPage` 同様)。
- `getRouteOverride`: 新形式を返す(既存テストを segments に更新)。
- `buildTourMapPlacements`: segments override → 正しい `routePath`/`routeJumpPath`(弧)。既存フォールバック維持。

## 影響と検証

- **本番 TourNavMap は無改造**(d 生成側のみ変更)。
- **本番ツアー全マップの経路描画に影響**: (1) 既存 override 13 件を segments 変換、(2) reroute 由来の jump が弧化。→ 共有描画パスの変更のため、**全 10 マップ・全 310 を実機点検**([[feedback_structural_refactor_runtime_audit]])。
- `npm run build`(tsc -b 厳密)EXIT 0。既知 legacy fail 以外の新規 fail ゼロ。保全マップデータ不変。

## 進め方(段階)

1. **データ層**: `RouteOverride` を segments 化 + `routeToPaths`(弧) + `migrateLegacyOverride` + 既存 13 件変換 + `buildTourMapPlacements` 配線 + `getRouteOverride`/テスト更新。**この時点で既存 override は同じ道 + jump が弧、回帰なし**を実機確認。
2. **オーサリング UI**: `RouteAuthoringPage` + vite `/__save-routes`。ユーザーが mist-sub 13 で試し描き → 保存 → 実機確認。
3. **横展開**: 良ければユーザーが巡回しながら全 310 のおかしい区画を自分で確定。
