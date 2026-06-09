# リアルタイム共同編集 段取り⑤-3c 設計書 — 注意 UI + ログインゲート + 編集解禁 (クライアントゲート版) (2026-06-09)

> 段取り⑤ (共同編集の実入口) を 4 分割した 3 番目の塊。**ジョイナーが「実際に編集できる」**ようにする段。
> 完了時: 招待リンク `/collab/:roomToken` を開いたジョイナーが、**初回フル警告に同意 → ログイン**すると、その部屋の表を**一緒に編集**できる(編集はオーナーの本物の表にライブ反映され、全員退室後も残る)。未ログイン/未同意は従来どおり読み取り専用(⑤-3b)。
> 親設計書: [2026-06-05-realtime-collab-stage5-collab-entry-design.md](./2026-06-05-realtime-collab-stage5-collab-entry-design.md) (§3 参加体験 / §7 編集のログイン必須)。前段: [2026-06-09-realtime-collab-stage5-3b-joiner-view-design.md](./2026-06-09-realtime-collab-stage5-3b-joiner-view-design.md)。
> ブレスト(2026-06-09)の合意を spec 化したもの。**完成までUIは一切露出しない**(ユーザー指示・厳守)。

---

## 0. ⑤-3 の 4 分割 (この設計は ⑤-3c)

| 段 | 内容 | 状態 |
|---|---|---|
| ⑤-3a | オーナー入口: 共有2択 + ルーム発行/人数/失効/再発行 + roomToken 結線。 | 実装済(branch held) |
| ⑤-3b | ジョイナー読み取り専用ライブビュー: `/collab/:roomToken` + 一時ワークスペース + contentId seed。 | 実装済(branch held) |
| **⑤-3c** | **注意 UI + ログインゲート + 編集解禁(本設計・クライアントゲート版)**: 部屋ごとフル警告モーダル + 常時赤バナー + 未ログイン/未同意=閲覧のみ + ログイン済+同意済=編集解禁。 | この設計 |
| ⑤-3d | 実データ往復 E2E: ユーザー+Claude の2ブラウザで実プランを編集→保存→再接続残存。 | 後続 |

**⑤-3c の本質**: ⑤-3b で「リンクをもらった人がライブで見られる」は成立した。⑤-3c は **「同意してログインした人が一緒に編集できる」を初めて成立させる**。ただし**サーバ側の身元検証は持たない**(クライアントガードのみ)。サーバ側編集認証は presence(④)と同時の「公開条件」として後送する(親設計書 §7・後述 §1 非ゴール)。

---

## 1. ゴールと非ゴール

### ゴール
- ジョイナーが **部屋ごとのフル警告モーダルに同意** + **ログイン**すると、`startCollabSession(roomToken, { readOnly: false })` で **編集者として** 部屋に参加し、表を一緒に編集できる。
- 編集はオーナーの本物の表に **ライブ反映**(②-a/②-b エンジン経由)され、DO の onSave 経由でオーナーの Firestore に保存される(③ 経路)。
- **未ログイン or 未同意のジョイナーは読み取り専用**(⑤-3b の挙動を維持)。
- **部屋内に常時の赤い注意バー**(誰の表か + 元に戻せない警告 + 未ログイン時はログイン CTA)。
- **編集できるジョイナーでも、ジョイナー自身の localStorage/Firestore は一切汚さない**(⑤-3b の無漏洩を維持。編集対象は「オーナーの表」であって自分の保存物ではない)。
- 既存の **ソロ / コピー共有 / オーナー入口(⑤-3a) / ⑤-3b 読み取りジョイナー / ②-a/③/②-b** を一切壊さない。

### 非ゴール (後続に送る)
- **サーバ側編集認証**(worker/DO が WebSocket 接続の身元 hash UID を検証し、未認証の Yjs update を拒否) → **presence(④)と同時の「公開条件」**(親設計書 §7)。⑤-3c は**クライアントガードのみ**(`enterCollabMode` を未ログイン時に呼ばない)。技術的に詳しい第三者がクライアントガードを回避して未ログイン編集する余地は残るが、**⑤-3c は UI 非露出 held のままなので実ユーザーには届かない**。公開(UI 露出)の必須条件にサーバ側認証を含める。
- **presence / カーソル / 参加者一覧** → 段取り④。
- **Undo / 版を戻す** → ②-c 以降。⑤-3c の荒らし対策は「部屋ごと同意 + ログイン必須(クライアント) + オーナーの失効」まで。
- **凝った警告アニメ・色強度の最終調整** → 実機で最後に詰める(親設計書 §3。機能色「赤=危険」は UI ルール許可範囲)。
- **実データ2ブラウザ E2E** → ⑤-3d。

