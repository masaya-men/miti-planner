# 設計書: 本番風・なぞって直す経路エディタ (v2)

- 日付: 2026-07-07
- ブランチ: `feat/housing-dev-tour-preview`
- 前段: `2026-07-07-housing-route-authoring-design.md`（点クリック式 v1）の作り直し
- 状態: ユーザー承認済み（方向性・描き方①なぞる・安全優先）

## 背景 / 問題

v1 の `/housing/dev/routes`（お絵かきツール）は **点を 1 個ずつクリックして打つ**方式だった（`RouteAuthoringPage.tsx:96`）。ユーザーが実際に触ったところ:

1. **ドラッグしても無反応**（空きスペースのドラッグは何も起きない仕様）→「なぞる」自然な期待に応えていない。
2. **抽象スキーマ画面**でどの家がどれか直感的でない。本番ツアーと見た目が違う。
3. **1 件ずつ Claude に確認**の運用フローが遅い。

ユーザー要望（原文）:「普通に本番っぽい画面でナビゲートされてる状態で編集させてくれませんか。時間がかかりすぎるのが嫌。300 件全部修正した状態で渡したい」。

## 目的

`/housing/dev/routes` を、**本番ツアーの見た目そのままで経路をなぞって直すエディタ**に作り替える。ユーザーが全 ~310 住所を前へ/次へで高速に流し、経路が変な家だけをその場でなぞり直し、まとめて 1 回保存できるようにする。

## 非目標 (YAGNI)

- 本番コンポーネント（`TourNavMap` / `TourNavPage`）の改変 — **一切しない**（実ツアー無傷 = 安全）。
- reroute アルゴリズム（`verbalRoute.shouldReroute`）の変更 — しない（個別 override 方針 = memory `project_housing_tour_route_fix_policy`）。
- 家の写真カード / 行き方テキスト等のフル tour chrome — 出さない（経路の正否判断に見るのは地図と光る線のみ）。将来欲しければ別途。
- 2 点クリックの自動ルーティング（案②）— 不採用（自動が変な道を選ぶ＝過去に退化）。

## アーキテクチャ（安全性の担保）

単一 DEV ページ `RouteAuthoringPage.tsx`（既存・`import.meta.env.DEV` gate）を拡張する。**本番資産は読み取り専用で再利用**する:

- **表示経路**: `buildTourMapPlacements()`（`buildTourMapPlacements.ts`）を現在の家に対して呼び、返る `routePath` / `routeJumpPath` / `origin` / `targetElId` を得る。**これは本番ツアーが描くのと完全に同じ計算**なので、エディタの表示は本番と 1px もズレない。関数は純粋・読み取りのみ＝呼ぶだけで安全。
- **見た目（CSS）**: 本番の `housing-tour-route-glow` / `housing-tour-route-core` / `housing-tour-map-origin-*` / `housing-tour-target-box` クラスをそのまま使う（`TourNavMap.tsx` と同じ）。金色に光る経路・脈打つ起点・目的地の箱ハイライトが本番同様に出る。
- **編集レイヤー**: 既存ページが持つオーバーレイ SVG（`housing-map-overlay`・地図と完全整列済み）上に、ポインタ捕捉・つまみ・道スナップだけを載せる薄い層。

> 表示は本番関数の再利用、編集は薄い上乗せ。本番の描画コンポーネント側は触らないので、実ツアーが壊れる経路はゼロ。

## 表示（本番と同一に見せる）

現在の家に対し `buildTourMapPlacements(json, mapKey, ref, currentListing, steps, currentIndex)` を呼ぶ。`ref` は `resolveWardMapRef`（`elementId` 込み）、`steps` は読み込んだ全住所（`TourPreviewPage` と同じく全 310 を仮ツアーに）、`currentIndex` はエディタの index。得られた:

- `routePath`（実線・道）/ `routeJumpPath`（弧・ジャンプ）→ 本番と同じ glow/core クラスで描画。
- `origin` → 起点脈打ちマーカー。
- `targetElId` → 埋め込み SVG の該当 plot 要素に `housing-tour-target-box` を付けて箱を光らせる（`TourNavMap.tsx:25-32` と同じ付け外し）。
- 同一マップの他ステップ番号ノード（`placed`）も出す（本番の文脈再現・任意だが低コストなので入れる）。

## 「正しい家は最初から線が入ってて飛ばせる」体験

上記の表示経路は **override があればそれ、無ければ自動経路**（`buildTourMapPlacements` が内部で分岐）。よってどの家を開いても「今この家に end-user がどう案内されているか」が最初から金の線で見える。

