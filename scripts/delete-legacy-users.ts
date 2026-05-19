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

// Firebase Auth が built-in provider (Google 等) のサインインで生成する 28 文字 UID。
// 廃止 Google プロバイダーの残骸はこの形式 (prefix 無し、 大小英数字 28 桁)。
const FIREBASE_BARE_UID_RE = /^[A-Za-z0-9]{28}$/;

export function assertPrefixSafe(uids: string[]): void {
  if (uids.length === 0) {
    throw new Error('TARGET_UIDS is empty');
  }
  for (const uid of uids) {
    if (uid.startsWith('discord:')) {
      throw new Error(`Refusing to delete discord: uid: ${uid}. Step 1 は廃止プロバイダー専用です。`);
    }
    const hasLegacyPrefix = uid.startsWith('twitter:') || uid.startsWith('google:');
    const isBareFirebaseUid = FIREBASE_BARE_UID_RE.test(uid);
    if (!hasLegacyPrefix && !isBareFirebaseUid) {
      throw new Error(`Unexpected uid format in TARGET_UIDS: ${uid}. 想定: twitter:/google: prefix もしくは 28 文字 Firebase UID。`);
    }
  }
}

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

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const targetUids = loadTargetUids(resolve(ROOT, 'docs/.private/legacy-target-uids.json'));

  console.log(`Mode: ${flags.execute && flags.confirm ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`Target uids: ${targetUids.length}`);

  assertPrefixSafe(targetUids);
  await assertNoAdminClaims(targetUids);
  console.log('✅ 安全チェック通過: prefix OK / admin claim なし');

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

  if (flags.execute && !flags.confirm) {
    console.error('❌ --execute を指定するときは --confirm も必須です (誤起動防止)');
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
