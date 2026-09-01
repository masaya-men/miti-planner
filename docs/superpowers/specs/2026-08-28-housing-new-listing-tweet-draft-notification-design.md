# 新着ハウジングのワンクリックツイート下書き通知 — 設計書

- 作成日: 2026-08-28
- ステータス: 設計確定 → 実装計画へ

> **2026-09-01 変更 (実装済み)**: 通知対象を絞った。
> 1. **住所非公開 (`unlisted`) は通知しない** — 従来は「(住所非公開)」ラベル付きで送っていたが、
>    宣伝しない方針に変更。通知は `visibility === 'public'` のときだけ。
> 2. **登録画面に「LoPo 運営による X（Twitter）での紹介を許可する」トグルを追加** (既定 ON、
>    「公開」を選んだ create のときだけ表示)。OFF の物件は通知しない (`draft.allowPromoTweet === false`)。
>    OFF にしたときだけ `housing_listings` doc に `allowPromoTweet: false` を残す。
>    文言はアカウントを名指ししない (「LoPo 運営」= 公式 @lopoly_app と運営者個人アカウントの両方をカバー。
>    個人ハンドルを公開リポジトリの i18n に直書きしない方針)。
> 以下の本文で「unlisted は送る」としている箇所はこの変更で無効。`buildNewListingNotification`
> 純関数の `(住所非公開)` 見出し分岐はコード・テストとも残置 (将来の手動通知用)。
- 関連: `docs/TODO.md`「次の作業順」1番 / アイデア欄「新着ハウジングの自動ツイート下書き通知」(2026-08-20)
- 種別: architectural (新しい通知経路 + X 連携 + 既存 OGP ハンドラーの修正)

---

## 1. 背景と目的

新しいハウジングが登録されるたびに、**masaya 本人**が LoPo の宣伝ツイートを
ほぼ 1〜2 クリックで投稿できるようにする。

- masaya しか見えない Discord チャンネルへ「新着ハウジング + 事前入力済みツイート作成リンク」を通知する。
- X の公式 API 連携は 2026 年の値上げ(リンク付き投稿 1 件 0.2 ドル)で見送り済み。
  X の **無料の Web Intent**(`https://twitter.com/intent/tweet?...`)を使う。投稿ボタンは masaya が押す。
- 1 ツイートに複数リンクを貼ると OGP カードは 1 つしか出ないため、
  **本文ツイート + リプライ の 2 段構成**にする。

### やること (スコープ)

1. 物件登録 API の成功後に、Discord webhook で通知を 1 通送る (best-effort)。
2. 通知に「本文ツイート作成」の Web Intent リンクと、「リプ用」のコピペ用テキストを載せる。
3. 物件詳細ページの OGP 画像を「その家の写真」にする修正 (現在は汎用ロゴ固定)。

### やらないこと

- ツイートの自動投稿 (masaya が手で押す)。
- X API / OAuth 連携。
- リプライを自動でぶら下げる中継ページ (案 2 は不採用、コピペ運用で確定)。
- 一般ユーザー向けの「自分の登録を SNS 告知」機能 (これは別物・masaya 専用)。
- ハウジンガーページ OGP カードの作り直し (既存のものをそのまま使う)。
- ツイート本文・ハッシュタグの現地語化 (本文もタグも日本語固定。§5 の理由による)。

---

## 2. 全体フロー

```
[ユーザー] 物件を登録
   │
   ▼
POST /api/housing?action=register-listing  (既存)
   │  トランザクションで housing_listings に新規 doc 作成 (既存)
   │  重複住所への duplicate_alert 通知 (既存・best-effort)
   │
   ├─▶ 【新規】新着ハウジング Discord 通知 (best-effort)
   │      1. visibility が 'private' なら何もしない (誰も見られずツイートのリンクが壊れる)
   │         ※ 2026-08-31 変更: 当初は「登録者が admin なら通知しない」も条件だったが、
   │           masaya もハウジング製作者で自分の家も宣伝したいため撤回。テスト物件は
   │           「宣伝しなければいい」だけ。除外は private のみ。
   │      3. housing_profiles/{ownerUid} を 1 read → displayName / isPublished
   │      4. 本文ツイートの Web Intent URL を組み立てる (本文は常に日本語)
   │         - postUrl (投稿元 URL) があれば: 本文に「LoPo 物件ページ URL + 投稿元 URL」両方
   │         - 無ければ: 本文に「LoPo 物件ページ URL」のみ (カード = 家の写真)
   │      5. リプ用テキスト (ハウジンガー短縮 URL 付き) を組み立てる
   │         - isPublished でなければリプはスキップ (その旨を通知に明記)
   │      6. DISCORD_HOUSING_NEW_WEBHOOK_URL へ POST
   │
   ▼
200 { id, addressKey }  (通知の成否は結果に影響しない)
```

