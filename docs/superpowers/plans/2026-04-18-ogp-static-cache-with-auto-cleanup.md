# OGP 画像の静的キャッシュ + 自動クリーンアップ実装計画

作成日: 2026-04-18
ステータス: 未着手（実装待ち）
推定工数: 3 時間

---

## 背景・経緯

### 元の問題
X (Twitter) で OGP 画像カードが表示されない。Discord では出る。

### 既に実施済みの修正（このセッション内で 4 commit デプロイ済み）
1. **commit `461023e`**: OGP URL に `&showLogo=true` 付与（Firestore に logoBase64 ある時）
2. **commit `675b1ca`**: クエリパラメータ順序を統一（モーダルとサーバーで一致）
3. **commit `6dd7249`**: showTitle 永続化、サーバー側プリウォーム、favicon バンドル化、共通 URL ビルダー
4. **commit `c35cc3c`**: robots.txt で `/api/og` を許可
5. **commit `9ee744e`**: og:url を共有 URL に修正
6. **commit `628f526`**: logoHash で OGP URL に内容バージョン付与（ロゴ更新時の CDN 陳腐化対策）

### しかし X で画像が出ない問題は未解決
- 直前のテスト（LoPo 公式アカウント、shareId `pb3WUuqC`）でも summary card のみ表示
- 推定原因: X の robots.txt キャッシュ残留 or `/api/` プレフィックスの嫌厭

### 採用した最終解決策（本計画）
**Lazy 生成 + Firebase Storage 永続キャッシュ + Vercel Cron 自動クリーンアップ**

参考記事: https://zenn.dev/shouki1484/articles/x-ogp-firebase-storage

---

## アーキテクチャ

### 完成形の流れ
```
ユーザー操作                    内部動作
───────────                  ───────────
共有モーダル開く ── POST ──→  shareId 発行 + imageHash 計算（画像はまだ作らない）
                              　Firestore に share doc 保存（imageHash 含む）
                              　即レスポンス（高速）
                                 ↓
プレビュー表示  ── GET ────→  lopoly.app/og/{hash}.png
                              　 Vercel rewrite → /api/og-cache?h={hash}
                              　 ├─ Storage に画像あり → そのまま配信（数十ms）
                              　 └─ なし → 動的生成 + Storage upload + 配信
                                 ↓
URL コピー → X に貼る
                                 ↓
X クローラー  ── GET ────→  共有ページから og:image = lopoly.app/og/{hash}.png 取得
                              　 Storage HIT → 即配信（モーダル表示時に温まっている）
```

### 主要コンポーネント

| 項目 | 値 |
|---|---|
| OGP 画像保存先 | Firebase Storage `og-images/{hash}.png` |
| 公開 URL | `https://lopoly.app/og/{hash}.png` |
| Vercel rewrite | `/og/:hash` → `/api/og-cache?h=:hash` |
| 生成タイミング | リクエスト時（Lazy） |
| 重複排除 | imageHash = sha256(contentName + planTitle + showTitle + showLogo + logoHash + lang) 先頭 16 文字 |
| クリーンアップ | 週次 Vercel Cron、30 日未使用を削除 |

### URL に hash を出す妥当性
- hash は内容指紋であり、ロゴ実体やプラン詳細を漏らさない
- 推測不可（sha256 ベース）
- 軽微な情報保護として機能

---

## 実装手順（順番厳守）

### Step 1: Firebase Storage rule 設定
**ファイル**: `storage.rules`（リポジトリルートに既存）

`og-images/` パスに対して：
- 読み取り: 全公開
- 書き込み: firebase-admin（サーバー）のみ

```javascript
match /og-images/{hash} {
  allow read: if true;
  allow write: if false;  // クライアントから直接書き込ませない
}
```

サーバーは admin SDK で書き込むため rule をバイパスする。

### Step 2: vercel.json 設定追加

既存の `/icons/` rewrite を参考にしつつ、以下を追加：

```json
{
  "rewrites": [
    { "source": "/og/:hash.png", "destination": "/api/og-cache?h=:hash" },
    // ... 既存
  ],
  "crons": [
    { "path": "/api/cron/cleanup-og-images", "schedule": "0 3 * * 0" }
  ]
}
```

cron schedule: 毎週日曜 03:00 UTC（日本時間 12:00）

