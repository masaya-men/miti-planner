# ハウジング編集ページ: 画像編集(差し替え・削除・並び替え・登録方法切り替え) 設計書

- 日付: 2026-07-20
- 対象: `src/components/housing/pages/RegisterPage.tsx` / `HousingEditPage.tsx`、`src/components/housing/register/*`、`api/housing/_uploadThumbnailHandler.ts`、`api/housing/index.ts`
- 発端: 同日発見・修正した画像品質バグ3件(解像度極小化/PNG画質劣化/カバー画像消失)により、既に保存されている画像の中に画質が悪い/欠けているものが実在する。しかし編集ページには写真を編集する手段が一切ない(「方式A」= 編集時は写真セクション自体を非表示にする設計)ため、ユーザー自身では直せない。brainstormingを経てこの設計書に至った。

## 経緯・調査で判明したこと

- URL経由(`imageMode==='sns'`)の画像は、実は**登録時点で既に**個別削除・ドラッグ並び替えの機能が実装済みだった(`HousingRegisterSourceImageUrlsField`)。欠けているのは「編集ページでこの画面自体を開けないこと」。
- 直接アップロード(`imageMode==='thumbnail'`)側には同等の機能がなく、こちらは新規実装が必要。
- 「画像とURLを同時に持たせる」は、一覧カード・詳細ギャラリー・動画再生など表示側の約30ファイルが `imageMode` の二択を前提にしており、対応するには表示側の作り直しが必要な規模のプロジェクトと判断。**今回のスコープには含めず、別プロジェクトとして切り出す**(ユーザー合意済み)。
- 「複数投稿URL機能(Batch 2)」も、URL経由モードの中で貼るURLを1本→複数本に増やすだけの拡張であり、今回の「同時に持たせる」の判断とは独立。Batch 2は別途あらためて設計する。

## スコープ

### 含む

1. 編集ページのステッパーに「写真」ステップを復活させる(新規登録画面と同じ位置・同じコンポーネントを再利用)。
2. 直接アップロード画像の: **差し替え**(既存の枠に新しい画像を上書き) / **削除**(削除すると後続の画像が詰めて繰り上がる) / **ドラッグ並び替え**。
3. URL経由画像の: 編集ページでの**並び替え・個別削除**(既存コンポーネントをそのまま再利用) / **URLの再取得**(別の投稿に貼り替え)。
4. **登録方法そのものの切り替え**(直接アップロード⇔URL、どちらか一方を選ぶ。同時持たせではない)。切り替えたら旧方式のデータ(Storageファイル or SNS関連フィールド)をサーバー側でクリーンアップする。
5. 切り替えUI(アップロード/URLタブ)で、URL経由登録を勧める案内文を表示する(圧縮なしで高画質、Twitter連携の場合は元投稿削除で登録も自動削除される、等。正確な文言は実装時に確定・要確認)。
6. 直接アップロード・URLどちらのモードでも「最後の1枚」は削除できないようにする(登録時と同じく最低1枚 or 1URLを必須に保つ)。

### 含まない(別プロジェクトへ切り出し)

- 画像とURLを同時に持たせるモード(表示側の作り直しが必要な大規模プロジェクト。URL推奨がどれだけ浸透するか様子を見てから改めて設計)。
- 複数投稿URL機能(Batch 2)自体。
- 既に保存されている画質の悪い画像の一括修復(本設計で追加する「差し替え」操作をユーザー自身に行ってもらう前提。自動修復はしない)。

## データモデルの変更

現状、直接アップロード画像はStorageの保存パスが `housing/listings/{listingId}/main-{index}.{ext}` のように**位置(index)に直結**している。このままでは「削除して詰める」や「並び替え」のたびにStorage上のファイルそのものを移動する処理が必要になり複雑になる。

**変更**: 保存パスを位置と無関係なランダムID方式 (`housing/listings/{listingId}/{randomId}.{ext}`) に変更する。これにより:

- `thumbnailPaths: string[]` (Firestore) が並び順の**唯一の正典**になる。
- 削除・並び替えは、この配列を書き換えるだけで完結する(Storage側のファイルは実際に消す対象以外は一切触らない)。
- **既存データへの影響なし**: 現行の `main-{index}.{ext}` 形式のパスは、`thumbnailPaths` の中では単なるURL文字列として扱われているため、そのまま動作し続ける。移行スクリプトは不要。

## サーバー側API変更

すべて `api/housing/index.ts` の `?action=` ディスパッチに追加する形で実装し、**新規のVercel関数は作らない**(Hobbyプランの関数数上限を消費しないため)。

