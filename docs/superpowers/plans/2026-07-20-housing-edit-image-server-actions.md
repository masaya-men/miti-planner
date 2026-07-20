# ハウジング編集画像管理: サーバーAPI実装計画 (Plan A/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング物件の画像(直接アップロード/URL経由どちらも)を、登録済みの物件に対して個別削除・並び替えできるサーバーAPIと、登録方法(アップロード⇔URL)を切り替えたときの旧データ自動クリーンアップを実装する。

**Architecture:** 既存の `api/housing/index.ts` の `?action=` ディスパッチに4つの新規アクション(`delete-thumbnail` / `reorder-thumbnails` / `delete-source-image` / `reorder-source-images`)を追加し、既存の2ハンドラー(`upload-thumbnail` / `update-listing`)を拡張する。新規のVercel関数は作らない。削除・並び替えの中核ロジックは Firebase Admin SDK に依存しない純粋関数として切り出し、Admin SDK をモックせずに単体テストする(このリポジトリの `api/housing/__tests__/` の既存パターンを踏襲)。

**Tech Stack:** TypeScript / Vercel Serverless Functions / firebase-admin (Firestore + Storage) / vitest

## Global Constraints

- 新規のVercel Functionは作らない。すべて `api/housing/index.ts` の `?action=` ディスパッチに追加する(Vercel Hobbyプランの関数数上限を消費しないため)。
- 認可パターンは既存ハンドラー(`_uploadThumbnailHandler.ts` 等)と同一: App Check → rate limit → Bearer idToken 検証 → Firestoreトランザクション内で `listing.ownerUid === uid` 確認。
- サーバーテストは Admin SDK をモックしない。ロジックを純粋関数に切り出し、その関数だけを `vitest` で単体テストする(`api/housing/__tests__/_sharedTourCreateLogic.test.ts` と同じ流儀)。
- 画像の並び順は `thumbnailPaths` / `sourceImageUrls` という Firestore 上の配列そのものが唯一の正典。Storage側のファイル名は位置と無関係なランダムIDにする(既存データは無変更で動作継続)。
- `postUrl` (元投稿へのリンク) は `imageMode` や画像ソースの種類と独立したフィールドとして扱う(2026-07-20の別修正で確立した既存方針 — 直接アップロードでもURLを保持する)。登録方法を切り替えても `postUrl` は消さない。

---

## ファイル構成

- 新規: `api/housing/_imageArrayLogic.ts` — 画像配列の削除/並び替えの純粋ロジック + Storage公開URLからパスを逆算する関数。
- 新規: `api/housing/__tests__/_imageArrayLogic.test.ts`
- 新規: `api/housing/_deleteThumbnailHandler.ts`
- 新規: `api/housing/_reorderThumbnailsHandler.ts`
- 新規: `api/housing/_deleteSourceImageHandler.ts`
- 新規: `api/housing/_reorderSourceImagesHandler.ts`
- 修正: `api/housing/_uploadThumbnailHandler.ts` — 保存パスをランダムID化 + sns→thumbnail切替時のクリーンアップ追加。
- 修正: `api/housing/_updateListingHandler.ts` — 画像関連フィールドの永続化 + thumbnail→sns切替時のクリーンアップ追加。
- 修正: `api/housing/index.ts` — 4アクションを追加。
- 修正: `src/lib/housingApiClient.ts` — 4つのクライアント関数を追加。

---

### Task 1: 画像配列の純粋ロジック (`_imageArrayLogic.ts`)

**Files:**
- Create: `api/housing/_imageArrayLogic.ts`
- Test: `api/housing/__tests__/_imageArrayLogic.test.ts`

**Interfaces:**
- Produces: `computeArrayDeletion<T>(current: T[], index: number): DeletionResult<T>` / `computeArrayReorder<T>(current: T[], newOrder: T[]): ReorderResult` / `parseStoragePathFromPublicUrl(url: string): string | null` — Task 2〜7 がすべてこれを使う。

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// api/housing/__tests__/_imageArrayLogic.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeArrayDeletion,
  computeArrayReorder,
  parseStoragePathFromPublicUrl,
} from '../_imageArrayLogic.js';

describe('computeArrayDeletion', () => {
  it('中間の要素を削除すると後続が詰まる', () => {
    const result = computeArrayDeletion(['a', 'b', 'c', 'd'], 1);
    expect(result).toEqual({ ok: true, next: ['a', 'c', 'd'], removed: 'b' });
  });

  it('範囲外のindexは invalid_index', () => {
    expect(computeArrayDeletion(['a', 'b'], 5)).toEqual({ ok: false, error: 'invalid_index' });
    expect(computeArrayDeletion(['a', 'b'], -1)).toEqual({ ok: false, error: 'invalid_index' });
  });

  it('整数でないindexは invalid_index', () => {
    expect(computeArrayDeletion(['a', 'b'], 1.5)).toEqual({ ok: false, error: 'invalid_index' });
  });

  it('残り1件を削除しようとすると last_item', () => {
    expect(computeArrayDeletion(['a'], 0)).toEqual({ ok: false, error: 'last_item' });
  });

  it('空配列は invalid_index', () => {
    expect(computeArrayDeletion([], 0)).toEqual({ ok: false, error: 'invalid_index' });
  });
});

