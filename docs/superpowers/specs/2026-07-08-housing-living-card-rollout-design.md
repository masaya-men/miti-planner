# ハウジング「生きたカード」全面配線（段階2）Design Spec

> **日付**: 2026-07-08 / **ブランチ予定**: `feat/housing-living-card-rollout`（未作成）
> **正典トンマナ**: ハウジング独自世界観（`.claude/rules/housing-design.md`）。既存 LoPo 白黒ルール対象外。
> **前提調査**: 本 spec は 2026-07-08 の 3 並列監査（動く機構 / ゲーティング資産 / 全サーフェス棚卸し）の結果に基づく。file:line は監査で実確認済み。

## Goal

再構築後の「新シェル世代」ページ（探す / お気に入り / ツアー）で、listing 画像が**静止画のまま**になっているのを、既存の「生きたカード」機構（画像クロスフェード + 動画スポットライト cap1）に**全面配線**する。旧 workspace 世代に**完成・実戦投入済みの機構**があるので、それを再利用する（再発明ゼロ）。

ユーザー方針（2026-07-08 合意）: **「全部動く前提で組み込み、画面的にうるさい面だけ後から静止させる」**。muteは実装後にユーザーが実画面（CSS1489 / DPR2.58）を見て面ごとに判断するため、本 spec では**既定=全面アニメON**とし、muteは**プロパティ1個を倒すだけ**で効く形にする。

## Background（監査で判明した事実・全て file:line 確認済み）

### 2 世代が並存している
- **新シェル世代（現行の顔・本 spec の対象）**: `App.tsx:105-113` の `<HousingShell>` 配下 = 探す（`BrowsePage`）/ お気に入り（`FavoritesPage`）/ ツアー（`TourNavPage`）/ 登録（`RegisterPage`）。**listing 画像は全て素の静止 `<img>`**。
- **旧 workspace 世代（レガシールートのみ生存・据え置き）**: `App.tsx:128-129` の `/housing/p/:listingId` と `/housing/tour/:tourId` = `HousingWorkspace`。**すでに生きたカード完全配線済み**。→ **本 spec の移植元（お手本）**。**触らない**。
- **詳細ページ（別ルート・シェル外）**: `App.tsx:131` の `/housing/listing/:listingId` = `HousingDetailPage`。`HousingPhotoGallery` は既に `<video>` + YouTube iframe + 複数画像手動切替を持つ「手動ギャラリー」。ambient 自動スライドショーとは別機構。

### 生きたカード = 2 機構の合成
1. **画像クロスフェード（軽量・上限なし）**: `HousingCardAmbientSlideshow.tsx`。全フレームを `<img>` として同時マウントし `data-active` の1枚だけ `opacity:1`（`housing.css:1341-1345`、fade token `--housing-slideshow-fade-ms:600ms` = `housing.css:87`）。カードごと独立の自己再スケジュール `setTimeout`（`useSlideshowCycle.ts:22-28`）+ ランダム間隔 2600–6000ms（`slideshowCycle.ts:5-10`）+ 初期 index/delay もランダムで desync。`frameCount < 2` または `enabled=false` は index0 固定（静止・タイマー解除）。
2. **動画スポットライト（cap1 強制）**: `HousingPlaybackContext.tsx`。IntersectionObserver で in-view 候補を pool 化（`poolCap=999` = 実質無制限、`viewportPlaybackPool.ts`）→ その中から **実再生は常に1本**（`spotlightCap` 既定=1、`HousingPlaybackContext.tsx:84,99`）→ 15秒ごとにローテーション（`intervalMs=15000` = `:87`、`useSpotlightRotation.ts` + `spotlightRotation.ts` の cap 維持ロジック）。動画は `HousingCardVideoOverlay.tsx`（Twitter は実 `<video muted autoPlay loop playsInline>` + CF Worker proxy、YouTube は nocookie iframe。共に `pointer-events:none`）。

### `enabled`（動く/止まる）= 単一グローバル値
- `ambientOn = GALLERY_AMBIENT_ENABLED && !reduced && !isScrolling && !lightboxOpen`（`HousingPlaybackContext.tsx:93`、master switch `GALLERY_AMBIENT_ENABLED=true` = `:80`）。Provider 内で計算し Context で全カードへ配布。
- 各シグナルの出所（すべて自己完結 hook・再利用可）: `useReducedMotion.ts`（matchMedia）/ `useIsScrolling.ts:21`（**window scroll** を 150ms デバウンス）/ `lightboxOpen`（store 未実装・現状は `HousingWorkspace.tsx:105` のルート派生 boolean）/ ビューポート判定 `useViewportPlaybackPool.ts` + `viewportPlaybackPool.ts`。
- **重要**: IntersectionObserver の結果は**動画スポットライト（`isPlaying`）だけ**を決め、`ambientOn`（画像スライドショー）には関与しない。つまり**画像スライドショーの「画面内だけ動かす」ゲートは現状存在しない**（全カード共通のグローバル）。画面外負荷は `<img loading="lazy">` + `content-visibility:auto` に委譲。

