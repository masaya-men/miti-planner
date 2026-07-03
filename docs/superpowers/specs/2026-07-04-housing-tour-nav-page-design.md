# ハウジングツアー「ツアー中（ナビゲーション）」ページ 設計書 — M1

- 作成: 2026-07-04
- 対象マイルストーン: **M1 = 最小の動くツアー（ミストのみ）**
- 親ロードマップ: `docs/.private/2026-07-01-housing-tour-rebuild.md`（M1〜M6）
- 参考UI（構造の設計図）: `C:/Users/masay/Downloads/HousingTour_theme/ChatGPT Image 2026年5月29日 23_06_56 (5).png`
- 質感（見た目の正典）: `docs/.private/housing-tour-mockup/index.html`（動画背景＋ガラス＋ハニー）＋ 再構築ページの「質感A案」

## 1. 目的（このページで達成すること）

新シェルの `/housing/tour` に「ツアー中（ナビゲーション）」ページを実装し、**お気に入り→ツアー開始→地図で案内・進行が連動する体験を端から端まで通す**。現状は開始配線済みだが着地先が ComingSoon プレースホルダ＝器が無いだけ。M1 でこの器を作る。

**成功の定義**: お気に入りからツアーを開始すると `/housing/tour` に遷移し、（ミストの物件について）地図上に訪問先が番号ノードで並び、現在の目的地へ光ナビ経路が引かれ、前へ/到着/次へで進行と地図が連動し、各目的地の情報を見られ、必要なら報告でき、終了できる。

## 2. スコープ（案B・コア3カラム）

**入れる（M1）**:
- 新ページ `/housing/tour`（新シェル `HousingShell` の `Outlet` 子ルート）。ComingSoon を置き換え。
- **左カラム=進捗**: 進捗リング（％）、`N/総数 軒目` バッジ、到着済み・残りの軒数、次に訪れる場所カード、最近訪れた場所、ツアーを終了ボタン。
- **中央カラム=LIVE地図**: 既存の地図machinery（BFS経路・光ナビ・波紋/脈打ち目的地演出・道アンビエント）を**実データ駆動**に繋ぎ替え。ミストの訪問先を番号ノードで配置、現在地→現在の目的地へ光経路、凡例。LIVE ラベル。
- **右カラム=次の目的地＋ステップ**: 次の目的地の詳細（サムネ/住所/サイズ/ワールド/最寄りエーテライト/ひとことメモ）、ルートのステップ一覧（到着済✓/次に訪問/未到着）、前へ/到着した→次へ、**報告ボタン（既存 `HousingReportModal` を開く）**。
- 実データ配線（`useHousingTourStore` の `listingIds`/`currentIndex` ＋ listings store から解決）。
- ミストのみ。エリア外の物件が混ざっても止めない（地図はミストのピンのみ、他は一覧に「地図は準備中」注記で残す）。

**入れない（別マイルストーン・非目標）**:
- 全エリア地図（M5）／エリア切替。M1はミスト固定。
- 所要時間見積り（約N分）＝実データ無く作り物になるため出さない。残り軒数で表現。
- 永続化・URL共有での再現（M3）。一時停止して後で再開も M3。M1は「終了」のみ。
- ツアーを組む画面（M2）。
- スマホ最適化（M6）。M1はPC実画面（CSS 1489 / DPR 2.58）基準。
- ズーム(+/-)・地図の手動再センタリング・「ルートを再計算」の実挙動 ＝ 経路は決定的なので M1 では省略（ボタンを置くなら見た目のみ・後日実挙動）。

## 3. 現状（実コード確認済み・引用）

