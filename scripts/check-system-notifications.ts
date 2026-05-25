/**
 * system_notifications コレクションの中身を Admin SDK で読み出す診断用スクリプト。
 * デバッグ目的: published フィールドの型 / 値を確認。
 *
 * 使い方: npx tsx scripts/check-system-notifications.ts
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
  console.error('NG .env.local missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log('OK Firebase Admin initialized, projectId =', projectId);

const snap = await db.collection('system_notifications').get();
console.log(`\nDocuments: ${snap.size}\n`);

snap.forEach((doc) => {
  const data = doc.data();
  console.log(`--- ${doc.id} ---`);
  for (const [k, v] of Object.entries(data)) {
    const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    console.log(`  ${k}: ${JSON.stringify(v)}  (type: ${t})`);
  }
  console.log();
});

process.exit(0);
