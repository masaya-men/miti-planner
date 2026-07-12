# ツアーのリージョン/DC/ワールド跨ぎ処理 設計書 (2026-07-12)

## 背景・目的

ハウジングツアーは複数の家を順に巡る機能。現状 [orderTourStops.ts](../../../src/lib/housing/orderTourStops.ts) は
`region → DC → server → area → ward` の順に**並べるだけ**で、地点間の移動が
FF14 のワールド/データセンター/リージョン境界を跨ぐことを一切考慮していない。

FF14 では家のあるワールドが違えば「歩いて」は行けず、メタな移動操作が要る。跨ぎを
無視したツアーは「テレポで○○へ」とだけ出して実際には辿り着けない案内になる。本改修で:

1. **不可能なツアー(別リージョン混在)を作れないようにする**
2. **DC/ワールド跨ぎには正しい移動指示(データセンタートラベル/ワールド訪問)を出す**

をリリース必須要件として実装する。

## 前提: FF14 の移動モデル

隣り合う2地点(前の家 → 次の家)の関係で移動手段が決まる:

| 関係 | 例 | 移動手段 | 本改修の扱い |
|------|-----|----------|--------------|
| 同じワールド | Anima → Anima | テレポ + 徒歩(現状のまま) | 指示なし |
| 別ワールド・同DC | Anima → Titan (共に Mana) | **ワールド訪問**(ゲーム内・エーテライト) | ワールド訪問指示 |
| 別DC・同リージョン | Mana → Gaia (共に JP) | **データセンタートラベル**(タイトルへ) | DCトラベル指示 |
| 別リージョン | JP → NA | 不可能(そのキャラでは行けない) | 追加時ブロック |

リージョン = `JP | NA | EU | OCE`。DC = データセンター名(Mana 等)。server = ワールド名(Anima 等)。
階層は [dcServerMap.ts](../../../src/data/housing/dcServerMap.ts) が正典。

## データモデルの事実(調査済み・引用付き)

