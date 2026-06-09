# 段取り④-a リアルタイム共同編集 サーバ側編集認証 設計書 (2026-06-10)

> 共同編集ルームへの接続のうち、**正規にログインした本人**だけがドキュメントへ書き込めるよう、
> **サーバ（Cloudflare Worker / Durable Object）側で**強制する。未認証接続は読み取り専用として扱い、
> その書き込みメッセージをサーバが破棄する。
> これは新規仕様ではなく、親設計書 [2026-06-03-realtime-collab-design.md](./2026-06-03-realtime-collab-design.md) §3
> 「未ログイン接続は読み取り専用として扱い、変更メッセージを受け付けない」の実装であり、段取り⑤-3c で入れた
> **クライアント側ゲートのサーバ裏付け**（公開条件）にあたる。

親設計の権限モデル: **A（リンクベース / Google Docs 風）= リンクを持ちログインしている人は誰でも編集可**
（親 §1 非ゴール「参加の 1 人ずつ承認制は作らない」/ §3「編集はログイン必須」）。本書はこれを変更しない。

---

## 1. ゴールと非ゴール

### ゴール
- ルームへ繋いだ接続のうち、**Firebase の正規ログイン本人**である接続だけがドキュメントへ書き込める。
- 未ログイン / トークン不正 / 偽装の接続は、**閲覧（受信・同期）はできるが書き込めない**。書き込みメッセージはサーバが捨てる。
- クライアント（devtools 等）を改変して readOnly ゲートを突破しても、**サーバが書き込みを拒否する**ので本物の表は守られる ＝ **公開条件を満たす**。
- 既存の無料（$0 ハードストップ）アーキテクチャを**1ミリも崩さない**。検証は接続時に1回だけ。カーソルや編集のたびには走らない。

### 非ゴール（④-a では作らない）
- **カーソル / presence（P2P）** … 段取り④-b（本書の後続・別設計）。
- **編集者8席 / 閲覧者20の「席」分離** … 現状は ⑤-2b の単一上限（既定8）で全員を縛る。編集者/閲覧者を別カウントする席モデルは別増分（本書 §10）。
- **オーナーによる個別承認・強制キック・行ロック** … 親 §1 非ゴールどおり作らない。
- **トークン検証を worker 内（自前 JWKS）で行う最適化** … 接続時1回なので往復コストは無視でき、自前暗号のリスクを避けて Vercel 委譲を採る（§3）。将来必要なら差し替え可能。

---

## 2. 全体像

```
[クライアント(ブラウザ)]
   │  WebSocket 接続（roomToken）
   │  params 関数で「現在の Firebase ID トークン」をクエリに添付（viewer は添付しない）
   ▼
[Cloudflare Worker 入口 (index.ts)]
   │  onBeforeConnect:
   │   ① 満員判定（⑤-2b・既存）
   │   ② ★トークン検証を Vercel 受付係へ委譲（本書の追加）
   │       └─ 正規本人 → 接続要求に「信頼ヘッダ(x-collab-uid)」を付けて DO へ通す
   │       └─ 無 / 不正 → ヘッダ無し（= viewer）で通す（接続自体は許可：閲覧は誰でも可）
   ▼
[Durable Object (Room = YServer)]
   │  onConnect: 信頼ヘッダの有無で connection.state に { isEditor, uid } を記録
   │  isReadOnly(connection): isEditor でなければ true
   ▼
[y-partyserver 内蔵の書き込みゲート]
   readSyncMessage(..., this.isReadOnly(connection))
     ├─ sync step1（受信・同期）        … 常に許可（閲覧できる）
     └─ sync step2 / update（書き込み）  … readOnly なら破棄（server/index.js:71,75 既存実装）
```

- **書き込みゲートは y-partyserver に内蔵済み**（`isReadOnly(connection)` が true の接続は step2/update を適用しない）。④-a は「接続ごとに isReadOnly をどう決めるか」を実装するだけ。
- **トークン検証は Vercel（受付係）に委譲**。Firebase Admin SDK は Workers で動かないため（既知）、③ で確立済みの「DO ↔ Vercel 委譲」と同じ型を踏襲する。

---

## 3. トークン検証方式（採用＝Vercel 受付係への委譲）

### 採用案：Vercel 受付係 `/api/collab?action=verify`
- worker（onBeforeConnect）が受け取った ID トークンを Vercel の verify エンドポイントへ POST。
- Vercel 側は **Firebase Admin の `verifyIdToken`** で検証し、`{ valid: true, uid }` または `{ valid: false }` を返す。
- 認証は ③/⑤ と同じ **DO↔Vercel 共有シークレット（`x-collab-secret` / `COLLAB_SHARED_SECRET`）** で、受付係を worker 以外から叩けないようにする。
- 既存の 12 関数上限を守るため、`api/collab/index.ts` のディスパッチャに `action=verify` を追加し、本体は `_verifyHandler.ts`（先頭 `_` で関数ルート化しない）に置く。Firestore アクセスは不要（トークン検証のみ）。

