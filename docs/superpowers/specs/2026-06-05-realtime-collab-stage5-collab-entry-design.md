# リアルタイム共同編集 段取り⑤ 設計書 — 共同編集の実入口 (ルームトークン分離・共有 UX・安全弁) (2026-06-05)

> 段取り③ で「全員退室・リロード・オーナー不在でも内容が Firestore に残る保存層」まで完成した。ただし **③ までは room鍵 = plan ID** のままで、UI 入口は存在しない(休眠状態)。
> 段取り⑤ は **共同編集の実入口**を作る。核心は **ルームトークンを plan ID から分離**し、「リンクをもらった人が(コピーではなく)同じ部屋に参加して一緒に編集できる」業界標準の体験を、固定パーティ用途に最適化して実装すること。
> 親設計書: [2026-06-03-realtime-collab-design.md](./2026-06-03-realtime-collab-design.md) (§2 会議室モデル / §3 参加権限・共有・人数上限)
> 前段: [2026-06-04-realtime-collab-stage3-firestore-persistence-design.md](./2026-06-04-realtime-collab-stage3-firestore-persistence-design.md)
> ブレスト(2026-06-05)の合意を spec 化したもの。**完成までUIは一切露出しない**(ユーザー指示・厳守)。

---

## 0. 解決する核心問題 (なぜ⑤が必要か)

現状の「共有」は **スナップショットのフォーク配布**であり、共同編集ではない:

