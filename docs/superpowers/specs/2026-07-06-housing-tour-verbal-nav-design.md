# ハウジングツアー: 行き方テキストに沿ったナビ（方角バイアス + 曲がり角ジャンプ）設計

- 日付: 2026-07-06
- ブランチ: `feat/housing-dev-tour-preview`（未push・main `beb8d702` の上）
- 関連: `2026-07-06-housing-dev-tour-preview-design.md`（全住所プレビュー）、`.superpowers/sdd/progress.md` 末尾
- 前提スキル: brainstorming（本書）→ writing-plans → subagent-driven-development

## 1. 背景と問題

各 plot の「行き方テキスト」(`wardDirections.generated.json` の `directions`) は先頭に方角語を持つ（例 ミスト 8-8 = 「**西**の階段を降りて一つ目の踊り場からジャンプ」）。地図は北固定（上=北）。

現状の経路生成 `buildSnappedRoutePoints`（wardRoute.ts）は **エーテライトと玄関を道に投影 → 最短路 BFS** で結ぶ。これは方角を無視するため、8-8 のように「東の交差点経由」と「西の交差点経由」が同ホップで並ぶと、最短路が**東回り**を引き当てる。テキストは「西」なのに経路は東 = ユーザー体験としてバグ。

ユーザー要望（原文）: 「リスト出力でなく、私の言葉に合わせた動きをするように」。8-8 例 = 「**西に進んで一つ目の曲がり角で入口へ直接ジャンプ**」。

### 検算で確定した事実（実データ）
- ミスト 3=南 / 13=北西 / 14=北東 / 19=南東 を検算 → **全部「テキストの方角」＝「エーテライト→入口へまっすぐ引いた向き」と一致**。→ 「上=北・西=左」で正しい。
- つまり方角情報は**テキストにも、エーテライト→入口ベクトルにも二重に入っている**。問題は「方角が分からない」ことではなく「道の最短路が時々**逆向き**を選ぶ」こと。
- 8-8 実座標: エーテライト「ミストゲート・スクエア」= (0.442, 0.183)、入口 = (0.385, 0.273)（家の**西側**・エーテライトの**左下**）。最短路は node_11(東) 経由 = 2 ホップ / node_14(西) 経由 = 2 ホップの同着で、東が選ばれていた。

## 2. 確定した設計判断（ユーザー承認済み）

1. **A案（ハイブリッド）**: 今きれいに道をたどれている区画は**触らない**。経路の出だしが**方角と逆向き**の区画**だけ**を検出して直す（=リルート）。→ 良い ~270 区画の見た目を壊さず、回帰リスクを最小化。
2. **リルートの見た目 = 緑案**: エーテライトから**方角へ道を進む → 一つ目の曲がり角 → 入口へ直線ジャンプ**。
3. **ジャンプ区間は点線・道追従は実線**: 点線 = 「道に無い区間（階段/ジャンプ）」の正直な表現。8-8 の「西の階段を降りて…ジャンプ」の実態に合う。
4. **方角の取り方**: テキスト先頭の方角語を第一優先。テキストが無い区画（Goblet 拡張街 30 件・アパート）は**エーテライト→入口の向き**でフォールバック。「北左側」等の修飾は先頭の方角語だけ拾い残りは無視（YAGNI）。
5. **plot 単位の手動上書き機構**を用意し、アルゴリズムのベースラインに対して**後から一個ずつゲームに合わせて微調整**できるようにする（上書きはアルゴリズム再実行で消えない）。

## 3. 座標・方角の規約

- すべての角度計算は **px 空間**（正規化 0..1 を viewBox `w`/`h` で ×した後）で行う。正規化空間は `w≠h` で角度が歪むため不可。SVG は uniform scale（preserveAspectRatio 既定）で描画されるため px 空間の角度 = 画面上の見た目の角度。
- 方角語 → 単位ベクトル（px 空間・y は下向き）:
  | 語 | ベクトル (x, y) |
  |---|---|
  | 北 N | (0, −1) |
  | 南 S | (0, +1) |
  | 東 E | (+1, 0) |
  | 西 W | (−1, 0) |
  | 北東 NE | (+0.707, −0.707) |
  | 北西 NW | (−0.707, −0.707) |
  | 南東 SE | (+0.707, +0.707) |
  | 南西 SW | (−0.707, +0.707) |