describe('computeArrayReorder', () => {
  it('並び替え後の配列が元の要素集合と一致すれば permutation を返す', () => {
    const result = computeArrayReorder(['a', 'b', 'c'], ['c', 'a', 'b']);
    expect(result).toEqual({ ok: true, permutation: [2, 0, 1] });
  });

  it('件数が違えば invalid_reorder', () => {
    expect(computeArrayReorder(['a', 'b'], ['a'])).toEqual({ ok: false, error: 'invalid_reorder' });
  });

  it('要素が違えば invalid_reorder', () => {
    expect(computeArrayReorder(['a', 'b'], ['a', 'z'])).toEqual({ ok: false, error: 'invalid_reorder' });
  });

  it('同じ値が重複していても1対1で対応づける', () => {
    const result = computeArrayReorder(['a', 'a', 'b'], ['a', 'b', 'a']);
    expect(result).toEqual({ ok: true, permutation: [0, 2, 1] });
  });
});

describe('parseStoragePathFromPublicUrl', () => {
  it('firebasestorage の公開URLからパスを逆算する', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/housing%2Flistings%2Fabc%2Fx1y2z3.webp?alt=media';
    expect(parseStoragePathFromPublicUrl(url)).toBe('housing/listings/abc/x1y2z3.webp');
  });

  it('firebasestorage 以外のURLは null (外部URLを誤って削除しないため)', () => {
    expect(parseStoragePathFromPublicUrl('https://pbs.twimg.com/media/x.jpg')).toBeNull();
  });

  it('不正なURL文字列は null', () => {
    expect(parseStoragePathFromPublicUrl('not-a-url')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run api/housing/__tests__/_imageArrayLogic.test.ts`
Expected: FAIL (`Cannot find module '../_imageArrayLogic.js'`)

- [ ] **Step 3: 実装する**

```typescript
// api/housing/_imageArrayLogic.ts
/**
 * 画像URL配列 (thumbnailPaths / sourceImageUrls) の削除・並び替えの純粋ロジック。
 * Firebase Admin SDK に依存しないため、モック無しで単体テストできる。
 */

export type DeletionResult<T> =
  | { ok: true; next: T[]; removed: T }
  | { ok: false; error: 'invalid_index' | 'last_item' };

/** index位置の要素を削除し、後続を詰める。最後の1件は削除させない(最低1枚を保証)。 */
export function computeArrayDeletion<T>(current: T[], index: number): DeletionResult<T> {
  if (!Number.isInteger(index) || index < 0 || index >= current.length) {
    return { ok: false, error: 'invalid_index' };
  }
  if (current.length <= 1) {
    return { ok: false, error: 'last_item' };
  }
  const next = current.filter((_, i) => i !== index);
  return { ok: true, next, removed: current[index] };
}

export type ReorderResult =
  | { ok: true; permutation: number[] }
  | { ok: false; error: 'invalid_reorder' };

/**
 * newOrder が current の並び替え (同じ多重集合) であることを検証し、
 * permutation[i] = 「newOrder の i 番目は current の何番目だったか」を返す。
 * 呼び出し側はこの permutation を使って、対応する副配列 (aspectRatios 等) も
 * 同じ順序で並び替えられる。
 */
export function computeArrayReorder<T>(current: T[], newOrder: T[]): ReorderResult {
  if (newOrder.length !== current.length) {
    return { ok: false, error: 'invalid_reorder' };
  }
  const used = new Set<number>();
  const permutation: number[] = [];
  for (const item of newOrder) {
    const idx = current.findIndex((c, i) => c === item && !used.has(i));
    if (idx === -1) return { ok: false, error: 'invalid_reorder' };
    used.add(idx);
    permutation.push(idx);
  }
  return { ok: true, permutation };
}

/**
 * Firebase Storage の公開URL (`_uploadThumbnailHandler.ts` が生成する形式) から
 * バケット内の実パスを逆算する。firebasestorage.googleapis.com 以外のURL
 * (外部SNS画像等) は null を返し、誤って外部リソースを削除対象にしないようにする。
 */
export function parseStoragePathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'firebasestorage.googleapis.com') return null;
    const marker = '/o/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const encodedPath = u.pathname.slice(idx + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/housing/__tests__/_imageArrayLogic.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: コミット**

```bash
git add api/housing/_imageArrayLogic.ts api/housing/__tests__/_imageArrayLogic.test.ts
git commit -m "feat(housing): 画像配列の削除/並び替えの純粋ロジックを追加"
```

---

### Task 2: `delete-thumbnail` アクション

**Files:**
- Create: `api/housing/_deleteThumbnailHandler.ts`
- Modify: `api/housing/index.ts`

**Interfaces:**
- Consumes: `computeArrayDeletion`, `parseStoragePathFromPublicUrl` (Task 1)
- Produces: `POST /api/housing?action=delete-thumbnail` — Body `{listingId, index}` → `{success: true, thumbnailPaths: string[]}`

- [ ] **Step 1: ハンドラーを実装する**

```typescript
// api/housing/_deleteThumbnailHandler.ts
/**
 * POST /api/housing?action=delete-thumbnail
 *
 * 直接アップロード画像 (imageMode='thumbnail') の1枚を削除する。
 * 削除すると後続の画像が詰めて繰り上がる (2026-07-20 編集ページ画像管理設計)。
 * 最後の1枚は削除できない (登録時と同じく最低1枚を保証)。
 *
 * Body: { listingId: string, index: number }
 * 認可: Firebase ID token (Bearer) + listing.ownerUid === uid
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { computeArrayDeletion, parseStoragePathFromPublicUrl } from './_imageArrayLogic.js';
import { bumpPublicVersionTx } from './_publicVersion.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 10, 60_000, { scope: 'housing-delete-thumbnail' }))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, index } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (typeof index !== 'number') {
      return res.status(400).json({ error: 'invalid_index' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    let removedUrl: string | null = null;
    let newPaths: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');

      const current: string[] = Array.isArray(data.thumbnailPaths) ? data.thumbnailPaths : [];
      const result = computeArrayDeletion(current, index);
      if (!result.ok) throw new Error(result.error);

      removedUrl = result.removed;
      newPaths = result.next;

      tx.update(listingRef, {
        thumbnailPaths: newPaths,
        thumbnailPath: newPaths[0],
        updatedAt: Date.now(),
      });
      bumpPublicVersionTx(tx, adminDb);
    });

    // Storageファイルの実削除はトランザクション成功後 (Firestoreの一貫性を優先し、
    // Storage削除の失敗でトランザクション全体を巻き戻さない。削除できなくても
    // Firestore側の配列からは既に消えているため表示上の実害は無い)。
    if (removedUrl) {
      const path = parseStoragePathFromPublicUrl(removedUrl);
      if (path) {
        try {
          await getStorage().bucket().file(path).delete();
        } catch (e) {
          console.error('[housing/delete-thumbnail] storage delete failed (non-fatal):', e);
        }
      }
    }

    return res.status(200).json({ success: true, thumbnailPaths: newPaths });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'invalid_index') return res.status(400).json({ error: 'invalid_index' });
    if (error?.message === 'last_item') return res.status(400).json({ error: 'last_item' });
    console.error('[housing/delete-thumbnail] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
```

- [ ] **Step 2: ルーターに配線する**

`api/housing/index.ts` の import 群 (39行目 `uploadThumbnailHandler` の直後) に追加:

```typescript
import deleteThumbnailHandler from './_deleteThumbnailHandler.js';
```

`switch (action)` の `case 'upload-thumbnail':` ブロックの直後に追加:

```typescript
    case 'delete-thumbnail':
      return deleteThumbnailHandler(req, res);
```

冒頭のコメント一覧 (15行目 `upload-thumbnail` の説明の直後) に追加:

```typescript
 * ?action=delete-thumbnail          → POST 直接アップロード画像を1枚削除 (後続を繰り上げ)
```

`default:` 節のエラーメッセージ内のaction一覧文字列にも `delete-thumbnail` を追記する。

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npx tsc -b --noEmit`
Expected: エラー無し

- [ ] **Step 4: コミット**

```bash
git add api/housing/_deleteThumbnailHandler.ts api/housing/index.ts
git commit -m "feat(housing): delete-thumbnail アクションを追加"
```

---

### Task 3: `reorder-thumbnails` アクション

**Files:**
- Create: `api/housing/_reorderThumbnailsHandler.ts`
- Modify: `api/housing/index.ts`

**Interfaces:**
- Consumes: `computeArrayReorder` (Task 1)
- Produces: `POST /api/housing?action=reorder-thumbnails` — Body `{listingId, newOrder: string[]}` → `{success: true, thumbnailPaths: string[]}`

- [ ] **Step 1: ハンドラーを実装する**

```typescript
// api/housing/_reorderThumbnailsHandler.ts
/**
 * POST /api/housing?action=reorder-thumbnails
 *
 * 直接アップロード画像 (imageMode='thumbnail') の並び順を変更する。
 * Storage側のファイルは一切移動しない (保存パスは位置と無関係なランダムIDのため)。
 * Firestoreの thumbnailPaths 配列を書き換えるだけの軽い処理。
 *
 * Body: { listingId: string, newOrder: string[] }
 * 認可: Firebase ID token (Bearer) + listing.ownerUid === uid
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { computeArrayReorder } from './_imageArrayLogic.js';
import { bumpPublicVersionTx } from './_publicVersion.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 20, 60_000, { scope: 'housing-reorder-thumbnails' }))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, newOrder } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (!Array.isArray(newOrder) || !newOrder.every((u) => typeof u === 'string')) {
      return res.status(400).json({ error: 'invalid_newOrder' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');

      const current: string[] = Array.isArray(data.thumbnailPaths) ? data.thumbnailPaths : [];
      const result = computeArrayReorder(current, newOrder);
      if (!result.ok) throw new Error(result.error);

      tx.update(listingRef, {
        thumbnailPaths: newOrder,
        thumbnailPath: newOrder[0],
        updatedAt: Date.now(),
      });
      bumpPublicVersionTx(tx, adminDb);
    });

    return res.status(200).json({ success: true, thumbnailPaths: newOrder });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'invalid_reorder') return res.status(400).json({ error: 'invalid_reorder' });
    console.error('[housing/reorder-thumbnails] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
```

- [ ] **Step 2: ルーターに配線する**

`api/housing/index.ts` に Task 2 と同じ要領で追加: import (`_deleteThumbnailHandler.js` の直後)、`case 'reorder-thumbnails':`、冒頭コメント、`default:` のaction一覧。

```typescript
import reorderThumbnailsHandler from './_reorderThumbnailsHandler.js';
```

```typescript
    case 'reorder-thumbnails':
      return reorderThumbnailsHandler(req, res);
```

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npx tsc -b --noEmit`
Expected: エラー無し

- [ ] **Step 4: コミット**

```bash
git add api/housing/_reorderThumbnailsHandler.ts api/housing/index.ts
git commit -m "feat(housing): reorder-thumbnails アクションを追加"
```

---

### Task 4: `delete-source-image` アクション

**Files:**
- Create: `api/housing/_deleteSourceImageHandler.ts`
- Modify: `api/housing/index.ts`

**Interfaces:**
- Consumes: `computeArrayDeletion` (Task 1)
- Produces: `POST /api/housing?action=delete-source-image` — Body `{listingId, index}` → `{success: true, sourceImageUrls: string[]}`

**注記**: `sourceImageUrls` と `sourceImageAspectRatios` は1:1対応の配列 (`src/types/housing.ts:154`)。削除時は両方から同じindexを除去し、ズレを防ぐ。

- [ ] **Step 1: ハンドラーを実装する**

```typescript
// api/housing/_deleteSourceImageHandler.ts
/**
 * POST /api/housing?action=delete-source-image
 *
 * URL経由画像 (imageMode='sns') の1枚を削除する。sourceImageUrls と
 * sourceImageAspectRatios (1:1対応) の両方から同じindexを除去する。
 * Storage操作は無い (外部URLの参照を配列から外すだけ)。最後の1枚は削除できない。
 *
 * Body: { listingId: string, index: number }
 * 認可: Firebase ID token (Bearer) + listing.ownerUid === uid
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { computeArrayDeletion } from './_imageArrayLogic.js';
import { bumpPublicVersionTx } from './_publicVersion.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 10, 60_000, { scope: 'housing-delete-source-image' }))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, index } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (typeof index !== 'number') {
      return res.status(400).json({ error: 'invalid_index' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);
    let newUrls: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');

      const current: string[] = Array.isArray(data.sourceImageUrls) ? data.sourceImageUrls : [];
      const result = computeArrayDeletion(current, index);
      if (!result.ok) throw new Error(result.error);
      newUrls = result.next;

      const update: Record<string, unknown> = {
        sourceImageUrls: newUrls,
        ogImageUrl: newUrls[0],
        updatedAt: Date.now(),
      };
      const currentRatios: number[] | undefined = Array.isArray(data.sourceImageAspectRatios)
        ? data.sourceImageAspectRatios
        : undefined;
      if (currentRatios && currentRatios.length === current.length) {
        update.sourceImageAspectRatios = currentRatios.filter((_, i) => i !== index);
      }

      tx.update(listingRef, update);
      bumpPublicVersionTx(tx, adminDb);
    });

    return res.status(200).json({ success: true, sourceImageUrls: newUrls });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'invalid_index') return res.status(400).json({ error: 'invalid_index' });
    if (error?.message === 'last_item') return res.status(400).json({ error: 'last_item' });
    console.error('[housing/delete-source-image] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
```

- [ ] **Step 2: ルーターに配線する**

同じ要領で `api/housing/index.ts` に追加。

```typescript
import deleteSourceImageHandler from './_deleteSourceImageHandler.js';
```

```typescript
    case 'delete-source-image':
      return deleteSourceImageHandler(req, res);
```

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npx tsc -b --noEmit`
Expected: エラー無し

- [ ] **Step 4: コミット**

```bash
git add api/housing/_deleteSourceImageHandler.ts api/housing/index.ts
git commit -m "feat(housing): delete-source-image アクションを追加"
```

---

### Task 5: `reorder-source-images` アクション

**Files:**
- Create: `api/housing/_reorderSourceImagesHandler.ts`
- Modify: `api/housing/index.ts`

**Interfaces:**
- Consumes: `computeArrayReorder` (Task 1)
- Produces: `POST /api/housing?action=reorder-source-images` — Body `{listingId, newOrder: string[]}` → `{success: true, sourceImageUrls: string[]}`

**注記**: `computeArrayReorder` が返す `permutation` を使って `sourceImageAspectRatios` も同じ並びに揃える。

- [ ] **Step 1: ハンドラーを実装する**

```typescript
// api/housing/_reorderSourceImagesHandler.ts
/**
 * POST /api/housing?action=reorder-source-images
 *
 * URL経由画像 (imageMode='sns') の並び順を変更する。sourceImageUrls と
 * 1:1対応の sourceImageAspectRatios も同じ順序に揃える (permutation を使う)。
 *
 * Body: { listingId: string, newOrder: string[] }
 * 認可: Firebase ID token (Bearer) + listing.ownerUid === uid
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { computeArrayReorder } from './_imageArrayLogic.js';
import { bumpPublicVersionTx } from './_publicVersion.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 20, 60_000, { scope: 'housing-reorder-source-images' }))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, newOrder } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (!Array.isArray(newOrder) || !newOrder.every((u) => typeof u === 'string')) {
      return res.status(400).json({ error: 'invalid_newOrder' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');

      const current: string[] = Array.isArray(data.sourceImageUrls) ? data.sourceImageUrls : [];
      const result = computeArrayReorder(current, newOrder);
      if (!result.ok) throw new Error(result.error);

      const update: Record<string, unknown> = {
        sourceImageUrls: newOrder,
        ogImageUrl: newOrder[0],
        updatedAt: Date.now(),
      };
      const currentRatios: number[] | undefined = Array.isArray(data.sourceImageAspectRatios)
        ? data.sourceImageAspectRatios
        : undefined;
      if (currentRatios && currentRatios.length === current.length) {
        update.sourceImageAspectRatios = result.permutation.map((i) => currentRatios[i]);
      }

      tx.update(listingRef, update);
      bumpPublicVersionTx(tx, adminDb);
    });

    return res.status(200).json({ success: true, sourceImageUrls: newOrder });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'invalid_reorder') return res.status(400).json({ error: 'invalid_reorder' });
    console.error('[housing/reorder-source-images] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
```

- [ ] **Step 2: ルーターに配線する**

同じ要領。`api/housing/index.ts` の import群の末尾 (`_publicWindow.js` の直前が良い) に追加、`case` を追加、冒頭コメントと `default:` のaction一覧も更新する。

```typescript
import reorderSourceImagesHandler from './_reorderSourceImagesHandler.js';
```

```typescript
    case 'reorder-source-images':
      return reorderSourceImagesHandler(req, res);
```

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npx tsc -b --noEmit`
Expected: エラー無し

- [ ] **Step 4: コミット**

```bash
git add api/housing/_reorderSourceImagesHandler.ts api/housing/index.ts
git commit -m "feat(housing): reorder-source-images アクションを追加"
```

---

### Task 6: `upload-thumbnail` をランダムID保存パス化 + sns→thumbnail切替時クリーンアップ

**Files:**
- Modify: `api/housing/_uploadThumbnailHandler.ts`

**Interfaces:**
- Produces: `upload-thumbnail` の保存先パスが `main-{index}.{ext}` から `{randomId}.{ext}` に変わる。既存データ (`main-*` 形式) はそのまま動作し続ける (このタスクでは触らない)。

**現状** (`api/housing/_uploadThumbnailHandler.ts:115-131`):

```typescript
    const ext = ALLOWED_MIME[mimeType];
    const storage = getStorage();
    const bucket = storage.bucket();
    const filePath = `housing/listings/${listingId}/main-${imageIndex}.${ext}`;
    const file = bucket.file(filePath);
    await file.save(buf, {
      contentType: mimeType,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      filePath,
    )}?alt=media`;
```

- [ ] **Step 1: ランダムID生成関数を追加し、保存パスをこれに切り替える**

`api/housing/_uploadThumbnailHandler.ts` の import群に `randomUUID` を追加:

```typescript
import { randomUUID } from 'node:crypto';
```

上記の現状コードを次のように置き換える:

```typescript
    const ext = ALLOWED_MIME[mimeType];
    const storage = getStorage();
    const bucket = storage.bucket();
    // 保存パスは並び順(index)と無関係なランダムIDにする。並び順は Firestore の
    // thumbnailPaths 配列だけが正典とし、削除/並び替え時に Storage ファイルを
    // 移動する必要を無くすため (2026-07-20 編集ページ画像管理設計)。
    // 既存の main-{index}.{ext} 形式のファイル/URLは不透明な文字列としてそのまま
    // 動作し続けるため、過去データへの移行は不要。
    const filePath = `housing/listings/${listingId}/${randomUUID()}.${ext}`;
    const file = bucket.file(filePath);
    await file.save(buf, {
      contentType: mimeType,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      filePath,
    )}?alt=media`;
```

- [ ] **Step 2: sns→thumbnail 切替時のクリーンアップを追加する**

`api/housing/_uploadThumbnailHandler.ts` の Firestore トランザクション部分 (現状134-160行目、`adminDb.runTransaction` ブロック) を次のように差し替える。既存の `update.thumbnailPath` 分岐 (154-156行目) の直前に、`data.imageMode === 'sns'` だった場合のsnsフィールドクリア処理を追加する:

```typescript
    // thumbnailPaths 配列の index 位置を更新 (transaction で race condition 回避)。
    const newPaths = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      const data = snap.data() ?? {};
      const existing: string[] = Array.isArray(data.thumbnailPaths)
        ? [...data.thumbnailPaths]
        : data.thumbnailPath
          ? [data.thumbnailPath]
          : [];
      while (existing.length <= imageIndex) existing.push('');
      existing[imageIndex] = publicUrl;
      while (existing.length > 0 && existing[existing.length - 1] === '') existing.pop();

      const update: Record<string, unknown> = {
        thumbnailPaths: existing,
        imageMode: 'thumbnail',
        updatedAt: Date.now(),
      };
      if (imageIndex === 0 || (data.thumbnailPath ?? '') === '') {
        update.thumbnailPath = existing[0];
      }
      // sns→thumbnail の登録方法切替 (2026-07-20 編集ページ画像管理設計): このアップロードが
      // 「URL経由だった物件に初めて直接アップロード画像を追加した」ケースなら、SNS由来の
      // フィールドをクリアする。postUrl (元投稿へのリンク) だけは imageMode と独立した
      // フィールドとして扱う既存方針 (2026-07-20 別修正) により残す。
      if (data.imageMode === 'sns') {
        update.ogImageUrl = FieldValue.delete();
        update.sourceImageUrls = FieldValue.delete();
        update.sourceImageAspectRatios = FieldValue.delete();
        update.tweetId = FieldValue.delete();
        update.youtubeVideoId = FieldValue.delete();
        update.videoUrl = FieldValue.delete();
        update.videoPosterUrl = FieldValue.delete();
        update.videoAspectRatio = FieldValue.delete();
      }
      tx.update(listingRef, update);
      bumpPublicVersionTx(tx, adminDb);
      return existing;
    });
```

`api/housing/_uploadThumbnailHandler.ts` の import群に `FieldValue` を追加:

```typescript
import { FieldValue } from 'firebase-admin/firestore';
```

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npx tsc -b --noEmit`
Expected: エラー無し

- [ ] **Step 4: コミット**

```bash
git add api/housing/_uploadThumbnailHandler.ts
git commit -m "feat(housing): upload-thumbnailの保存パスをランダムID化+sns→thumbnail切替クリーンアップ追加"
```

---

### Task 7: `update-listing` の画像フィールド永続化 + thumbnail→sns切替時クリーンアップ

**Files:**
- Modify: `api/housing/_updateListingHandler.ts`

**重要な既知の乖離**: このハンドラーの冒頭コメント (1-10行目) には `imageMode, postUrl, ogImageUrl, thumbnailPath` が「更新可能フィールド」と書かれているが、実際の `updatePayload` はこれらを一切書き込んでいない。編集ページで登録方法の切替やURLの貼り替えを保存できるようにするには、ここを実際に書き込むよう拡張する必要がある。

**セキュリティ上の要点**: 画像関連フィールドは、既存の `validateRegistrationDraft`(内部で `validateImage` を呼ぶ。pbs.twimg.com / img.youtube.com / OGP allowlist のホスト検証、tweetId/youtubeVideoId の形式検証を行う)を必ず経由させる。生の `req.body` の値を検証せずに `updatePayload` へ書き込むと、ホスト検証をバイパスできてしまう。そのため画像フィールドは `draftForValidation` (`validateRegistrationDraft` に渡す対象) に含め、バリデーション通過後の `draftForValidation` の値だけを `updatePayload` に反映する。

- [ ] **Step 1: import に Storage と FieldValue を追加する**

`api/housing/_updateListingHandler.ts` の import群に追加:

```typescript
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
```

- [ ] **Step 2: `draftForValidation` に画像フィールドを含める**

現状の `draftForValidation` 構築 (58-79行目) を次のように差し替える (末尾に画像フィールドを追加するだけで、既存フィールドは変更しない):

```typescript
    const draftForValidation: RegistrationDraft = {
      dc: updates.dc,
      server: updates.server,
      area: updates.area,
      ward: updates.ward,
      buildingType: updates.buildingType,
      ...(updates.buildingType === 'house'
        ? { plot: updates.plot, size: updates.size }
        : {}),
      ...(updates.buildingType === 'apartment'
        ? { apartmentBuilding: updates.apartmentBuilding }
        : {}),
      ...(updates.roomKind
        ? { roomKind: updates.roomKind, roomNumber: updates.roomNumber }
        : {}),
      tags: updates.tags ?? [],
      description: updates.description,
      title: updates.title,
      visibility: updates.visibility,
      publishUntil: updates.publishUntil,
      // 画像関連フィールド (2026-07-20 編集ページ画像管理設計): 編集ページで登録方法
      // (アップロード⇔URL) を切り替えたときに送られてくる。imageMode は 'sns' の
      // ときだけ意味を持つ (それ以外は validateImage が postUrl だけ見る)。
      // postUrl は imageMode と独立したフィールドとして扱う既存方針により常に含める。
      imageMode: updates.imageMode === 'sns' ? 'sns' : undefined,
      postUrl: updates.postUrl,
      ogImageUrl: updates.ogImageUrl,
      tweetId: updates.tweetId,
      youtubeVideoId: updates.youtubeVideoId,
      sourceImageUrls: updates.sourceImageUrls,
      sourceImageAspectRatios: updates.sourceImageAspectRatios,
      videoUrl: updates.videoUrl,
      videoPosterUrl: updates.videoPosterUrl,
      videoAspectRatio: updates.videoAspectRatio,
    } as RegistrationDraft;
```

- [ ] **Step 3: バリデーション済みの値を `updatePayload` へ反映 + thumbnail→sns切替クリーンアップ**

現状の該当箇所 (103-168行目、`const listingRef = ...` から関数末尾まで) を、次の内容にまるごと差し替える:

```typescript
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    let switchedFromThumbnail = false;

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      // 削除済みは編集不可 (not_found を返してリーク防止)
      if (data.deletedAt) throw new Error('not_found');

      // 更新ペイロード: undefined のフィールドは除外して既存値を残す
      const updatePayload: Record<string, unknown> = {
        dc: draftForValidation.dc,
        server: draftForValidation.server,
        area: draftForValidation.area,
        ward: draftForValidation.ward,
        buildingType: draftForValidation.buildingType,
        addressKey,
        tags: draftForValidation.tags,
        updatedAt: Date.now(),
      };
      if (draftForValidation.buildingType === 'house') {
        updatePayload.plot = draftForValidation.plot;
        updatePayload.size = draftForValidation.size;
      }
      if (draftForValidation.buildingType === 'apartment' && draftForValidation.apartmentBuilding) {
        updatePayload.apartmentBuilding = draftForValidation.apartmentBuilding;
      }
      if (draftForValidation.roomKind) {
        updatePayload.roomKind = draftForValidation.roomKind;
        updatePayload.roomNumber = draftForValidation.roomNumber;
      }
      if (typeof draftForValidation.description === 'string') {
        updatePayload.description = draftForValidation.description;
      }
      if (
        draftForValidation.visibility === 'public'
        || draftForValidation.visibility === 'unlisted'
        || draftForValidation.visibility === 'private'
      ) {
        updatePayload.visibility = draftForValidation.visibility;
      }
      if ('publishUntil' in draftForValidation) {
        updatePayload.publishUntil =
          draftForValidation.visibility === 'unlisted' || draftForValidation.visibility === 'private'
            ? null
            : normalizePublishUntil(draftForValidation.publishUntil);
      }
      if (typeof draftForValidation.title === 'string' && draftForValidation.title.trim()) {
        updatePayload.title = draftForValidation.title.trim();
      }

      // 画像関連フィールド (2026-07-20 編集ページ画像管理設計、バリデーション済みの
      // draftForValidation から読む。生の req.body を直接使わない → セキュリティ上の要点参照)。
      if (typeof draftForValidation.postUrl === 'string') {
        updatePayload.postUrl = draftForValidation.postUrl;
      }
      if (draftForValidation.imageMode === 'sns') {
        updatePayload.imageMode = 'sns';
        if (typeof draftForValidation.ogImageUrl === 'string') {
          updatePayload.ogImageUrl = draftForValidation.ogImageUrl;
        }
        if (typeof draftForValidation.tweetId === 'string') {
          updatePayload.tweetId = draftForValidation.tweetId;
        }
        if (typeof draftForValidation.youtubeVideoId === 'string') {
          updatePayload.youtubeVideoId = draftForValidation.youtubeVideoId;
        }
        if (Array.isArray(draftForValidation.sourceImageUrls)) {
          updatePayload.sourceImageUrls = draftForValidation.sourceImageUrls;
        }
        if (Array.isArray(draftForValidation.sourceImageAspectRatios)) {
          updatePayload.sourceImageAspectRatios = draftForValidation.sourceImageAspectRatios;
        }
        if (typeof draftForValidation.videoUrl === 'string') {
          updatePayload.videoUrl = draftForValidation.videoUrl;
        }
        if (typeof draftForValidation.videoPosterUrl === 'string') {
          updatePayload.videoPosterUrl = draftForValidation.videoPosterUrl;
        }
        if (typeof draftForValidation.videoAspectRatio === 'number') {
          updatePayload.videoAspectRatio = draftForValidation.videoAspectRatio;
        }

        // thumbnail→sns の登録方法切替クリーンアップ: 保存済みが thumbnail で、今回
        // sns に切り替わるなら、Storage 上の画像ファイルを全削除し
        // thumbnailPaths/thumbnailPath をクリアする (実ファイル削除はトランザクションの外側)。
        if (data.imageMode === 'thumbnail') {
          updatePayload.thumbnailPaths = FieldValue.delete();
          updatePayload.thumbnailPath = FieldValue.delete();
          switchedFromThumbnail = true;
        }
      }

      tx.update(listingRef, updatePayload);
      bumpPublicVersionTx(tx, adminDb);
    });

    // Storageファイルの実削除はトランザクション成功後 (Task 2 の delete-thumbnail と同じ理由:
    // Storage削除の失敗でFirestoreの更新を巻き戻さない)。
    if (switchedFromThumbnail) {
      try {
        await getStorage().bucket().deleteFiles({ prefix: `housing/listings/${listingId}/` });
      } catch (e) {
        console.error('[housing/update-listing] thumbnail cleanup failed (non-fatal):', e);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    console.error('[housing/update-listing] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
```

- [ ] **Step 4: ビルドが通ることを確認**

Run: `npx tsc -b --noEmit`
Expected: エラー無し

- [ ] **Step 5: コミット**

```bash
git add api/housing/_updateListingHandler.ts
git commit -m "feat(housing): update-listingで画像フィールド永続化+thumbnail→sns切替クリーンアップ"
```

---

### Task 8: クライアントAPI関数

**Files:**
- Modify: `src/lib/housingApiClient.ts`

**Interfaces:**
- Consumes: Task 2〜5 の4アクション
- Produces: `deleteListingThumbnail` / `reorderListingThumbnails` / `deleteListingSourceImage` / `reorderListingSourceImages` — Plan B (クライアントUI) がこれらを直接使う。

- [ ] **Step 1: 4つの関数を `uploadListingThumbnail` の直後に追加する**

```typescript
export interface DeleteThumbnailResponse {
  success: boolean;
  thumbnailPaths: string[];
}

/** 直接アップロード画像を1枚削除する。削除すると後続が繰り上がる。最後の1枚は拒否 (400 'last_item')。 */
export async function deleteListingThumbnail(params: {
  listingId: string;
  index: number;
}): Promise<DeleteThumbnailResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=delete-thumbnail`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `delete-thumbnail failed: ${res.status}`);
  }
  return (await res.json()) as DeleteThumbnailResponse;
}

export interface ReorderThumbnailsResponse {
  success: boolean;
  thumbnailPaths: string[];
}

/** 直接アップロード画像の並び順を変更する。newOrder は現在の thumbnailPaths と同じ要素集合であること。 */
export async function reorderListingThumbnails(params: {
  listingId: string;
  newOrder: string[];
}): Promise<ReorderThumbnailsResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=reorder-thumbnails`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `reorder-thumbnails failed: ${res.status}`);
  }
  return (await res.json()) as ReorderThumbnailsResponse;
}

