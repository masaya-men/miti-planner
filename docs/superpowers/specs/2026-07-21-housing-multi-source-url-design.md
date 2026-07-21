# ハウジング登録: 複数投稿URL登録機能(Batch 2) 設計書

- 日付: 2026-07-21
- 対象: `src/types/housing.ts` / `src/utils/housingValidation.ts` / `src/lib/housing/parseHousingFromText.ts`・`extractHousingAddressFromPage.ts` / `src/components/housing/pages/RegisterPage.tsx` / `src/components/housing/register/*` / `src/components/housing/edit/*` / `src/lib/housingApiClient.ts` / `api/housing/_registerListingHandler.ts`・`_updateListingHandler.ts` / `src/components/housing/listing/HousingDetailContent.tsx`
- 発端: 実ユーザーの多くは「1つの物件=1つのTwitterスレッド(本体ツイート+画像だけの返信ツイート)」という投稿の仕方をしている。Twitterは1ツイート4枚までしか画像を貼れないため、追加の写真をスレッドの返信ツイートに分割して投稿するユーザーが多い。現状は1物件につき投稿URLを1つしか登録できず、本体ツイートの4枚(またはOGP/YouTube由来の画像)しか取り込めない。2026-07-21、複数URLを貼れるようにし、①どれかに住所が書かれていれば自動入力、②画像・動画は複数URL合計で上限枚数いっぱいまで使う、という要望が出てbrainstormingを実施。

## 経緯・調査で判明したこと

- 現行実装は「1物件=1投稿URL」が型定義・登録フォーム状態(`SnsCapture`)・API・詳細ページの全レイヤーに染み込んでいる(`postUrl`/`tweetId`/`youtubeVideoId`/`videoUrl`は全て単数、`buildDraftImageFields`は4系統排他で常に1つだけ採用)。
- 画像/動画の上限枚数は`MAX_SOURCE_IMAGE_URLS = 10`(`housingValidation.ts:288`)。現状は単一URL取得の瞬間に`photos.slice(0, 10)`等で即座に切り捨てており、ユーザーが選ぶ余地がない。
- 動画(`videoUrl`)は静止画とは全く別の仕組みで、`api/tweet-video.ts`がLoPoサーバー経由でTwitterの動画データをプロキシしている。キャッシュは明示的に無効(`Cache-Control: private, max-age=0`)で、一覧の「生きたカード」用3コマ抽出もタブ内メモリキャッシュのみ(ページリロードで消える)。**画像と違い、動画は閲覧されるたびにLoPoサーバー経由でコストが発生する**(YouTubeは`<iframe youtube-nocookie.com/embed>`直埋め込みで完全無料、非対称であることが判明)。この事実により「動画は複数本OK」ではなく「動画は引き続き1本まで」に決定した。動画コストを0にする対策自体は本設計のスコープ外・別タスクとしてTODO.mdに記録済み。
- URLの追加のたびに発生する`api/tweet-meta`/`api/og-fetch`の呼び出しは軽量なテキスト/メタデータ取得であり、動画のような「閲覧されるたびの継続コスト」ではなく「登録・編集した本人が貼った瞬間の1回きり」のコストのため、5個まで増やしても実質無視できる。

## スコープ

### 含む

- 登録ページ・編集ページ双方で、投稿URLを複数(最大5個)貼れる「URLを追加」ボタン。
- 住所自動入力: 貼った全URLの本文を検索し、URLを貼った順に最初に住所が見つかったものを採用する。
- 画像: 全URL分の取得画像を1つのプール(`sourceImageUrls`)に集約する。取得時の自動切り捨てをやめ、一時的に上限(10枚)を超えても一覧表示は可能とし、保存(登録submit/編集commit)時にvalidationで10枚超をエラーにして、ユーザーに手動で減らすよう促す。新規登録・編集どちらも同じ挙動に統一する。
- 動画: 引き続き1物件1本まで。追加URLが動画付きツイートで、既に動画を保持している場合はその動画部分だけ拒否(該当URL欄を震わせる+トーストで「動画は1本までのため、この投稿の動画は追加されませんでした」を表示)し、画像部分は通常通り追加する。
- 重複URL: 同一URL文字列が既に追加済みの場合は追加せず、トーストでエラー表示する。
- 「元の投稿を見る」ボタン: 単一ボタンのまま、クリックでドロップダウン(または小モーダル)を開き、貼った全URLを一覧表示して選んで開く。
- UI上への上限の明記: 「画像は最大10枚まで」「動画は最大1本まで」を登録・編集フォームに常時表示する(現状どこにも表示されていないため新規追加)。
- 登録ページ: URL登録欄をデフォルトで前面に出し、直接アップロードは「画像をアップロードして登録する」リンクの先に折りたたむ。展開前に「アップロードすると画質が圧縮されて劣化します。動画は使用できません。URLでの登録をおすすめします」という案内を表示する。
- 編集ページ: 上記と同じ画面構成(メインパネル+折りたたみ)に統一する。開いた瞬間にどちらのパネルが見えているかは、その物件が**今使っている方式**(`imageMode`)に従う(URL方式の物件はURL欄が最初から展開、アップロード方式の物件はアップロード欄が最初から展開)。アップロード方式の場合も「URLに変えると画質が上がります」という案内は常に表示する。既存の「貼り直すと全部差し替え」は廃止し、登録ページと同じ「追加」方式に統一する。

### 含まない(別プロジェクトへ切り出し)

