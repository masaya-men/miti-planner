# 探す地図② カード配置刷新（案B）+ 大量部屋パネル 設計書

- **日付**: 2026-07-12
- **対象**: 探すページ 地図表示モード（`src/components/housing/browse/map/**` + `src/styles/housing.css` の `.housing-bmap-*`）
- **ブランチ**: `integration/housing-big3`
- **前提議論**: `docs/.private/2026-07-12-browse-map-feedback.md` の §②-b / §②-c（案B確定・ユーザー承認済み）
- **トンマナ**: ハウジング独自（質感A案＝濃紺フラット面 / 2アクセント / AI風ピル回避 / 余白リズム / 全 token 経由）。既存 LoPo 白黒ルールは対象外。

---

## 1. ゴール

探す地図モードの2つの課題を、案B（ユーザー確定）で解消する。

1. **②-c カサカサ根治 + 家と一体ズーム**: マーカー上のカードが地図とズレて震える現象をなくし、カードを家と完全に一緒にパン/ズームさせる。ホバー/フォーカスでは必ず読めるサイズに膨らみ、ボタンも押せる。
2. **②-b 1スポット大量部屋**: 1つのスポットに数十〜最大512室（FC個室）/ 90室（アパート）が集約されるケースを、`◀ 1/N ▶` の1件送りでなく専用スクロールパネルで見せる。

実装順: **②-c を先に**（配置・カサカサ・重なり）→ **②-b**（大量部屋パネル）。

---

## 2. 現状アーキテクチャ（変更前）

### 2.1 レイヤ構成（[BrowseWardMap.tsx](../../../src/components/housing/browse/map/BrowseWardMap.tsx)）

- `.housing-bmap-wrap`（`overflow:hidden`・パン/ズームの pointer ハンドラ）
  - `.housing-bmap-stage`（地図SVG。`transform: translate(tx,ty) scale(actualScale)` で動く。ズーム面）
  - `.housing-bmap-markers`（`inset:0`・`pointer-events:none`・**scale を掛けない**別レイヤー）
    - `.housing-bmap-marker-pos`（各マーカー。`transform: translate(sx, sy)` で**画面座標**に置く）
      - `.housing-bmap-card`（= `MapSpotCard` → フル `ListingCard`。`scale(0.5)` ⇄ `scale(1)`）

### 2.2 カサカサの原因（§②-c で確定）

