# YouTube概要欄からの住所自動入力 設計書 (2026-08-17)

## 背景と目的

ハウジング投稿(登録ページ/編集ページ/一時ツアークイック追加パネル)にYouTube動画のURLを貼ると、現状は動画IDからサムネイルURLを組み立てて物件画像として使うだけで、概要欄のテキストは一切取得していない。X(Twitter)・OGP対応サイト(housingsnap等)は既に投稿本文/ページテキストから住所(DC/サーバー/エリア/区画/サイズ)を自動抽出しているが、YouTubeだけこの恩恵がない。

FF14ハウジングを紹介するYouTube動画には、概要欄にゲーム内住所を書いているケースが一定数ある(ユーザー発案 2026-08-15)。この自動入力をYouTubeにも対応させる。

## 確定済みの決定(ユーザー合意・2026-08-17)

| 論点 | 決定 |
|---|---|
| 対象範囲 | 登録ページ(`RegisterPage`)・編集ページ(`HousingEditSourcePanel`)・一時ツアークイック追加パネル(`EphemeralAddPanel`)の3箇所すべて |
| 住所抽出ロジック | 新規実装しない。既存の`parseHousingFromText`(ツイート本文用の汎用テキスト抽出)をそのまま概要欄テキストに適用する。抽出精度のチューニングは対象外(下記「非対象」参照) |
| 概要欄取得方法 | YouTube Data API v3 `videos.list?part=snippet&id=<videoId>`。APIキー取得済み(無料枠1日1万ユニットの範囲で運用、費用面は問題なし) |
| APIキーの保管場所 | `.env.local`(`YOUTUBE_API_KEY`、VITE_プレフィックスなし=サーバー専用)と`ADMIN_REFERENCE.md`に記載済み。Vercel本番への設定は実装完了・動作確認後に別途行う |
| バックエンド設計 | 既存`api/tweet-meta.ts`と同型の独立Edge Function `api/youtube-meta.ts` を新設する。`api/housing`ルータ(Node runtime・App Check必須)には**入れない** |
| バックエンド設計の理由 | 一時ツアークイック追加パネル(`EphemeralAddPanel`)は未ログインでも使われうる導線のため、App Check不要な匿名アクセス窓口が要る。既存の`tweet-meta.ts`/`og-fetch.ts`/`tweet-video.ts`/`og/index.ts`が全てこの理由でEdge Functionとして`api/housing`ルータの外に独立している前例に倣う。Edge FunctionはVercel Hobbyの「Node関数12個上限」の対象外(既存構成で確認済み)なので、関数数の制約にも抵触しない |
| フロント側の取得フロー | YouTube URL貼付時の挙動を、Twitter/OGPと同じ「ローディング表示 → 取得 → 自動入力 or 失敗表示」のパターンに統一する。現状の「同期的に即座にサムネだけ確定して`onYoutubeFetched`を呼ぶ」処理をやめ、非同期取得(概要欄取得)の完了を待ってから`onYoutubeFetched`を1回だけ呼ぶ形に変更する |
| 失敗時の扱い(方針) | 「API取得自体の失敗(動画非公開・クォータ超過・通信エラー等)」と「取得はできたが概要欄に住所が書かれていなかった」を**区別しない**。どちらも「description が null/空」として同じ経路(`parseHousingFromText('')`相当)に合流させ、UIは1種類の案内のみ表示する。理由=ユーザーから見て原因を区別する意味がなく、実装もシンプルに保てるため |
| 登録ページ・編集ページの失敗UI(新規追加) | 現状はTwitter/OGPも含め完全に無言(住所欄が空のまま何も表示されない)。今回、一時追加パネルの既存文言と同等の案内を登録ページ・編集ページにも追加する。**対象はYouTubeだけでなくTwitter/OGPも含む全SNSソース**(3画面の挙動を統一するため、ユーザー判断で範囲拡大) |
| 登録/編集ページでの表示条件 | 既存の`applyExtractedResult`が`fills.length === 0`(=1項目も自動入力できなかった)の場合にのみ表示する。既存の「`ambiguity`があっても area/ward/plot/size 等の一部項目は入る」という現状の寛容な挙動自体は変更しない(下記「非対象」参照) |
| 一時追加パネルの失敗UI | 表示自体は変更なし(既存の`housing.ephemeral.parse_error`をそのまま使う)。YouTube専用のハードコード分岐(常に`setParseError(true)`)を撤去し、tweet/OGPと同じ`applyParse`(`gotSomething`/`ambiguity`判定)経路に統合する |
| キャッシュ | `/api/youtube-meta`のレスポンスは`Cache-Control: s-maxage=3600, max-age=3600, stale-while-revalidate=86400`(1時間、概要欄は頻繁に変わらないため)。`max-age`を明記しないとVercelがクライアント応答から`s-maxage`を除去してしまう既知の罠があるため、必ず両方書く(`.claude/rules/api-caching.md`) |
| レート制限・キルスイッチ | 既存`applyRateLimitWeb`(tweet-metaと同水準)と`rejectIfPublicApiDisabledWeb()`をそのまま流用する |

