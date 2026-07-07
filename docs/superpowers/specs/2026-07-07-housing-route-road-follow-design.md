# 設計書: ツアー経路の「道なり追従」(override 表示の曲線化)

- 日付: 2026-07-07
- ブランチ: `feat/housing-dev-tour-preview`
- 前段: `2026-07-07-housing-route-editor-trace-design.md`(v2 エディタ)の「繰延: 道なり自動追従」節を**本書で確定**(旧節の A/B 段階案は下記データ検証で否定されたので置換)
- 状態: 方向性ユーザー承認済み(「定規でまっすぐ → 道の形に沿って曲げる」)

## 背景 / 問題

override(手描き経路)は今、置いた点を **直線(定規)で結ぶだけ**([routePaths.ts:8-9](../../../src/lib/housing/routePaths.ts#L8) の `roadSubpath` が M/L 直線)。道がカーブしている所で、2 点の間の直線がカーブの内側をショートカットし、経路の線が赤いナビ道からはみ出る。

## 検証で分かった事実(推測でなく実測・保存済み 91 件を計測)

1. **スナップ基準(edges)= 画面の赤いナビ線** と一致。JSON edge 頂点は生の赤 `#ff0000` パスから平均 1px(最大 5px)。→ スナップ計算はズレていない。
2. **ユーザーが道の上に打った「途中の点」は赤線に完全一致(平均 0px)**。→ 点の配置は問題なし。修正すべきは「点の間の線」だけ。
3. **ズレの正体は 2 種類**:
   - **(A) 道上 2 点を結ぶ直線がカーブを突っ切る** ← 本書で直す本体。91 件中 **28 区画**、最大ズレ 39px(ラベンダー/エンピレアム等の曲がった道)。
   - **(B) 各経路の出だし(エーテライト側・平均 16px)/終わり(ドア側・平均 29px)は道から離れる** ← **仕様通り**。起点(最寄りエーテライト)も家のドアも道の外にあり、赤い道は途中区間だけ。追従では変えない/変えるべきでない。
4. **カーブ突っ切り(A)34 件の内訳: 同一 edge 内 = 7 件のみ / 別 edge をまたぐ = 27 件**。赤いナビ線は交差点等でノード分割されており、見た目 1 本の曲線がデータ上は複数 edge に切れている(例: ラベンダー 26 番は edge 23→24→25→26 の連続カーブ)。
   - **重要な帰結**: 「同一 edge 内だけ追従」では 34 件中 7 件しか直らない(79% 取りこぼし)。→ **別 edge をまたいで道グラフを辿る追従が必須**。

## 目的

override の road 区間の表示を、点と点の間を **道グラフに沿って曲げて** 描く。保存データ(点列)は不変のまま、表示時に道追従させる。

## 非目標 (YAGNI)

- **保存形式の変更**: しない(`segments: {kind, points}` のまま)。追従は表示時のみ。
- **ジャンプ(弧)区間**: 対象外(道が無い区間なので追従しない。今の `arcJumpPath` のまま)。
- **経路の出だし/終わり(エーテライト↔ドアの道外連結)**: 対象外(上記事実 3-B。仕様通り直線)。
- **override 無しの自動経路**: 対象外(既に `buildSnappedRoutePoints` 経由で道追従できている。本書は override 表示だけを変える)。
- **reroute アルゴリズム(`shouldReroute`/`directionalWalk`)**: 一切触らない。
- **距離重み最短路(Dijkstra)**: 今は入れない。既存の BFS ベース道追従を流用(下記)。将来、近道誤選択が実害になったら Dijkstra 化を検討。

## アプローチ(確定)

**既存の安全な道追従処理 `buildSnappedRoutePoints`([wardRoute.ts:68](../../../src/lib/housing/wardRoute.ts#L68))を、隣り合う「道上 2 点」の間だけに使う。**

- `buildSnappedRoutePoints(json, a, b)` = 任意 2 点を道に投影 → 仮想ノードとしてグラフに差し込み → 既存 BFS で道グラフを辿り → 各 edge の polyline(カーブ頂点)を連結した px 点列を返す純関数。**自動経路が道の中心を通れているのはこの関数のおかげ**。
- **これは経路が外れる原因(`shouldReroute`/`directionalWalk` の方角判定)とは別物**。`buildSnappedRoutePoints` は方角判定を一切せず道を忠実に辿るだけ。override 表示の中で「道追従」だけを使うので、reroute のはみ出しを再導入しない。

### アルゴリズム(road 区間の展開)

road 区間の点列 `P = [p0, p1, ..., pn]` を、隣接ペアごとに展開して 1 本の折れ線にする:

- 各ペア `(pi, pi+1)` について:
  - **両端が道の上にある**(各点から最寄り道までの距離 < 閾値 `ONROAD_PX`)なら、`buildSnappedRoutePoints(json, pi, pi+1)` の返り値(道なり点列)で置換。
  - **どちらかが道から離れている**(= 出だし/終わりの道外連結)なら、**そのまま直線**(pi→pi+1)。
  - **暴走ガード**: 道なり点列の全長が直線距離の `MAX_RATIO` 倍(初期値 2.5)を超えたら、遠回りへ迷い込んだと見なし**直線に戻す**。
  - **fallback**: `buildSnappedRoutePoints` が null(到達不能)なら直線。
- 展開後、隣接ペアの境界共有点を 1 つに畳む(既存 `segmentsToPoints` と同じ要領)。
- 出力は `RouteSegment`(kind='road', points=展開後の密な点列)。**この密点列は表示専用**で保存しない。

パラメータ(`ONROAD_PX` / `MAX_RATIO`)は実装時に実機で目視調整し、確定値をコメントに残す。初期値: `ONROAD_PX = 12`(事実 3-B の出だし 16px 未満は道外扱いにして直線を保つ狙い。実機で 8〜16 を試す)、`MAX_RATIO = 2.5`。

### どこに実装するか(2 箇所・共有純関数)

追従は「保存済み override の表示」と「エディタ編集中のライブ表示」の両方で効かせる必要がある。純関数を 1 つ用意して両方から呼ぶ:

- **新規純関数** `followRoadSegments(segments, json)` → road 区間を上記アルゴリズムで展開した新 `RouteSegment[]` を返す(jump 区間は素通し)。ward json(edges/nodes/viewBox)を受け取る。置き場所は `buildSnappedRoutePoints` と同じ道グラフ層(`wardRoute.ts` 近傍)。`routePaths.ts` は座標のみの純関数のまま保つ。
- **本番表示**: [buildTourMapPlacements.ts:88-93](../../../src/lib/housing/buildTourMapPlacements.ts#L88) の override 分岐で、`routeToPaths(segs, w, h)` の前に `segs = followRoadSegments(segs, json)` を挟む。→ 実ツアーと、エディタの非編集表示(= `buildTourMapPlacements` 再利用)の両方が滑らかになる。**保存済み 91 件が遡って滑らかになる**(データ不変)。
- **エディタ編集中**: [RouteAuthoringPage.tsx:138](../../../src/components/housing/dev/RouteAuthoringPage.tsx#L138) の `editPaths = routeToPaths(pointsToSegments(points), ...)` を `routeToPaths(followRoadSegments(pointsToSegments(points), json), ...)` に。→ クリックした瞬間に金線が道なりに出る = おかしければ点を足して即修正(安全網)。
- **本番ツアーコンポーネント(`TourNavMap`/`TourNavPage`)は無改変**(表示は `buildTourMapPlacements` の返り値をそのまま描くだけ)。

## 互換性

- 保存 JSON(`wardRouteOverrides.generated.json`)は不変。既存 91 件はそのまま有効。
- 「新しく直す家だけ」ではなく **全 override に表示時追従を効かせる(遡って滑らか)** = ユーザー承認済み。万一、追従で悪化する区画があっても、最終 310 実機確認で発見 → 点を足して修正できる(自己修復)。

## テスト / 検証

- **単体テスト**(`followRoadSegments`):
  - road 上 2 点(同一 edge)→ その edge のカーブ頂点を含む点列に展開される。
  - road 上 2 点(別 edge またぎ)→ 中間 edge の頂点を含む道なり点列に展開される。
  - 片端が道外(出だし/終わり相当)→ 直線のまま。
  - 暴走ガード: 道なり長 > 直線 × MAX_RATIO → 直線に戻る。
  - jump 区間は素通し(不変)。
  - 到達不能 → 直線 fallback。
- **回帰**: 既存の routePaths / wardRouteOverrides / buildTourMapPlacements 等のテストが緑のまま。
- **実機 QA**: dev `/housing/dev/routes` で、事実 4 の代表(ラベンダー 26、ラベンダー拡張 22、エンピレアム 8〜10)を開き、金線が赤い道に沿って曲がることを目視。出だし/終わりは従来通り直線であること。
- push 前: `npm run build`(vite build 込み)+ 全 `vitest run`(memory `feedback_vercel_tsc_strict`)。

## リスクと緩和

- **近道誤選択**(点が疎で交差点が密なとき、BFS が意図と違う短い道を選ぶ): ①暴走ガード(MAX_RATIO) ②エディタのライブ金線で即視認・点追加で修正 ③最終 310 実機確認、の三重で拾う。実害が残れば Dijkstra 化(将来)。
- **出だし/終わりの閾値調整**(`ONROAD_PX`): 大きすぎると道外連結まで道に吸い寄せてカクつく、小さすぎると道上のつもりの点が直線のまま。実機で目視調整。
- **パフォーマンス**: 追従は現在表示中のマップの override のみ・road 区間は ≤10 点 → ペアごとの投影+BFS は軽量。実ツアーは 1 家ずつ描画なので問題なし。

## 位置づけ

本機能は経路の見栄えを上げる仕上げ。3〜4 日のアプリ完成期限内で **YAGNI 厳守**(Dijkstra や自動 reroute には踏み込まない)。完了後、最終ゲート(build + vitest + 310 実機 + finishing-a-development-branch + ユーザー承認で main)へ。