Discord 通知が失敗しても登録は成功のまま返す。既存の `duplicate_alert` と同じ扱い
(通知は副作用であって必須ではない)。

---

## 3. A. 通知の発火場所 — 登録 API に相乗り

### 決定

`api/housing/_registerListingHandler.ts` のトランザクション成功後、既存の
`duplicate_alert` 通知ブロックの直後に、新しい best-effort ブロックを 1 つ足す。

### 却下した案

| 案 | 却下理由 |
|----|----------|
| Vercel Cron で新着を拾う | 最大 1 日遅れる。「登録したてを宣伝」に向かない。watermark 管理も増える。 |
| Firestore トリガー (Cloud Functions) | このリポジトリは Google の関数基盤を一切使っていない (全 API が Vercel)。新しいデプロイ対象を持ち込むのは重すぎる。 |

### 発火条件

以下をすべて満たすときだけ送る (2026-09-01 更新):

- `draft.visibility === 'public'` (private / unlisted は宣伝しない。private は 404、unlisted は住所を
  隠したい人が多く「宣伝しない」が穏当)。
- `draft.allowPromoTweet !== false` (登録画面の「LoPo 公式 X での紹介を許可する」トグル。既定 ON)。

実ゲート: `draft.visibility === 'public' && draft.allowPromoTweet !== false && createdId`。

> **2026-08-31 変更**: 当初は「登録者が admin **ではない**」も条件に入れていた
> (masaya のテストデータでチャンネルが埋まるのを防ぐ意図)。しかし masaya 自身も
> ハウジング製作者で、自分の家もワンクリック宣伝したいため撤回。ガードは
> `draft.visibility !== 'private' && createdId` のみ。テスト物件は「宣伝ボタンを押さなければいい」だけ。
> 通知量が実際にうるさくなったら §12 の「1 日 N 件まで / ダイジェスト化」を検討する。

### コスト

- Discord webhook: 無料。レート制限 (約 30 通/分/webhook) にはまず当たらない。
- Vercel: 新規 Serverless Function なし (既存の登録処理に相乗り)。1 登録あたり
  「Discord へ 1 POST (約 0.2 秒)」+「`housing_profiles` を 1 read」だけ増える。
  Firestore 無料枠 (1 日 5 万 read) から見て誤差。
- 実質 $0。

### 実装メモ

- Vercel の Serverless Function はレスポンス送信後に処理を継続できないため、
  Discord への `fetch` は 200 を返す**前に** `await` する (try/catch で囲む)。
- 登録処理はもともとトランザクション + 重複クエリを行うので、+0.2 秒は許容範囲。

---

## 4. B. Discord メッセージの仕様

### 送信先

新しい環境変数 `DISCORD_HOUSING_NEW_WEBHOOK_URL` (masaya しか見えない専用チャンネル)。
既存の `DISCORD_ADMIN_WEBHOOK_URL` はテンプレ更新等で賑やかなので**混ぜない**。

未設定なら `console.warn` してスキップ (既存 `sendDiscordNotification` と同じ挙動)。

### メッセージ形式

Discord の **プレーンな `content`** で送る (embed ではない)。理由:
リプ用テキストを**コードブロック**に入れると、タップ長押しでまるごとコピーできる。
embed の description ではきれいにコピーできない。

Web Intent の URL は `<...>` で囲んでリンクプレビューを抑制する。

#### 例 (投稿元 URL がある = SNS 取り込み物件)