## 現状の実装(前提知識)

- `src/utils/youtube.ts` `parseYouTubeId` — 各種YouTube URLから動画ID(11文字)を抽出する純関数。**変更不要**。
- `src/lib/housing/snsUrlRouting.ts` `classifySnsUrl` — URL種別判定。`'youtube'`ケースは`postUrl`/`ogImageUrl`(サムネURL)/`videoId`を返す。**変更不要**(URL判定自体はそのまま)。
- `src/components/housing/register/HousingRegisterSnsUrlField.tsx:146-159` — `case 'youtube':` が同期的に`YoutubeFetchedData`を組み立てて即座に`onYoutubeFetched`を呼んでいる箇所。ここに非同期フェッチ(`useYoutubeFetch`相当)を追加し、`useTweetFetch`/`useOgpFetch`と同じ`useEffect`ディスパッチパターンに変更する。`onFetchStatusChange`(ローディング状態を親へ伝える仕組み)も同様に組み込む。
- `src/lib/housing/useTweetFetch.ts` / `src/lib/housing/useOgpFetch.ts` — 新設する`useYoutubeFetch`フックのテンプレート(`status`/`data`/`errorCode`/`fetch関数`/`cancel`/`reset`の形)。ただし本機能では失敗時にerrorCodeを細分化する必要はない(上記「失敗時の扱い」参照)。
- `src/components/housing/pages/RegisterPage.tsx` — `applyExtractedResult`(623-686行、`fills.length===0`で無言return)と`handleYoutubeFetched`(788-810行、現状descriptionを扱っていない)。descriptionを`applyExtractedAddress`に渡す変更+`fills.length===0`時の失敗フラグ管理を追加する。
- `src/components/housing/edit/HousingEditSourcePanel.tsx` — RegisterPageと対になる編集ページ側の同種ハンドラ。同様の変更が必要。
- `src/components/housing/browse/EphemeralAddPanel.tsx:164-170` — YouTube専用のハードコード分岐(`setParseError(true)`固定、フェッチ自体を試みていない)。ここを他ソースと同じ`applyParse`呼び出し経路に統合する。
- `api/tweet-meta.ts` — 新規`api/youtube-meta.ts`の直接のテンプレート(Edge Function・タイムアウト・レート制限・キルスイッチ・エラーステータスの型をそのまま踏襲)。
- `src/lib/housing/parseHousingFromText.ts` — 概要欄テキストにもそのまま適用する。**変更不要**。

## 変更が必要な範囲

### 1. 新規: `api/youtube-meta.ts`(Edge Function)
`tweet-meta.ts`と同型。`?videoId=<11文字ID>`を受け取り、YouTube Data API v3 (`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=<videoId>&key=<YOUTUBE_API_KEY>`)を叩いて`snippet.description`のみを抽出して返す(`{ description: string | null }`)。動画が存在しない/非公開/APIエラー/タイムアウトの場合は全て`description: null`を返す(HTTPステータスでエラーを細分化する必要はない。呼び出し元は成功/失敗を問わずdescriptionの有無だけを見る)。`applyRateLimitWeb`・`rejectIfPublicApiDisabledWeb`を適用。

### 2. 新規: `src/lib/housing/useYoutubeFetch.ts`
`useTweetFetch`/`useOgpFetch`と同型のフック。`fetchYoutubeMeta(videoId)`→`/api/youtube-meta?videoId=...`を呼び、`{status, data, fetchYoutubeMeta, cancel, reset}`を返す。

