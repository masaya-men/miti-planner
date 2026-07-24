# ハウジング物件画像 Cloudflareキャッシュ化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング物件の直接アップロード画像を、`/icons/:path` と同じ仕組み(Vercelリライト+Cloudflareエッジキャッシュ)で配信することで、Firebase Storage の egress 課金(無料枠10GB/月を超過中)を実質ゼロに近づける。

**Architecture:** 新しい配信パス `lopoly.app/housing-media/:listingId/:filename` を追加し、Firebase Storage の生URLへ内部転送する(vercel.json の `rewrites`)。`Cache-Control: public, max-age=31536000, immutable` を明示し、Cloudflare側にCache Ruleを追加してもらう(ユーザー手動)。新規アップロードはこの新URL形式で保存し、既存79件・231枚は安全網付きの移行スクリプトで書き換える。

**Tech Stack:** Vercel Serverless Functions (Node, `api/housing/*.ts`)、Firebase Admin SDK、vitest、TypeScript。

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-07-24-housing-image-cloudflare-cache-design.md`(コミット済み `84f3fb8b`)
- 対応範囲はハウジング物件サムネイル画像のみ(`housing/listings/*`)。アバター・スキルアイコンは対象外。
- **旧形式URL(`firebasestorage.googleapis.com`)は変更後も永久に有効なままにする**。Storage上のファイルは移行時に一切削除・移動しない。
- 既存データへの書き込みは必ず「ドライラン(検証のみ・書き込みなし)→レポート確認→1件ずつ検証しながら書き込み」の順で行う。1件の失敗が他件に波及しない設計にする。
- push前ゲート: `npm run build` と `npm test` の両方が緑であること([[feedback_vercel_tsc_strict]])。
- 本番デプロイ(git push)と、移行スクリプトの本番Firestoreへの実書き込みは、必ずオーケストレーター(このプランを実行するメインセッション)自身が実行する。サブエージェントには「コード作成・ローカルでのdry-run確認まで」を担当させ、本番に影響する2つの操作(push・migrate本実行)は委譲しない。

---

### Task 1: `parseStoragePathFromPublicUrl` を新URL形式にも対応させる

**Files:**
- Modify: `api/housing/_imageArrayLogic.ts`
- Test: `api/housing/__tests__/_imageArrayLogic.test.ts`

**Interfaces:**
- Consumes: なし(既存の純粋関数の拡張)
- Produces: `parseStoragePathFromPublicUrl(url: string): string | null` — 戻り値の型・シグネチャは変更なし。`lopoly.app/housing-media/...` 形式のURLからも Storage パス(`housing/listings/{id}/{file}` 形式)を復元できるようになる。

- [ ] **Step 1: 失敗するテストを書く**

`api/housing/__tests__/_imageArrayLogic.test.ts` の `describe('parseStoragePathFromPublicUrl', ...)` ブロック内に追記:

```ts
  it('新形式(lopoly.app/housing-media/)のURLからもパスを逆算する', () => {
    const url = 'https://lopoly.app/housing-media/abc/x1y2z3.webp';
    expect(parseStoragePathFromPublicUrl(url)).toBe('housing/listings/abc/x1y2z3.webp');
  });

  it('新形式で listingId/filename にスラッシュ以外の記号を含んでいても正しく逆算する', () => {
    const url = 'https://lopoly.app/housing-media/abc-123_ID/a1b2-c3d4.avif';
    expect(parseStoragePathFromPublicUrl(url)).toBe('housing/listings/abc-123_ID/a1b2-c3d4.avif');
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run api/housing/__tests__/_imageArrayLogic.test.ts`
Expected: 追加した2件が FAIL(`parseStoragePathFromPublicUrl` が `lopoly.app` ホストで `null` を返すため)

- [ ] **Step 3: 実装を拡張する**

`api/housing/_imageArrayLogic.ts` の `parseStoragePathFromPublicUrl` を以下に置き換える:

```ts
/**
 * Firebase Storage の公開URL (`_uploadThumbnailHandler.ts` が生成する形式) から
 * バケット内の実パスを逆算する。firebasestorage.googleapis.com 以外のURL
 * (外部SNS画像等) は null を返し、誤って外部リソースを削除対象にしないようにする。
 *
 * 2026-07-24: Cloudflareキャッシュ化に伴い、`lopoly.app/housing-media/:listingId/:filename`
 * 形式 (新形式) からも逆算できるよう対応。旧形式 (firebasestorage.googleapis.com) は
 * 既存データ・ロールバック時のため引き続きサポートする。
 */