---

## 2. アーキテクチャ — 「読み取り専用ジョイナーを条件付きで編集者に昇格させる」

```
/collab/:roomToken (CollabJoinerPage)
        │
        ▼ on mount
  setCollabReadonly(true)   ← ★persist skip: 全ジョイナー常時ON(自分のlocalStorage保護)。編集可否と独立。
  enter(roomToken)
        │
        ▼ canEdit = isLoggedIn && hasRoomConsent(roomToken)   ← ★編集ゲート(persist skip とは別概念)
        │
   ┌────┴─────────────────────────┐
   │ canEdit=false                │ canEdit=true
   ▼                              ▼
 startCollabSession(             startCollabSession(
   roomToken,{readOnly:true})      roomToken,{readOnly:false})  ← enterCollabMode 実行=編集がYに流れる
 = ⑤-3b 購読のみ                  = 編集者として参加
   + 赤バナー(ログインCTA/同意CTA)   + 赤バナー(誰の表か・undo無し警告)
        │                              ▲
        │ 同意モーダル accept / ログイン │
        └──────────────────────────────┘
              canEdit が false→true に変化 → セッション張り直し(disconnect→readOnly:false 再接続)
```

### 2 つの独立した概念 (⑤-3c の肝・⑤-3b からの最重要分離)
⑤-3b では「ジョイナー = 読み取り専用」で 1 つのフラグ(`_collabReadonly`)が両方を兼ねていた。⑤-3c で **明確に分離**する:

| 概念 | 意味 | 値 |
|---|---|---|
| **persist skip** (`_collabReadonly`) | 自分の localStorage に部屋データを保存しない(自分のソロ保存物の保護) | **全ジョイナー常時 true**(編集できても、いじっているのはオーナーの表) |
| **編集ゲート** (`canEdit`) | この表を編集できるか | `isLoggedIn && hasRoomConsent(roomToken)` |

- 編集できるジョイナーの保存経路: 自分のクライアントは保存しない(persist skip + Layout 非経由)。**オーナーの表への保存は DO(onSave)が server 側で代表(③ 経路)**。よって編集ジョイナーでも自分の localStorage/Firestore は無傷。
- ⚠ `_collabReadonly` という名前は ⑤-3c では「読み取り専用」を意味しなくなる(編集ジョイナーでも true)。**writing-plans で `_collabEphemeral`(自分に保存しない一時ミラー)へのリネームを検討**(⑤-3b のコード+テストに波及するため、リネームは独立ステップで)。本設計では概念名「persist skip」で扱う。

---

## 3. 部屋ごとフル警告モーダル (同意・記録)

### なぜ「部屋ごと」か (グローバル一度きりではない)
- 編集は**オーナーの本物の表を、undo 無しで不可逆に書き換える**(②-c まで巻き戻し不可)。
- **部屋ごとにオーナーが違う** = リスクの文脈が部屋固有。別の固定パーティのリンクを新しく開いたら、それは別人の大事な表。
- 業界水準: Google Docs 等が毎回フル警告を出さないのは**版履歴/undo がある**ため。LoPo は undo が無いので、高リスク・不可逆の文脈では「文脈(部屋)が変わるたびに警告」が妥当。
- → **`roomToken` をキーに localStorage に同意を記録**。同じ部屋の再入室では出ない(固定パーティなら実質初回だけ)。**新しい roomToken を開いたらフル警告が再度出る**。親設計書 §3 の「その部屋に初めて入るとき1回」と一致。

