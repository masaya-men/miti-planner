# 共有ツアー同期（MVP）設計書

- 作成: 2026-07-15
- ステータス: **設計確定・実装未着手**
- 前提ビジョン: `docs/.private/2026-07-08-synced-shared-tour-vision.md`（末尾に 2026-07-15 のブレスト合意）
- 関連: [[project_housing_scale_hardening]] / [[reference_appcheck_lazy_enumerate_anon_endpoints]] / [[reference_vercel_hobby_function_limit]] / [[reference_firestore_composite_index]]

---

## 1. これは何か（目的）

幹事1人が組んだハウジングツアーを、**招待リンクで配って参加者全員の画面をリアルタイムに同期する**機能。幹事が「次へ／見学／前へ」を押すと、見ている全員の画面が一緒に動く。大所帯（数百人規模も想定）でハウジングツアーを回るときのタイムキープが目的。

**共同編集（collab）とは別物**：collab は「複数人が同時に書く→マージ」の双方向 CRDT。共有ツアーは「**幹事だけが書く→他は読むだけ**」の一方向ブロードキャスト。マージ機構は不要で、実装はずっと単純。

---

## 2. スコープ

### MVP に入れる
- 幹事がツアー中に「みんなを招待」ボタンで招待リンクを発行（開始フローは分岐させない = B案）
- 操作（前へ／見学／次へ）は**幹事のみ**
- 参加者は**リンクを開くだけ（ログイン不要）**。幹事の現在位置・フェーズ・見学タイマーがリアルタイム同期
- 途中参加でも「今の位置」に合流
- 主催ツアーに**3種類の家すべて**（公開登録／自分の非公開／一時追加）を含められる。家データはスナップショットとして同梱
- 非公開／一時追加の家を入れるときの**住所露出警告（C案）**
- 寿命：最終操作から**2時間の無操作**、または幹事の**「ツアー終了」ボタン**で終了
- 幹事がフリーズ／離脱しても最後の状態で残り、**開き直せば（ログインで）復帰**

### MVP に入れない（将来）
- 操作権限を他の参加者に渡す（権限委譲）
- 「N人が見ています」表示（参加者は完全匿名で追跡しない）
- ツアー中の家の追加・入れ替え（招待時点のリストで最後まで回る）
- 万人単位の同時視聴を狙うときの配信方式の乗り換え（後述 §11）
- スマホ最適化（全画面まとめての別タスク）

---

## 3. ユーザー体験（ブレスト合意の確定版）

### 幹事（主催する人）
1. **ログイン必須**。いつもどおりツアーを組んで開始（最初は自分だけ）。
2. 画面内の**「みんなを招待」ボタン**を押す → 短い招待リンク（`/housing/tour/:tourToken` 形式）が発行される。コピーして Discord 等に貼る。
   - このボタンのそばに「**招待した後は家を足せないので、見せたい家は始める前に組んでください**」の一言案内。
3. 操作（前へ／見学／次へ）は幹事だけ。押すたびに全員の画面が同期して動く。
4. 非公開の家 or 一時追加の家がツアーに含まれる状態で招待しようとしたら、その場で警告：「**この住所は参加者全員に見えます**」（一時追加は加えて「持ち主の許可を取ってから追加してください」）。判断は幹事に委ねる（C案）。
5. 終わったら「**ツアー終了**」ボタン → 参加者に「終了しました」。

### 参加者（見る人）
- **ログイン不要**。リンクを開くだけで、幹事の今いる家・見学中・タイマーがそのまま見える。
- **途中参加でも今の位置に合流**（最初の家に戻されない）。
- 操作ボタンは無し（「幹事が案内中」の表示）。**完全匿名**（名前も人数も追わない）。
- タブを閉じれば抜けるだけ。
- リンクが終了済み／存在しなければ「このツアーは終了しました／見つかりません」を表示（collab の [CollabJoinerPage.tsx](src/components/CollabJoinerPage.tsx) の view-kind パターンを踏襲）。

### 寿命
- 幹事フリーズ／離脱 → 最後の状態でフリーズ（能動的な離脱検知はしない）。開き直せば復帰。別端末からでもログインで自分の live ツアーに戻れる。
- **最終操作から2時間の無操作** or **終了ボタン** → 終了。参加者は「このツアーは終了しました」。

