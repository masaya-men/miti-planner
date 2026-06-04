# リアルタイム共同編集 段取り③ 設計書 — Firestore 恒久保存 (seed + 書き戻し) (2026-06-04)

> 段取り②-a で「2人が軽減配置をライブ同時編集できる」ところまで作った。ただし**部屋(DO)が空になると Y.Doc は揮発**する(②-a §5 の限界)。
> 段取り③は **DO に `onLoad`(Firestore → 部屋) と `onSave`(部屋 → Firestore) を実装し、共同編集の内容を恒久保存する**。これで「リンクを後から開いても」「オーナーが居なくても」中身が残り、ゴール(コストほぼ$0の本物の共同編集)の保存層が完成する。
> 親設計書: [2026-06-03-realtime-collab-design.md](./2026-06-03-realtime-collab-design.md) (§2「会議室のホワイトボード」モデル / §10・§171 書き戻しの認証経路)
> 前段: [2026-06-04-realtime-collab-stage2a-mitigations-sync-design.md](./2026-06-04-realtime-collab-stage2a-mitigations-sync-design.md)
> ブレスト(2026-06-04)の合意を spec 化したもの。ユーザー承認済の方針: **案B(DO は Vercel の受付係 API に保存を委譲) / 削除は勝つ(墓標ガード) / seed はサーバー(onLoad)が正 / 共有しても「1枚」を維持**。

---

## 1. ゴールと非ゴール

### ゴール
- 共同編集の内容(②-a の `timelineMitigations`)を **Firestore に恒久保存**する。
- **全員が退室して部屋が消えても、保存された内容が残る**。次に同じ部屋(plan ID)を開くと、保存済みの内容から復元される。
- **オーナーが居なくても**、保存済みプランから部屋が立ち上がる(seed がサーバー側 = Firestore から)。
- **既存の保存・墓標・マージを一切壊さない**。書き戻しは既存のサーバー保存ロジックを再利用し、`削除されたプランは復活させない`(墓標ガード)。
- **1人で使う既存ユーザーへの影響ゼロ**(共同編集の部屋に入っていない限り従来どおり)。

### 非ゴール (後続に送る)
- ルームトークンの plan ID 分離・共有リンク UI・ログイン必須化・人数上限・緊急停止 → **⑤**。③ は②-a 同様 **room鍵 = plan ID** のまま検証する。
- 「削除された瞬間に部屋の参加者をライブで追い出す/通知する」 → **⑤**(部屋の入退室・セッション終了・緊急停止を扱う段)。③ が保証するのは**データの安全**(復活しない・破壊保存しない)まで。
- 軽減**以外**の要素(`timelineEvents` / `phases` / `labels` / `memos` / `partyMembers` / 単一値)の同期と保存 → **②-b**。③ の書き戻し対象は **`timelineMitigations` のみ**(②-a の同期範囲と一致させる)。
- 圧縮プラン(`compressedData`)との統合 → 後続。③ は非圧縮 `data.timelineMitigations` を読み書きする。
- presence / カーソル → **④**。

---

## 2. 全体アーキテクチャ — 「会議室のホワイトボードをノートに書き写す」

```
[本棚のノート = Firestore]                         [会議室 = DO 部屋 lopo-collab (段取り①+②-a)]
 plans/{planId}                                     YServer の Y.Doc
   data.timelineMitigations[]                         timelineMitigations (Y.Array<Y.Map>)
   version (楽観ロック)                                  │  ▲          ▲
   deleted (墓標フラグ)                                編集者A      編集者B …
       ▲   │                                          (②-a クライアント = collabProvider)
       │   │ ① onLoad(seed): DO起動時に1回
       │   └─────────────▶  DO → 受付係 GET /api/collab/load?planId=<this.name>
       │                     (Vercel・firebase-admin で plans/{id} 読取・墓標チェック)
       │                     → PlanData.timelineMitigations を Y.Doc に組立てて返す
       │
       └── ② onSave(書き戻し) ◀── 編集デバウンス + 最後の1人退室時
              DO → 受付係 POST /api/collab/save (planId + mitigations[] + 共有シークレット)
              (Vercel が既存保存ロジックで plans/{id}.data.timelineMitigations を部分更新)
              墓標ガード: deleted===true なら何も書かない(削除が勝つ)
```