> 🏠 新着ハウジング: サンドリア風の隠れ家
> 登録者: ミコッテ太郎
>
> ▶ 本文ツイートを作成 (クリックで投稿画面が開く):
> `<https://twitter.com/intent/tweet?text=...>`
>
> ▶ リプ用 (本文を投稿したあと、自分のツイートに「返信」して貼り付け):
> コードブロックで:
> `ミコッテ太郎さんの他のハウジングはこちら👇` 改行 `https://lopoly.app/h/mikotetaro-a1b2c3d4`
>
> 確認用:
> 物件ページ  `https://lopoly.app/housing/listing/AbC123`
> 投稿元      `https://x.com/mikotetaro/status/1234567890`

#### 例 (投稿元 URL なし = LoPo に直接アップ / 動画のみ)

> 🏠 新着ハウジング: 白基調のアパルトメント (住所非公開)
> 登録者: ララフェル花子 ※ハウジンガーページ未公開のためリプはスキップ
>
> ▶ 本文ツイートを作成:
> `<https://twitter.com/intent/tweet?text=...>`
>
> 確認用:
> 物件ページ  `https://lopoly.app/housing/listing/XyZ789`

実際の Discord メッセージでは、リプ用テキストは ` ``` ` で囲んだコードブロックにして
タップ長押しでコピーできるようにする。

### タイトルと登録者名の解決

- タイトル: `listing.title` があればそれ。無ければ住所文字列 (`formatFullHousingAddress`、
  `_listingPageHandler.ts` と同じ優先順位)。`unlisted` で住所も出せなければ「住所は非公開です」。
  → `unlisted` のときはタイトル横に「(住所非公開)」を付ける。
- 登録者名: `housing_profiles/{ownerUid}.displayName`。profile doc が無い / displayName 空なら
  「名無しさん」等のフォールバック。
- `housing_profiles/{ownerUid}.isPublished !== true` のとき: リプ用ブロックを出さず、
  登録者名の行に「※ハウジンガーページ未公開のためリプはスキップ」と付記。

---

## 5. C. ツイート文面とハッシュタグ

### 言語方針 (確定)

- **本文は常に日本語**。masaya 自身のサイト・アカウントで、フォロワーも日本語中心のため。
  物件がどの地域 (JP/NA/EU/OCE/KR/CN/TW) のサーバーでも本文は日本語で投稿する。
- **ハッシュタグも地域で出し分けない** (下記の 2 個で全地域固定)。

### ハッシュタグ (確定)

**`#FF14ハウジング #FFXIVHousing` の 2 個のみ**。物件の地域によらず全ツイート固定。

根拠:
- X 公式ヘルプはハッシュタグ最大 2 個を推奨、それ以上はスパム判定に触れうる
  (2026 年の X はハッシュタグに冷たい。Musk 2024-12「ハッシュタグはもう使わないで」、
  アルゴリズムは本文を AI で読む。プラス効果はほぼ無く、数を増やすとマイナスに働きうる)。
- `#FFXIVHousing` は FFXIV 公式アカウントも使う普遍タグ。
- `#FF14ハウジング` は日本のハウジング勢が今も検索タブを実際に眺めている定番タグ。
  masaya は日本語で投稿する = 日本のコミュニティが主対象なのでこれを固定で入れる。
- 地域ごとの現地語タグ (韓国 `#FF14하우징` 等) は候補を出したが不採用:
  どのタグが各コミュニティで実際に主流か確証が取れず、かつ日本語本文のツイートを
  現地語タグの下に置いても拾う人が限られるため。将来必要になれば §12。
- `#FF14` `#FFXIV` `#LoPo` は入れない (巨大タグは数秒で流れ発見効果ほぼ無し、
  「タグが多い」マイナスだけ食う)。LoPo の追跡は全ツイートに入る `lopoly.app` リンクで足りる。

### 文面テンプレート

`text` / リプの各リードは **1 箇所にまとめた定数**として実装する
(実際の伸びを見て masaya が書き換えられるように)。日本語のみ。

#### 本文ツイート (テキスト)

```
{本文リード}

{ハッシュタグ}
{LoPo 物件ページ URL}
{投稿元 URL があれば改行して追加}
```