- `MockListing` は `region` / `dc` / `server` を持つ。
- **登録リスティングは DC + サーバー必須**: [housingValidation.ts:99-100](../../../src/utils/housingValidation.ts#L99-L100)
  `if (!addr.dc ...) errors.dc = 'required'` / `if (!addr.server ...) errors.server = 'required'`。
  → 登録経由の地点は必ずワールドが判明している。
- **一時追加(EphemeralAddPanel)だけが DC/サーバーを任意にしている**:
  [EphemeralAddPanel.tsx:191-195](../../../src/components/housing/browse/EphemeralAddPanel.tsx#L191-L195) の
  `complete` 条件は area + ward + (plot|roomNumber) のみ。dc/server 未選択でも「ツアーに追加」が活性。
  → **本改修で必須化する(下記 設計2)。これにより「ワールド不明の地点」は存在しなくなる。**
- ツアー下書き(開始前の id 群)は各ページのローカル state:
  - [BrowsePage.tsx](../../../src/components/housing/pages/BrowsePage.tsx): `trayIds` + `addToTray` + `onStart`
  - [FavoritesPage.tsx](../../../src/components/housing/pages/FavoritesPage.tsx): `trayIds` + `addToTray` + `commitStart`
  - [HousingerPage.tsx:137-144](../../../src/components/housing/pages/HousingerPage.tsx#L137-L144): `onTourAll`(一括)
  - [TourNavPage.tsx](../../../src/components/housing/pages/TourNavPage.tsx): 空トレイの `emptyTrayIds` + `onStartEphemeral`
  - どの開始経路も `orderTourStopIds → setListings → start → enterTourMode` を共通で通る。
- トースト = グローバル `showToast()`([Toast.tsx](../../../src/components/Toast.tsx))が housing でも既に使用中
  ([FavoritesPage.tsx:84](../../../src/components/housing/pages/FavoritesPage.tsx#L84))。ブロック通知はこれを使う。
- 移動中の「行き方」枠 = [TourPhaseZone.tsx](../../../src/components/housing/tour/TourPhaseZone.tsx)(テレポ先+徒歩)。
- 中央ナビ地図 = [TourNavMap.tsx](../../../src/components/housing/tour/TourNavMap.tsx)。

## スコープ

**やること**: 移動判定の純関数 / 一時追加のワールド必須化 / リージョン跨ぎブロック(追加時+開始時) /
DC・ワールド指示(右パネル) / DC・ワールド案内(中央マップ ぼかし+カード) / i18n 4言語 / テスト。

**やらないこと(YAGNI)**:
- 1件目(ツアー最初の家)への「このワールドから始めます」的な事前案内。前の家が無く、プレイヤーの
  現在地も不明なため指示・ぼかしを出さない。将来必要なら別途。
- 同一マップ内の家→家 徒歩ナビ / エーテライト間テレポナビ(別アイデア・[[project_housing_tour_intra_map_nav]])。
- リージョン跨ぎを「自動で分割して2つのツアーにする」等の高度な救済。ブロック + 明示で足りる。

## 設計

### 1. 移動判定の純関数 — `src/lib/housing/tourCrossing.ts`(新規)

隣接2地点の移動種別と、リージョン混在判定を1モジュールに集約(純関数・副作用なし)。

```ts
export type TourCrossing =
  | { kind: 'none' }
  | { kind: 'world'; world: string }              // ワールド訪問(同DC・別ワールド)
  | { kind: 'dc'; dc: string; world: string }     // DCトラベル(別DC・同リージョン)。着地ワールドも持つ
  | { kind: 'region' };                            // 別リージョン(通常はブロックで来ない・防御表示)

type Loc = Pick<MockListing, 'region' | 'dc' | 'server'>;

/** 前の家(prev)→次の家(current)の移動種別。prev=null(1件目)は 'none'。 */
export function crossingBetween(prev: Loc | null, current: Loc): TourCrossing;

/** トレイに追加してよいか。空トレイ(trayRegion=null)は何でも可、以降は同リージョンのみ。 */
export function canAddToTour(trayRegion: string | null, candidateRegion: string): boolean;

/** 地点集合に含まれる相異なるリージョン。1種以下なら null(=問題なし)。 */
export function tourRegionConflict(stops: Loc[]): string[] | null;
```

判定順(`crossingBetween`): region 差 → `'region'` / dc 差 → `'dc'`(着地 world = current.server)/
server 差 → `'world'` / それ以外 → `'none'`。
(DCトラベルはタイトル画面で「DC + その中のワールド」を選ぶため、`'dc'` は dc と world 両方を持つ。)

### 2. 一時追加のワールド必須化 — `EphemeralAddPanel` / `ephemeralListing`

- [EphemeralAddPanel.tsx](../../../src/components/housing/browse/EphemeralAddPanel.tsx) の `complete` に
  `address.dc` と `address.server` の充足を追加。→ DC/サーバー未選択の間は「ツアーに追加」が非活性。
- SNS URL パースで dc/server が取れないことは多い(投稿に世界名が無い)。その場合はユーザーが
  `RegisterSectionAddress`(variant='tour')の DC/サーバー セレクトで手選択する(既に欄はある)。
- 防御的整合のため [ephemeralListing.ts](../../../src/lib/housing/ephemeralListing.ts) の
  `validateEphemeralInput` にも dc/server 必須チェックを追加(error: `'missing_dc' | 'missing_server'`)。
  `DEFAULT_EPHEMERAL_REGION` フォールバックは実質デッドになるが、防御として残す。
- 効果: **全ツアー地点(登録・一時)が必ず region/dc/server を持つ** → 以降の判定に「不明」分岐が不要。

### 3. リージョン跨ぎのブロック(追加時 + 開始時)

**追加時(主)**: 各ページの追加導線を、リージョン guard を通す1つの関数に集約する。

- BrowsePage / FavoritesPage: `addToTray(id)` 内で、トレイの現行リージョン(= 先頭地点の region、
  空なら null)と候補の region を `canAddToTour` で照合。NG なら追加せず
  `showToast(t('housing.tour.region_block'), 'error')` を出す(トレイは変えない)。
- **一時追加パネル経由の追加も同じ guard を通す**。現状 [TourTray.tsx](../../../src/components/housing/browse/TourTray.tsx)
  の `EphemeralAddPanel onAdd` は親の `onChange([...listingIds, id])` を直接呼び addToTray を迂回している。
  → TourTray に「guard 済みの追加コールバック」を prop で渡し、生 onChange 連結をやめる
  (BrowsePage/FavoritesPage が自分の `addToTray` を渡す)。
- カード「ツアーに追加」([ListingCard.tsx](../../../src/components/housing/browse/ListingCard.tsx))・地図
  ([BrowseMapView])・お気に入り一覧 いずれも上記 addToTray に集約されるため、1箇所の guard で覆える。

**開始時(保険)**: 追加時 guard を通らない経路(ハウジンガー一括 / お気に入りに元々別リージョンが
混在していて一括選択された場合)に備え、各開始関数で `orderTourStopIds` 後に `tourRegionConflict` を実行。
複数リージョンなら開始せず `showToast(t('housing.tour.region_block_start', { regions }), 'error')`。
対象: `BrowsePage.onStart` / `FavoritesPage.commitStart` / `HousingerPage.onTourAll` /
`TourNavPage.onStartEphemeral`。

### 4. DC/ワールド指示(右パネル 行き方枠)

- [TourNavPage.tsx](../../../src/components/housing/pages/TourNavPage.tsx) で、現在地点の1つ前の step を
  求め `crossingBetween(prevListing, currentListing)` を算出(`crossing`)。
- `crossing` を [TourProgressPanel](../../../src/components/housing/tour/TourProgressPanel.tsx) 経由で
  [TourPhaseZone](../../../src/components/housing/tour/TourPhaseZone.tsx) へ渡す。
- TourPhaseZone は phase==='moving' のとき、`directions`(テレポ先+徒歩)の**上**に跨ぎ1行を差し込む:
  - `dc`: `t('housing.tour.nav.cross.dc', { dc, world })` = 「まずデータセンタートラベルで {dc} の {world} へ」
  - `world`: `t('housing.tour.nav.cross.world', { world })` = 「まずワールド訪問で {world} へ」
  - `region`: 防御表示(通常来ない)。`t('housing.tour.nav.cross.region')`。
  - `none`: 何も足さない(現状表示のまま)。
- 1件目(prev=null → 'none')は無表示。

### 5. DC/ワールド案内(中央マップ ぼかし + カード)

跨ぎ地点では、右パネルの1行に加えて**中央マップをぼかし、中央に案内カード**を重ねる
(「歩いては行けない」を視覚的に強調)。

- 状態は TourNavPage が持つ: `crossingAckIndex: number | null`。
  オーバーレイ表示条件 = `crossing.kind !== 'none' && crossingAckIndex !== currentIndex`。
- [TourNavMap](../../../src/components/housing/tour/TourNavMap.tsx) に props 追加:
  `crossing: TourCrossing`(または表示用に縮約した `{ kind, dc?, world? }`)と `onAcknowledge: () => void`。
  条件を満たすとき、地図ステージ全体にぼかしレイヤ + 中央カードを描画:
  - カード文言 = 右パネルと同じ跨ぎ文言(dc/world)。
  - ボタン「移動しました(地図を見る)」= `t('housing.tour.nav.cross.ack')` → `onAcknowledge()`。
- `onAcknowledge` は `crossingAckIndex = currentIndex` にする → ぼかし解除、徒歩ルートが見える。
- prev/next で `currentIndex` が変わると条件が自然に再成立し、次の跨ぎ地点で再びぼかす
  (`crossingAckIndex` は明示リセット不要 = 前地点の index と一致しなくなるため)。
- ぼかしは CSS 変数パターン(`--tw-backdrop-blur`)で実装([css-rules.md])。色/寸法は housing token 経由。
- 地図が none/error/loading でも跨ぎオーバーレイは中央パネルに出す(移動はワード地図の有無と独立)。

## データフロー

```
[追加] ListingCard/地図/お気に入り/一時パネル
   → addToTray(id)  ─ canAddToTour(trayRegion, candidateRegion) ─→ OK: trayIds 追加
                                                                  NG: showToast(region_block)
[開始] onStart/commitStart/onTourAll/onStartEphemeral
   → orderTourStopIds(...) → tourRegionConflict(stops)
        null: setListings→start→enterTourMode→/housing/tour
        混在: showToast(region_block_start) で中断
[ナビ] TourNavPage: crossing = crossingBetween(steps[i-1], steps[i])
   → TourProgressPanel → TourPhaseZone(右パネル1行)
   → TourNavMap(crossing && !ack → ぼかし+カード)
```

## エッジケース・エラー処理

- **1件目**: prev=null → crossing='none'。指示もぼかしも出さない。
- **同住所の重複(同じ家を複数枚)**: region/dc/server 同一 → 'none'。跨ぎ扱いしない。
- **アパート(plot 無し)**: crossing は region/dc/server のみで判定するので plot 有無に非依存。
- **お気に入りに別リージョンが既に混在**: 追加時 guard で2件目以降の別リージョンは弾かれる。
  一括選択で混在が入っても開始時 net が止める。
- **ハウジンガー一括で別リージョン所有(複数キャラ)**: 追加を経ないので開始時 net が唯一の砦 → そこで止める。
- **`'region'` が crossingBetween に来る**: 設計上ブロック済みで通常発生しないが、防御的に案内表示のみ(クラッシュしない)。

## i18n キー(新規・4言語 ja/en/ko/zh 追加)

- `housing.tour.region_block` — 追加時ブロックのトースト(「別リージョンの家は同じツアーに入れられません」)
- `housing.tour.region_block_start` — 開始時ブロックのトースト({{regions}} 補間)
- `housing.tour.nav.cross.dc` — 「まずデータセンタートラベルで {{dc}} の {{world}} へ」
- `housing.tour.nav.cross.world` — 「まずワールド訪問で {{world}} へ」
- `housing.tour.nav.cross.region` — 防御表示文言
- `housing.tour.nav.cross.ack` — マップ案内カードのボタン「移動しました(地図を見る)」
- `housing.tour.nav.cross.card_lead`(任意)— カードの補足文

(中韓の実訳は既存 parity 方針。DC/ワールド名は原語表記のまま補間。)

## テスト方針(TDD)

**純関数(最重要・vitest)**: `tourCrossing.test.ts`
- crossingBetween: none/world/dc/region の各分岐、prev=null、同住所、アパート。
- canAddToTour: 空トレイ=何でも可 / 同リージョン可 / 別リージョン不可。
- tourRegionConflict: 単一=null / 混在=リージョン配列。

**コンポーネント**:
- EphemeralAddPanel: dc/server 未選択で「ツアーに追加」非活性、両方選択で活性(既存28テストの回帰なし)。
- TourPhaseZone: crossing=world/dc で跨ぎ行が出る、none で出ない、viewing 中は出ない。
- TourNavMap: crossing && !ack でぼかし+カード、ack 後に消える、crossing=none で通常表示。
- 開始/追加ガード: addToTray が別リージョンで showToast し trayIds 不変 / 開始 net が混在で中断。

**ビルド/緑ゲート**: `npm run build`(tsc -b 厳密)+ `vitest run` 全緑を push 前に確認。

## 変更ファイル一覧(見込み)

- 新規: `src/lib/housing/tourCrossing.ts` + `__tests__/tourCrossing.test.ts`
- 変更: `EphemeralAddPanel.tsx`(complete 条件)/ `ephemeralListing.ts`(validate)/
  `TourTray.tsx`(guard 済み追加 prop)/ `BrowsePage.tsx`・`FavoritesPage.tsx`(addToTray guard + 開始 net)/
  `HousingerPage.tsx`(開始 net)/ `TourNavPage.tsx`(crossing 算出 + ack state)/
  `TourProgressPanel.tsx`(crossing 中継)/ `TourPhaseZone.tsx`(跨ぎ行)/ `TourNavMap.tsx`(ぼかし+カード)/
  `src/styles/housing.css`(ぼかし・カード token)/ ロケール4 json(新規キー)