### 詰まっている唯一のブロッカー
`HousingPlaybackProvider` の mount は **`HousingWorkspace.tsx:110` の1箇所だけ**。新 `HousingShell.tsx` には無い。Provider 外は `NOOP_CONTEXT`（`HousingPlaybackContext.tsx:38-43`）で **`ambientOn:false` 固定** → 新世代カードは hook を呼んでも静止。`ListingCard.tsx:44` のコメントが「段階2で HousingPlaybackProvider をシェルに足すと有効化」と自己予告済み。

## Architecture / 採用アプローチ

**Provider を `HousingShell` に載せ、各カードを旧 workspace と同型 hook で配線する。** 却下: 画像だけの簡易版（Provider 無し）は動画スポットライトが使えず、生きたカード実装が 2 系統に割れるため不採用。

### 配線パターン（旧 workspace `HousingCard.tsx:49,56,80,81-93` と同型）
各対象カードで:
```tsx
const videoKind = /* listing から動画種別を判定（既存カードと同じ導出。videoUrl/youtubeVideoId 有無） */;
const { isPlaying, ambientOn, register } = useHousingCardPlayback(listing.id, videoKind !== null);
const frames = useHousingCardFrames(listing, ambientOn);
// サムネ枠内に: 静止ベース <img>（フォールバック）の上へ
//   <HousingCardAmbientSlideshow frames={frames} enabled={ambientOn && !muted} />
//   {isPlaying && <HousingCardVideoOverlay ... />}
// register を IntersectionObserver 用 ref に配線（動画カードのみ実効・画像onlyは no-op = HousingPlaybackContext.tsx:140）
```
`muted` は面ごとの静止プロパティ（既定 false = 動く）。ユーザーが実画面を見て「うるさい面」だけ true にする。

## Scope（配線対象と既定）

既定は**全面 ON**、muteは**プロパティ後決め**。

| 面 | ファイル:line | 対象 | 既定 | 備考 |
|---|---|---|---|---|
| 探す + お気に入り 共通カード `ListingCard` | `browse/ListingCard.tsx:85` | ✅ 画像+動画 | ON | **最大効果**（探す/お気に入り両グリッドを1コンポーネントでカバー）。`ListingGrid.tsx:38`→`BrowsePage.tsx:96` / `FavoritesGrid.tsx:27`→`FavoritesPage.tsx:185` |
| お気に入りプレビュー strip | `browse/FavoritesPreviewStrip.tsx:89` | ✅ 画像 | ON | 横スクロール strip 最大12枚 |
| ツアー目的地の大画像 `TourShowcasePanel` | `tour/TourShowcasePanel.tsx:42` | ✅ 画像+動画 | ON | **= ⑤の画像部分**。Project B の構造刷新はこの画像機構の上に乗る |
| 詳細「他の登録」mini `HousingDuplicatePeersSection` | `listing/HousingDuplicatePeersSection.tsx:40` | ⚠ 任意 | 保留 | **シェル外**（`HousingDetailPage`）。動かすなら詳細ページに別途 Provider mount が必要 → **Aの任意ステップ**（コア完了条件に含めない） |
| ツアー step / 進捗のサムネ | `tour/TourRouteSteps.tsx` / `TourProgressPanel.tsx` | ❌ 対象外 | — | **現状 画像枠自体が無い**。サムネ新設は Project B の構造設計で判断 |
| 旧 `HousingCardExpanded` | `workspace/HousingCardExpanded.tsx:57` | ❌ 対象外 | — | レガシー世代内の唯一の静止面・低優先 |

**コア完了条件 = シェル配下3面（`ListingCard` / `FavoritesPreviewStrip` / `TourShowcasePanel`）の配線 + Provider mount。** 詳細peersは任意。

## Gating ポリシー

