# リアルタイム共同編集 段取り⑤-3b 設計書 — ジョイナー読み取り専用ライブビュー (2026-06-09)

> 段取り⑤ (共同編集の実入口) を 4 分割した 2 番目の塊。**ジョイナー(招待された人)側だけ**を作る。
> 完了時: 招待リンク `/collab/:roomToken` を開くと、その部屋の軽減表が **リアルタイムで見える(編集はまだ不可)**。保存プランにはならず、ページを離れると消える。
> 親設計書: [2026-06-05-realtime-collab-stage5-collab-entry-design.md](./2026-06-05-realtime-collab-stage5-collab-entry-design.md) (§3 参加体験 / §8 クライアント差分 / §11 要検証)
> 前段(オーナー側): [2026-06-08-realtime-collab-stage5-3a-owner-entry-design.md](./2026-06-08-realtime-collab-stage5-3a-owner-entry-design.md)。前段(エンジン): ②-b-1(軽量 PlanData 同期)/②-b-2(partyMembers 同期)で **PlanData 全要素がライブ同期済**。
> ブレスト(2026-06-09)の合意を spec 化したもの。**完成までUIは一切露出しない**(ユーザー指示・厳守)。

---

## 0. ⑤-3 の 4 分割 (この設計は ⑤-3b)

| 段 | 内容 | 状態 |
|---|---|---|
| ⑤-3a | オーナー側の入口: 共有2択 + ルーム発行/人数/失効/再発行 UI + ツールバー常設チップ + roomToken 結線。 | 実装済(branch `feat/collab-stage5-3a-owner-entry` held) |
| **⑤-3b** | **ジョイナー読み取り専用ライブビュー(本設計)**: `/collab/:roomToken` + SavedPlan に紐づかない一時ワークスペース + 読み取り専用 + 退室クリア + contentId の seed 配送。 | この設計 |
| ⑤-3c | 注意 UI + ログインゲート + 編集解禁: 初回フルモーダル + 常時赤バナー + 未ログイン=閲覧のみ + サーバ側編集認証。 | 後続 |
| ⑤-3d | 実データ往復 E2E: ユーザー+Claude の2ブラウザで実プランを編集→保存→再接続残存。 | 後続 |

**⑤-3b の本質**: エンジン(全要素ライブ同期)とオーナー入口は揃った。⑤-3b は **「リンクをもらった人が、その表をライブで見られる」を初めて成立させる**。編集解禁・警告・ログインは ⑤-3c に送る(警告 UI が無いまま編集を解禁しない=安全な段階分け)。

---

## 1. ゴールと非ゴール

### ゴール
- 新ルート `/collab/:roomToken` を開くと、**SavedPlan に紐づかない一時ワークスペース**が立ち上がり、`startCollabSession(roomToken)` で部屋に接続して軽減表を **リアルタイム描画(読み取り専用)**。
- 部屋の全要素(mitigations / events / phases / labels / memos / partyMembers / 設定 / currentLevel)が、他参加者の編集に追従してライブ更新される。
- **`contentId`(どのボス/コンテンツの表か)を、共同編集の seed(信頼できる唯一のデータ経路)経由でジョイナーに届け**、正しいボス行動表・ヘッダーを描画する。
- **読み取り専用を担保**: ジョイナーは編集 UI を持たず、書き込み配線(`enterCollabMode`)もしない。万一の操作も他参加者に一切届かない。
- **ジョイナーのデータがジョイナー自身のアカウント(Firestore/localStorage)に保存される事故を物理的に防ぐ**(専用ページが通常アプリの自動保存経路を通らない造り)。
- 退室(ページ離脱)で一時状態を完全クリア(自分の保存一覧・サイドバーに残さない)。
- 既存の **コピー配布共有(ShareModal)・1人モード・オーナー入口(⑤-3a)・保存/墓標/マージ・②-a/③/②-b は一切壊さない。**