- 上=北の前提は全 10 マップに適用。回帰は dev preview の 310 目視で検出（もし回転マップがあれば系統的にズレるので必ず気づく）。

## 4. アルゴリズム

入力（すべて px）: `origin`（エーテライト実座標）, `door`（玄関実座標）, `json`（ward マップ）, `dirVec`（方角単位ベクトル）。

### 4.1 方角ベクトルの決定 `getPlotBearing`
1. `getPlotDirections(area, plot)` の `directions` 先頭を正規表現 `^(北東|北西|南東|南西|北|南|東|西)` でマッチ（2 文字の斜方位を先に判定）。
2. マッチすれば §3 の表でベクトル化。
3. マッチしない/テキスト無し → `normalize(door − origin)`（フォールバック）。

### 4.2 リルート要否判定（agree / reroute）
1. 既存の `buildSnappedRoutePoints(json, origin, door)` で最短路点列 `snapped` を得る。
2. `origin` を先頭に付けた経路の**累積長 30%** 地点の点 `pEarly` を求める（経路が短ければ最終点）。
3. `earlyHeading = normalize(pEarly − origin)`。
4. `dot(earlyHeading, dirVec) < 0`（=出だしが方角の反対半平面）なら **reroute**、そうでなければ **agree**。
   - 30% と閾値 0（=90°）は保守的設定＝「明らかに逆向き」だけ直す。パラメータは調整可能（回帰を見ながら）。

### 4.3 agree の場合
- 現状どおり `road = [origin, ...snapped, door]`、`jump = null`。**既存挙動を一切変えない**（回帰ゼロ）。

### 4.4 reroute の場合（方角へ道 → 曲がり角 → ジャンプ）
1. `origin` を道に投影 → 乗り口 `onRamp`（どの edge の nodeA–nodeB 間か）。
2. **方角グリーディ歩き**: `onRamp` から、nodeA/nodeB のうち `dot(heading, dirVec)` が大きい方へ進む。以降ノードごとに、来た辺を除く隣接辺のうち `dot(edgeHeading, dirVec)` 最大の辺を選んで歩く（visited でループ防止・最大 K=6 ノード）。歩いた点列を `walk` に蓄積。
3. **曲がり角検出**: `walk` を進む中で、現在点 `P` から次の道ステップ `step` と玄関方向 `toDoor = door − P` について `dot(normalize(step), normalize(toDoor)) < 0`（=次の一歩が玄関から離れる）となった最初の `P` を **corner** とする。以下でも停止して corner とする: 方角に沿う前進辺が無い / K ノード上限 / 玄関最寄りノード到達。
4. `road = [origin, onRamp, ...walk(≤corner)]`（実線）、`jump = [corner, door]`（点線）。

#### 8-8 の検算（この定義で mockup と一致）
`origin(832,255)` → 投影 `onRamp(829,277)`（node_13–node_11 上）→ 西が優勢なので node_13(804,273) へ → node_14 方向へ西進 (690,277)→(684,305) → 次ステップ (595,311) は玄関 (725,380) から離れる（dot<0）→ **corner=(684,305)** → jump → door(725,380)。実線=西へ道、点線=北東へジャンプ。

### 4.5 退化・エッジケース
- `snapped` が null（道が無い）→ `road=[origin]`, `jump=[origin,door]`（全部ジャンプ）。
- グリーディ歩きで方角前進辺が皆無 → `corner=onRamp`、`road=[origin,onRamp]`, `jump=[onRamp,door]`。
- テキスト方角と `door−origin` の向きが >90° 乖離（データ異常の疑い）→ **方角は歩き方向に使い、ジャンプ先は常に真の door**。結果が不自然なら §7 の手動上書きで個別修正（preview で発見）。
- アパート（行き方テキスト無し）→ §4.1 でフォールバック方角。多くは agree（既存の道追従）でそのまま。

## 5. データ構造・モジュール変更