export interface DeleteSourceImageResponse {
  success: boolean;
  sourceImageUrls: string[];
}

/** URL経由画像を1枚削除する。削除すると後続が繰り上がる。最後の1枚は拒否 (400 'last_item')。 */
export async function deleteListingSourceImage(params: {
  listingId: string;
  index: number;
}): Promise<DeleteSourceImageResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=delete-source-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `delete-source-image failed: ${res.status}`);
  }
  return (await res.json()) as DeleteSourceImageResponse;
}

export interface ReorderSourceImagesResponse {
  success: boolean;
  sourceImageUrls: string[];
}

/** URL経由画像の並び順を変更する。newOrder は現在の sourceImageUrls と同じ要素集合であること。 */
export async function reorderListingSourceImages(params: {
  listingId: string;
  newOrder: string[];
}): Promise<ReorderSourceImagesResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=reorder-source-images`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `reorder-source-images failed: ${res.status}`);
  }
  return (await res.json()) as ReorderSourceImagesResponse;
}
```

- [ ] **Step 2: ビルドが通ることを確認**

Run: `npx tsc -b --noEmit`
Expected: エラー無し

- [ ] **Step 3: コミット**

```bash
git add src/lib/housingApiClient.ts
git commit -m "feat(housing): 画像削除/並び替えのクライアントAPI関数を追加"
```

---

## 最終ゲート (このPlanの全タスク完了後に1回だけ実行)

- [ ] **Step 1: フルテスト**

Run: `npx vitest run`
Expected: 既知の EphemeralAddPanel 7件の失敗以外は全てPASS

- [ ] **Step 2: フルビルド**

Run: `npm run build`
Expected: エラー無し (exit code 0)

- [ ] **Step 3: 実装差分の自己レビュー**

以下を必ず確認する (データ削除を伴う機能のため):
1. 4つの新規ハンドラーすべてが `ownerUid !== uid` を弾いているか (他人の物件を操作できないか)
2. `computeArrayDeletion` の `last_item` ガードが全ての削除アクションで効いているか (画像0枚の物件が作れてしまわないか)
3. `delete-thumbnail` / `update-listing` (thumbnail→sns切替) の Storage 削除が、Firestore更新の**後**に実行されているか (Firestore更新前にStorageを消すと、その後のFirestore更新失敗時に「Firestoreはまだ古い画像を指しているのにファイルは消えている」不整合が起きるため)
4. `reorder-thumbnails` / `reorder-source-images` が `computeArrayReorder` の検証を通さずに任意の配列を書き込めてしまう経路が無いか