- 本文リード: `新しいハウジングが投稿されました🏠` (日本語固定)
- リードとハッシュタグの間は改行 + 空白行 1 行 (2026-08-31 実機テスト後の masaya 指定)

投稿元 URL を本文の**最後**に置く。X の仕様:
- ツイート内にツイート URL があると**必ず引用表示**になり、他リンクのカードより優先される。
- 引用にならない外部 URL (housingsnap 等) でも、それが本文の最後にあればそのカードが出る。
- LoPo 物件ページ URL はカードにならないが、**クリックできるテキストリンクとしては残る**。

→ 投稿元ありのとき: 見た目は「文章 + LoPo リンク(テキスト) + 投稿元の引用/カード(写真つき)」。
   投稿元なしのとき: 見た目は「文章 + LoPo 物件ページのカード(家の写真、§6 で修正)」。

#### リプライ (コピペ用テキスト・ハッシュタグなし)

```
{リプリード}
{ハウジンガー短縮 URL}
```

- リプリード: `{name}さんの他のハウジングはこちら👇` (日本語固定・`{name}` は displayName)
- ハウジンガー短縮 URL: `https://lopoly.app/h/{buildHousingerShortSlug(displayName, uid)}`
  (`/h/<名前>-<識別コード>` は X 等での共有専用の入口として既に用意されている)
- リプは masaya が本文投稿後に「自分のツイートへの返信」として手で貼る (案 1 で確定)。

### Web Intent URL の組み立て

```
https://twitter.com/intent/tweet?text={encodeURIComponent(本文全体)}
```

- URL はすべて `text` パラメータの中に入れる (`url=` パラメータは使わない)。
  → 本文内の URL の順序を完全に制御できる (投稿元を最後に置く)。
- 一度投稿されれば通常のツイート本文として X が URL を解釈する (`url=` は単なる追記の糖衣)。
- 文字数: リード約 15 + ハッシュタグ約 20 + URL 2 本 (各 t.co 23 換算) ≒ 100。280 に余裕。
- ドメインは本番固定 `https://lopoly.app`。

---

## 6. E. 物件詳細ページの OGP カード画像を修正

### 現状の問題

`api/share/_listingPageHandler.ts` は `ogImageUrl` を `DEFAULT_OG_IMAGE = '/api/og'`
(汎用の LoPo カード) に固定していて、**家の写真を一切カードに出していない**。
このままだと本文ツイート (投稿元なしの物件) の見栄えが弱い。

対照的に `_housingerPageHandler.ts` はその人の家々を並べた立派なカードを自動生成している。

### 修正方針

`_listingPageHandler.ts` で、公開判定を通った物件について**代表画像 1 枚**を解決し、
`og:image` / `twitter:image` に使う。無ければ従来どおり `DEFAULT_OG_IMAGE`。

- 代表画像の解決は `listingRepresentativeImages(listing)` を再利用する。
  現在 `_housingerPageHandler.ts` にあるので、**共有モジュール `api/share/_listingImages.ts` へ
  切り出す** → 両ハンドラーから import (`_housingerPageHandler.ts` は後方互換で re-export)。
  - `api/share/` 配下に置けば `toPngSiblingPath` (`../housing/_imageArrayLogic.js`) と
    `buildYoutubeThumbnailUrlFallback` (`../../src/lib/housing/youtubeUrl.js`) を
    `_housingerPageHandler.ts` と同じ相対パスで import できる。
- 優先順 (既存ロジックのまま): thumbnail (PNG 兄弟) → YouTube サムネ → sns 画像
  (sourceImageUrls → ogImageUrl) → 動画ポスター → なし。
- `projectPublicListing` は `imageMode` / `thumbnailPath(s)` / `ogImageUrl` /
  `sourceImageUrls` / `youtubeVideoId` / `videoPosterUrl` を通すので、
  射影後の `projected` をそのまま渡せる。
- 絶対 URL 化してから meta に入れる (相対 `/housing-media/...` は X が解決できない)。

### 既知のリスク (実装計画で潰す)

