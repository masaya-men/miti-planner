/**
 * backup-user-data.ts
 * 指定 uid に関連する Firestore データを全 JSON 出力する保全スクリプト。
 *
 * 使い方: npx tsx scripts/backup-user-data.ts <uid>
 * 例:    npx tsx scripts/backup-user-data.ts twitter:99f8329e4bcc8c93
 *
 * 出力先: docs/.private/backups/{uid}_{timestamp}.json
 * (.private は gitignore 済 = リポジトリには上がらない)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('FIREBASE 認証情報が .env.local にありません');
  process.exit(1);
}

const targetUid = process.argv[2];
if (!targetUid) {
  console.error('uid を引数で指定してください: npx tsx scripts/backup-user-data.ts <uid>');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

function serialize(value: any): any {
  if (value === null || value === undefined) return value;
  if (value?.toDate && typeof value.toDate === 'function') {
    return { __timestamp__: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

async function main() {
  console.log(`uid=${targetUid} のデータをバックアップ中...`);

  const result: Record<string, any> = {
    uid: targetUid,
    backupAt: new Date().toISOString(),
    users: null,
    userPlanCounts: null,
    plans: [],
    sharedPlanMeta: [],
  };

  // users
  const userDoc = await db.collection('users').doc(targetUid).get();
  if (userDoc.exists) result.users = serialize(userDoc.data());
  console.log(`  users: ${userDoc.exists ? 'OK' : '(not found)'}`);

  // userPlanCounts
  const countDoc = await db.collection('userPlanCounts').doc(targetUid).get();
  if (countDoc.exists) result.userPlanCounts = serialize(countDoc.data());
  console.log(`  userPlanCounts: ${countDoc.exists ? 'OK' : '(not found)'}`);

  // plans (ownerId == targetUid)
  const plansSnap = await db.collection('plans').where('ownerId', '==', targetUid).get();
  for (const doc of plansSnap.docs) {
    result.plans.push({ id: doc.id, data: serialize(doc.data()) });
  }
  console.log(`  plans: ${plansSnap.size} 件`);

  // sharedPlanMeta (ownerId == targetUid)
  const sharedSnap = await db.collection('sharedPlanMeta').where('ownerId', '==', targetUid).get();
  for (const doc of sharedSnap.docs) {
    result.sharedPlanMeta.push({ id: doc.id, data: serialize(doc.data()) });
  }
  console.log(`  sharedPlanMeta: ${sharedSnap.size} 件`);

  // 出力
  const backupDir = resolve(ROOT, 'docs', '.private', 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const safeUid = targetUid.replace(/:/g, '_');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = resolve(backupDir, `${safeUid}_${ts}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n保存先: ${outPath}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