export function parseStoragePathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'firebasestorage.googleapis.com') {
      const marker = '/o/';
      const idx = u.pathname.indexOf(marker);
      if (idx === -1) return null;
      const encodedPath = u.pathname.slice(idx + marker.length);
      return decodeURIComponent(encodedPath);
    }
    if (u.hostname === 'lopoly.app') {
      const marker = '/housing-media/';
      const idx = u.pathname.indexOf(marker);
      if (idx === -1) return null;
      const rest = u.pathname.slice(idx + marker.length);
      // rest = "{listingId}/{filename}" (両方ともスラッシュを含まない1セグメントずつ)
      const parts = rest.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
      return `housing/listings/${decodeURIComponent(parts[0])}/${decodeURIComponent(parts[1])}`;
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/housing/__tests__/_imageArrayLogic.test.ts`
Expected: 全件 PASS(既存3件+新規2件)

- [ ] **Step 5: コミット**

```bash
git add api/housing/_imageArrayLogic.ts api/housing/__tests__/_imageArrayLogic.test.ts
git commit -m "feat(housing): parseStoragePathFromPublicUrlを新CFキャッシュURL形式に対応"
```

---

### Task 2: 公開URLを組み立てる関数を新設し、アップロードハンドラーで使う

**Files:**
- Modify: `api/housing/_imageArrayLogic.ts`
- Modify: `api/housing/_uploadThumbnailHandler.ts:139-143`
- Test: `api/housing/__tests__/_imageArrayLogic.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `buildHousingImagePublicUrl(listingId: string, filename: string): string` — Task 3(移行スクリプト)がこの関数を再利用する。

- [ ] **Step 1: 失敗するテストを書く**

`api/housing/__tests__/_imageArrayLogic.test.ts` の import に `buildHousingImagePublicUrl` を追加し、新しい `describe` ブロックを追記:

```ts
describe('buildHousingImagePublicUrl', () => {
  it('listingIdとfilenameから新形式の公開URLを組み立てる', () => {
    expect(buildHousingImagePublicUrl('abc', 'x1y2z3.webp')).toBe(
      'https://lopoly.app/housing-media/abc/x1y2z3.webp',
    );
  });

  it('組み立てたURLはparseStoragePathFromPublicUrlで逆変換できる(往復一致)', () => {
    const url = buildHousingImagePublicUrl('listing-42', 'uuid-abc.avif');
    expect(parseStoragePathFromPublicUrl(url)).toBe('housing/listings/listing-42/uuid-abc.avif');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run api/housing/__tests__/_imageArrayLogic.test.ts`
Expected: FAIL(`buildHousingImagePublicUrl is not defined` 相当のエラー)

- [ ] **Step 3: 実装を追加する**

`api/housing/_imageArrayLogic.ts` の末尾に追記:

```ts
/**
 * ハウジング物件画像の新公開URL (Cloudflareキャッシュ経由) を組み立てる。
 * `parseStoragePathFromPublicUrl` の逆変換に相当。listingId/filenameは
 * どちらもスラッシュを含まない1セグメント前提 (呼び出し元で保証済み)。
 */
export function buildHousingImagePublicUrl(listingId: string, filename: string): string {
  return `https://lopoly.app/housing-media/${listingId}/${filename}`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/housing/__tests__/_imageArrayLogic.test.ts`
Expected: 全件 PASS

- [ ] **Step 5: `_uploadThumbnailHandler.ts` を新URL形式に切り替える**

`api/housing/_uploadThumbnailHandler.ts:32-40` の import に `buildHousingImagePublicUrl` を追加:

```ts
import { parseStoragePathFromPublicUrl, buildHousingImagePublicUrl } from './_imageArrayLogic.js';
```

`api/housing/_uploadThumbnailHandler.ts:139-143` を以下に置き換える(元コード):

```ts
    // 公開 URL を取得 (Firebase Storage の標準形式)
    // bucket 名 + path で signed URL なしの public URL を組み立てる
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      filePath,
    )}?alt=media`;
```

置き換え後:

```ts
    // 公開 URL: Cloudflareキャッシュ経由の新形式 (2026-07-24〜)。
    // filePath = `housing/listings/{listingId}/{uuid}.{ext}` なので
    // ファイル名部分だけを渡す (listingId は既に変数として存在)。
    const fileName = filePath.split('/').pop()!;
    const publicUrl = buildHousingImagePublicUrl(listingId, fileName);
```

- [ ] **Step 6: ビルドが通ることを確認**

Run: `npm run build`
Expected: エラーなく完了(型エラー・未使用import無し)

- [ ] **Step 7: 全テストが通ることを確認**

Run: `npm test`
Expected: 全件 PASS(既存テストに影響がないこと)

- [ ] **Step 8: コミット**

```bash
git add api/housing/_imageArrayLogic.ts api/housing/_uploadThumbnailHandler.ts api/housing/__tests__/_imageArrayLogic.test.ts
git commit -m "feat(housing): 新規アップロード画像をCloudflareキャッシュ経由URLで保存"
```

---

### Task 3: vercel.json に配信ルートとキャッシュヘッダーを追加する

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- Consumes: なし(設定ファイルのみ)
- Produces: `https://lopoly.app/housing-media/:listingId/:filename` というURLが有効になる(Task 5でデプロイ後に実URLで検証)

- [ ] **Step 1: rewrites に追加**

`vercel.json` の `rewrites` 配列内、`/icons/:path` のエントリの直前に追加:

```json
    {
      "source": "/housing-media/:listingId/:filename",
      "destination": "https://firebasestorage.googleapis.com/v0/b/lopo-7793e.firebasestorage.app/o/housing%2Flistings%2F:listingId%2F:filename?alt=media"
    },
```

- [ ] **Step 2: headers に追加**

`vercel.json` の `headers` 配列内、`/icons/(.*)` のエントリの直後に追加:

```json
    {
      "source": "/housing-media/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" },
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    },
```

- [ ] **Step 3: JSON構文が正しいことを確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf-8')); console.log('OK: valid JSON')"`
Expected: `OK: valid JSON` が出力される(構文エラーがあれば `SyntaxError` で失敗する)

- [ ] **Step 4: コミット**

```bash
git add vercel.json
git commit -m "feat(housing): housing-media配信ルート+キャッシュヘッダーをvercel.jsonに追加"
```

---

### Task 4: 既存データ移行スクリプトを書く(ドライラン+本実行の両モード)

**Files:**
- Create: `scripts/migrate-housing-images-to-cf-cache.ts`

**Interfaces:**
- Consumes: `buildHousingImagePublicUrl`, `parseStoragePathFromPublicUrl`(`api/housing/_imageArrayLogic.js` からimport。ビルド後の `.js` を直接importできないため、スクリプト内に同等のロジックを直接持たせる — 下記コード参照)
- Produces: なし(スクリプト単体。Task 8でオーケストレーターが直接実行する)

**注記:** `api/housing/_imageArrayLogic.ts` は `tsconfig.api.json` でビルドされるNode ESM(`.js`拡張子import必須)であり、`scripts/` の tsx 実行環境とモジュール解決規約が異なる。誤importで実行時エラーになるのを避けるため、本スクリプトは `buildHousingImagePublicUrl` と同一のロジックをスクリプト内に直接インライン実装する(Task 2の実装をコピーするのではなく、同じ変換規則を独立実装。2箇所のロジックがズレないよう、コメントで参照元を明記する)。

- [ ] **Step 1: スクリプトを作成する**

```ts
/**
 * scripts/migrate-housing-images-to-cf-cache.ts
 *
 * housing_listings の imageMode='thumbnail' な物件の thumbnailPaths / thumbnailPath を、
 * 旧形式URL (firebasestorage.googleapis.com) から新形式URL (lopoly.app/housing-media/...) へ
 * 書き換える。URL変換規則は api/housing/_imageArrayLogic.ts の
 * buildHousingImagePublicUrl / parseStoragePathFromPublicUrl と同一 (2026-07-24 設計)。
 *
 * 安全設計:
 * - Storageファイルは一切触らない (削除・移動しない)。旧URLは書き換え後も有効なまま。
 * - --dry-run (既定): 新URLを計算し実際にHTTPで検証するだけ。Firestoreへの書き込みなし。
 * - --commit: 1件ずつ「新URLが正しく画像を返すことを確認 → その1件だけ書き込み」を行う。
 *   既に新形式になっている件は自動スキップする (再実行安全・冪等)。
 *
 * 使い方:
 *   npx tsx scripts/migrate-housing-images-to-cf-cache.ts             (ドライラン)
 *   npx tsx scripts/migrate-housing-images-to-cf-cache.ts --commit    (本実行)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadEnv(filePath: string): Record<string, string> {
  const text = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/** api/housing/_imageArrayLogic.ts の buildHousingImagePublicUrl と同一規則。 */
function buildNewUrl(listingId: string, filename: string): string {
  return `https://lopoly.app/housing-media/${listingId}/${filename}`;
}