- **直接アップロード物件の `.png` 兄弟ファイル**: satori (OGP カード生成) が WebP 非対応なため
  アップロード時に `.png` を併存させているが、バックフィル未実行の古い物件では `.png` が無い。
  `_housingerPageHandler` は「404 なら画像なしに倒れる」で安全側だが、こちらは meta に直書きするので
  X が壊れた画像を掴む可能性がある。対策候補:
  1. `backfill-listing-thumbnail-png.ts` が全物件に対して実行済みか確認する。
  2. 未実行分があれば実行する、または Storage の `.exists()` チェックを 1 回噛ませる
     (housinger のウォームアップと同じ手法・レイテンシ +1 Storage call)。
- X (Twitter) の `og:image` は WebP を安定サポートしない前提で、必ず PNG / JPEG を指す。
  (thumbnail = PNG 兄弟、sns = pbs.twimg.com の jpg、YouTube = img.youtube.com の jpg。全て OK)
- キャッシュ: このハンドラーの `Cache-Control` は変更しない
  (`public, s-maxage=86400, max-age=60` のまま)。X のカードキャッシュは X 側の都合。

### 副産物

物件詳細ページのシェアボタン (`HousingShareButton`) 経由の共有や、
一般ユーザーが物件 URL を X に貼ったときの見栄えも同時に良くなる。

---

## 7. D. リプライの運用 (確定事項の記録)

- 案 1 (コピペ運用) で確定。案 2 (LoPo 内に中継ページを作り、投稿済みツイート URL を貼ると
  返信先付きの「リプを投稿」ボタンが出る) は**不採用**。
- 理由: X の Web Intent は「返信先ツイート ID (`in_reply_to`)」を渡せるが、
  その ID は 1 本目を投稿するまで存在しない。完全自動でぶら下げるには中継ページが要る。
  masaya は「Discord からコピペで十分」と判断。
- 運用手順 (Discord メッセージにも要約を書く):
  1. 「本文ツイートを作成」リンクをクリック → 投稿画面が開く → 投稿。
  2. 投稿した自分のツイートで「返信」を開く。
  3. Discord のコードブロック (リプリード + ハウジンガー URL) を貼り付けて投稿。

---

## 8. データフローと依存

### 読み取り (新規)

- `housing_profiles/{ownerUid}` — `displayName`, `isPublished` (1 read / 登録)。

### 既存の入力 (register ハンドラーが既に持っている)

- `createdId` (新規 listing の doc ID) — 物件ページ URL に使う。
- `draft.title` / 住所フィールド — タイトル解決。
- `draft.postUrl` / `draft.sourcePostUrls?.[0]` — 投稿元 URL。
- `draft.visibility` — private 除外 / unlisted ラベル。(2026-08-31: 当初あった admin 除外は撤回)

### 依存する既存モジュール

| モジュール | 用途 |
|-----------|------|
| `src/lib/discordWebhook.ts` | Discord 送信ヘルパー。新 webhook 用の関数を追加 (§10)。 |
| `src/lib/housing/housingerProfile.ts` | `buildHousingerShortSlug`, `stripHashedPrefix` |
| `src/lib/housing/formatHousingAddress.ts` | タイトルの住所フォールバック |
| `src/lib/housing/publicListingProjection.ts` | (§6) 代表画像解決の入力 |

### 新規ファイル (想定)

- `src/lib/housing/newListingTweet.ts` — 文面テンプレート定数 + Web Intent URL 組み立て +
  リプテキスト + Discord メッセージ組み立て (pure 関数、単体テスト対象)。
- `api/share/_listingImages.ts` — §6 の `listingRepresentativeImages` 共有切り出し。
- `src/lib/discordWebhook.ts` に `sendHousingNewListingNotification(content)` を追加。

---

## 9. エラー処理

- Discord 送信は全体を try/catch。失敗しても登録レスポンスは 200 のまま。
  `console.error('[housing/register-listing] new-listing tweet notify failed:', err)`。
- `DISCORD_HOUSING_NEW_WEBHOOK_URL` 未設定 → `console.warn` + return (何も送らない)。
- `housing_profiles` read 失敗 → 登録者名フォールバック + リプなしで送信を続行。
- §6 の代表画像解決が失敗/該当なし → `DEFAULT_OG_IMAGE` にフォールバック (現状維持)。

---

## 10. テスト

### pure 関数 (`src/lib/housing/newListingTweet.ts`)