### 3. 変更: `HousingRegisterSnsUrlField.tsx`
`'youtube'`ケースを非同期化。`postUrl`/`ogImageUrl`/`videoId`確定後に`fetchYoutubeMeta(videoId)`を呼び、成功時(`useEffect`)に`{postUrl, ogImageUrl, videoId, description}`の形で`onYoutubeFetched`を1回だけ呼ぶ。ローディング中は`onFetchStatusChange`経由で既存のスケルトン表示に乗せる。i18nに新規ローディング文言(例: 「動画情報を読み取り中…」)を追加。

### 4. 変更: `RegisterPage.tsx`
- `YoutubeFetchedData`型に`description`フィールドを追加(呼び出し元の型定義側)。
- `handleYoutubeFetched`で`data.description`を`applyExtractedAddress`に渡す(Twitterの`handleTweetFetched`が`data.text`を渡しているのと同じパターン)。
- `applyExtractedResult`に「`fills.length===0`のとき失敗フラグを立てる」処理を追加(新規state、例: `addressExtractFailed`)。このフラグはユーザーが住所を手編集した時点でクリアする(既存の`addressConfirmed`リセットと同じタイミング)。
- 失敗フラグが立っている間、住所セクション付近に新規i18nメッセージ(一時追加パネルの`parse_error`と同等の文言)を表示する。表示位置・スタイルはハウジング独自トンマナ(`.claude/rules/housing-design.md`、色付きalert箱を避けグレー文字の静かな注記)に従う。

### 5. 変更: `HousingEditSourcePanel.tsx`
RegisterPageと同様の変更(型追加・`handleYoutubeFetched`でdescription伝搬・失敗フラグ・表示)。

### 6. 変更: `EphemeralAddPanel.tsx`
- `useYoutubeFetch`を導入し、`'youtube'`ケースをtweet/ogpと同じ「fetch開始→成功時に`applyParse(parseHousingFromText(description ?? ''))`」パターンに統合する。
- 164-170行の`setParseError(true)`固定処理を撤去。

### 7. i18n(5言語: ja/en/ko/zh/zh-Hant)
- YouTube取得中のローディング文言(新規キー)。
- 登録/編集ページ用の「読み取れませんでした」文言(新規キー、`housing.ephemeral.parse_error`と同内容を`housing.register.snsUrl`配下に追加)。

## 非対象・据え置き事項

- `parseHousingFromText`本体の抽出精度改善(タイトル`【】`部分の除外等の誤爆対策)は別タスク。今回は一切手を入れない。ブレスト中に発見した既知の誤爆パターン(実在サーバー名と同じ単語が別文脈で使われると`multipleServer`/`multipleDc`判定で全項目が空になる)は、辞書側の不変条件で誤爆を防ぐ既存方針([[feedback_no_speculative_alias_data]])を維持し、個別対応はしない。
- 登録ページ/編集ページの「`ambiguity`があっても area/ward/plot/size 等の一部項目は入る」という既存の寛容な挙動を、一時追加パネル水準(`ambiguity`があれば全項目拒否)まで厳格化することは今回はやらない。既存のTwitter/OGP経由の動作を変える意味を持つため、影響範囲が広く別スコープとする。
- Vercel本番環境変数`YOUTUBE_API_KEY`の設定作業。実装完了・ローカル動作確認後にユーザーと一緒に行う。

## テスト方針(実装計画で詳細化)

- `useYoutubeFetch`フックの単体テスト(成功/失敗/ローディング状態遷移、`useTweetFetch`のテストと同型)。
- `api/youtube-meta.ts`のハンドラテスト(成功・動画なし・APIエラー・レート制限・キルスイッチ、`tweet-meta`系のテストがあれば参考にする)。
- `RegisterPage`/`HousingEditSourcePanel`: YouTube URL貼付→概要欄取得成功→住所自動入力、のケースをmock fetchで追加。`fills.length===0`時に失敗表示が出るケース、Twitter/OGPでも同様に失敗表示が出るケースを追加。
- `EphemeralAddPanel`: 既存のtweet/ogp向け`parse_error`テストと同型でYouTubeケースを追加(住所ありの概要欄→自動入力、住所なし→`parse_error`表示)。
- `parseHousingFromText`自体への変更はないため既存テストは無改修。
