/**
 * delete-personal-tags-collection.ts
 *
 * 個人タグ(personal_tags)概念の廃止(設計書: docs/superpowers/specs/2026-08-04-housing-tag-search-by-owner-design.md §5)。
 * ハウジング探すページの名前検索が housing_profiles + ownerUid ベースに切り替わったため、
 * personal_tags コレクションはコード側から一切参照されなくなった。 ユーザー承認済みで全削除する。
 *
 * 触るもの: personal_tags コレクション (サブコレクション reports 含む) のみ。 他コレクションは触らない。
 *
 * 使い方:
 *   npx tsx scripts/delete-personal-tags-collection.ts            # dry-run (既定・削除ゼロ)
 *   npx tsx scripts/delete-personal-tags-collection.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const COLLECTION = 'personal_tags';

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
if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY が必要');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log(`=== personal_tags コレクション全削除 (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

const snap = await db.collection(COLLECTION).get();
console.log(`対象: ${COLLECTION} (${snap.size} 件)\n`);

if (snap.size === 0) {
  console.log('削除対象がありません。終了します。');
  process.exit(0);
}

if (!APPLY) {
  console.log('🟢 DRY-RUN 完了。削除は行っていません。適用するには --apply を付けて再実行。');
  console.log('\n(サンプル、最大5件)');
  for (const doc of snap.docs.slice(0, 5)) {
    console.log(`  ${doc.id}: ownerUid=${doc.data().ownerUid}`);
  }
  process.exit(0);
}

let deletedDocs = 0;
let deletedReports = 0;
for (const doc of snap.docs) {
  const reportsSnap = await doc.ref.collection('reports').get();
  if (reportsSnap.size > 0) {
    const batch = db.batch();
    reportsSnap.docs.forEach((r) => batch.delete(r.ref));
    await batch.commit();
    deletedReports += reportsSnap.size;
  }
  await doc.ref.delete();
  deletedDocs++;
}

console.log(`\n🔴 APPLY 完了: personal_tags ${deletedDocs} 件 (+ reports ${deletedReports} 件) を削除しました。`);