- **reduced-motion 尊重 = 維持**（唯一の「必ず止める」・アクセシビリティ・既に部品内蔵）。
- **スクロール中は停止 = 維持**（`useIsScrolling` 再利用）。**⚠ 要実機確認**: `useIsScrolling.ts:21` は **window scroll 前提**。新シェルのスクロールコンテナが window か（探す/お気に入りグリッドの縦スクロールが window か内部要素か）を実機で1回確認し、`isScrolling` が意図通り立つか検証する。立たない場合はコンテナ scroll 対応を別途検討（本 spec のコアは window 前提で進め、検証で判明したら追補）。
- **動画 = cap1 スポットライト（既存のまま）**: 全面 ON でも同時再生は常に1本・15秒順送り。`spotlightCap` は Provider 既定=1 を上書きしない。
- **画像の「画面内だけ」ゲートは今回入れない**: クロスフェードは opacity 合成で軽量（ユーザー判断）。`<img loading="lazy">` + `content-visibility:auto` で画面外負荷を担保。長グリッドで実機ジャンクが出たら `useViewportPlaybackPool` を土台に後日フォロー（本 spec のスコープ外）。

## Cleanup（重複撤去・rule of three）— **follow-up に降格（コア外）**

`ListingCard.tsx:29` と `FavoritesPreviewStrip.tsx:12` に**ローカル定義の `representativeImage`** が重複している。当初は本 project で共通ヘルパへ寄せる予定だったが、**ベース `<img>` の静止 src と YouTube フォールバック（`handleYoutubeThumbnailError/Load`）は単発 string src を前提**とするため、frames 化と絡めると回帰リスクが高い。生きたカード配線自体はローカル `representativeImage` を残したまま成立する（slideshow は別レイヤー）。→ **dedupe は本 plan のコアから外し、低優先 follow-up とする**（リリース最短のため）。plan（`docs/superpowers/plans/2026-07-08-housing-living-card-rollout.md`）の Self-Review 参照。

## lightboxOpen の扱い

新シェルは面内ライトボックスを持たない（詳細は別ルート `/housing/listing/:id` へ遷移。`ListingCard.tsx:69`）。→ Provider には当面 `lightboxOpen={false}` を渡す。将来シェル内モーダル（例: ツアーの報告モーダル / 登録モーダル）で ambient を止めたくなったら、その開閉 state を Provider へ渡す（store 化は未実装なので必要時に対応）。

## 壊さない担保 / Testing

- **旧 workspace 世代は一切触らない**（現役の参照実装として温存。別 Provider が別ルートで動くが同時 render しないので競合なし）。
- **Provider 外 = NOOP = 静止**で描画される設計を維持 → **Provider 無しで `ListingCard` を render する既存テスト（`browse/__tests__/ListingCard.test.tsx` のいいねハート / 遷移 / 選択 / YouTube フォールバック）はそのまま緑**であること。サムネ DOM 構造の変更（単一 img → ベース img + slideshow レイヤー）で `.housing-listing-card-img` 等を assert している箇所があれば、静止フォールバック img を同 class で残すか、テストを追従更新する。
- **新規テスト**: (a) Provider 配下で対象カードが `HousingCardAmbientSlideshow` を描画し、Provider 外では静止フォールバックのみになること。(b) `resolveSlideshowFrames` への一本化で代表画像が従来と一致すること（回帰）。
- **完了ゲート**: `npm run build`（tsc -b 厳密）EXIT0 + `npx vitest run`（既知 legacy 5 fail = TopBar4 + HousingWorkspace1 以外の新規 fail ゼロ）。見た目・muteする面は実画面ゲート（ユーザー）。

## Out of Scope（明示）

- **Project B（ツアー左右パネル構造刷新 ⑤⑥）**: 住所サイズ集約 / メモ固定高 / 縦ステッパー / 見学フェーズ(moving↔viewing) / 操作ボタン移動。ツアー step サムネの新設もこちら。
- **詳細ページ本体ギャラリー**（`HousingPhotoGallery`）: 既に動画+複数画像の手動機構。ambient 化は別判断（本 spec では触らない）。
- **登録プレビューの画像タイル**（`HousingRegisterImageField` / `HousingRegisterSourceImageUrlsField` 等）: submit 前ローカル/URL 配列で listing 全体を持たない → 対象外。
- **背景シーナリー動画・アバター・ナビ地図 SVG**: listing メディアではない。
- **画像スライドショーの in-view ゲート新設**（前述・後日フォロー候補）。

## 実装の分割（並列エージェント向き）

面ごとに独立配線できるため、`writing-plans` で以下を並列可能なタスクに割る想定:
1. `HousingShell` への Provider mount（前提・最初に単独で・他タスクの依存元）
2. `ListingCard` 配線 + `representativeImage` 撤去 + テスト追従
3. `FavoritesPreviewStrip` 配線 + `representativeImage` 撤去
4. `TourShowcasePanel` 配線（画像部分のみ・構造は B）
5. （任意）詳細ページ Provider mount + `HousingDuplicatePeersSection` 配線
