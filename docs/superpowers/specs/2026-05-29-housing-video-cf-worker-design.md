# ハウジング動画プロキシの Cloudflare Worker 移設 設計書

> 合意日: 2026-05-29 / ブレインストーミングで合意済 / ユーザーは本書未読のまま実装承認（非エンジニアのため作業用ドキュメントとして作成）

---

## 1. 背景と問題

### 真因（外部状態 — コードから導けない事実）

- Vercel 無料枠の **Fast Origin Transfer（迅速なオリジン転送）が 6.9GB / 10GB（69%）**、1 日約 2GB 増。100% で**プロジェクト自動停止（サイトダウン）**。逼迫しているのはこの 1 項目のみ。
- 真因は **Twitter 動画プロキシ `api/tweet-video.ts`**（Vercel Edge Function）。動画は `video.twimg.com` の Referer gate により**必ずサーバー中継が必要**で、再生のたびに動画バイトが Vercel の Origin Transfer を消費する。

### コストを 3 層に分解（重要）

| 層 | 中身 | LoPo 現状 | コスト | 問題か |
|---|---|---|---|---|
| ① リスト情報 | URL・タイトル・タグ | Firestore（サーバー） | テキストで極小 | ✕ 無害 |
| ② 画像 | 写真 | `<img src=pbs.twimg.com>` 直リンク | サーバー素通り＝ゼロ | ✕ 無害 |
| ③ Twitter 動画 | mp4 | **Vercel 中継** | **課金対象** | **◎ 唯一の犯人** |
| YouTube 動画 | iframe | `youtube-nocookie.com/embed` | サーバー素通り＝ゼロ | ✕ 無害（後述） |

→ 解決すべきは ③ のみ。**レバーは「③ の中継を Vercel → Cloudflare に移す」こと 1 点**。

### なぜ Cloudflare で無料になるか

Cloudflare は Workers/Pages の外向き転送（egress）を**従量課金しない**設計（課金はリクエスト数・CPU 時間）。booklage（マイコラージュ／Allmarks）が同じ大量動画を抱えながら ¥0 運営できているのはこのため（booklage は丸ごと Cloudflare Pages に乗っており、動画プロキシも Pages Functions として CF エッジで実行：`functions/api/tweet-video.ts`）。

### 参考実装（別リポジトリ、結合せずパターン流用）

- `C:\Users\masay\Desktop\マイコラージュ\functions\api\tweet-video.ts` — CF Pages Function 版の動画プロキシ。allowlist・UA 偽装・Range 透過・`Cache-Control: public, max-age=86400, s-maxage=86400`。Cache API も Cache Rule も `_routes.json` も使わず、ヘッダーだけで CF 任せ。
- 同 `functions/api/tiktok-video.ts` — 同型（LoPo では未使用）。

---

## 2. スコープ

### 対象

- **Twitter 動画（`video.twimg.com`）のプロキシのみ**を Cloudflare Worker に移設する。

### 対象外（理由付き）

- **YouTube 動画**: LoPo は `youtube-nocookie.com/embed/` の iframe で表示しており（`src/components/housing/workspace/HousingCardVideoOverlay.tsx:47`、`src/components/housing/listing/HousingPhotoGallery.tsx:124`）、動画バイトは YouTube → 視聴者へ直接流れ **LoPo サーバーを通らない**。サムネも `img.youtube.com` 直リンク（`src/lib/housing/youtubeUrl.ts:69`）。`api/` に YouTube プロキシは存在しない。**既にコストゼロ＝変更不要**。
- **①リスト情報・②画像**: 変更不要（上表）。
- **LoPo 本体（`lopoly.app`）の Vercel 構成**: 一切触らない。DNS only のまま。

---

## 3. アプローチ決定

### 採用：案①「動画専用サブドメインを Cloudflare Worker 化」