### 不採用案：worker 内 JWKS 検証
- Google 公開鍵で ID トークン（RS256 JWT）を worker 内で検証（WebCrypto）。往復ゼロで速いが、**セキュリティ要の自前実装＋鍵ローテーション対応**が増える。接続時1回の往復は無視できるため、④-a では採らない（将来差し替え可能）。

### コスト（$0 維持の根拠）
- verify は **接続が確立する瞬間に1回だけ**走る（編集・カーソルのたびではない）。親 §4 の課金構造では「①入室（1人1リクエスト）」のバケットに収まる量で、**DO の編集受信メーターには一切乗らない**。
- Vercel 側 verify は無料枠の関数呼び出し1回（Firestore 非アクセス）。worker からの subrequest も接続あたり1。
- → **$0 ハードストップ設計を崩さない**。カーソルの P2P・$0 方針も無関係（本書はカーソルに触れない）。

---

## 4. 接続フロー詳細

### 4.1 クライアント（送信側）
- `collabProvider.ts` の `new YProvider(host, roomToken, doc, { party, connect, params })` に **`params` を関数で**渡す:
  - `params: async () => ({ token: <現在の Firebase ID トークン or 空> })`
  - 関数なので **再接続のたびに最新トークンを取り直す** → ID トークンの約1時間期限を自然に解決（期限切れ前に provider が再接続すれば新トークンで再認証）。
  - **viewer（未ログイン）はトークンを添付しない** → サーバで read-only 扱い。
  - ⑤-3c の `canEdit` 連動：未ログイン→ログイン+同意で canEdit が立つと WS を張り直す既存挙動（⑤-3c 効果B）に、トークン添付が乗る＝**ログイン後の再接続で初めて編集権がサーバに伝わる**。

### 4.2 worker 入口 `onBeforeConnect`（検証 + 受け渡し）
1. URL クエリからトークンを取り出す。**無ければ即 viewer**（検証スキップ・接続は許可）。
2. トークンがあれば Vercel verify を呼ぶ:
   - `valid:true` → 接続要求（DO へ転送する `Request`）に **信頼ヘッダ `x-collab-uid: <uid>`** を付与して返す。
   - `valid:false` / verify 失敗・到達不能 → **fail-closed**：ヘッダを付けない（= viewer 扱い）。**編集権は検証成功時のみ与える**（満員判定の fail-open とは逆。認証は安全側に倒す）。
3. **詐称防止**：クライアント（ブラウザ WS ハンドシェイク）は任意ヘッダを付けられないため `x-collab-uid` を偽装できない。さらに onBeforeConnect は**クライアント由来の同名ヘッダを必ず除去**してから自分の検証結果を書く。
4. 満員判定（⑤-2b）と同居：両方を通過した接続だけ DO へ。

### 4.3 DO `Room`（記録 + 強制）
- `onConnect(conn, ctx)` を override：**`super.onConnect` を必ず呼んだ上で**（YServer の sync step1 送出を維持＝既存状態が新規接続へ届く）、`ctx.request` の `x-collab-uid` を読み、
  `conn.setState(prev => ({ ...prev, isEditor: !!uid, uid }))` で接続に編集権を記録（既存の awareness 用 state を壊さないよう **merge**）。
- `isReadOnly(connection)` を override：`return connection.state?.isEditor !== true;`
- 以降、y-partyserver 内蔵の `readSyncMessage(..., isReadOnly)` が **read-only 接続の step2/update を適用しない**＝サーバが書き込みを破棄。

---

## 5. セキュリティ設計

- **fail-closed（認証）**：verify が落ちた/タイムアウトした接続には編集権を与えない（viewer として通す）。可用性より安全を優先。閲覧は維持されるので「繋がらない」事態にはならない。
- **詐称不可**：編集権は worker（信頼コード）が検証して付ける信頼ヘッダにのみ依存。クライアントは WS ハンドシェイクに任意ヘッダを付けられず、worker が同名ヘッダを除去するため偽装経路が無い。
- **トークン期限**：接続時に検証。セッション継続中は接続時の判定を維持（再検証は再接続時に provider の params 関数が新トークンを出すことで実施）。長時間セッションでの厳密な途中失効強制は ④-a では行わない（許容・将来 §10）。
- **共有シークレット**：verify エンドポイントは ③/⑤ と同じ `COLLAB_SHARED_SECRET`（timingSafe 比較）で保護し、worker 以外から叩けない。
- **緊急停止**：親 §3 / ⑤-1 の `COLLAB_DISABLED` は既存どおり有効（発行・接続を止血）。④-a はこれに干渉しない。

---

## 6. 既存機能との結合