### 実装
- 新規 `src/lib/collabEditConsent.ts`: `hasCollabEditConsent(roomToken): boolean` / `setCollabEditConsent(roomToken): void`。localStorage キー例 `lopo_collab_edit_consent`(値 = 同意済み roomToken の配列 or マップ)。既存 [src/lib/popularConsent.ts](../../../src/lib/popularConsent.ts) と同型(ただし**キー付き**)。
- 新規 `src/components/CollabEditConsentModal.tsx`: [PopularConsentDialog.tsx](../../../src/components/PopularConsentDialog.tsx) を流用したフルモーダル(同意必須・キャンセルで閲覧のみに留まる)。
- 表示条件: ジョイナーが **ログイン済み && 当該 roomToken 未同意** のとき、シート上に被せて表示。accept → `setCollabEditConsent(roomToken)` → `canEdit` true → セッション張り直し。cancel → 閉じる(読み取り専用のまま閲覧継続。バナーから再度開ける)。
- 未ログインのジョイナーには出さない(先にログインが要る。ログイン後に出る)。

---

## 4. 常時赤バナー (部屋内・出しっぱなし)

- 新規 `src/components/CollabJoinerBanner.tsx`: `CollabJoinerPage` の sheet 表示時に常駐(クリックを妨げないゲートでない帯)。機能色「赤=危険」(UI ルール許可範囲)。視覚詳細(動き・強度)は実機で最後に詰める。
- 文言(状態別・i18n 4 言語):
  - **編集可(canEdit)**: 「これは {label} の本物の表です。編集は全員に反映され、元に戻せません。」(`label` = §5 のオーナー設定ラベル。空なら「共有された表」)。
  - **ログイン済・未同意**: 「編集するには注意事項への同意が必要です」+ [同意して編集] ボタン(§3 モーダルを開く)。
  - **未ログイン**: 「閲覧のみです。編集するにはログインしてください」+ [ログインして編集] ボタン(§6)。
- ジョイナーに**共有/リンクコピー UI は出さない**(再配布をそそのかさない・親設計書 §3)。

---

## 5. オーナー設定の部屋ラベル (誰の表か・PII なし)

「これは ○○ の本物の表です」の **○○** をどう供給するか。

