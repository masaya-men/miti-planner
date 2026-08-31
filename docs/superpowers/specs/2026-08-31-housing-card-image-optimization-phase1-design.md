# ハウジング カード画像の最適化 Phase 1 — 設計書

- 作成日: 2026-08-31
- ステータス: 設計確定 → 実装計画へ
- 種別: architectural(画像派生パイプライン新設 + カード表示コントラクトの変更 + 既存データのバックフィル)
- 関連: `docs/.private/2026-08-31-housing-card-broken-image-glyph-ios.md`(調査ログ) / `docs/TODO.md`「現在の状態」

---

## 1. 背景と目的

### 症状(実機報告 2026-08-31)

iPhone Safari で `/housing`(探すページ)の一覧カードに、**画像自体は表示されているのに
青い「?」(iOS の壊れた画像プレースホルダ)が重なって出る**ことがある。直接アップロード画像の
物件で起きやすい。断続的。加えて masaya から「スマホも PC も一覧の読み込みが遅い」との指摘。

### 原因(確度高・調査で特定)

**カード画像が表示サイズに対して桁違いに大きく、iOS Safari のデコード済み画像メモリ上限を
超えて Safari が画像を捨て、壊れ glyph を出している。**

1. **画像が 1920×1080**(`src/lib/housing/imageCompression.ts` の `TARGET_MAX_WIDTH_OR_HEIGHT = 1920`)。
   カードの実表示幅はスマホで約 198〜360px。線形で約 6〜10 倍、デコードメモリで約 12〜16 倍の過剰。
   1920×1080 の RGBA デコードは 1 枚あたり約 8MB。
2. **ambient スライドショー(`HousingCardAmbientSlideshow`)が全フレームを常時 `<img>` マウント**。
   直接アップロード物件は最大 4 枚 → 1 カードで main + 4 = 5 枚、うち frame[0] は main と同一 URL
   (二重デコード)。→ 1 カードで約 33MB デコード。
3. **一覧が仮想化されていない**(`ListingGrid` は `listings.map()` で全件 DOM 化。現在 232 件)。
4. `content-visibility:auto` + `contain-intrinsic-size:0 205px` は `.housing-listing-card` に
   既に入っている(調査で確認)が、**iOS Safari は 18.0 未満でこれを完全無視**する。

調査で潰した仮説:全画像 URL は HTTP 200・正しい content-type で返る(404 ではない)。
`thumbnailPaths` に空文字列は無い(`<img src="">` バグではない)。
Cloudflare Image Resizing は無効(`/cdn-cgi/image/...` が 404)。

### 目的

カード画像を表示サイズに見合った大きさで配信し、iOS の「?」と、スマホ/PC 双方のロード遅延を
解消する。

---

## 2. 確定済みの方針判断(brainstorming 2026-08-31)

| 論点 | 決定 | 理由 |
|---|---|---|
| 小型化の方式 | **作り置き**(アップロード時に派生生成 + 既存バックフィル)。画像 CDN(Cloudflare Images 等)は使わない | 月額固定費を増やさない LoPo の運用方針。数百件規模なら作り置きで十分 |
| フォーマット | **WebP のみ**(AVIF は作らない) | メインの効果は 1920px→数百px の約 85% 削減。その上の AVIF 2〜3 割は誤差。`<picture>` 不要で実装が素直 |
| X(Twitter)画像 | **直リンクのまま + カード表示時に `?name=small`(680px)**。サーバーにコピーしない | 「元ツイートが消えたら SNS 連動物件も自動削除」が既定方針(`api/cron/check-sns-tweets` + `api/housing/_purgeIfTweetGoneHandler`)。画像をコピーすると「ツイートは消えたのに画像だけ残る」矛盾が生じる |
| ぼかしプレースホルダ | **Phase 1 に入れる。直接アップロード画像の代表 1 枚のみ** | 「理想的」に一番近い。SNS 画像は上記方針でハッシュを持つ意味が薄く、対象外 |
| 一覧の仮想化 / ページネーション | **Phase 2 送り**(本設計に含めない) | Phase 1 デプロイ後に実機で測ってから要否を判断。スクロール復元・NEW リボン検知の作り直しが絡むため分離 |