マーカーの画面座標を [BrowseWardMap.tsx:331-332](../../../src/components/housing/browse/map/BrowseWardMap.tsx#L331-L332) で
`sx = m.x * actualScale + view.tx` と**毎フレーム React が再計算**して当てている。一方、地図SVGは親の
CSS transform 一発でなめらかに動く。両者の更新タイミングが1コマずれて「震え」が出る。flip 閾値
（180ms transition）跨ぎの flip-flop も一因。

### 2.3 現状の付帯挙動（案Bで壊してはいけないもの）

| 挙動 | 実装箇所 | 案B後の扱い |
|---|---|---|
| ホバー意図確認 140ms / 離脱猶予 100ms | [MapSpotCard.tsx:10-15](../../../src/components/housing/browse/map/MapSpotCard.tsx#L10-L15) | 維持 |
| focus 即拡大 | `expandImmediately` | 維持 |
| 常時1枚マウント（mount/unmount チャーン無し） | [MapSpotCard.tsx:37-55](../../../src/components/housing/browse/map/MapSpotCard.tsx#L37-L55) | **必須維持**（クラッシュ再発防止） |
| パン/ピンチ中は拡大しない | `gestureActiveRef` | 維持 |
| カード/マーカー上の pointerdown はパンにしない | `closest('.housing-bmap-marker-pos')` [L186](../../../src/components/housing/browse/map/BrowseWardMap.tsx#L186) | **class 名維持**で継続 |
| 空白クリックで閉じる（closest 判定） | `onBlankClick` [L241-248](../../../src/components/housing/browse/map/BrowseWardMap.tsx#L241-L248) | 維持 |
| Esc で閉じる | [MapSpotCard.tsx:174-181](../../../src/components/housing/browse/map/MapSpotCard.tsx#L174-L181) | 維持（パネル優先の調整あり） |
| 端クランプ | [mapCardClamp.ts](../../../src/lib/housing/mapCardClamp.ts) | **座標系変換して流用** |
| flip（`data-flip-x/y`・`FLIP_MARGIN_X/Y`） | [BrowseWardMap.tsx:333-338](../../../src/components/housing/browse/map/BrowseWardMap.tsx#L333-L338) | **廃止** |
| 三角しっぽ `::after` | housing.css `.housing-bmap-card::after` | **廃止** |
| `◀ 1/N ▶` 送り | [MapSpotCard.tsx:207-229](../../../src/components/housing/browse/map/MapSpotCard.tsx#L207-L229) | **廃止**（パネルへ） |

### 2.4 データ層で確認した事実

- **スポットへの集約は既に済んでいる**（[browseMapSpots.ts:57](../../../src/lib/housing/browseMapSpots.ts#L57) `groupListingsByMapSpot`）:
  - アパート → ワード内の全部屋が highlightPlot=1 の1 `apart` スポットに集約（`spot.listings` に全室）
  - FC個室 → 家全体と個室が同じ `plot:N` スポットに集約（`resolveWardMapRef` は個室も親家の plot を返す [resolveWardMapRef.ts:33-39](../../../src/lib/housing/resolveWardMapRef.ts#L33-L39)）
- したがって **専用パネルは `spot.listings` をそのまま描くだけでよい**。`findChambersInPlot` / `findApartmentRoomsInWard`（Firestore 再取得・非同期・`limit(50/20)`・フィルタ無視）は**使わない**。手元データの方が「地図＝一覧と同じフィルタ結果」の原則に一致する。
- **最大件数（FF14 一次情報で裏取り済み）**: アパート = 1棟90室 / FC個室 = 1ハウス最大512室。コードの `APARTMENT_ROOM_RANGE {max:90}` / `PRIVATE_CHAMBER_RANGE {max:512}`（[room-types plan L47-48](../plans/2026-05-18-housing-room-types.md)）は正しい。パネルは**最大512室**を想定して性能設計する。

---

## 3. ②-c 設計: カードを地図面へ

### 3.1 レイヤの移動

カードを `.housing-bmap-markers`（画面座標・非 scale）から、**地図SVGと同じ変形が掛かる面**へ移す。

- 新 container `.housing-bmap-card-plane` を `.housing-bmap-stage` と**同一の transform**（`translate(tx,ty) scale(actualScale)`・`transform-origin:0 0`）で動かす。`.housing-bmap-stage` の兄弟として `.housing-bmap-wrap` 直下に置き、同じ `view` から算出した同じ transform 文字列を当てる（stage と card-plane は必ず同じ値になる）。旧 `.housing-bmap-markers` レイヤーはこの card-plane に置き換わる。
  - `pointer-events`: card-plane 自体は `none`（地図パンを透過）、カード（`.housing-bmap-card`）だけ `auto`（現状踏襲）。plane が地図を覆っても pointerdown は wrap のハンドラへ届く。
  - 幾何の確認: `m.x/m.y` は SVG viewBox 座標。card-plane の transform は stage と同一なので、区画座標 `translate(m.x,m.y)` の画面位置 = `m.x×actualScale+tx` = 旧 `sx` に一致（位置は変えず、算出を per-frame JS → CSS 継承に移すだけ）。
- 各マーカーラッパ `.housing-bmap-marker-pos` は、**画面座標 `translate(sx,sy)` をやめ、区画座標 `translate(m.x, m.y)`（`markers[].x/y` の生値）に置く**。view 依存の per-frame 計算は消える。
  - → 地図と card-plane が同じ CSS transform で動くので、家とカードが完全一体でパン/ズーム。**カサカサ根治**。
- `.housing-bmap-marker-pos` の**クラス名は維持**（pointerdown / 空白クリックの `closest` 判定がそのまま生きる）。
- pointer ハンドラの構造は不変: card-plane 上の pointerdown も wrap へバブルし、`closest('.housing-bmap-marker-pos')` でカードはパン対象外、地図SVG上はパン対象。既存の `gestureActiveRef` / `downPointerCount` はそのまま。

### 3.2 通常時（未ホバー）のサイズ

- カードは区画中央にアンカー: `translate(-50%, -50%)`（しっぽ無しなので下端合わせ不要）、`transform-origin: 50% 50%`。
- ローカル scale = `--housing-bmap-scale-collapsed`（k0・現状 0.5 を踏襲。token 維持）。
- 画面上の実サイズ = `cardCSS幅 × k0 × actualScale`。→ 遠目（fit）で小さく、ズームで大きく（§②-c「遠目では小さく、ズームで大きく」）。
- **注意**: 旧モデルは非 scale レイヤーだったので fit でも 0.5×198≒99px だったが、新モデルは fit（actualScale≒0.42）で 0.5×0.42×198≒42px と小さくなる。k0 は token のまま**実機で微調整**（下限が必要なら別途検討・本 spec では固定値の調整で足りる想定）。

### 3.3 ホバー/フォーカス時（pop）

**同じカード1枚**を、地図倍率を打ち消して「画面固定の読めるサイズ」まで膨らませる。別レイヤーに作り直さない（動画の再マウント無し＝チャーン無し）。

- ローカル scale を `k0` → **`1 / actualScale`** に切り替える。画面上の実 scale = `(1/actualScale) × actualScale = 1` = 一覧カードと同じフルサイズ。どの地図倍率でも popped は常に同じ読めるサイズ。
- `actualScale` は BrowseWardMap が保持済み。card-plane に CSS 変数 `--housing-bmap-scale-inv: {1/actualScale}` を JS で立て、`.housing-bmap-card[data-expanded="true"]` が `scale(var(--housing-bmap-scale-inv))` を使う（`calc(1 / var(...))` はブラウザ差があるため JS 側で逆数を計算して渡す）。
- `transform-origin: 50% 50%`（中央から膨らむ）。z-index で他スポットの上へ（現状の `:has([data-expanded])` リフトを card-plane 内で踏襲）。
- 1枚だけ膨らむので重なり・カサカサは起きない（§②-c）。
- flip は廃止（中央配置＝方向バイアス無し）。`data-flip-x/y` prop / `FLIP_MARGIN_X/Y` / `::after` を削除。

### 3.4 端クランプ（popped 1枚のみ）

popped は画面固定サイズなので、コンテナ端で見切れうる。現行 [mapCardClamp.ts](../../../src/lib/housing/mapCardClamp.ts) を流用しつつ座標系を変換する。

- clamp 計算は**画面 px**で行う（入力: マーカー画面座標 `sx=m.x×S+tx` / `sy` はここでだけ算出、コンテナ実寸、popped の画面実寸=フルサイズ）。flip 廃止に伴い `flipX/flipY` 引数は落とし、中央アンカー前提（`left = markerX - cardW/2` 等）に単純化する。
- 得た `dx/dy`（画面 px）を **`÷ actualScale`** して card-plane 内の平行移動量に変換し、CSS 変数 `--housing-bmap-clamp-x/y` として当てる（card-plane が ×S するので画面上は `dx/dy` になる）。
- popped は1枚だけなので、clamp のための画面座標算出（`sx/sy`）はその1スポットだけ実施すればよい（全マーカー per-frame 計算の復活ではない）。

### 3.5 backdrop-filter リスク（実機審査項目）

`.housing-bmap-card` の `backdrop-filter: blur(8px)` は、変形（scale）した祖先の入れ子だとブラウザにより背景参照が崩れることがある。

- 対応方針: 実機で崩れを確認したら、popped カードは**濃紺ソリッド地**（`--housing-panel-bg-solid` 相当）へ寄せてぼかしを外す。質感A案は元々ソリッド寄りなのでトンマナ上の違和感は無い。
- 通常時の極小カードはぼかしがほぼ視認されないため、そもそもぼかしを外す選択も可（実機判断）。

---

## 4. ②-b 設計: 大量部屋パネル（A案スライドオーバー）

### 4.1 発火条件

- スポットの `spot.listings.length >= 2` → **クリックでパネルを開く**（アパート・FC個室が自然に該当。稀な「1区画に家全体が重複登録」も同一扱いで一貫）。
- `length === 1` → パネル無し。従来どおりホバーで膨らみ、カードのクリックは `ListingCard` 自身の詳細遷移（現状維持）。
- 複数スポットのホバー pop は**代表（`spot.representative` = 最新確認）**を膨らませ、`他N件を見る` の静かな導線（ヘアライン下のグレー文字リンク〜小 chip・AI風ピル回避）を出す。クリックでパネル。
  - クリックの分岐: 複数スポットはカードクリックを**詳細遷移でなくパネル起動**にする（`ListingCard` の onClick より前で intercept）。単発は従来どおり詳細へ。

### 4.2 パネルの器（A案・承認済み）

- `.housing-browse-map-view` にオーバーレイ子 `.housing-bmap-roompanel` を重ねる。**地図はマウントしたまま裏に残す**（ズーム/パン位置を保持、`戻る`で同じ地図へ即復帰）。
- 入場/退場は軽いスライド＋フェード（duration 180-200ms・token 経由）。スマホは下から上がるシート（既存 MobileBottomSheet 相当の見せ方に寄せる。実装は本パネル内で完結）。
- 構成:
  - **ヘッダー**: `戻る`（`ChevronLeft` + ラベル）+ タイトル。
    - アパート: タイトル = 棟名（例「アパルトメント（本街）」）。i18n キー。
    - FC個室: タイトル = 「区画N の個室」等。i18n キー。
  - **本文（スクロール領域）**:
    - FC個室のとき: 一番上に**家全体の詳細カード**（`spot.listings` から `roomKind` 未設定＝家全体を抽出）→ ヘアライン区切り＋「個室 N件」の静かな見出し → 個室グリッド（`roomKind==='private_chamber'`）。家全体が未登録なら省略し個室グリッドのみ。
    - アパートのとき: 親家なし、部屋グリッドのみ（全て `apartment_room`）。
  - 部屋カード = 一覧と同じ `ListingCard`（生きたカード・♡・ツアー追加 `onAddToTour` 全て同一）。グリッドは一覧グリッド（`--housing-listing-card-min-w` の `minmax`）を踏襲。
  - **端フェード**: スクロールの上下端は**スクロールバーでなくフェード**（既存 `--housing-tour-steps-fade` パターンの mask-image グラデを流用）。

### 4.3 データの振り分け

- パネルは `spot.listings`（既に最新確認 desc でソート済み）から:
  - 家全体 = `l.buildingType==='house' && l.roomKind===undefined`
  - 個室 = `l.roomKind==='private_chamber'`
  - アパ部屋 = `l.roomKind==='apartment_room'`
- Firestore 再取得はしない。フィルタ済み＝一覧と一致。

### 4.4 性能（最大512室）

- グリッドのセルに `content-visibility: auto` + `contain-intrinsic-size`（[[reference_perf_content_visibility]]・#59実証）を当て、画面外カードの描画をスキップして軽く保つ。
- 実際の登録数は最大より遥かに少ない想定だが、worst-case 512 でカクつかないことを実機で確認。将来的な react-window 等の仮想化は本 spec では入れない（content-visibility で足りるか実機判断）。

### 4.5 パネルの状態管理

- `BrowseMapView` に `panelSpotKey: string | null` を追加。複数スポットのクリックで set、`戻る`/Esc で null。
- パネル表示中は地図の `expandedKey` は無関係（パネルが地図を覆う）。ワールド/area/ward/mapKind 変更時は `panelSpotKey` も null にリセット（`expandedKey` と同様の理由）。
- Esc の優先順位: **パネルが開いていればパネルを閉じる**（カードの Esc より優先）。パネル未表示なら従来どおり popped を閉じる。

---

## 5. 実装後の実機総点検（memory `feedback_structural_refactor_runtime_audit` 準拠）

座標基準が screen→map に変わる構造変更。テスト緑＋レビュー通過でも実挙動が壊れうるため、実機で1件ずつ確認する:

1. **カサカサ**: パン/ズーム中にカードが家と完全一体で動く（震えない）。
2. **一体ズーム**: ホイール/ピンチでカードが家と一緒に拡縮する。
3. **ホバー pop**: どの倍率でも popped が読めるフルサイズ。ボタン（ツアー追加/♡/詳細）が押せる。
4. **clamp**: 端スポットの popped が見切れない（下端 CTA が残る）。
5. **flip 廃止の副作用**: 端でも破綻しない（中央アンカー＋clamp で収まる）。
6. **pointer capture**: カード上ドラッグでパンしない / 地図上ドラッグでパンする / ピンチOK。
7. **空白クリック**: 地図の空白で popped が閉じる。カード上クリックで閉じない。
8. **クリック拡大/遷移**: 単発=詳細遷移 / 複数=パネル起動。
9. **ツアー追加**: popped からもパネルからも追加できトーストが出る。
10. **パネル**: 発火（2件以上）/ 戻る / スクロール / 端フェード / FC家全体+個室の並び / 最大512室で軽い。
11. **Esc**: パネル優先で閉じる → 次いで popped。
12. **backdrop-filter**: popped の背景が崩れない（崩れたらソリッド地へ）。

---

## 6. 触るファイル（見込み）

- `src/components/housing/browse/map/BrowseWardMap.tsx` — card-plane 追加、marker-pos を区画座標へ、flip 撤去、actualScale 逆数を CSS 変数で供給、popped 用 clamp の画面座標算出。
- `src/components/housing/browse/map/MapSpotCard.tsx` — flip prop 撤去、`◀1/N▶` 撤去、複数スポットの「他N件」導線＋クリック分岐、clamp 変換。
- `src/components/housing/browse/map/BrowseMapView.tsx` — `panelSpotKey` state、パネル描画、リセット配線、Esc 優先。
- **新規** `src/components/housing/browse/map/RoomListPanel.tsx`（仮）— 大量部屋パネル本体（ヘッダー/家全体/グリッド/フェード）。
- `src/lib/housing/mapCardClamp.ts` — flip 引数撤去・中央アンカー前提へ単純化（座標系変換は呼び出し側で ÷scale）。
- `src/styles/housing.css` — `.housing-bmap-card-plane` / popped の逆スケール / `::after` 撤去 / `.housing-bmap-roompanel` 一式（全 token 経由）。
- `src/locales/{ja,en,ko,zh}.json` — パネルのタイトル/戻る/「他N件」/見出し等の i18n キー（4言語 parity）。

---

## 7. スコープ外・既知の隣接課題

- **詳細ページの「他の部屋」truncate**: `findApartmentRoomsInWard` `limit(20)` / `findChambersInPlot` `limit(50)` は実最大（90/512）を下回るため詳細ページ側では切り捨てが起きる。本 spec のパネルは `spot.listings` を使うため影響を受けないが、詳細ページの limit 見直しは**別タスク**として記録する（`docs/TODO.md`）。
- **ダミー seed の削除**: `scripts/seed-housing-overlap-dummy.mjs`（Mana/Anima Mist 1区・`ownerUid=dev-dummy-overlap`）は②が全部終わり最終確認できたら `--clear` → script 削除 → main 反映 → `firebase deploy --only firestore`。
- k0（通常時サイズ）の下限クランプ・resting カードの動画を止めるか等の微チューニングは実機判断（本 spec では固定値調整で足りる想定）。

---

## 8. テスト方針

- 純関数/振り分け: `spot.listings` → 家全体/個室/アパ部屋の分類、発火条件（`length>=2`）をユニットテスト。
- clamp: flip 撤去後の中央アンカー clamp を数値テスト（既存 `mapCardClamp` テストを更新）。
- コンポーネント: パネル開閉・戻る・Esc 優先・複数/単発のクリック分岐を Testing Library で（jsdom で pointer/scale の実挙動は再現不可なので**実機総点検（§5）が最終ゲート**）。
- push 前に `npm run build` + `vitest run`（[[feedback_vercel_tsc_strict]]）。