- `useHousingTourStore`（`src/store/useHousingTourStore.ts`）: `listingIds[] / running / currentIndex` ＋ `setListings/start/stop/next/prev/reset`。メモリのみ。`next()` は `currentIndex` を `len-1` にクランプ（22-24行）。
- 開始配線済み: `BrowsePage.onStart`（`src/components/housing/pages/BrowsePage.tsx:65-71`）／`FavoritesPage.commitStart`（`src/components/housing/pages/FavoritesPage.tsx:111-118`）が `setListings→start→enterTourMode→navigate('/housing/tour')`。
- 着地先が器不在: App.tsx で `/housing/tour → <ComingSoonPage tab="tour" />`（プレースホルダ）。
- 地図machineryは旧 `MapView`（`src/components/housing/workspace/MapView.tsx`）に完成: BFS `routeNodes`（55-68行）、光ナビ path・`animateMotion`（142-151行）、波紋/脈打ち目的地（153-180行）、道アンビエント（129-140行）。ただし `DEMO_PLOTS` 固定（26行）・`targetPlot` はローカル `useState(27)`（75行）で tour store 未参照。
- 上部タブに tour は既存（`src/components/housing/shell/housingTabs.ts` の `tour`）。`TabBar` が全描画。
- listings 解決の定石（`FavoritesPage`）: `useHousingListingsStore` の `listings`+`myListings` を `mergeListingsForViewer`→`sortListingsForGallery`（FavoritesPage.tsx:37-40）。
- 報告モーダル: `HousingReportModal`（`src/components/housing/report/HousingReportModal.tsx`）props `{ open, listingId, onClose }`。そのまま再利用。

## 4. アーキテクチャ

### 4.1 ルーティング
- App.tsx: `/housing/tour` の element を `<ComingSoonPage tab="tour" />` → **`<TourNavPage />`** に差し替え（新シェルの Outlet 子ルートとして）。
- 旧 `/housing/tour/:tourId`（`HousingWorkspace`）は当面据え置き（legacy・撤去は別途）。新ページは `:tourId` 無しの `/housing/tour` に載る。

### 4.2 コンポーネント分割（各: 目的／入出力／依存）

**新規（`src/components/housing/pages/`）**
- `TourNavPage.tsx` — ルート要素・オーケストレーター。
  - する事: stores 購読 → listings 解決 → 純関数で派生状態を計算 → 3カラム＋報告モーダルを描画。ツアー未開始なら空状態。
  - 依存: `useHousingTourStore` / `useHousingViewStore` / `useHousingListingsStore` / `useAuthStore` / 純関数 `tourNav.ts` / 下記サブUI / `HousingReportModal`。

**新規（`src/components/housing/tour/`＝新ディレクトリ）**
- `TourProgressPanel.tsx`（左） — 進捗リング＋軒数＋次に訪れる場所＋最近訪れた場所＋終了ボタン。入力: 派生 `progress`＋`onFinish`。表示専用。
- `ProgressRing.tsx` — ％を受け取り SVG リングを描く小部品（色は `--housing-*` トークン）。
- `TourNavMap.tsx`（中央） — 実データ駆動の地図。入力: `placed`（{plot, buildingType, apartmentBuilding, status}[]）＋`currentPlot`＋`originNode`。ミスト SVG を inline 展開し、番号ノード・光経路・凡例を描く。経路は純関数 `wardRoute.ts` を使用。
- `TourNextDestinationPanel.tsx`（右） — 次の目的地詳細＋`TourRouteSteps`＋操作ボタン＋報告ボタン。入力: `currentListing`／`steps`／`onPrev`/`onNext`/`onOpenReport`。
- `TourRouteSteps.tsx` — ステップ一覧（各: 番号・住所・状態 ✓/現在/未到着・地図未対応注記）。入力: `steps`。
- `TourEmptyState.tsx` — 未開始時の空状態（「ツアーがまだ始まっていません」＋お気に入りへの導線）。

**新規純関数（`src/lib/housing/`）— ユニットテスト対象**
- `tourNav.ts`:
  - `resolveTourSteps(listingIds, allListings)` → `TourStep[]`（`{ id, listing | null }` 順序保持。欠落 listing は `null`）。
  - `computeTourProgress(steps, currentIndex)` → `{ total, arrivedCount, remainingCount, percent, currentStep, nextStep, recent[] }`。
  - `stepStatus(index, currentIndex)` → `'arrived' | 'current' | 'upcoming'`（`index < currentIndex`→arrived、`=`→current、`>`→upcoming）。
  - `isMistPlaceable(listing)` → `boolean`（area==='Mist' かつ plot/apartment が SVG に配置可能か）。
