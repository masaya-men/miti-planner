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

### 進捗 (2026-05-22)
- ✅ ユーザーが Mist を Figma で作成し SVG 書き出し済 (layer 名 `plot_N` / `node_N` / ナビ道路 が ID として残っていて好都合)。 元 SVG は `docs/housing-maps-src/mist.svg` に保全。
- ✅ パーサ `scripts/parse-ward-svg.mjs` を作成・実行 → **`src/data/housing/mistWard.generated.json`** を生成 (houses 31 / nodes 19 / edges 27、 グラフ連結、 家→最寄りノード自動接続済、 道の生 path 入り、 全座標 0..1 正規化)。 他エリアも同パーサで再利用可。
- **次**: `MapView.tsx` を mock から `mistWard.generated.json` 駆動へ。 ① ノード/家を配置 ② 家選択→最寄りエーテライト(出発)から BFS 経路探索→道なりの SVG path→光アニメ (GSAP MotionPath / offset-path)。 まず**自動接続の精度を実画面で確認** (ユーザー要望: 精度が良ければツアーの文字行き方情報と合わせて十分かを判断)。 エーテライト座標と plot→最寄りエーテライトの対応はユーザーのスプレッドシート + SVG のエーテライト群 (named: トップマスト / ミストゲート・スクエア 等) から起こす。

### 未確認 (次セッションで要確認)
- エーテライト青い炎が**複数**ある → ミストの本アエーテライト1つ＋エーテネットシャード複数? 出発点はどれ? (ナビ起点を1つに決める or シャード経由)
- ハウスの箱の「接続 Node」 は自動で最寄りに繋ぐか、 明示するか。

---

## 7. 2026-05-23→05-25 セッション: 3 件解消 + 案 1 (Figma SVG をそのまま) 採用

### 結論 (実装済み)

当初の方針 (パーサで「visibleRoadPath」 を別出し → React で再描画) は途中まで進んだが、 ユーザーから「Figma で描いた地図 (家の模型 + 道路 + エーテライト) をそのまま使え、 赤線と Node だけ透明化して経路計算に裏で使えば良い」 と方針変更され、 **案 1 (mist.svg を inline 展開) で再実装**。

### 解決した不具合 (実装済)

1. **太い道路非表示** ✅ — `docs/housing-maps-src/mist.svg` を `src/data/housing/mist.generated.svg` にコピー、 MapView で `?raw` import → `dangerouslySetInnerHTML` で inline 展開。 Figma の `<g id="道路(Stroke)">` shape が直接描画される。
2. **アンビエント光のテレポート** ✅ — `<animateMotion>` を廃止し、 ナビ用赤線 path (`mistWard.roadPath`) を `.housing-map-overlay` に再利用して `strokeDasharray="14 28"` + `<animate stroke-dashoffset>` で「dash パターンが流れる」 演出に置換。 全 subpath で同時に流れるため瞬間移動なし。
3. **物件ナビの直線ショートカット** ✅ — パーサで `edges` を `[a, b]` → `{ a, b, polyline: [[nx,ny],...] }` に拡張 (連続ノード間の点列を保存)。 MapView は BFS の node 列を `edge.polyline` を順に連結して道なりの d を生成。

### 追加実装 (このセッション)

- **目的地アピール演出 (A+B)**: 選択中の plot に対し overlay 内で「波紋リング 2 重位相」 + 「中心ハイライト矩形 (脈打ち)」 を表示。
- **赤線 + Node の透明化**: 両方 `stroke="#FF0000"` なので CSS 1 行 `path[stroke="#FF0000"] { display: none; }` で消える (経路計算は data 側で実施)。
- **invert filter 撤廃**: Figma の元色 (家=白塗り+黒輪郭、 エーテライト=青) をそのまま見せる方針。 軽減表など他機能には影響なし (selector が housing 配下のみ)。 色変更は CSS の属性セレクタで 1〜2 行で可能。
- **inline style → CSS 統合**: MapView の wrap inline style を撤去し、 `.housing-map-wrap` の浮遊 3D 効果 (rotateX 20°, translate-55%) を復活。

