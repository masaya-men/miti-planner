/**
 * seed-servers.ts
 * masterData.ts のDC/サーバーデータを
 * Firestore の /master/servers に書き込む
 *
 * 使い方: npx tsx scripts/seed-servers.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  serverMasterData,
  housingAreaMasterData,
  housingSizeMasterData,
  tagMasterData,
} from '../src/data/masterData';

// .env.local 読み込み
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
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log('✅ Firebase Admin 初期化完了');

// /master/servers
const serversDoc = {
  datacenters: serverMasterData,
  housingAreas: housingAreaMasterData,
  housingSizes: housingSizeMasterData,
  tags: tagMasterData,
};
await db.doc('master/servers').set(serversDoc);
console.log(`✅ /master/servers 書き込み完了 (datacenters: ${Object.keys(serverMasterData).length}, housingAreas: ${Object.keys(housingAreaMasterData).length})`);

// dataVersion を+1
await db.doc('master/config').set(
  { dataVersion: FieldValue.increment(1) },
  { merge: true },
);
console.log('✅ dataVersion インクリメント完了');

console.log('\n🎉 サーバーデータのシード完了！');
