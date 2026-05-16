/**
 * seed-contents.ts
 * contents.json (= contentRegistry.ts の CONTENT_DEFINITIONS / CONTENT_SERIES) を
 * Firestore の /master/contents にマージ書き込みする
 *
 * マージ方式:
 * - contents.json の items / series を反映 (id で照合)
 * - 管理画面から追加された Firestore のみの items / series は保持される
 * - 同 id の items は name フィールドのみ「Firestore 既存 ← contents.json で上書き」 の浅マージ
 *   (= 管理画面で zh/ko 翻訳など埋めた値を contents.json に無いキーは保持する)
 *
 * 使い方: npx tsx scripts/seed-contents.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { CONTENT_DEFINITIONS, CONTENT_SERIES } from '../src/data/contentRegistry';

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
db.settings({ ignoreUndefinedProperties: true });

console.log('✅ Firebase Admin 初期化完了');

// 1. Firestore の現在の /master/contents を取得
const existingSnap = await db.doc('master/contents').get();
const existingData = existingSnap.exists ? (existingSnap.data() ?? { items: [], series: [] }) : { items: [], series: [] };
const existingItems: any[] = existingData.items ?? [];
const existingSeries: any[] = existingData.series ?? [];

// 2. contents.json (= STATIC) の id セット
const staticItemIds = new Set(CONTENT_DEFINITIONS.map(c => c.id));
const staticSeriesIds = new Set(CONTENT_SERIES.map(s => s.id));

// 3. Firestore のみの items / series を保持 (管理画面で手動追加されたもの)
const firestoreOnlyItems = existingItems.filter(i => !staticItemIds.has(i.id));
const firestoreOnlySeries = existingSeries.filter(s => !staticSeriesIds.has(s.id));
if (firestoreOnlyItems.length > 0) {
  console.log(`📌 Firestore のみの items を保持: ${firestoreOnlyItems.map(i => i.id).join(', ')}`);
}
if (firestoreOnlySeries.length > 0) {
  console.log(`📌 Firestore のみの series を保持: ${firestoreOnlySeries.map(s => s.id).join(', ')}`);
}

// 4. items のスマートマージ — contents.json で上書き、 ただし name/shortName は Firestore 既存値を底に
const existingItemById = new Map(existingItems.map(i => [i.id, i]));
const mergedItems = CONTENT_DEFINITIONS.map(staticItem => {
  const firestoreItem = existingItemById.get(staticItem.id);
  if (!firestoreItem) return staticItem;
  return {
    ...firestoreItem,
    ...staticItem,
    name: { ...(firestoreItem.name ?? {}), ...(staticItem.name ?? {}) },
    shortName: { ...(firestoreItem.shortName ?? {}), ...(staticItem.shortName ?? {}) },
  };
});

// 5. series のスマートマージ — 同様
const existingSeriesById = new Map(existingSeries.map(s => [s.id, s]));
const mergedSeries = CONTENT_SERIES.map(staticSeries => {
  const firestoreSeries = existingSeriesById.get(staticSeries.id);
  if (!firestoreSeries) return staticSeries;
  return {
    ...firestoreSeries,
    ...staticSeries,
    name: { ...(firestoreSeries.name ?? {}), ...(staticSeries.name ?? {}) },
  };
});

// 6. 書込
const finalItems = [...mergedItems, ...firestoreOnlyItems];
const finalSeries = [...mergedSeries, ...firestoreOnlySeries];
await db.doc('master/contents').set({ items: finalItems, series: finalSeries });
console.log(`✅ /master/contents 書込完了 (items: ${finalItems.length}, series: ${finalSeries.length})`);

// 7. dataVersion を+1 (キャッシュ無効化トリガー)
await db.doc('master/config').set(
  { dataVersion: FieldValue.increment(1) },
  { merge: true },
);
console.log('✅ dataVersion インクリメント完了');

console.log('\n🎉 コンテンツのシード完了！');