- `wardRoute.ts`（`MapView` の BFS/polyline を純化して切り出し・ミストデータ用）:
  - `buildRoutePath(originNodeId, goalNodeId, ward)` → SVG path 文字列 | null（`routeNodes`＋edge polyline 連結＋玄関ホップ）。
  - `plotToPlacement(listing, ward)` → `{ x, y, nodeId } | null`（house=plot位置、apartment=apart_1/apart_2）。
  - ※ 旧 `MapView` は据え置き（重複を許容・legacy 撤去時に統合）。新ページはこの純モジュールのみ使用。

### 4.3 データフロー
```
useHousingTourStore.listingIds ──┐
useHousingListingsStore(listings+myListings)+uid
   └ mergeListingsForViewer / (並びはツアー順を保持=sortしない)
        └ resolveTourSteps(listingIds, merged) → steps[] (順序=ツアー順)
             ├→ computeTourProgress(steps, currentIndex) → 左パネル
             ├→ steps.filter(isMistPlaceable)+plotToPlacement → TourNavMap の placed[]
             │     currentStep が Mist なら currentPlot=その plot、originNode=直前到着 or 区中央
             │     buildRoutePath(origin, currentGoal) → 光ナビ path
             └→ currentStep.listing → 右パネル詳細＋報告対象 listingId
```
- **順序**: ツアーは `listingIds` の順が正（`sortListingsForGallery` は使わない＝ギャラリー順で並べ替えない）。解決は id→listing の写像のみ。

### 4.4 進行モデル（単一カーソル）
- `stepStatus`: `index < currentIndex`=到着済✓ / `= currentIndex`=現在の目的地（青）/ `> currentIndex`=未到着。
- 「前へ」= `prev()`（`currentIndex-1`）／「到着した→次へ」= `next()`（`currentIndex+1`、クランプ `len-1`）。
- **最終ステップの扱い**: `currentIndex === len-1`（最後の目的地が現在）で主ボタンは「ツアーを完了」。押下で `stop()`＋完了状態（「全て回りました」）を表示し、`enterTourMode` を解除（`exitTourMode()`）して探すへ戻す導線。→ store を拡張せず完了を表現（`next()` のクランプは触らない＝legacy 非破壊）。
- **現在地マーカー**: 直前に到着した Mist 区画（`steps[currentIndex-1]` が Mist）。無ければ区中央エーテライト（`wardRoute` の区中央ノード・現行 `START_NODE='node_1'` 相当）。そこから現在の目的地へ光経路。

### 4.5 状態（ページの分岐）
- **未開始**: `listingIds.length===0`（または `running===false` かつ未完了）→ `TourEmptyState`。
- **進行中**: 3カラム。
- **完了**: 最終で「完了」を押した後 → 完了メッセージ＋探す/お気に入りへの導線（`reset()` は戻る時）。
- **混在エリア**: Mist 以外のステップは地図にピンを出さず、`TourRouteSteps` に「地図は準備中（全エリアは近日）」注記。前へ/次へは全ステップを横断できる（地図が無い目的地でも右パネル詳細は出る）。

## 5. 見た目・トークン（質感A案・地図を主役に）
- 新ページ共通の質感A案トークン（`--housing-panel-bg` 濃紺フラット等）を使用（`.claude/rules/housing-design.md`）。ハードコード禁止・`src/styles/housing.css` にトークン集約。
- 中央地図を主役に大きく。ツアー中は「眺める画面」＝少し没入寄り（`docs/.private/...` §20「眺める画面は透明寄り」）。地図パネルの veil を左右パネルより薄くする程度（新規トークン `--housing-tour-map-*` を housing.css に追加）。
- AI感回避（装飾ピル/過剰glow/色付きalert箱を避ける・`feedback_housing_no_ai_pills`）。進捗リング・番号ノード・光経路は機能表現なので可。
- 番号ノードの状態色: 到着済=ハニー系チェック、現在=青（`--housing-aether`）、未到着=グレー。凡例も同トークン。
- 縦積みの余白リズム（コンテナ `gap`・`feedback_housing_whitespace_rhythm`）。

