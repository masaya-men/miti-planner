/**
 * backup-user-plans.ts
 * 指定 ownerId の全プラン(live + 墓標)を full data ごと JSON ファイルに退避する安全網。READ ONLY (Firestore)。
 * 緊急復旧の前に必ず実行して、現状スナップショットを残す。
 * 使い方: npx tsx scripts/backup-user-plans.ts <ownerId>
 * 出力: docs/.private/plan-backup-<ownerId 先頭8>-<epoch>.json (gitignore 配下)
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const ownerId = process.argv[2];
if (!ownerId) {
  console.error('使い方: npx tsx scripts/backup-user-plans.ts <ownerId>');
  process.exit(1);
}

async function main() {
  const snap = await db.collection('plans').where('ownerId', '==', ownerId).get();
  const docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const stamp = Date.now();
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const out = resolve(ROOT, 'docs', '.private', `plan-backup-${safeOwner}-${stamp}.json`);
  writeFileSync(out, JSON.stringify({ ownerId, exportedAtEpoch: stamp, count: docs.length, plans: docs }, null, 2), 'utf-8');
  console.log(`バックアップ完了: ${docs.length} 件 → ${out}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error('エラー:', err); process.exit(1); });