---

## 4. 技術方式の選定

### 採用：Firestore の小ドキュメント + onSnapshot（一方向ブロードキャスト）

| 案 | 内容 | 判断 |
|---|---|---|
| **A（採用）** | Firestore に小さなツアー用ドキュメント。幹事が書く / 参加者が `onSnapshot` で読む。 | 一方向ブロードキャストに最も素直。参加者は「変更時 read」課金のみ（じっと見るだけなら課金ゼロ）。数百人でも 1 ツアー 1 円未満。既存インフラそのまま。 |
| B（不採用） | 既存の collab（Yjs + y-partyserver / Cloudflare Workers WebSocket）に相乗り。 | 招待リンク・失効の**UXの型**は流用するが、**同期エンジンとしては不採用**。Yjs は双方向マージ用でオーバースペック。WebSocket 常時接続は数百人閲覧のスケール／コスト特性が別物。ビジョンでも「マージ機構は不要」と明記。 |

**結論**：同期は Firestore。招待リンク発行・失効・NotFound 表示の**設計パターン**は collab のものを流用する（実装エンジンは Firestore）。

---

## 5. データモデル

### コレクション（新設）

家データ（重い・不変）と、刻々変わる合図（軽い）を**別ドキュメントに分離**する。同居させると合図が変わるたびに家データ全体が再配信されて無駄になるため。

#### `shared_tours/{tourToken}` — メタ + 家スナップショット（発行時に確定・以後不変）
```
{
  tourToken: string,        // 招待リンクの鍵（nanoid・URLに載る・推測不能）
  hostUid: string,          // 幹事のUID（live state を書ける唯一の人）
  snapshot: TourSnapshot[], // 家データの配列（順序 = 回る順）。§6 参照
  containsHiddenAddress: boolean, // 非公開/一時追加を含むか（監査・表示用）
  createdAt: number,        // epoch ms
}
```
参加者は開いた**最初の1回だけ `get`**（onSnapshot ではない。中身が変わらないので初回で十分）。

#### `shared_tours/{tourToken}/live/current` — ライブ state（頻繁に変わる・軽量）
```
{
  status: 'live' | 'ended',
  currentIndex: number,        // 何番目の家か
  phase: 'moving' | 'viewing', // 移動中 / 見学中
  viewStartAt: number | null,  // 見学開始の epoch ms（moving では null。経過は各端末が計算）
  lastActivityAt: number,      // 最終操作の epoch ms（2時間無操作判定・GC 用）
}
```
参加者は**これだけを `onSnapshot` 購読**。幹事が操作するたびにこの1ドキュメントだけを更新。

> `useHousingTourStore` の `currentIndex / phase / viewStartAt` をそのまま写す。ストアは既にこの形（[useHousingTourStore.ts](src/store/useHousingTourStore.ts) の設計コメント参照）。

### なぜ単一 doc 購読なのか
`live/current` は単一ドキュメントの購読なので **Firestore 複合インデックスは不要**（collab の token→plan 逆引きが「単一 get のみ・インデックス不要」なのと同じ）。`firestore.indexes.json` への追加は原則不要。幹事が「自分の live ツアー」を検索するために `where('hostUid','==',uid)` 等を使う場合のみ、インデックス追加を検討（§7 の復帰フロー）。

---

## 6. 家スナップショット（`TourSnapshot`）

3種の家すべてを1つの型に正規化して同梱する。既存の `MockListing`（[mockListings.ts](src/data/housing/mockListings.ts)）が既にこの構造なので、それを土台にした**送信用の縮約型**を定義する。

- 含める：`id`, 住所系（`area/ward/buildingType/plot/size/apartmentBuilding/roomNumber/roomKind`）, 画像系（`imageMode/postUrl/ogImageUrl/sourceImageUrls/sourceImageAspectRatios/youtubeVideoId/videoUrl/videoPosterUrl/videoAspectRatio/thumbnailPath/thumbnailPaths`）, `title/description/tags`, `dc/server/region`, `visibility`
- **画像本体は含めない**（既存方針どおり外部URL文字列のみ。参加者側は `<img src>` で外部を直接読む＝LoPo 帯域ゼロ・[[feedback_housing_external_url_direct]]）
- **サイズ上限**：家の件数に上限（既存の `listingIds ≤ 100` / 一時物件 ≤ 50 の範囲に収める）。1ドキュメントの Firestore 上限（1MiB）に収まることを検証。