- **⑤-3a（オーナー入口）**：オーナーは常にログイン済み→トークンを添付→editor。挙動変化なし（むしろサーバ裏付けが付く）。
- **⑤-3b（ジョイナー読み取り専用ビュー）**：未ログイン閲覧は従来どおり read-only。④-a で**サーバ側でも read-only が保証**される（従来はクライアント任せ）。
- **⑤-3c（ログイン+同意で編集解禁）**：クライアントの canEdit ゲートはそのまま UX として残す。④-a はその**サーバ裏付け**。canEdit が立って WS を張り直すと、今度はトークンが乗り、サーバが editor と認める。**クライアントゲート（UX）+ サーバゲート（強制）の二段**。
- **⑤-2b（満員拒否）**：onBeforeConnect で満員判定と verify が同居。両方通過で接続。
- **③（永続化）**：書き戻し経路は無改変。read-only 接続の更新はそもそも Y.Doc に入らないので、保存内容に未認証の改変が混ざらない（多層防御）。

---

## 7. コンポーネント一覧（追加・変更）

| 場所 | 追加/変更 | 役割 |
|---|---|---|
| `api/collab/_verifyHandler.ts` | 追加 | ID トークンを Firebase Admin で検証し `{valid,uid}` を返す（`x-collab-secret` 認証）。純検証は薄いので本体内で完結。 |
| `api/collab/index.ts` | 変更 | `action=verify` 分岐を追加（本体ロジック無変更の単純ディスパッチ）。 |
| `workers/collab/src/index.ts` | 変更 | `onBeforeConnect` に verify 委譲＋信頼ヘッダ付与＋クライアント由来ヘッダ除去を追加（満員判定と同居）。 |
| `workers/collab/src/collabAuth.ts`（新規・純関数） | 追加 | verify への HTTP 呼び出し（fetchMock で決定的テスト）＋ヘッダ組み立て。`collabPersistence.ts` と同型。 |
| `workers/collab/src/server.ts`（Room） | 変更 | `onConnect` override（super 呼び＋state 記録）と `isReadOnly` override。 |
| `src/lib/collab/collabProvider.ts` | 変更 | `params` 関数（最新 ID トークン or 空）を provider に渡す。 |
| ID トークン取得 | 利用 | 既存の Firebase Auth `currentUser.getIdToken()` を使う（apiClient 等の既存経路を流用）。 |

---

## 8. テスト方針

- **純ロジック（worker, node, fetchMock）**：
  - verify 応答 valid/invalid/到達不能 → 信頼ヘッダ付与/非付与（fail-closed）の分岐。
  - クライアント由来 `x-collab-uid` が**必ず除去**されること（詐称テスト）。
- **DO 単体**：`isReadOnly` が state に従うこと。editor 接続の update は反映、viewer 接続の update は破棄（y-partyserver の readOnly 経路を通す統合）。
- **Vercel `_verifyHandler`（fetchMock/Admin モック）**：正トークン→`{valid,uid}` / 不正→`{valid:false}` / secret 不一致→401。
- **既存回帰**：root（1535緑系）/ worker（35緑系）/ build 緑を維持。
- **最終実機**：⑤-3d と合わせ、プレビュー（ログイン可）で「未ログイン閲覧者は書けない・ログイン編集者は書ける・devtools で readOnly 解除しても本物の表が変わらない」を確認。

---

## 9. コスト結論（再掲・厳守）
- verify は**接続あたり1回**。DO の編集受信メーターに乗らず、Vercel 無料枠の関数1呼び出し。**$0 ハードストップ設計を崩さない**。
- カーソルの $0（P2P）は ④-b の領分で、本書では一切サーバ負荷を増やさない。

---

## 10. 非ゴール / 未確定（実装計画 or 後続増分で詰める）
- **編集者8席 / 閲覧者20の席分離**：今は ⑤-2b の単一上限。editor/viewer を別カウントする席モデル（席が空けば昇格、編集者は席を譲る）は親 §3 の理想だが ④-a の範囲外。別増分。
- **途中失効の厳密強制**：長時間セッションでトークンが切れても接続は維持（再接続時に再検証）。能動的な途中 revoke は将来。
- **verify の配置最適化**：将来 worker 内 JWKS に切り替える場合の鍵キャッシュ戦略（今は採らない）。
- **ID トークン取得の dev 制約**：ログインはプレビュー（lopo-miti*.vercel.app）/本番でのみ動く（localhost auth は意図的に無効）。実機検証はプレビューで行う。

---

## 11. 実装の段取り（増分・各段が最終形の一部）
1. **Vercel `verify` エンドポイント**（`_verifyHandler.ts` + `index.ts` 分岐）＋純テスト。
2. **worker `collabAuth.ts`（純関数）**＋ onBeforeConnect 結線（信頼ヘッダ付与・クライアントヘッダ除去・fail-closed）＋テスト。
3. **DO `Room`**：`onConnect` で state 記録 + `isReadOnly` override ＋ DO テスト（editor 書込可 / viewer 破棄）。
4. **クライアント `params` 関数**（最新 ID トークン / viewer は空）＋ ⑤-3c canEdit 再接続との結線。
5. **回帰**（root/worker/build 緑）＋プレビュー実機（⑤-3d と合流）。
