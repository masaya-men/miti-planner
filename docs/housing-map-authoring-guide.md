# ハウジング 地図(マップビュー)の作り方ガイド

> 2026-05-22 作成。 マップビューを「mock デモ」から「実データの地図」へ育てるための設計レクチャー。
> 次セッションはここを読めば、 地図の現状・FF14 の構造・実装手順がわかる。

---

## 1. いまの地図はどうなっているか (mock デモ)

ファイル:
- 描画: `src/components/housing/workspace/MapView.tsx`
- 配置データ: `src/data/housing/sampleWardLayout.ts` (`SAMPLE_WARD_LAYOUT`)
- 物件データ: `src/data/housing/mockListings.ts` (`MOCK_LISTINGS` ← **偽データ**)
- 背景画像: `public/housing/maps/sample-ward.png` (**1 区画ぶんのサンプル画像 1 枚だけ**)

仕組み:
1. 背景画像を 1 枚表示する。
2. `SAMPLE_WARD_LAYOUT` は 30 区画 (plot 1〜30) の **正規化座標 (x,y = 0〜1)** をベタ書きした配列。 各区画に mock 物件 id が紐付く。
3. `MapView` は「listingId がある区画」だけ `MapBubbleCard` を画像の上に絶対配置する。

**重要な制約 (現状)**:
- 地図は **mock_listings(偽データ) を見ている**。 実際にユーザーが登録した物件 (Firestore) は**地図に出ない**。 一覧 (リスト) ビューだけが実データ。
- 背景は **1 エリアの 1 区画ぶんの画像**のみ。 全エリア・全 ward に対応していない。
- 座標は手書きの 30 個。 アパート/個室は含まれない。

つまり「地図を作る」= この mock を **(A) 実データ駆動** にして **(B) 全エリアの区画座標** を用意し **(C) アパートも置ける** ようにすること。

---

## 2. FF14 の住所構造 (これを知ると設計が一気に簡単になる)

- 住宅街(エリア)は **5 つ**: Mist / The Lavender Beds / The Goblet / Shirogane / Empyreum。
- 各エリアに **ward(区) 1〜30+**。 さらに **サブディビジョン(拡張街)** があり、 plot は通し番号で **1〜30(本街) + 31〜60(拡張街)** (このプロジェクトの `PLOT_RANGE = 1..60`)。
- **★最重要**: **同じエリア内では、 どの ward でも区画の物理レイアウトは同一**。 Mist の ward1 の plot 5 と ward8 の plot 5 は、 マップ上の**同じ位置**にある (ゲームが同じ地形を instance で使い回しているため)。
  - → **ward 番号ごとに座標を作る必要はない**。 **エリアごとに 1 セットの「plot→座標」表**があれば、 全 ward をカバーできる。 ward 番号は「どの ward のデータを表示するか」 のフィルタにすぎない。
- **アパート**: 各 ward に **アパルトメント(集合住宅)** があり、 **号棟(1 or 2)** で表(本街)/裏(拡張街) に分かれる + 部屋番号(1〜90)。 マップ上ではアパート棟の**建物位置(エリアごとに固定)**に 1 つ置けばよい (個々の部屋は同じ建物に集約)。

→ 必要なのは「道の中心線や交差点ノードのグラフ」ではなく、 **エリアごとの『plot 番号 → 正規化座標』ルックアップ表** (＋アパート棟の座標)。 これだけで全物件をマップに置ける。

---

## 3. 作り方 — 推奨の最小手順 (段階的)

### Step 1: エリアごとの背景画像を用意
`public/housing/maps/{area}.png` を 5 エリアぶん (本街/拡張街で分けるなら 10 枚)。 FF14 のミニマップ or 俯瞰図を素材に、 縦横比を固定。

