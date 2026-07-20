# ハウジング登録: 画像アップロード上限バグ + 投稿URL消失バグ 修正設計書

- 日付: 2026-07-20
- 対象: `/housing` 登録画面 (`src/components/housing/pages/RegisterPage.tsx` および `src/components/housing/register/HousingRegisterImageField.tsx`)、サーバー側 `api/housing/_uploadThumbnailHandler.ts` ほか
- 発端: 実ユーザー報告「画像を9枚登録したが1枚しか表示されない」+「投稿URLを貼ったのに詳細ページに元の投稿へのリンクが出ない」
- 詳細調査ログ: `docs/.private/2026-07-20-housing-image-upload-4-limit-bug.md`

## スコープ

本設計書は **Batch 1 (画像まわりのバグ修正 + 登録画面の作り直し)** のみを対象とする。
**Batch 2 (複数投稿URL登録機能)** は完全に別の新機能であり、本設計の対象外。別途あらためて brainstorming → 設計書を起こす。

## 前提: 既に特定・修正済みの根本原因 (このセッション内で対応済み)

1. **原因A (確定的バグ)**: 登録フォームの画像アップロードループが「先頭4枚だけ保存」という約束を守らず、選んだ枚数全部(最大12枚)をサーバーへ送っていた。→ `RegisterPage.tsx` の `performRegister` で `localImages.slice(0, SAVED_IMAGES_LIMIT)` してから送るよう修正済み。**ただし本設計での④の変更(ピッカー自体を4枚に制限)により、この slice は実質的に発火しない防御的なコードになる(害はないため残す)。**
2. **原因B (確定的バグ)**: `register-listing` / `upload-thumbnail` / `check-duplicate` / `can-register` の4ハンドラーが `applyRateLimit` の `scope` を指定しておらず、同一IPの待ち行列を無自覚に共有していた。住所入力のたびに走る重複チェック等が先に消費すると、本来成功するはずの画像アップロードが 429 で弾かれ、保存枚数が不安定になる(「1枚しか残らない」の本命)。→ 4ハンドラーそれぞれに専用 `scope` を追加済み。

この2件はコード修正済み・テスト済みだが、**まだ未コミット**。本設計書の残タスク(④⑤)と合わせて1バッチとしてコミットする。

## 設計

### ④ 登録画面の画像アップロード欄の作り直し

**現状の問題**: 「12枚まで選べるが保存されるのは先頭4枚だけ」という二段構えの仕様が分かりにくく、実際に問い合わせが来た。

**変更内容**:
- `RegisterSectionMedia.tsx` が `HousingRegisterImageField` に渡す `maxImages` を `12` → `SAVED_IMAGES_LIMIT` (4) に変更。ピッカー自体が最初から4枚までしか受け付けない。
- `HousingRegisterImageField.tsx` の `isUsed` 判定(1〜4枚目を強調表示するロジック)と `used_badge` は、上限が4枚になった時点で全アイテムが常に true になり意味を持たなくなるため削除する。**「カバー」バッジ(先頭=代表画像)は維持**する。
- 4枚に達したら追加エリア(ドロップゾーン+ファイル選択ボタン)は今の実装通り非表示になる(`canAddMore = items.length < maxImages` は変更不要)。画像を1枚削除すれば自動的に再表示される。
- **一括で残り枚数を超える選択をした場合**(例: 0枚の状態で9枚まとめて選ぶ、2枚ある状態で5枚まとめて追加しようとする等)、今は無言で先頭何枚かだけ追加してしまう。これを検知し、「わかりました」ボタンで閉じる確認モーダルを表示するようにする。
  - 表示条件: `選択されたファイル数 > 追加可能な残り枚数` のとき。
  - 表示内容(文言は実装時に確定、例): 「◯枚選択されましたが、保存できる画像は4枚までです。先頭◯枚のみ追加しました」
  - トースト(自動で消える)ではなく、明示的にボタンを押して閉じるモーダル。ハウジングのトンマナ(`.claude/rules/housing-design.md` 準拠、honey色・ガラス調は使わず質感A案ベース)、スマホでも崩れないレイアウトにする。
  - 「4枚ちょうど選んで残り0枚」のようにちょうど収まる場合はモーダルを出さない(超過時のみ)。