- `media.lopoly.app`（仮）という**動画専用サブドメインだけ**を Cloudflare 経由（orange-cloud）にし、Worker を割り当てる。
- apex `lopoly.app` は **DNS only のまま据え置き** → 本体（軽減表・Firestore・auth・他 API）への影響リスクゼロ。
- 動画バイトは Twitter → Cloudflare → 視聴者で流れ、**Vercel を 1 バイトも通らない** → ③ の Vercel Origin Transfer が完全にゼロ化。

### 不採用：案②「apex を CF 前段化 + Cache Rule で Vercel 応答をキャッシュ」

- キャッシュ HIT は無料だが **MISS（初回・期限切れ）は必ず Vercel を通る**＝完全ゼロにならない。
- ドメイン全体を CF 経由にするため SSL Full(strict) 等、本体に影響。
- hotfix21 で踏んだ **Range × キャッシュの地雷**（mp4 の moov box が壊れ再生不能）を CF 層で踏み直すリスク。
- → ユーザー目標（Allmarks 並みのコストほぼゼロ）を満たすのは案①のみ。

---

## 4. アーキテクチャ

```
[Before]
ブラウザ ──► lopoly.app/api/tweet-video (Vercel Edge) ──► video.twimg.com
                         ▲ 動画バイトが Vercel を通過（課金）
[After]
ブラウザ ──► media.lopoly.app (Cloudflare Worker) ──► video.twimg.com
                         ▲ Vercel を一切通らない（CF egress 無料）
   lopoly.app 本体は Vercel のまま（DNS only、無変更）
```

---

## 5. コンポーネント

### 5.1 Cloudflare Worker（動画中継）

- 現行 `api/tweet-video.ts` のロジックを移植：
  - allowlist `video.twimg.com` のみ（open proxy 化防止）
  - `User-Agent: Mozilla/5.0 (compatible; LoPo/1.0)`（独自 UA だと `video.twimg.com` が Range 無視で ~18KB しか返さない事象を実機確認済 → 偽装必須）
  - Range ヘッダー透過、upstream の `Content-Range`/206 をそのまま中継
  - CORS：`Access-Control-Allow-Origin: *`、`Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges`
  - **OPTIONS preflight 応答**（現行 Vercel 版 `api/tweet-video.ts:27` にあり。別ドメイン化で frame 抽出 `<video crossOrigin=anonymous>` の Range fetch が preflight を要求しうるため必須）
  - タイムアウト 30s、エラーマッピング（404→404 / その他→502 / timeout→504）
- **キャッシュ**：v1 は booklage と同型（`Cache-Control: public, s-maxage=86400` + Range 透過、CF 任せ）。egress は無料なので主目的は Twitter 取得回数の削減と低レイテンシ。
- 配布：`wrangler` でデプロイ。`wrangler.toml` を Worker 用に新設（booklage の Pages 構成とは別物）。

### 5.2 クライアントの差し替え（ハードコーディングしない）

現在 URL が 3 箇所にベタ書き：

| ファイル | 用途 |
|---|---|
| `src/components/housing/workspace/HousingCardVideoOverlay.tsx:22` | カード ambient `<video>`（crossOrigin なし、再生のみ） |
| `src/components/housing/listing/HousingPhotoGallery.tsx:110` | 詳細ギャラリー `<video controls>`（crossOrigin なし） |
| `src/lib/housing/useTweetVideoFrames.ts:76` | フレーム抽出 src（`extractVideoFrames.ts:59` で `crossOrigin='anonymous'`） |

- **対応**：単一ヘルパー（例 `buildTweetVideoProxyUrl(videoUrl: string): string`）に集約し、3 箇所を置換。ベース URL を 1 箇所で切替可能にする（ロールバック容易化）。
- **テスト追従**：`src/__tests__/housing/HousingCardVideoOverlay.test.tsx:18`、`src/lib/housing/__tests__/useTweetVideoFrames.test.tsx:38` が `/api/tweet-video?url=` 文字列を assert しているため、ヘルパー経由に合わせて更新。