### Step 2: エリアごとの「plot→座標」表を作る (= 一番の手作業)
`sampleWardLayout.ts` を一般化して、 例えば:
```ts
// src/data/housing/wardLayouts.ts
export interface PlotSpot { plot: number; x: number; y: number; } // x,y は 0..1 正規化
export const WARD_LAYOUTS: Record<HousingArea, PlotSpot[]> = {
  Mist: [ { plot: 1, x: 0.12, y: 0.18 }, ... 60 件 ],
  LavenderBeds: [ ... ],
  Goblet: [ ... ],
  Shirogane: [ ... ],
  Empyreum: [ ... ],
};
export const APARTMENT_SPOT: Record<HousingArea, { x: number; y: number }> = {
  Mist: { x: 0.50, y: 0.90 }, ...
};
```
座標の取り方 = **オーサリング用ツール**を作ると楽 (Step 4)。 無ければ画像をピクセル定規で測って `px ÷ 画像幅 = x` で正規化。

### Step 3: マップを実データ駆動にする
`MapView` を mock から実ストアへ。
1. 表示中の (エリア, ward) を state で持つ (エリア/ward セレクタ。 FilterPanel と連動)。
2. `useHousingListingsStore` の実物件から、 その (エリア, ward) のものだけ抽出。
3. 各物件の `plot` で `WARD_LAYOUTS[area]` を引いて座標を得る → `MapBubbleCard` を配置。
4. **アパート物件** (`buildingType==='apartment'`) は `plot` が無いので `APARTMENT_SPOT[area]` (＋号棟で表/裏 2 ヶ所) に置く。
5. 背景画像も選択エリアに合わせて差し替え。

これで「登録 → リストにもマップにも出る」 が実現。 `galleryAdapter` の plot/size 必須除外 (アパートが消える件) も、 マップ表示用には別アダプタ or 条件緩和で対応 (memory/TODO の④参照)。

### Step 4 (任意): オーサリングツール
管理画面に「マップ上をクリックすると、 その正規化座標 (x,y) を表示/コピーできる」 簡易ツールを置くと、 Step 2 の 60×5 個の座標入力が劇的に楽になる。 `onClick` で `e.offsetX / img.width` を出すだけ。

### Step 5 (将来・任意): 凝ったツアー地図
TODO 旧メモの「道中央線 + 交差点ノード + ノード/エッジツール」 は、 **区画間をたどるルート(ツアー動線)を引く**ための高度機能。 物件を置くだけなら不要。 ツアー演出を作り込む段階で別途設計する (Allmarks の知見も参照: memory `reference_allmarks_mycollage`)。

---

## 4. データモデルの判断ポイント

- 物件 doc に **マップ座標を保存しない** のが推奨。 (エリア, plot) から `WARD_LAYOUTS` で**導出**する。 座標を doc に焼くと、 地図画像を差し替えたとき全 doc がズレる。
- 例外: 「マップクリックで登録」 を入れる場合でも、 保存するのは (エリア, ward, plot) のままにし、 クリック位置→最寄り plot に**スナップ**して plot を決めるのが綺麗。

---

## 5. まとめ (このガイドの結論)

1. 地図は今 **mock(偽データ・1 画像・手書き 30 座標)**。 実物件は出ていない。
2. FF14 は **エリア内のレイアウトが ward 共通**なので、 **エリアごとの plot→座標表 (1〜60) ＋ アパート棟座標**さえ作れば全物件を置ける。 ward ごとの座標は不要。
3. 手順: ①エリア背景画像 ②plot 座標表 ③MapView を実ストア駆動 ④(任意)クリック座標ツール ⑤(将来)ツアー動線。
4. 座標は **doc に保存せず (エリア,plot) から導出**。

関連: `docs/TODO.md` の Phase 2B メモ / ④ アパート対応 / `src/data/housing/sampleWardLayout.ts` (現 mock の雛形)。

---

## 6. 光ナビゲーション(道なぞりアニメ)用のデータと作り方 — Figma からの変換

ユーザーは Figma (ページ「ミスト_本格テスト」) で以下を分けて作成済み:
- **image 1**: ベースマップ画像 (非表示レイヤー)
- **ハウス**: 各 plot の箱。 「Plot N」 と番号付き
- **Node**: 道の交差点・分岐点 (赤い丸)
- **ナビゲーション用道路**: Node 間を結ぶ中心線 (= グラフの辺)。 ※「道路(Stroke)」 は見た目用の太い道で、 ナビ計算には使わない
- **エーテライト**: 出発点 (青い炎)