### 残作業 (このセッションでは未着手 — 次のステップ)

1. **家前 Node の追加 (Figma 作業)**: 全 31 家の目の前の道路上に Node を 1 個ずつ追加 → SVG 再 export → `node scripts/parse-ward-svg.mjs ...` で再実行。 これで plot 26/27/28 (現状エーテライト直結 = 0 hop = 直線) も道なり経路になる。
2. **拡張街マップの作成 (Figma 作業)**: 5 エリア (Mist/LavenderBeds/Goblet/Shirogane/Empyreum) × 表裏 (本街/拡張街) = **10 SVG**。 拡張街は本街と地形・道路網・エーテライト配置が違うため別 SVG。 物件 doc の plot 番号は 1-30 (本街) / 31-60 (拡張街) で通し → MapView は `area + (plot ≤ 30 ? 'main' : 'sub')` で読み込む SVG を切り替え。
3. **エーテライト出発点の動的切替 (Claude 作業)**: 現状 `START_NODE = 'node_1'` 固定。 SVG 内のエーテライト座標と名前 (グループ ID 「ミストゲート・スクエア」 等) を別途パース → 家ごとの最寄りエーテライト mapping (ユーザースプレッドシートと付き合わせ) → 家選択時に START_NODE を動的切替。
4. **plot 矩形 bbox サイズを JSON に含める**: アピール矩形は今 150x110 固定。 plot サイズ (S/M/L) で本来の矩形サイズも違うため、 パーサで bbox サイズも出力して家ごとに合わせる。

### 関連ファイル

- 元 SVG: `docs/housing-maps-src/mist.svg`
- inline 用 SVG: `src/data/housing/mist.generated.svg` (mist.svg をそのままコピー)
- パーサ: `scripts/parse-ward-svg.mjs` (visibleRoadPath 抽出 + edges polyline 化)
- 生成データ: `src/data/housing/mistWard.generated.json` (houses 31 / nodes 19 / edges 27 polyline 付き / roadPath / visibleRoadPath)
- MapView: `src/components/housing/workspace/MapView.tsx`
- CSS: `src/styles/housing.css` (`.housing-map-svg-host` / `.housing-map-overlay` 追加)

---

## 8. (旧) 2026-05-23 本番デモ後の課題メモ (履歴)

以下は §7 で解消済みだが、 経緯保存のため残す:

### 不具合の正体 (確定済み)

1. **元の「厚みのある道路」 が表示されていない**: ユーザーは Figma で 「見た目用の太い道路 (`道路(Stroke)` グループ)」 と 「ナビ計算用の 1px 赤線 (`ナビゲーション用道路`、 画面非表示の想定)」 を別レイヤーで作成。 だが現状 `MapView.tsx` は **1px のナビ道路だけを描画している** (`mistWard.roadPath` がそれ)。 太い道路を抽出していない/描画していない。

2. **道全体を巡るアンビエント光が「飛ぶ」**: `<animateMotion path={roadPath}>` の path が複数 `M` (moveto) を含むため、 サブパスをまたぐ瞬間に光球がテレポート。 道路網は分岐があり 1 本の連続 path にはできない (構造的制約)。

3. **物件への光ナビが道を辿らずノード間を直線でショートカット**: BFS で得た **ノード列を直線で結んだ d** を `<animateMotion>` に渡しているため、 ノード間にある道のカーブを無視して斜めに突っ切る。

### 次セッションの具体作業 (順番に)

**A. パーサ更新** (`scripts/parse-ward-svg.mjs`):

A-1. **見た目用の太い道路を抽出** → `visibleRoadPath` を json に追加。
- SVG の `<g id="道路(Stroke)">` 内、 `<mask>` 内側の `<path d="...">` (または mask 適用側の `<path>`、 同じ d を持つ) の `d` を取得。 SVG の最初の方 (行 2〜6) にある。 fill 付きの太いシェイプとして描画用。
- 抽出ヒント: `<g id="&#233;[^>]*">` (道路 グループの encoded id) の中の最初の `<path d="...">` を拾えば良い。