- 本文リード + `#FF14ハウジング #FFXIVHousing` の 2 個が入る (常に固定・地域非依存)。
- 投稿元 URL あり → 本文の末尾が投稿元 URL、その手前に LoPo 物件 URL。
- 投稿元 URL なし → 本文に LoPo 物件 URL のみ。
- `text` パラメータが正しく `encodeURIComponent` されている。
- リプテキスト: `{name}` 展開 + 短縮 URL 形式 (`/h/<slug>-<code>`)。
- 文字数が 280 以内。

### `listingRepresentativeImages` の共有切り出し

- 既存テスト (`api/share/__tests__/_housingerPageHandler.test.ts` にある想定) が
  import パス変更後も緑。thumbnail / YouTube / sns / 動画ポスター / なし の各分岐。

### `_listingPageHandler` (§6)

- thumbnail 物件 → `og:image` が PNG 兄弟の絶対 URL。
- YouTube 物件 → `og:image` が img.youtube.com のサムネ。
- sns 物件 → `og:image` が pbs.twimg.com など。
- 画像の無い物件 (テキストツイート等) → `og:image` が `DEFAULT_OG_IMAGE` のまま。
- 非公開 (`isPubliclyViewable` false) → 404 + 従来のデフォルトメタ。

### register ハンドラー (通知ブロック)

- 一般ユーザーの `visibility: 'public'` 登録 → 呼ばれる。
- admin (masaya 自身) の public 登録 → 呼ばれる (2026-08-31)。
- `visibility: 'private'` → 呼ばれない。
- `visibility: 'unlisted'` → 呼ばれない (2026-09-01 変更)。
- `allowPromoTweet: false` → 呼ばれない (2026-09-01 追加)。
- `allowPromoTweet: true` / 未指定 の public → 呼ばれる。
- profile 未公開 → メッセージにリプなし + 「未公開」付記。
- Discord fetch が reject → レスポンスは 200 のまま (登録は成功)。
- webhook URL 未設定 → fetch されず 200。

---

## 11. 環境変数・デプロイ

### 新規環境変数

`DISCORD_HOUSING_NEW_WEBHOOK_URL`
- Discord の該当チャンネル (masaya 専用) の「連携サービス → ウェブフック」で作成した URL。
- Vercel に **Production / Preview / Development** で追加。
- 実値は `.env.local` / `ADMIN_REFERENCE.md` にのみ記載。設計書・コードには書かない
  (パブリックリポジトリ)。

### デプロイ手順 (実装完了後)

1. `npm run build` + `npm run test` (変更ファイル周辺、push 前ゲートはフル) が緑。
2. Vercel に `DISCORD_HOUSING_NEW_WEBHOOK_URL` を追加。
3. §6 のバックフィル状況を確認 (`backfill-listing-thumbnail-png.ts` 未実行分があれば実行)。
4. push → Vercel 自動デプロイ。
5. 本番で: 一般アカウントでテスト物件を 1 件登録 → Discord に通知が来ることを確認 →
   本文リンクをクリックして投稿画面が正しく開くことを確認 → 物件詳細 URL を
   X のカードバリデーターに通し、家の写真が出ることを確認。
6. テスト物件は削除 ([[feedback_housing_data_disposable]])。

---

## 12. 未解決 / 将来

- リプの完全 2 クリック化 (中継ページ = 案 2) が欲しくなったら別タスクで。
- 現地語で本文ごと投稿する運用に切り替えるなら、そのとき本文リード + ハッシュタグを
  セットでその言語版にする (韓国語なら本文韓国語 + `#FF14하우징` 等・要コミュニティ確認)。
  現状は「masaya が日本語で全部投稿」なので本文もタグも日本語固定。
- 物件詳細ページの OGP を「写真 1 枚」ではなく合成カード (住所 + タイトル + 複数写真) に
  格上げする案 — 今回は YAGNI。ハウジンガーカードの資産 (`api/og/_housingerCard.ts`) を
  流用すれば作れるが、需要を見てから。
- 物件登録が増えて通知量が多くなったら「1 日 N 件まで」「ダイジェスト化」
  「テスト用に登録時オプトアウトチェック」等を検討。