---

## 3. スコープ

### やること(Phase 1)

1. 直接アップロード画像(`imageMode='thumbnail'`)に **480px / 960px 幅の WebP 派生**を追加生成
   (アップロード時 + 既存 74 件のバックフィル)。
2. **ThumbHash** による代表画像 1 枚のぼかしプレースホルダ(生成 + 保存 + カード表示)。
3. カード・詳細ページの画像を **`srcset` / `sizes`** 配線(直接アップロード分)。
4. X 画像に **`?name=small`** をカード表示コンテキストでだけ付与。
5. ambient スライドショーを **frame[0] 除外 + 3 枚窓**に変更。二重デコード解消。
6. カード画像 `<img>` に `decoding="async"`。
7. バックフィルで欠けている `.png` 兄弟も再生成(TODO「新規 listing で og:image 404 の恒久対策」を同梱)。

### やらないこと(Phase 2 以降)

- 一覧の仮想化(react-window 等)
- 一覧 API(`api/housing/public?action=gallery`)のページネーション
- SNS 画像のぼかしプレースホルダ(fetch-hash-discard 方式)
- AVIF 派生
- モバイルで ambient スライドショー / 動画を止める判断(見た目の変更・要相談)
- `content-visibility` 周りの変更(既に設定済み)

---

## 4. セクション1:派生画像の生成・保存・バックフィル

### 4.1 派生サイズ

各対象画像につき **480px 幅** と **960px 幅** の WebP を追加生成する。
元画像(長辺 ≤ 1920px・クライアントが `imageCompression.ts` で圧縮済・現状のまま)は残し、
`srcset` の最大候補(1920w)兼 ライトボックス拡大表示のソースとして使う。

カード実表示幅の想定:2 カラム時 約 198px、1 カラム(狭いスマホ)時 約 360px、PC 中央列 約 240px。
DPR 2〜3。→ 実ピクセル要求は概ね 400〜1080px。480/960 + 元(1920)の 3 候補でカバーできる。

### 4.2 保存形式・命名

Firestore スキーマは変更しない。`thumbnailPaths` は元画像 URL のまま。**派生 URL は
文字列加工で導出する**(既存の `.png` 兄弟と同じ方式)。

- 元: `housing/listings/{listingId}/{uuid}.webp`
  → 公開 URL `https://lopoly.app/housing-media/{listingId}/{uuid}.webp`
- 派生: 同ディレクトリの兄弟ファイル `{uuid}-480.webp` / `{uuid}-960.webp`
- Storage メタデータは元と同じ(`cacheControl: 'public, max-age=31536000, immutable'`)

純関数ヘルパー(サーバー / クライアントで**同一規則・パリティテストで担保**):

- サーバー: `api/housing/_imageArrayLogic.ts` に `toDerivativePath(path, width)` を追加
  (`toPngSiblingPath` の隣)。
- クライアント: `src/lib/housing/housingMediaUrl.ts` に `housingImageVariant(url, width)` を追加。
  `lopoly.app/housing-media/` ドメインかつ `.webp` のときだけ加工。それ以外(X 画像・旧
  `firebasestorage.googleapis.com` URL・`.png`)は**素通し**。

### 4.3 容量見積もり

1 画像あたり追加 ≈ 480w(約 30KB)+ 960w(約 90KB)= 約 120KB。
74 件 × 平均 2.5 枚 ≈ 185 枚 → **合計 約 22MB**(Firebase Storage 無料枠 5GB の約 0.4%)。
配信量(通信料)はむしろ**減る**(小さい画像を配るため)。

### 4.4 生成する場所

**アップロード時**(`api/housing/_uploadThumbnailHandler.ts`):
既に「webp 本体を Storage 保存 → `.png` 兄弟を並行保存」している箇所に、
480w / 960w WebP の生成・保存を追加する。`sharp` は `_imageFormatConvert.ts` で導入済み。
`sharp(buf).resize(width, null, { withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()`。