/** 旧形式URL (firebasestorage.googleapis.com) かどうかの判定 + ファイル名抽出。 */
function extractFilenameFromOldUrl(url: string, listingId: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'firebasestorage.googleapis.com') return null;
    const marker = '/o/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const decoded = decodeURIComponent(u.pathname.slice(idx + marker.length));
    const expectedPrefix = `housing/listings/${listingId}/`;
    if (!decoded.startsWith(expectedPrefix)) return null;
    return decoded.slice(expectedPrefix.length);
  } catch {
    return null;
  }
}

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const COMMIT = process.argv.includes('--commit');

async function verifyUrlResolves(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log(COMMIT ? '=== 本実行モード (Firestoreに書き込みます) ===' : '=== ドライランモード (書き込みなし) ===');

  const snap = await db.collection('housing_listings').where('imageMode', '==', 'thumbnail').get();
  console.log(`対象候補: ${snap.size}件 (imageMode='thumbnail')`);

  let alreadyMigrated = 0;
  let migrated = 0;
  let failed = 0;
  let skippedNoOldUrl = 0;

  for (const doc of snap.docs) {
    const listingId = doc.id;
    const data = doc.data();
    const thumbnailPaths: string[] = Array.isArray(data.thumbnailPaths) ? data.thumbnailPaths : [];

    if (thumbnailPaths.length === 0) {
      skippedNoOldUrl++;
      continue;
    }

    // 既に全部新形式なら完全スキップ (冪等性)
    const allAlreadyNew = thumbnailPaths.every((u) => !u || u.startsWith('https://lopoly.app/housing-media/'));
    if (allAlreadyNew) {
      alreadyMigrated++;
      continue;
    }

    const newPaths: string[] = [];
    let listingOk = true;
    for (const oldUrl of thumbnailPaths) {
      if (!oldUrl) {
        newPaths.push(oldUrl);
        continue;
      }
      if (oldUrl.startsWith('https://lopoly.app/housing-media/')) {
        newPaths.push(oldUrl); // 既に新形式
        continue;
      }
      const filename = extractFilenameFromOldUrl(oldUrl, listingId);
      if (!filename) {
        console.error(`  ⚠ ${listingId}: 旧URL形式を解析できず (skip): ${oldUrl}`);
        listingOk = false;
        break;
      }
      const newUrl = buildNewUrl(listingId, filename);
      const resolves = await verifyUrlResolves(newUrl);
      if (!resolves) {
        console.error(`  ⚠ ${listingId}: 新URLが解決しない (skip): ${newUrl}`);
        listingOk = false;
        break;
      }
      newPaths.push(newUrl);
    }

    if (!listingOk) {
      failed++;
      continue;
    }

    console.log(`  ✅ ${listingId}: ${thumbnailPaths.length}枚 検証OK${COMMIT ? ' → 書き込み中' : ' (dry-run)'}`);

    if (COMMIT) {
      try {
        await db.collection('housing_listings').doc(listingId).update({
          thumbnailPaths: newPaths,
          thumbnailPath: newPaths[0] ?? null,
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.error(`  ❌ ${listingId}: Firestore書き込み失敗:`, e);
        failed++;
        continue;
      }
    }
    migrated++;
  }

  console.log('\n=== 結果 ===');
  console.log(`移行対象として処理: ${migrated}件`);
  console.log(`既に新形式でスキップ: ${alreadyMigrated}件`);
  console.log(`画像なしでスキップ: ${skippedNoOldUrl}件`);
  console.log(`検証失敗: ${failed}件`);
  if (!COMMIT) {
    console.log('\nドライランでした。問題なければ --commit を付けて再実行してください。');
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ 致命的エラー:', e);
  process.exit(1);
});
```

- [ ] **Step 2: 型チェックが通ることを確認**

Run: `npx tsc --noEmit scripts/migrate-housing-images-to-cf-cache.ts --module esnext --moduleResolution bundler --target es2022 --skipLibCheck`
Expected: エラーなく完了

- [ ] **Step 3: コミット**

```bash
git add scripts/migrate-housing-images-to-cf-cache.ts
git commit -m "feat(housing): 既存画像URLをCloudflareキャッシュ形式へ移行するスクリプトを追加(dry-run既定)"
```

---

### Task 5: pushゲート確認 → 本番デプロイ(オーケストレーター自身が実行)

**Files:** なし(検証+デプロイのみ)

- [ ] **Step 1: フルビルド確認**

Run: `npm run build`
Expected: エラーなく完了(tsc -b, tsc -p tsconfig.api.json, vite build すべて成功)

- [ ] **Step 2: 全テスト確認**

Run: `npm test`
Expected: 全件 PASS

- [ ] **Step 3: git push**

```bash
git push
```

Expected: push成功。Vercelが自動デプロイを開始する([[reference_vercel_git_autodeploy]])。

- [ ] **Step 4: デプロイ完了を待って本番で `/housing-media/` ルートが機能することを確認**

適当な既存物件画像の旧URL(例: Firestoreの `thumbnailPaths[0]`)から `listingId` と `filename` を1件取り出し、以下を実行:

Run: `curl -s -D - -o /dev/null "https://lopoly.app/housing-media/{実際のlistingId}/{実際のfilename}"`
Expected: `HTTP/1.1 200` かつ `content-type: image/*`。もし404/502なら、Task 3の `vercel.json` のリライトパターンを見直す(設計書に記載の通り、複数階層パスの扱いは実機検証が必須)。

---

### Task 6: Cloudflare Cache Rule をユーザーに設定してもらう(手動・ステップバイステップ案内)

**Files:** なし(ユーザーへの案内文を作成するタスク)

- [ ] **Step 1: 以下の手順書をそのままユーザーに提示する**

1. ブラウザで https://dash.cloudflare.com を開き、`lopoly.app` のドメインを選択する
2. 左側のメニューから「キャッシュ (Caching)」→「キャッシュルール (Cache Rules)」を選ぶ
3. 「ルールを作成 (Create rule)」ボタンを押す
4. ルール名に「housing-media-cache」など分かりやすい名前を入力する
5. 「フィールド (Field)」で「URI パス (URI Path)」を選び、「演算子 (Operator)」で「先頭が一致 (starts with)」を選び、値に `/housing-media/` と入力する
6. 下の方にある「キャッシュ照合単位 (Eligible for cache)」を「対象 (Eligible)」に設定する
7. 「キャッシュ有効期限 (Edge TTL)」を「ヘッダーを無視してこの秒数を使用する (Ignore cache-control header and use this TTL)」にし、値を「1年 (365日)」相当に設定する
8. 既存の「icons-cache」のようなルールがあれば、その設定内容(特にEdge TTLの指定方法)を参考にして揃える
9. 保存する。既存ルールがある場合、一覧の一番下に追加すればよい(順序を気にする必要はない)

- [ ] **Step 2: ユーザーからの完了報告を待つ**

ユーザーが上記を完了したら、Task 7 に進む。

---

### Task 7: Cloudflareキャッシュが実際に効いていることを検証する(オーケストレーター自身が実行)

**Files:** なし

- [ ] **Step 1: 1回目のリクエストを送る**

Run: `curl -s -D - -o /dev/null "https://lopoly.app/housing-media/{Task5で使ったlistingId}/{filename}" | grep -iE "cf-cache-status|cache-control|server:"`
Expected: `server: cloudflare` が含まれる。`cf-cache-status` が `MISS` または `HIT` のどちらか。

- [ ] **Step 2: 2回目のリクエストを送る**

Run: 同じcurlコマンドをもう一度実行
Expected: `cf-cache-status: HIT` になっていること。1回目がMISSでも2回目はHITになっていればキャッシュは機能している。もし2回連続でMISS/DYNAMICなら、Task 6のCache Rule設定を見直す。

---

### Task 8: 既存データ移行をドライランで実行し、結果をユーザーに報告する(オーケストレーター自身が実行)

**Files:** なし

- [ ] **Step 1: ドライラン実行**

Run: `npx tsx scripts/migrate-housing-images-to-cf-cache.ts`
Expected: 各物件について「✅ 検証OK (dry-run)」のログが出力され、最後に `検証失敗: 0件` に近い結果になる。Firestoreへの書き込みは発生しない。

- [ ] **Step 2: 結果をユーザーに提示し、本実行の許可を得る**

ドライラン結果のサマリ(移行対象件数・失敗件数)を報告する。失敗が0件でなければ、原因(その物件の旧URLが解析できない等)を個別に調査してから先に進む。

---

### Task 9: 既存データ移行を本実行する(オーケストレーター自身が実行・要ユーザー最終確認後)

**Files:** なし

- [ ] **Step 1: 本実行**

Run: `npx tsx scripts/migrate-housing-images-to-cf-cache.ts --commit`
Expected: Task 8のドライランと同じ件数が「書き込み中」として処理され、`検証失敗: 0件`(または前回と同じ既知の失敗のみ)。

- [ ] **Step 2: 移行後、実際のアプリ画面で数件ピックアップして目視確認**

ハウジングの探すページ等で、直接アップロード画像を使っている物件をいくつか開き、画像が正しく表示されることを確認する。

---

### Task 10: 効果測定の予約と最終報告

**Files:** なし

- [ ] **Step 1: ユーザーに完了報告する**

以下を含めて報告する: ①コード変更・デプロイ完了 ②Cloudflareキャッシュ動作確認済み(cf-cache-status: HIT) ③既存○件の移行完了 ④数日後にFirebase使用状況画面でegressが減っていることを一緒に確認する旨を伝える。

- [ ] **Step 2: TODO.mdを更新**

`docs/TODO.md` の該当項目(①コスト面)を「実装・デプロイ完了、数日後に効果測定予定」に更新し、コミットする。

---

## Self-Review Notes

- **spec coverage**: 設計書の§3(アーキテクチャ)→Task2-3、§4(依存箇所修正)→Task1、§5(移行)→Task4/8/9、§6(効果検証)→Task7/10、すべて対応するタスクあり。
- **placeholder scan**: なし(全ステップに具体的なコード・コマンド・期待結果を記載済み)。
- **type consistency**: `buildHousingImagePublicUrl(listingId: string, filename: string): string` はTask2で定義し、Task4の移行スクリプトでは(モジュール解決の都合上)同名関数を独立実装している旨を明記済み。