- オーナーが共有 → [ShareModal.tsx:116](../../../src/components/ShareModal.tsx#L116) が `planData` のスナップショットを `/api/share` POST → `shareId` 発行 → `/share/{shareId}`。
- もらった人がコピー → [MitigationSheet.tsx:209](../../../src/components/MitigationSheet.tsx#L209) で `crypto.randomUUID()` の**新しい plan ID** を生成。

→ **共有は毎回「別 ID 化」する。** だから ③ までの「room鍵 = plan ID」のままでは、共有した二人は別々の plan ID を持ち、**絶対に同じ部屋に繋がれない**。⑤ は room鍵を plan ID から切り離し、「ルームトークン → 実プラン(planId + ownerId)」の対応表を導入して、これを解消する。

---

## 1. ゴールと非ゴール

### ゴール
- オーナーが**共同編集リンク**を発行 → 共有(Discord 等) → **リンクを持つ人が、コピーではなく同じ部屋に参加**して一緒に編集できる。
- ルームトークンを plan ID から分離し、③ の `load`/`save` がトークン経由で正しいオーナーのプランへ読み書きする。
- オーナーが**リンクの失効/再発行**・**最大人数の設定**・(全体)**緊急停止**で安全を制御できる。
- 既存の**コピー配布共有(ShareModal)・1人モード・保存/墓標/マージは一切壊さない。**
- ⑤ 完了時に **実データ往復(オーナー+ジョイナーの2ブラウザで実プランを編集→保存→再接続で残存)**を実機検証する(③で持ち越した検証)。

### 非ゴール (後続に送る)
- **編集8席/閲覧20席・席の昇格/譲渡の凝った座席モデル** → presence/カーソル(段取り④)と同時。⑤ は「総参加人数の単純上限」のみ。理由: 席の表示は「誰がどの席か」を見せる presence が前提のため。
- **サーバ側の厳密な編集認証**(WebSocket 接続の身元検証) → presence(④)で身元を結線するときに固める。⑤ はクライアント側ガード(未ログイン=閲覧のみ)から始める。**ただし公開(=UI露出)の条件にサーバ側認証を含める**(§7 参照)。
- **軽減以外の要素(events/phases/labels/memos/partyMembers/単一値)の同期** → ②-b。⑤ の同期範囲は ②-a/③ と同じ `timelineMitigations` のみ。
- **Undo/版を戻す** → ②-c 以降。⑤ も荒らし対策は「失効+ログイン必須」までで、巻き戻しは持たない。
- **自分の一覧に「共有された他人の表」を並べる**(再入室の利便機能) → 後付け可能。⑤ はジョイナーを一時ビューに限定(§3)。

---

## 2. 全体アーキテクチャ — 「会議室の鍵を plan ID から付け替える」

```
[本棚 = Firestore]                                  [会議室 = DO 部屋 lopo-collab (①+②-a+③)]
 plans/{planId}                                      YServer の Y.Doc
   data.timelineMitigations[]                          timelineMitigations (Y.Array<Y.Map>)
   version / deleted(墓標)                                │   ▲          ▲
       ▲   │                                          オーナー    ジョイナー(一時ビュー)
       │   │                                          this.name = roomToken (★⑤の変更点)
       │   │
 collabRooms/{roomToken}  ──解決──▶ planId            ① onLoad: GET /api/collab/load?roomToken=<this.name>
   { planId, ownerId,                                    受付係が collabRooms から planId 解決
     maxParticipants, revoked }                          → plans/{planId} 読取・墓標チェック → seed
       ▲
       │ ② onSave: POST /api/collab/save { roomToken, mitigations }
       └────  受付係が roomToken→planId 解決 → 墓標ガード付きで部分更新(③のロジック再利用)
```

- **③ からの最重要変更**: DO の部屋名(`this.name`)と client の `YProvider` 第2引数を **plan ID → roomToken** に変える([collabProvider.ts:66](../../../src/lib/collab/collabProvider.ts#L66) / [server.ts:44](../../../workers/collab/src/server.ts#L44) の `this.name`)。
- **新しい対応表** `collabRooms/{roomToken}` を Firestore に追加。受付係(`/api/collab/load`・`/api/collab/save`)が**まず roomToken → planId を解決**してから、③ と同じ保存ロジック(version 楽観ロック・墓標ガード)を実行する。
- **誰もいない部屋は存在しない**原則は維持(③通り)。collabRooms 対応表は残るが、ライブ部屋(DO/Y.Doc)は全員退室で揮発。

### 既存資産を壊さない原則
1. **既存のコピー配布共有([ShareModal](../../../src/components/ShareModal.tsx) / `/api/share` / `/share/{shareId}`)は無傷。** ⑤ の共同編集は**別ルート `/collab/{roomToken}`・別 UI** で共存(親設計書 §2-3「用途が違う」)。
2. **1人モード・保存/墓標/マージ・③ の破壊保存ガードは不変。** ⑤ の追加は「対応表 + トークン解決 + 入口 UI + 安全弁」。
3. **③ の `/api/collab/load`・`/api/collab/save` の引数を planId → roomToken に変更**するが、解決後の本体ロジック(plans/{id} 読み書き・墓標ガード・version+1)は再利用する。
4. **共同編集中のクライアント Firestore 保存抑制**([Layout.tsx:228](../../../src/components/Layout.tsx#L228) `_collabActive`)は維持。確定保存は DO(onSave)が代表して1経路。

---

## 3. 参加体験 (UX)

### オーナー側 (入口 = 既存共有ボタンの中)
- 共有ボタンを押すと **「コピーを配る(既存)」と「一緒に編集する(新規)」の2択**に分岐。
- 「一緒に編集する」を選ぶとオーナー用パネル: **共同編集リンク表示・コピー・失効/再発行・最大人数設定・注意書き**。
- リンク発行 = `collabRooms/{roomToken}` を**この plan に対して作成**(既にあれば再利用)。`startCollabSession(roomToken)` で部屋に接続し、自分の表がライブ編集状態になる。
- リンクの寿命 = **常設・無期限**(案A)。普段は切れない。流出時はオーナーが**失効/再発行**(§4)。

### ジョイナー側 (もらった人)
- `/collab/{roomToken}` を開くと **一時的な共同編集ビュー**が立ち上がる(自分の保存一覧には**入らない**)。Google ドキュメントの「リンクで開いて一緒に編集」と同じ感覚。
- **閲覧は未ログイン可**(リアルタイムで表が見える)。**編集はログイン必須**(§7)。
- ジョイナーに**共有/リンクコピー UI は出さない**(再配布をアプリがそそのかさない)。
- 再入室は Discord 等のリンクから(自分の一覧からのワンクリック再入室は非ゴール=後付け)。

### 注意喚起 (流出時にオーナーの本物の表が書き換わる・undo 無しのため必須)
- **初回フルモーダル(同意必須・記録)**: その部屋に初めて入るとき1回。既存 `PopularConsentDialog` / `hasPopularConsent` パターン([ShareModal.tsx:88](../../../src/components/ShareModal.tsx#L88))を流用。
- **部屋内の常時の赤い注意バー**: 「これは ○○ さんの本物の表です。編集は全員に反映され、元に戻せません」を出しっぱなし。クリックの邪魔をしないゲートでない常駐表示。視覚詳細(動き・色強度)は実機で最後に詰める(機能色「赤=危険」は UI ルール許可範囲)。

---

## 4. リンクのライフサイクル (失効・再発行・配布制御)

| 論点 | 決定 |
|---|---|
| 発行できる人 | **オーナーのみ** |
| 配布 UI を持つ人 | **オーナーのみ**(ジョイナーには共有ボタンを出さない) |
| 寿命 | **常設・無期限**(自動失効は持たない。後付け可能) |
| 失効 | オーナーが `collabRooms/{roomToken}.revoked = true`。以後 load/save が拒否 → 部屋は保存不能=実質停止 |
| 再発行 | 新しい roomToken の `collabRooms` を同じ planId に発行し、旧トークンを失効。**新トークン = 新しい部屋**(旧部屋の在室者は旧 DO に残るが保存不能で無害化) |
| パスワード | **無し**(リンク自体が推測不能な鍵。同一経路で別途送るパスワードは安全を実質足さない) |

### 正直な限界 (明記)
- **リンクは bearer URL**。ジョイナーがアドレス欄から手でコピーして転送するのは**アプリ側で完全には防げない**。⑤ ができるのは「非オーナーに配布 UI を出さない」+「漏れたらオーナーが失効」まで。
- **最大人数は完全なアクセス制御ではない**。身内が全員揃っていない時間帯は空席があり、漏れた人が入りうる。本丸は「ログイン必須(身元が割れる→ BAN 可)+失効」(親設計書 §3 と同判断)。

---

## 5. 人数上限・緊急停止 (⑤ の安全弁)

- **最大人数**: オーナーが**システム上限内**で「この部屋は最大 N 人」を設定。デフォルト = **8 人(=零式/絶のフルパーティ1組)**。システム上限は親設計書 §3 の値(同時 30 部屋等)を踏襲。
  - **enforcement**: DO が接続時に `getConnections()` の数と上限を比較し、超過は満員拒否。上限値は onLoad のレスポンス(受付係が collabRooms から返す)で DO に渡し、DO がキャッシュして接続ごとに判定。
- **緊急停止スイッチ**: 共同編集を即 OFF にする全体フラグ。受付係(load/save)が冒頭でチェックし、OFF なら全 roomToken を拒否。実装(env 変数 or Firestore config doc)は writing-plans で確定。

---

## 6. データモデル

### 新規 Firestore コレクション `collabRooms/{roomToken}`
```
{
  roomToken:        string,   // ドキュメント ID。推測不能な長いランダム文字列(crypto)
  planId:           string,   // 紐づくオーナーのプラン
  ownerId:          string,   // オーナー(hash UID)
  maxParticipants:  number,   // オーナー設定(システム上限内、デフォルト 8)
  revoked:          boolean,  // 失効フラグ
  createdAt:        number,
}
```
- `COLLECTIONS` 定数([src/types/firebase.ts](../../../src/types/firebase.ts))に `COLLAB_ROOMS` を追加。
- **plan ⇄ room の対応はトークン主導(token → plan)**で一方向解決。1 plan に複数トークンが歴史的に存在しうる(再発行のたびに増えるが、有効なのは最新の1本。古いものは `revoked`)。

### 既存 `plans/{planId}` への最小追加(任意)
- オーナーの表に「現在有効な共同編集ルームがあるか」を素早く知るため、`plans/{planId}.activeCollabRoomToken?` を持つ案(逆引きの利便)。**任意**であり、無くても collabRooms 側で成立する。採否は writing-plans。

---

## 7. 編集のログイン必須 (段階導入と最終形)

- **v1 (⑤ 内部ビルド)**: クライアント側ガード。未ログインは**編集 UI を無効化(閲覧のみ)**。`enterCollabMode`(store の handlers 委譲)を未ログイン時は呼ばない/編集操作を握りつぶす。
- **最終形 (④ presence と同時、公開条件)**: サーバ(DO/受付係)が WebSocket 接続の**身元を検証**し、未認証接続からの Yjs update を拒否。presence に表示名・hash UID が乗るのと同じ経路で結線。
- **重要**: 「**UI は完成まで露出しない**」ため、クライアントガードだけの途中版がユーザーに渡ることはない。**公開(UI 露出)の必須条件にサーバ側編集認証を含める**。世に出る時点で業界水準を満たす。

---

## 8. クライアント実装の要点 (③ からの差分)

- [collabProvider.ts](../../../src/lib/collab/collabProvider.ts) `startCollabSession(planId)` を **`startCollabSession(roomToken)`** に変更(`YProvider` の room 名を roomToken に)。同期/handlers/observeDeep のロジックは不変。
- **オーナーフロー**: 共有パネルで「一緒に編集」→ collabRooms 発行/取得 → roomToken で接続。既存プランが選択された状態なので、store はそのまま部屋に束ねられる。
- **ジョイナーフロー(新規)**: ルート `/collab/{roomToken}` を追加。**ローカルの SavedPlan に紐づかない一時的なワークスペース**で軽減表を描画し、`startCollabSession(roomToken)` で部屋状態を store に反映。退室で store をクリア(自分のアカウントに残さない)。
  - ⚠ 現状ワークスペースは「選択中の SavedPlan」前提で描画する。ジョイナーには選択プランが無いため、**「部屋データのみで描画する一時セッション state」**が要る。ここが ⑤ クライアントで一番手当てが要る箇所(writing-plans で具体化)。

---

## 9. 受付係 (Vercel) の変更 (③ からの差分)

- `/api/collab/load` / `/api/collab/save` の**入力を planId → roomToken に変更**。
  - 冒頭で**緊急停止フラグ**をチェック(OFF なら拒否)。
  - `collabRooms/{roomToken}` を読み、`revoked === true` または不存在 → 拒否(DO は seed/保存しない)。
  - 有効 → `planId` を取り出し、**③ と同じ本体ロジック**(plans/{id} 読取・墓標ガード・`data.timelineMitigations` 部分更新・version+1)を実行。
  - load レスポンスに `maxParticipants` を含めて DO に渡す(§5 の人数 enforcement 用)。
- 共有シークレット認証(`COLLAB_SHARED_SECRET`・既存)はそのまま。**実値はコミットしない**(プレースホルダーのみ。CLAUDE.md セキュリティ厳守)。
- 新規エンドポイント: **オーナーがリンク発行/失効/再発行/上限設定**するための `/api/collab/room`(作成・更新・失効)。オーナー認証(既存のクライアント認証経路)で保護。詳細は writing-plans。

---

## 10. テスト / 検証

- **ユニット(受付係, root vitest)**: roomToken → planId 解決、revoked 拒否、緊急停止拒否、墓標ガード(③ 再利用部の回帰)、load が maxParticipants を返す。firebase-admin はモック。
- **ユニット(Worker, vitest-pool-workers)**: `this.name`=roomToken での onLoad/onSave、満員拒否(getConnections 超過)。受付係 fetch はモック。
- **ユニット(client)**: `startCollabSession(roomToken)` の接続、ジョイナー一時セッションの store 反映/退室クリア、未ログイン=編集無効ガード。
- **本番結線(node 2クライアント, 私=Claude)**: roomToken で2クライアントが同じ部屋に入り同期 → 全員切断 → 再接続で残存。
- **🎯 実データ往復(ユーザー+Claude, 2ブラウザ・⑤の受入条件)**: オーナーが実プランで共同編集リンク発行 → 別ブラウザ(ジョイナー)で開く → 双方編集がライブ反映 → 全員退室 → オーナーが再オープンで内容残存。**+ 失効したら入れない/緊急停止で止まる**を確認。
- **既存テスト(1人モード・コピー共有)が全て従来どおり緑**(非干渉の担保)。`push 前は npm run build + vitest run`(memory `feedback_vercel_tsc_strict`)。

---

## 11. 要検証 / 未確定 (writing-plans で詰める)
- ジョイナーの「ローカル SavedPlan に紐づかない一時ワークスペース」の具体実装(ルーティング・store の一時 state・退室クリア)。§8 の最重要箇所。
- `collabRooms` の複合インデックス要否([firestore.indexes.json](../../../firestore.indexes.json)・token 主導の単純 get なら不要の見込みだが要確認。memory `reference_firestore_composite_index`)。
- 失効/再発行時の**ライブ在室者の扱い**(旧 DO の接続を能動的に切るか、保存不能で自然消滅に任せるか)。
- 緊急停止フラグの置き場(env 変数 vs Firestore config doc)と反映の即時性。
- 最大人数 enforcement の境界(再接続・切断検知のタイミング差で一時的に上限を超える可能性)。
- `/api/collab/room`(発行・失効・上限設定)のオーナー認証経路と入力検証。
- `crypto.randomUUID` 相当のトークン長/エントロピー(推測耐性)。
- 既存 ②-a/③ のユニットテストへの影響(planId→roomToken 変更でモック/フィクスチャの修正洗い出し)。
