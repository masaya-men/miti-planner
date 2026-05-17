/**
 * inspect-account-links.ts
 * Phase B-2 アカウント連携の Firestore 状態を一覧する調査スクリプト。
 * 使い方: npx tsx scripts/inspect-account-links.ts
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

async function main() {
  console.log('=== account_links コレクション ===');
  const snap = await db.collection('account_links').get();
  console.log(`総ドキュメント数: ${snap.size}`);

  if (snap.size === 0) {
    console.log('(空) — 連携書き込みが一度も成功していない');
  } else {
    for (const doc of snap.docs) {
      const data = doc.data();
      const linkedAt = data.linkedAt?.toDate?.()?.toISOString() || '?';
      console.log(`\n  docId: ${doc.id}`);
      console.log(`  primaryUid: ${data.primaryUid}`);
      console.log(`  linkedAt: ${linkedAt}`);
    }
  }

  // 参考: users コレクションの UID 一覧 (連携 primaryUid との対応確認)
  console.log(`\n\n=== users コレクション (UID 対応表) ===`);
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    console.log(`  ${doc.id}  displayName="${data.displayName}"  provider=${data.provider || '?'}`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
