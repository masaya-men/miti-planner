# ハウジングツアー 本物のナビ化 設計書 (M1 の本体補完)

> 2026-07-04。M1「ツアー中ページ」の実機ゲートで判明した「ナビとして未成立」を解消し、
> 「自動で良い順に並べ替え → 家ごとにゴージャスに案内 → 区/エリア/ワールドの節目は先に文章で知らせる → また家ナビ」の
> “はぐれないツアー体験”を完成させる。前提: M1 spec `2026-07-04-housing-tour-nav-page-design.md`(器)。
>
> **原則**: 全判断を実コード/実データ/FF14仕様の確認ベースで行う(path:line 引用)。憶測禁止。
> FF14 の移動仕様(テレポ/ワールド訪問等)の**文言**はユーザー(FF14 側の正)に確認してから確定する。

## 背景 / 問題 (実機ゲートで判明)

M1 は「地図＋光ルート＝飾り」だけを作り、ナビの本体を落としていた。設計メモ [housing-map-todo.md:30](../../housing-map-todo.md)「**言葉ナビが本体、線アニメは将来の飾り**」。

- 右パネル「最寄りエーテライト」= `getAreaName()` で**エリア名の仮表示**([TourNextDestinationPanel.tsx:85-89](../../../src/components/housing/tour/TourNextDestinationPanel.tsx))。実名も行き方も無し。
- 地図は Mist ハードコード([TourNavMap.tsx:8-9](../../../src/components/housing/tour/TourNavMap.tsx))。Mist 本街 1-30 以外は出ない。
- 光ルート起点が区中央ノード固定([TourNavPage.tsx:87](../../../src/components/housing/pages/TourNavPage.tsx))=実エーテライト起点でない。
- ツアーの並べ替えは無し([FavoritesPage.tsx:113](../../../src/components/housing/pages/FavoritesPage.tsx))=トレイ追加順のまま。

## 揃っている素材 (すべて実データで確認済み・2026-07-04)

- **行き方データ**: masaya の Sheet(`ADMIN_REFERENCE.md:131`)。**5エリア×60区画=300件**、列=エリア/表裏/番地(1-60)/最寄りエーテライト/行き方補足。5タブ=Mist/Lavender/Goblet/Shirogane/Empyreum。CSV で厳密取得可(公開共有)。
- **地図**: **10枚(5エリア×本街/拡張街)全部完備**。各 ward JSON に nodes/houses(31)/edges/roadPath 揃い(ルート描画可)。
- **地図プラミング(既存・再利用)**: `WARD_MAP_LOADERS`(10マップ遅延ローダ・[wardMapManifest.ts](../../../src/data/housing/wardMapManifest.ts))＋ `resolveWardMapRef(area,plot,apartmentBuilding,buildingType)` → `{ mapKey, highlightPlot(拡張街 -30), highlightKind }`([resolveWardMapRef.ts](../../../src/lib/housing/resolveWardMapRef.ts))。登録ページ [WardMapPreview.tsx](../../../src/components/housing/register/WardMapPreview.tsx) で稼働中。
- **住所階層/移動階層**: `DC_SERVER_MAP`([dcServerMap.ts](../../../src/data/housing/dcServerMap.ts))= リージョン(JP/NA/EU/OCE)→DC→サーバー(ワールド)。listing は dc/server/region/area/ward/plot/buildingType を持つ([mockListings.ts:13-71](../../../src/data/housing/mockListings.ts))。
- **並べ替えの土台**: `sortListingsForGallery`/`compareByAddress`(エリア→DC→サーバー→区→番地・同住所グルーピング)[sortListingsForGallery.ts:37-80](../../../src/lib/housing/sortListingsForGallery.ts)。ツアー用比較器の土台に流用。
- **住所表示**: `formatHousingAddress`(ja "ミスト・ヴィレッジ 23-6" / apartment 対応)[formatHousingAddress.ts:31-54](../../../src/lib/housing/formatHousingAddress.ts)。

## 完成版 UX モデル (ユーザー確認済みビジョン)

1. **探す/お気に入りで家を選ぶ → アプリが自動で最適な巡回順に並べ替え → ツアー開始**。
2. **各家(メイン状態)**: 右=行き方(最寄りエーテライト名＋言葉ナビ)、中央=**最寄りエーテライト→その家への、いまよりずっとはっきり＆ゴージャスなナビ地図**(道が主役・灯りで“目が楽しい”)。
3. **「次へ」で“何が変わるか”により案内が分岐**(節目は独立ステップで先に文章ナビ):
   - 同住所の次物件 / 同区の次の家 → そのまま次の家ナビ。
   - **区(ward)変更** → 中央に大きく「次は 〇区 へ移動」(住宅街に入り直し〇区を選択) → 次へ → 家ナビ。
   - **エリア変更** → 「〇〇(エリア)へ移動」(〇〇へテレポ)。
   - **ワールド(server)変更・同DC** → 「ワールド訪問: 〇〇 → △△」。
   - **DC変更(同リージョン)** → 「データセンタートラベル: 〇〇 → △△」。
   - **リージョン変更** → 物理的に不可。ツアー生成時に分割 or 到達不能を明示(下記)。