## 6. エラー／エッジ処理
- listings 未ロード（`status!=='ready'`）でツアー開始済み: スケルトン or 「読み込み中」。ロード後に解決。
- `listingIds` に解決できない id（削除済み等）: そのステップは一覧に「この物件は見つかりません」で残し、地図には出さない。ナビは飛ばして継続可。
- Mist 内で同 plot 別 ward の重なり（`docs/.private` §128）: M1 は許容（重なって表示・住所で区別）。オフセットは付けない（既知の制限として明記）。
- アパート: `apart_1`（本街）/`apart_2`（拡張）ノードに配置。SVG に該当ノードが無ければピンなしで一覧のみ。
- 報告: 対象は現在の目的地の listing。`HousingReportModal` の重複・失敗トーストはそのまま。
- 直接 `/housing/tour` を開いた（ツアー未開始）: 空状態。ブラウザ更新でツアー消失（メモリのみ）も空状態＝M1仕様（永続化は M3）。

## 7. テスト方針（プロジェクト規約に準拠）
- **純関数ユニット（必須・happy-dom不要）**: `tourNav.ts`（resolveTourSteps 順序保持/欠落null、computeTourProgress のカウント・％・recent、stepStatus 境界、isMistPlaceable）／`wardRoute.ts`（buildRoutePath が既知の origin→goal で妥当な path を返す・不能で null、plotToPlacement の house/apartment）。
- **軽い部品テスト（happy-dom）**: 空状態が導線を出す／報告ボタンで `HousingReportModal` が open／前へ・次へで store の `prev/next` が呼ばれる／最終で「完了」ボタンに変わる。
- **実機ゲート（自動化不可＝ユーザー＋Playwright dev 注入）**: 地図の視覚（番号ノード配置・光経路・波紋・凡例）、DPR 2.58 / CSS 1489 の見た目、スクロール、混在エリア注記の見え方。happy-dom は IntersectionObserver/SVG 実寸を測れないため。
- build EXIT0・全体 vitest 回帰ゼロ（既知 legacy 5 fail=TopBar4+HousingWorkspace1 のみ）。

## 8. i18n（4言語・実訳・JAコピー禁止）
新規キー名前空間 `housing.tour.nav.*`（例）:
- `title`（ツアー中（ナビゲーション））/ `live`（情報は自動で更新されます）
- `progress.percent` / `progress.count`（{{done}}/{{total}} 軒目）/ `arrived` / `remaining`
- `next_place` / `recent` / `finish`（ツアーを終了）/ `complete_title` / `complete_lead`
- `steps.heading` / `steps.status.arrived|current|upcoming` / `map_pending`（地図は準備中（全エリアは近日））
- `actions.prev` / `actions.arrive_next`（到着した → 次へ）/ `actions.complete`（ツアーを完了）
- `next_dest.address|size|world|aetheryte|memo` / `report_button`（情報が違う・報告する）
- `empty.title`（ツアーがまだ始まっていません）/ `empty.lead` / `empty.cta`（お気に入りから始める）
- 既存 `housing.report.*` はそのまま再利用。
- parity テスト（ja/en/ko/zh）を追加。

## 9. 未確定・実装時に判断（大きな設計ではない・実装/実機で決める）
- 進捗リングの太さ・色の最終値（実画面で調整・トークン化）。
- 「次に訪れる場所」カードのサムネ取得（`representativeImage` 相当を共通化 or 流用）。
- 完了画面の演出の程度（M1は静かに・お祝いは将来）。
- ミスト SVG の区中央エーテライトノードID（現行 `node_1` 仮置きの妥当性を実データで確認）。

## 10. 受け入れ基準（M1完成）
1. お気に入りでツアー開始 → `/housing/tour` に「ツアー中」ページが表示（ComingSoon でない）。
2. ミストの訪問先が地図に番号ノードで並び、現在の目的地に光経路が引かれる。
3. 前へ/到着→次へで、地図の現在目的地・光経路・進捗リング・ステップ状態が連動する。
4. 右パネルに現在の目的地の住所/サイズ/ワールド/最寄りエーテライト/メモが出る。
5. 報告ボタンで既存の報告モーダルが現在の目的地を対象に開く。
6. 最終で「完了」→ 完了表示 → 探す/お気に入りへ戻れる。
7. エリア外の物件が混ざっても落ちず、一覧に注記＋ナビ継続。
8. 未開始で `/housing/tour` を開くと空状態＋お気に入り導線。
9. build EXIT0・回帰ゼロ・4言語 parity 緑。
