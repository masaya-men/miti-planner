# ハウジンガーページ OGPカード 作り込み 設計書 (2026-07-31)

## 背景と目的

`docs/.private/2026-07-23-housing-task-inventory.md` 以来の残タスク「OGPカードのデザイン作り込み(ハウジンガー+ツアー招待URLの両方、LoPoのハウジングからの共有と一目でわかるブランド感へ品質最大化)」の実装設計。

brainstormingの結果、**ツアー招待カードは現状のまま完成**と確定(このドキュメントの対象外)。**ハウジンガーページのOGPカードのみ**を全面的に作り直す。

繁体字(台湾)対応 全5フェーズ([[project_housing_taiwan_server_scoping]])のpush・デプロイは、本タスクを含む「大発表バッチ」完了後にまとめて行う方針(ユーザー方針: 部分公開は望まない)。

## 確定済みの決定

| 論点 | 決定 |
|---|---|
| 対象 | ハウジンガーページ(`/housing/housinger/:uid`)のOGPカードのみ。ツアー招待カードは対象外 |
| 代表作の選び方 | ハウジンガー本人がマイページで**手動選択**(最大10件)。何も選ばなければ表示順(新着順)の上位10件を自動採用。ランダム選択・Allmarks連携はいずれも不採用(理由は§7) |
| カード全体の背景 | 代表作1個目(マイページで最初に選んだもの、既定なら一覧の一番上)を**大きく拡大・強くぼかして**カード全面(1200×630、四辺まで)に敷く |
| カード内パネル | LoPoハウジングの意匠(ガラスパネル・ハニーゴールド装飾)のパネルを1枚、ヘッダー・フッターなしで重ねる |
| パネル中央 | ハウジンガーのアイコン(実画像・WebPも正しく表示)+名前+紹介文(一言)+「Shared via LoPo Housing」等の英語表記 |
| パネル内グリッド | 代表作1個目をパネル右下に大きめ(ぼかさず)にもう一度表示、残り9個を上4・下4・余り1で配置 |
| 選べる物件の条件 | 公開(`visibility: public/unlisted` かつ非非表示)かつ**住所非公開でない**物件のみ選択可。それ以外を選ぼうとした場合は「公開物件のみ選択できます」のエラートーストを表示 |
| 物件0件のハウジンガー | パネル+中央テキストは同じ、グリッドなし。背景は既存のツアー招待カード用背景(`src/assets/og/tour-invite-bg.jpg`)をそのまま流用 |
| 動画のみ登録の物件 | 選択対象に含める。背景・グリッド表示とも保存済みのポスター画像(Twitter動画の`videoPosterUrl`、YouTubeはサムネURLを都度組み立て)を使う |
| 更新タイミング | 既存の仕組み(内容が変わった時だけ画像を作り直し、キャッシュを使い回す)を維持。紹介文・アイコン・代表作選択の変更いずれも対象に含める |

## 現状の実装(前提知識)

- `api/share/_housingerPageHandler.ts`: ページ表示のたびに実行。プロフィール+公開listing上位10件を読み、`buildHousingerOgCardParams`でパラメータを組み立て→`computeOgCardImageHash`でハッシュ化→`og_image_meta`に保存→`${origin}/og/{hash}.png`をog:imageに設定。**画像そのものを作る重い処理はここでは行わない**(hashの計算とFirestore書き込みのみ)。
- `/og/{hash}.png`: `api/og-cache`がFirebase Storageを確認し、無ければ`api/og?type=housinger`(Edge Function)を叩いて生成→Storageに保存。**同じhashが初めて要求された時の1回だけ**実際の画像生成(satoriレンダリング)が走る。
- `src/lib/ogpHousingerCard.ts`(`buildHousingerOgCardParams`): 現在は`name`/`avatarUrl`/`imageUrls`(最大3枚)のみをハッシュ対象にしている。**紹介文(bio)は現状ハッシュにもカード画像にも含まれていない**(ogTitleのdescriptionとしてHTML側にのみ使用)。
- `api/og/_housingerCard.ts`: 1200×630、濃紺背景。アバター+名前のヘッダー行+画像最大3枚の均等分割グリッドのみ。WebP/AVIF画像はマジックナンバー判定で弾かれる(satori自体がラスタデコード非対応のため)。
- `src/types/housing.ts:188`ほか: `videoUrl`/`videoPosterUrl`/`videoAspectRatio`は既存フィールド。ただし`_housingerPageHandler.ts`の`listingRepresentativeImage()`はこれらを一切見ておらず、動画のみの物件(`imageMode: 'none'`)は現状カードから除外されている。
- `scripts/generate-tour-invite-bg.mjs` / `api/og/_tourInviteBg.generated.ts`: `src/assets/og/tour-invite-bg.jpg`を正典としてbase64埋め込みする既存の仕組み。物件0件フォールバックで再利用する。

## 変更が必要な範囲

### 1. データモデル

- `housing_profiles/{uid}`に新フィールドを追加(仮称 `ogRepresentativeListingIds: string[]`、最大10件、順序付き。先頭=背景兼ヒーロー)
- 未設定 or 空配列の場合は、既存と同様に公開listing新着順の上位10件を自動採用(フォールバック)

### 2. マイページ 選択UI