A-2. **ナビ道路をエッジ単位の polyline にバラす** → `edges` を `[a,b]` だけでなく `{ a, b, polyline: [[x,y],...] }` に変更。
- 既存の subpath 走査で、 「点が最寄りノード距離 < NODE_SNAP」 になった瞬間に**ノード通過**とマーク。
- 連続通過した 2 ノード間にあった点列 (両端ノードの中心を含む) を `edge.polyline` として保存。
- これがあれば BFS のエッジ列を polyline 連結して **道なりの d** を生成できる。

A-3. パーサ再実行 → `src/data/housing/mistWard.generated.json` 更新:
```
node scripts/parse-ward-svg.mjs docs/housing-maps-src/mist.svg Mist
```

**B. MapView 更新** (`src/components/housing/workspace/MapView.tsx`):

B-1. **道路描画を `visibleRoadPath` に差し替え**。 現在の `mistWard.roadPath` (1px ナビ用) の描画は**消す or 開発時のみ表示** (`data-debug` 属性等)。 `visibleRoadPath` は太め (例: stroke-width 14、 fill あり) で描く。 housing token `--housing-honey` 系を使用。

B-2. **物件への光ナビ経路を道なりにする**。 `routePath` の生成を、 BFS の node 列から「**エッジ polyline を順に連結**」 に変更:
```ts
const ids = routeNodes(START_NODE, house.node);
const polyline = []; // 道なりの点列
for (let i = 0; i + 1 < ids.length; i++) {
  const e = edges.find(...両端マッチ);
  const seg = (e.a === ids[i]) ? e.polyline : e.polyline.slice().reverse();
  polyline.push(...(i === 0 ? seg : seg.slice(1)));  // 重複ノードを除いて連結
}
polyline.push([house.x * W, house.y * H]); // 最後に家へ
const d = polyline.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');
```

B-3. **アンビエント光の「飛び」 解消** (案を選ぶ):
- **案 1 (推奨)**: `<animateMotion>` を捨て、 道路 path に **`stroke-dasharray` + `<animate>` で流れる dash パターン**を描く (`stroke-dashoffset` を時間で変化)。 分岐や M の境目でもテレポートしない。 「道全体が呼吸する」 演出にしやすい。
- 案 2: 各サブパス (連続 polyline) ごとに **個別の `<animateMotion>` 光球**を配置 (分岐ごとに 1 個)。 実装は単純だが光球数が多い。

### C. 動作確認 → 再デプロイ → 自動接続の精度確認

A〜B 実装後、 ローカル `npm run dev` で目視 → push → 本番で:
- 太い道路が出るか
- 道なりに光が走るか (直線ショートカット消滅)
- アンビエントが滑らかか (テレポート消滅)
- 各家への経路が見栄え通りか (自動接続の精度)。 不自然な家があれば、 当該家の `node` を手動 override (json 直編集 or SVG に明示接続 layer を追加)。

### 参照ファイル (場所変わらず)
- 元 SVG: `docs/housing-maps-src/mist.svg`
- 生成データ: `src/data/housing/mistWard.generated.json` (A-3 で再生成)
- パーサ: `scripts/parse-ward-svg.mjs` (A-1/A-2 を実装)
- MapView: `src/components/housing/workspace/MapView.tsx` (B-1/B-2/B-3 を実装)
- 設計トークン: `src/styles/housing.css` (`--housing-honey` 系、 `--housing-aether` 追加済)

### 次セッション最初のコマンド (コピペ)
> `docs/housing-map-authoring-guide.md` の「7. 現状の課題と次セッションへの引き継ぎ」 を読んで。 マップデモは本番 (`lopoly.app/housing`) で動いているが、 ①太い道路が出ていない ②アンビエント光が飛ぶ ③物件ナビが直線ショートカット の 3 つを **A→B→C の順で対応**。 まずパーサ更新から。