- `src/lib/housing/plotBearing.ts`（新規）: `parseCompassBearing(text): Vec | null` / `getPlotBearing(area, plot, originPx, doorPx): Vec`。純関数。
- `src/lib/housing/wardRoute.ts`（追加）: `buildVerbalRoute(json, originPt, doorPt, dirVec): { road: [number,number][]; jump: [number,number][] | null } | null`。内部で `buildSnappedRoutePoints`（agree 判定 + agree 経路）を再利用。既存 export は温存。
- `src/lib/housing/buildTourMapPlacements.ts`（配線変更）: ①`getPlotBearing` で dirVec ②§7 の override があればそれを使用 ③無ければ `buildVerbalRoute` ④`road`→`routePath`（`M..L..`）、`jump`→`routeJumpPath`（`M..L..` or null）。
- `TourMapModel`（buildTourMapPlacements.ts）: `routeJumpPath: string | null` を追加。
- `src/components/housing/tour/TourNavMap.tsx`: `routeJumpPath` を**破線**（`stroke-dasharray`）で描画。既存 `routePath`（実線・グロー/コア/コメット 3 層）は不変。破線側は静的破線（+任意でコメット継続）。
- 破線トークン/太さは housing.css に定義（ハウジング独自トンマナ）。

## 6. 描画（TourNavMap）

- agree: 従来どおり `routePath` のみ（実線）。**270 区画の見た目は不変**。
- reroute: `routePath`（実線・道）＋ `routeJumpPath`（破線・ジャンプ）。コメット/矢印は実線側を主とし、破線は「飛ぶ」印。
- 色/グローは既存の経路トークン踏襲（ハウジング世界観・白黒のみルール対象外）。

## 7. plot 単位の手動上書き機構

- `src/data/housing/wardRouteOverrides.generated.json`（新規・初期値 `{}`）:
  ```
  { [mapKey]: { [plot]: { road: [[x,y]...normalized], jump: [[x,y]...]|null } } }
  ```
  `mapKey` ∈ `mist|mist-sub|goblet|goblet-sub|lavender|lavender-sub|shirogane|shirogane-sub|empyreum|empyreum-sub`（経路幾何は ward 非依存＝同一 map の plot 位置は一意）。
- buildTourMapPlacements は override があれば**アルゴリズムより優先**して使用（px 変換して road/jump path 化）。
- **オーサリング UI は後続フェーズ（Phase 2）**。当面は preview で違和感のある plot をユーザーが指摘 → Claude が座標を JSON にエンコード（入口ツールと同じ運用）。将来は入口ドラッグツールを拡張して corner/経路をドラッグ保存。
- この分離により「アルゴリズムのベースライン」と「手直し」が独立し、アルゴリズム改善で手直しが消えない。

## 8. テスト方針（TDD）

- `plotBearing`: 「西の階段…」→W / 「北西目の前…」→NW / 「南東ひとつめ…」→SE / 「北左側…」→N（先頭語のみ） / ""→null→フォールバック。
- `compassToVec`: 8 方位の写像。
- `buildVerbalRoute`（合成グラフ）: ①agree（出だしが方角一致）→ road のみ・jump=null ②reroute（8-8 型合成）→ 実線 corner まで + 破線 corner→door ③曲がり角検出（次ステップが door から離れる点）④退化（道無し/前進辺無し）。
- `buildTourMapPlacements`: reroute plot で `routeJumpPath` 非 null / agree plot で null（既存 route テストは緑のまま=回帰ゼロ）。override 優先の確認。

## 9. 検証

- `npm run build`（tsc -b strict）EXIT0 / `npx vitest run` 新規 fail 0（既知 legacy 5 のみ）。
- dev preview `/housing/dev/tour-preview` で **8-8 が緑挙動**（西→角→破線ジャンプ）、**従来 OK 区画が不変**を Claude が Playwright 自己検証。
- その後**ユーザーが全 310 を目視**（1 個ずつ）→ 違和感は §7 の override で個別修正 or 閾値/パラメータ調整。

## 10. スコープ外 / 後続

- override オーサリング UI（ドラッグ保存ツール）= Phase 2。
- 本文の細粒度解釈（「一つ目の踊り場」「2 軒目」等の位置修飾）= 非対象（先頭方角語のみ）。
- 本番反映（finishing-a-development-branch）は全 310 目視 OK 後にユーザー判断。**勝手に push/merge しない**（[[feedback_deploy]]）。

## 11. 実装順（writing-plans で詳細化）

1. `plotBearing.ts` + テスト（純関数・独立）
2. `buildVerbalRoute` + テスト（純関数・合成グラフ）
3. override データファイル + ルックアップ
4. `buildTourMapPlacements` 配線 + `TourMapModel.routeJumpPath`
5. `TourNavMap` 破線描画 + housing.css
6. build/vitest 緑 → dev preview 自己検証 → ユーザー 310 目視