### 住所露出の扱い（§3-4 の C案）
- 非公開（`visibility !== 'public'`）や一時追加（`ownerUid === '__ephemeral__'` / id が `ephemeral-` prefix）の家がスナップショットに含まれる場合、その住所は**そのままスナップショットに載る**（招待者に見せるのが目的なので意図的）。
- 幹事が招待リンクを発行する操作の直前に**警告を出す**。運営（LoPo）は責任を負わず、幹事の判断に委ねる。

---

## 7. 書き込み経路（幹事）

### 発行：API 経由（Admin SDK）
- [api/housing/index.ts](api/housing/index.ts) に **`action=create-shared-tour`** を追加（新 top-level ファイルは作らない。ハンドラは `_createSharedTourHandler.ts` = `_` プレフィックスで Vercel の関数枠に数えない）。
- 順序は既存の書き込みハンドラと同じ：`verifyAppCheck` → `applyRateLimit` → `verifyIdToken`（ログイン必須）→ CORS。
- 処理：スナップショットを受け取り、`nanoid` で `tourToken` 発行、`shared_tours/{tourToken}` と `shared_tours/{tourToken}/live/current`（`status:'live'`, `currentIndex:0`, `phase:'moving'`, `viewStartAt:null`, `lastActivityAt:now`）を Admin SDK で作成。`tourToken` を返す。
- **悪用ガード**（§9）：レート制限、1ユーザーの同時 live ツアー数の上限、スナップショット件数／サイズ上限。

### 進行の更新：幹事クライアントから Firestore 直書き
- 招待発行後、幹事の `next / prev / startViewing / stop` は `shared_tours/{tourToken}/live/current` を**クライアントから直接 update**（`lastActivityAt` も同時更新）。
- API を介さない理由：リアルタイム性（1操作ごとに Vercel 関数を挟むと遅延・コスト）。collab も room 作成は API・以後の編集は直結、と同じ思想。
- **rules で保護**：`live/current` の write は「親 `shared_tours/{tourToken}` の `hostUid` == `request.auth.uid`」のみ許可（§8）。

### 終了
- 「ツアー終了」ボタン → 幹事クライアントが `live/current.status = 'ended'` に update（rules で hostUid のみ）。
- 物理削除は cron（§10）。

### 幹事の復帰（フリーズ／離脱後）— ブレストで「別端末からでも戻れる」と合意済み・MVP に含める
- **同端末**：発行時に `tourToken` を **localStorage に保持** → 開き直したら同じツアーに復帰。
- **別端末**：ログイン UID（`hostUid`）で自分の live ツアーを検索して復帰（`shared_tours` を `where('hostUid','==',uid)` で引き、`live/current.status=='live'` のものに入り直す）。
  - この検索経路が §5「単一 doc 購読はインデックス不要」の唯一の例外。`hostUid` は単一フィールドインデックス（Firestore 自動）で足り、複合が要るかは実装時に確定（`firestore.indexes.json` への追加要否）。同時 live ツアーは1ユーザー原則1件（§9 の同時数上限）なので検索結果は基本1件。

---

## 8. 読み取り経路（参加者）と Firestore ルール

### 参加者（ログイン不要・匿名）
- 新ルート `/housing/tour/:tourToken`。
- 開いたら：`shared_tours/{tourToken}` を1回 `get`（家スナップショット取得）→ `shared_tours/{tourToken}/live/current` を `onSnapshot` 購読 → `currentIndex/phase/viewStartAt` を（閲覧専用の）ツアー描画に適用。
- 家スナップショットを既存の tour 描画（`buildTourPool` の pool と同形）に流し込み、既存の [TourNavPage](src/components/housing/pages/TourNavPage.tsx) 系コンポーネントを**閲覧専用モード**で再利用（操作ボタン非表示・「幹事が案内中」表示）。

