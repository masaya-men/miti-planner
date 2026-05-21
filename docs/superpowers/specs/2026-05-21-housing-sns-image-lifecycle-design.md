# ハウジング SNS 画像表示 + ツイート連動ライフサイクル 設計書

- 日付: 2026-05-21
- 対象: `/housing` 物件登録の画像表示（旧 TODO ③「ツイート画像を保存」の再定義）と、ツイート削除に連動した物件の自動削除
- ステータス: ドラフト（ユーザーレビュー待ち）

---

## 1. 背景と問題

### 1-1. "No image" の真因

物件詳細・カードの画像表示は **すでに完成している**:

- `HousingPhotoGallery` は `imageMode==='sns' && ogImageUrl` のとき `<img src={ogImageUrl}>` を描画する（[src/components/housing/listing/HousingPhotoGallery.tsx:16](../../../src/components/housing/listing/HousingPhotoGallery.tsx#L16)）。
- ギャラリー view-model アダプタも `postUrl` / `ogImageUrl` を素通しする（[src/lib/housing/galleryAdapter.ts:37](../../../src/lib/housing/galleryAdapter.ts#L37)）。
- CSP も `img-src ... https://pbs.twimg.com` を既に許可済み（`vercel.json`）。

壊れているのは **書き込み側だけ**。登録フォームが取得済みのツイート画像を提出時に捨てている:

- `HousingRegisterForm` は `tweetData`（`photos: string[]` を含む）を state に持ち、プレビューも出すが、`handleSubmit` が onSubmit に画像を渡さない（[src/components/housing/register/HousingRegisterForm.tsx:109](../../../src/components/housing/register/HousingRegisterForm.tsx#L109)）。
- `HousingRegisterFormValues` 型・`toRegistrationDraft`・`RegistrationDraft` 型のいずれにも画像フィールドが無い。
- 登録 API ハンドラが `imageMode: 'none'` を**決め打ち**する（[api/housing/_registerListingHandler.ts:93](../../../api/housing/_registerListingHandler.ts#L93)）。

→ ツイート画像 URL を提出〜保存まで繋ぎ、ハンドラの決め打ちをやめれば表示は出る。

### 1-2. 画像は「保存」しない（直リンク方針）

旧 TODO の「ツイート画像を保存」は表現が不正確だった。**画像バイナリは保存しない**。マイコラージュと同じ syndication CDN 方式で、ツイートの CDN 画像 URL（`pbs.twimg.com/...`）を物件 doc に**参照として持ち、`<img>` で直リンク表示**するだけ（memory `reference_tweet_extraction_syndication`）。

- うちのサーバー／ストレージを一切経由しない → ストレージ代・配信通信代ともゼロ。
- トレードオフ: 元ツイートが削除されると画像 URL も無効になる。

### 1-3. ツイート削除 → 物件削除（ユーザー要望）

上記トレードオフを **機能として歓迎する**。SNS と一緒に登録した物件は、ユーザーが自分のツイートを消すだけで掲載も消える、という導線にする。

- 対象は `imageMode==='sns'` の物件のみ。SNS 無し登録には適用しない。
- Twitter は削除を通知しないため、こちらから定期的・遅延的に再確認する（push は無い）。
- `/api/tweet-meta` はツイート削除/非公開時に **404** を返す（[api/tweet-meta.ts:31](../../../api/tweet-meta.ts#L31)）。これを削除サインに使う。Web 標準のみで書かれているため cron からも再利用可。

---

## 2. スコープ

### 含む
- (A) 登録フォーム → 登録 API のデータ経路に画像情報を通す。
- (B) 登録 API ハンドラで `imageMode='sns'` + 画像 URL を保存（`'none'` 決め打ちを廃止）。
- (C) 「開いた時の即時チェック」: SNS 物件を開いた瞬間にツイート生存を確認し、404 なら案内 + 削除。
- (D) サーバー検証つき削除エンドポイント（家主以外でも安全に発火、サーバーが 404 を再確認してから削除）。
- (E) ローリングバッチ cron による長期巡回（誰も開かない物件の掃除、10 万件対応）。

### 含まない（別タスク・将来）
- 旧 TODO ①（編集→保存で自動解決＋即反映）/ ②（削除後の一覧即時更新＋フィードバック）。本仕様より先に 1 件ずつ実機検証で対応する小修正。ただし ② で追加する `useHousingListingsStore.remove(id)` を本仕様 (C) でも再利用する。
- **編集モーダルでの画像差し替え**。編集は旧 `HousingRegisterView`（SNS 欄なし）を使うため、本仕様では「編集時に既存の画像フィールドを温存する（消さない）」ことのみ保証し、編集での画像変更 UI は将来対応。
- 複数枚ギャラリー（Phase 4 以降。今は 1 枚目のみ）。
- 物件が tweet 連動削除されたときの家主への通知（ユーザー本人の操作なので不要、YAGNI）。
- 画像バイナリの Firebase Storage 保存（`imageMode='thumbnail'` 経路。今回採用しない）。

---

## 3. データモデル変更

`HousingListing`（[src/types/housing.ts:116](../../../src/types/housing.ts#L116)）の画像フィールドは既存（`imageMode` / `postUrl` / `ogImageUrl` / `thumbnailPath`）。SNS 連動のため以下を追加する。

| フィールド | 型 | 用途 |
| --- | --- | --- |
| `tweetId` | `string?` | cron / 再チェックでの syndication 問い合わせキー（`postUrl` から再パースでも可だが明示保持で query/index を単純化） |
| `lastTweetCheckAt` | `number?` | 最後にツイート生存を確認した時刻(ms)。cron の「古い順」並びと、開いた時チェックの timer リセットに使う |

- `imageMode==='sns'` の物件のみ上記を持つ。
- `postUrl` = ツイートの URL（表示・出典リンク用）、`ogImageUrl` = 採用する CDN 画像 URL（`photos[0]`）。

### Firestore 複合インデックス
cron クエリ用に複合インデックスを追加:
```
collection: housing_listings
fields: imageMode ASC, deletedAt ASC, lastTweetCheckAt ASC
```

---

## 4. コンポーネント / データフロー

### 4-1. 登録時の画像経路 (A)(B)

```
HousingRegisterSnsUrlField (URL入力)
  → useTweetFetch → /api/tweet-meta → { photos[], ... }
  → HousingRegisterForm: tweetData を保持（既存）＋ 入力 URL を保持（新規）
  → handleSubmit: image 情報を HousingRegisterFormValues に同梱（新規）
      { ..., postUrl, ogImageUrl, tweetId }
  → toRegistrationDraft: image 情報を RegistrationDraft へ詰め替え（新規）
  → registerListing(POST /api/housing?action=register-listing)
  → _registerListingHandler: draft の image を読んで listing に保存（'none' 決め打ち廃止）
```

- `HousingRegisterFormValues` に `postUrl?` / `ogImageUrl?` / `tweetId?` を追加。
- `RegistrationDraft` に `imageMode?` / `postUrl?` / `ogImageUrl?` / `tweetId?` を追加（任意。未指定なら従来どおり `'none'`）。
- 画像 URL の選択: 当面 `photos[0]` を `ogImageUrl` に採用（複数枚は将来）。`tweetId` は入力 URL を `parseTweetUrl` で抽出（既存ユーティリティ）。

### 4-2. ハンドラのバリデーションと保存 (B)

`_registerListingHandler` / `validateRegistrationDraft`:

- `imageMode` が `'sns'` のとき `postUrl` / `ogImageUrl` / `tweetId` 必須。URL は `https://` のみ許可、`ogImageUrl` は `pbs.twimg.com` ホスト限定（任意の URL を保存させない＝オープンリダイレクト/画像差し込み防止）。
- listing 作成時:
  ```ts
  ...(draft.imageMode === 'sns'
    ? { imageMode: 'sns', postUrl, ogImageUrl, tweetId, lastTweetCheckAt: now }
    : { imageMode: 'none' }),
  ```
- 編集（update-listing）は image フィールドを **温存**（上書き・削除しない）。

### 4-3. 開いた時の即時チェック (C)

`HousingDetailModalRoute`（[src/components/housing/listing/HousingDetailModalRoute.tsx](../../../src/components/housing/listing/HousingDetailModalRoute.tsx)）の listing 取得後:

1. `listing.imageMode==='sns'` かつ `tweetId` ありのときのみ実行。
2. クライアントから `/api/tweet-meta?id=<tweetId>` を確認（s-maxage キャッシュにより低コスト）。
3. **404 のとき**:
   - 詳細を「この物件の投稿は削除されました」案内表示に差し替え（モーダル内、既存の reportNotice バナーと同系のスタイル）。
   - サーバー検証つき削除 (D) を発火 → 成功で `useHousingListingsStore.remove(id)`（②で追加）→ 一覧からも消える。
   - 案内の「閉じる」で背景に戻る。
4. **200 のとき**: 何もしない（必要なら `lastTweetCheckAt` 更新を D 経由で行えるが、必須ではない）。

> 注: クライアント側チェックはあくまで UX（即フィードバック）。実削除の真偽判定はサーバー (D) が再確認する。

### 4-4. サーバー検証つき削除 (D)

新エンドポイント `POST /api/housing?action=purge-if-tweet-gone`:

- 認証: App Check 必須 + Firebase 認証必須 + rate limit（既存 `buildHousingHeaders` / `applyRateLimit` を踏襲）。**家主チェックはしない**。
- 処理:
  1. listingId から listing を取得。`imageMode!=='sns'` または `tweetId` 無し → `400`（対象外）。
  2. サーバーから syndication を直接確認（`/api/tweet-meta` と同じ token 生成ロジックを共有モジュール化して再利用）。
  3. **404 → soft delete**（`deletedAt = now`。既存削除と同じ。30 日後物理削除 cron が後で purge）。`{ deleted: true }`。
  4. **生存 → 削除せず** `lastTweetCheckAt = now` を更新して `{ deleted: false }`。
- 安全性: 削除権限の根拠は「ツイートが実際に 404 か」をサーバーが確認する点。第三者が叩いても、生きているツイートの物件は消せない（いたずら削除不可）。

### 4-5. ローリングバッチ cron (E)

新 cron `GET /api/cron/check-sns-tweets`（`vercel.json` の `crons` に追加、CRON_SECRET 認証は既存 `cleanup-og-images` と同方式）:

- クエリ: `housing_listings where imageMode=='sns' and deletedAt==null orderBy lastTweetCheckAt asc limit N`（最も長く未確認のものから）。
- 各 listing について syndication 確認:
  - 404 → soft delete（D と同じロジックを共有）。
  - 生存 → `lastTweetCheckAt = now`。
- `N` は環境変数 `HOUSING_TWEET_CHECK_BATCH`（既定 150）。1 回の実行が関数タイムアウト内に収まるサイズ。並列度は小さめ（例: 同時 10）で Twitter を叩きすぎない。
- Hobby プランは cron が 1 日 1 回。スケジュールは `cleanup-og-images` とずらす。

#### 10 万件でのスケール根拠
- **人気物件は (C) の「開いた時チェック」が即捕まえる**。閲覧されるたびに `lastTweetCheckAt` が更新され、cron の対象から自然に後ろへ回る。
- cron は **誰も開かない長い裾野** を古い順に少しずつ掃除する安全網。未閲覧物件の削除が数日〜数週間遅れても、誰も見ていないため実害が小さく、最終的に閲覧された瞬間 (C) が即削除する。
- よって全件を高頻度で確認する必要はなく、固定バッチ（数百/日）で破綻しない。Firestore 読み取りは 10 万件規模でも月数百円以内（無料枠の超過分のみ）。syndication への負荷も 1 cron あたり数百件で軽微。

---

## 5. エラーハンドリング

- 登録時に `/api/tweet-meta` が失敗（タイムアウト/レート制限）: 画像なしで登録を続行できる（`imageMode='none'` にフォールバック、ユーザーに「画像は取得できなかったが登録は可能」を表示）。SNS 入力は任意。
- 開いた時チェックのネットワーク失敗: 削除しない（fail-safe。生きている物件を誤って消さない）。案内も出さず通常表示。
- (D)/(E) で syndication が 404 以外のエラー: 削除しない。`lastTweetCheckAt` も更新しない（次回再試行されるよう据え置き）。
- 二重削除: soft delete は idempotent（既存削除と同じ）。

---

## 6. テスト方針

- **ユニット**: `validateRegistrationDraft`（imageMode='sns' の必須/ホスト検証）、`toRegistrationDraft`（image 詰め替え）、syndication 確認の共有モジュール（404/200/エラー分岐）。
- **ハンドラ**: register-listing が draft の image を保存すること / 'none' フォールバック。purge-if-tweet-gone が「生存→消さない・404→消す」を満たすこと。firebase / housingAuthHeaders はモック（memory `reference_vitest_pool_firebase` / `reference_housing_appcheck_headers`、pool='vmThreads' 厳守）。
- **コンポーネント**: HousingRegisterForm が image を onSubmit に渡すこと。HousingDetailModalRoute が 404 時に案内表示 + remove を呼ぶこと（fetch モック）。
- **cron**: ローリングバッチが「古い順 N 件」を処理し、404 を soft delete・生存を `lastTweetCheckAt` 更新すること。
- 実機検証（要ログイン）: 1 件ずつ。①②と同様、各段階を実機で確認してから次へ。

---

## 7. 実装順序（実機検証は 1 件ずつ）

1. **(A)+(B) 画像表示**: フォーム経路 + ハンドラ。実機で「ツイート付き登録 → カード/詳細に画像が出る」を確認。← まず No image を解消。
2. **(D) サーバー削除エンドポイント**: 単体で確認（生存→消えない / 削除済みツイート→消える）。
3. **(C) 開いた時チェック**: 実機で「ツイート消した物件を開く → 案内 → 一覧から消える」を確認。
4. **(E) cron 巡回**: インデックス追加 + バッチ。手動トリガで動作確認後スケジュール投入。

---

## 8. 確定した設計判断

- 画像は **CDN 直リンク**（バイナリ保存しない）。コストゼロ、ツイート削除で無効化されることを機能として利用。
- ツイート削除 → 物件 soft delete。対象は `imageMode==='sns'` のみ。
- 検出は **二段構え**: 開いた時の即時チェック（UX）+ ローリングバッチ cron（長期巡回・10 万件対応）。削除の真偽はサーバーが syndication 404 を再確認してから実行（家主以外でも安全）。
- `ogImageUrl` は `pbs.twimg.com` ホスト限定で保存（任意 URL 注入防止）。