**既存分**(バックフィルスクリプト `scripts/backfill-listing-card-derivatives.ts` 新設):
- 前例: `scripts/backfill-listing-thumbnail-png.ts` / `scripts/migrate-housing-images-to-cf-cache.ts`。
- `housing_listings` の `imageMode == 'thumbnail'` かつ `deletedAt == null` を走査。
- 各 `thumbnailPaths[]` の元画像を Storage から読む → 480w/960w WebP を生成・保存。
- 同時に、`.png` 兄弟が欠けていれば再生成(`toPngSiblingPath` / `convertToPngIfNeeded`)。
- 代表画像(`thumbnailPaths[0]`)から `coverThumbHash` を計算し Firestore 更新(セクション2)。
- `--dry-run`(既定)で対象件数・生成予定を表示。`--apply` で実行。冪等(既存派生はスキップ、
  `.exists()` 確認)。最後に「全 N 件 / 生成 M 枚 / 失敗 0」のサマリを出す。

### 4.5 信頼性(重要)

表示側が `srcset` で派生 URL を参照するため、**派生が 1 枚でも欠けるとブラウザがそれを選んで
404 → 壊れた画像**になる(ブラウザは srcset 候補の 404 を他候補にフォールバックしない)。

対策:

- **アップロード時の派生生成を必須(失敗したらアップロード 400/500 で失敗)に格上げ**する。
  現状 `.png` 兄弟は best-effort(非致命)だが、これも必須化する。
  リスク: `sharp` が異常画像で失敗 → アップロード失敗。ただし `sharp` のリサイズは実質失敗せず、
  クライアントが既に正常な WebP を生成した後なので現実的リスクは低い。
- **2 段階リリース**(セクション4):バックフィル全件成功を検証してから表示側をデプロイする。

---

## 5. セクション2:ぼかしプレースホルダ(ThumbHash)

### 5.1 対象

直接アップロード画像の**代表画像 1 枚だけ**(`thumbnailPaths[0]` = カードに最初に出る画像)。
スライドショー 2 枚目以降・X・YouTube は対象外。

### 5.2 ライブラリ

`thumbhash`(npm・約 2KB・依存なし・Node / ブラウザ両対応)。BlurHash より出力が小さく
(約 25 バイト)、アスペクト比を内包する。

### 5.3 データモデル

`housing_listings` ドキュメントに新フィールド:

```
coverThumbHash?: string   // ThumbHash の base64(約 40 文字)。無ければぼかし無し。
```

公開窓口の射影(`src/lib/housing/publicListingProjection.ts` の `SAFE_FIELDS` /
`api/housing/_publicWindow.ts` の `SELECT_FIELDS`)に `coverThumbHash` を追加する
(住所非公開の射影と同じ二重許可リスト。漏れると窓口に出ない ―― NEW リボン固定機能で
実際に踏んだ罠)。`galleryAdapter` / `MockListing` 型にも伝播。

### 5.4 生成(サーバー側)

`_uploadThumbnailHandler.ts` で `imageIndex === 0` のとき:
`sharp(buf).resize(100, 100, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })`
→ `rgbaToThumbHash(w, h, data)`(`thumbhash`)→ base64 → Firestore の該当 update に含める。
バックフィルでも既存 74 件分を計算。

**生成失敗は非致命**(ハッシュ無し = 従来どおり背景色 → 画像。表示は壊れない)。

### 5.5 表示(カード側)

- `HousingCardAmbientSlideshow` を包む `.housing-listing-card-media` の背後に、
  `thumbHashToDataURL(hash)`(約 100 バイトの PNG data URI)を `background-image` にした
  レイヤーを敷く。
- メイン `<img>` は `onLoad` で不透明化(`opacity` トランジション 0→1)、ぼかしを覆う。
- `coverThumbHash` が無い listing(X / YouTube / 旧データ / 生成失敗)は従来どおり
  `--housing-card-thumb-bg` 背景色。
- `thumbHashToDataURL` はカードごとに 1 回・`useMemo` で。画面外カードは `content-visibility` で
  そもそも評価されない。

---

## 6. セクション3:表示側の変更

### 6.1 派生 URL 導出ヘルパー(3a)

セクション 4.2 の `housingImageVariant(url, 480|960)`。サーバー側 `toDerivativePath` と
パリティテスト(`.webp`→`-480.webp`、X 画像 / `.png` / 旧 URL は素通し)。

