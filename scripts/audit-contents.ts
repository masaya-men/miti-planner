/**
 * Firestore /master/contents の現状を監査する一時スクリプト
 * - items の seriesId が series.id と一致してるか
 * - 不明な seriesId を持つ items がないか
 * - その他の異常データ
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

initializeApp({ credential: cert({
  projectId: env.FIREBASE_PROJECT_ID,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
}) });
const db = getFirestore();

const snap = await db.doc('master/contents').get();
const data = snap.data();
const items: any[] = data?.items ?? [];
const series: any[] = data?.series ?? [];

console.log(`📊 items: ${items.length}, series: ${series.length}`);
console.log('');

// 全 series id をリスト
const seriesIds = new Set(series.map(s => s.id));
console.log(`✅ 登録済 series id (${seriesIds.size} 件):`);
console.log('  ' + [...seriesIds].sort().join(', '));
console.log('');

// items の seriesId 集計
const usedSeriesIds = new Set<string>();
const itemsWithoutMatchingSeries: { id: string; seriesId: string }[] = [];
const itemsWithEmptySeriesId: string[] = [];
for (const item of items) {
  const sid = item.seriesId;
  if (!sid || sid === '') {
    itemsWithEmptySeriesId.push(item.id);
    continue;
  }
  usedSeriesIds.add(sid);
  if (!seriesIds.has(sid)) {
    itemsWithoutMatchingSeries.push({ id: item.id, seriesId: sid });
  }
}

console.log(`📌 items が使ってる seriesId (${usedSeriesIds.size} 種類):`);
console.log('  ' + [...usedSeriesIds].sort().join(', '));
console.log('');

// 不一致を表示
if (itemsWithEmptySeriesId.length > 0) {
  console.log(`⚠️  seriesId が空 / 未設定の items: ${itemsWithEmptySeriesId.length} 件`);
  console.log('  ' + itemsWithEmptySeriesId.join(', '));
  console.log('');
}

if (itemsWithoutMatchingSeries.length > 0) {
  console.log(`⚠️  対応する series が見つからない items: ${itemsWithoutMatchingSeries.length} 件`);
  for (const x of itemsWithoutMatchingSeries) {
    console.log(`  - ${x.id} (seriesId=${x.seriesId})`);
  }
  console.log('');
}

// 使われていない series を表示
const unusedSeries = [...seriesIds].filter(sid => !usedSeriesIds.has(sid));
if (unusedSeries.length > 0) {
  console.log(`📭 どの item からも参照されていない series: ${unusedSeries.length} 件`);
  console.log('  ' + unusedSeries.join(', '));
  console.log('');
}

// 危険な ID パターン (arcadion_*, pandaemonium_N など、 旧 admin フォームの値)
const SUSPICIOUS_PATTERNS = [/^arcadion_/, /^pandaemonium_\d$/, /^eden_\d$/];
const suspiciousSeries = [...seriesIds].filter(sid =>
  SUSPICIOUS_PATTERNS.some(p => p.test(sid))
);
const suspiciousItems = items.filter(i =>
  i.seriesId && SUSPICIOUS_PATTERNS.some(p => p.test(i.seriesId))
);
if (suspiciousSeries.length > 0 || suspiciousItems.length > 0) {
  console.log(`🚨 疑わしい (旧 admin フォーム由来の) ID 検出:`);
  if (suspiciousSeries.length > 0) console.log(`  series: ${suspiciousSeries.join(', ')}`);
  if (suspiciousItems.length > 0) console.log(`  items: ${suspiciousItems.map(i => `${i.id} (${i.seriesId})`).join(', ')}`);
  console.log('');
}

if (
  itemsWithEmptySeriesId.length === 0 &&
  itemsWithoutMatchingSeries.length === 0 &&
  suspiciousSeries.length === 0 &&
  suspiciousItems.length === 0
) {
  console.log('🎉 異常なし。 全 items が正しい series を参照していて、 admin フォーム由来の壊れた残骸もなし。');
}