### 設計判断: アカウント名の使い回しではなく「発行時にその場で打つ部屋ラベル」
- ❌ アカウントの displayName 使い回し: displayName は**自己設定値**([users/{uid}.displayName](../../../src/store/useAuthStore.ts#L292)・`updateDisplayName` で本人が付ける・初期空/'Guest'・**Discord 由来でも PII でもない**([_discordHandler.ts:155](../../../api/auth/_discordHandler.ts#L155) は hash UID でカスタムトークン発行のみ))。PII ではないが、**本人が別目的で付けたグローバル名を自動露出**してしまう(その場で意図して晒した名前ではない)。
- ✅ **採用: オーナーがリンク発行時にその場で任意入力する部屋ラベル**。`collabRooms/{roomToken}.label?`(自由文・任意)。空欄ならバナーは汎用文言にフォールバック(**アカウント名を勝手に露出しない**)。

### セキュリティ評価 (PII / ホールなし)
- ①**本人がその場で打った文字だけ**(自動取得ゼロ)。②既存の seed 経路(`COLLAB_SHARED_SECRET` 認証の裏・ジョイナーは元々表の中身を全て見ている)に相乗りで**新しい攻撃面なし**。③React のテキストエスケープで **XSS なし**。④リンクを持つ人にしか見えない(= ラベルは元々ジョイナー向けの表示)。

### 配送 (contentId と同型の seed・additive)
- `collabRooms/{roomToken}.label?` を受付係 load が読み(既に collabRooms を読んでいる)、load レスポンスに `ownerLabel?` を含める。
- worker `buildSeedDocFull` が planMeta に `META_OWNER_LABEL` として seed(save 非対象 = `readPlanDataFull` は読まない)。client `readOwnerLabel(doc)` で取得 → 一時セッション state へ → バナーが表示。
- ⑤-3a のオーナーパネル(発行 UI・branch held)に **任意のラベル入力欄**を1つ足す(発行/再発行時に `/api/collab/room` へ送る)。`collabRooms` doc に `label` フィールド追加。

---

## 6. ログインゲートと編集解禁

- **未ログイン**: 閲覧可(⑤-3b)。編集アフォーダンスは ⑤-3b のゲートで既に無効。赤バナーの [ログインして編集] → `signInWith('discord')`(既存)。
  - ログインは **Discord リダイレクト方式**([useAuthStore.ts:75](../../../src/store/useAuthStore.ts#L75) `window.location.href = data.url`)。`buildReturnUrl(window.location.href)` が**現在 URL = `/collab/:roomToken` を保存**([useAuthStore.ts:38](../../../src/store/useAuthStore.ts#L38))→ Discord → コールバックが `lopo_auth_return_url` を復元して**同じ部屋に戻す**([_discordHandler.ts:171-177](../../../api/auth/_discordHandler.ts#L171))。**特別な処理は不要**(検証済)。
  - 復帰後はフルページ再マウント → `isLoggedIn` true → (未同意なら §3 モーダル) → 同意で `canEdit` true。
- **ログイン済・未同意**: §3 のフルモーダルを表示。同意で `canEdit` true。
- **ログイン済・同意済(canEdit)**: `startCollabSession(roomToken, { readOnly: false })` = `enterCollabMode` 実行 = 編集が Y に流れる。Timeline の編集アフォーダンスが解禁される。

### `canEdit` 反転時のセッション張り直し
- ログイン: フルページ再マウント(リダイレクト)なので、新しいマウントで最初から `canEdit` 解決済み → 張り直し不要。
- 同意(in-page): `hasRoomConsent` 変化 → `CollabJoinerPage` の `useEffect` 依存に `canEdit` を含め、**false→true で readOnly セッションを disconnect → readOnly:false で再接続**(一度きりの再同期)。`startCollabSession` は readOnly を**セッション開始時に決める**設計(⑤-3b)なので、途中昇格は張り直しで実現(最小変更)。

---

## 7. クライアント実装の要点 (⑤-3b からの差分)

- **Timeline の readOnly 派生**: ⑤-3b の `isJoinerReadonly(roomToken) = roomToken !== null` を、**`canEdit` を加味した派生**に拡張(`isJoinerReadonly(roomToken, canEdit) = roomToken !== null && !canEdit`)。`canEdit` は `useCollabJoinerSession` に持たせる(下記)。これ以外の readOnly ゲート(全 mutation ハンドラの `readOnlyRef.current` 早期 return / undo/redo/clear)は**ロジック不変**(canEdit が解決した readOnly を見るだけ)。
- **`useCollabJoinerSession` 拡張**: `canEdit: boolean` を追加(`setCanEdit`)。`roomToken`/`contentId`/`ownerLabel`/`canEdit` を保持。
- **`CollabJoinerPage`**: `isLoggedIn`(`useAuthStore`)+ `hasCollabEditConsent(roomToken)` から `canEdit` を算出 → `setCanEdit` → `startCollabSession(roomToken, { readOnly: !canEdit, onContentId, onOwnerLabel })` → モーダル/バナー結線 → `canEdit` 変化で再接続。`onOwnerLabel` コールバックで `ownerLabel` を一時 state へ。
- **persist skip は不変**: `setCollabReadonly(true)` はマウント時に全ジョイナー実行(編集可否と独立)。退室 cleanup の **rehydrate → readonly 解除の順序**(⑤-3b で確定した肝)も不変。

---

## 8. エンジン/受付係/worker の差分 (オーナーラベル seed・additive)

contentId(⑤-3b)と**完全に同型**の additive 拡張:
- 受付係 [api/collab/_logic.ts](../../../api/collab/_logic.ts): `decideLoadFull` の入力に `collabRooms.label` を渡し `ownerLabel?` を返す。**room 経路のみ**(レガシー planId 経路は無し)。→ 実際は `_loadHandler` が collabRooms を読む箇所([_loadHandler.ts:23-27](../../../api/collab/_loadHandler.ts#L23))で `room.label` を取得し load レスポンスに含める形が自然(`resolveRoom` の戻りに label を足す)。詳細は writing-plans。
- worker [yjsPlanData.ts](../../../workers/collab/src/yjsPlanData.ts): `PlanDataSeed.ownerLabel?` + `META_OWNER_LABEL` を planMeta に seed。`readPlanDataFull`(save)は読まない。`collabPersistence.ts` の seed 型に継承で乗る。
- client [yjsPlanData.ts](../../../src/lib/collab/yjsPlanData.ts): `META_OWNER_LABEL` + `readOwnerLabel(doc)`。`applyRoomToStore` が sync 後に読み `onOwnerLabel` で渡す(contentId と同じ箇所)。
- `collabRooms` データモデル: `label?: string` 追加(親設計書 §6 の doc に1フィールド)。`/api/collab/room`(⑤-2a・branch held)の作成/再発行入力に任意 `label` 追加 + 検証(長さ上限・trim)。`_roomManageLogic.ts` の純検証に乗せる。

---

## 9. テスト / 検証

- **ユニット(client・root vitest)**:
  - `canEdit` 純粋判定(`computeCanEdit(isLoggedIn, hasConsent)` の真偽表)。
  - `collabEditConsent`: roomToken キーで set/has・別 roomToken は未同意・記録の独立性。
  - `isJoinerReadonly(roomToken, canEdit)` の反転(canEdit true で false)。
  - `useCollabJoinerSession`: `canEdit`/`ownerLabel` の set/clear。
  - オーナーラベル seed 往復(client `readOwnerLabel`・worker・受付係 `_logic`)= contentId と同型。
- **ユニット(worker)**: `buildSeedDocFull` が `ownerLabel` を planMeta に seed・`readPlanDataFull` は含めない。
- **ユニット(受付係)**: `_roomManageLogic` の label 検証(長さ上限/trim)。load が `ownerLabel` を返す(room.label から)。
- **コンポーネント**: `CollabEditConsentModal` の accept/cancel・`CollabJoinerBanner` の状態別文言(未ログイン/未同意/編集可)。
- **回帰/非干渉**: ソロ・コピー共有・オーナー入口(⑤-3a)・**⑤-3b 読み取りジョイナー(canEdit=false で従来どおり読み取り専用)**・②-a/③/②-b が従来どおり緑。`startCollabSession` の readOnly:false 経路が ②-a オーナーと等価(enterCollabMode 実行)。
- **無漏洩(編集ジョイナーでも)**: persist skip が canEdit に関わらず効く(編集ジョイナーの localStorage に部屋データが書かれない)。退室時 rehydrate→readonly 解除の順序維持。
- **本番結線(Claude)**: node でログイン相当(編集セッション)2クライアント同期。実データ2ブラウザは ⑤-3d。
- **非露出**: `/collab/:roomToken` への内部ナビ導線が無いこと。push 前は `npm run build` + `vitest run`(memory `feedback_vercel_tsc_strict`)。worker 変更があるので worker テスト + `wrangler deploy` は ⑤-3 完成 + 承認後。

---

## 10. ブランチ / 統合方針

- ⑤-3c は **⑤-3b ブランチ(`feat/collab-stage5-3b-joiner-view`)の上に積む**(⑤-3b の readOnly セッション・ジョイナーページ・contentId seed を前提とするため)。作業ブランチ `feat/collab-stage5-3c-edit-unlock`。
- collab の **UI は全てブランチ上に積む**(main は UI 非露出のまま)。エンジン差分(オーナーラベル seed)は additive。
- push / main マージ(UI) / `wrangler deploy` は **⑤-3(3a〜3d)完成 + サーバ側編集認証 + ユーザー承認まで保留**(UI 非表示厳守)。

---

## 11. 要検証 / 未確定 (writing-plans で詰める)
- `_collabReadonly` → `_collabEphemeral` リネームを ⑤-3c でやるか(⑤-3b コード+テストへの波及。独立ステップ推奨)。やらない場合は「名前は readonly だが意味は persist-skip」をコメントで明示。
- `canEdit` 反転時のセッション張り直し(disconnect→再接続)の実装位置と、再同期中の一時的なちらつき(接続中表示の再利用)。
- 受付係が `ownerLabel` を返す具体位置(`resolveRoom` の戻りに label を足すか、`_loadHandler` で別途読むか)。`collabRooms` doc は単純 get なので複合インデックス不要の見込み(memory `reference_firestore_composite_index` で確認)。
- `/api/collab/room`(⑤-2a)の label 入力検証(長さ上限・許可文字・trim・空→未設定)。⑤-3a オーナーパネル(branch held)へのラベル欄追加の UI 位置。
- 部屋ごと同意 localStorage のスキーマ(配列 vs マップ)と肥大化(多数の部屋に入った場合)。上限/FIFO の要否。
- 同意モーダル cancel 後の再オープン導線(赤バナーの [同意して編集] から)。
- ログインリダイレクト復帰直後、`useAuthStore.user` が populate される前の一瞬(canEdit=false→true)で二重接続が起きないことの確認(マウント時 user 未確定の扱い)。
