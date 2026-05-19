# 廃止プロバイダーユーザー削除 (Step 1) 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `scripts/delete-legacy-users.ts` を実装し、 prod の廃止プロバイダーユーザー 14 件 (Twitter 12 + Google 2) を関連データ含めて完全削除する。 hash 化マイグレーション (Step 2) の前提条件を整える。

**Architecture:** 単一 TypeScript script。 既存 `scripts/check-admin-claims.ts` / `scripts/backup-user-data.ts` のパターンを踏襲 (firebase-admin SDK 直接、 `.env.local` から credential 読み込み)。 TARGET_UIDS は gitignored JSON ファイルから読み込み (個人情報を public repo に含めないため)。 Dry-Run がデフォルト、 `--execute --confirm` で本実行。 1 uid につき sequential に Firestore → cross-refs → Storage → Auth の順で削除 (Auth は復元不能のため最後)。

**Tech Stack:** TypeScript / `firebase-admin/firestore` / `firebase-admin/auth` / `firebase-admin/storage` / `npx tsx` (実行) / Vitest (pure logic 部分のみ)

**実装方針 (= spec §6 と整合):**
- Firebase に触る部分は dev 環境で再現不能なので unit test 不要、 dry-run output を「テスト」 扱いとする
- pure logic 部分 (CLI flag 解析、 prefix 検証) のみ vitest で軽量テスト
- 1 task 完了ごとに commit (Vercel 帯域は scripts/ 変更では消費されない)

---

## File Structure

| 種別 | パス | 責任 |
|---|---|---|
| 新規 (gitignored) | `docs/.private/legacy-target-uids.json` | TARGET_UIDS 14 件 (Twitter 12 + Google 2) の実値を保持。 git には上げない |
| 新規 | `scripts/delete-legacy-users.ts` | 本体スクリプト。 Dry-run + Execute 両モードを 1 ファイルで実装 |
| 新規 | `scripts/__tests__/delete-legacy-users.test.ts` | Pure logic (parseFlags, assertSafeTargets) の vitest テスト |
| 既存 (参照) | `scripts/check-admin-claims.ts` | env 読み込み + admin claim 確認パターン参考、 削除後の検証にも使う |
| 既存 (参照) | `scripts/backup-user-data.ts` | Firestore 読み込みパターン参考 |
| 既存 (参照) | `scripts/seed-icons.ts` | Storage bucket 取得パターン参考 |
| 既存 (modify) | `docs/TODO.md` | Step 1 完了に伴う更新 |
| 既存 (modify) | `docs/TODO_COMPLETED.md` | Step 1 完了記録 |

---

## Task 1: TARGET_UIDS JSON ファイルとスクリプト雛形を作る

**Files:**
- Create: `docs/.private/legacy-target-uids.json` (gitignored)
- Create: `scripts/delete-legacy-users.ts`

- [ ] **Step 1: TARGET_UIDS JSON テンプレートを作成**

ユーザーに「`docs/.private/2026-05-19-hash-migration-prep.md` から 14 件の uid を転記してください」 と依頼する形式にする。 ファイルは存在チェック + バリデーション付きで読み込む。

Create `docs/.private/legacy-target-uids.json` (実 uid はユーザーが手動で記入):

```json
{
  "_comment": "Step 1 (廃止プロバイダーユーザー削除) の対象 uid リスト。 hash 化マイグレーション準備メモから転記。 .private/ 配下なので gitignored。",
  "twitter": [
    "twitter:REPLACE_ME_1",
    "twitter:REPLACE_ME_2",
    "twitter:REPLACE_ME_3",
    "twitter:REPLACE_ME_4",
    "twitter:REPLACE_ME_5",
    "twitter:REPLACE_ME_6",
    "twitter:REPLACE_ME_7",
    "twitter:REPLACE_ME_8",
    "twitter:REPLACE_ME_9",
    "twitter:REPLACE_ME_10",
    "twitter:REPLACE_ME_11",
    "twitter:REPLACE_ME_12"
  ],
  "google": [
    "google:REPLACE_ME_1",
    "google:REPLACE_ME_2"
  ]
}
```

実行時に「人間がここを実値で埋める」 段階を Task 7 (dry-run before execute) で挟む。 本プランの subagent 実装段階では `REPLACE_ME_*` のままで OK (Task 7 で人間が置換)。

- [ ] **Step 2: スクリプトスケルトンを作成**

Create `scripts/delete-legacy-users.ts`:

```typescript
/**
 * delete-legacy-users.ts
 * 廃止プロバイダー (Twitter/Google) のユーザー 14 件を関連データ含めて完全削除。
 *
 * モード:
 *   - npx tsx scripts/delete-legacy-users.ts                   → Dry-Run (削除対象を pre-count するだけ)
 *   - npx tsx scripts/delete-legacy-users.ts --execute --confirm → 本実行
 *
 * 削除順 (1 uid あたり):
 *   1. Firestore documents
 *   2. Cross-references (他人の copiedBy / reports.reporterUid)
 *   3. Firebase Storage files
 *   4. Firebase Auth account (最後、 復元不能)
 *
 * 安全策:
 *   - TARGET_UIDS は docs/.private/legacy-target-uids.json から読み込み (gitignored)
 *   - prefix が twitter:/google: 以外なら abort (本人 Discord uid を構造的保護)
 *   - admin claim を持つ uid を検出したら abort
 *   - idempotent (再実行で既消去分は skip)
 *
 * 設計書: docs/superpowers/specs/2026-05-20-legacy-user-cleanup-design.md
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

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

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const storageBucket = env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app';

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ FIREBASE 認証情報が .env.local にありません');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket });
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

export interface ParsedFlags {
  execute: boolean;
  confirm: boolean;
}

export function parseFlags(argv: string[]): ParsedFlags {
  const set = new Set(argv);
  return { execute: set.has('--execute'), confirm: set.has('--confirm') };
}

export function loadTargetUids(jsonPath: string): string[] {
  let raw: string;
  try {
    raw = readFileSync(jsonPath, 'utf-8');
  } catch {
    throw new Error(`TARGET_UIDS ファイル ${jsonPath} が読めません。 docs/.private/2026-05-19-hash-migration-prep.md から uid を転記してください`);
  }
  const parsed = JSON.parse(raw) as { twitter?: string[]; google?: string[] };
  const uids = [...(parsed.twitter ?? []), ...(parsed.google ?? [])];
  if (uids.some((u) => u.includes('REPLACE_ME'))) {
    throw new Error(`TARGET_UIDS にプレースホルダー REPLACE_ME が残っています。 実値で置き換えてください: ${jsonPath}`);
  }
  return uids;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const targetUids = loadTargetUids(resolve(ROOT, 'docs/.private/legacy-target-uids.json'));

  console.log(`Mode: ${flags.execute && flags.confirm ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`Target uids: ${targetUids.length}`);

  // Task 2 以降で実装
  if (flags.execute && !flags.confirm) {
    console.error('❌ --execute を指定するときは --confirm も必須です (誤起動防止)');
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
```

- [ ] **Step 3: テンプレート JSON ファイルの動作確認**

Run: `npx tsx scripts/delete-legacy-users.ts`

Expected output: `❌ TARGET_UIDS にプレースホルダー REPLACE_ME が残っています...` (= 安全に abort)

- [ ] **Step 4: Commit**

```bash
git add scripts/delete-legacy-users.ts docs/.private/legacy-target-uids.json
# .private/ は gitignored なので JSON は実際は staged されない。 確認:
git status
# scripts/delete-legacy-users.ts のみ staged されているはず
git commit -m "feat(scripts): delete-legacy-users.ts 雛形 + TARGET_UIDS ロード"
```

---

## Task 2: 安全 assert (prefix + admin claim) を実装

**Files:**
- Modify: `scripts/delete-legacy-users.ts` (assertSafeTargets 関数追加)
- Create: `scripts/__tests__/delete-legacy-users.test.ts`

- [ ] **Step 1: vitest 用テストを作成 (pure logic 部分)**

Create `scripts/__tests__/delete-legacy-users.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseFlags, assertPrefixSafe } from '../delete-legacy-users';

describe('parseFlags', () => {
  it('returns defaults when no args', () => {
    expect(parseFlags([])).toEqual({ execute: false, confirm: false });
  });

  it('detects --execute', () => {
    expect(parseFlags(['--execute'])).toEqual({ execute: true, confirm: false });
  });

  it('detects --execute --confirm', () => {
    expect(parseFlags(['--execute', '--confirm'])).toEqual({ execute: true, confirm: true });
  });
});

describe('assertPrefixSafe', () => {
  it('passes for all twitter:/google: prefixes', () => {
    expect(() => assertPrefixSafe(['twitter:abc', 'google:xyz'])).not.toThrow();
  });

  it('throws if any discord: prefix is present', () => {
    expect(() => assertPrefixSafe(['twitter:abc', 'discord:123'])).toThrow(/discord:/);
  });

  it('throws if any unknown prefix is present', () => {
    expect(() => assertPrefixSafe(['custom:abc'])).toThrow(/unexpected prefix/i);
  });

  it('throws if list is empty', () => {
    expect(() => assertPrefixSafe([])).toThrow(/empty/i);
  });
});
```

- [ ] **Step 2: vitest を実行して失敗を確認**

Run: `npm test -- delete-legacy-users`

Expected: FAIL (関数 `assertPrefixSafe` が未定義)

- [ ] **Step 3: `assertPrefixSafe` を実装**

`scripts/delete-legacy-users.ts` の `parseFlags` の下に追加:

```typescript
export function assertPrefixSafe(uids: string[]): void {
  if (uids.length === 0) {
    throw new Error('TARGET_UIDS is empty');
  }
  for (const uid of uids) {
    if (uid.startsWith('discord:')) {
      throw new Error(`Refusing to delete discord: uid: ${uid}. Step 1 は廃止プロバイダー専用です。`);
    }
    if (!uid.startsWith('twitter:') && !uid.startsWith('google:')) {
      throw new Error(`Unexpected prefix in TARGET_UIDS: ${uid}. twitter:/google: 以外は処理しません。`);
    }
  }
}
```

- [ ] **Step 4: vitest をパス確認**

Run: `npm test -- delete-legacy-users`

Expected: PASS

- [ ] **Step 5: admin claim 確認関数を実装 (Firebase に触るので vitest なし、 dry-run で検証)**

`scripts/delete-legacy-users.ts` に追加:

```typescript
async function assertNoAdminClaims(uids: string[]): Promise<void> {
  for (const uid of uids) {
    try {
      const user = await auth.getUser(uid);
      const claims = user.customClaims ?? {};
      if (claims.role === 'admin') {
        throw new Error(`Refusing to delete admin user: ${uid}. admin claim をクリアしてから再実行してください。`);
      }
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        continue; // 既に消えてる → OK
      }
      throw err;
    }
  }
}
```

`main()` の `Target uids: ...` の console.log 直後に追加:

```typescript
  assertPrefixSafe(targetUids);
  await assertNoAdminClaims(targetUids);
  console.log('✅ 安全チェック通過: prefix OK / admin claim なし');
