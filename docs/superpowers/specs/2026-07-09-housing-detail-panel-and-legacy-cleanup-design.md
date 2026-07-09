# ハウジング詳細ページ「大パネル1枚」化 ＋ 旧UI一掃 設計書

作成: 2026-07-09 / ステータス: **設計確定待ち（ユーザーレビュー前）**
関連: braindump #2（`docs/.private/2026-07-08-housing-release-feature-braindump.md`）

## 0. 用語の訂正（重要）

braindump #2 に「＝3パネルのツアービュー」と書いたのは **Claude の誤読**。ユーザーの本意は
**「探す/ツアー等と同じ、上部タブの下に広がる “1枚の大きなパネル”」**（スクショ赤枠＝大パネル領域まるごと）。
本設計はこの正しい理解に基づく。

---

## 1. 目的とスコープ

物件**詳細**を、他タブ（探す/お気に入り/ツアー中/登録する）と同じ**シェル内の「大パネル1枚」ページ**に載せ替える。
現状の「リストに被せるモーダル」＋「別フルページ」の二本立てを **1本のページに統合**し、大パネルの広さを活かして
**その家の地図（場所＋最寄りエーテライトからの経路）** も載せる。あわせて、再構築で役目を終えた**旧UIを一掃**する。

### やること
1. 詳細を `/housing/listing/:id` の **HousingShell 子ルート**にし、大パネルとして描画（モーダル廃止）。
2. 大パネル内に **地図**（ツアーの地図機構を流用）を追加。
3. モーダル/フルページの二重オーケストレーション（データ取得・編集/削除・通報バナー）を **1ページに統合**。
4. **旧UI撤去**（死にコード＋旧ワークスペース経路一式）。
5. **編集フォーム一本化**（方式A＝編集も大パネルページ化）: 旧 `HousingRegisterView` / `workspace/HousingRegisterModal` / `HousingEditModal` を撤去し、`RegisterPage` を編集対応に拡張して再利用。

> **前提（2026-07-09 ユーザー確認）**: ハウジングのユーザーデータは**現時点でゼロ**（全部本人テスト・[[feedback_housing_data_disposable]]）。
> ＝ **データ損失リスクなし**。編集経路の改修も気兼ねなく進めてよい。過剰なデータ保全テストは不要、
> **コードの正しさ（build/test 緑・編集が機能する）にフォーカス**する。軽減表（本体）は絶対に触らない。

### 非目標（今回やらない）
- 探す/お気に入り/ツアー/登録ページの再設計。
- 詳細の中身要素そのものの機能追加（ギャラリー/通報/peers のロジックは現状踏襲）。
- ハウジング以外（軽減表/管理/LP）への影響。

---

## 2. 現状（実装確認済み・path:line）

### 詳細ページ（二本立て）
- **モーダル経路**: `App.tsx:160-167`（`backgroundLocation` 有り時のみ overlay）→ `HousingDetailModalRoute.tsx`
  （getDoc / peers / notification バナー / SNS生存purge / 編集・削除・通報アクション を全部持つ）→ `HousingDetailModal.tsx`（backdrop+dialog+×+ESC）→ `HousingDetailContent.tsx`。
- **フルページ経路**: `App.tsx:131`（`/housing/listing/:listingId`・**シェル外**）→ `HousingDetailPage.tsx`（getDoc + auth待ち）→ `HousingDetailLayout.tsx`（←戻る + main）→ `HousingDetailContent.tsx`。
- **共有中身** `HousingDetailContent.tsx`: 通報バナー(条件) / `HousingPhotoGallery`(:164) / 情報ブロック（タイトル:168・住所dc/server/fullAddress:169・タグ:172・説明:179・`HousingActionBar`:183）/ `HousingDuplicatePeersSection`(:193)。`.housing-detail-content` グリッド。
- **問題点**: 取得ロジックが Route と Page で二重。詳細だけシェル外で世界観から浮く。overlay/backgroundLocation の仕掛けが複雑。

### ツアー地図機構（流用元・`TourNavPage.tsx`）
- `resolveWardMapRef(area, plot, apartmentBuilding, buildingType)` → `useWardMapAsset(mapKey)` → `buildTourMapPlacements(...)` → `TourNavMap`。
- 1軒でも「起点=最寄りエーテライト → 家への経路」を組める（アパートは plot 無しで originName フォールバック、2026-07-09 修正済）。
- 地図が引けない物件は `mapStatus='none'` で静かに非表示。