### Firestore ルール（`firestore.rules` に追加）
`housing_tours`（425-441行）と `collabRooms`（98-100行）の既存パターンを土台にする。
```
match /shared_tours/{tourToken} {
  allow read: if true;                    // 公開読み（tourToken が事実上の鍵）
  allow write: if false;                  // メタは Admin SDK（API）経由のみ
  match /live/{docId} {
    allow read: if true;                  // 公開読み
    allow write: if isAuthenticated()
      && get(/databases/$(database)/documents/shared_tours/$(tourToken)).data.hostUid == request.auth.uid
      && /* status/currentIndex/phase/viewStartAt/lastActivityAt の型検証 */;
  }
}
```
- `tourToken` は `nanoid`（推測不能）なので、公開読みでも列挙不可（`list` は許可しない・単一 `get`/購読のみ）。

### ★最重要リスク：匿名の Firestore `onSnapshot` と App Check（§12 で詳述）
参加者は未ログイン＝匿名。LoPo は reCAPTCHA Enterprise 課金対策で「閲覧のみ匿名は App Check を初期化しない」設計（[appCheck.ts](src/lib/appCheck.ts)）。もし **Firestore に App Check enforcement（required）がかかっていると、匿名参加者の直 `onSnapshot` が弾かれる**。これは実装の**最初のスパイクで必ず検証**する（§12）。

---

## 9. 悪用対策（DoW / いたずら防止・概要）

> 具体的な閾値・攻撃シナリオの詳細は公開リポに書かない（[[project_housing_scale_hardening]] の方針＝「穴の地図を出さない」）。ここでは概念のみ。詳細は実装時に `.private` に記録。

- **発行はログイン必須 + レート制限**（`applyRateLimit`）。匿名では箱を作れない。
- **1ユーザーの同時 live ツアー数に上限**（新規発行時、超過分は古いものを ended にする or 拒否）。
- **`tourToken` は推測不能**（`nanoid`）。列挙不可（`list` 不許可）。
- **スナップショットの件数・サイズ上限**（既存の 100 件／50 件ルールと 1MiB 制約に収める）。
- 進行更新は rules で hostUid のみ。第三者は書けない。
- 読みは公開だが、単一ドキュメントの購読で軽量。onSnapshot の read 課金は「変更時のみ」。

---

## 10. 寿命と物理削除（GC）

- **2時間無操作**：参加者が `live/current` を読むとき、`now - lastActivityAt > 2h` なら「このツアーは終了しました」を**クライアント側で表示**（サーバー到達前に体験を止める）。
- **物理削除 cron**：`shared_tours` を走査し、`status==='ended'` または `lastActivityAt` が古い（例：数時間以上放置）ドキュメントをサブコレクションごと削除。
  - 作法（[reference_vercel_cron_secret]・調査で確認）：`vercel.json` の `crons` に1エントリ追加、**パスは既存 Node ルータに `?action=gc-shared-tours` で畳む**（新 top-level 関数を作らない）、ハンドラ冒頭で `CRON_SECRET` チェック（fail-closed）、**バッチ上限**を設ける（Hobby は関数タイムアウト 10 秒）。GC 判定は純関数に切り出して単体テスト（collab の `_collabGcLogic.ts` パターン）。
- 公開一覧キャッシュへの影響は無い（共有ツアーは公開一覧に出ない）ので `bumpPublicVersion` は**呼ばない**。

---

## 11. UI 変更点

### 幹事側（既存ツアー画面に追加）
- [TourNavPage](src/components/housing/pages/TourNavPage.tsx) 系に「**みんなを招待**」ボタン + 発行後の招待リンク表示（コピー）+「招待リンク発行済み」状態 +「ツアー終了」。
- 招待ボタン近くの一言案内（家は始める前に組む）。
- 発行直前の住所露出警告（非公開／一時追加が含まれるとき・C案）。
- 発行後、幹事の操作（next/prev/startViewing/stop）が `live/current` の直書きを伴うよう配線（既存のストアアクションにフックする形。ストアは触らず、購読側＝ページで書き込みを担う）。

### 参加者側（新規）
- 新ルート `/housing/tour/:tourToken`（[App.tsx](src/App.tsx) にlazy追加）。
- 参加者ページ：`get`（スナップショット）→ `onSnapshot`（live）→ 閲覧専用ツアー描画。
- 状態表示（collab の view-kind 踏襲）：`connecting`（接続中）/ `notfound`（見つかりません）/ `ended`（終了しました）/ `viewing`（同期表示中）。
- 操作ボタン非表示・「幹事が案内中」表示。