```

- [ ] **Step 6: dry-run 実行で safety check の動作確認**

`docs/.private/legacy-target-uids.json` の `REPLACE_ME` のうち 1 つを `twitter:test_safety_check` に置き換えて実行 (実 uid を入れなくてよい、 prefix check の動作のみ確認):

Run: `npx tsx scripts/delete-legacy-users.ts`

Expected: `❌ TARGET_UIDS にプレースホルダー REPLACE_ME が残っています...` (まだ 13 件 REPLACE_ME 残ってるため)

→ 全 14 件を `twitter:safetycheck_N` / `google:safetycheck_N` に書き換えてから再実行:

Expected: `✅ 安全チェック通過` (もし admin claim を持つ uid が混ざってたら abort)

実行後は JSON を元に戻す (Task 7 の本物 dry-run で実 uid を入れる)。

- [ ] **Step 7: Commit**

```bash
git add scripts/delete-legacy-users.ts scripts/__tests__/delete-legacy-users.test.ts
git commit -m "feat(scripts): 安全 assert (prefix + admin claim) を追加"
```

---

## Task 3: Firestore document pre-count 関数を実装

**Files:**
- Modify: `scripts/delete-legacy-users.ts` (countFirestoreDocs 関数追加)

- [ ] **Step 1: 集計用の型定義を追加**

`assertPrefixSafe` の下に追加:

```typescript
interface FirestoreCounts {
  users: number;
  plans: number;
  sharedPlanMeta: number;
  sharedPlans: number;
  sharedPlansCopiedBy: number;
  sharedPlansAnonCopiedBy: number;
  userPlanCounts: number;
  housingUserMeta: number;
  housingListings: number;
  housingListingsReports: number;
  housingFavoritesItems: number;
  featureSessions: number;
}
```

- [ ] **Step 2: `countFirestoreDocs` を実装**

```typescript
async function countFirestoreDocs(uid: string): Promise<FirestoreCounts> {
  const counts: FirestoreCounts = {
    users: 0,
    plans: 0,
    sharedPlanMeta: 0,
    sharedPlans: 0,
    sharedPlansCopiedBy: 0,
    sharedPlansAnonCopiedBy: 0,
    userPlanCounts: 0,
    housingUserMeta: 0,
    housingListings: 0,
    housingListingsReports: 0,
    housingFavoritesItems: 0,
    featureSessions: 0,
  };

  const userDoc = await db.collection('users').doc(uid).get();
  counts.users = userDoc.exists ? 1 : 0;

  const plansSnap = await db.collection('plans').where('ownerId', '==', uid).get();
  counts.plans = plansSnap.size;

  const metaSnap = await db.collection('sharedPlanMeta').where('ownerId', '==', uid).get();
  counts.sharedPlanMeta = metaSnap.size;

  const sharedSnap = await db.collection('shared_plans').where('ownerId', '==', uid).get();
  counts.sharedPlans = sharedSnap.size;
  for (const doc of sharedSnap.docs) {
    const copiedBySnap = await doc.ref.collection('copiedBy').get();
    counts.sharedPlansCopiedBy += copiedBySnap.size;
    const anonSnap = await doc.ref.collection('anonCopiedBy').get();
    counts.sharedPlansAnonCopiedBy += anonSnap.size;
  }

  const countDoc = await db.collection('userPlanCounts').doc(uid).get();
  counts.userPlanCounts = countDoc.exists ? 1 : 0;

  const meta2 = await db.collection('housing_user_meta').doc(uid).get();
  counts.housingUserMeta = meta2.exists ? 1 : 0;

  const listingsSnap = await db.collection('housing_listings').where('ownerUid', '==', uid).get();
  counts.housingListings = listingsSnap.size;
  for (const doc of listingsSnap.docs) {
    const reportsSnap = await doc.ref.collection('reports').get();
    counts.housingListingsReports += reportsSnap.size;
  }

  const favItemsSnap = await db.collection('housing_favorites').doc(uid).collection('items').get();
  counts.housingFavoritesItems = favItemsSnap.size;

  const sessSnap = await db.collection('users').doc(uid).collection('featureSessions').get();
  counts.featureSessions = sessSnap.size;

  return counts;
}
```

- [ ] **Step 3: main() に組み込んで動作確認**

`main()` の `console.log('✅ 安全チェック通過...')` の下に追加:

```typescript
  console.log('\n--- Firestore pre-count ---');
  for (let i = 0; i < targetUids.length; i++) {
    const uid = targetUids[i];
    const counts = await countFirestoreDocs(uid);
    console.log(`[${(i + 1).toString().padStart(2)}/${targetUids.length}] ${uid}`);
    console.log(`  users:${counts.users} plans:${counts.plans} meta:${counts.sharedPlanMeta} shared:${counts.sharedPlans}(c:${counts.sharedPlansCopiedBy} a:${counts.sharedPlansAnonCopiedBy}) ucnt:${counts.userPlanCounts} hMeta:${counts.housingUserMeta} hList:${counts.housingListings}(r:${counts.housingListingsReports}) hFav:${counts.housingFavoritesItems} sess:${counts.featureSessions}`);
  }
