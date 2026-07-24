# ハウジング物件画像のCloudflareキャッシュ化 設計書

- 日付: 2026-07-24
- 背景資料: `docs/.private/2026-07-23-housing-task-inventory.md`(新アイデア②コスト再チェック)

## 1. 問題

Firebaseコンソールの使用状況で実測したところ、Firebase Storageの送信帯域幅(egress)が2026年7月の請求期間(7/1〜7/24時点)で**17.97GB**。無料枠は月10GBのため、すでに約1.8倍(7.97GB)超過している(超過分は現時点で約100〜150円、増加傾向)。

実データ調査の結果:
- housing_listings 220件中、imageMode='thumbnail'(直接アップロード)は79件、実画像ファイル数は231枚・合計57.62MB。
- imageMode='sns'(URL登録、コスト対象外)は138件で過半数を占める。

原因は `api/housing/_uploadThumbnailHandler.ts` がFirebase Storageの生の公開URL(`https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media`)をそのままFirestoreに保存し、フロントの `<img src>` に使っていること。このURLは `lopoly.app` / `media.lopoly.app` を経由しないため、既存のCloudflare前段化(2026-06-12稼働)の対象外になっている。アップロード時に `cacheControl: 'public, max-age=31536000, immutable'` メタデータは設定済みだが、これは同一ブラウザの再訪問にしか効かず、閲覧者ごとに初回アクセスは必ずFirebase Storage originに到達し課金対象になる。

## 2. 対応範囲

**ハウジング物件のサムネイル画像のみ**(`housing/listings/{listingId}/{uuid}.{ext}`)。

- スキルアイコン(`/icons/*`)は同種の対策(Vercelリライト+Cache-Control)がすでに導入済みで、実機確認(`curl`で`cf-cache-status: HIT`確認、Age 78000秒超)により正常に機能していることを確認済み。対応不要。
- アバター画像(`users/{userId}/avatar.webp`)は対象外。アップロードのたびにファイル名が固定(`avatar.webp`)で上書きされる方式のため、本設計の「一度キャッシュしたら二度と変わらない」前提が成立しない。別途、更新のたびにURLが変わる仕組み(キャッシュバスティング)を設計してから対応する必要があり、優先度を下げて別タスクとする。

## 3. アーキテクチャ

`/icons/:path` と同じパターンを踏襲する。

1. **新しい配信パス**: `lopoly.app/housing-media/{listingId}/{filename}` を新設し、Vercelの `rewrites` で `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/housing%2Flistings%2F{listingId}%2F{filename}?alt=media` へ内部転送する。
2. **Cache-Controlヘッダー**: `vercel.json` の `headers` ブロックに `/housing-media/(.*)` 用のエントリを追加し、`public, max-age=31536000, immutable` を明示する(`.claude/rules/api-caching.md` の通り、Vercelは`s-maxage`をクライアント応答から除去するため`max-age`を必ず書く)。
3. **Cloudflare Cache Rule**: ユーザーがCloudflareダッシュボードで `/housing-media/*` 用のCache Ruleを1件追加する(手動操作、実装フェーズでステップバイステップの手順を提示する)。
4. **新規アップロード時**: `_uploadThumbnailHandler.ts` の公開URL構築ロジックを、新しい `lopoly.app/housing-media/...` 形式に変更する。

一連の流れ: 誰かがある画像を初めて見る → Cloudflareにキャッシュが無い(MISS) → Vercel経由でFirebase Storage originから取得 → Cloudflareにキャッシュされる → 以降は誰が見てもCloudflareのキャッシュから返る(originに到達しない=課金対象外)。

**実装時の注意**: `listingId/filename` のような複数階層パスをVercelの `rewrites` で1パターンとして捕捉し、正しくURLエンコードして Firebase Storage 側の `%2F` 区切りパスに変換できるかは、`/icons/:path`(1階層のみ)の既存パターンと異なる点なので、実装後に必ず実URLで動作確認すること(想定通りに解決しない場合はパターンを調整する)。

## 4. 見つかった依存箇所の修正(重要)

`api/housing/_imageArrayLogic.ts` の `parseStoragePathFromPublicUrl()` は、保存済みURLのホスト名が `firebasestorage.googleapis.com` であることを前提にStorage上のパスを逆算しており、これは以下2箇所で「画像を削除・上書きした際にFirebase Storage側の古いファイルも削除する」処理に使われている:
- `_uploadThumbnailHandler.ts`(同一スロットへの再アップロード時の旧ファイル削除)
- `_deleteThumbnailHandler.ts`(削除操作そのもの)

URL形式を `lopoly.app/housing-media/...` に変更しただけでこの関数を直さないと、この判定が常に失敗し、**Storage側の孤立ファイルが削除されなくなる**(コスト対策のはずが別の形でコストを増やす本末転倒になる)。

対応: `parseStoragePathFromPublicUrl()` を、旧形式(`firebasestorage.googleapis.com`)・新形式(`lopoly.app/housing-media/...`)の両方からStorageパスを復元できるように拡張する。

## 5. 既存データの移行

対象: imageMode='thumbnail' の79件・231枚(旧形式URLのまま)。

### 安全性の前提
本移行は画像ファイル自体には一切触れない(削除・移動しない)。Firestoreに保存されたURL文字列を書き換えるだけであり、**旧形式URLは書き換え後も永久に有効なまま**動作し続ける(Firebase Storageは物理ファイルが存在する限りどちらの形式のURLでも同じ内容を返す)。そのため、移行が万一途中で失敗しても「画像が表示されなくなる」事故は構造的に起こり得ない(最悪でも「旧アドレスのまま=見た目は変わらないが新方式の恩恵をまだ受けていない」状態に留まる)。

### 手順(新規スクリプト、`scripts/` 配下に新設)
1. **ドライラン**: 全79件を走査し、新URLを計算 → 実際にHTTPリクエストして新URLが正しく画像を返すか検証 → Firestoreへの書き込みは一切行わず、結果レポート(成功/失敗件数、失敗した場合は理由)を出力する。
2. **レポートの確認**: ドライラン結果をユーザーに提示し、問題なければ本実行に進む。
3. **本実行**: 1件ずつ、(a) 新URLが正しく解決することを確認 → (b) その1件のFirestoreドキュメントだけを更新、という順で処理する。1件が失敗しても他の78件には影響しない(独立トランザクション)。再実行時は既に新形式になっている件をスキップする(冪等)。
4. 元のStorageファイルは削除・移動しない(=旧URLは触らないので、たとえ移行後に何か問題が見つかっても即座に安全な状態)。

## 6. 効果の検証・証明

1. **切り替え直後**: `curl` で実際のハウジング画像URL(新形式)にアクセスし、`cf-cache-status: HIT`(またはMISS→2回目でHIT)を確認する。`/icons/*` で行ったのと同じ方法。
2. **数日〜1週間後**: Firebaseコンソールの使用状況画面(送信の帯域幅)を再度確認してもらい、無料枠(月10GB)超過が止まっている/大きく減っていることを実測値で示す。これをもって完了とする。

## 7. スコープ外(別タスクとして記録)

- アバター画像のキャッシュ化(別設計が必要)
- URL登録を推奨しアップロードを非推奨にするUX改善案(並行して検討中の別件)
- 30日物理削除cron(2026-07-24、家主削除済み未物理削除が38件確認・別タスクとしてTODO.mdに記録済み)