### Step 3: imageHash 計算関数（共通）
**ファイル**: `src/lib/ogpHelpers.ts`

```typescript
import { createHash } from 'crypto';  // Node only

export function computeImageHash(opts: {
    contentName: string;
    planTitle: string;
    showTitle: boolean;
    showLogo: boolean;
    logoHash: string | null;
    lang: OgpLang;
}): string {
    const input = JSON.stringify(opts);
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
```

⚠️ **クライアントでも使うか？**
- 現状はサーバーで計算で十分（POST レスポンスでクライアントに返す）
- クライアントで先回り計算したい場合は Web Crypto API（SubtleCrypto）使用
- 工数増になるのでまず**サーバーのみ**で実装

### Step 4: /api/og-cache 新エンドポイント
**ファイル**: `api/og-cache/index.ts`（新規）

擬似コード：
```typescript
export default async function handler(req, res) {
    const hash = req.query.h;
    // hash バリデーション（^[a-f0-9]{16}$）
    // 厳格チェックで SSRF ライクな攻撃を防ぐ

    const bucket = getStorage().bucket('lopo-7793e.firebasestorage.app');
    const file = bucket.file(`og-images/${hash}.png`);
    const [exists] = await file.exists();

    if (exists) {
        // Storage から stream で配信
        // Cache-Control: public, immutable, max-age=31536000
        // Content-Type: image/png
        return file.createReadStream().pipe(res);
    }

    // Storage に無い場合: Firestore から imageHash で参照を引いて生成
    // または share doc に embedded した generation params を使う
    // ↓ 詳細は Step 5 と連動
}
```

### Step 5: /api/share の改修

**POST 時**:
1. これまで通り share doc 作成
2. **追加**: imageHash を計算（contentName, planTitle, showTitle, logoHash 等から）
3. share doc に `imageHash` フィールドを追加保存
4. **追加**: `og_image_meta/{hash}` collection に generation params を保存（idempotent: 既存ならスキップ）
   - これは /api/og-cache が hash から params を引くため
5. **削除**: 既存のサーバー側プリウォーム（commit `6dd7249` で追加）
   - Lazy にしたので不要
   - ただしクライアントのプレビュー fetch でモーダル開いた瞬間にキャッシュ温まる
   - **オプション**: バックグラウンドプリウォーム（fire-and-forget）追加可（X 初回確実性向上）

**PUT 時**:
1. これまで通り logo/showTitle 更新
2. **追加**: 新 imageHash 計算 → share doc 更新 + og_image_meta 保存
3. プリウォーム同上

### Step 6: _sharePageHandler.ts 改修

og:image URL を新形式に切替：

```typescript
// 現状（commit 628f526）
ogImageUrl = buildOgImageUrl(`${ogProtocol}://${ogHost}`, shareId, {
    showTitle, showLogo: hasLogo, logoHash, lang,
});