---

## 3. 設計: 詳細＝大パネル1枚ページ

### 3.1 遷移モデル（統一）
- ルート `/housing/listing/:listingId` を **HousingShell の子ルートへ移動**（現 `App.tsx:106-112` の兄弟として）。
  → `<Outlet/>` に載り、探す/ツアーと同じ**大パネル**として描画される。背景動画・タブ・StatusBar はシェルが供給。
- **カードクリック＝このページへ `navigate`**（overlay/backgroundLocation を渡さない）。「← 戻る」で一覧へ（`navigate(-1)`）。
- 直アクセス/共有URL も同じページに着地（現フルページと同URL・SEO/共有リンク維持）。
- **撤去**: overlay ルート（`App.tsx:160-167`）、`HousingDetailModal`、`HousingDetailModalRoute`、`HousingDetailLayout`。
  そのオーケストレーション（fetch/peers/notification/purge/編集削除通報）は **統合先ページに移設**。

### 3.2 統合先ページ（1つ）
`HousingDetailPage.tsx` を「大パネルの司令塔」に再構成し、`HousingDetailModalRoute` が持っていた全ロジックを吸収する:
- `loadListing`（getDoc + `canViewListing`）/ `notFound` 時 toast + 戻る。
- peers（`findListingsByAddressKey` → 自分/削除/deletedAt 除外）/ `hasDuplicates`。
- `?notification=` バナー（getDoc）/ 通報アクション（onEdit/onDelete/onDispute/onDismiss/onDismiss）。
- SNS `purgeIfTweetGone`。
- `refreshAfterChange`（再fetch + `useHousingListingsStore` upsert/remove）。
- 編集は当面 `HousingEditModal`、削除は `HousingDeleteConfirm`（据え置き。Phase 3 で見直し）。

> 実装メモ: 移植は**ロジックを新規実装せず HousingDetailModalRoute から機械移送**する（挙動不変）。TDD で「取得/peers/通報/削除後同期」の既存テストを新ページに張り替えて緑を維持。

### 3.3 大パネル内レイアウト
`HousingDetailContent` を大パネル用に再配置（ビジュアル左 / 情報右 / 地図・peers を活かす）。ワイド時:
```
┌─────────────────────────────────────────────────────────┐
│  ← 戻る                                                     │
│  [通報バナー(家主・条件表示)]                                  │
│  ┌────────────────┐   タイトル                              │
│  │  写真ギャラリー   │   住所 dc/server ・ サイズ ・ 🏷タグ       │
│  │ (大・サムネ切替)  │   紹介文                                │
│  │                │   ── ♥お気に入り / 共有 / 「ちがった」通報   │
│  └────────────────┘      (家主) 編集 / 削除                  │
│  ┌────────────────┐   ┌──────────────────────────┐        │
│  │  🗺 地図          │   │ ── 同じ住所の他の登録 ──        │        │
│  │ 場所+最寄りエーテ  │   │ [ミニカード][ミニカード]…        │        │
│  │ ライトから経路     │   └──────────────────────────┘        │
│  └────────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```
- 左カラム＝**ビジュアル（写真ギャラリー＋地図）**、右カラム＝**情報＋操作＋peers**。
- 狭い画面（`md` 未満）は**単一カラムに縦積み**：ギャラリー→情報→操作→地図→peers。
- レイアウトは `src/styles/housing.css` の `--housing-*` トークン経由（ハードコード禁止）。既存 `.housing-detail-*` を大パネル用に更新。

### 3.4 地図（流用）
- 地図配線は独立部品 **`HousingDetailMap`（新規・単一責務）** に隔離：`listing` を受け取り、`resolveWardMapRef`→`useWardMapAsset`→`buildTourMapPlacements`（1軒・`steps=[この家]`, `currentIndex=0`）→ `TourNavMap` を描画。
- 見せ方は**ツアーと同じ**（場所＋最寄りエーテライトからの徒歩経路）。`mapStatus`:
  - `none`（`mapRef` 引けない）→ 地図ブロックごと非表示（レイアウトは残り2要素で成立）。
  - `loading`/`error` → ツアー同様の静かなプレースホルダ。