```

JSON の REPLACE_ME を 14 件全部 `twitter:safetycheck_N` / `google:safetycheck_N` に書き換えて実行:

Run: `npx tsx scripts/delete-legacy-users.ts`

Expected: 14 行出力、 全カウント 0 (存在しない uid なので)。 エラーなし。

実行後は JSON を REPLACE_ME に戻す。

- [ ] **Step 4: Commit**

```bash
git add scripts/delete-legacy-users.ts
git commit -m "feat(scripts): Firestore document pre-count を追加"
```

---

## Task 4: Cross-reference pre-count (他人の copiedBy / reports) を実装

**Files:**
- Modify: `scripts/delete-legacy-users.ts`

- [ ] **Step 1: 型と関数を追加**

`FirestoreCounts` の下に:

```typescript
interface CrossRefCounts {
  copiedByHits: number;
  reportsHits: number;
}

async function countCrossRefs(uid: string): Promise<CrossRefCounts> {
  let copiedByHits = 0;
  const allShared = await db.collection('shared_plans').get();
  for (const doc of allShared.docs) {
    const ref = doc.ref.collection('copiedBy').doc(uid);
    const snap = await ref.get();
    if (snap.exists) copiedByHits++;
  }

  let reportsHits = 0;
  const allListings = await db.collection('housing_listings').get();
  for (const doc of allListings.docs) {
    const reportsSnap = await doc.ref.collection('reports').where('reporterUid', '==', uid).get();
    reportsHits += reportsSnap.size;
  }

  return { copiedByHits, reportsHits };
}
```

- [ ] **Step 2: main() に組み込む**

Firestore pre-count loop の中、 `console.log(\`[${...} ${uid}\`)` の下に追加:

```typescript
    const xrefs = await countCrossRefs(uid);
    console.log(`  xref copiedBy:${xrefs.copiedByHits} reports:${xrefs.reportsHits}`);
```

- [ ] **Step 3: ダミー uid で実行確認**

Run: `npx tsx scripts/delete-legacy-users.ts` (JSON は safetycheck uids のまま)

Expected: 各 uid 行の下に `xref copiedBy:0 reports:0` が出力 (該当なし)

- [ ] **Step 4: Commit**

```bash
git add scripts/delete-legacy-users.ts
git commit -m "feat(scripts): cross-reference pre-count (copiedBy / reports) を追加"
```

---

## Task 5: Storage + Auth pre-count を実装

**Files:**
- Modify: `scripts/delete-legacy-users.ts`

- [ ] **Step 1: Storage + Auth 集計関数を追加**

```typescript
interface StorageAuthCounts {
  storageFiles: number;
  authExists: boolean;
  authProvider: string | null;
  isAdmin: boolean;
}

async function countStorageAndAuth(uid: string): Promise<StorageAuthCounts> {
  const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
  let authExists = false;
  let authProvider: string | null = null;
  let isAdmin = false;
  try {
    const user = await auth.getUser(uid);
    authExists = true;
    authProvider = user.providerData[0]?.providerId ?? (uid.startsWith('twitter:') ? 'twitter' : uid.startsWith('google:') ? 'google' : 'custom');
    isAdmin = user.customClaims?.role === 'admin';
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }
  return { storageFiles: files.length, authExists, authProvider, isAdmin };
}
```

- [ ] **Step 2: main() に組み込む**

cross-ref output の下に追加:

```typescript
    const sa = await countStorageAndAuth(uid);
    console.log(`  storage:${sa.storageFiles} auth:${sa.authExists ? sa.authProvider : 'not-found'}`);
```

- [ ] **Step 3: ダミー uid で実行**

Run: `npx tsx scripts/delete-legacy-users.ts` (safetycheck uids)

Expected: 各行に `storage:0 auth:not-found` (存在しない uid なので)

- [ ] **Step 4: Commit**

```bash
git add scripts/delete-legacy-users.ts
git commit -m "feat(scripts): Storage + Auth pre-count を追加"
```

---

## Task 6: Dry-run 出力フォーマットを整える + summary 集計

**Files:**
- Modify: `scripts/delete-legacy-users.ts`

- [ ] **Step 1: 集計データ構造を導入 + 整形出力**

main() の Firestore pre-count loop 全体を以下に置き換え (spec §4.3 のフォーマット):

```typescript
  console.log('\n=== DRY RUN: Legacy User Cleanup ===');
  console.log(`Target uids: ${targetUids.length}\n`);

  let totalFirestoreDocs = 0;
  let totalStorageFiles = 0;
  let totalAuthAccounts = 0;
  let totalAdminHits = 0;
  let totalXrefCopiedBy = 0;
  let totalXrefReports = 0;

  for (let i = 0; i < targetUids.length; i++) {
    const uid = targetUids[i];
    const counts = await countFirestoreDocs(uid);
    const xrefs = await countCrossRefs(uid);
    const sa = await countStorageAndAuth(uid);

    const isAdmin = sa.isAdmin;

    const firestoreSubtotal =
      counts.users + counts.plans + counts.sharedPlanMeta +
      counts.sharedPlans + counts.sharedPlansCopiedBy + counts.sharedPlansAnonCopiedBy +
      counts.userPlanCounts + counts.housingUserMeta +
      counts.housingListings + counts.housingListingsReports +
      counts.housingFavoritesItems + counts.featureSessions;
    totalFirestoreDocs += firestoreSubtotal;
    totalStorageFiles += sa.storageFiles;
    if (sa.authExists) totalAuthAccounts += 1;
    if (isAdmin) totalAdminHits += 1;
    totalXrefCopiedBy += xrefs.copiedByHits;
    totalXrefReports += xrefs.reportsHits;

    console.log(`[${(i + 1).toString().padStart(2)}/${targetUids.length}] ${uid}`);
    console.log(`  - users doc:                ${counts.users === 1 ? 'exists' : 'not found'}`);
    console.log(`  - plans (ownerId match):    ${counts.plans}`);
    console.log(`  - sharedPlanMeta:           ${counts.sharedPlanMeta}`);
    console.log(`  - shared_plans:             ${counts.sharedPlans} (copiedBy/anonCopiedBy: ${counts.sharedPlansCopiedBy}/${counts.sharedPlansAnonCopiedBy})`);
    console.log(`  - userPlanCounts:           ${counts.userPlanCounts === 1 ? 'exists' : 'not found'}`);
    console.log(`  - housing_user_meta:        ${counts.housingUserMeta === 1 ? 'exists' : 'not found'}`);
    console.log(`  - housing_listings:         ${counts.housingListings} (reports: ${counts.housingListingsReports})`);
    console.log(`  - housing_favorites items:  ${counts.housingFavoritesItems}`);
    console.log(`  - featureSessions:          ${counts.featureSessions}`);
    console.log(`  - cross-ref copiedBy hits:  ${xrefs.copiedByHits}`);
    console.log(`  - cross-ref reports hits:   ${xrefs.reportsHits}`);
    console.log(`  - Storage files:            ${sa.storageFiles}`);
    console.log(`  - Auth account:             ${sa.authExists ? `exists (provider: ${sa.authProvider})` : 'not found'}`);
    console.log(`  - admin claim:              ${isAdmin ? '*** ADMIN ***' : 'none ✓'}`);
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Total Firestore documents to delete: ${totalFirestoreDocs}`);
  console.log(`Total cross-ref (copiedBy/reports) to delete: ${totalXrefCopiedBy}/${totalXrefReports}`);
  console.log(`Total Storage files to delete: ${totalStorageFiles}`);
  console.log(`Total Auth accounts to delete: ${totalAuthAccounts}`);
  console.log(`Admin claim hits (must be 0): ${totalAdminHits}${totalAdminHits === 0 ? ' ✓' : ' ❌'}`);

  if (!flags.execute) {
    console.log('\nRe-run with --execute --confirm to perform deletion.');
    return;
  }