### 非ゴール (後続に送る)
- **編集解禁・未ログイン=閲覧のみのログインゲート・サーバ側編集認証** → ⑤-3c。⑤-3b のジョイナーは **常に読み取り専用**(ログイン状態に関わらず)。
- **初回フル警告モーダル・部屋内の常時赤バナー** → ⑤-3c。⑤-3b は「接続中/無効/満員」の最低限の状態表示のみ。
- **実データ往復の2ブラウザ E2E** → ⑤-3d。
- **presence / カーソル / 参加者一覧の本格表示**(誰が見ているか) → 段取り④。⑤-3b は在室数表示も持たない(必要なら最小限)。
- **自分の一覧に「共有された他人の表」を並べる再入室の利便機能** → 後付け。⑤-3b はリンクからの一時ビューに限定。
- **オーナーパネル/共有 UI をジョイナーに出す** → 出さない(再配布をそそのかさない・親§3)。

---

## 2. アーキテクチャ — 「`/share` の一時ビューを、ライブ購読版にする」

```
招待リンク /collab/:roomToken
        │
        ▼
[CollabJoinerPage]  ── on mount ──▶ startReadonlyCollabSession(roomToken)
   roomToken 抽出                       provider 接続(worker lopo-collab)
        │                               observeDeep → store._apply*FromCollab(ライブ流入)
        │                               ※ enterCollabMode は呼ばない(=書き込み配線なし)
        │                               sync 後: planMeta から contentId を読み一時状態へ
        ▼
[一時セッション state]  ── 提供 ──▶  [軽減表の描画サブツリー(Timeline 等を再利用)]
   { roomToken, contentId, readOnly:true }   ・読み取り専用で描画(編集UI無効/非表示)
        │                                    ・contentId は一時状態から供給
        ▼
   退室(unmount): session.disconnect() + 一時状態クリア + store リセット
   ※ 自動保存(Firestore/localStorage)は専用ページが通さない
```

- ジョイナーの **唯一のデータ経路は Yjs(worker 経由の部屋)**。ジョイナーは Firestore の `plans/{planId}` に直接アクセスしない(オーナーの私的プランを読まない)。だから `contentId` も同じ信頼経路(seed)で届ける。
- 「誰もいない部屋は存在しない」(③通り)。無効/失効/不存在の部屋は seed が空(deleted)で返り、ジョイナーは無効状態を表示する。

### 既存資産を壊さない原則
1. **既存のコピー配布共有(ShareModal / `/api/share` / `/share/{shareId}`)・1人モード・オーナー入口(⑤-3a)は無傷。** ⑤-3b は別ルート `/collab/:roomToken`・別ページで共存。
2. **②-a/③/②-b の同期エンジン・保存ロジックは無改変。** ⑤-3b の追加は「読み取り専用セッション + ジョイナーページ + contentId の seed 配送(additive)」のみ。
3. **mitigations/events/... の save 経路は無改変。** contentId は **seed(読み取り)専用**で、save には載せない(オーナーの不変属性を書き戻さない)。

---

## 3. ジョイナー体験 (UX・⑤-3b 範囲)

- `/collab/:roomToken` を開く → **「接続中…」** → 同期完了で軽減表がライブ表示。
- 表は **完全な読み取り専用**: 軽減のドラッグ/追加/削除、イベント・フェーズ・ラベル・メモ編集、パーティ/ジョブ/ステータス/レベル変更、保存・undo/redo・共有・サイドバー(プラン管理)を **無効化または非表示**。
- 他の参加者(オーナー等)の編集が **リアルタイムで反映**される(見るだけ)。
- **共有/リンクコピー UI は出さない**(再配布をアプリがそそのかさない・親§3)。
- ページを離れると一時ビューは消える(自分のアカウント・一覧には何も残らない)。
- **状態表示(最低限)**: 接続中 / リンク無効・失効(seed が deleted) / 満員(⑤-2b が接続拒否)。凝った警告・ログイン導線は ⑤-3c。