- `HousingDetailContent` は `HousingDetailMap` を配置するだけ（フック汚染を避け表示専用を維持）。
- ※地図の「経路終端が家に刺さる/枠線」等（Project B 既知の磨き）は本設計の対象外（ツアーと共通の後追い）。

---

## 4. 旧UI一掃（grep 検証済みの正確なリスト）

判定根拠は haiku エージェントの全 import grep。**LIVE 依存は絶対に残す**。

### 4.1 即削除（死にコード）
- `workspace/HousingCardExpanded.tsx`（import 0）＋ `workspace/index.ts` の該当 export ＋ `housing.css .housing-card-expanded`。

### 4.2 旧経路のみ（隠しURL専用・削除）
コンポーネント（各 `.tsx` ＋ 併存 `__tests__` ＋ `workspace/index.ts` export）:
`HousingWorkspace` / `TopBar` / `CenterArea` / `RightPanel` / `MapView` / `PinterestView` / `HousingCard` /
`TourBuilderPane` / `TourBuilderItem` / `FavoritesModal` / `FavoritesListPane` / `MapBubbleCard` /
`HousingPage` / `register/HousingRegisterForm` / `register/HousingRegisterFormModal`。

共有ファイルの編集:
- `App.tsx`: import 行（`HousingPage`/`HousingWorkspace`）と ルート **`/housing/legacy`（:114）・`/housing/p/:listingId`・`/housing/tour/:tourId`（:128-129）** を削除。
- `workspace/index.ts`: 上記の export 行を削除。
- `housing.css`: **旧UI固有セレクタのみ**削除（`.housing-top` / `.housing-card-expanded` / `.housing-bubble-card` / `.housing-view-mode-toggle` 等）。**`--housing-*` トークン・`.housing-panel`・`.housing-register-modal-*`（編集で使用）・`.housing-workspace`（新旧共有）は削除禁止**。

### 4.3 P1 では残す（LIVE・P1 では削除厳禁）
- `workspace/HousingRegisterModal` ＋ `register/HousingRegisterView` ＋ `edit/HousingEditModal`（**編集フロー**）。
  → **P3 で撤去**（方式A で編集を大パネルページ化した後）。P1 の掃除では触らない。
- `HousingDeleteConfirm` / `HousingActionBar` / `HousingPhotoGallery` / `HousingDuplicatePeersSection`（詳細で継続使用）。

### 4.4 恒久的に残す（削除厳禁）
- `workspace/HousingCardAmbientSlideshow` ＋ `workspace/HousingCardVideoOverlay`（**新カード** browse/tour で使用）。
- `register/RegisterSection*` / `register/HousingRegisterAddressFields` 等、新フォーム資産（`RegisterPage` と P3 の編集で使用）。

### 4.5 安全策
- 削除は**依存の葉から根へ**（例: MapBubbleCard→MapView→CenterArea→HousingWorkspace の順）。
- 各削除後に **`npm run build`（tsc -b 厳密）＋ `vitest run`** を通す（未使用 import/型不足で Vercel が落ちる罠を防止＝[[feedback_vercel_tsc_strict]]）。
- テストファイルも同時削除（旧コンポーネントの test は対象コンポーネントごと消す）。
- **DEV 専用ルート（`/housing/dev/*`）は残す**（`import.meta.env.DEV` 限定・撤去対象外）。

---

## 5. Phase 3（本編）: 編集フォーム一本化（方式A）

**現状**: 新規登録＝`RegisterPage`（+ `RegisterSection*`）。編集＝`HousingEditModal`→`HousingRegisterModal`(workspace)→**`HousingRegisterView`（旧フォーム）**。フォーム実装が新旧2つ並存。

**狙い**: 編集を新フォーム（`RegisterPage`）へ寄せ、旧フォーム一式を撤去して並存を解消。

**方式A（採用）＝編集も大パネルページ化**:
- ルート `/housing/listing/:listingId/edit` を **HousingShell 子ルート**に追加（詳細と同じ大パネル）。
- `RegisterPage` を `mode: 'create' | 'edit'`＋`initialValues`（対象 listing）対応に拡張して再利用:
  - **プリフィル**: address / media(sourceImageUrls) / intro / tags / visibility を listing から初期化。
  - **保存**: create=POST（現状） / edit=更新（既存 `useHousingUpdate` を接続）。ボタン文言「公開する」→「保存する」。
  - **保存後**: 詳細へ戻る（`navigate` 戻り）＋詳細再fetch＋一覧ストア同期＋（通報起因なら）`resolveReport` 連動。