### 6.2 X 画像の縮小(3b・URL 加工のみ・保存なし)

純関数 `twitterImageVariant(url, 'small' | 'orig')` を `src/lib/housing/` に新設:

- `pbs.twimg.com/media/xxxxx.jpg`(または `.jpg?...`)形式 → `?name=small` を付与(既存 query は
  マージ)。実測 680px / 約 46KB。
- `pbs.twimg.com/amplify_video_thumb/...` や `img.youtube.com/...` 等の別形式は**そのまま返す**
  (`name` が効かなくても実害なし)。
- **カード表示コンテキストでだけ**適用。詳細ページの拡大表示は元 URL(1200px)のまま。

### 6.3 カードの画像描画(3c・`ListingCard` + `HousingCardAmbientSlideshow`)

**メイン `<img>`**(`representativeImage()` の結果):
- 直接アップロード(`housing-media` webp)なら
  `srcset="{480w} 480w, {960w} 960w, {original} 1920w"` + `sizes`。
  `sizes` の目安: `(max-width: 519px) 100vw, (max-width: 767px) 50vw, 240px`
  (2 カラムの分岐は `--housing-listing-card-min-w: 198px` × 2 + gap ≈ 実測で調整)。
- X 画像なら `src` に `twitterImageVariant(url, 'small')`。
- `decoding="async"` を追加。既存の `onError`(YouTube フォールバック)は維持。

**二重デコードの解消**:
現在メイン `<img>` と スライドショー frame[0] が同一ファイルを二重デコードしている。
スライドショーは **frame[0] を描画対象から外す**。スライドショーは「1 番目以降のフレーム」だけを
クロスフェード対象にし、サイクルが 0 に戻るタイミングでは全フレームを `opacity:0` にして
背後のメイン `<img>` を見せる。frame が 1 枚だけ(= [0] のみ)の listing はスライドショー自体を
描画しない(現状の `frames.length === 0` early-return と同じ扱いに実質統合)。

**スライドショーのフレーム窓**:
`frames.map()` で全マウント → 表示 index を中心に `{index-1, index, index+1}`(mod n)の
最大 3 枚だけマウント。クロスフェードは 2 枚で成立するが、退場フレームのフェードアウトを
保つため 3 枚。n ≤ 3 のときは全部(挙動不変)。各フレームにも `srcset` / X 加工 /
`decoding="async"`。

### 6.4 詳細ページ(3d・`HousingPhotoGallery`)

- サムネのストリップ: 480w 派生 / X は `?name=small`。
- メインの大きい画像(非拡大): 960w 派生 / X は元 URL(1200px)。
- ライトボックス(拡大)時: 元サイズ(直接アップロードは 1920px 元画像、X は元 URL)。

### 6.5 `content-visibility`(3e)

**変更なし。** `.housing-listing-card` に `content-visibility:auto`(`ListingCard` の inline style)
+ `contain-intrinsic-size:0 205px`(`housing.css`)が既に入っている。iOS<18 が無視する点は
画像の小型化自体でカバー。

---

## 7. セクション4:テストとロールアウト

### 7.1 テスト(vitest)

**純関数**:
- `housingImageVariant()` / サーバー側 `toDerivativePath()` — パリティテスト
  (`.webp`→`-480.webp` / `-960.webp`、X 画像・`.png`・旧 `firebasestorage` URL は素通し)
- `twitterImageVariant()` — `pbs.twimg.com/media/*` だけ加工 / `amplify_video_thumb` ・
  YouTube は素通し / 既存 query とのマージ / `orig` 指定
- `resolveSlideshowFrames` + スライドショー窓ロジック — frame[0] 除外 / 3 枚窓 / n≤3 で全表示 /
  n=1 でスライドショー非描画
- ThumbHash — サーバー生成(sharp → rgba → `rgbaToThumbHash`)、クライアント
  `thumbHashToDataURL` の呼び出しと `useMemo`

**アップロードハンドラ**(既存テスト拡張):
- 480w / 960w 派生 + `.png` 兄弟が保存される
- 派生生成が失敗したらアップロードが失敗する(非致命 → 致命への格上げの回帰)
- `imageIndex === 0` のとき `coverThumbHash` が Firestore update に含まれる
- `imageIndex !== 0` のとき `coverThumbHash` は触らない