```

- [ ] **Step 2: ダミー uid で実行確認**

Run: `npx tsx scripts/delete-legacy-users.ts` (safetycheck uids)

Expected: フォーマット通りに 14 件 + Summary が出力、 全て 0 件 / not found

- [ ] **Step 3: Commit**

```bash
git add scripts/delete-legacy-users.ts
git commit -m "feat(scripts): dry-run 出力フォーマット + summary 集計を追加"
```

---

## Task 7: **【人間チェックポイント】** 本物 uid で dry-run 実行 + 出力レビュー

**Files:**
- Modify (manual, gitignored): `docs/.private/legacy-target-uids.json`

> このタスクは**人間が実行する**。 subagent には触らせない。 dry-run output を見て「想定通り」 と判断したら次の Task 8 へ。

- [ ] **Step 1: 実 uid を JSON に転記**

`docs/.private/2026-05-19-hash-migration-prep.md` § 「23 ユーザー内訳」 から:
- Twitter 12 件を `docs/.private/legacy-target-uids.json` の `twitter` 配列に転記
- Google 2 件を `google` 配列に転記 (実 uid は準備メモ参照)

- [ ] **Step 2: Dry-run を実行**

Run: `npx tsx scripts/delete-legacy-users.ts`

- [ ] **Step 3: 出力を目視確認**

確認項目:
- `Target uids: 14` か?
- 全 14 件で safety check 通過 (admin claim hits: 0) か?
- `Total Firestore documents to delete:` が想定範囲 (30 〜 80 程度) か? 異常に多ければ調査
- `Total Storage files to delete:` が想定 (10 件以下) か?
- `Total Auth accounts to delete: 14` か?
- 各 uid の `housing_listings` が 0 件か (廃止プロバイダーが Phase 1 ハウジング登録してたら要再評価)?
- 各 uid の `cross-ref copiedBy hits` / `reports hits` が 0 か? 0 でなければ、 該当ユーザーが他人のデータに残してる証跡 → 削除して問題ないか判断

- [ ] **Step 4: 判定**

- ✅ 全て想定通り → Task 8 に進む
- ⚠️ 想定外 → 内容を確認の上、 (a) 削除して問題ないことを確認したら Task 8 に進む / (b) spec 改訂が必要なら brainstorming に戻る

このチェックポイントは **commit を作らない** (人間レビューのみ)。

---

## Task 8: Firestore document 削除関数を実装

**Files:**
- Modify: `scripts/delete-legacy-users.ts`

- [ ] **Step 1: 削除ヘルパー関数を追加**

`countStorageAndAuth` の下に追加:

```typescript
async function deleteDocsByQuery(query: FirebaseFirestore.Query): Promise<number> {
  const snap = await query.get();
  if (snap.empty) return 0;
  const batch = db.batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
  return snap.size;
}