- 詳細ページの「編集」ボタンは `HousingEditModal` を開くのをやめ、`/housing/listing/:id/edit` へ `navigate`。
- **撤去**: `HousingEditModal` / `workspace/HousingRegisterModal` / `register/HousingRegisterView`（＋各 test・barrel export・`.housing-register-modal-*` のうち編集専用セレクタ）。

**方針（データなし前提で軽量に）**:
- §1 前提のとおり**ユーザーデータはゼロ＝データ損失リスクなし**。よって「既存編集を壊さない」ためのデータ保全 TDD は不要。
- 代わりに**機能テスト**で担保: `RegisterPage` の `mode='edit'` プリフィルが listing 値を反映する / 保存が更新 API を呼ぶ / 保存後に詳細へ戻る、の unit/コンポーネントテスト。
- `RegisterPage` は既に create 用の scroll-spy ページ。edit 分岐は**加算的**に足す（create 挙動は不変）。

**注意**: 「編集」は詳細ページ内から入るので、詳細（P2）が先に固まっている必要がある。実装順は P1 → P2 → P3。

---

## 6. テスト方針
- **純ロジック不変**: 取得/peers/通報/削除同期は挙動不変で移送 → 既存テストを新ページに張り替え緑。
- **地図**: `HousingDetailMap` の `mapStatus` 分岐（none 非表示 / ready 描画）を unit（既存 `buildTourMapPlacements`/`resolveWardMapRef` テスト資産を利用）。
- **回帰**: 削除フェーズごとに `npm run build` ＋ `vitest run` 全緑を維持（[[reference_vitest_vmthreads_hang]] の安全実行手順厳守・出力をパイプしない）。
- **実機**: 見た目に関わるため、開発者の実画面（CSS 1489 / DPR 2.58）でユーザーが HMR 確認（[[feedback_no_screenshots_local_verify]]）。詳細=大パネルの遷移・地図・戻るを1回通す（[[feedback_endpoint_user_verification]]）。

---

## 7. 実装フェーズ（マルチエージェント / 安価モデル配分）

ユーザー要望＝複数エージェント・安価モデルで安全かつ高速。フェーズ分割:

| Phase | 内容 | 並列性 | モデル配分 |
|---|---|---|---|
| **P1 掃除** | §4 の削除（葉→根・build/test 検証） | 機械的・高 | 安価(haiku)中心。ただし削除後 build/test ゲートは慎重に |
| **P2 詳細大パネル** | §3（ルート移設 / ロジック統合 / レイアウト / 地図 / モーダル撤去） | 中（配線は逐次） | 中〜上位。実装は慎重 |
| **P3 編集一本化** | §5（方式A・編集も大パネルページ化 → 旧フォーム一式撤去） | 中 | 中位。データ保全テスト不要（データ0）・機能テストで担保 |

- 実行は `writing-plans` → `subagent-driven-development`（または Workflow）。**共有ファイル（App.tsx / housing.css / workspace/index.ts）を同時編集する並列は避ける**（衝突回避のため逐次 or worktree 分離）。
- 各 Phase 完了で緑を確認してから次へ（安全マージン維持）。

---

## 8. リスクと安全策（まとめ）
- **データ損失**: ハウジングのユーザーデータは**ゼロ**（[[feedback_housing_data_disposable]]）＝損失リスクなし。編集改修も気兼ねなく可。軽減表本体は不可触。
- **編集の機能破損**: P1 では編集フロー（`HousingRegisterModal`/`View`/`HousingEditModal`）を触らない。P3 で方式A に置換後、**編集が機能する**ことを機能テスト＋実機で担保してから旧フォームを撤去。
- **LIVE カード破損**: `HousingCardAmbientSlideshow`/`VideoOverlay` は残す。
- **共有CSS巻き込み**: トークン/共有クラスは残し、旧UI固有セレクタのみ削除。
- **共有リンク切れ**: `/housing/listing/:id` の URL は維持（シェル子へ移すだけ）。overlay 廃止で挙動は「常にページ遷移」に統一。
- **Vercel tsc 厳密**: 削除で未使用 import/型不足が出やすい → 各段 build ゲート。
```