### 必要なデータ構造 (アプリが光を家まで走らせるために)
```ts
// 0..1 正規化座標 (マップ画像の intrinsic box 基準)
interface MapNode { id: string; x: number; y: number; }
type MapEdge = [nodeIdA: string, nodeIdB: string];   // 無向の道セグメント
interface HouseSpot { plot: number; x: number; y: number; nodeId: string; } // nodeId=玄関が接する最寄り Node
interface Aetheryte { x: number; y: number; nodeId: string; }               // 出発 Node
```
これがあれば: 家を選ぶ → その `nodeId` を得る → `Aetheryte.nodeId` から **経路探索 (BFS/ダイクストラ)** で Node 列を出す → その座標列を **SVG パス**にして **光を走らせる** (最後に家へ1ホップ)。

### 「これだけで使えるか」 の答え
**素材としては OK。 ただし変換が要る。** 特に必要なのは:
1. 各 Node の座標 (id 付き)
2. **どの Node とどの Node が道でつながっているか (辺)** ← 絵では線だが、 データでは Node ペアの明示が要る
3. 各ハウスがどの Node に接続するか (最寄り Node)
4. グラフが連結であること (エーテライトから全 plot に到達できる)

### Figma → データ への変換方法 (推奨順)
- **(推奨) フレームを SVG エクスポート**: Node=円, ナビ道路=線(polyline/path), ハウス=矩形 として座標が全部入る。 このファイル(または中身)をもらえれば、 こちらでパースして上記データを自動生成できる (円→Node、 線の端点を最寄り Node にスナップ→辺、 矩形+「Plot N」名→HouseSpot)。 トークン不要。
- **命名規則を付けると変換が確実**: ハウスは `plot-1`〜`plot-60`、 Node は `n1`,`n2`...、 エーテライト は `aetheryte`。 (今は「Plot 1」表記なので、 SVG でも名前が残るよう layer 名を `plot-1` 等に揃えると安全)
- 代替: Figma の Dev Mode で各要素の x,y,w,h を見て手入力 (数が多いと大変)。 または将来アプリ内に「クリックで座標取得」ツール。

### 座標の正規化
Figma 上の絶対座標を、 ベースマップ画像の左上(0,0)〜右下(1,1) に正規化する。 `x_norm = (shape.x - image.x) / image.width` (y も同様)。 SVG エクスポートなら viewBox 基準で割れば出る。

### 光アニメの実装方針 (とても実現可能)
- 経路の Node 座標列から SVG `<path>` (または polyline) を生成。
- 光の走行: **GSAP MotionPathPlugin** でドット/グローをパス上に走らせる、 または CSS `offset-path: path(...)` + `offset-distance` アニメ、 もしくは `stroke-dasharray`/`stroke-dashoffset` で「線が伸びる」 演出。 グローは `filter: drop-shadow` か SVG blur。
- ハウジングは独自トンマナ (ハニーゴールドの灯火) なので、 光の色は `--housing-*` トークン。 メインアプリの GSAP 知見は Allmarks(マイコラージュ) 流用可 (memory `reference_allmarks_mycollage`)。

### 次アクション
1. ユーザー: 「ミスト_本格テスト」 フレームを **SVG でエクスポート** (または各レイヤーを書き出し)。 可能なら layer 名を `plot-N` / `nX` / `aetheryte` に。
2. Claude: SVG をパース → `src/data/housing/wardLayouts.ts` (Node/Edge/House/Aetheryte) を生成 → MapView を実データ＋経路探索＋光アニメに改修。
3. 1 エリア (Mist) で動けば、 残りエリアは同じ手順を繰り返す。

### 未確認 (次セッションで要確認)
- エーテライト青い炎が**複数**ある → ミストの本アエーテライト1つ＋エーテネットシャード複数? 出発点はどれ? (ナビ起点を1つに決める or シャード経由)
- ハウスの箱の「接続 Node」 は自動で最寄りに繋ぐか、 明示するか。