- 線が正しい → **次へ**（何も保存しない＝ override 作らない＝自動経路を維持）。
- 線が変 → なぞって直す（下記）。

これで 310 件を「見て、変なのだけ直す」で高速に流せる。「全部修正した状態」= 最終的に全部正しい、の意（正しい家は override 不要）。

## 編集（なぞる）操作モデル

編集ポイント列 `editPoints: RoutePoint[]`（0..1 正規化・point ごとに kind=road|jump）を家ごとにメモリ保持（既存 `pointsByKey` を踏襲）。

- **初期値**: override がある家 → `segmentsToPoints(getRouteOverride)`（つまみで微調整可能）。override 無い家 → **空**（自動経路は表示レイヤーが金線で見せているので、編集は白紙から新規トレース）。
- **なぞって描く**: 地図上で pointer down → move → up。move 中に通過点をサンプルし、**道スナップ ON なら各点を最寄り edge に吸着**（既存 `nearestPointOnPolylines` / `SNAP_PX`）。現在モード（道/ジャンプ）の kind を付ける。1 ストロークが `editPoints` に追記される。
- **道とジャンプの混在**: 道モードで道部分をなぞる → 「ジャンプ」ボタンに切替 → ジャンプ部分をなぞる。連続 kind は `pointsToSegments` が自動でまとめる（実線→弧が繋がる）。
- **微調整**: つまみドラッグ＝移動、つまみダブルクリック＝1 点削除（既存挙動を維持）。
- **描き直す**: その家の `editPoints` を空に戻す。
- **編集中の表示**: `editPoints` が非空になったら、表示経路を **editPoints から** `routeToPaths(pointsToSegments(editPoints))` で金線に描く（＝なぞった線がそのまま本番の光る線でライブに見える）。空の間は `buildTourMapPlacements` の経路（現行の自動/override）を金線で見せる。→ どちらの状態でも「金色に光る 1 本の経路」に見え、混乱がない。

## 点の間引き（トレースを綺麗な折れ線に）

なぞりは点が過剰になるので間引く。`routePaths.ts` に純関数 `simplifyPolyline(points, tolerancePx, w, h)`（Douglas–Peucker）を追加（+ 単体テスト）。

- 捕捉中: 直前サンプルから一定距離未満の点は捨てる（配列肥大の一次防止）。
- pointer up 時: そのストロークに `simplifyPolyline` をかけ、少点数の折れ線にして確定。
- 端点（起点/入口付近）は保持されるよう tolerance を控えめに。

## 保存フロー（1 件ずつ確認しない）

既存の `/__save-routes`（`vite.config.ts` の `routeSaverPlugin`）をそのまま使う。

- 編集は全家分がメモリ（`pointsByKey`）に溜まる。**何件直しても「保存」1 回で `wardRouteOverrides.generated.json` に全書き込み**（既存 `buildExport` の挙動）。
- `editPoints` 非空の家 → override 書き込み。空の家 → override 無し（自動経路維持）。既存 override を「描き直す」で空にして保存 → その override は削除。
- ヘッダに **「◯件 未保存」** インジケータを出す（`pointsByKey` の非空件数）。保存後 0 に。
- Claude への 1 件ずつ報告は廃止。ユーザーが一括で仕上げ、最後に「保存した」で Claude が `git diff` 確認。

## 触るファイル

- **主**: `src/components/housing/dev/RouteAuthoringPage.tsx`
  - 表示を `buildTourMapPlacements` + 本番 CSS クラスに差し替え（抽象スキーマ描画を撤去）。
  - なぞり操作（stroke 捕捉・スナップ・kind）。
  - override 家のみプリロード、自動家は白紙。
  - 未保存カウンタ。
- **補助**: `src/lib/housing/routePaths.ts` に `simplifyPolyline` を追加。
- **テスト**: `routePaths.test.ts` に `simplifyPolyline` のケース追加。
- **本番コンポーネント/ lib の計算**: 無改変（読むだけ）。

## テスト / 検証

- 単体: `simplifyPolyline`（直線は 2 点に畳む / 折れは頂点保持 / 端点保持）。
- 既存 71 件（routePaths / wardRouteOverrides / buildTourMapPlacements 等）が緑のまま。
- 実機 QA: dev で mist-sub 13 を本番風画面でなぞり直し → 金線がなぞり通りに出る → 保存 → `git diff` で mist-sub 13 が新点列に。
- push 前: `npm run build`（vite build 込み）+ 全 `vitest run`（memory `feedback_vercel_tsc_strict`）。