async function deleteSubcollection(parentRef: FirebaseFirestore.DocumentReference, name: string): Promise<number> {
  const snap = await parentRef.collection(name).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
  return snap.size;
}

async function deleteFirestoreForUid(uid: string): Promise<{ docs: number }> {
  let docs = 0;

  docs += await deleteDocsByQuery(db.collection('plans').where('ownerId', '==', uid));
  docs += await deleteDocsByQuery(db.collection('sharedPlanMeta').where('ownerId', '==', uid));

  const sharedSnap = await db.collection('shared_plans').where('ownerId', '==', uid).get();
  for (const doc of sharedSnap.docs) {
    docs += await deleteSubcollection(doc.ref, 'copiedBy');
    docs += await deleteSubcollection(doc.ref, 'anonCopiedBy');
    await doc.ref.delete();
    docs += 1;
  }

  const countRef = db.collection('userPlanCounts').doc(uid);
  if ((await countRef.get()).exists) { await countRef.delete(); docs += 1; }

  const metaRef = db.collection('housing_user_meta').doc(uid);
  if ((await metaRef.get()).exists) { await metaRef.delete(); docs += 1; }

  const listingsSnap = await db.collection('housing_listings').where('ownerUid', '==', uid).get();
  for (const doc of listingsSnap.docs) {
    docs += await deleteSubcollection(doc.ref, 'reports');
    await doc.ref.delete();
    docs += 1;
  }

  const favRef = db.collection('housing_favorites').doc(uid);
  docs += await deleteSubcollection(favRef, 'items');
  if ((await favRef.get()).exists) { await favRef.delete(); docs += 1; }

  const userRef = db.collection('users').doc(uid);
  docs += await deleteSubcollection(userRef, 'featureSessions');
  if ((await userRef.get()).exists) { await userRef.delete(); docs += 1; }

  return { docs };
}
```

- [ ] **Step 2: Commit**

実行はまだしない (Task 11 で main() に組み込んでから)。

```bash
git add scripts/delete-legacy-users.ts
git commit -m "feat(scripts): Firestore 削除関数 (deleteFirestoreForUid) を追加"
```

---

## Task 9: Cross-reference 削除関数を実装

**Files:**
- Modify: `scripts/delete-legacy-users.ts`

- [ ] **Step 1: クロス参照削除関数を追加**

```typescript
async function deleteCrossRefsForUid(uid: string): Promise<{ copiedBy: number; reports: number }> {
  let copiedBy = 0;
  const allShared = await db.collection('shared_plans').get();
  for (const doc of allShared.docs) {
    const ref = doc.ref.collection('copiedBy').doc(uid);
    const snap = await ref.get();
    if (snap.exists) { await ref.delete(); copiedBy += 1; }
  }

  let reports = 0;
  const allListings = await db.collection('housing_listings').get();
  for (const doc of allListings.docs) {
    const snap = await doc.ref.collection('reports').where('reporterUid', '==', uid).get();
    if (snap.empty) continue;
    const batch = db.batch();
    for (const r of snap.docs) batch.delete(r.ref);
    await batch.commit();
    reports += snap.size;
  }

  return { copiedBy, reports };
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/delete-legacy-users.ts
git commit -m "feat(scripts): cross-reference 削除関数 (deleteCrossRefsForUid) を追加"
```

---

## Task 10: Storage + Auth 削除関数を実装

**Files:**
- Modify: `scripts/delete-legacy-users.ts`

- [ ] **Step 1: Storage 削除関数を追加**

```typescript
async function deleteStorageForUid(uid: string): Promise<number> {
  const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
  if (files.length === 0) return 0;
  for (const f of files) await f.delete({ ignoreNotFound: true });
  return files.length;
}
```

- [ ] **Step 2: Auth 削除関数を追加**

```typescript
async function deleteAuthForUid(uid: string): Promise<boolean> {
  try {
    await auth.deleteUser(uid);
    return true;
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') return false;
    throw err;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/delete-legacy-users.ts
git commit -m "feat(scripts): Storage + Auth 削除関数を追加"
```

---

## Task 11: Execute モード本体を main() に組み込む

**Files:**
- Modify: `scripts/delete-legacy-users.ts`

- [ ] **Step 1: main() の dry-run 出力後に execute 分岐を追加**

`if (!flags.execute) { ... return; }` の下に追加:

```typescript
  console.log('\n=== EXECUTE: deleting in 3 seconds (Ctrl-C to abort) ===');
  await new Promise((r) => setTimeout(r, 3000));

  let successCount = 0;
  for (let i = 0; i < targetUids.length; i++) {
    const uid = targetUids[i];
    console.log(`\n[${(i + 1).toString().padStart(2)}/${targetUids.length}] Deleting ${uid}...`);

    // 直前再確認 (実行中に admin claim が付与された可能性は極小だが念のため)
    try {
      const user = await auth.getUser(uid);
      if (user.customClaims?.role === 'admin') {
        console.error(`❌ ABORT: ${uid} は admin claim を持っています。 削除中止。`);
        process.exit(1);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/user-not-found') throw err;
    }

    try {
      const fs = await deleteFirestoreForUid(uid);
      const xref = await deleteCrossRefsForUid(uid);
      const st = await deleteStorageForUid(uid);
      const au = await deleteAuthForUid(uid);
      console.log(`  ✅ Firestore docs: ${fs.docs} / xref: ${xref.copiedBy}+${xref.reports} / storage: ${st} / auth: ${au ? 'deleted' : 'already gone'}`);
      successCount += 1;
    } catch (err) {
      console.error(`❌ FAILED on ${uid} (${i + 1}/${targetUids.length}). 残り ${targetUids.length - i - 1} 件未着手。`);
      console.error(err);
      process.exit(1);
    }
  }

  console.log(`\n=== Execute complete ===`);
  console.log(`Successfully deleted: ${successCount}/${targetUids.length}`);
  console.log(`次: npx tsx scripts/check-admin-claims.ts で残骸ゼロを確認してください。`);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/delete-legacy-users.ts
git commit -m "feat(scripts): execute モードを main() に組み込み"
```

- [ ] **Step 3: ダミー uid で execute モードの起動確認 (実削除はしない)**

JSON は safetycheck uids のまま:

Run: `npx tsx scripts/delete-legacy-users.ts --execute --confirm`

Expected: 14 件のループが回り、 各 uid で「Firestore docs: 0 / xref: 0+0 / storage: 0 / auth: already gone」 と出力 (= 全部空振り、 idempotent)

実行後は JSON を REPLACE_ME に戻す。

- [ ] **Step 4: --execute だけ指定して abort を確認**

Run: `npx tsx scripts/delete-legacy-users.ts --execute`

Expected: `❌ --execute を指定するときは --confirm も必須です (誤起動防止)` で abort

---

## Task 12: **【人間チェックポイント】** Prod で本実行 + 検証

**Files:**
- Modify (manual, gitignored): `docs/.private/legacy-target-uids.json`

> このタスクは**人間が実行する**。

- [ ] **Step 1: 実 uid を JSON に再転記**

Task 7 と同じ手順で 14 件の実 uid を入れる (Task 7 後に REPLACE_ME に戻した場合)。

- [ ] **Step 2: Dry-run で最終確認**

Run: `npx tsx scripts/delete-legacy-users.ts`

確認: Task 7 と同じ出力が出るか? 違いが出てたら何か変わっている → 調査。

- [ ] **Step 3: 本実行**

Run: `npx tsx scripts/delete-legacy-users.ts --execute --confirm`

進捗ログを確認:
- `[ 1/14] Deleting twitter:...` → `✅ Firestore docs: N / xref: ... / storage: N / auth: deleted` × 14
- 最後に `Successfully deleted: 14/14`

中断 (エラー abort) があった場合: ログを確認 → 原因解消 → 再実行 (idempotent なので途中から続行可能)

- [ ] **Step 4: Verification**

Run: `npx tsx scripts/check-admin-claims.ts`

Expected:
- 総ユーザー数: **9** (= Discord 9 件のみ)
- admin claim 付き: **1** (本人 Discord uid)
- `[twitter]` および `[google]` グループが消えている (出力されない)

- [ ] **Step 5: (任意) Firestore Console での spot check**

- `plans` collection を `ownerId` で query (`startsWith twitter:` / `google:`) → 0 件
- `shared_plans.ownerId` 同様
- `housing_listings.ownerUid` 同様

- [ ] **Step 6: 終了処理**

`docs/.private/legacy-target-uids.json` を REPLACE_ME に戻す (実 uid をローカル disk に残さない、 必要なら準備メモが残ってるので OK)。 または完全削除して OK (もう使わない、 次回は別 spec を作る時)。

---

## Task 13: Step 1 完了の記録更新

**Files:**
- Modify: `docs/TODO.md`
- Modify: `docs/TODO_COMPLETED.md`

- [ ] **Step 1: TODO.md の「現在の状態」「次セッション最優先」 を更新**

`docs/TODO.md` を編集:

「現在の状態」 を Step 1 完了状態に更新:

```markdown
- **ブランチ**: main、 セッション #40 (2026-05-20) で **hash 化マイグレーション Step 1 完了**
- **完了**: 廃止プロバイダーユーザー 14 件 (Twitter 12 + Google 2) を全関連データ含めて削除済。 prod は Discord 9 件のみ
- **次は Step 2**: Discord 9 件の uid を `discord:<生 ID>` → `hashed:<sha256(id+secret)>` に hash 化
```

「次セッション最優先」 を Step 2 brainstorming に更新:

```markdown
## 次セッション最優先: hash 化マイグレーション Step 2 brainstorming

1. **準備メモ + 監査結果を再確認** ([docs/.private/2026-05-19-hash-migration-prep.md](docs/.private/2026-05-19-hash-migration-prep.md))
2. **`superpowers:brainstorming` スキル発動** → Step 2 の 12 論点 (sha256 実装 / LOPO_PSEUDONYM_SECRET / migration 関数構造 / Storage rename / セッション失効 UX / テスト / デプロイ順 / プロバイダ判定 3 箇所修正 / admin_logs 旧 uid 扱い / shared_plans copiedBy 移行 / テスト mock 更新 / プライバシーポリシー文書 update)
3. **`superpowers:writing-plans` で Step 2 plan 作成** → 段階実装
4. 完了後にハウジング ログイン UI 整備に戻る (途中 6 項目あり)
```

- [ ] **Step 2: TODO_COMPLETED.md に Step 1 完了を追記 (先頭に追加)**

```markdown
## 完了 (2026-05-20 セッション 40・hash 化マイグレーション Step 1 完了)

**目的**: hash 化マイグレーション (Step 2) のテスト対象を Discord 9 件に絞るため、 廃止プロバイダーユーザー残骸を完全削除。

### 完了内容

- 設計書: [docs/superpowers/specs/2026-05-20-legacy-user-cleanup-design.md](superpowers/specs/2026-05-20-legacy-user-cleanup-design.md)
- 実装プラン: [docs/superpowers/plans/2026-05-20-legacy-user-cleanup.md](superpowers/plans/2026-05-20-legacy-user-cleanup.md)
- 新規スクリプト: `scripts/delete-legacy-users.ts` (Dry-Run + Execute, idempotent, cross-ref scan 付き)
- 新規 Vitest: `scripts/__tests__/delete-legacy-users.test.ts` (parseFlags / assertPrefixSafe)
- prod 実行: Twitter 12 + Google 2 = 14 件を関連データ (Firestore + Storage + Auth) すべて削除
- 検証: `scripts/check-admin-claims.ts` で総ユーザー数 9 件 (Discord のみ) / admin 1 件 (本人) を確認
- Vercel デプロイ不要 (scripts/ のみの変更)

### 結果

prod は Discord 9 件のみ、 hash 化マイグレーション Step 2 (本体) の前提条件達成。
```

- [ ] **Step 3: TODO.md の行数チェック**

Run: `wc -l docs/TODO.md`

Expected: 100 行以内 (超えてたら更に圧縮)

- [ ] **Step 4: Commit**

```bash
git add docs/TODO.md docs/TODO_COMPLETED.md
git commit -m "docs(hash-migration): Step 1 完了、 Step 2 を次セッション最優先に更新"
```

- [ ] **Step 5: Push (Step 1 全体)**

```bash
rtk git push
```

Vercel デプロイは scripts/ のみの変更なので不要 (Vercel が自動 skip)。

---

## 完了の定義

- ✅ prod の Twitter 12 + Google 2 = 14 件と関連データ (Firestore docs / Storage files / Auth accounts / cross-references) がすべて削除されている
- ✅ `scripts/check-admin-claims.ts` 出力で 「総ユーザー数 9、 admin 1 (本人 Discord)」 を確認できる
- ✅ Discord 9 件には一切変更が入っていない
- ✅ TODO.md / TODO_COMPLETED.md が Step 1 完了状態を反映
- ✅ commit + push 完了
- ✅ Step 2 (Discord 9 件 hash 化) の brainstorming を次セッションで開始できる状態