- **部屋 = 段取り①+②-a の Durable Object**(`workers/collab/`、本番稼働中の `Room extends YServer`)。③ で **`onLoad`/`onSave` を override** する。`this.name`(= 部屋名 = plan ID, [partyserver index.d.ts:260](../../../workers/collab/node_modules/partyserver/dist/index.d.ts#L260))で対象プランを特定する。
- **保存は受付係(Vercel)経由(案B)**: DO に Firebase 資格情報を持たせない。Vercel には firebase-admin が既に広く稼働中(api/admin・api/auth・api/housing 等)で、保存ロジック(version 楽観ロック・墓標・[mergePlans.ts](../../../src/lib/mergePlans.ts))も実績がある。DO↔Vercel は**共有シークレット**で認証(既存 CRON_SECRET 方式と同型)。
- 親設計書 §171「DO が信頼できるバックエンドとして書く」の**意図に忠実な実装**。Admin SDK は Workers で安定動作しないため、Admin SDK が既に動く Vercel に委譲する(下記 §8 根拠)。

### 既存資産を壊さない原則 (§最重要)
1. **1人モード・既存の保存/同期/墓標マージは一切変更しない。** ③ は DO 側(`onLoad`/`onSave`)と新規 Vercel エンドポイント2本の追加が主。既存 `planService` には触らず、保存ロジックは**サーバー側で再利用**(同等の墓標ガード + version 更新を server API 内に実装、または既存純関数 `mergePlans` の流用)。
2. **共同編集中のクライアント Firestore 保存は既に抑制済み**([Layout.tsx:228](../../../src/components/Layout.tsx#L228) `_collabActive` で `syncToCloud` を return)。③ ではこの抑制を維持し、**確定保存は DO(onSave)が代表して1経路だけで行う**(2クライアントの後勝ち上書き合戦を防ぐ、親設計書 §2-4)。
3. **seed の主をクライアントからサーバーへ移す。** ②-a はクライアントが最初の参加者として自分のローカル軽減を seed していた([collabProvider.ts:127-141](../../../src/lib/collab/collabProvider.ts#L127-L141))。③ では **onLoad(サーバー)が Firestore から seed する**のが正。クライアント側の「最初の参加者が seed」ロジックは撤去し、**二重 seed を防ぐ**(下記 §4.4)。

---

## 3. データの範囲と Y.Doc ↔ Firestore の対応

### 書き戻す範囲は `timelineMitigations` のみ (②-a と一致)
- ③ の onSave は **`plans/{id}.data.timelineMitigations` を部分更新**する。`data` の他フィールド(events/phases/labels/memos/partyMembers/単一値)は**触らない**(②-a で同期していないため、上書きするとオーナーの非共同編集部分を壊す)。
- onLoad も **`data.timelineMitigations` だけ**を Y.Doc に組み立てる(②-a の Y.Doc 構造に一致)。

### Y.Doc 構造 (②-a 既存)
- トップレベル `timelineMitigations` = `Y.Array<Y.Map>`。各 `Y.Map` は `AppliedMitigation` のフラットなフィールド([yjsMitigations.ts](../../../src/lib/collab/yjsMitigations.ts) `appliedToYMap`/`yMapToApplied`)。
- **onLoad はサーバー側で同じ構造を構築する必要がある。** `AppliedMitigation → Y.Map` の変換ロジック(`appliedToYMap` 相当)を **Worker と client で共有 or 厳密ミラー**する(片方だけ変えると seed と編集で構造がズレる)。実装方式(共有モジュール化 vs Worker 内ミラー)は writing-plans で確定。
- 参考: `AppliedMitigation` のフィールド = `id`/`mitigationId`/`time`/`duration`/`ownerId`/`targetId?`/`linkedMitigationId?`/`autoHidden?` ([types/index.ts:82-91](../../../src/types/index.ts#L82-L91))。

---

## 4. DO 側 (workers/collab) の実装

### 4.1 `onLoad(): Promise<Y.Doc | void>`
1. DO 起動時(部屋に最初の sync が来たとき)に y-partyserver が1回呼ぶ([server/index.d.ts](../../../workers/collab/node_modules/y-partyserver/dist/server/index.d.ts) `onLoad`)。
2. `GET /api/collab/load?planId=<this.name>` を共有シークレットヘッダ付きで叩く。
3. レスポンスに応じて:
   - **正常(live プラン)**: `{ mitigations: AppliedMitigation[] }` を受け取り、`new Y.Doc()` に `timelineMitigations` Y.Array を組み立てて **return**(= 部屋の初期状態)。
   - **墓標(deleted=true) / 存在しない**: seed しない(空 Y.Doc 相当を return もしくは void)。**この部屋は保存対象外フラグを立てる**(§4.3 の破壊保存ガード)。
   - **受付係が一時的に落ちている(5xx/timeout)**: seed 失敗。**「未ロード」状態のままにし、以後 onSave を絶対に発火させない**(空 Y.Doc を保存してオーナーの軽減を消す事故を防ぐ。§4.3)。可能なら短いリトライ。
4. `hibernation` で DO が起き直したときは、y-partyserver が**生存接続から再同期**するため onLoad は再実行されない(②-a §9.3)。onLoad は「コールド起動(全員退室後の再オープン含む)」時のみ。

### 4.2 `onSave(): Promise<void>`
1. y-partyserver が **`callbackOptions` のデバウンス**(編集が落ち着いたら)で呼ぶ + 最後の接続が閉じるタイミングでも保存されるよう構成する。
2. `this.document` の `timelineMitigations` を `AppliedMitigation[]` に読み出す(`yMapToApplied` 相当)。
3. `POST /api/collab/save` に `{ planId: this.name, mitigations }` + 共有シークレットを送る。
4. レスポンス:
   - **成功**: 完了。
   - **墓標で拒否された**: 正常(削除が勝つ)。以後この部屋は保存対象外にする。
   - **失敗(5xx/timeout)**: ベストエフォートでリトライ(次のデバウンス/退室時に再試行)。**最後の1人退室時の保存失敗 = データ損失リスク**を §7 に明記。

### 4.3 破壊保存ガード (データ安全の要)
- **seed(onLoad)が成功していない部屋は、onSave で絶対に書き戻さない。** 受付係が一時的に落ちて空 seed したまま保存すると、オーナーの軽減を空で上書きしてしまう。`loaded:boolean` のような内部状態で「正常に seed できた部屋だけ保存可」とする。
- **墓標プランは保存対象外。** onLoad/onSave のいずれかで deleted を検知したら、その部屋を保存対象外に固定する。

### 4.4 クライアント(collabProvider)側の変更
- ②-a の「最初の参加者が空の部屋に自分のローカル軽減を seed」ロジック([collabProvider.ts:131-138](../../../src/lib/collab/collabProvider.ts#L131-L138))を**撤去**する。seed は onLoad(サーバー)が担うため。
- `onSynced` 後の入室処理(`enterCollabMode` + `_applyMitigationsFromCollab`)は維持(部屋の状態を store に反映)。
- これにより「部屋の状態 = Firestore の保存済み内容」が唯一の真実になり、オーナー不在でも矛盾しない。

---

## 5. 受付係 (Vercel) エンドポイント

新規 2 本。共有シークレットヘッダ(例 `x-collab-secret`)を検証し、不一致は 401。シークレットは Vercel 環境変数 + Cloudflare Secret に同値を置く(既存 CRON_SECRET 方式 / memory `reference_vercel_cron_secret`)。**実値はコミットしない**(プレースホルダーのみ。CLAUDE.md セキュリティ厳守)。

### 5.1 `GET /api/collab/load?planId=<id>`
- firebase-admin で `plans/{id}` を読む。
- `deleted === true` または存在しない → `{ deleted: true }` or 404 相当を返す(DO は seed しない)。
- live → `{ mitigations: data.timelineMitigations ?? [] }` を返す(軽減配置だけ。他は返さない)。

### 5.2 `POST /api/collab/save` (body: `{ planId, mitigations }`)
- firebase-admin で `plans/{id}` を**読んでから書く**(トランザクション or version 楽観ロック)。
- **墓標ガード**: `deleted === true` なら**何も書かず** `{ skipped: 'deleted' }` を返す(削除が勝つ。先日根治した「削除復活」を部屋経由でも再発させない。[planService.ts:333](../../../src/lib/planService.ts#L333) と同じ墓標哲学)。
- live → `data.timelineMitigations` だけを差し替え、`version` をインクリメントして書く(他フィールドは保持)。`updatedAt` 更新。
- **version 競合**(オーナーが共同編集外のタブ等で書いた場合): 再読込して再試行。最終的には部屋の mitigations を正とする(共同編集中はその表の編集は部屋を通す原則、親設計書 §2-4)。詳細な競合解決は writing-plans で確定。

---

## 6. 保存とリロードの扱い (③ で達成される状態)

- **編集中**: デバウンス保存で数十秒〜数分おきに Firestore に書き戻る(安全保存)。
- **最後の1人が退室**: onSave で確定保存 → 部屋は空に。Y.Doc は揮発するが**内容は Firestore に残る**。
- **再オープン**: 同じ plan ID で部屋を開くと、onLoad が Firestore から seed → 続きから編集できる。**オーナー不在でも可**。
- **オーナーが削除**: 墓標が立つ → 以後 onSave は拒否(復活しない)。部屋に残った参加者の編集は保存されない(ライブ追い出しは⑤)。
- → ③ の実機確認 = 「**全員退室 → 別途再オープンで内容が残っているか / 削除したプランが部屋経由で復活しないか / 一時障害時にオーナーの軽減が空で消えないか**」。

---

## 7. リスクと正直な限界

- **最後の1人退室時の保存失敗**(受付係が落ちている等)はデータ損失になりうる。対策 = デバウンス安全保存で「最後の保存」への依存を減らす + リトライ。完全 0 は保証しない(正直に明記)。
- **seed 失敗時の空保存事故**を §4.3 のガードで防ぐ(最重要)。
- **version 競合**は楽観ロック + 再試行で吸収。共同編集中はオーナーの別タブ編集を抑制済([Layout.tsx:228](../../../src/components/Layout.tsx#L228))なので主因は出にくいが、別端末は理論上ありうる。
- **書き戻し範囲は mitigations のみ**。②-b 前は他要素が共同編集されないため、参加者間で events/phases 等が食い違って見える(②-a 既存の限界。③ は悪化させないが解消もしない)。
- **保存頻度と Firestore 課金**: デバウンス + 退室時のみなので書き込みは最小。`callbackOptions` の具体値(debounceWait/MaxWait)は writing-plans で決め、負荷テスト(⑦)で調整。

---

## 8. 採用技術の根拠 (一次情報)

- **y-partyserver の `onLoad`/`onSave`**: `YServer` が提供する永続化フック。`onLoad(): Promise<Doc|void>` / `onSave(): Promise<void>` / `static callbackOptions: { debounceWait?, debounceMaxWait?, timeout? }`([server/index.d.ts](../../../workers/collab/node_modules/y-partyserver/dist/server/index.d.ts))。保存タイミングはフレームワークがデバウンス制御する標準フック。
- **DO は Firebase Admin SDK を直接使わない**: Admin SDK は Node 依存(gRPC 等)が重く Cloudflare Workers/DO で安定動作しない。Workers から Firestore を扱う標準は ①REST API + サービスアカウント JWT(Web Crypto 署名) か ②既存バックエンドへ委譲。本プロジェクトは Vercel に firebase-admin と保存ロジックが既にあるため **②(委譲 = 案B)** が、保存ロジックの二重化と秘密鍵の分散を避ける業界標準の選択。
- **共有シークレットのサーバー間認証**: webhook で広く使われる標準。既存 CRON_SECRET と同型(memory `reference_vercel_cron_secret`)。
- **DO の部屋名取得**: `this.name`(partyserver、`ctx.id.name` から常に populate、[index.d.ts:260](../../../workers/collab/node_modules/partyserver/dist/index.d.ts#L260))。
- **hibernation 起床時は onLoad 非実行**(生存接続から再同期、②-a §9.3)。$0 前提を崩さない。

---

## 9. テスト / 検証

- **ユニット(Worker, vitest)**: `onLoad` が受付係レスポンス(live / deleted / 障害)に対し正しい Y.Doc/空/未ロードを作るか。`onSave` が墓標応答で書かないか、seed 未完了で書かないか(破壊保存ガード)。受付係は fetch をモック。
- **ユニット(Vercel API, vitest)**: `/api/collab/save` が墓標プランに書かない・live プランは mitigations だけ差し替え version+1・シークレット不一致で 401。firebase-admin はモック。
- **本番結線(node 2クライアント, 私=Claude が実施)**: ②-a 同様 2クライアントで編集 → 全員切断 → 再接続で内容が残るか / 別 plan を削除済みにして再オープンで復活しないか。
- **既存テスト(1人モード)が全て従来どおり緑**であることを各タスクで確認(非干渉の担保)。`push 前は npm run build + vitest run`(memory `feedback_vercel_tsc_strict`)。

---

## 10. 要検証 / 未確定 (writing-plans で詰める)

- `callbackOptions`(debounceWait / debounceMaxWait)の具体値 = 保存頻度と「落とさない」のバランス。
- 「最後の1人退室時に確実に1回保存する」y-partyserver の正確な発火点(onSave がライフサイクルのどこで呼ばれるか要一次確認 = ソース/README)。退室で確実に呼ばれない場合の補完(`alarm` / `onClose` での明示保存)。
- `appliedToYMap` 相当を Worker と client で共有する方法(共有モジュール vs ミラー)とビルド構成(workers/collab は別パッケージ)。
- `/api/collab/save` の version 競合解決の具体形(トランザクション vs read→compare→write リトライ)。
- 共有シークレットの環境変数名・Cloudflare Secret への設定手順(`--sensitive` / wrangler secret)。
- onLoad 障害時のリトライ回数・タイムアウト・「未ロード部屋」の扱い(参加者へ何を見せるか = 最小限、本格化は⑤)。
- seed をサーバーに移すことで②-a のクライアント seed 撤去が既存②-aユニットテスト(`yjsMitigations.test.ts` 等)に与える影響の洗い出し。
