# ハウジングツアー 左右パネル構造刷新（Project B・ローカル版）設計書

作成: 2026-07-08 / ステータス: **設計確定（ユーザー承認済み）→ 実装へ**

## 1. 目的とスコープ

ツアー中（Nav）ページの**左パネル（ショーケース）**と**右パネル（進行状況）**の構造を刷新し、
新たに **moving↔viewing フェーズ** と **見学タイマー** を導入する。目的は「大所帯でハウジングを
巡るときのタイムキープ」を1画面で完結させること。

**今回はローカル版**（タイマーは操作している幹事の画面だけに出る）。ただし将来の
「共有ツアー（同期）」（`docs/.private/2026-07-08-synced-shared-tour-vision.md`）へ
**中身をサーバーに差し替えるだけで乗る形**にしておき、画面は作り直さない。

### 非目標（今回やらない）

- 共有ツアーの同期／URL発行／参加フロー／幹事権限委譲（＝別プロジェクト）
- 中央の地図パネル（`TourNavMap`）の変更
- ツアーのデータモデル（`tourNav.ts` の `TourStep` 構造）の変更
- 登録フォーム（`register/`）や他のハウジング画面の変更
- 🐛「家と道の枠線」問題（**優先度最後**・本設計の全項目完了後に別途着手。リリース最短のため後回し）

## 2. 現状（実装確認済み）

- `TourNavPage.tsx`（オーケストレーター）が3カラム構成: 左=`TourShowcasePanel` / 中央=`TourNavMap` / 右=`TourProgressPanel`。
- `TourShowcasePanel`: 生きたカード画像 + タイトル + facts定義リスト（住所/サイズ/ワールド/紹介文）+ 行き方（テレポ+徒歩）+ **操作ボタン（前へ/主ボタン/報告）**。
- `TourProgressPanel`: リング + 到着済/残り（**縦2列**）+ `TourRouteSteps`（縦リスト）+ ツアーを終了。
- `useHousingTourStore.ts`: `listingIds` / `running` / `currentIndex` のみ。**フェーズ・タイマー概念なし**。
- i18n: ツアーの紹介文欄は `housing.tour.nav.dest.memo` = 「ひとことメモ」。一方、登録フォームは `housing.register.description` = 「**紹介文**」。**用語が食い違っている**。

## 3. 左パネル（TourShowcasePanel）— 「見せる」専門に

操作ボタンと行き方は撤去し、見ている家の紹介に専念する。上から：

1. **生きたカード画像**（実装済み・そのまま）
2. **タイトル**（`listing.title` / 無ければ住所フォールバック）
3. **住所＋サイズを1行に集約**（例「12区 5番地 ・ Lサイズ」）。アパートはサイズ非表示。
4. **DC/サーバー**（小さく1回だけ。現状の head重複＋facts重複を解消）
5. **紹介文**（`listing.description`）。ラベルは「**紹介文**」（後述リネーム）。**高さ固定・溢れたら枠内スクロール**（`overflow-y:auto` + `max-height`）。空なら現状同様「メモはありません」相当。
6. **次の目的地カード**（`steps[currentIndex+1]` の生きたカード）。**画像のみ・テキスト情報なし・動いてOK**。最後の目的地では非表示。
7. **報告ボタン**（左に残す・現状のまま）

**撤去**: facts定義リストの「住所/サイズ/ワールド」個別行、行き方ブロック、前へ/主ボタン。

**次の目的地カードの技術メモ**: 生きたカード再生は `HousingPlaybackProvider`（cap1 spotlight）配下。
カードが2枚（現在=大 / 次=小）登録されても、Provider が同時再生を1本に制限するため問題なし。

## 4. 右パネル（TourProgressPanel）— 進行＋操作の司令塔

上から：

1. **リング＋軒数を横並び**（現状の縦2列 `housing-tour-progress-stats` を、リングの右横に「済 N / 残 M」を配置する横並びに変更）。
2. **縦ステッパー**（`TourRouteSteps` を視覚刷新）: 各ステップに**青丸**、ステップ間を**縦の連結線**でつなぎ、到着済み区間の線・丸を**青**（`--housing-aether`）で塗る＝「**青線が下へ伸びる**」表現。現在ステップを強調、未到着はグレー。listing欠落（missing）と地図解決不可（map_pending）の静かな注記は現状踏襲。
3. **フェーズ枠**（新規・ボタンのすぐ上）: フェーズで中身が入れ替わる1枠。
   - **移動中（moving）**: 「行き方」（テレポ先＋徒歩）＝左から移設した `getPlotDirections` 表示。
   - **見学中（viewing）**: 「見学タイマー」＝「{開始時刻} から見学中 / {経過} 経過」。経過は**1秒ごと**に更新。
4. **操作3ボタン**（左から移設）: **前へ / 見学 / 次へ**。
   - **前へ**: `currentIndex===0` で無効。
   - **見学**: 押すと viewing に切替＋開始時刻記録。**任意**（押さず次へも可）。**押せるのは今の家が表示できる時だけ**（`currentStep.listing != null`。missing なら無効=灰色）。既に viewing のときは押下不可 or 再押下で計り直し（実装時に軽い方を採用）。
   - **次へ**: 次の目的地へ進み moving に戻す。**最後の家では「終了」**として振る舞い、完了（お疲れ様）画面へ。
5. **ツアーを終了**（現状の `housing-tour-progress-finish`）: いつでも中断。下に常時。

## 5. フェーズ＆タイマーのロジック（ストア変更）

将来の同期に素直に乗るよう、フェーズと開始時刻は**ストアに素の JSON で持つ**
（画面ローカル state に埋め込まない＝同期版で作り直しを避ける）。

`useHousingTourStore` に追加:

```
phase: 'moving' | 'viewing'          // 既定 'moving'
viewStartAt: number | null           // 見学開始の epoch ms（Date.now()）。moving では null
startViewing(): void                 // phase='viewing', viewStartAt=Date.now()
```

既存アクションの拡張:
- `next()` / `prev()`: 進む/戻ると同時に `phase='moving'`, `viewStartAt=null` にリセット。
- `start()` / `reset()`: `phase='moving'`, `viewStartAt=null` を含める。

**経過時間の算出**: `viewStartAt` からの差分を、小さな hook（`useElapsed` 相当・`setInterval(1000)`）で
毎秒再計算して表示。ストアには「開始時刻」だけ持ち、経過は表示側で計算（＝同期版でも各クライアントが
自分の時計で経過を出せる＝サーバーに毎秒書かない設計）。

**完了判定**: 現状の `TourNavPage` ローカル `completed` state を踏襲（`isLast && 次へ → completed`）。
ストアの `currentIndex` クランプ仕様は非破壊のまま。

## 6. 用語修正（i18n・4言語）

ツアーの紹介文ラベルを登録フォームに合わせて統一する。

- `housing.tour.nav.dest.memo`「ひとことメモ」→「**紹介文**」（en/ko/zh も `housing.register.description` の各言語訳に合わせる）
- `housing.tour.nav.dest.no_memo`「メモはありません」→「紹介文はありません」相当（各言語）

**新規 i18n キー**（4言語 parity 維持）:
- 操作ボタン: `housing.tour.nav.actions.view`（見学）/ 既存 `prev` 流用 / `next`（次へ）※現状 `arrive_next`「到着した→次へ」は用途変更のため `next`「次へ」を新設 or 文言変更。
- 見学タイマー: `housing.tour.nav.viewing.started_at`（{{time}} から見学中）/ `housing.tour.nav.viewing.elapsed`（{{elapsed}} 経過）等。

## 7. 触るファイル（想定）

- `src/store/useHousingTourStore.ts` — phase/viewStartAt/startViewing 追加、next/prev/start/reset 拡張。
- `src/components/housing/tour/TourShowcasePanel.tsx` — 表示専用化（操作/行き方撤去、住所+サイズ1行、DC/サーバー1回、紹介文スクロール、次の目的地カード追加）。props 変更（onPrev/onPrimary 撤去、nextStep 追加）。
- `src/components/housing/tour/TourProgressPanel.tsx` — リング+軒数横並び、フェーズ枠、操作3ボタン受け入れ。props 追加（phase/viewStartAt/行き方/onPrev/onViewStart/onNext/isLast/canView 等）。
- `src/components/housing/tour/TourRouteSteps.tsx` — 縦ステッパー（青丸+伸びる青線）へ視覚刷新。
- `src/components/housing/pages/TourNavPage.tsx` — 新 props の配線（phase/開始時刻/行き方 resolve/見学ハンドラ）。
- `src/lib/housing/useElapsed.ts`（新規・小）— 開始時刻→経過秒を毎秒返す hook。
- `src/styles/housing.css` — 左右パネルの新レイアウト、フェーズ枠、縦ステッパー、リング横並び。**全て `--housing-*` トークン経由**（ハードコード禁止）。
- `src/locales/{ja,en,ko,zh}.json` — 紹介文リネーム＋新規キー（**該当ブロックのみ textual 編集**・4言語 parity）。
- 対応する `__tests__/`（TourShowcasePanel / TourProgressPanel / TourRouteSteps / TourNavPage / store）。

## 8. テスト方針

- **store**: startViewing で phase/viewStartAt が立つ、next/prev/start/reset で moving にリセットされる（vitest 単体）。
- **useElapsed**: fake timer で経過が進む（実タイマー残さない・vmThreads 前提でクリーンに）。
- **TourShowcasePanel**: 住所+サイズ1行、紹介文ラベル=紹介文、次の目的地カードが nextStep で出る/最後で消える、操作ボタンが無いこと。
- **TourProgressPanel**: フェーズ枠が moving で行き方/viewing でタイマー、見学ボタンの有効/無効（canView）、リング横並び。
- **TourRouteSteps**: 状態別クラス（arrived/current/upcoming）が付く（青線表現は CSS なので DOM 属性で検証）。
- **TourNavPage**: 見学押下→viewing、次へ→moving＋index進行、最後で completed。
- i18n parity テスト（既存 `sheet-import-wizard-i18n-parity` と同様の観点で4言語欠けなし）。

## 9. 実装順（優先度）

1. store（phase/viewStartAt/startViewing）＋ useElapsed hook＋単体テスト
2. i18n（紹介文リネーム＋新規キー・4言語）
3. TourShowcasePanel（表示専用化）
4. TourProgressPanel（横並び＋フェーズ枠＋操作ボタン）＋ TourRouteSteps（縦ステッパー）
5. TourNavPage 配線
6. CSS（トークン経由）
7. build + vitest 緑 → ローカルHMR確認（ユーザー・新機能ゲート）→ デプロイ
8. **（別タスク・最後）** 🐛家と道の枠線根治

## 10. 将来同期への橋渡し（forward-compat）

- ストアの `currentIndex` / `phase` / `viewStartAt` / （将来 `hostId`/委譲リスト）は**素の JSON**。そのまま
  共有ドキュメント（Firestore）に写せる形。同期版は「ストアの読み書きをローカル→onSnapshot/幹事書込に
  差し替える」追加層で、本設計の画面・ボタン・タイマー表示・フェーズはそのまま流用する。
- 経過時間はサーバーに毎秒書かず「開始時刻」だけ共有し各クライアントが計算 → 同期版でも同じ設計で通る。