1. **`upload-thumbnail`** (既存 `_uploadThumbnailHandler.ts` を修正): 保存ファイル名の生成方法を `main-{index}.{ext}` からランダムID方式に変更する。それ以外の挙動(`index` で指定した配列位置への書き込み、1MB上限、認可等)は変更しない。
2. **`delete-thumbnail`** (新規 `_deleteThumbnailHandler.ts`): Body `{listingId, index}`。該当Storageファイルを削除し、`thumbnailPaths` から該当indexを除去して後続を詰める。`thumbnailPaths.length === 1` の場合は拒否 (400)。認可は既存ハンドラー群と同じ (App Check + 認証 + ownerUid一致 + rate limit)。
3. **`reorder-thumbnails`** (新規 `_reorderThumbnailsHandler.ts`): Body `{listingId, newOrder: string[]}` (並び替え後の完全なURL配列)。`thumbnailPaths` をこの順序で上書き保存する。Storage操作は発生しない(Firestore書き込みのみの軽い処理)。サーバー側で `newOrder` が現在の `thumbnailPaths` と同じ要素集合であることを検証する(不正な差し替えを防止)。
4. **`delete-source-image`** (新規 `_deleteSourceImageHandler.ts`): Body `{listingId, index}`。`sourceImageUrls` から該当indexを除去する。Storage操作は無い(外部URLの参照を配列から外すだけ)。`sourceImageUrls.length === 1` の場合は拒否 (400)。
5. **`reorder-source-images`** (新規 `_reorderSourceImagesHandler.ts`): Body `{listingId, newOrder: string[]}`。`sourceImageUrls` をこの順序で上書き保存する。`reorder-thumbnails` と同じ検証方針(要素集合の一致)。
6. **`update-listing` の拡張 (既存 `_updateListingHandler.ts`)**: **重要な発見**: このハンドラーの冒頭コメントには `imageMode, postUrl, ogImageUrl, thumbnailPath` が「更新可能フィールド」と書かれているが、実際の `updatePayload` 構築コードはこれらを一切書き込んでいない(コメントが実態と乖離した stale な記載)。今回、編集ページで「登録方法の切り替え」「URLの貼り替え」を保存できるようにするには、この乖離を解消し実際に書き込むよう拡張する必要がある。あわせて、送信された `imageMode` が保存済みの値と異なる場合のクリーンアップを追加する:
   - thumbnail→sns: `housing/listings/{listingId}/` 配下のStorageファイルを全削除し、`thumbnailPaths`/`thumbnailPath` をクリアする。
   - sns→thumbnail: `sourceImageUrls`/`ogImageUrl`/`tweetId`/`youtubeVideoId`/`video*` 等のSNS関連フィールドをクリアする(Storage削除は発生しない。外部URLへの参照を消すだけ)。

## クライアント側UI

- `RegisterSectionMedia` を編集モードでも表示する(`RegisterPage.tsx` の `visibleStepIds` からmedia除外条件を撤廃)。
- セクション先頭に「アップロード」/「URL」切り替えタブを置く。タブ選択がそのまま `imageMode` の切り替えを意味する。URL側にはURL経由登録を勧める案内文を添える。
- **直接アップロード側**: 既存 `HousingRegisterImageField` を拡張し、削除ボタン(確認ダイアログ付き)とドラッグ並び替え(`HousingRegisterSourceImageUrlsField` と同じ dnd-kit パターン)を追加する。差し替え/削除/並び替えは**都度サーバーへ即時反映**する(フォーム全体の「保存」ボタンまで待たない)。
- **URL側**: 既存 `HousingRegisterSourceImageUrlsField` をそのまま編集モードで描画する。ただし現状の新規登録モードでの挙動(フォーム submit まで変更をローカルに保留)とは異なり、編集モードでは削除・並び替えを `delete-source-image` / `reorder-source-images` へ即時接続する。URLそのものの貼り替え(新しい投稿への差し替え)は `update-listing` 経由で保存する。
- 直接アップロード・URLどちらも「最後の1枚」は削除ボタンをdisabledにする。

## 設計判断: 画像操作は即時反映(フォーム保存とは独立)

住所/タイトル等の他フィールドは、従来通り「保存」ボタンを押すまでサーバーに送らない。しかし写真の差し替え・削除・並び替えは、ボタンを押した瞬間にサーバーへ反映する(Storage/Firestore操作を伴うため、そもそも「保留」にする設計が複雑になる)。これは編集ページ限定の挙動であり、新規登録フォームでの画像選択(submitまでローカル保持)とは意図的に異なる。

## テスト方針

- サーバー: `delete-thumbnail` / `reorder-thumbnails` のユニットテスト(正常系・最後の1枚保護・他人のlistingへの操作拒否・不正な `newOrder` の拒否)。既存 `_uploadThumbnailHandler.test.ts` 等のテストパターンを踏襲する。
- クライアント: 削除確認モーダル・並び替え操作・モード切替UIのユニットテスト(vitest)。
- 実機確認(ユーザー依頼): 直接アップロード⇔URL切り替えの往復・削除で詰まることの目視・並び替えの目視。

## リスク・影響範囲チェック

- 既存の `upload-thumbnail` 呼び出し元(`performRegister` の新規登録時アップロード)への影響: `index` 指定の挙動は変わらないため無影響。保存されるファイル名がランダムIDになるだけ。
- `update-listing` の呼び出し元は確認したところ `RegisterPage.tsx` (`useHousingUpdate` 経由) の1箇所のみ。画像関連フィールドの書き込みを追加しても既存の他呼び出しに影響しない。
- Storageコスト: 変化なし(削除処理が追加される分、むしろ不要ファイルが残らなくなり改善方向)。
- Vercel関数数: 既存ルータへの追加のみのため増加しない。
- 影響を受ける既存テスト: `RegisterPage.test.tsx` の「mode=edit ではCheckPanelに画像行が出ない」「mode=edit では確認セクションに画像枚数の要約行を出さない」等、方式Aを前提にしたテストは今回の変更で前提が変わるため、実装時に見直しが必要。