> 編集できない理由の文言など「なぜ読めるだけか」の丁寧な説明は ⑤-3c(警告 UI・ログイン導線)で本格化する。⑤-3b では最小限の状態メッセージに留める。

---

## 4. 読み取り専用セッション (クライアント・エンジン無改変で追加)

現状 [startCollabSession](../../../src/lib/collab/collabProvider.ts) は接続時に `enterCollabMode(handlers)` を呼び、store の編集を Y に委譲する(=編集者)。ジョイナーは **編集者ではなく購読者**なので、これを分ける。

- **`startCollabSession` に読み取り専用オプションを追加**(例 `startCollabSession(roomToken, { readOnly: true })`、既定 false で既存挙動不変):
  - `readOnly` のとき **`enterCollabMode` を呼ばない**(store の `_collabActive` は false のまま=編集は Y に流れない)。
  - observeDeep の登録と初期反映(`_apply*FromCollab`)は **従来どおり実行**(部屋の変更がライブで store に流入する)。
  - sync 完了後に **planMeta から `contentId` を読み**(§5)、一時セッション state にセットする。
- **disconnect** は従来どおり(provider.destroy/doc.destroy/unobserve)。`readOnly` のときは `exitCollabMode` を呼ばない(そもそも入っていない)。
- 設計判断: 読み取り専用は **「書き込み配線をしない」+「編集 UI を出さない」の二重**で担保。`enterCollabMode` を呼ばないので、たとえジョイナー側で何かの mutation が走っても **Y には一切届かず**、ジョイナーのローカル一時ビュー(退室で破棄)だけが動く=他参加者に影響しない。

---

## 5. contentId の seed 配送 (エンジンへの最小 additive 拡張)