4. 最後まで回ったら完了画面。

### 移動ナビ文言(ドラフト・★FF14文言はユーザー確認)
`transitionBetween(prev, next)` が listing 2件を比較し、変化の最上位段階を1つ返す:
| 変化 | 段階 | 表示(ドラフト) |
|------|------|----------------|
| region 違い | `region` | 「別リージョンのため移動できません(別ツアー)」 |
| dc 違い(同region) | `dc` | 「データセンタートラベル: {prev.dc} → {next.dc}」 |
| server 違い(同dc) | `world` | 「ワールド訪問: {prev.server} → {next.server}」 |
| area 違い | `area` | 「{areaName} へ移動(テレポ)」 |
| ward 違い(同area) | `ward` | 「{ward}区 へ移動」 |
| 同 ward・別 plot / 同住所 | `none` | 遷移なし(直接家ナビ) |
※ 家到着時のテレポ案内: 「{最寄りエーテライト} へ移動 → {行き方}」。文言はすべて i18n キー・4言語。**FF14的に正確な言い回しは実装前にユーザー確認**。

### 自動並べ替え(`orderTourStops`)
- 目的: 移動コスト最小＝**DC → サーバー → エリア → 区(ward) → 番地** でグルーピング(同住所は隣接維持)。`compareByAddress` を土台に「DC/サーバーを先頭」へ組み替えた純関数を新設。
- 現状のトレイ追加順を、開始時にこの順へ並べ替えて `setListings`。
- 手動入れ替え・始点指定(要件書§6)は**後回し**(将来 TODO)。まず自動のみ。

## データモデル / 関数

- `wardDirections.generated.json`: 生成スクリプト `scripts/parse-ward-directions.mjs`(Sheet CSV → area×plot(1-60)→{aetheryte, directions})。実行時 fetch なし。
- `getPlotDirections(area, plot): { aetheryte, directions } | null`([src/lib/housing/wardDirections.ts])。
- `orderTourStops(listings): listings`(純関数・同住所隣接維持)。
- `transitionBetween(prev, next): { level, from, to } | null`(純関数・上表)。
- 地図: TourNavMap を `resolveWardMapRef` + `WARD_MAP_LOADERS` 駆動へ(Mist ハードコード撤去)。**現在の目的地1軒のワード地図を表示**しハイライト(A案=多エリア対応)。

## フェーズ (速く確実に・各後に実機検証)

- **P1 言葉ナビ本体(全5エリア×60)**: データ焼込＋`getPlotDirections`＋右パネルに最寄りエーテライト実名＋行き方ブロック(主役級・honesトンマナ)。地図が無くても成立。
- **P2 構造の正しさ**: `orderTourStops` で自動並べ替え／TourNavMap を全エリア対応(現在の家のワード地図＋ハイライト)／`map_pending` 撤廃(plotなしのみ注記)。
- **P3 移動ナビ**: `transitionBetween` ＋ 節目の独立ステップ画面(中央に文章ナビ)。区/エリア/ワールド/DC/リージョン。
- **P4 ゴージャス化＋実起点**: 家ナビ地図の視覚を引き上げ(道主役・灯り・honey glow)／SVGのエーテライト群(名前+座標)をパース→Sheet名照合→**実エーテライト起点**の経路＋強調。照合不可は区中央にフォールバック(無破壊)。
- **Polish**: (b)報告モーダル Esc 閉じ (c)凡例「現在地/次の目的地」区別 (d)ステップ一覧の窮屈さ (e)死にキー削除。

## テスト / 検証
- 純関数(`getPlotDirections`=300件/`orderTourStops`/`transitionBetween`)= vitest(実データ裏取り)。
- 各フェーズ後、私が Playwright(1489×2.58・store注入)で全状態を実機目視。`npm run build`(tsc -b) EXIT0 ＋ vitest 緑を各タスクゲート。merge は全部通ってから。

## リスク / 要確認
- **★FF14 移動文言**(テレポ/ワールド訪問/DCトラベル/区の入り直し)= ユーザー確認で確定。
- Sheet 最寄りエーテライト名 ↔ SVG エーテライトグループ名の表記ゆれ(P4 で突合・フォールバック有)。
- アパート個室/未収録 plot は行き方無し→住所のみ(静かにフォールバック)。
- リージョン混在ツアーの扱い(分割 vs 到達不能表示)= P3 で確定。
