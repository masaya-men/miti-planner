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
