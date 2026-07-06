# 全住所ツアープレビュー（DEV専用）design

- 作成日: 2026-07-06
- ブランチ: `feat/housing-dev-tour-preview`（main `beb8d702` = ツアー大ブランチ本番反映済 の上）
- 対象: 開発者(ユーザー)が **全住所のツアーナビと進行を自分で目視 QA** するための DEV専用ツール
- デザインルール: ハウジング独自トンマナ（`.claude/rules/housing-design.md`）。ただし本ツールは DEV専用で本番非露出のため、UI は最小限（トークン経由は守るが作り込みは不要）
- 前例: 入口オーサリングツール `/housing/dev/entrances`（DEV専用・`import.meta.env.DEV` ガード・本番 tree-shake 除去）

---

## 0. 目的

ツアー大ブランチ（M1 + 中央地図Phase1 + 入口276採取 + 座標根治）が本番反映された。ユーザーが **全住所（区画+アパート ≈310）のツアーを 1 件ずつ歩いて**、①ナビの道の違和感（家に刺さる/遠回り/入口で止まらない/はみ出す 等）②ツアー進行の完成度、を自分で確認し、必要なら簡単な手直し（入口ドラッグ補正 等）へ繋げる。

**非目標**: 自動点検（データ機械チェック）は不要（ユーザー判断＝人が見る）。本ツール自体は使い捨ての QA 補助で、本番機能ではない。

---

## 1. 方式（本番ページ無改変・裏で仮ツアーを流す）

本番のツアー画面 `TourNavPage`（左=進捗 / 中央=ナビ地図 / 右=ステップ一覧+住所詳細）を**一切改変せず**再利用する。DEV専用ページが裏で「全住所を並べた仮のツアー」をストアに流し込み、`TourNavPage` をそのまま描画する。

- **採用**: ストアに仮データを注入 → 本番 `TourNavPage` を描画（忠実・回帰リスクなし・追加UI最小）
- **不採用**: `TourNavPage` を props 注入型にリファクタ → 本番ページに手を入れる = 回帰リスク。QA ツールのために本番を変えない。

---

## 2. コンポーネント & データフロー

```
Entrance/TourPreview DEV page (mount)
  ├─ 全住所を列挙            → buildAllAddressListings()  … 仮 MockListing[] (≈310, エリア→区画順)
  ├─ ストア注入              → listings store に投入 + tour store に listingIds(順序) + currentIndex=0
  ├─ 本番ページ描画          → <TourNavPage />  (無改変・既存の 次へ/前へ/報告 が動く)
  └─ DEV操作バー(オーバーレイ) → N/310 カウンタ・住所ラベル・入口補正バッジ・住所ジャンプ
(unmount) → 注入した仮データをリセット（本番アプリに残さない）
```

- 地図・経路・ステップ・進捗の描画は**すべて本番の既存パイプライン**（`resolveTourSteps` → `buildTourMapPlacements` → `TourNavMap` / `TourNextDestinationPanel` / `TourProgressPanel`）を通る。プレビュー専用の描画ロジックは持たない（＝見えている絵は本番と同一）。

---

## 3. 全住所の列挙（`buildAllAddressListings`）

10 枚のワード地図（`WARD_MAP_LOADERS` の 10 mapKey）を読み、各 `json.houses` から**実在する住所だけ**を拾う。`resolveWardMapRef` の逆写像で mapKey+house → 住所へ変換:

| mapKey | house.kind | → area | → 住所 |
|---|---|---|---|
| `mist` 等（base） | `plot` | Mist 等 | plot = house.plot (1–30) |
| `mist` 等（base） | `apart` | Mist 等 | apartment 棟1 |
| `mist-sub` 等 | `plot` | Mist 等 | plot = house.plot + 30 (31–60) |
| `mist-sub` 等 | `apart` | Mist 等 | apartment 棟2 |