- Twitter動画のプロキシコスト対策(CFエッジキャッシュ導入・YouTube誘導強化等)。ユーザー要望で「絶対に0にしたい」と最優先扱いになっているが、本設計とは独立したタスクとしてTODO.mdに記録し、別途brainstormingする。
- 投稿削除の生存監視(cron)を複数URL全部に広げること。今回は`sourcePostUrls[0]`(= 従来の1本目・住所の情報源)のみ監視を継続する。2本目以降のURLの投稿が後から削除されても自動検知・自動更新はしない(既知の制限として許容、実害が出た場合に別途対応)。

## データモデルの変更

- `HousingListing`(`src/types/housing.ts`)に新フィールド`sourcePostUrls?: string[]`を追加する(貼った順、最大5件)。
- 既存の`postUrl`(単数)は後方互換のため引き続き保持し、`sourcePostUrls[0]`と同値にする(1番目のURL = 住所の情報源 = cron監視対象、という位置づけを維持)。
- `tweetId`/`youtubeVideoId`/`videoUrl`/`videoPosterUrl`/`videoAspectRatio`は引き続き単数のまま(動画は1本までのため変更不要)。
- `sourceImageUrls`/`sourceImageAspectRatios`は既存のまま(全URL分の画像がここに集約される、配列の構造自体は変更なし)。
- 既存データ(`sourcePostUrls`未設定)は表示側で `sourcePostUrls ?? (postUrl ? [postUrl] : [])` のフォールバックで扱う。データ移行スクリプトは不要。

## 登録・編集フローの変更

1. URL入力欄の下に「+ URLを追加」ボタンを置く。押すたびに新しい入力欄が増える(最大5個、5個目に達したらボタンを非表示/disabledにする)。
2. 各URL欄は独立してfetch状態(loading/success/error)を持つ。1つのURLの取得が失敗しても他のURLの処理は継続する(部分失敗を許容し、全体をブロックしない)。
3. 住所抽出: 各URLのfetch結果(本文テキスト)に対して既存の`parseHousingFromText`/`extractHousingAddressFromPage`を呼び、URLを貼った順に最初に住所が見つかったものを採用する新しいマージ関数を追加する。
4. 画像マージ: 各URLから取得した画像を`sourceImageUrls`に追加していく(既存の`photos.slice(0,10)`のような即時切り捨てはやめる)。合計が10枚を超えた状態でも一覧表示は可能とし、保存時のvalidationで10枚超をエラーとして弾く。
5. 動画マージ: 既に動画を保持している状態で追加URLが動画付きツイートだった場合、その動画部分(`videoUrl`等)は無視して画像部分だけ`sourceImageUrls`に追加する。該当URL欄に震えアニメーション+トーストでエラーを表示する。
6. 重複URL: 同一URL文字列の再追加はエラートーストで拒否する。

## 「元の投稿を見る」UI

- 詳細ページの「元の投稿を見る」は単一ボタンのまま、クリックでドロップダウン(または小モーダル)を開き、`sourcePostUrls`を順番に列挙する。各項目の表示文言(「投稿1」「投稿2」等、あるいは取得元サイト名)は実装時に確定する。

## URL登録の推奨導線

- 登録ページ: `RegisterSectionMedia`をリライトし、URL入力(+複数追加UI)を常時表示、直接アップロード(`HousingRegisterImageField`)は「画像をアップロードして登録する」リンク/トグルの先に折りたたむ。展開前に注意文言を表示する。
- 編集ページ: `HousingEditMediaModeTabs`によるタブ切り替えの代わりに、同じ「メインパネル+折りたたみ」構成に統一する。初期表示パネルは`listing.imageMode`に従う。

## 生存監視(cron)の扱い

- 既存の`lastTweetCheckAt`ベースの死活監視は`sourcePostUrls[0]`(= 従来の`tweetId`/`postUrl`)のみを対象に継続する。2本目以降のURLの投稿が削除されても自動検知・自動非表示化はしない。

## テスト方針

- 複数URL分をループして住所を探すマージ関数のユニットテスト(住所が2番目のURLにしかない場合・どのURLにも無い場合を含む)。
- 画像マージ+10枚超過時のvalidationエラーのユニットテスト。
- 動画競合時(2本目以降に動画があるケース)の「動画だけ無視・画像は追加」の単体テスト。
- 重複URL拒否の単体テスト。
- 登録/編集フォームの「URLを追加」ボタンのUIテスト(最大5個で追加不可になることを含む)。
- 既存の単一URLリスティング(`sourcePostUrls`未設定)の後方互換表示テスト。

## リスク・影響範囲チェック

- 影響ファイル: `src/types/housing.ts`、`src/utils/housingValidation.ts`、`src/lib/housing/parseHousingFromText.ts`・`extractHousingAddressFromPage.ts`(複数ソースマージ関数を新設)、`src/components/housing/pages/RegisterPage.tsx`(`SnsCapture`/`buildDraftImageFields`のマージロジック拡張)、`src/components/housing/register/RegisterSectionMedia.tsx`(複数URL入力+折りたたみUI)、`src/components/housing/register/HousingRegisterSnsUrlField.tsx`(複数インスタンス化 or 内部ループ化)、`src/components/housing/edit/HousingEditSourcePanel.tsx`・`HousingEditMediaSection.tsx`(追加方式への統一+折りたたみUI共通化)、`src/lib/housingApiClient.ts`、`api/housing/_registerListingHandler.ts`・`_updateListingHandler.ts`、`src/components/housing/listing/HousingDetailContent.tsx`(「元の投稿を見る」ドロップダウン化)。
- 既存の単一URL物件(現在104件以上が本番稼働中)への影響: データ移行不要(フォールバックで対応)。表示・編集とも壊れないことを実機で確認する。
- Twitter動画コスト対策は本設計のスコープ外(別途TODO.md参照)。