// 新形式
const imageHash = data.imageHash;
ogImageUrl = `${ogProtocol}://${ogHost}/og/${imageHash}.png`;
```

**後方互換**: 旧 share doc には imageHash が無い → fallback で旧 buildOgImageUrl を使う

### Step 7: ShareModal.tsx 改修

プレビュー画像 URL を `/og/{hash}.png` 形式に切替：
- POST/PUT のレスポンスから imageHash を受け取る
- `<img src={`/og/${hash}.png`}>` に設定

### Step 8: クリーンアップ Cron
**ファイル**: `api/cron/cleanup-og-images/index.ts`（新規）

```typescript
export default async function handler(req, res) {
    // Vercel Cron 認証ヘッダ検証
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).end();
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;  // 30日前
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'og-images/' });

    let deleted = 0;
    for (const file of files) {
        const [metadata] = await file.getMetadata();
        const lastAccessed = new Date(metadata.updated).getTime();
        if (lastAccessed < cutoff) {
            // 念のため Firestore でも参照確認（任意）
            await file.delete();
            deleted++;
        }
    }
    res.json({ deleted, total: files.length });
}
```

⚠️ 環境変数 `CRON_SECRET` を Vercel に設定する必要あり（ユーザー手動）

### Step 9: Privacy Policy 追記

**ファイル**: i18n の privacy.* キーで現在の文言を確認後、各言語に追加：
- ja: 「共有用 OGP 画像は Firebase Storage に一時的にキャッシュされ、未使用期間が一定経過すると自動削除されます」
- en/zh/ko: 同等の翻訳

⚠️ デザイン変更は伴わないが、文言変更なので **ユーザー承認後** にコミット推奨

### Step 10: 単体テスト追加

`src/lib/__tests__/ogpHelpers.test.ts` に：
- computeImageHash の決定性テスト
- 異なる入力で異なる hash になることのテスト
- 同じ入力で同じ hash になることのテスト

### Step 11: ビルド・型・テスト
```
rtk tsc --noEmit
rtk vitest run
rtk npm run build
```

すべて通過確認。

### Step 12: コミット → push → デプロイ → 本番検証

---

## 制約・注意事項（**最重要**）

### セキュリティ
- ✅ hash パラメータは正規表現 `^[a-f0-9]{16}$` で厳密バリデーション（SSRF 類縁攻撃防止）
- ✅ Storage rule で og-images/ への直接書き込みを禁止
- ✅ クライアントは hash を改ざん・推測できない（サーバーで計算）
- ✅ Cron エンドポイントは CRON_SECRET で認証
- ✅ **シークレット・個人情報・管理者識別子をコード／コミットメッセージ／ドキュメントに含めない**

### 既存機能の破壊回避
- ✅ 旧 share doc（imageHash なし）でも従来の `/api/og?...` URL で動作する **後方互換** を維持
- ✅ /api/og 自体は削除しない（既存の旧シェア用に残す）
- ✅ 既存の robots.txt 設定（commit c35cc3c）は維持
- ✅ 既存の og:url 修正（commit 9ee744e）は維持

### ハードコーディング禁止
- Storage バケット名は環境変数または既存パターン参照（既に `lopo-7793e.firebasestorage.app` 使用中）
- ホスト名検証は既存 `resolveOgOrigin` パターンを再利用

### 検証必須
- デプロイ後 curl で 4 通り全パターン（showTitle × showLogo）の URL 動作確認
- Discord と LinkedIn Post Inspector で OGP 取得テスト
- Twitterbot UA で /og/{hash}.png が 200 OK 返すこと
- 旧 share URL（vZZBuNup 等）が壊れていないこと

---

## ロールバック計画

何か壊れた場合：
1. **即座に**: vercel.json の rewrite と cron を削除して push（旧動作に戻る）
2. **/api/og は temporary に残す**ので og:image 旧 URL 経路は生きている
3. Firestore の imageHash フィールドは残しても問題ない（読まれなければ無害）
4. Firebase Storage の og-images/ 配下を手動削除（必要なら）

---

## コスト試算（再掲）

### 容量（Firebase Storage Spark 無料 5GB）
- MAU 100、1人平均 3 画像 → 30 MB
- MAU 1,000、1人平均 5 画像 → 500 MB
- MAU 10,000、1人平均 5 画像 → 5 GB（要対策）

→ **MAU 数千〜1万まで完全に無料枠内**

### 関数実行時間（Vercel Hobby 100 GB-Hr/月）
- 1 共有作成: 1 GB-Sec（軽量化済み、画像生成は Lazy）
- 1 画像生成: 5 GB-Sec（コールドスタート時）
- 100 共有/日 + 50 ユニーク画像/日 = 100 + 50×5 = 350 GB-Sec/日
- 月: 10,500 GB-Sec ≈ 3 GB-Hr → 3% 消費

→ **余裕**

---

## 引き継ぎチェックリスト（次セッション開始時）

- [ ] このファイル読了
- [ ] `docs/TODO.md` の「現在の状態」確認
- [ ] このセッションの最後 6 コミット確認 (`rtk git log -7 --oneline`)
- [ ] 本番状態確認: `curl -s https://lopoly.app/share/pb3WUuqC | grep og:image`
  - 期待: `?id=pb3WUuqC&showLogo=true&lh=3b760e0cb2bbc01c&lang=ja` 形式が出ること
- [ ] writing-plans skill or subagent-driven-development skill で着手
- [ ] Step 1 から順番に実施
- [ ] 各 Step 完了ごとに git commit（atomic commit 推奨）
- [ ] 全 Step 完了後、本番検証（プライベート X アカウント → LoPo 公式の順）