### 既存資産の流用
- `useHousingTourStore` の state 形（そのまま同期ペイロード）
- `useElapsed`（タイマーは開始時刻だけ・経過はクライアント計算）
- `buildTourPool` / `MockListing`（スナップショット構造）
- collab の招待リンク／失効／NotFound の**UXパターン**（`collabRoomApi` / `CollabJoinerPage`）

---

## 12. リスクと検証（実装前 / 実装最初のスパイク）

### ★R1（最重要）：匿名 Firestore `onSnapshot` × App Check
- **懸念**：Firestore に App Check enforcement が有効だと、匿名参加者の直 `onSnapshot` が 403 で弾かれる。App Check enforcement は Firebase コンソール設定でコードに現れないため、**実挙動で確認するしかない**。
- **検証（Phase 0 スパイク）**：本番相当環境で、未ログイン・App Check 未初期化のクライアントから `shared_tours/{token}/live/current` を `onSnapshot` 購読できるか実測。
- **対策の分岐**：
  - (a) enforcement 無 → そのまま匿名直読みで成立（`tourToken` が鍵）。**第一候補**。
  - (b) enforcement 有 → 匿名参加者ページで App Check を初期化すると reCAPTCHA 課金（[[project_firebase_cost_reduction]] の主犯）。数百人分は避けたい。代替として **live state を「公開窓口 API のポーリング」で配る**方式に切替（`PUBLIC_WINDOW_ACTIONS` に `shared-tour-state` を追加＝verifyAppCheck 前 return・Cloudflare キャッシュは短 s-maxage。リアルタイム性は数秒粒度に落ちるがツアー用途では許容範囲）。この分岐は設計に織り込み済み。

### R2：`viewStartAt` の端末時計ズレ
- 幹事の epoch ms をそのまま配り、参加者は自端末の `Date.now()` との差で経過秒を計算（既存 `useElapsed`）。両端末の時計がほぼ正確（NTP 同期）なら数秒以内。MVP は許容。将来サーバー時刻補正を検討。

### R3：Vercel 関数枠
- 既に 12 上限ギリギリ。**新 action は必ず `api/housing/index.ts` に畳む・ヘルパーは `_` プレフィックス**（調査で確認済み）。新 top-level 関数を1本でも作るとデプロイが壊れる。

### R4：スナップショットの Firestore 1MiB 上限
- 家件数上限内で 1MiB に収まることを検証。超えそうなら snapshot をチャンク分割 or 画像メタを削る。

---

## 13. テスト方針
- **純ロジックの単体テスト**（vitest）：スナップショット縮約（`MockListing` → `TourSnapshot`）、2時間無操作判定、GC 対象判定（純関数・collab の `_collabGcLogic` パターン）、live state → ツアー描画への写像。
- **rules テスト**：`live/current` の write が hostUid 以外で拒否される／read が匿名で通る。
- **統合スパイク**：R1 の匿名 onSnapshot 実測（最優先）。
- **エンドユーザー実機**（[[feedback_endpoint_user_verification]]）：幹事で発行→別ブラウザ（未ログイン）で参加→同期が動く→終了→「終了しました」。2タブ検証は両方最新版リロード（[[reference_collab_two_client_version_skew]]）。

---

## 14. 実装フェーズ（概要・詳細は writing-plans で）
- **Phase 0**：R1 スパイク（匿名 onSnapshot × App Check）。ここで方式 (a)/(b) を確定。
- **Phase 1**：データモデル + rules + `create-shared-tour` API + 幹事の直書き + 参加者の read/onSnapshot（**同期が動く骨格**）。
- **Phase 2**：UI（幹事の招待ボタン・警告・参加者ページ・view-kind 表示）。
- **Phase 3**：寿命（2時間無操作判定・cron GC）+ 悪用ガード。
- **Phase 4**：テスト整備・エッジケース・実機通し。

各フェーズはローカルで動く状態まで作り込む。**本番デプロイはユーザーのローカル確認をゲートにする**（[[feedback_deploy]]・新機能は勝手に本番へ出さない）。