### 5.3 CORS / フレーム抽出の整合

- 再生用 `<video>`（overlay・gallery）：crossOrigin 属性なし。クロスオリジン再生は CORS 不要なのでそのまま動く。
- フレーム抽出用 `<video>`：`crossOrigin='anonymous'`（既設）+ Worker が `ACAO:*` 返却 + OPTIONS 応答 → クロスオリジンでも canvas が tainted にならず `toDataURL` 成立。**要実機検証**。

### 5.4 安全装置（ロールバック）

- 現行 Vercel 版 `api/tweet-video.ts` は**削除しない**。ヘルパーのベース URL を `/api/tweet-video` に戻すだけで即フォールバック可能。
- 止血スイッチ `GALLERY_AMBIENT_ENABLED`（`src/lib/housing/HousingPlaybackContext.tsx`、現在 `false`）を `true` に戻すのは Worker 経路の検証が全部通ってから。

---

## 6. 役割分担

- **Claude（コード）**：Worker 本体 + `wrangler.toml` + クライアントヘルパー + 3 箇所置換 + テスト更新 + デプロイ実行。
- **ユーザー（Cloudflare ダッシュボード、手順は Claude が用意）**：`wrangler login`（ブラウザ承認 1 回）/ `media.lopoly.app` を Worker のカスタムドメインに割当（数クリック or wrangler 設定の確認）。

---

## 7. コスト

- CF 帯域：無料。
- CF Worker リクエスト：無料枠 **10 万 req/日**、超過時は **月 $5 固定（1000 万 req/月込み）**。
- 動画は Range で細切れリクエストするため、人気次第で無料枠超過の可能性 → ただし「青天井で怖い Vercel 帯域 → 予測できる極小固定費」への転換。**実必要枠は実装/計画段階で見積もる**。

---

## 8. 検証計画（実機）

1. `media.lopoly.app` 経由で動画が再生・シークできる（mp4 冒頭 moov box が届く、Range 正常）。
2. フレーム抽出（カードサムネ生成）がクロスオリジンで成立する（canvas `toDataURL` が throw しない）。
3. 再視聴で `cf-cache-status: HIT`（`curl -I` で確認）。
4. Vercel の Fast Origin Transfer 増加が止まる。
5. `GALLERY_AMBIENT_ENABLED=true` 復帰後もギャラリー ambient が崩れない。

---

## 9. 未検証・要注意（実装/計画で潰す）

- **未検証①（Range × キャッシュ）**：CF が Range を正しく Vary してキャッシュするかコードから断定不可。まず素直な形（booklage 同型）で組み実機検証 → 壊れたらキャッシュの持ち方を調整（例：Range なし full のみキャッシュ等）。関連: `reference_vercel_edge_range_cache`（Vercel で踏んだ地雷の記録）。
- **未検証②（別ドメイン frame 抽出）**：preflight / CORS の実機確認。
- **要確認**：`wrangler` でカスタムドメイン割当まで完結できるか、ダッシュボード操作が要るか。

---

## 10. 参照

- LoPo 現行プロキシ: `api/tweet-video.ts`
- 差し替え対象: `src/components/housing/workspace/HousingCardVideoOverlay.tsx:22` / `src/components/housing/listing/HousingPhotoGallery.tsx:110` / `src/lib/housing/useTweetVideoFrames.ts:76`
- frame 抽出: `src/lib/housing/extractVideoFrames.ts:59`
- 止血: `src/lib/housing/HousingPlaybackContext.tsx`
- 参考実装: `C:\Users\masay\Desktop\マイコラージュ\functions\api\tweet-video.ts`
- 関連 memory: `project_cloudflare_caching_priority` / `reference_vercel_edge_range_cache` / `reference_allmarks_mycollage` / `feedback_housing_external_url_direct`
