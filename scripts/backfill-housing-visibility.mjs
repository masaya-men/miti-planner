/**
 * backfill-housing-visibility.mjs
 * housing_listings のうち visibility 未設定の doc に visibility:'public' を付与するバックフィルスクリプト
 *
 * 使い方: node scripts/backfill-housing-visibility.mjs
 *
 * .env.local から FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY を読み取り、
 * housing_listings 全 doc を走査して visibility フィールドが無いものだけ 'public' を書き込む。
 * 既存物件は全て本人テストデータのため、書き込み対象は安全に上書き可能。
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ==========================================
// .env.local を手動パース（dotenv 不使用）
// ==========================================
function loadEnv(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // クォート除去
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const envPath = resolve(ROOT, '.env.local');
const env = loadEnv(envPath);

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
// .env.local 内の \\n を実際の改行に変換
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

// ==========================================
// Firebase Admin 初期化
// ==========================================
initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore();

console.log('✅ Firebase Admin 初期化完了');

// ==========================================
// バックフィル本体
// ==========================================
async function main() {
  const snap = await db.collection('housing_listings').get();
  let updated = 0;
  const batchSize = 400;
  let batch = db.batch();
  let n = 0;
  for (const doc of snap.docs) {
    if (doc.data().visibility === undefined) {
      batch.update(doc.ref, { visibility: 'public' });
      updated++;
      n++;
      if (n >= batchSize) {
        await batch.commit();
        batch = db.batch();
        n = 0;
      }
    }
  }
  if (n > 0) await batch.commit();
  console.log(`backfilled visibility='public' on ${updated} docs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