- 純関数化: `buildAllAddressListings(): MockListing[]`。10 ward JSON を静的 import（DEV専用ページなので本番バンドルに載らず、bundle 肥大の懸念なし）。
- 各住所 = 仮 `MockListing`:
  - **本物**: `area` / `ward`(サンプル値可・地図は area+plot のみで決まるため QA に不要) / `plot` or `apartmentBuilding` / `buildingType`
  - **並び用**: `region` / `dc` / `server` は全件共通値（→ 並びが area→ward→plot に落ちる）
  - **表示用サンプル**: `title` = 生成ラベル（例「ミスト 12番地」「シロガネ拡張 5番地」「ミスト アパルトメント棟1」）/ `imageMode: 'none'`（画像なし）/ `size` は既定（例 'M'）/ `tags: []` / メモなし
  - `id` = 決定的な合成 id（例 `preview-mist-plot-12`）

---

## 4. ストア注入 & クリーンアップ

- **注入(mount)**: `useHousingListingsStore` の `listings` に仮配列をセット、`useHousingTourStore` に `listingIds`（並べた順）と `currentIndex=0` をセット（既存の start/setup アクション経由。無ければ最小の dev 用 setter を store に additive 追加）。
- **クリーンアップ(unmount)**: tour store を reset、注入した仮 listings をクリア。ページを離れたら本番アプリに仮データが残らない。
- 注入は DEV専用ページのマウント副作用に閉じ込める（本番コードパスは触らない）。

---

## 5. DEV 操作バー（唯一の追加 UI）

`TourNavPage` の上（または隅）に固定オーバーレイを重ねる。中身:
- **N / 310** カウンタ（現在位置）
- **現在の住所ラベル**（エリア・本街/拡張・区画 or アパート棟）
- **入口補正バッジ**: `getPlotEntrance` に override があれば「入口補正あり」/無ければ「幾何」— どの住所を注視すべきか一目で分かる
- **住所ジャンプ**: エリア選択 + 区画選択（or フラットな select）で任意住所へ `currentIndex` を直接移動
- 前へ/次へは `TourNavPage` の既存ボタンを使用（オーバーレイには最小限のみ）

CSS は `housing.css` にトークン経由で最小追加（`.housing-dev-tourpreview-bar` 等）。色 literal 禁止は守る。

---

## 6. ルーティング（本番非露出）

- `App.tsx` に `{import.meta.env.DEV && <Route path="/housing/dev/tour-preview" element={<TourPreviewPage/>} />}` を追加（入口ツールと同じ形）。
- 検証: `npm run build` 後に `dist` を grep して `tour-preview` / コンポーネント名が 0 件（本番 tree-shake 除去）を実証。

---

## 7. テスト方針

- `buildAllAddressListings` 純関数: 生成件数（≈310）・area/plot 逆写像の正しさ（mist-sub plot=1 → Mist plot 31 / apart 棟2 等）・全件 `resolveWardMapRef` が非 null を返すこと。
- ページの happy-path レンダリング（mount で `TourNavPage` が出る・件数カウンタ表示）1 件。
- `npm run build`（tsc -b 厳密）EXIT0 + 既知 legacy 5 fail 以外の新規 fail ゼロ。
- 本番 tree-shake 除去の dist grep。

---

## 8. 非スコープ

- 本番への露出・一般公開（DEV専用で恒久）。
- 自動データ点検（ユーザー判断＝目視）。
- ナビ/進行の**修正そのもの**（本ツールは「見る」まで。手直しは見つかった分だけ別途：入口ドラッグ補正=既存入口ツール、幾何/データ=別コミット）。
- 既知繰延（M1 の 報告モーダルEsc / 凡例色かぶり / 右カラム窮屈 = P3送り）は本ツールで見えても対象外。
- Phase2（番号/凡例撤去・パン&ズーム）はこの QA の後。

---

## 9. 完了条件

`npm run dev` → `/housing/dev/tour-preview` で全住所を「次へ」「住所ジャンプ」で歩け、各住所で本番同一のナビ地図＋ステップ＋進捗が出る。build EXIT0・本番非露出を実証。ユーザーが全住所を見て回れる状態で完了（見つかった手直しはその後）。