- マイページの物件一覧カード(左上が空いている)に、タップ/クリック可能な丸型トグルを追加
- 選んだ順序をそのまま代表作の順序として保持(1番目=背景兼ヒーロー)。11件目以降を選ぼうとした場合の挙動(例: 選択不可+トースト、または末尾を入れ替え)は実装計画で確定する
- 非公開・住所非公開の物件は丸型トグルを非活性にする、または押下時に「公開物件のみ選択できます」のエラートーストを表示
- 一覧の件数表示(「◯件」)近くに、選び方の説明文を追加(例: 「カード左上のチェックで、ハウジンガーページ共有時の画像に使う代表作を選べます」)

### 3. `listingRepresentativeImage`相当のロジック

- `_housingerPageHandler.ts`の物件取得を、`ogRepresentativeListingIds`(あれば)の順序に沿って取得する形に変更(未設定時は現行の新着順上位10件のフォールボックを維持)
- 動画のみの物件(`imageMode: 'none'`だが`videoPosterUrl`または`youtubeVideoId`がある)からも画像を解決できるよう`listingRepresentativeImage()`を拡張
- 選択済みIDが後から非公開・住所非公開・削除になった場合はその場で除外し、残りを詰める(1番目が除外された場合は次点が背景兼ヒーローに繰り上がる)

### 4. `buildHousingerOgCardParams` / ハッシュ

- `bio`(紹介文)をパラメータに追加し、ハッシュ対象に含める(現状は画像に出ないため対象外だったが、今回から画像内に表示するため必須)
- `imageUrls`を最大3→最大10に拡張

### 5. `api/og/_housingerCard.ts` レイアウト刷新

- 背景レイヤー: 代表作1個目の画像を拡大+ぼかしフィルタ(satoriの`filter`は公式にサポート対象。実装時に実レンダリングで最終確認する)、可読性のため暗幕を重ねる(ツアー招待カードの`rgba(10,14,24,0.42)`と同じ考え方)
- パネルレイヤー: ハウジングの意匠トークン(ハニーゴールド`#ffc987`〜`#ffb35a`、ガラスパネル調)でヘッダー・フッターなしの1枚パネル
- パネル中央: アイコン(円形、WebPは事前変換済みPNGを使う。§6参照)+名前+紹介文(1〜2行、長い場合は省略)+「Shared via LoPo Housing」等の英語表記
- パネル内グリッド: 代表作1個目をぼかさず右下に大きめ表示、残り9個を上4・下4・余り1で配置(正確なピクセル割付は実装時に確定)
- 物件0件時: `TOUR_INVITE_BG_DATA_URI`を背景に使い、パネル+中央テキストのみ描画(グリッドなし)

### 6. アバターWebP問題の解消(既存TODO「アバターWebP勢のPNG変換」)

satoriはWebP/AVIFのラスタデコードに対応していないため、現状WebPアバターは弾かれてイニシャル表示にフォールバックしている。今回のカードはアイコンが主役級の要素になるため、**アバター登録・更新時にWebP以外(PNG等)の変換済みコピーを保持する**形で解消する(具体的な変換タイミング・保存先は実装計画で確定)。

## スコープ外(このドキュメントでは扱わない)

以下はユーザーからの指摘で見つかった別件。TODO.mdに個別記録済みで、本タスクとは別に対応する。

- マイページ左下のシェア系ボタンを「ハウジンガー公開」表示の右側へ移動(単純なUI配置変更)
- 他人のハウジンガーページで「…」メニュー(通報系)を開くと画面外に開いて操作不能になるバグ(要systematic-debugging)
- ボタンサイズがページごとにばらばらな件、スマホでの中央配置崩れ、PC版「探す」ページのカード中央配置崩れ

## コストへの影響

既存の「内容が変わった時だけ画像を1回作り直し、以降は使い回す」設計はそのまま維持する。紹介文・アイコン・代表作選択の変更を頻繁に行っても、実際にその状態が誰かに閲覧・シェアされない限り重い生成処理(satoriレンダリング)は走らない。画像取得件数が3→10に増える分、生成が走った際の処理時間はやや増えるが、生成頻度自体は「編集回数」ではなく「閲覧・シェア回数」に比例したままで変わらない。

## Allmarks連携を採用しない理由

「毎回見た目を変えたい」という要望を受けてAllmarks(マイコラージュ)との連携を検討したが、実際にAllmarksのコードを調査した結果、Allmarksも「見るたびに作り直す」のではなく「シェア操作1回につき1回だけクライアント側で生成→以後は固定キャッシュ」という、LoPoの既存方式と同じ発想で低コストを実現していることが判明した。「見るたびに変える」を安く実現する技術的な近道は存在しないため、今回はAllmarks連携を見送り、代表作の手動選択(固定)方式を採用する。Allmarksへの送客導線自体は別途、独立したbrainstormingで検討する。

## 参照

- `src/lib/ogpHousingerCard.ts` / `api/share/_housingerPageHandler.ts` / `api/og/_housingerCard.ts` / `src/lib/ogpImageHash.ts`
- `src/types/housing.ts`(`videoUrl`/`videoPosterUrl`) / `src/lib/housing/tweetMetaExtract.ts`(Twitter poster抽出) / `src/lib/housing/youtubeUrl.ts`(YouTubeサムネイル組み立て)
- `.claude/rules/housing-design.md`(ハウジング独自デザイン規約)
- `docs/.private/2026-07-23-housing-task-inventory.md`(元タスク一覧)