`contentId` は SavedPlan の不変属性で、PlanData にも Yjs 同期にも無い([Timeline.tsx:1165](../../../src/components/Timeline.tsx#L1165) は `usePlanStore` の選択中プランから読む)。ジョイナーは SavedPlan を持たないため、別経路で届ける。**変わらない値なので「同期」ではなく「seed(種)」として 1 回だけ Y.Doc に載せる**(順番B決定の「contentId は seed のみ」と整合)。

- **受付係 Vercel** ([_loadHandler.ts](../../../api/collab/_loadHandler.ts) / [_logic.ts](../../../api/collab/_logic.ts) `decideLoadFull`): プラン doc の **トップレベル `contentId`**(`data.*` ではない)を読み、load レスポンスに `contentId` を含める。墓標/不存在は従来どおり deleted。
- **worker** ([yjsPlanData.ts](../../../workers/collab/src/yjsPlanData.ts) `buildSeedDocFull`): seed の `contentId` を **planMeta に種として入れる**(新キー `META_CONTENT_ID`)。`readPlanDataFull`(save 用)は **contentId を読まない/返さない**(書き戻さない=オーナー属性を汚さない)。`collabPersistence.ts` の seed 型に `contentId?` を追加(load から授受)。
- **クライアント** ([yjsPlanData.ts](../../../src/lib/collab/yjsPlanData.ts) `readPlanMeta` 相当): planMeta から `contentId` を読む手段を追加。読み取り専用セッションが sync 後に取得し、一時セッション state へ。
- **オーナー側は無影響**: オーナーは自分の SavedPlan から contentId を持っているため、この seed 値は使わない(ジョイナー専用)。owner の保存/描画は不変。

> 設計判断(肝1): contentId を **Yjs の seed(planMeta・クライアントは書き換えない)** で運ぶ。URL クエリ(`?contentId=`)案より安全・確実(オーナーが発行したリンクに正しい contentId が必ず一致する。改竄/不一致の余地がない)。save 経路には載せないので、墓標/version/既存要素は完全無改変。

---

## 6. ジョイナーページとデータ漏れ防止 (設計判断の肝2)

ジョイナーが受信した部屋データが、ジョイナー自身の Firestore/localStorage に保存される事故を **物理的に防ぐ**。現状 [Layout.tsx:228](../../../src/components/Layout.tsx#L228) の自動保存は `_collabActive` のときだけ抑制されるが、読み取り専用セッションは `enterCollabMode` を呼ばない(=`_collabActive` false)ため、**通常の自動保存経路を通すと部屋データがジョイナーのプランとして保存されてしまう**。

- **`CollabJoinerPage` は通常アプリのシェル(Layout の自動保存・プラン永続化)を通さない専用ページにする**。表の **描画サブツリー(Timeline 等)を読み取り専用設定で再利用**し、保存の副作用(`syncToCloud` / zustand persist へのプラン書き込み / サイドバーのプラン管理)は **持たせない**。
- ジョイナーの store はあくまで **一時ミラー**(退室で破棄)。`currentPlanId` は設定しない(=自分の保存一覧と無関係)。
- 設計判断: 自動保存を「フラグで条件分岐」させるより、**専用ページで保存の副作用そのものを構造的に排除**する方が、読み取り専用・無漏洩を保証しやすい(条件分岐の取りこぼしリスクを断つ)。

> ⚠ 実装上の最難関(親§11): 「表の描画サブツリーを Layout の永続化副作用なしで構成する」具体的なコンポーネント合成。Timeline/MitigationSheet が Layout にどこまで結合しているかを writing-plans で精査し、(a) 描画系コンポーネントを薄いジョイナー用シェルで包む / (b) 既存 Layout に「ジョイナー読み取り専用モード」を渡して保存副作用とプラン管理 UI を全面停止する、のいずれかを確定する。**(a) 隔離方式を第一候補**(無漏洩を構造で保証)とし、結合が深く (a) のコストが高い場合のみ (b) を採る。判断材料(結合度)は writing-plans で収集。

---

## 7. contentId 供給と読み取り専用フラグの伝達

- **一時セッション state**(新規・軽量。例 `useCollabJoinerSession` store か React context): `{ roomToken, contentId, readOnly }` を保持。join 時セット・退室時クリア。
- **contentId の消費**: [Timeline.tsx:1165-1166](../../../src/components/Timeline.tsx#L1165) の `currentContentId` 解決を、**SavedPlan が無いとき一時セッション state の contentId にフォールバック**させる(`currentPlan?.contentId ?? joinerSession.contentId ?? null`)。最小変更で既存描画経路を再利用。他に contentId を読む箇所があれば同様にフォールバック(writing-plans で洗い出し)。
- **読み取り専用の消費**: 編集アフォーダンス(ドラッグ/追加/削除/各種編集/保存/undo/共有/サイドバー)が `readOnly` を見て無効化/非表示。対象一覧は writing-plans で確定(主要: 軽減配置操作・events/phases/labels/memos 編集・party/level 編集・保存/undo/redo/共有/プラン管理)。

---

## 8. ルーティング

- [src/App.tsx](../../../src/App.tsx) に `<Route path="/collab/:roomToken" element={<CollabJoinerPage />} />` を追加(`/share/:shareId` と同列)。
- `CollabJoinerPage`(新規)が `useParams` で roomToken を取り、読み取り専用セッションを開始・破棄するライフサイクルを持つ。
- **このルートへの導線(ナビリンク)はアプリ内に一切作らない**(roomToken リンクからのみ到達)。完成までの非露出を維持。

---

## 9. 状態・エラー (最低限・凝った UI は ⑤-3c)
- **接続中**: sync 完了まで「接続中…」(親が指摘した初回同期レイテンシ=③の onLoad fetch 待ち)。
- **リンク無効/失効/不存在**: seed が deleted(受付係が revoked/不存在/緊急停止で deleted を返す) → 「このリンクは無効です」。
- **満員**: ⑤-2b の `onBeforeConnect` が 403 で接続拒否 → 「満員です」。
- これらは最小メッセージ。警告モーダル・ログイン導線は ⑤-3c。

---

## 10. テスト / 検証

- **ユニット(client・root vitest)**:
  - 読み取り専用セッション: `startCollabSession(roomToken, { readOnly:true })` が **`enterCollabMode` を呼ばない**・observe 登録と初期 `_apply*` は走る・disconnect でクリーンアップ。
  - 一時セッション state: join で `{roomToken, contentId, readOnly}` セット / 退室でクリア。
  - contentId フォールバック: SavedPlan 無し + 一時 state に contentId → `currentContentId` がそれを返す。
- **ユニット(engine 追加分)**:
  - 受付係: `decideLoadFull` が `contentId` を返す(プラン top-level から)・墓標は従来どおり deleted。
  - worker: `buildSeedDocFull` が contentId を planMeta に種として入れ、クライアント read で取れる往復。`readPlanDataFull`(save)は contentId を含めない。
- **コンポーネント**: `CollabJoinerPage` が読み取り専用で表を描画(編集アフォーダンスが無効/非表示)・接続中/無効/満員の状態表示。
- **回帰/非干渉**: 既存ソロ・コピー共有・オーナー入口(⑤-3a)・②-a/③/②-b が従来どおり緑。**ジョイナーページが自動保存(Firestore/localStorage)に一切書かない**ことの検証(無漏洩)。`startCollabSession` のオプション追加が既存(owner/②-a/③)呼び出しを壊さない。
- **本番結線(Claude)**: roomToken で読み取り専用接続 → ライブ反映を node/ブラウザで確認(2ブラウザ実データ往復は ⑤-3d)。
- **非露出**: `/collab/:roomToken` への内部ナビ導線が無いこと。push 前は `npm run build` + `vitest run`(memory `feedback_vercel_tsc_strict`)。worker 変更があるので worker テスト + `wrangler deploy` は ⑤-3 完成+承認後。

---

## 11. ブランチ / 統合方針 (承認済み)

- collab の **UI は全てブランチ上に積む**(main は UI 非露出のまま)。エンジン(②-b-2)は他エンジン同様 **main に dormant 取り込み**。
- ⑤-3b は **⑤-3a(オーナー入口)ブランチの上に積む**(`startCollabSession(roomToken)` 署名・ルーム API ヘルパー等を前提とするため)。
- **⚠ マージ衝突の解消が 1 タスク**: ⑤-3a と ②-b-2 はどちらも [collabProvider.ts](../../../src/lib/collab/collabProvider.ts) を改変している(⑤-3a=planId→roomToken 署名 / ②-b-2=partyMembers/batch/buildArrByKey)。⑤-3b の作業ブランチ作成時に両者を統合し、衝突解消後に build/test 緑を確認してから ⑤-3b 本体に着手する(計画の最初のタスク)。
- push / main マージ(UI 分) / `wrangler deploy` は **⑤-3(3a〜3d)完成 + サーバ側編集認証 + ユーザー承認まで保留**(UI 非表示厳守)。

---

## 12. 要検証 / 未確定 (writing-plans で詰める)
- 「表の描画サブツリーを Layout の永続化副作用なしで構成する」具体合成(§6 (a)隔離 vs (b)モードフラグの最終判断・結合度の精査)。**⑤-3b 最大の不確実性**。
- `contentId` を読む箇所の全洗い出し(Timeline 以外にボス行動表/ヘッダー/コンテンツ依存表示で参照する箇所)。
- 読み取り専用で無効化すべき編集アフォーダンスの完全な一覧。
- 一時セッション state の置き場(専用 zustand store vs React context)と、退室時の store リセット範囲(ソロ利用へ戻したとき残渣が無いこと)。
- worker `META_CONTENT_ID` の seed 往復(save で書き戻さない保証)と、client/worker yjsPlanData ミラーの整合。
- ⑤-3a ブランチ統合時の ②-a/③/②-b テスト/フィクスチャへの影響洗い出し(collabProvider 署名変更 × partyMembers 追加の合流)。
- 状態表示(接続中/無効/満員)の判定タイミング(満員=接続拒否のハンドリング、無効=seed deleted の検知をクライアントでどう受けるか)。