## 位置づけと段取り（3〜4 日はハウジング「アプリ」完成のための期限）

> **重要**: 「リリース」= ハウジングアプリ本体の完成・公開のこと。この経路エディタは **経路を正しくするための内部 DEV ツール**であり、それ自体をリリースするわけではない。3〜4 日はアプリ完成の期限なので、**エディタ改修は最小限で切り上げ**、経路修正（310）本編に時間を使う。エディタに凝りすぎない（YAGNI 厳守）。

1. Day 1: エディタ改修（表示の本番化 + なぞり + プリロード + 未保存カウンタ）+ `simplifyPolyline`。mist-sub 13 で実機ゲート。ここは短く。
2. Day 2–3: ユーザーが全 310 を流して変な家（44 候補中心）をなぞり直し。随時保存。＝アプリ品質を上げる本編。
3. Day 3–4: 経路 override 確定 → `npm run build` + 全 vitest 緑 → 未コミット 16 ファイルと合わせて整理 → finishing-a-development-branch → ユーザー承認で main へ（アプリ完成に寄与）。

## 改訂 (2026-07-07 実装フェーズで方針転換・実装済み)

実装後の実機確認でユーザーから重要な UX 修正が入り、以下に転換した (memory `feedback_design_assumption_revalidate` = 承認後も実装フェーズで UX 再点検):

1. **地図だけの黒画面(Option X)は却下 → フル本番ツアー画面に載せる**。本番の3カラム(進捗パネル/中央地図/住所・行き方カード)を `TourProgressPanel` / `TourNextDestinationPanel` の**表示専用再利用**で組み、中央地図だけ編集可能に。→ 「今どの家を直してるか」が右カードで一目瞭然・レイアウトが本番グリッドで安定(黒画面の CSS ガタつき解消)。
2. **ドラッグでなぞる → クリックで点を置く方式**。道モード=道の上をクリック(道スナップで赤線=道中心に吸着)、ジャンプモード=**踏切→着地の2点クリックで弧**。1つ戻す/この家を白紙に(override家も真に空へ)/点ドラッグ微調整/ダブルクリック削除。
3. **ジャンプの弧を高く(`ARC_K` 0.22→0.4)** = よりジャンプらしく。本番ツアーのジャンプ表示も同時にジャンプらしくなる(共有 `arcJumpPath`)。

実装コミット: 弧 ARC_K / エディタ全面刷新(フル画面+クリック配置) / 白紙化=真の空バグ修正。実機検証済(3カラム/住所表示/クリック3点/ジャンプ2点弧/エラー0、本番 tour-preview と1px一致)。

### 繰延: 「道なり自動追従」(2026-07-07 ユーザー合意 = 後から追加)

- **現状の制約**: override(手描き)は**置いた点を直線で結ぶだけ**。カーブした道で点が疎だと直線が道からはみ出る(`routePaths.roadSubpath` は M/L 直線・道の曲がりは追わない)。自動経路(override 無し)は元々 `buildSnappedRoutePoints` が赤線を辿るので道の中心を通る。
- **要望**: 点の間を赤い道(edges)の曲がりに沿わせ、雑にクリックしても道中心を通るようにする。`nearestPointOnPolylines` は `edgeIndex/segIndex/t` を返す(`mapGeometry.ts:2`)ので実装可能。
- **段階案**: ①同一 edge 内の2点間は edge polyline を完全追従 ②別 edge をまたぐ時は分岐点を1回クリック(または将来 edge グラフ Dijkstra で自動)。**起点→ゴールを全自動ルーティングする reroute とは別物**(ユーザーが置いた点の間だけを繋ぐので安全)。
- **互換性**: 保存形式(`segments: {kind, points}`)は不変。後付けしても**今保存済みの経路はそのまま有効・触らない**。新規/再編集時のみ道追従を効かせる方針。ユーザーは「もう310修正を始めた」ので後から足す。
- **ユーザーへの当面ガイド**: 「エディタの金線 = 本番の線」なので**金線が道に乗って見えていれば正解**。カーブは点を複数置いて金線を道に乗せる(疎すぎ注意)。

## 未確定 / 実装時に確認

- `buildTourMapPlacements` に渡す `steps` を全 310 にすると各マップで他ステップ番号ノードが出る。文脈として良いが煩雑なら現在の家のみに絞る（実装時に実機で判断）。
- なぞり中に既存表示経路（自動）を薄いガイドとして残すか、editPoints 非空で即差し替えるか（実機で見やすい方に）。