**このスコープに含めないもの**: 4枚に達した後も追加エリアを表示し続けて常時説明を出す案(先の相談でBを選択・見送り)。

### ⑤ 投稿URL (postUrl) が消えるバグの修正

**現状の問題**: `RegisterPage.tsx` の `buildDraftImageFields` は `localImages.length > 0` のとき `{}` を返し、画像情報だけでなく `postUrl` も含めて何も draft に載せない。さらにサーバー側 `housingValidation.ts` の `buildListingImageFields` も `draft.imageMode === 'sns'` でない限り無条件で `{ imageMode: 'none' }` を返すため、たとえクライアントが `postUrl` を送ってもサーバー側で捨てられる。結果として、投稿URLを貼った後に直接画像を追加すると、詳細ページの「元の投稿を見る」リンクの元になる `postUrl` が完全に失われる。

**変更内容**:
1. クライアント (`buildDraftImageFields`): `localImages.length > 0` のときも、`snsCapture` から取得済みの `postUrl` があればそれを draft に含める(画像関連フィールド `ogImageUrl` / `sourceImageUrls` / `tweetId` / `youtubeVideoId` / `video*` は引き続き含めない = 画像は直接アップロード分を優先する既存方針は変えない)。`imageMode` は `'sns'` にしない(直接画像アップロードの後続処理と競合させないため)。
2. サーバー側検証 (`housingValidation.ts` の `validateImage`): 現状 `imageMode !== 'sns'` の場合は無条件で ok を返しており、`postUrl` の中身を一切検証していない。`imageMode !== 'sns'` でも `postUrl` が存在する場合は、既存の3種類のホスト許可判定(pbs.twimg.com 系/YouTube系/OGP allowlist)のいずれかに一致するかを検証し、どれにも一致しなければ弾く。新しい許可リストは作らず、既存の判定関数をそのまま使い回す。
3. サーバー側保存 (`buildListingImageFields`): `imageMode !== 'sns'` の分岐(= 直接画像アップロードのケース含む)でも、検証済みの `postUrl` があれば `{ imageMode: 'none', postUrl }` として保存する(現状は `postUrl` を含めず `{ imageMode: 'none' }` のみ返している)。
4. 詳細ページ側 (`HousingDetailContent.tsx`) は既に `listing.postUrl` があれば無条件でリンクを出す作りになっており、変更不要。

**セキュリティ上の要点**(前回の質問への回答の実装版): 今回の変更で `postUrl` が「直接画像アップロード」経路でも保存されるようになるため、今まで通っていなかった検証を新しく通す必要がある。これを怠ると、実装ミスにより検証されないままの文字列が「元の投稿を見る」リンクの href としてそのまま使われてしまう経路が生まれる。上記2で必ず塞ぐ。

## テスト方針

- 修正前に失敗するテストを書いてから直す(既存の `RegisterPage.test.tsx` の回帰テストと同じ流儀)。
- `HousingRegisterImageField` の上限4枚化・一括超過時のモーダル表示条件をユニットテストで固定する。
- `buildDraftImageFields` (postUrl 保持)・`validateImage` (host 許可判定)・`buildListingImageFields` (postUrl 保存) それぞれに、localImages+postUrl の組み合わせケースをテスト追加する。
- postUrl の host 検証部分は既存のセキュリティに関わる判定を流用するだけとはいえ、実装後にレビュー(必要なら高性能モデルでのセカンドオピニオン)を挟む。

## 対象外(Batch 2 以降)

- 複数投稿URL登録機能(URL1/URL2/URL3、編集画面からの追加含む) — 別設計書で扱う。
- 編集モードでの画像そのものの編集(方式A: 写真は編集不可)を変更すること — 今回はスコープ外、ユーザー体験として変えるかは別途 brainstorming。
