/**
 * migrate-contents-zhko.mjs
 * contents.json の zh/ko データを Firestore の /master/contents に安全にマージす��
 *
 * - 既存データを読み取り、name フィールドに zh/ko を追加するだけ
 * - 他のフィールドは一切変更しない
 * - dataVersion を��ンクリメント（リセットしない）
 * - バックアップを自動作成
 *
 * 使い方: node scripts/migrate-contents-zhko.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// .env.local 読み込み
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const ROOT = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..');
const env = loadEnv(resolve(ROOT, '.env.local'));

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('.env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
console.log('Firebase Admin 初期化完了');

// contents.json から zh/ko マッピングを作成
const contentsJson = JSON.parse(readFileSync(resolve(ROOT, 'src/data/contents.json'), 'utf-8'));
const zhkoMap = new Map();
for (const c of contentsJson) {
  if (c.zh || c.ko) {
    zhkoMap.set(c.id, { zh: c.zh || '', ko: c.ko || '' });
  }
}
console.log(`contents.json から ${zhkoMap.size} 件の zh/ko データを読み込み`);

// Firestore の既存データを取得
const contentsRef = db.doc('master/contents');
const snap = await contentsRef.get();

if (!snap.exists) {
  console.error('/master/contents が存在しません。先��� seed-firestore.mjs を実行してください');
  process.exit(1);
}

const current = snap.data();
const items = current.items || [];
console.log(`Firestore から ${items.length} 件のコンテンツを取得`);

// バックアップ作成
const backupRef = db.collection('master_backups').doc(`contents_zhko_${Date.now()}`);
await backupRef.set({
  type: 'contents_zhko_migration',
  data: current,
  createdAt: FieldValue.serverTimestamp(),
});
console.log('バックアップ作成完了');

// name フィールドに zh/ko をマージ
let updated = 0;
for (const item of items) {
  const zhko = zhkoMap.get(item.id);
  if (!zhko) continue;

  if (!item.name) {
    item.name = { ja: '', en: '' };
  }
  item.name.zh = zhko.zh;
  item.name.ko = zhko.ko;
  updated++;
}

console.log(`${updated} / ${items.length} 件に zh/ko を追加`);

// 書き込み
await contentsRef.set({ ...current, items });
await db.doc('master/config').set(
  { dataVersion: FieldValue.increment(1) },
  { merge: true },
);

console.log('Firestore 書き込み完了');
console.log('dataVersion インクリメント完了');
console.log(`\nマイグレーション完了! ${updated} 件のコンテンツに zh/ko を追加しました`);