**バックフィルスクリプト**:
- `--dry-run` で対象件数・生成予定を出す(書き込みゼロ)
- `--apply` で生成 + `coverThumbHash` 保存 + 欠けた `.png` 再生成
- 冪等(再実行で「変更なし」・既存派生は `.exists()` でスキップ)
- 末尾サマリ「全 N 件 / 生成 M 枚 / 失敗 0」

**公開窓口の射影**:`coverThumbHash` が `SAFE_FIELDS` / `SELECT_FIELDS` 経由で
window レスポンスに出ることの回帰テスト。

### 7.2 実機確認(masaya・自動テスト不可)

- iPhone で探すページをスクロール → 「?」が出ないこと / ぼかし → シャープの演出
- PC でも一覧の初回ロードが軽いこと
- 詳細ページの画像・サムネ・拡大表示が正常
- 直接アップロードで新規登録 → カードが正しく出る(派生 URL 参照)
- X 取り込み物件のカードも正常(`?name=small`)

### 7.3 ロールアウト(2 段階・順序厳守)

1. **サーバー先行デプロイ**:アップロードハンドラの派生生成 + `coverThumbHash` + 公開窓口の
   射影追加。以降の新規アップロードは派生あり。表示側は**まだ元 URL を参照**(この時点で挙動不変)。
2. **バックフィル実行**:`scripts/backfill-listing-card-derivatives.ts --apply`。既存 74 件。
   全件成功・失敗 0 を確認。
3. **表示側デプロイ**:`srcset` / X の `?name=` / スライドショー窓 + frame[0] 除外 / ぼかし表示。
   ここで初めてカードが派生 URL を参照する。バックフィルが 100% 終わっているので参照先は必ず存在。

ロールバック:3 を戻せば元の挙動(元画像を直参照)に戻る。派生ファイル・`coverThumbHash` が
残っても無害。

---

## 8. 影響ファイル(想定)

**サーバー / API**:
- `api/housing/_uploadThumbnailHandler.ts` — 派生生成追加・`.png` 必須化・`coverThumbHash` 保存
- `api/housing/_imageArrayLogic.ts` — `toDerivativePath()` 追加
- `api/housing/_imageFormatConvert.ts` — 必要なら WebP リサイズヘルパー追加
- `api/housing/_publicWindow.ts` — `SELECT_FIELDS` に `coverThumbHash`
- `src/lib/housing/publicListingProjection.ts` — `SAFE_FIELDS` に `coverThumbHash`

**クライアント lib**:
- `src/lib/housing/housingMediaUrl.ts` — `housingImageVariant()` 追加
- `src/lib/housing/twitterImageVariant.ts`(新規)— `twitterImageVariant()`
- `src/lib/housing/slideshowFrames.ts` / `useHousingCardFrames.ts` — frame[0] 除外の扱い
- `src/lib/housing/representativeImage.ts` — 参照(srcset 用に元 URL も返せるように)
- `src/lib/housing/galleryAdapter.ts` — `coverThumbHash` の伝播
- `src/data/housing/mockListings.ts`(型 `MockListing`)/ `src/types/housing.ts`(`HousingListing`)
  — `coverThumbHash?: string`

**コンポーネント**:
- `src/components/housing/browse/ListingCard.tsx` — メイン `<img>` の srcset / X 加工 /
  `decoding` / ぼかしレイヤー / `onLoad` フェード
- `src/components/housing/workspace/HousingCardAmbientSlideshow.tsx` — 3 枚窓 + frame[0] 除外
- `src/components/housing/listing/HousingPhotoGallery.tsx` — サムネ 480 / メイン 960 / 拡大は元
- `src/styles/housing.css` — ぼかしレイヤー / `onLoad` フェードのスタイル(トークン経由)

**スクリプト**:
- `scripts/backfill-listing-card-derivatives.ts`(新規)

**依存追加**:
- `thumbhash`(npm)

---

## 9. 未解決事項

なし(すべて brainstorming で確定済み)。`sizes` の分岐 px はグリッド実測に合わせて実装時に微調整。
